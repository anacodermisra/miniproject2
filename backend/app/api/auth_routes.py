"""MindPulse Backend — Auth API Routes."""

from __future__ import annotations
import os
import json
import secrets
import urllib.parse
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.services import users
from app.core.auth import decode_access_token

router = APIRouter()
bearer_scheme = HTTPBearer()


class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    display_name: Optional[str] = None


class LoginRequest(BaseModel):
    email_or_username: str
    password: str


class AuthResponse(BaseModel):
    user: dict
    access_token: str
    token_type: str = "bearer"


@router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    if len(req.password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters"
        )
    user = users.create_user(req.email, req.username, req.password, req.display_name)
    if not user:
        raise HTTPException(status_code=409, detail="Email or username already exists")
    token_data = users.login(req.email, req.password)
    if not token_data:
        raise HTTPException(status_code=500, detail="Signup succeeded but login failed")
    return AuthResponse(**token_data)


@router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    result = users.login(req.email_or_username, req.password)
    if not result:
        raise HTTPException(
            status_code=401, detail="Invalid email/username or password"
        )
    return AuthResponse(**result)


@router.get("/auth/me")
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    if credentials.credentials == "demo":
        return {
            "id": 0,
            "email": "demo@mindpulse.app",
            "username": "demo",
            "display_name": "Demo User",
            "created_at": None,
            "last_login": None,
        }
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = int(payload.get("sub", 0))
    user = users.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/google/callback"
)
FRONTEND_CALLBACK_URL = os.getenv(
    "FRONTEND_CALLBACK_URL", "http://localhost:3000/auth/callback"
)


@router.get("/auth/google")
async def google_oauth_start():
    """Initiate Google OAuth flow, generating a CSRF state token."""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urllib.parse.urlencode(params)
    )
    response = RedirectResponse(url=google_auth_url, status_code=302)
    # Store state in a short-lived HttpOnly cookie for CSRF validation
    response.set_cookie(
        "oauth_state",
        state,
        httponly=True,
        max_age=600,
        samesite="lax",
        secure=os.getenv("ENVIRONMENT", "development") != "development",
    )
    return response


@router.get("/auth/google/callback")
async def google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        )

    # Validate CSRF state
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or not secrets.compare_digest(cookie_state, state):
        raise HTTPException(status_code=400, detail="Invalid or missing OAuth state parameter")

    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    token_resp = requests.post(token_url, data=token_data)
    if token_resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to exchange code for tokens: {token_resp.text}",
        )

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    userinfo_resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if userinfo_resp.status_code != 200:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to fetch user info from Google: {userinfo_resp.text}",
        )

    userinfo = userinfo_resp.json()
    email = userinfo.get("email")
    name = userinfo.get("name", email.split("@")[0])
    google_id = userinfo.get("id")

    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email")

    result = users.create_or_login_google_user(email, name, google_id)
    if not result:
        raise HTTPException(
            status_code=500, detail="Failed to create or login user"
        )

    jwt_token = result["access_token"]
    user_json = json.dumps(result["user"])

    callback_url = (
        f"{FRONTEND_CALLBACK_URL}"
        f"#token={urllib.parse.quote(jwt_token)}"
        f"&user={urllib.parse.quote(user_json)}"
    )

    response = RedirectResponse(url=callback_url, status_code=302)
    # Clear the state cookie after successful use
    response.delete_cookie("oauth_state")
    return response
