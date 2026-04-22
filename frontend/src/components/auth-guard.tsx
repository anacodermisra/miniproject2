"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/signup", "/history", "/wellness"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }

    const token = localStorage.getItem("mp_token");
    if (!token) {
      localStorage.setItem("mp_token", "demo");
      localStorage.setItem("mp_user", JSON.stringify({
        id: 0,
        email: "demo@mindpulse.app",
        username: "demo",
        display_name: "Demo User",
      }));
      setChecked(true);
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-sm text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
