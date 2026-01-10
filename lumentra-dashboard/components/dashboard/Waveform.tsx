"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { useCallSimulation } from "@/context/ConfigContext";
import type { SpeakerState } from "@/types";
import { Phone, PhoneOff, Mic, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// WAVEFORM COLORS BY STATE
// ============================================================================

const WAVEFORM_COLORS: Record<SpeakerState, string> = {
  idle: "#3f3f46", // zinc-700
  user: "#22c55e", // green-500
  ai: "#6366f1", // indigo-500
  processing: "#f59e0b", // amber-500
  ringing: "#8b5cf6", // violet-500
};

const STATE_LABELS: Record<SpeakerState, string> = {
  idle: "Awaiting Call",
  user: "Caller Speaking",
  ai: "AI Responding",
  processing: "Processing",
  ringing: "Incoming Call",
};

// ============================================================================
// WAVEFORM COMPONENT - Center Column
// ============================================================================

export default function Waveform() {
  const { speakerState, setSpeakerState, simulateCall, activeCalls } =
    useCallSimulation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const phaseRef = useRef(0);

  // ============================================================================
  // KEYBOARD CONTROLS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "u":
          setSpeakerState("user");
          break;
        case "s":
          setSpeakerState("ai");
          break;
        case "p":
          setSpeakerState("processing");
          break;
        case "c":
          simulateCall();
          break;
        case "escape":
        case "i":
          setSpeakerState("idle");
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "u" || e.key.toLowerCase() === "s") {
        // Brief processing state before returning to idle
        setSpeakerState("processing");
        setTimeout(() => setSpeakerState("idle"), 300);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [setSpeakerState, simulateCall]);

  // ============================================================================
  // CANVAS RENDERING
  // ============================================================================

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    const centerY = height / 2;

    // Clear with dark background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    // Get waveform parameters based on state
    const color = WAVEFORM_COLORS[speakerState];
    const isActive = speakerState !== "idle";
    const amplitude = isActive ? (speakerState === "processing" ? 20 : 45) : 8;
    const frequency = speakerState === "user" ? 0.025 : 0.018;

    // Draw main waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = isActive ? color : "transparent";
    ctx.shadowBlur = isActive ? 15 : 0;

    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const noise = isActive ? (Math.random() - 0.5) * amplitude * 0.4 : 0;
      const wave1 = Math.sin(x * frequency + phaseRef.current) * amplitude;
      const wave2 =
        Math.sin(x * frequency * 2 + phaseRef.current * 1.5) *
        (amplitude * 0.4);
      const y = centerY + wave1 + wave2 + noise;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw secondary wave (echo effect)
    if (isActive) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y =
          centerY +
          Math.sin(x * frequency * 0.6 + phaseRef.current * 0.7) *
            (amplitude * 0.5);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Update phase
    phaseRef.current += isActive ? 0.1 : 0.02;
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

  // ============================================================================
  // CANVAS RESIZE
  // ============================================================================

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

  const isCallActive = activeCalls.length > 0 || speakerState !== "idle";

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: WAVEFORM_COLORS[speakerState],
              boxShadow:
                speakerState !== "idle"
                  ? `0 0 8px ${WAVEFORM_COLORS[speakerState]}`
                  : "none",
            }}
          />
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {STATE_LABELS[speakerState]}
          </span>
        </div>

        {/* Call Status */}
        <div className="flex items-center gap-2">
          {isCallActive ? (
            <>
              <Phone className="h-4 w-4 text-green-500" />
              <span className="font-mono text-xs text-green-500">LIVE</span>
            </>
          ) : (
            <>
              <PhoneOff className="h-4 w-4 text-zinc-600" />
              <span className="font-mono text-xs text-zinc-600">STANDBY</span>
            </>
          )}
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="relative flex-1" style={{ willChange: "transform" }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ willChange: "transform" }}
        />

        {/* Center Status Overlay */}
        {speakerState !== "idle" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="flex items-center gap-3 rounded-full border px-4 py-2"
              style={{
                backgroundColor: `${WAVEFORM_COLORS[speakerState]}10`,
                borderColor: `${WAVEFORM_COLORS[speakerState]}30`,
              }}
            >
              {speakerState === "user" && (
                <Mic
                  className="h-4 w-4"
                  style={{ color: WAVEFORM_COLORS.user }}
                />
              )}
              {speakerState === "ai" && (
                <Volume2
                  className="h-4 w-4"
                  style={{ color: WAVEFORM_COLORS.ai }}
                />
              )}
              {speakerState === "processing" && (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  style={{ color: WAVEFORM_COLORS.processing }}
                />
              )}
              <span
                className="text-xs font-medium uppercase"
                style={{ color: WAVEFORM_COLORS[speakerState] }}
              >
                {STATE_LABELS[speakerState]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2">
        <span className="font-mono text-[10px] text-zinc-600">
          CODEC: OPUS | SAMPLE: 48kHz | BUFFER: 256ms
        </span>

        {/* Keyboard Hints */}
        <div className="flex items-center gap-3">
          <KeyHint keyName="U" label="User" />
          <KeyHint keyName="S" label="AI" />
          <KeyHint keyName="C" label="Call" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KEY HINT COMPONENT
// ============================================================================

function KeyHint({ keyName, label }: { keyName: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
        {keyName}
      </kbd>
      <span className="text-[10px] text-zinc-600">{label}</span>
    </div>
  );
}
