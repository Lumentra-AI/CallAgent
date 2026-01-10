"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, DollarSign } from "lucide-react";
import { useConfig } from "@/context/ConfigContext";
import type { SpeakerState, LogEntry } from "@/types";

// Waveform colors by state
const WAVEFORM_COLORS: Record<SpeakerState, string> = {
  idle: "#3f3f46", // zinc-700
  user: "#22c55e", // green-500
  ai: "#10b981", // emerald-500
  processing: "#f59e0b", // amber-500
};

export default function LiveMonitor() {
  const { config, metrics, logs, addLog } = useConfig();
  const [speakerState, setSpeakerState] = useState<SpeakerState>("idle");
  const [showRevenue, setShowRevenue] = useState(false);
  const [sessionRevenue, setSessionRevenue] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const phaseRef = useRef(0);

  // Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "u":
          setSpeakerState("user");
          if (!callActive) {
            setCallActive(true);
            addLog({ type: "CALL", message: "CALL_INITIATED inbound=true" });
          }
          addLog({ type: "INFO", message: "VAD_TRIGGER speaker=USER" });
          break;
        case "s":
          setSpeakerState("ai");
          addLog({ type: "INFO", message: "TTS_PLAYBACK initiated" });
          break;
        case "x":
          if (callActive) {
            setSpeakerState("idle");
            setCallActive(false);
            const revenue = config.pricing.baseRate;
            setSessionRevenue(revenue);
            setShowRevenue(true);
            addLog({
              type: "CALL",
              message: `CALL_COMPLETE duration=247s revenue=$${revenue}`,
            });
            addLog({
              type: "SYS",
              message:
                "BOOKING_CONFIRMED id=BK-" +
                Math.random().toString(36).slice(2, 8).toUpperCase(),
            });
            setTimeout(() => setShowRevenue(false), 3000);
          }
          break;
        case "i":
          setSpeakerState("idle");
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "u" || e.key.toLowerCase() === "s") {
        if (callActive) {
          setSpeakerState("processing");
          setTimeout(() => {
            if (callActive) setSpeakerState("idle");
          }, 500);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [callActive, config.pricing.baseRate, addLog]);

  // Waveform Animation
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const centerY = height / 2;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    const color = WAVEFORM_COLORS[speakerState];
    const amplitude =
      speakerState === "idle" ? 5 : speakerState === "processing" ? 15 : 40;
    const frequency = speakerState === "user" ? 0.02 : 0.015;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = speakerState === "idle" ? 0 : 10;

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const noise =
        speakerState !== "idle" ? (Math.random() - 0.5) * amplitude * 0.3 : 0;
      const y =
        centerY +
        Math.sin(x * frequency + phaseRef.current) * amplitude +
        Math.sin(x * frequency * 2 + phaseRef.current * 1.5) *
          (amplitude * 0.5) +
        noise;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Secondary wave for depth
    if (speakerState !== "idle") {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y =
          centerY +
          Math.sin(x * frequency * 0.7 + phaseRef.current * 0.8) *
            (amplitude * 0.6);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    phaseRef.current += speakerState === "idle" ? 0.02 : 0.08;
    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [speakerState]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(drawWaveform);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawWaveform]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="h-full grid grid-cols-[200px_1fr_280px] gap-0">
      {/* Left Column - Telemetry */}
      <div className="bg-zinc-950 border-r border-zinc-800 p-4 overflow-y-auto">
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-4">
          Telemetry
        </div>
        <div className="space-y-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="border-b border-zinc-900 pb-2">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">
                {metric.label}
              </div>
              <div
                className={`text-lg font-mono font-medium ${
                  metric.status === "warning"
                    ? "text-amber-500"
                    : metric.status === "critical"
                      ? "text-rose-500"
                      : "text-white"
                }`}
              >
                {metric.value}
                {metric.unit && (
                  <span className="text-xs text-zinc-500 ml-1">
                    {metric.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Call Status */}
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
            Session
          </div>
          <div className="flex items-center gap-2">
            {callActive ? (
              <>
                <Phone className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-mono text-emerald-500">LIVE</span>
              </>
            ) : (
              <>
                <PhoneOff className="w-4 h-4 text-zinc-600" />
                <span className="text-xs font-mono text-zinc-600">STANDBY</span>
              </>
            )}
          </div>
        </div>

        {/* Keyboard Hints */}
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-3">
            Controls
          </div>
          <div className="space-y-1 text-[10px] font-mono text-zinc-600">
            <div>
              <span className="text-zinc-400 bg-zinc-900 px-1 rounded">U</span>{" "}
              User Speaking
            </div>
            <div>
              <span className="text-zinc-400 bg-zinc-900 px-1 rounded">S</span>{" "}
              AI Speaking
            </div>
            <div>
              <span className="text-zinc-400 bg-zinc-900 px-1 rounded">X</span>{" "}
              End Call
            </div>
          </div>
        </div>
      </div>

      {/* Center Column - Visualizer */}
      <div className="relative bg-black flex flex-col">
        {/* State Indicator */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: WAVEFORM_COLORS[speakerState],
                boxShadow:
                  speakerState !== "idle"
                    ? `0 0 10px ${WAVEFORM_COLORS[speakerState]}`
                    : "none",
              }}
            />
            <span className="text-[10px] font-mono text-zinc-500 uppercase">
              {speakerState === "idle"
                ? "AWAITING INPUT"
                : speakerState === "user"
                  ? "USER SPEAKING"
                  : speakerState === "ai"
                    ? "AI RESPONDING"
                    : "PROCESSING"}
            </span>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="flex-1 relative" style={{ willChange: "transform" }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ willChange: "transform" }}
          />
        </div>

        {/* Revenue Animation */}
        <AnimatePresence>
          {showRevenue && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-zinc-900 border border-emerald-500/50 rounded-lg px-8 py-6 text-center">
                <DollarSign className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-3xl font-mono font-bold text-emerald-500">
                  +${sessionRevenue}
                </div>
                <div className="text-xs font-mono text-zinc-500 mt-1">
                  REVENUE CAPTURED
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Status */}
        <div className="h-8 bg-zinc-950 border-t border-zinc-800 flex items-center px-4">
          <span className="text-[10px] font-mono text-zinc-600">
            CODEC: OPUS | SAMPLE: 48kHz | BUFFER: 256ms
          </span>
        </div>
      </div>

      {/* Right Column - Terminal */}
      <div className="bg-black border-l border-zinc-800 flex flex-col">
        <div className="h-8 bg-zinc-950 border-b border-zinc-800 flex items-center px-3">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            System Log
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
          {logs.map((log) => (
            <LogLine key={log.id} log={log} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LogLine({ log }: { log: LogEntry }) {
  const typeColors: Record<LogEntry["type"], string> = {
    INFO: "text-emerald-500",
    WARN: "text-amber-500",
    ERR: "text-rose-500",
    SYS: "text-cyan-500",
    CALL: "text-violet-500",
  };

  return (
    <div className="flex gap-2 py-0.5 hover:bg-zinc-950">
      <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
      <span className={`shrink-0 ${typeColors[log.type]}`}>{log.type}</span>
      <span className="text-zinc-400 truncate">{log.message}</span>
    </div>
  );
}
