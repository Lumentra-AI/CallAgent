"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationMessage, QuickAction } from "./SetupContext";

interface SetupMessageProps {
  message: ConversationMessage;
  onActionClick?: (action: QuickAction) => void;
  isLatest?: boolean;
}

function TypewriterText({
  text,
  speed = 25,
  onComplete,
}: {
  text: string;
  speed?: number;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
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
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

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
  const [showActions, setShowActions] = useState(false);
  const isAI = message.type === "ai";

  useEffect(() => {
    if (isLatest && isAI && message.actions) {
      // Show actions after typewriter completes
      const timer = setTimeout(
        () => setShowActions(true),
        message.content.length * 25 + 500,
      );
      return () => clearTimeout(timer);
    }
  }, [isLatest, isAI, message.actions, message.content.length]);

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
          {isLatest && isAI ? (
            <TypewriterText
              text={message.content}
              onComplete={() => setShowActions(true)}
            />
          ) : (
            message.content
          )}
        </p>

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
