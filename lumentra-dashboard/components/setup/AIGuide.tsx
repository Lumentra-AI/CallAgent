"use client";

import { motion, Variants } from "framer-motion";
import { CircularWaveform } from "@/components/demo/VoiceWaveform";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIGuideProps {
  state: "idle" | "thinking" | "speaking" | "listening";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: 80,
  md: 120,
  lg: 160,
};

const guideVariants: Variants = {
  idle: {
    scale: 1,
    transition: { duration: 0.5 },
  },
  thinking: {
    scale: [1, 1.02, 1],
    transition: { duration: 0.8, repeat: Infinity },
  },
  speaking: {
    scale: 1,
  },
  listening: {
    scale: 1.05,
    transition: { duration: 0.3 },
  },
};

export function AIGuide({ state, size = "lg", className }: AIGuideProps) {
  const actualSize = SIZE_MAP[size];

  return (
    <motion.div
      variants={guideVariants}
      animate={state}
      className={cn("relative", className)}
      style={{ width: actualSize, height: actualSize }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(135deg, var(--primary) 0%, transparent 70%)",
          opacity: 0.2,
        }}
        animate={{
          scale: state === "speaking" ? [1, 1.15, 1] : 1,
          opacity: state === "speaking" ? [0.2, 0.4, 0.2] : 0.2,
        }}
        transition={{
          duration: 0.8,
          repeat: state === "speaking" ? Infinity : 0,
          ease: "easeInOut",
        }}
      />

      {/* Secondary glow ring */}
      <motion.div
        className="absolute inset-2 rounded-full"
        style={{
          background:
            "linear-gradient(225deg, var(--primary) 0%, transparent 70%)",
          opacity: 0.15,
        }}
        animate={{
          scale: state === "speaking" ? [1, 1.1, 1] : 1,
          opacity: state === "speaking" ? [0.15, 0.3, 0.15] : 0.15,
        }}
        transition={{
          duration: 0.6,
          repeat: state === "speaking" ? Infinity : 0,
          delay: 0.1,
          ease: "easeInOut",
        }}
      />

      {/* Waveform visualization */}
      <CircularWaveform
        isActive={state !== "idle"}
        isSpeaking={state === "speaking"}
        size={actualSize}
        className="text-primary"
      />

      {/* Thinking indicator overlay */}
      {state === "thinking" && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Sparkles className="h-8 w-8 text-primary" />
        </motion.div>
      )}

      {/* Listening indicator */}
      {state === "listening" && (
        <motion.div
          className="absolute -inset-2 rounded-full border-2 border-primary/50"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1.1, opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
