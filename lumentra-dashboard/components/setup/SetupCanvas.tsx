"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SetupIndustryPicker } from "./SetupIndustryPicker";
import { SetupInput } from "./SetupInput";
import { SetupSummary } from "./SetupSummary";
import type { CanvasElementType } from "./SetupContext";
import type { IndustryType } from "@/types";
import { cn } from "@/lib/utils";

interface SetupCanvasProps {
  element: CanvasElementType;
  onIndustrySelect: (industry: IndustryType) => void;
  onBusinessNameSubmit: (name: string) => void;
  onAgentNameSubmit: (name: string) => void;
  industry: IndustryType | null;
  businessName: string;
  agentName: string;
  className?: string;
}

const canvasVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: { duration: 0.2 },
  },
};

export function SetupCanvas({
  element,
  onIndustrySelect,
  onBusinessNameSubmit,
  onAgentNameSubmit,
  industry,
  businessName,
  agentName,
  className,
}: SetupCanvasProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center min-h-[400px] p-4",
        className,
      )}
    >
      <AnimatePresence mode="wait">
        {element === "industry_picker" && (
          <motion.div
            key="industry"
            variants={canvasVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <SetupIndustryPicker onSelect={onIndustrySelect} />
          </motion.div>
        )}

        {element === "business_input" && (
          <motion.div
            key="business"
            variants={canvasVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <SetupInput
              label="Business Name"
              placeholder="e.g. Grand Plaza Hotel"
              onSubmit={onBusinessNameSubmit}
              autoFocus
            />
          </motion.div>
        )}

        {element === "agent_input" && (
          <motion.div
            key="agent"
            variants={canvasVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <SetupInput
              label="AI Agent Name"
              placeholder="e.g. Jessica, Alex, Sam"
              onSubmit={onAgentNameSubmit}
              optional
              defaultValue=""
            />
          </motion.div>
        )}

        {element === "summary_view" && (
          <motion.div
            key="summary"
            variants={canvasVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <SetupSummary
              industry={industry}
              businessName={businessName}
              agentName={agentName}
            />
          </motion.div>
        )}

        {!element && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-muted-foreground"
          >
            <p className="text-sm">Your setup will appear here</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
