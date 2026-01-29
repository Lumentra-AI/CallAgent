"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Button } from "@/components/ui/button";
import { RetroGrid } from "@/components/ui/retro-grid";
import { HeroBeamDemo } from "./HeroBeamDemo";
import { useDemoOrchestrator } from "@/components/demo/DemoOrchestrator";

export function HeroSection() {
  const { triggerDemo } = useDemoOrchestrator();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Retro Grid Background - clean professional 3D grid */}
      <RetroGrid
        angle={65}
        cellSize={50}
        opacity={0.5}
        lightLineColor="#475569"
        darkLineColor="#475569"
      />

      {/* Top gradient for navbar readability */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent z-[1]" />

      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent z-[1]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 pt-28">
        <div className="text-center">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white">
              Never Miss Another Call
            </h1>
            <p className="mt-3 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-indigo-400">
              Convert Every Conversation
            </p>
          </motion.div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
          >
            Lumentra handles your calls 24/7 with human-like AI. Book
            appointments, answer questions, and grow your business while you
            sleep.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/signup" target="_blank" rel="noopener noreferrer">
              <ShimmerButton
                className="h-12 px-8 text-base font-semibold"
                background="linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </ShimmerButton>
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={() => triggerDemo("incoming-call")}
              className="h-12 px-8 bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              Watch Demo
            </Button>
          </motion.div>

          {/* Visual flow demo */}
          <HeroBeamDemo />

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto"
          >
            {[
              { value: 50000, suffix: "+", label: "Calls Handled" },
              { value: 98, suffix: "%", label: "Satisfaction" },
              { value: null, display: "24/7", label: "Availability" },
              { value: 27, suffix: "", label: "Industries" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl sm:text-4xl font-bold text-white">
                  {stat.value !== null ? (
                    <>
                      <NumberTicker value={stat.value} className="text-white" />
                      {stat.suffix}
                    </>
                  ) : (
                    stat.display
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
