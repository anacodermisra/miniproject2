"use client";

import { signIn as naSignIn, signOut as naSignOut } from "next-auth/react";
import type { Session } from "next-auth";
import { setToken, clearToken } from "@/lib/api";

export async function signIn(email: string, password: string) {
  const result = await naSignIn("credentials", {
    email,
    password,
    redirect: false,
  });

  if (result?.ok && result.error == null) {
    const session = await getSession();
    const token = (session?.user as any)?.token;
    if (token) {
      setToken(token);
    }
  }

  return result;
}

export function signOut() {
  clearToken();
  return naSignOut({ redirectTo: "/login" });
}

export async function getSession(): Promise<Session | null> {
  const res = await fetch("/api/auth/session", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export { useSession } from "next-auth/react";
