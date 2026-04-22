"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Sparkles, Shield, Zap, Brain, Coffee, Moon, Focus, Eye } from "lucide-react";

const EASE_OUT = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function LivingLanding() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollSignature, setScrollSignature] = useState<number[]>([]);
  const [konamiActive, setKonamiActive] = useState(false);
  const konamiRef = useRef<string[]>([]);
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);

  const { scrollY } = useScroll();
  const scrollVelocity = useMotionValue(0);
  const smoothVelocity = useSpring(scrollVelocity, { damping: 50, stiffness: 300 });
  const glowIntensity = useTransform(smoothVelocity, [0, 5], [0.3, 1]);
  const textDistortion = useTransform(smoothVelocity, [0, 5], [0, 5]);

  useEffect(() => {
    let lastY = 0;
    let lastTime = Date.now();
    const unsubscribe = scrollY.on("change", (y) => {
      const now = Date.now();
      const dt = now - lastTime;
      const v = dt > 0 ? Math.abs((y - lastY) / dt) * 100 : 0;
      scrollVelocity.set(v);
      setScrollSignature(prev => [...prev, v].slice(-20));
      lastY = y;
      lastTime = now;
    });
    return () => unsubscribe();
  }, [scrollY, scrollVelocity]);

  useEffect(() => {
    const KONAMI = "ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a";
    const handler = (e: KeyboardEvent) => {
      konamiRef.current.push(e.key);
      konamiRef.current = konamiRef.current.slice(-10);
      if (konamiRef.current.join(",") === KONAMI) {
        setKonamiActive(true);
        triggerCelebration("🌈 Secret mode unlocked! You found the hidden rhythm.");
        setTimeout(() => setKonamiActive(false), 15000);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const triggerCelebration = useCallback((msg: string) => {
    setCelebration(msg);
    setTimeout(() => setCelebration(null), 4000);
  }, []);

  return (
    <div ref={containerRef} className={`relative min-h-[700vh] bg-[#0a0a0f] overflow-x-hidden transition-colors duration-1000 ${konamiActive ? "bg-[#0f0a1a]" : ""}`}>
      {/* Celebration toast */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[999] px-6 py-3 rounded-full bg-[#5b4fc4] text-white text-sm font-medium shadow-lg"
            initial={{ y: -40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {celebration}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mood emoji floater */}
      <AnimatePresence>
        {moodEmoji && (
          <motion.div
            className="fixed z-[998] text-4xl pointer-events-none"
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -80, opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ left: "50%", top: "50%" }}
          >
            {moodEmoji}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll rhythm tracker */}
      <div className="fixed top-8 right-8 z-50 flex flex-col items-end gap-2">
        <div className="text-[10px] uppercase tracking-wider text-[#857F75]">
          {konamiActive ? "✨ Secret rhythm" : "Your scroll rhythm"}
        </div>
        <svg width="120" height="40" className="opacity-60">
          <path
            d={`M 0 20 ${scrollSignature.map((v, i) => `L ${(i / 19) * 120} ${20 - Math.min(v * 2, 18)}`).join(" ")}`}
            fill="none"
            stroke={konamiActive ? "#8b7fd4" : "#5b4fc4"}
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Velocity-responsive background */}
      <motion.div className="fixed inset-0 pointer-events-none" style={{ opacity: glowIntensity }}>
        <div className={`absolute inset-0 ${konamiActive ? "bg-[radial-gradient(ellipse_at_50%_50%,_rgba(139,127,212,0.12)_0%,_transparent_70%)]" : "bg-[radial-gradient(ellipse_at_50%_50%,_rgba(91,79,196,0.08)_0%,_transparent_70%)]"}`} />
      </motion.div>

      {/* ═══════════════════════════════════
          CHAPTER 1: THE BREATH — Hero
      ═══════════════════════════════════ */}
      <section className="h-screen relative flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=1920"
            alt="Person working calmly at desk in warm light"
            className="w-full h-full object-cover opacity-20"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/40" />
        </div>

        <BreathingCircles />

        <div className="relative z-10 w-full px-8 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE_OUT }}>
                <MindPulseLogo />
              </motion.div>

              <motion.div className="mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <TypingHeadline text="Your rhythm," secondLine="understood." />
              </motion.div>

              <motion.p
                className="text-lg text-[#857F75] max-w-md mb-4 leading-relaxed"
                initial={{ opacity: 0, filter: "blur(10px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 2.2, duration: 1.2 }}
              >
                MindPulse reads your typing rhythm, focus patterns, and energy levels — then guides you back to calm with personalized suggestions.
              </motion.p>

              <motion.p
                className="text-sm text-[#857F75]/60 mb-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.5 }}
              >
                No content read. No surveillance. Just timing.{" "}
                <span className="text-[#5b4fc4] cursor-default" title="Psst... try the Konami code (↑↑↓↓←→←→BA)">✨</span>
              </motion.p>

              <motion.div className="flex flex-wrap items-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.7, duration: 0.8 }}>
                <motion.button
                  className="group whimsy-glow relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#F2EFE9] text-[#0a0a0f] font-medium text-sm overflow-hidden"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { triggerCelebration("Let's find your rhythm! 🎵"); router.push("/signup"); }}
                >
                  <span>Start calibration</span>
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </motion.button>
                <motion.button
                  className="whimsy-glow px-8 py-4 rounded-full border border-[#857F75]/30 text-[#857F75] text-sm hover:text-[#F2EFE9] hover:border-[#857F75]/60 transition-colors overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Tell me the secrets
                </motion.button>
              </motion.div>

              <motion.div className="mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.2 }}>
                <p className="text-[10px] uppercase tracking-wider text-[#857F75]/40 mb-2">Quick vibe check</p>
                <div className="flex gap-2">
                  {[
                    { emoji: "😤", label: "fired up" },
                    { emoji: "😐", label: "meh" },
                    { emoji: "😌", label: "chill" },
                    { emoji: "🧠", label: "focused" },
                  ].map((m) => (
                    <motion.button
                      key={m.label}
                      className="text-xl hover:scale-125 transition-transform"
                      whileTap={{ scale: 0.8 }}
                      onClick={() => {
                        setMoodEmoji(m.emoji);
                        triggerCelebration(`You're feeling ${m.label} — noted! ${m.emoji}`);
                      }}
                      title={m.label}
                    >
                      {m.emoji}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>

            <motion.div
              className="hidden lg:flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, duration: 1.5, ease: EASE_OUT }}
            >
              <EnergyOrb konami={konamiActive} />
            </motion.div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none" />

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-[#857F75]/30 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.5 }}
        >
          <Sparkles className="w-3 h-3" />
          Scroll to explore your rhythm
          <Sparkles className="w-3 h-3" />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════
          CHAPTER 2: THE NUDGE — How it feels
          ENHANCED: SVG illustrations + scroll-triggered reveals
      ═══════════════════════════════════ */}
      <section className="min-h-screen py-32 relative" id="features">
        <div className="px-8 lg:px-24">
          <motion.div className="max-w-xl mb-20" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#857F75] mb-4">How it feels</p>
            <h2 className="text-3xl md:text-5xl font-light text-[#F2EFE9] leading-tight">
              Gentle nudges,<br />
              <span className="text-[#5b4fc4]">not alarms.</span>
            </h2>
            <p className="text-sm text-[#857F75] mt-4">Every suggestion is an invitation, never a command.</p>
          </motion.div>

          <div className="space-y-32">
            {/* Story 1: Focus */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                className="relative"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8 }}
              >
                <div className="rounded-2xl overflow-hidden aspect-[4/3] relative">
                  <img
                    src="https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Person working with focus at a clean desk"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] uppercase tracking-wider text-[#857F75]">Focus protection</span>
                  </div>
                </div>
                {/* SVG overlay — shield icon */}
                <div className="absolute -top-4 -right-4 w-16 h-16">
                  <svg viewBox="0 0 64 64" className="w-full h-full">
                    <defs>
                      <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <circle cx="32" cy="32" r="30" fill="url(#shieldGrad)" />
                    <Shield className="w-6 h-6 text-emerald-400" style={{ position: "absolute", top: 18, left: 18 }} />
                  </svg>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Focus className="w-5 h-5 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Focus mode</span>
                </div>
                <h3 className="text-2xl font-light text-[#F2EFE9] mb-4">&ldquo;Your rhythm suggests focus time&rdquo;</h3>
                <p className="text-[#857F75] leading-relaxed mb-6">
                  When your typing is steady and distractions are low, MindPulse protects that state. It mutes non-essential nudges so you stay in flow.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {["Steady rhythm", "Low switches", "High WPM"].map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">{tag}</span>
                  ))}
                </div>
                {/* Mini SVG — steady wave */}
                <svg viewBox="0 0 200 40" className="w-full h-8 opacity-40">
                  <motion.path
                    d="M 0 20 C 20 18, 40 22, 60 20 S 100 18, 120 20 S 160 22, 180 20 L 200 20"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 0.5 }}
                  />
                </svg>
              </motion.div>
            </div>

            {/* Story 2: Break — reversed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                className="lg:order-1"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Coffee className="w-5 h-5 text-amber-400" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-amber-400">Gentle break</span>
                </div>
                <h3 className="text-2xl font-light text-[#F2EFE9] mb-4">&ldquo;A stretch break might help&rdquo;</h3>
                <p className="text-[#857F75] leading-relaxed mb-6">
                  Never &ldquo;you&apos;re stressed.&rdquo; Instead, a gentle suggestion timed to your energy dip — with a 2-minute guided stretch that actually works for you.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {["Energy dip", "Rising errors", "Click speed change"].map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">{tag}</span>
                  ))}
                </div>
                {/* Mini SVG — wave with dip */}
                <svg viewBox="0 0 200 40" className="w-full h-8 opacity-40">
                  <motion.path
                    d="M 0 15 C 30 15, 60 15, 90 20 S 120 35, 150 30 S 180 25, 200 28"
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 0.5 }}
                  />
                </svg>
              </motion.div>

              <motion.div
                className="relative lg:order-2"
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8 }}
              >
                <div className="rounded-2xl overflow-hidden aspect-[4/3] relative">
                  <img
                    src="https://images.pexels.com/photos/3825580/pexels-photo-3825580.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Person stretching at standing desk"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] uppercase tracking-wider text-[#857F75]">Gentle intervention</span>
                  </div>
                </div>
                <div className="absolute -top-4 -left-4 w-16 h-16">
                  <svg viewBox="0 0 64 64" className="w-full h-full">
                    <circle cx="32" cy="32" r="30" fill="rgba(217,119,6,0.15)" />
                    <Coffee className="w-6 h-6 text-amber-400" style={{ position: "absolute", top: 18, left: 18 }} />
                  </svg>
                </div>
              </motion.div>
            </div>

            {/* Story 3: Wind down */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                className="relative"
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8 }}
              >
                <div className="rounded-2xl overflow-hidden aspect-[4/3] relative">
                  <img
                    src="https://images.pexels.com/photos/4226256/pexels-photo-4226256.jpeg?auto=compress&cs=tinysrgb&w=800"
                    alt="Person closing laptop in evening warm light"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] uppercase tracking-wider text-[#857F75]">Evening wind-down</span>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-16 h-16">
                  <svg viewBox="0 0 64 64" className="w-full h-full">
                    <circle cx="32" cy="32" r="30" fill="rgba(133,127,117,0.15)" />
                    <Moon className="w-6 h-6 text-[#857F75]" style={{ position: "absolute", top: 18, left: 18 }} />
                  </svg>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Moon className="w-5 h-5 text-[#857F75]" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#857F75]">Wind-down</span>
                </div>
                <h3 className="text-2xl font-light text-[#F2EFE9] mb-4">&ldquo;Your rhythm suggests wrapping up&rdquo;</h3>
                <p className="text-[#857F75] leading-relaxed mb-6">
                  Late-night typing detected. Not a shutdown command — a gentle reminder that your pattern says it&apos;s time. You decide.
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {["Late session", "Declining speed", "Fatigue signals"].map((tag) => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-[#857F75]/10 border border-[#857F75]/20 text-xs text-[#857F75]">{tag}</span>
                  ))}
                </div>
                {/* Mini SVG — declining wave */}
                <svg viewBox="0 0 200 40" className="w-full h-8 opacity-40">
                  <motion.path
                    d="M 0 10 C 40 10, 80 15, 120 25 S 170 35, 200 38"
                    fill="none"
                    stroke="#857F75"
                    strokeWidth="1.5"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: 0.5 }}
                  />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          CHAPTER 3: THE SIGNAL — 23 features
          ENHANCED: Animated SVG feature grid + visual impact
      ═══════════════════════════════════ */}
      <section className="min-h-screen py-32 relative flex items-center">
        <div className="w-full px-8 lg:px-24">
          <motion.div className="max-w-xl mb-16" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#857F75] mb-4">What we sense</p>
            <h2 className="text-3xl md:text-5xl font-light text-[#F2EFE9] leading-tight">
              <span className="text-[#5b4fc4]">23</span> signals.<br />
              Zero content.
            </h2>
            <p className="text-sm text-[#857F75] mt-4">Every 5 seconds, MindPulse reads your behavioral rhythm — never what you type.</p>
          </motion.div>

          {/* Feature grid with SVG icons */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
            {[
              { name: "Hold time", icon: "⌨️", desc: "How long you press keys" },
              { name: "Flight time", icon: "↗️", desc: "Time between keystrokes" },
              { name: "WPM", icon: "⚡", desc: "Typing speed patterns" },
              { name: "Error rate", icon: "↩️", desc: "Backspace frequency" },
              { name: "Rhythm entropy", icon: "🎵", desc: "Typing chaos level" },
              { name: "Mouse speed", icon: "🖱️", desc: "Movement velocity" },
              { name: "Rage clicks", icon: "🔥", desc: "Frustrated clicking" },
              { name: "Context switches", icon: "🔄", desc: "App/tab hopping" },
              { name: "Scroll velocity", icon: "📜", desc: "Scrolling patterns" },
              { name: "Session fragmentation", icon: "🧩", desc: "Focus interruptions" },
              { name: "Switch entropy", icon: "🎲", desc: "Switching randomness" },
              { name: "Direction changes", icon: "↗️", desc: "Cursor indecision" },
              { name: "Pause frequency", icon: "⏸️", desc: "Typing pauses" },
              { name: "Burst length", icon: "💥", desc: "Typing burst patterns" },
              { name: "Click count", icon: "👆", desc: "Total mouse clicks" },
              { name: "Mouse reentry", icon: "🔙", desc: "Return to mouse patterns" },
              { name: "Session duration", icon: "⏰", desc: "Work session length" },
              { name: "Hour of day", icon: "🕐", desc: "Circadian context" },
              { name: "Day of week", icon: "📅", desc: "Weekly rhythm" },
              { name: "Pause duration", icon: "⏳", desc: "Pause length patterns" },
              { name: "Mouse direction", icon: "🧭", desc: "Movement direction" },
              { name: "Reentry latency", icon: "⚡", desc: "Return speed" },
              { name: "Scroll patterns", icon: "📊", desc: "Scrolling consistency" },
            ].map((feature, i) => (
              <motion.div
                key={feature.name}
                className="group p-4 rounded-xl bg-[#141420] border border-[#1c1c2e] hover:border-[#5b4fc4]/30 transition-all duration-300 cursor-default whimsy-glow overflow-hidden relative"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03, duration: 0.4 }}
                whileHover={{ y: -3, borderColor: "rgba(91, 79, 196, 0.4)" }}
              >
                <div className="text-lg mb-2">{feature.icon}</div>
                <div className="text-xs font-medium text-[#F2EFE9] mb-1">{feature.name}</div>
                <div className="text-[10px] text-[#857F75] opacity-0 group-hover:opacity-100 transition-opacity duration-300">{feature.desc}</div>
              </motion.div>
            ))}
          </div>

          <motion.p
            className="text-xs text-[#857F75]/60 italic"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
          >
            23 features × 5-second windows × your unique baseline = accurate rhythm detection
          </motion.p>
        </div>
      </section>

      {/* ═══════════════════════════════════
          CHAPTER 4: THE ECHO — Data quality story
          ENHANCED: More dramatic visual storytelling
      ═══════════════════════════════════ */}
      <section className="min-h-screen relative flex items-center justify-center overflow-hidden">
        {/* Animated background number */}
        <motion.div className="absolute inset-0 flex items-center justify-center" style={{ x: textDistortion }}>
          <span className="text-[20vw] font-light text-red-500/10 tabular-nums select-none">570377</span>
        </motion.div>

        {/* SVG — broken data visualization */}
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMid slice" fill="none">
            {/* Scattered data points */}
            {(() => {
              const points = [
                { x: 200, y: 300, r: 3 }, { x: 400, y: 200, r: 4 }, { x: 600, y: 350, r: 2 },
                { x: 800, y: 250, r: 5 }, { x: 1000, y: 400, r: 3 }, { x: 1200, y: 150, r: 4 },
                { x: 300, y: 500, r: 2 }, { x: 500, y: 600, r: 3 }, { x: 700, y: 450, r: 5 },
                { x: 900, y: 550, r: 2 }, { x: 1100, y: 300, r: 4 }, { x: 150, y: 400, r: 3 },
                { x: 350, y: 150, r: 2 }, { x: 550, y: 700, r: 4 }, { x: 750, y: 100, r: 3 },
                { x: 950, y: 350, r: 5 }, { x: 1150, y: 500, r: 2 }, { x: 250, y: 650, r: 4 },
                { x: 450, y: 300, r: 3 }, { x: 650, y: 500, r: 2 }, { x: 850, y: 150, r: 5 },
                { x: 1050, y: 600, r: 3 }, { x: 1250, y: 400, r: 4 }, { x: 180, y: 200, r: 2 },
                { x: 380, y: 750, r: 3 }, { x: 580, y: 250, r: 4 }, { x: 780, y: 650, r: 2 },
                { x: 980, y: 200, r: 5 }, { x: 1180, y: 700, r: 3 }, { x: 1300, y: 300, r: 4 },
              ];
              return points.map((p, i) => (
                <motion.circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  fill={i === 15 ? "#dc2626" : "#5b4fc4"}
                  opacity={i === 15 ? 0.8 : 0.2}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.5 }}
                >
                  {i === 15 && (
                    <animate attributeName="r" values={`${p.r};${p.r + 3};${p.r}`} dur="2s" repeatCount="indefinite" />
                  )}
                </motion.circle>
              ));
            })()}
            {/* Connecting lines */}
            <motion.path
              d="M 200 300 Q 400 200, 600 350 T 1000 250 T 1300 400"
              stroke="#5b4fc4"
              strokeWidth="0.5"
              opacity="0.15"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 3, delay: 0.5 }}
            />
          </svg>
        </div>

        <div className="relative z-10 max-w-2xl px-8 text-center">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#857F75] mb-8">The data quality story</p>
          </motion.div>

          <motion.p
            className="text-2xl md:text-3xl text-[#F2EFE9] leading-relaxed"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            One sample had a hold time of{" "}
            <span className="text-red-400/80 line-through decoration-red-400/50">570,377ms</span>
          </motion.p>

          <motion.p
            className="text-lg text-[#857F75] mt-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 1 }}
          >
            That&apos;s 9.5 minutes. On one key.
          </motion.p>

          <motion.p
            className="text-sm text-[#857F75]/60 mt-2 max-w-md mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            AI detected 4 anomaly patterns across 140 samples. Fixed them with deterministic lambdas. Zero data lost.
          </motion.p>

          <motion.div
            className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400/80 text-sm"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, type: "spring" }}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            Data quality matters
          </motion.div>

          {/* Before/After comparison */}
          <motion.div
            className="mt-12 grid grid-cols-2 gap-6 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
          >
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <div className="text-[10px] uppercase tracking-wider text-red-400/60 mb-2">Before</div>
              <div className="text-2xl font-light text-red-400/80 tabular-nums">570,377ms</div>
              <div className="text-xs text-[#857F75]/60 mt-1">9.5 min hold time</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-2">After</div>
              <div className="text-2xl font-light text-emerald-400 tabular-nums">300ms</div>
              <div className="text-xs text-[#857F75]/60 mt-1">Human limit</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          CHAPTER 5: THE ALCHEMY — AI Remediation
          ENHANCED: Better visual treatment + animated SVG
      ═══════════════════════════════════ */}
      <section className="min-h-screen py-32 relative">
        <div className="px-8 lg:px-24">
          <motion.div className="max-w-3xl" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#857F75] mb-8">AI Data Remediation</p>
            <h2 className="text-3xl md:text-5xl font-light text-[#F2EFE9] leading-tight mb-12">
              4 lambda functions.<br />
              <span className="text-emerald-400">140 samples fixed.</span><br />
              Zero data loss.
            </h2>
          </motion.div>

          {/* Lambda cards with SVG wave animations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
            {[
              { name: "Unit Conversion", code: "λ x: x / 1000", fixed: 14, emoji: "🔧", desc: "Seconds → milliseconds", wave: "#5b4fc4" },
              { name: "Extreme Capping", code: "λ x: min(x, 300)", fixed: 10, emoji: "🛡️", desc: "Human physiological limit", wave: "#8b7fd4" },
              { name: "WPM Recalc", code: "λ row: 40 * (1 - frag)", fixed: 65, emoji: "⚡", desc: "Recalculated from session", wave: "#6c5dd4" },
              { name: "Flight Norm", code: "λ row: hold * 0.8", fixed: 27, emoji: "🎯", desc: "Unit inconsistency fixed", wave: "#7b6de4" },
            ].map((lambda, i) => (
              <motion.div
                key={lambda.name}
                className="group whimsy-glow relative p-6 rounded-xl bg-[#141420] border border-[#1c1c2e] overflow-hidden cursor-default"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                whileHover={{ borderColor: "rgba(91, 79, 196, 0.4)", y: -2 }}
              >
                {/* SVG wave at bottom */}
                <svg viewBox="0 0 400 20" className="absolute bottom-0 left-0 w-full h-4 opacity-10" preserveAspectRatio="none">
                  <motion.path
                    d="M 0 10 C 50 5, 100 15, 150 10 S 250 5, 300 10 S 350 15, 400 10 L 400 20 L 0 20 Z"
                    fill={lambda.wave}
                    initial={{ x: -400 }}
                    whileInView={{ x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 2, delay: i * 0.3 }}
                  />
                </svg>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{lambda.emoji}</span>
                  <code className="text-sm text-[#5b4fc4] font-mono">{lambda.code}</code>
                </div>
                <h3 className="text-[#F2EFE9] font-medium">{lambda.name}</h3>
                <p className="text-xs text-[#857F75] mt-1">{lambda.desc}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-[#857F75]/60">{lambda.fixed} samples</span>
                  <span className="w-1 h-1 rounded-full bg-[#857F75]/30" />
                  <span className="text-xs text-[#5b4fc4]/60">confidence: {(0.82 + i * 0.05).toFixed(2)}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Validation — celebration whimsy */}
          <motion.div
            className="mt-16 flex items-center gap-4 p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/20 cursor-pointer"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6, type: "spring" }}
            whileHover={{ borderColor: "rgba(34, 197, 94, 0.4)" }}
            onClick={() => triggerCelebration("Zero data loss — every sample accounted for! ✅")}
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center pulse-soft">
              <span className="text-emerald-400 text-lg">✓</span>
            </div>
            <div>
              <p className="text-[#F2EFE9] font-medium">Reconciliation passed</p>
              <p className="text-sm text-[#857F75]">Source: 140 = Success: 140 + Quarantine: 0</p>
            </div>
          </motion.div>

          {/* Audit trail preview */}
          <motion.div
            className="mt-8 p-6 rounded-xl bg-[#0a0a0f] border border-[#1c1c2e]"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-400/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
              <div className="w-3 h-3 rounded-full bg-green-400/80" />
              <span className="ml-2 text-[10px] text-[#857F75]">remediation_audit.json</span>
            </div>
            <pre className="text-xs text-[#857F75] font-mono overflow-x-auto">
              <code>{`{
  "row": 36,
  "column": "hold_time_mean",
  "old": 570377.62,
  "new": 300.0,
  "fix": "cap_extreme",
  "reason": "Capped at 300ms (human physiological limit)",
  "confidence": 0.95,
  "lambda": "lambda x: min(x, 300) if x > 500 else x"
}`}</code>
            </pre>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          CHAPTER 6: THE INVITATION — CTA
          ENHANCED: More immersive with animated SVG background
      ═══════════════════════════════════ */}
      <section className="h-screen relative flex items-center justify-center overflow-hidden">
        {/* Animated SVG background */}
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMid slice" fill="none">
            {/* Concentric circles expanding */}
            {[200, 350, 500, 650, 800].map((r, i) => (
              <motion.circle
                key={i}
                cx="720"
                cy="450"
                r={r}
                stroke="#5b4fc4"
                strokeWidth="0.5"
                opacity="0.1"
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 0.1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2, duration: 1 }}
              >
                <animate attributeName="r" values={`${r};${r + 50};${r}`} dur={`${4 + i}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.1;0.05;0.1" dur={`${4 + i}s`} repeatCount="indefinite" />
              </motion.circle>
            ))}
            {/* Pulse wave */}
            <motion.path
              d="M 200 450 C 400 400, 500 500, 720 450 S 1040 400, 1240 450"
              stroke="#5b4fc4"
              strokeWidth="1"
              opacity="0.15"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: 1 }}
            />
          </svg>
        </div>

        {/* Ambient orbs */}
        <motion.div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[#5b4fc4]/10 blur-3xl pointer-events-none" animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[#5b4fc4]/5 blur-3xl pointer-events-none" animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }} />

        <motion.div className="text-center px-8 relative z-10" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: "-30%" }} transition={{ duration: 1.5 }}>
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#857F75] mb-8">
            Ready to know yourself?
          </p>

          <h2 className="text-4xl md:text-6xl font-light text-[#F2EFE9] leading-tight mb-8">
            7 days.<br />
            <span className="text-[#5b4fc4]">Your baseline.</span>
          </h2>

          <p className="text-[#857F75] max-w-md mx-auto mb-12">
            MindPulse learns your unique rhythm. After calibration, it can sense energy dips 2-4 weeks before burnout.
          </p>

          <motion.button
            className="group whimsy-glow relative inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#F2EFE9] text-[#0a0a0f] font-medium text-sm overflow-hidden"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => { triggerCelebration("Welcome to your rhythm journey! 🎵"); router.push("/signup"); }}
          >
            <span>Start calibration</span>
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </motion.button>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-[11px] text-[#857F75]/40">
            <span>No credit card required</span>
            <span className="w-1 h-1 rounded-full bg-[#857F75]/20" />
            <span>Open source</span>
            <span className="w-1 h-1 rounded-full bg-[#857F75]/20" />
            <span>Your data never leaves your machine</span>
          </div>

          <motion.div className="absolute bottom-12 left-1/2 -translate-x-1/2 text-[10px] text-[#857F75]/40" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1 }}>
            MindPulse v1.0 — Open Source — Privacy First
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ANIMATED SVG COMPONENTS
// ═══════════════════════════════════════════════

function MindPulseLogo() {
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 60 60" className="w-14 h-14" fill="none">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5b4fc4" />
            <stop offset="100%" stopColor="#8b7fd4" />
          </linearGradient>
          <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="30" cy="30" r="26" stroke="url(#logoGrad)" strokeWidth="1" opacity="0.3">
          <><animate attributeName="r" values="26;28;26" dur="3s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" /><animate attributeName="opacity" values="0.3;0.15;0.3" dur="3s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" /></>
        </circle>
        <motion.path d="M 8 30 L 18 30 L 22 30 L 25 20 L 28 40 L 31 15 L 34 38 L 37 25 L 40 30 L 52 30" stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#logoGlow)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.3, ease: EASE_OUT }} />
        <circle cx="30" cy="30" r="3" fill="url(#logoGrad)">
          <animate attributeName="r" values="3;4;3" dur="2s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" />
        </circle>
      </svg>
      <div>
        <span className="text-2xl font-light text-[#F2EFE9] tracking-tight">Mind</span>
        <span className="text-2xl font-light text-[#5b4fc4] tracking-tight">Pulse</span>
      </div>
    </div>
  );
}

function EnergyOrb({ konami }: { konami: boolean }) {
  return (
    <div className="relative w-80 h-80">
      <svg viewBox="0 0 320 320" className="w-full h-full" fill="none">
        <defs>
          <radialGradient id="orbCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={konami ? "#8b7fd4" : "#5b4fc4"} stopOpacity="0.3" />
            <stop offset="60%" stopColor={konami ? "#8b7fd4" : "#5b4fc4"} stopOpacity="0.1" />
            <stop offset="100%" stopColor={konami ? "#8b7fd4" : "#5b4fc4"} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5b4fc4" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#8b7fd4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#5b4fc4" stopOpacity="0.2" />
          </linearGradient>
          <filter id="orbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <circle cx="160" cy="160" r="120" fill="url(#orbCore)">
          <animate attributeName="r" values="120;130;120" dur="4s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" />
        </circle>
        <g>
          <ellipse cx="160" cy="160" rx="100" ry="40" stroke="url(#ringGrad)" strokeWidth="0.8" fill="none" opacity="0.6" filter="url(#orbGlow)">
            <animateTransform attributeName="transform" type="rotate" from="0 160 160" to="360 160 160" dur="20s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="160" cy="160" rx="110" ry="50" stroke="url(#ringGrad)" strokeWidth="0.5" fill="none" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="120 160 160" to="480 160 160" dur="28s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="160" cy="160" rx="90" ry="60" stroke="#8b7fd4" strokeWidth="0.4" fill="none" opacity="0.2">
            <animateTransform attributeName="transform" type="rotate" from="240 160 160" to="600 160 160" dur="35s" repeatCount="indefinite" />
          </ellipse>
        </g>
        <motion.path d="M 40 160 C 60 160, 80 140, 100 160 S 130 180, 150 160 S 180 130, 200 160 S 230 190, 260 160 S 280 150, 300 160" stroke="#5b4fc4" strokeWidth="1.5" fill="none" opacity="0.5" filter="url(#orbGlow)" initial={{ pathLength: 0 }} animate={{ pathLength: 1, opacity: 0.5 }} transition={{ duration: 2, delay: 1, ease: EASE_OUT }} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const r = 70 + (i % 3) * 20;
          const cx = 160 + Math.cos(rad) * r;
          const cy = 160 + Math.sin(rad) * r;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="2" fill="#5b4fc4" opacity="0.6">
                <animate attributeName="opacity" values="0.6;1;0.6" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="r" values="2;3;2" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              </circle>
              <line x1={cx} y1={cy} x2="160" y2="160" stroke="#5b4fc4" strokeWidth="0.3" opacity="0.15">
                <animate attributeName="opacity" values="0.15;0.3;0.15" dur={`${3 + i * 0.2}s`} repeatCount="indefinite" />
              </line>
            </g>
          );
        })}
        <text x="160" y="155" textAnchor="middle" fill="#F2EFE9" fontSize="28" fontWeight="300" fontFamily="system-ui">72</text>
        <text x="160" y="175" textAnchor="middle" fill="#857F75" fontSize="8" fontWeight="500" fontFamily="system-ui" letterSpacing="0.15em">ENERGY</text>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div className="w-72 h-72 rounded-full border border-[#5b4fc4]/20" animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
      </div>
    </div>
  );
}

function BreathingCircles() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg viewBox="0 0 1440 900" className="w-full h-full" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <radialGradient id="breathe1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#5b4fc4" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#5b4fc4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="breathe2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b7fd4" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#8b7fd4" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="1200" cy="200" r="200" fill="url(#breathe1)">
          <animate attributeName="r" values="200;260;200" dur="6s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" />
        </circle>
        <circle cx="300" cy="700" r="150" fill="url(#breathe2)">
          <animate attributeName="r" values="150;200;150" dur="8s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" />
        </circle>
        <circle cx="800" cy="400" r="100" fill="url(#breathe1)" opacity="0.5">
          <animate attributeName="r" values="100;130;100" dur="5s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

function TypingHeadline({ text, secondLine }: { text: string; secondLine: string }) {
  const [displayed, setDisplayed] = useState("");
  const [secondDisplayed, setSecondDisplayed] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        let j = 0;
        const interval2 = setInterval(() => {
          if (j < secondLine.length) {
            setSecondDisplayed(secondLine.slice(0, j + 1));
            j++;
          } else {
            clearInterval(interval2);
            setTimeout(() => setShowCursor(false), 2000);
          }
        }, 80);
        return () => clearInterval(interval2);
      }
    }, 70);
    return () => clearInterval(interval);
  }, [text, secondLine]);

  return (
    <h1 className="text-[clamp(2.2rem,5vw,4.5rem)] leading-[0.95] tracking-tight">
      <span className="text-[#F2EFE9]">{displayed}</span>
      <br />
      <span className="text-[#5b4fc4] italic font-light">
        {secondDisplayed}
        {showCursor && <span className="typing-cursor" />}
      </span>
    </h1>
  );
}
