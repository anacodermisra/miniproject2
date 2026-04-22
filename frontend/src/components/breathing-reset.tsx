"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, RotateCcw } from "lucide-react";

interface BreathingResetProps {
  onClose: () => void;
  onComplete: () => void;
}

export function BreathingReset({ onClose, onComplete }: BreathingResetProps) {
  const [phase, setPhase] = useState<"inhale" | "hold1" | "exhale" | "hold2">("inhale");
  const [seconds, setSeconds] = useState(4);
  const [cycle, setCycle] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const TOTAL_CYCLES = 4;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isActive && cycle < TOTAL_CYCLES) {
      if (seconds > 0) {
        timer = setTimeout(() => setSeconds(seconds - 1), 1000);
      } else {
        // Transition phases
        if (phase === "inhale") {
          setPhase("hold1");
          setSeconds(4);
        } else if (phase === "hold1") {
          setPhase("exhale");
          setSeconds(4);
        } else if (phase === "hold1") {
            setPhase("exhale");
            setSeconds(4);
        } else if (phase === "exhale") {
          setPhase("hold2");
          setSeconds(4);
        } else {
          setPhase("inhale");
          setSeconds(4);
          setCycle(cycle + 1);
        }
      }
    } else if (cycle >= TOTAL_CYCLES) {
      onComplete();
    }
    return () => clearTimeout(timer);
  }, [isActive, seconds, phase, cycle, onComplete]);

  const phaseLabel = {
    inhale: "Inhale slowly",
    hold1: "Hold breath",
    exhale: "Exhale fully",
    hold2: "Hold breath",
  };

  const getCircleScale = () => {
    if (phase === "inhale") return 1.5;
    if (phase === "hold1") return 1.5;
    if (phase === "exhale") return 1;
    return 1;
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0a0a0f]/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="relative w-full max-w-md p-8 rounded-2xl bg-[#141420] border border-[#5b4fc4]/30 shadow-2xl overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#5b4fc4]/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-12">
            <h3 className="text-[#F2EFE9] font-medium">Box Breathing Reset</h3>
            <button onClick={onClose} className="p-1 hover:bg-[#1c1c2e] rounded-full transition-colors">
              <X className="w-5 h-5 text-[#857F75]" />
            </button>
          </div>

          {!isActive && cycle === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#857F75] text-sm mb-8 leading-relaxed">
                A 2-minute cycle to recalibrate your nervous system. 
                Follow the visual cues for 4 cycles.
              </p>
              <button
                onClick={() => setIsActive(true)}
                className="group relative flex items-center gap-3 px-8 py-4 bg-[#5b4fc4] rounded-full text-[#F2EFE9] font-medium transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-5 h-5" />
                Start Guided Reset
              </button>
            </div>
          ) : (
            <>
              {/* Animated Circle */}
              <div className="relative w-64 h-64 flex items-center justify-center mb-12">
                {/* Outermost ring */}
                <div className="absolute w-full h-full rounded-full border border-[#5b4fc4]/10" />
                
                {/* Pulsing visual */}
                <motion.div
                  className="w-32 h-32 rounded-full border-2 border-[#5b4fc4] shadow-[0_0_40px_rgba(91,79,196,0.2)]"
                  animate={{
                    scale: getCircleScale(),
                    opacity: phase === "inhale" || phase === "exhale" ? 1 : 0.8,
                    borderWidth: phase === "hold1" || phase === "hold2" ? 4 : 2,
                  }}
                  transition={{
                    duration: 4,
                    ease: "easeInOut"
                  }}
                />
                
                {/* Secondary inner glow */}
                <motion.div
                    className="absolute w-24 h-24 rounded-full bg-[#5b4fc4]/20"
                    animate={{ scale: getCircleScale() }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                />

                <div className="absolute flex flex-col items-center">
                  <div className="text-4xl font-light text-[#F2EFE9] tabular-nums">{seconds}</div>
                </div>
              </div>

              <div className="text-center space-y-2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-2xl font-light text-[#F2EFE9]"
                  >
                    {phaseLabel[phase]}
                  </motion.div>
                </AnimatePresence>
                <div className="text-[#857F75] text-xs uppercase tracking-widest">
                  Cycle {cycle + 1} of {TOTAL_CYCLES}
                </div>
              </div>

              <div className="mt-12 flex gap-4">
                <button
                   onClick={() => setIsActive(!isActive)}
                   className="p-3 rounded-full border border-[#1c1c2e] text-[#857F75] hover:text-[#F2EFE9] transition-colors"
                >
                    {isActive ? "Pause" : "Resume"}
                </button>
                <button
                   onClick={() => { setCycle(0); setSeconds(4); setPhase("inhale"); setIsActive(false); }}
                   className="p-3 rounded-full border border-[#1c1c2e] text-[#857F75] hover:text-[#F2EFE9] transition-colors"
                >
                    <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
