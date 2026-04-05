"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import type {
  IndustryType,
  SetupStep,
  TenantIntegration,
  EscalationContact,
  TenantPromotion,
  TransferBehavior,
  PhoneSetupType,
  PortRequest,
} from "@/types";
import { get, put, post } from "@/lib/api/client";

// Default Cartesia voice (Sarah)
const DEFAULT_CARTESIA_VOICE = "694f9389-aac1-45b6-b726-9d9369183238";

// Legacy friendly-ID -> Cartesia UUID mapping for tenants saved before UUIDs were used
const LEGACY_VOICE_MAP: Record<string, string> = {
  sarah: "694f9389-aac1-45b6-b726-9d9369183238",
  support_lady: "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30",
  professional_woman: "248be419-c632-4f23-adf1-5324ed7dbf1d",
  support_man: "a167e0f3-df7e-4d52-a9c3-f949145efdab",
  barbershop_man: "a0e99841-438c-4a64-b679-ae501e7d6091",
  calm_lady: "00a77add-48d5-4ef6-8157-71e5437b282d",
  female_professional: "248be419-c632-4f23-adf1-5324ed7dbf1d",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve any voice identifier to a valid Cartesia UUID.
 * Handles: already-valid UUID, legacy friendly ID, missing/invalid value.
 */
function resolveCartesiaVoiceId(raw: string | undefined | null): string {
  if (!raw) return DEFAULT_CARTESIA_VOICE;
  if (UUID_RE.test(raw)) return raw;
  return LEGACY_VOICE_MAP[raw] ?? DEFAULT_CARTESIA_VOICE;
}

// ============================================================================
// TYPES
// ============================================================================

export const SETUP_STEPS: SetupStep[] = ["business"];

export const STEP_LABELS: Record<SetupStep, string> = {
  business: "Your Business",
  capabilities: "Features",
  details: "Details",
  integrations: "Scheduling",
  assistant: "Call Handling",
  phone: "Phone",
  hours: "Hours",
  escalation: "Contacts",
  review: "Review",
};

export interface SetupState {
  currentStep: SetupStep;
  completedSteps: SetupStep[];

  // Step data
  businessData: {
    name: string;
    industry: IndustryType | null;
    city: string;
    address: string;
  };
  capabilities: string[];
  capabilityDetails: Record<string, Record<string, unknown>>;
  integrationMode: "builtin" | "external" | "assisted" | null;
  integrations: TenantIntegration[];
  assistantData: {
    name: string;
    voice: string;
    personality: "professional" | "friendly" | "efficient";
    greeting: string;
  };
  phoneData: {
    setupType: PhoneSetupType | null;
    number: string;
    areaCode: string;
    portRequest: Partial<PortRequest> | null;
    /** True only when the number exists in phone_configurations (loaded from API or just provisioned) */
    provisioned: boolean;
  };
  hoursData: {
    timezone: string;
    sameEveryDay: boolean;
    schedule: Record<string, { status: string; open: string; close: string }>;
    afterHoursBehavior: string;
  };
  escalationData: {
    contacts: EscalationContact[];
    triggers: string[];
    customTriggers: string[];
    transferBehavior: TransferBehavior;
  };
  promotions: TenantPromotion[];

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  tenantId: string | null;
}

type SetupAction =
  | { type: "SET_STEP"; payload: SetupStep }
  | { type: "COMPLETE_STEP"; payload: SetupStep }
  | { type: "SET_BUSINESS_DATA"; payload: Partial<SetupState["businessData"]> }
  | { type: "SET_CAPABILITIES"; payload: string[] }
  | {
      type: "SET_CAPABILITY_DETAILS";
      payload: { capability: string; details: Record<string, unknown> };
    }
  | { type: "SET_INTEGRATION_MODE"; payload: SetupState["integrationMode"] }
  | { type: "SET_INTEGRATIONS"; payload: TenantIntegration[] }
  | {
      type: "SET_ASSISTANT_DATA";
      payload: Partial<SetupState["assistantData"]>;
    }
  | { type: "SET_PHONE_DATA"; payload: Partial<SetupState["phoneData"]> }
  | { type: "SET_HOURS_DATA"; payload: Partial<SetupState["hoursData"]> }
  | {
      type: "SET_ESCALATION_DATA";
      payload: Partial<SetupState["escalationData"]>;
    }
  | { type: "SET_PROMOTIONS"; payload: TenantPromotion[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "LOAD_PROGRESS"; payload: Partial<SetupState> }
  | { type: "SET_TENANT_ID"; payload: string }
  | { type: "RESET" };

// ============================================================================
// INITIAL STATE
// ============================================================================

const DEFAULT_SCHEDULE: Record<
  string,
  { status: string; open: string; close: string }
> = {
  monday: { status: "open", open: "09:00", close: "17:00" },
  tuesday: { status: "open", open: "09:00", close: "17:00" },
  wednesday: { status: "open", open: "09:00", close: "17:00" },
  thursday: { status: "open", open: "09:00", close: "17:00" },
  friday: { status: "open", open: "09:00", close: "17:00" },
  saturday: { status: "closed", open: "", close: "" },
  sunday: { status: "closed", open: "", close: "" },
};

const DEFAULT_TRIGGERS = [
  "caller_asks_for_person",
  "caller_frustrated",
  "caller_emergency",
  "caller_complaint",
  "caller_unknown_question",
  "payment_billing",
];

const initialState: SetupState = {
  currentStep: "business",
  completedSteps: [],

  businessData: {
    name: "",
    industry: null,
    city: "",
    address: "",
  },
  capabilities: [],
  capabilityDetails: {},
  integrationMode: null,
  integrations: [],
  assistantData: {
    name: "",
    voice: "694f9389-aac1-45b6-b726-9d9369183238",
    personality: "professional",
    greeting: "",
  },
  phoneData: {
    setupType: null,
    number: "",
    areaCode: "",
    portRequest: null,
    provisioned: false,
  },
  hoursData: {
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago",
    sameEveryDay: false,
    schedule: DEFAULT_SCHEDULE,
    afterHoursBehavior: "answer_closed",
  },
  escalationData: {
    contacts: [],
    triggers: DEFAULT_TRIGGERS,
    customTriggers: [],
    transferBehavior: { type: "warm", no_answer: "next_contact" },
  },
  promotions: [],

  isLoading: true,
  isSaving: false,
  error: null,
  tenantId: null,
};

// ============================================================================
// REDUCER
// ============================================================================

function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case "SET_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };
    case "COMPLETE_STEP":
      return {
        ...state,
        completedSteps: state.completedSteps.includes(action.payload)
          ? state.completedSteps
          : [...state.completedSteps, action.payload],
      };
    case "SET_BUSINESS_DATA":
      return {
        ...state,
        businessData: { ...state.businessData, ...action.payload },
      };
    case "SET_CAPABILITIES":
      return {
        ...state,
        capabilities: action.payload,
      };
    case "SET_CAPABILITY_DETAILS":
      return {
        ...state,
        capabilityDetails: {
          ...state.capabilityDetails,
          [action.payload.capability]: action.payload.details,
        },
      };
    case "SET_INTEGRATION_MODE":
      return {
        ...state,
        integrationMode: action.payload,
      };
    case "SET_INTEGRATIONS":
      return {
        ...state,
        integrations: action.payload,
      };
    case "SET_ASSISTANT_DATA":
      return {
        ...state,
        assistantData: { ...state.assistantData, ...action.payload },
      };
    case "SET_PHONE_DATA":
      return {
        ...state,
        phoneData: { ...state.phoneData, ...action.payload },
      };
    case "SET_HOURS_DATA":
      return {
        ...state,
        hoursData: { ...state.hoursData, ...action.payload },
      };
    case "SET_ESCALATION_DATA":
      return {
        ...state,
        escalationData: { ...state.escalationData, ...action.payload },
      };
    case "SET_PROMOTIONS":
      return {
        ...state,
        promotions: action.payload,
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    case "SET_SAVING":
      return {
        ...state,
        isSaving: action.payload,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "LOAD_PROGRESS":
      return {
        ...state,
        ...action.payload,
        isLoading: false,
      };
    case "SET_TENANT_ID":
      return {
        ...state,
        tenantId: action.payload,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function getStepIndex(step: SetupStep): number {
  return SETUP_STEPS.indexOf(step);
}

function getNextStep(step: SetupStep): SetupStep | null {
  const idx = getStepIndex(step);
  if (idx === -1 || idx >= SETUP_STEPS.length - 1) return null;
  return SETUP_STEPS[idx + 1];
}

function getPreviousStep(step: SetupStep): SetupStep | null {
  const idx = getStepIndex(step);
  if (idx <= 0) return null;
  return SETUP_STEPS[idx - 1];
}

export function canAccessStep(
  step: SetupStep,
  completedSteps: SetupStep[],
): boolean {
  const idx = getStepIndex(step);
  if (idx === 0) return true;

  // Can access if previous step is completed
  const previousStep = SETUP_STEPS[idx - 1];
  return completedSteps.includes(previousStep);
}

export function isValidStep(step: string): step is SetupStep {
  return SETUP_STEPS.includes(step as SetupStep);
}

interface ApiProgressResponse {
  step: SetupStep;
  completed: boolean;
  tenantId?: string;
  data: {
    business_name?: string;
    industry?: IndustryType;
    location_city?: string;
    location_address?: string;
    capabilities?: Array<{
      capability: string;
      config: Record<string, unknown>;
      is_enabled: boolean;
    }>;
    integrations?: TenantIntegration[];
    assisted_mode?: boolean;
    agent_name?: string;
    agent_personality?: string;
    voice_config?: { voiceId?: string; voice_id?: string };
    greeting_standard?: string;
    phone_config?: {
      setup_type?: PhoneSetupType;
      phone_number?: string;
      status?: string;
    };
    timezone?: string;
    operating_hours?: {
      schedule?: Array<{
        day: number;
        enabled: boolean;
        openTime: string;
        closeTime: string;
      }>;
    };
    after_hours_behavior?: string;
    escalation_enabled?: boolean;
    escalation_triggers?: string[];
    escalation_contacts?: EscalationContact[];
    transfer_behavior?: TransferBehavior;
  };
}

function mapApiToState(data: ApiProgressResponse): Partial<SetupState> {
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  // Map operating hours from API format
  let schedule = DEFAULT_SCHEDULE;
  if (data.data.operating_hours?.schedule) {
    schedule = { ...DEFAULT_SCHEDULE };
    for (const daySchedule of data.data.operating_hours.schedule) {
      const dayName = dayNames[daySchedule.day];
      schedule[dayName] = {
        status: daySchedule.enabled ? "open" : "closed",
        open: daySchedule.openTime || "",
        close: daySchedule.closeTime || "",
      };
    }
  }

  const normalizedStep = isValidStep(data.step) ? data.step : "business";

  // Calculate completed steps based on current step
  const currentStepIndex = getStepIndex(normalizedStep);
  const completedSteps = SETUP_STEPS.slice(0, currentStepIndex);

  return {
    currentStep: normalizedStep,
    completedSteps,
    tenantId: data.tenantId || null,
    businessData: {
      name: data.data.business_name || "",
      industry: data.data.industry || null,
      city: data.data.location_city || "",
      address: data.data.location_address || "",
    },
    capabilities:
      data.data.capabilities
        ?.filter((c) => c.is_enabled)
        .map((c) => c.capability) || [],
    capabilityDetails:
      data.data.capabilities?.reduce(
        (acc, c) => {
          if (c.config && Object.keys(c.config).length > 0) {
            acc[c.capability] = c.config;
          }
          return acc;
        },
        {} as Record<string, Record<string, unknown>>,
      ) || {},
    integrationMode: data.data.assisted_mode ? "assisted" : null,
    integrations: data.data.integrations || [],
    assistantData: {
      name: data.data.agent_name || "",
      voice: resolveCartesiaVoiceId(
        data.data.voice_config?.voiceId ?? data.data.voice_config?.voice_id,
      ),
      personality: (() => {
        const raw = data.data.agent_personality;
        // DB stores JSONB {tone: "professional", ...} -- extract tone string
        if (raw && typeof raw === "object" && "tone" in raw) {
          const tone = (raw as Record<string, unknown>).tone;
          if (
            tone === "professional" ||
            tone === "friendly" ||
            tone === "efficient"
          )
            return tone;
        }
        if (
          typeof raw === "string" &&
          ["professional", "friendly", "efficient"].includes(raw)
        ) {
          return raw as "professional" | "friendly" | "efficient";
        }
        return "professional";
      })(),
      greeting: data.data.greeting_standard || "",
    },
    phoneData: {
      setupType: data.data.phone_config?.setup_type || null,
      number: data.data.phone_config?.phone_number || "",
      areaCode: "",
      portRequest: null,
      provisioned:
        !!data.data.phone_config?.phone_number &&
        ["active", "porting_with_temp", "pending"].includes(
          data.data.phone_config?.status || "",
        ),
    },
    hoursData: {
      timezone:
        data.data.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        "America/Chicago",
      sameEveryDay: false,
      schedule,
      afterHoursBehavior: data.data.after_hours_behavior || "answer_closed",
    },
    escalationData: {
      contacts: data.data.escalation_contacts || [],
      triggers: data.data.escalation_triggers || DEFAULT_TRIGGERS,
      customTriggers: [],
      transferBehavior: data.data.transfer_behavior || {
        type: "warm",
        no_answer: "next_contact",
      },
    },
  };
}

function getStepData(
  step: SetupStep,
  state: SetupState,
): Record<string, unknown> {
  switch (step) {
    case "business":
      return {
        business_name: state.businessData.name,
        industry: state.businessData.industry,
        location_city: state.businessData.city,
        location_address: state.businessData.address,
      };
    case "capabilities":
      return {
        capabilities: state.capabilities,
      };
    case "details":
      return {
        capability_details: state.capabilityDetails,
      };
    case "integrations":
      return {
        integration_mode: state.integrationMode,
      };
    case "assistant":
      return {
        agent_name: state.assistantData.name,
        agent_personality: state.assistantData.personality,
        voice_config: {
          voiceId: state.assistantData.voice,
          voice_id: state.assistantData.voice,
          provider: "cartesia",
        },
        greeting_standard: state.assistantData.greeting || null,
        // Include escalation data since it's now part of this step
        escalation_enabled: state.escalationData.contacts.length > 0,
        escalation_triggers: [
          ...state.escalationData.triggers,
          ...state.escalationData.customTriggers,
        ],
        contacts: state.escalationData.contacts,
        transfer_behavior: state.escalationData.transferBehavior,
      };
    case "phone":
      return {
        setup_type: state.phoneData.setupType,
        phone_number: state.phoneData.number,
      };
    case "hours": {
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const schedule = dayNames.map((day, idx) => ({
        day: idx,
        enabled: state.hoursData.schedule[day]?.status === "open",
        openTime: state.hoursData.schedule[day]?.open || "",
        closeTime: state.hoursData.schedule[day]?.close || "",
      }));
      return {
        timezone: state.hoursData.timezone,
        operating_hours: { timezone: state.hoursData.timezone, schedule },
        after_hours_behavior: state.hoursData.afterHoursBehavior,
      };
    }
    case "escalation":
      return {
        escalation_enabled: state.escalationData.contacts.length > 0,
        escalation_triggers: [
          ...state.escalationData.triggers,
          ...state.escalationData.customTriggers,
        ],
        contacts: state.escalationData.contacts,
        transfer_behavior: state.escalationData.transferBehavior,
      };
    case "review":
      return {};
    default:
      return {};
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface SetupContextType {
  state: SetupState;
  dispatch: React.Dispatch<SetupAction>;

  // API functions
  loadProgress: () => Promise<void>;
  saveStep: (step: SetupStep) => Promise<boolean>;
  completeSetup: () => Promise<boolean>;

  // Navigation
  goToStep: (step: SetupStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canProceed: () => boolean;
}

const SetupContext = createContext<SetupContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export function SetupProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(setupReducer, initialState);

  const loadProgress = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const data = await get<ApiProgressResponse>("/api/setup/progress");
      dispatch({ type: "LOAD_PROGRESS", payload: mapApiToState(data) });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload: err instanceof Error ? err.message : "Failed to load progress",
      });
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const saveStep = useCallback(
    async (step: SetupStep): Promise<boolean> => {
      dispatch({ type: "SET_SAVING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      try {
        const data = getStepData(step, state);
        const response = await put<{ success: boolean; nextStep?: SetupStep }>(
          `/api/setup/step/${step}`,
          data,
        );
        if (response.success) {
          dispatch({ type: "COMPLETE_STEP", payload: step });
        }
        return response.success;
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          payload: err instanceof Error ? err.message : "Failed to save",
        });
        return false;
      } finally {
        dispatch({ type: "SET_SAVING", payload: false });
      }
    },
    [state],
  );

  const completeSetup = useCallback(async (): Promise<boolean> => {
    dispatch({ type: "SET_SAVING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const response = await post<{ success: boolean; tenantId: string }>(
        "/api/setup/complete",
      );
      return response.success;
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        payload:
          err instanceof Error ? err.message : "Failed to complete setup",
      });
      return false;
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  }, []);

  const goToStep = useCallback((step: SetupStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const goToNextStep = useCallback(() => {
    const nextStep = getNextStep(state.currentStep);
    if (nextStep) {
      dispatch({ type: "SET_STEP", payload: nextStep });
    }
  }, [state.currentStep]);

  const goToPreviousStep = useCallback(() => {
    const prevStep = getPreviousStep(state.currentStep);
    if (prevStep) {
      dispatch({ type: "SET_STEP", payload: prevStep });
    }
  }, [state.currentStep]);

  const canProceed = useCallback((): boolean => {
    switch (state.currentStep) {
      case "business":
        return (
          state.businessData.name.trim() !== "" &&
          state.businessData.industry !== null
        );
      default:
        return false;
    }
  }, [state]);

  // Load progress on mount
  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  return (
    <SetupContext.Provider
      value={{
        state,
        dispatch,
        loadProgress,
        saveStep,
        completeSetup,
        goToStep,
        goToNextStep,
        goToPreviousStep,
        canProceed,
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

// Export types for use in step components
export type { SetupAction };
