"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useConfig } from "@/context/ConfigContext";
import { INDUSTRY_PRESETS, createDefaultConfig } from "@/lib/industryPresets";
import {
  SetupProvider,
  useSetup,
  CONVERSATION_SCRIPTS,
  type QuickAction,
} from "./SetupContext";
import { AIGuide } from "./AIGuide";
import { SetupMessage } from "./SetupMessage";
import { SetupCanvas } from "./SetupCanvas";
import type { IndustryType } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SetupConversationInner() {
  const router = useRouter();
  const { saveConfig } = useConfig();
  const {
    state,
    addAIMessage,
    addUserMessage,
    setPhase,
    setCanvas,
    setTyping,
    setSpeaking,
    selectIndustry,
    setBusinessName,
    setAgentName,
    setComplete,
  } = useSetup();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Start the conversation
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    // Initial welcome message
    setTimeout(() => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setSpeaking(true);
        addAIMessage(
          CONVERSATION_SCRIPTS.welcome.message,
          CONVERSATION_SCRIPTS.welcome.actions,
        );
        setTimeout(() => setSpeaking(false), 2000);
      }, 1000);
    }, 500);
  }, [addAIMessage, setTyping, setSpeaking]);

  // Advance to summary phase - must be declared before handleAction
  const advanceToSummary = useCallback(
    (agentNameParam: string) => {
      setCanvas(null);
      setPhase("summary");
      setTyping(true);

      setTimeout(() => {
        setTyping(false);
        setSpeaking(true);
        addAIMessage(
          CONVERSATION_SCRIPTS.summary.getMessage(state.businessName),
        );
        setCanvas(CONVERSATION_SCRIPTS.summary.canvas);

        // After showing summary, move to launch
        setTimeout(() => {
          setSpeaking(false);
          setPhase("launch");
          setTyping(true);

          setTimeout(() => {
            setTyping(false);
            setSpeaking(true);
            addAIMessage(
              CONVERSATION_SCRIPTS.launch.message,
              CONVERSATION_SCRIPTS.launch.actions,
            );
            setTimeout(() => setSpeaking(false), 2000);
          }, 1500);
        }, 3000);
      }, 800);
    },
    [
      state.businessName,
      setCanvas,
      setPhase,
      setTyping,
      setSpeaking,
      addAIMessage,
    ],
  );

  // Handle final launch - must be declared before handleAction
  const handleLaunch = useCallback(
    (redirectPath = "/dashboard") => {
      if (!state.selectedIndustry || !state.businessName) return;

      setComplete(true);
      const config = createDefaultConfig(state.selectedIndustry);

      saveConfig({
        ...config,
        industry: state.selectedIndustry,
        businessName: state.businessName,
        agentName: state.agentName || "Lumentra",
        isConfigured: true,
      });

      setTimeout(() => {
        router.push(redirectPath);
      }, 500);
    },
    [
      state.selectedIndustry,
      state.businessName,
      state.agentName,
      setComplete,
      saveConfig,
      router,
    ],
  );

  // Handle action clicks from AI messages
  const handleAction = useCallback(
    (action: QuickAction) => {
      addUserMessage(action.label);

      switch (state.currentPhase) {
        case "welcome":
          if (action.value === "skip") {
            router.push("/setup/manual");
            return;
          }
          // Move to industry selection
          setPhase("industry");
          setTyping(true);
          setTimeout(() => {
            setTyping(false);
            setSpeaking(true);
            addAIMessage(CONVERSATION_SCRIPTS.industry.message);
            setCanvas(CONVERSATION_SCRIPTS.industry.canvas);
            setTimeout(() => setSpeaking(false), 2000);
          }, 800);
          break;

        case "agent_name":
          if (action.value === "default") {
            setAgentName("Lumentra");
            advanceToSummary("Lumentra");
          }
          // "custom" is handled by the input
          break;

        case "launch":
          if (action.value === "dashboard") {
            handleLaunch();
          } else if (action.value === "settings") {
            handleLaunch("/dashboard?view=settings");
          }
          break;
      }
    },
    [
      state.currentPhase,
      addUserMessage,
      setPhase,
      setTyping,
      setSpeaking,
      addAIMessage,
      setCanvas,
      setAgentName,
      router,
      advanceToSummary,
      handleLaunch,
    ],
  );

  // Handle industry selection
  const handleIndustrySelect = useCallback(
    (industry: IndustryType) => {
      selectIndustry(industry);
      const preset = INDUSTRY_PRESETS[industry];
      addUserMessage(`I run a ${preset.label.toLowerCase()}`);

      setCanvas(null);
      setPhase("business_name");
      setTyping(true);

      setTimeout(() => {
        setTyping(false);
        setSpeaking(true);
        addAIMessage(
          CONVERSATION_SCRIPTS.business_name.getMessage(preset.label),
        );
        setCanvas(CONVERSATION_SCRIPTS.business_name.canvas);
        setTimeout(() => setSpeaking(false), 2000);
      }, 800);
    },
    [
      selectIndustry,
      addUserMessage,
      setCanvas,
      setPhase,
      setTyping,
      setSpeaking,
      addAIMessage,
    ],
  );

  // Handle business name submission
  const handleBusinessNameSubmit = useCallback(
    (name: string) => {
      setBusinessName(name);
      addUserMessage(name);

      setCanvas(null);
      setPhase("agent_name");
      setTyping(true);

      setTimeout(() => {
        setTyping(false);
        setSpeaking(true);
        addAIMessage(
          CONVERSATION_SCRIPTS.agent_name.getMessage(name),
          CONVERSATION_SCRIPTS.agent_name.actions,
        );
        setCanvas(CONVERSATION_SCRIPTS.agent_name.canvas);
        setTimeout(() => setSpeaking(false), 2000);
      }, 800);
    },
    [
      setBusinessName,
      addUserMessage,
      setCanvas,
      setPhase,
      setTyping,
      setSpeaking,
      addAIMessage,
    ],
  );

  // Handle agent name submission
  const handleAgentNameSubmit = useCallback(
    (name: string) => {
      const agentNameValue = name || "Lumentra";
      setAgentName(agentNameValue);
      addUserMessage(name ? `Call it "${name}"` : "Keep as Lumentra");
      advanceToSummary(agentNameValue);
    },
    [setAgentName, addUserMessage, advanceToSummary],
  );

  // Get AI guide state
  const getGuideState = () => {
    if (state.isSpeaking) return "speaking";
    if (state.isTyping) return "thinking";
    return "idle";
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-background">
      {/* Conversation Panel */}
      <div className="flex-1 flex flex-col p-6 lg:p-12 max-w-2xl mx-auto lg:mx-0">
        {/* AI Guide */}
        <div className="flex justify-center mb-8">
          <AIGuide state={getGuideState()} size="lg" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin">
          {state.messages.map((message, index) => (
            <SetupMessage
              key={message.id}
              message={message}
              isLatest={index === state.messages.length - 1}
              onActionClick={handleAction}
            />
          ))}

          {/* Typing indicator */}
          {state.isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-muted/50 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-muted-foreground/50"
                      animate={{ y: [0, -5, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Canvas Panel */}
      <div
        className={cn(
          "flex-1 bg-muted/20 border-l border-border",
          "flex items-center justify-center p-6 lg:p-12",
          !state.canvasElement && "hidden lg:flex",
        )}
      >
        <SetupCanvas
          element={state.canvasElement}
          onIndustrySelect={handleIndustrySelect}
          onBusinessNameSubmit={handleBusinessNameSubmit}
          onAgentNameSubmit={handleAgentNameSubmit}
          industry={state.selectedIndustry}
          businessName={state.businessName}
          agentName={state.agentName}
        />
      </div>

      {/* Skip Option */}
      {state.showSkipOption && state.currentPhase !== "launch" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/setup/manual")}
          className="fixed bottom-6 right-6 text-muted-foreground hover:text-foreground"
        >
          Skip to manual setup
        </Button>
      )}
    </div>
  );
}

export function SetupConversation() {
  return (
    <SetupProvider>
      <SetupConversationInner />
    </SetupProvider>
  );
}
