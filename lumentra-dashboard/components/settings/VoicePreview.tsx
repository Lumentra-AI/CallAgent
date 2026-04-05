"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, Play, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetchRaw } from "@/lib/api/client";

// ============================================================================
// TYPES
// ============================================================================

interface VoicePreviewProps {
  voiceId: string;
  voiceName: string;
  provider: "openai" | "elevenlabs" | "cartesia";
  speakingRate: number;
  pitch: number;
  sampleText?: string;
  compact?: boolean;
}

// ============================================================================
// SAMPLE TEXTS
// ============================================================================

const SAMPLE_TEXTS = {
  default:
    "Hello! Thank you for calling. How can I assist you today? I'm here to help with any questions you might have.",
  greeting:
    "Good morning! Welcome to our service. I'd be happy to help you with your inquiry.",
  booking:
    "I've found an available appointment for you. Would 2:30 PM tomorrow work for your schedule?",
  confirmation:
    "Your appointment has been confirmed. You'll receive a confirmation email shortly. Is there anything else I can help you with?",
};

// ============================================================================
// PROVIDER DISPLAY NAMES
// ============================================================================

const PROVIDER_LABELS: Record<string, string> = {
  cartesia: "Cartesia Sonic-3",
  openai: "OpenAI TTS",
  elevenlabs: "ElevenLabs",
};

// ============================================================================
// VOICE PREVIEW COMPONENT
// ============================================================================

export function VoicePreview({
  voiceId,
  voiceName,
  provider,
  speakingRate,
  pitch,
  sampleText = SAMPLE_TEXTS.default,
  compact = false,
}: VoicePreviewProps) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopPlayback = useCallback(() => {
    if (!sourceRef.current) {
      setPlaying(false);
      return;
    }

    sourceRef.current.onended = null;

    try {
      sourceRef.current.stop();
    } catch {
      // Ignore stop errors for already-finished nodes.
    }

    sourceRef.current.disconnect();
    sourceRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, [stopPlayback]);

  const play = useCallback(async () => {
    if (playing) {
      stopPlayback();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (
          window as Window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("Audio preview is not supported in this browser");
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const res = await apiFetchRaw("/api/voice/preview", {
        method: "POST",
        body: JSON.stringify({ voiceId, sampleText, speed: speakingRate }),
      });
      if (!res.ok) {
        throw new Error("Preview failed");
      }

      const audioBuffer = await res.arrayBuffer();
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);

      stopPlayback();

      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      source.onended = () => {
        source.disconnect();
        if (sourceRef.current === source) {
          sourceRef.current = null;
          setPlaying(false);
        }
      };
      sourceRef.current = source;
      source.start(0);
      setPlaying(true);
    } catch (err) {
      stopPlayback();
      setError(
        err instanceof Error ? err.message : "Could not generate preview",
      );
    } finally {
      setLoading(false);
    }
  }, [voiceId, sampleText, speakingRate, playing, stopPlayback]);

  const providerLabel = PROVIDER_LABELS[provider] || provider;
  void pitch;

  // Compact version: small play button for voice grid cards
  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          play();
        }}
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        title={`Preview ${voiceName}`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : playing ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>
    );
  }

  // Full version: preview panel with play button
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Volume2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{voiceName}</div>
          <div className="text-xs text-muted-foreground">{providerLabel}</div>
        </div>
        <button
          type="button"
          onClick={play}
          disabled={loading}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            playing
              ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              : "border-primary text-primary hover:bg-primary/5",
          )}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : playing ? (
            <>
              <Square className="h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Play Preview
            </>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Sample Text Display */}
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground italic">
          &quot;{sampleText}&quot;
        </p>
      </div>

      {/* Voice Settings Summary */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          Speed:{" "}
          <span className="font-mono text-foreground">
            {speakingRate.toFixed(2)}x
          </span>
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SAMPLE TEXT SELECTOR
// ============================================================================

interface SampleTextSelectorProps {
  value: string;
  onChange: (text: string) => void;
}

export function SampleTextSelector({
  value,
  onChange,
}: SampleTextSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(SAMPLE_TEXTS).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              onChange(text);
              setIsCustom(false);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs transition-colors",
              value === text && !isCustom
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsCustom(true)}
          className={cn(
            "rounded-full px-3 py-1 text-xs transition-colors",
            isCustom
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom text to preview..."
          className="h-20 w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      )}
    </div>
  );
}

export default VoicePreview;
