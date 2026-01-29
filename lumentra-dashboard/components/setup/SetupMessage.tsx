"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationMessage, QuickAction } from "./SetupContext";

interface SetupMessageProps {
  message: ConversationMessage;
  onActionClick?: (action: QuickAction) => void;
  isLatest?: boolean;
}

// Track which messages have been animated to prevent re-animation
const animatedMessages = new Set<string>();
// Track which messages have been spoken
const spokenMessages = new Set<string>();

function TypewriterText({
  text,
  messageId,
  speed = 25,
  onComplete,
}: {
  text: string;
  messageId: string;
  speed?: number;
  onComplete?: () => void;
}) {
  // Check if this message was already animated
  const wasAnimated = animatedMessages.has(messageId);
  const [displayedText, setDisplayedText] = useState(wasAnimated ? text : "");
  const [isComplete, setIsComplete] = useState(wasAnimated);

  useEffect(() => {
    // Skip animation if already completed
    if (wasAnimated) {
      onComplete?.();
      return;
    }

    let index = 0;
    setDisplayedText("");
    setIsComplete(false);

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        animatedMessages.add(messageId);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [messageId, text, speed, onComplete, wasAnimated]);

  return (
    <span>
      {displayedText}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-0.5 h-4 bg-current ml-0.5 align-middle"
        />
      )}
    </span>
  );
}

export function SetupMessage({
  message,
  onActionClick,
  isLatest = false,
}: SetupMessageProps) {
  const isAI = message.type === "ai";
  // Initialize showActions to true if message was already animated
  const wasAlreadyAnimated = animatedMessages.has(message.id);
  const [showActions, setShowActions] = useState(
    wasAlreadyAnimated && isAI && !!message.actions,
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasSpokenRef = useRef(spokenMessages.has(message.id));

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (utteranceRef.current && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Get best English voice
  const getEnglishVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    // Prioritize en-US voices, specifically looking for natural-sounding ones
    return (
      voices.find((v) => v.lang === "en-US" && v.name.includes("Google")) ||
      voices.find((v) => v.lang === "en-US" && v.name.includes("Natural")) ||
      voices.find((v) => v.lang === "en-US" && !v.name.includes("espeak")) ||
      voices.find((v) => v.lang === "en-GB") ||
      voices.find((v) => v.lang.startsWith("en-"))
    );
  }, []);

  // Speak the message using Web Speech API
  const speakMessage = useCallback(() => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message.content);
    utteranceRef.current = utterance;

    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Set voice if available
    const voice = getEnglishVoice();
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      spokenMessages.add(message.id);
      hasSpokenRef.current = true;
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [message.content, message.id, getEnglishVoice]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  // Handle typewriter completion - speak once and show actions
  const handleTypewriterComplete = useCallback(() => {
    setShowActions(true);

    // Auto-speak only if this message hasn't been spoken yet
    if (isAI && !hasSpokenRef.current && isLatest) {
      // Small delay to let the UI settle
      setTimeout(() => {
        speakMessage();
      }, 300);
    }
  }, [isAI, isLatest, speakMessage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex", isAI ? "justify-start" : "justify-end")}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isAI
            ? "bg-muted/50 text-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <p className="text-sm leading-relaxed">
          {isLatest && isAI && !animatedMessages.has(message.id) ? (
            <TypewriterText
              text={message.content}
              messageId={message.id}
              onComplete={handleTypewriterComplete}
            />
          ) : (
            message.content
          )}
        </p>

        {/* Voice replay button for AI messages */}
        {isAI && showActions && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={isSpeaking ? stopSpeaking : speakMessage}
              className={cn(
                "flex items-center gap-1 text-xs transition-colors",
                isSpeaking
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={isSpeaking ? "Stop" : "Listen again"}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-3.5 w-3.5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Listen</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Quick Actions */}
        {isAI && message.actions && showActions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 flex flex-wrap gap-2"
          >
            {message.actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.primary ? "default" : "outline"}
                onClick={() => onActionClick?.(action)}
                className="text-xs"
              >
                {action.label}
              </Button>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
