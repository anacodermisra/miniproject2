"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");

    if (token) {
      localStorage.setItem("mp_token", token);
      if (email) {
        localStorage.setItem("mp_user_email", email);
      }
      router.replace("/tracking");
    } else {
      router.replace("/login?error=missing_token");
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-sm text-muted animate-pulse">Completing sign in...</div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="text-sm text-muted animate-pulse">Loading...</div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
