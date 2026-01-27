"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from "react";
import type { IndustryType } from "@/types";

// ============================================================================
// TYPES
// ============================================================================

export type SetupPhase =
  | "welcome"
  | "industry"
  | "business_name"
  | "agent_name"
  | "summary"
  | "launch";

export type CanvasElementType =
  | "industry_picker"
  | "business_input"
  | "agent_input"
  | "summary_view"
  | null;

export interface QuickAction {
  id: string;
  label: string;
  value: string;
  primary?: boolean;
}

export interface ConversationMessage {
  id: string;
  type: "ai" | "user";
  content: string;
  timestamp: Date;
  actions?: QuickAction[];
}

export interface SetupState {
  messages: ConversationMessage[];
  currentPhase: SetupPhase;
  canvasElement: CanvasElementType;
  isTyping: boolean;
  isSpeaking: boolean;
  selectedIndustry: IndustryType | null;
  businessName: string;
  agentName: string;
  showSkipOption: boolean;
  isComplete: boolean;
}

type SetupAction =
  | { type: "ADD_MESSAGE"; payload: ConversationMessage }
  | { type: "SET_PHASE"; payload: SetupPhase }
  | { type: "SET_CANVAS"; payload: CanvasElementType }
  | { type: "SET_TYPING"; payload: boolean }
  | { type: "SET_SPEAKING"; payload: boolean }
  | { type: "SELECT_INDUSTRY"; payload: IndustryType }
  | { type: "SET_BUSINESS_NAME"; payload: string }
  | { type: "SET_AGENT_NAME"; payload: string }
  | { type: "SET_COMPLETE"; payload: boolean }
  | { type: "RESET" };

// ============================================================================
// CONVERSATION SCRIPTS
// ============================================================================

export const CONVERSATION_SCRIPTS = {
  welcome: {
    message:
      "Hi there! I'm your Lumentra setup assistant. I'll help you configure your AI voice agent in just a few moments. Ready to get started?",
    actions: [
      { id: "start", label: "Let's do it!", value: "start", primary: true },
      { id: "skip", label: "Skip to manual setup", value: "skip" },
    ],
  },
  industry: {
    message:
      "What kind of business do you run? This helps me tailor your AI agent's vocabulary and behavior.",
    canvas: "industry_picker" as CanvasElementType,
  },
  business_name: {
    getMessage: (industryLabel: string) =>
      `${industryLabel} - excellent choice! Now, what's the name of your business?`,
    canvas: "business_input" as CanvasElementType,
  },
  agent_name: {
    getMessage: (businessName: string) =>
      `"${businessName}" - I like it! Would you like to give your AI agent a custom name, or should it introduce itself as "Lumentra"?`,
    canvas: "agent_input" as CanvasElementType,
    actions: [
      { id: "custom", label: "Give it a name", value: "custom", primary: true },
      { id: "default", label: "Keep as Lumentra", value: "default" },
    ],
  },
  summary: {
    getMessage: (businessName: string) =>
      `Perfect! Here's what I've set up for ${businessName}. Take a look and let me know if everything looks good.`,
    canvas: "summary_view" as CanvasElementType,
  },
  launch: {
    message:
      "You're all set! Your AI agent is configured and ready to handle calls. Want to head to your dashboard?",
    actions: [
      {
        id: "dashboard",
        label: "Go to Dashboard",
        value: "dashboard",
        primary: true,
      },
      { id: "settings", label: "Adjust Settings First", value: "settings" },
    ],
  },
};

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: SetupState = {
  messages: [],
  currentPhase: "welcome",
  canvasElement: null,
  isTyping: false,
  isSpeaking: false,
  selectedIndustry: null,
  businessName: "",
  agentName: "",
  showSkipOption: true,
  isComplete: false,
};

// ============================================================================
// REDUCER
// ============================================================================

function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case "SET_PHASE":
      return {
        ...state,
        currentPhase: action.payload,
      };
    case "SET_CANVAS":
      return {
        ...state,
        canvasElement: action.payload,
      };
    case "SET_TYPING":
      return {
        ...state,
        isTyping: action.payload,
      };
    case "SET_SPEAKING":
      return {
        ...state,
        isSpeaking: action.payload,
      };
    case "SELECT_INDUSTRY":
      return {
        ...state,
        selectedIndustry: action.payload,
      };
    case "SET_BUSINESS_NAME":
      return {
        ...state,
        businessName: action.payload,
      };
    case "SET_AGENT_NAME":
      return {
        ...state,
        agentName: action.payload,
      };
    case "SET_COMPLETE":
      return {
        ...state,
        isComplete: action.payload,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface SetupContextType {
  state: SetupState;
  addAIMessage: (content: string, actions?: QuickAction[]) => void;
  addUserMessage: (content: string) => void;
  setPhase: (phase: SetupPhase) => void;
  setCanvas: (element: CanvasElementType) => void;
  setTyping: (typing: boolean) => void;
  setSpeaking: (speaking: boolean) => void;
  selectIndustry: (industry: IndustryType) => void;
  setBusinessName: (name: string) => void;
  setAgentName: (name: string) => void;
  setComplete: (complete: boolean) => void;
  reset: () => void;
}

const SetupContext = createContext<SetupContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function SetupProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(setupReducer, initialState);

  const addAIMessage = useCallback(
    (content: string, actions?: QuickAction[]) => {
      const message: ConversationMessage = {
        id: crypto.randomUUID(),
        type: "ai",
        content,
        timestamp: new Date(),
        actions,
      };
      dispatch({ type: "ADD_MESSAGE", payload: message });
    },
    [],
  );

  const addUserMessage = useCallback((content: string) => {
    const message: ConversationMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content,
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: message });
  }, []);

  const setPhase = useCallback((phase: SetupPhase) => {
    dispatch({ type: "SET_PHASE", payload: phase });
  }, []);

  const setCanvas = useCallback((element: CanvasElementType) => {
    dispatch({ type: "SET_CANVAS", payload: element });
  }, []);

  const setTyping = useCallback((typing: boolean) => {
    dispatch({ type: "SET_TYPING", payload: typing });
  }, []);

  const setSpeaking = useCallback((speaking: boolean) => {
    dispatch({ type: "SET_SPEAKING", payload: speaking });
  }, []);

  const selectIndustry = useCallback((industry: IndustryType) => {
    dispatch({ type: "SELECT_INDUSTRY", payload: industry });
  }, []);

  const setBusinessName = useCallback((name: string) => {
    dispatch({ type: "SET_BUSINESS_NAME", payload: name });
  }, []);

  const setAgentName = useCallback((name: string) => {
    dispatch({ type: "SET_AGENT_NAME", payload: name });
  }, []);

  const setComplete = useCallback((complete: boolean) => {
    dispatch({ type: "SET_COMPLETE", payload: complete });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <SetupContext.Provider
      value={{
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
        reset,
      }}
    >
      {children}
    </SetupContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup must be used within a SetupProvider");
  }
  return context;
}
