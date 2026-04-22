import { type NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.NEXT_PUBLIC_API_URL;
if (!BACKEND_BASE) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("NEXT_PUBLIC_API_URL environment variable must be set in non-development environments.");
  }
  console.warn("[Google OAuth] NEXT_PUBLIC_API_URL is not set; falling back to http://localhost:5000/api/v1");
}
const BACKEND_URL = BACKEND_BASE || "http://localhost:5000/api/v1";

/**
 * Proxy the Google OAuth authorization code to the backend.
 * Google redirects here with ?code=... after the user approves.
 * We forward the code (and any state) to the backend's callback handler,
 * then deliver the resulting token via a short-lived HttpOnly-readable cookie
 * instead of a URL query parameter to avoid exposing it in browser history.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  const params = new URLSearchParams({ code });
  if (state) params.set("state", state);

  const backendUrl = `${BACKEND_URL}/auth/google/callback?${params.toString()}`;

  try {
    const res = await fetch(backendUrl, { method: "GET" });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.access_token) {
      const detail = data?.detail || "auth_failed";
      console.error(`[Google OAuth] Backend callback failed (${res.status}): ${detail}`);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(detail)}`, request.url)
      );
    }

    // Deliver the token via a short-lived cookie rather than a URL query
    // parameter so it is not stored in browser history, server logs, or
    // referrer headers. httpOnly must be false because the client stores
    // the token in localStorage — the cookie is only a transient carrier
    // and offers no weaker XSS protection than localStorage itself.
    const response = NextResponse.redirect(new URL("/tracking", request.url));
    response.cookies.set("mp_oauth_token", data.access_token, {
      httpOnly: false, // must be readable by client JS to store in localStorage
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60, // 60 seconds — consumed immediately on /tracking
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[Google OAuth] Unexpected error in callback proxy:", err);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}
