"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, setToken } from "@/lib/api";
import { ArrowRight, Eye, EyeOff, Sparkles, Check } from "lucide-react";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/tracking";
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setIsReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("mp_token");
    if (token) router.push("/tracking");
  }, [router]);

  useEffect(() => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  }, [password]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await api.signup(email, username, password);
      setToken(result.access_token);
      localStorage.setItem("mp_user", JSON.stringify(result.user));
      router.push(from);
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-emerald-500"];
  const strengthLabels = ["Weak", "Fair", "Good", "Strong", "Excellent"];

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] overflow-hidden flex items-center justify-center px-4">
      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMid slice" fill="none">
          <motion.circle cx="1100" cy="200" r="280" fill="#5b4fc4" opacity="0.03">
            <animate attributeName="r" values="280;320;280" dur="9s" repeatCount="indefinite" />
          </motion.circle>
          <motion.circle cx="300" cy="750" r="220" fill="#8b7fd4" opacity="0.02">
            <animate attributeName="r" values="220;260;220" dur="11s" repeatCount="indefinite" />
          </motion.circle>
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`h-${i}`} x1="0" y1={i * 100} x2="1440" y2={i * 100} stroke="#1c1c2e" strokeWidth="0.3" opacity="0.3" />
          ))}
          {Array.from({ length: 15 }).map((_, i) => (
            <line key={`v-${i}`} x1={i * 100} y1="0" x2={i * 100} y2="900" stroke="#1c1c2e" strokeWidth="0.3" opacity="0.3" />
          ))}
          <motion.path
            d="M 0 450 C 240 430, 480 470, 720 450 S 960 430, 1200 450 S 1380 470, 1440 450"
            stroke="#5b4fc4"
            strokeWidth="0.5"
            opacity="0.15"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, ease: EASE_OUT }}
          />
        </svg>
      </div>

      {/* Celebration toast */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] px-6 py-3 rounded-full bg-[#5b4fc4]/90 text-[#F2EFE9] text-sm font-medium shadow-lg backdrop-blur-sm"
            initial={{ y: -40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Sparkles className="w-3 h-3 inline mr-2" />
            Creating your rhythm profile...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main form container */}
      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={isReady ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 1, ease: EASE_OUT }}
      >
        {/* Logo area */}
        <motion.div className="text-center mb-10" initial={{ opacity: 0 }} animate={isReady ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}>
          <div className="inline-flex items-center gap-3 mb-4">
            <svg viewBox="0 0 60 60" className="w-10 h-10" fill="none">
              <defs>
                <linearGradient id="signupLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5b4fc4" />
                  <stop offset="100%" stopColor="#8b7fd4" />
                </linearGradient>
              </defs>
              <circle cx="30" cy="30" r="26" stroke="url(#signupLogoGrad)" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" values="26;28;26" dur="3s" repeatCount="indefinite" />
              </circle>
              <path d="M 8 30 L 18 30 L 22 30 L 25 20 L 28 40 L 31 15 L 34 38 L 37 25 L 40 30 L 52 30" stroke="url(#signupLogoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <circle cx="30" cy="30" r="3" fill="url(#signupLogoGrad)">
                <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
              </circle>
            </svg>
            <div>
              <span className="text-xl font-light text-[#F2EFE9] tracking-tight">Mind</span>
              <span className="text-xl font-light text-[#5b4fc4] tracking-tight">Pulse</span>
            </div>
          </div>
          <p className="text-sm text-[#857F75]">Start your rhythm journey</p>
        </motion.div>

        {/* Form card */}
        <motion.div
          className="p-6 rounded-2xl bg-[#141420] border border-[#1c1c2e]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isReady ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: 0.3, duration: 0.8, ease: EASE_OUT }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring" }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email field */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={isReady ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.4 }}>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#857F75] mb-2">Email</label>
              <div className={`relative rounded-lg border transition-all duration-300 ${focusedField === "email" ? "border-[#5b4fc4]/50 bg-[#1c1c2e]" : "border-[#1c1c2e] bg-[#0a0a0f]"}`}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full px-4 py-3 bg-transparent text-[#F2EFE9] text-sm focus:outline-none placeholder:text-[#857F75]/40"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <motion.div className="absolute bottom-0 left-0 h-[1px] bg-[#5b4fc4]" initial={{ width: "0%" }} animate={{ width: focusedField === "email" ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
              </div>
            </motion.div>

            {/* Username field */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={isReady ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.5 }}>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#857F75] mb-2">Username</label>
              <div className={`relative rounded-lg border transition-all duration-300 ${focusedField === "username" ? "border-[#5b4fc4]/50 bg-[#1c1c2e]" : "border-[#1c1c2e] bg-[#0a0a0f]"}`}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full px-4 py-3 bg-transparent text-[#F2EFE9] text-sm focus:outline-none placeholder:text-[#857F75]/40"
                  placeholder="johndoe"
                  required
                  autoComplete="username"
                />
                <motion.div className="absolute bottom-0 left-0 h-[1px] bg-[#5b4fc4]" initial={{ width: "0%" }} animate={{ width: focusedField === "username" ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
              </div>
            </motion.div>

            {/* Password field */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={isReady ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.6 }}>
              <label className="block text-[11px] uppercase tracking-[0.15em] text-[#857F75] mb-2">Password</label>
              <div className={`relative rounded-lg border transition-all duration-300 ${focusedField === "password" ? "border-[#5b4fc4]/50 bg-[#1c1c2e]" : "border-[#1c1c2e] bg-[#0a0a0f]"}`}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="w-full px-4 py-3 pr-12 bg-transparent text-[#F2EFE9] text-sm focus:outline-none placeholder:text-[#857F75]/40"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#857F75] hover:text-[#F2EFE9] transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <motion.div className="absolute bottom-0 left-0 h-[1px] bg-[#5b4fc4]" initial={{ width: "0%" }} animate={{ width: focusedField === "password" ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <motion.div className="mt-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.3 }}>
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-[#1c1c2e]"}`} />
                    ))}
                  </div>
                  <p className="text-[10px] text-[#857F75]/60">
                    {passwordStrength > 0 ? strengthLabels[passwordStrength - 1] : "Too short"}
                  </p>
                </motion.div>
              )}
            </motion.div>

            {/* Submit button */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={isReady ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.7 }}>
              <motion.button
                type="submit"
                disabled={loading}
                className="group relative w-full py-3 rounded-lg bg-[#5b4fc4] text-[#F2EFE9] text-sm font-medium overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" initial={{ x: "-100%" }} whileHover={{ x: "100%" }} transition={{ duration: 0.6 }} />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <motion.div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          </form>
        </motion.div>

        {/* Links */}
        <motion.div className="mt-8 text-center space-y-3" initial={{ opacity: 0 }} animate={isReady ? { opacity: 1 } : {}} transition={{ delay: 0.8 }}>
          <p className="text-xs text-[#857F75]">
            Already have an account?{" "}
            <a href="/login" className="text-[#5b4fc4] hover:text-[#8b7fd4] transition-colors">
              Sign in
            </a>
          </p>
          <p className="text-xs text-[#857F75]">
            <a href="/" className="text-[#857F75] hover:text-[#F2EFE9] transition-colors">
              Back to home
            </a>
          </p>
        </motion.div>
      </motion.div>

      {/* Bottom decorative element */}
      <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-[#857F75]/30 flex items-center gap-2" initial={{ opacity: 0 }} animate={isReady ? { opacity: 1 } : {}} transition={{ delay: 1 }}>
        <Sparkles className="w-3 h-3" />
        No credit card required
        <Sparkles className="w-3 h-3" />
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <SignupForm />
    </Suspense>
  );
}
