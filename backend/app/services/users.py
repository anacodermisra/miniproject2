"""MindPulse Backend — User Database & Auth Service."""

from __future__ import annotations
import sqlite3
import threading
import os
import secrets
from typing import Optional

from app.core.auth import hash_password, verify_password, create_access_token

_DB_PATH = os.path.normpath(
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "ml", "artifacts", "users.db"
    )
)
_LOCK = threading.RLock()


def _connect() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                display_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
            """
        )
        conn.commit()


_init_db()


def create_user(
    email: str, username: str, password: str, display_name: Optional[str] = None
) -> Optional[dict]:
    hashed = hash_password(password)
    with _LOCK:
        try:
            with _connect() as conn:
                cursor = conn.execute(
                    "INSERT INTO users (email, username, hashed_password, display_name) VALUES (?, ?, ?, ?)",
                    (email.lower(), username.lower(), hashed, display_name or username),
                )
                conn.commit()
                row = conn.execute(
                    "SELECT id, email, username, display_name, created_at FROM users WHERE id = ?",
                    (cursor.lastrowid,),
                ).fetchone()
                return dict(row) if row else None
        except sqlite3.IntegrityError:
            return None


def authenticate_user(email_or_username: str, password: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? OR username = ?",
            (email_or_username.lower(), email_or_username.lower()),
        ).fetchone()
    if not row:
        return None
    if not verify_password(password, row["hashed_password"]):
        return None

    with _LOCK:
        with _connect() as conn:
            conn.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
                (row["id"],),
            )
            conn.commit()

    return {
        "id": row["id"],
        "email": row["email"],
        "username": row["username"],
        "display_name": row["display_name"],
        "created_at": row["created_at"],
    }


def get_user_by_id(user_id: int) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, username, display_name, created_at, last_login FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, email, username, display_name FROM users WHERE email = ?",
            (email.lower(),),
        ).fetchone()
    return dict(row) if row else None


def login(email_or_username: str, password: str) -> Optional[dict]:
    user = authenticate_user(email_or_username, password)
    if not user:
        return None
    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "display_name": user["display_name"],
        },
        "access_token": token,
        "token_type": "bearer",
    }


def _build_user_dict(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "username": row["username"],
        "display_name": row["display_name"],
        "created_at": row["created_at"],
    }


def create_google_user(email: str, name: str, google_id: str) -> Optional[dict]:
    random_password = secrets.token_urlsafe(32)
    email_prefix = email.split("@")[0]
    username_base = email_prefix.lower().replace(".", "_").replace("+", "_")
    username = username_base
    suffix = 1
    with _connect() as conn:
        while conn.execute(
            "SELECT 1 FROM users WHERE username = ?", (username,)
        ).fetchone():
            username = f"{username_base}{suffix}"
            suffix += 1
    return create_user(email, username, random_password, name)


def create_or_login_google_user(
    email: str, name: str, google_id: str
) -> Optional[dict]:
    existing = get_user_by_email(email)
    if existing:
        with _connect() as conn:
            conn.execute(
                "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
                (existing["id"],),
            )
            conn.commit()
        token = create_access_token(
            {"sub": str(existing["id"]), "email": existing["email"]}
        )
        return {
            "user": {
                "id": existing["id"],
                "email": existing["email"],
                "username": existing["username"],
                "display_name": existing["display_name"],
            },
            "access_token": token,
            "token_type": "bearer",
        }

    user = create_google_user(email, name, google_id)
    if not user:
        return None
    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "username": user["username"],
            "display_name": user["display_name"],
        },
        "access_token": token,
        "token_type": "bearer",
    }
