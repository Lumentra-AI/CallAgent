"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Check, ArrowLeft, User, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSetup } from "../SetupContext";

// Aceternity & MagicUI components
import {
  CardContainer,
  CardBody,
  CardItem,
} from "@/components/aceternity/3d-card";
import { WobbleCard } from "@/components/aceternity/wobble-card";
import { TextGenerateEffect } from "@/components/aceternity/text-generate-effect";
import { SpotlightNew } from "@/components/aceternity/spotlight";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { ShineBorder } from "@/components/magicui/shine-border";

type Personality = "professional" | "friendly" | "efficient";

interface VoiceOption {
  id: string;
  name: string;
  type: "female" | "male";
  tone: string;
  previewUrl: string;
}

const VOICES: VoiceOption[] = [
  {
    id: "female_professional",
    name: "Sarah",
    type: "female",
    tone: "Professional",
    previewUrl: "/audio/sarah.mp3",
  },
  {
    id: "female_friendly",
    name: "Emma",
    type: "female",
    tone: "Friendly",
    previewUrl: "/audio/emma.mp3",
  },
  {
    id: "female_warm",
    name: "Maya",
    type: "female",
    tone: "Warm",
    previewUrl: "/audio/maya.mp3",
  },
  {
    id: "male_professional",
    name: "James",
    type: "male",
    tone: "Professional",
    previewUrl: "/audio/james.mp3",
  },
  {
    id: "male_friendly",
    name: "Alex",
    type: "male",
    tone: "Friendly",
    previewUrl: "/audio/alex.mp3",
  },
  {
    id: "male_calm",
    name: "David",
    type: "male",
    tone: "Calm",
    previewUrl: "/audio/david.mp3",
  },
];

const PERSONALITIES: {
  id: Personality;
  label: string;
  description: string;
  example: string;
  color: string;
}[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Formal and business-like",
    example:
      '"Good afternoon, thank you for calling {business}. This is {name}, how may I assist you today?"',
    color: "bg-slate-800",
  },
  {
    id: "friendly",
    label: "Friendly",
    description: "Warm and conversational",
    example:
      '"Hey there! Thanks for calling {business}. I\'m {name} - what can I help you with?"',
    color: "bg-amber-800",
  },
  {
    id: "efficient",
    label: "Efficient",
    description: "Direct and to the point",
    example: '"{business}, this is {name}. How can I help?"',
    color: "bg-emerald-800",
  },
];

const NAME_SUGGESTIONS: Record<string, string[]> = {
  professional: ["Sarah", "James", "Emily", "Michael"],
  friendly: ["Emma", "Alex", "Sophie", "Ben"],
  efficient: ["Kate", "Sam", "Anna", "Max"],
};

export function AssistantStep() {
  const router = useRouter();
  const { state, dispatch, saveStep, goToNextStep, goToPreviousStep } =
    useSetup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { name, voice, personality } = state.assistantData;
  const businessName = state.businessData.name || "your business";

  const canContinue =
    name.trim() !== "" && voice !== "" && personality !== null;

  const playPreview = (voiceOption: VoiceOption) => {
    if (audioRef.current) {
      if (playingVoice === voiceOption.id) {
        audioRef.current.pause();
        setPlayingVoice(null);
      } else {
        audioRef.current.src = voiceOption.previewUrl;
        audioRef.current
          .play()
          .then(() => {
            setPlayingVoice(voiceOption.id);
          })
          .catch(() => {
            setPlayingVoice(null);
          });
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingVoice(null);
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    setIsSubmitting(true);
    const success = await saveStep("assistant");
    if (success) {
      goToNextStep();
      router.push("/setup/phone");
    }
    setIsSubmitting(false);
  };

  const handleBack = () => {
    goToPreviousStep();
    router.push("/setup/integrations");
  };

  const getGreetingExample = (p: (typeof PERSONALITIES)[0]) => {
    return p.example
      .replace("{business}", businessName)
      .replace("{name}", name || "{name}");
  };

  return (
    <div className="relative space-y-8">
      <SpotlightNew className="opacity-20" />

      {/* Header */}
      <div className="relative z-10">
        <TextGenerateEffect
          words="Give your assistant an identity"
          className="text-2xl md:text-3xl text-foreground"
          duration={0.3}
        />
        <p className="mt-2 text-muted-foreground">
          This is how callers will experience your business
        </p>
      </div>

      {/* Audio element for voice preview */}
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Assistant name with shine border */}
      <div className="relative z-10 space-y-3">
        <Label htmlFor="assistant-name">Assistant name</Label>
        <ShineBorder
          borderRadius={8}
          borderWidth={1}
          duration={10}
          color={name ? "#6366f1" : "#64748b"}
          className="w-full min-w-full bg-background p-0"
        >
          <Input
            id="assistant-name"
            placeholder="Sarah"
            value={name}
            onChange={(e) =>
              dispatch({
                type: "SET_ASSISTANT_DATA",
                payload: { name: e.target.value },
              })
            }
            className="border-0 bg-transparent focus-visible:ring-0"
          />
        </ShineBorder>
        {personality && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Suggestions:</span>
            {NAME_SUGGESTIONS[personality].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "SET_ASSISTANT_DATA",
                    payload: { name: suggestion },
                  })
                }
                className="rounded-full bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Voice selection with 3D cards */}
      <div className="relative z-10 space-y-4">
        <Label className="flex items-center gap-2">
          <Volume2 className="h-4 w-4" />
          Voice
        </Label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VOICES.map((voiceOption) => {
            const isSelected = voice === voiceOption.id;
            const isPlaying = playingVoice === voiceOption.id;

            return (
              <CardContainer
                key={voiceOption.id}
                containerClassName="py-4"
                className="inter-var"
              >
                <CardBody
                  className={cn(
                    "relative h-auto w-full rounded-xl border p-4 transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                      : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_ASSISTANT_DATA",
                        payload: { voice: voiceOption.id },
                      })
                    }
                    className="flex h-full w-full flex-col items-center text-center"
                  >
                    <CardItem translateZ={30} className="w-full">
                      {isSelected && (
                        <div className="absolute right-2 top-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                      <div
                        className={cn(
                          "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                          voiceOption.type === "female"
                            ? "bg-gradient-to-br from-pink-400 to-rose-600"
                            : "bg-gradient-to-br from-blue-400 to-indigo-600",
                        )}
                      >
                        <User className="h-8 w-8 text-white" />
                      </div>
                    </CardItem>
                    <CardItem translateZ={20} className="mt-4">
                      <p className="text-lg font-semibold">
                        {voiceOption.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {voiceOption.tone}
                      </p>
                    </CardItem>
                    <CardItem translateZ={40} className="mt-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playPreview(voiceOption);
                        }}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full transition-all",
                          isPlaying
                            ? "bg-primary text-primary-foreground scale-110"
                            : "bg-muted hover:bg-primary/20 hover:scale-105",
                        )}
                      >
                        {isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </button>
                    </CardItem>
                  </button>
                </CardBody>
              </CardContainer>
            );
          })}
        </div>
      </div>

      {/* Personality selection with wobble cards */}
      <div className="relative z-10 space-y-4">
        <Label>Personality</Label>
        <div className="grid gap-4 md:grid-cols-3">
          {PERSONALITIES.map((p) => {
            const isSelected = personality === p.id;

            return (
              <div key={p.id} className="relative">
                {isSelected && (
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-primary/50 to-primary opacity-75 blur-sm" />
                )}
                <WobbleCard
                  containerClassName={cn(
                    "min-h-[180px] cursor-pointer relative",
                    isSelected ? "bg-primary" : p.color,
                  )}
                  className="p-4"
                >
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_ASSISTANT_DATA",
                        payload: { personality: p.id },
                      })
                    }
                    className="flex h-full w-full flex-col text-left"
                  >
                    {isSelected && (
                      <div className="absolute right-3 top-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    )}
                    <h3 className="text-xl font-bold text-white">{p.label}</h3>
                    <p className="mt-1 text-sm text-white/70">
                      {p.description}
                    </p>
                    <div className="mt-4 rounded-lg bg-white/10 p-3">
                      <p className="text-sm italic text-white/90">
                        {getGreetingExample(p)}
                      </p>
                    </div>
                  </button>
                </WobbleCard>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="relative z-10 flex justify-between pt-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <ShimmerButton
          onClick={handleContinue}
          disabled={!canContinue || isSubmitting}
          shimmerColor="#ffffff"
          shimmerSize="0.05em"
          borderRadius="8px"
          background={canContinue ? "hsl(var(--primary))" : "hsl(var(--muted))"}
          className={cn(
            "px-8 py-3 text-sm font-medium",
            !canContinue && "cursor-not-allowed opacity-50",
          )}
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </ShimmerButton>
      </div>
    </div>
  );
}
