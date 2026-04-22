/** MindPulse — Auth Hook */

"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
  created_at: string;
  last_login: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("mp_token");
    if (!token) {
      setLoading(false);
      return;
    }
    if (token === "demo") {
      // Demo mode is only enabled when NEXT_PUBLIC_DEMO_MODE is explicitly set
      if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
        localStorage.removeItem("mp_token");
        setLoading(false);
        return;
      }
      const demoUser = {
        id: 0,
        email: "demo@mindpulse.app",
        username: "demo",
        display_name: "Demo User",
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      };
      setUser(demoUser);
      setLoading(false);
      return;
    }
    api.me()
      .then((u) => {
        setUser(u);
        localStorage.setItem("mp_user", JSON.stringify(u));
      })
      .catch(() => {
        localStorage.removeItem("mp_token");
        localStorage.removeItem("mp_user");
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("mp_token");
    localStorage.removeItem("mp_user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return { user, loading, logout, userId: user ? user.username : "default" };
}
