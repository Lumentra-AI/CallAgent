"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type {
  AppConfig,
  Metric,
  LogEntry,
  Industry,
  SystemStatus,
} from "@/types";

// SOW-Aligned Default Configurations
const DEFAULT_CONFIGS: Record<Industry, AppConfig> = {
  hotel: {
    industry: "hotel",
    businessName: "Grand Plaza Hotel",
    accentColor: "emerald",
    voiceSettings: {
      language: "en-US",
      voiceId: "nova",
      speakingRate: 1.0,
      silenceTimeout: 3000,
    },
    pricing: {
      baseRate: 139, // SOW: King Room rate
      currency: "USD",
      taxRate: 0.12,
      additionalFees: [
        { label: "Pet Fee", amount: 25, type: "fixed" }, // SOW: $25 pet fee
        { label: "Resort Fee", amount: 15, type: "fixed" },
      ],
    },
  },
  medical: {
    industry: "medical",
    businessName: "Martinez Medical Group",
    accentColor: "cyan",
    voiceSettings: {
      language: "en-US",
      voiceId: "nova",
      speakingRate: 0.95,
      silenceTimeout: 4000,
    },
    pricing: {
      baseRate: 150,
      currency: "USD",
      taxRate: 0,
      additionalFees: [{ label: "New Patient Fee", amount: 50, type: "fixed" }],
    },
  },
  service: {
    industry: "service",
    businessName: "CleanPro Services",
    accentColor: "violet",
    voiceSettings: {
      language: "en-US",
      voiceId: "nova",
      speakingRate: 1.0,
      silenceTimeout: 3000,
    },
    pricing: {
      baseRate: 120, // SOW: Regular maintenance cleaning
      currency: "USD",
      taxRate: 0.08,
      additionalFees: [
        { label: "Deep Clean Upgrade", amount: 60, type: "fixed" }, // SOW: $180 - $120 = $60 upgrade
      ],
    },
  },
};

// SOW-Aligned Metrics
export function getMetrics(industry: Industry): Metric[] {
  const baseMetrics: Metric[] = [
    {
      id: "latency",
      label: "LATENCY",
      value: 24,
      unit: "ms",
      status: "nominal",
    },
    {
      id: "uptime",
      label: "UPTIME",
      value: 99.9,
      unit: "%",
      status: "nominal",
    },
    { id: "active", label: "ACTIVE", value: 1, status: "nominal" },
  ];

  const industryMetrics: Record<Industry, Metric[]> = {
    hotel: [
      ...baseMetrics,
      {
        id: "bookings",
        label: "BOOKINGS/24H",
        value: 47,
        trend: "up",
        status: "nominal",
      }, // SOW: 47 reservations
      {
        id: "revenue",
        label: "REV/24H",
        value: "$6,533",
        trend: "up",
        status: "nominal",
      }, // SOW: $6,000+ revenue
      { id: "missed", label: "MISSED", value: 0, status: "nominal" },
      { id: "avgRate", label: "AVG RATE", value: "$139", status: "nominal" }, // SOW: King Room rate
    ],
    medical: [
      ...baseMetrics,
      {
        id: "appointments",
        label: "APPTS/24H",
        value: 23,
        trend: "up",
        status: "nominal",
      },
      { id: "scheduled", label: "SCHEDULED", value: 18, status: "nominal" },
      { id: "callback", label: "CALLBACKS", value: 5, status: "warning" },
    ],
    service: [
      ...baseMetrics,
      {
        id: "jobs",
        label: "JOBS/24H",
        value: 12,
        trend: "stable",
        status: "nominal",
      },
      { id: "revenue", label: "REV/24H", value: "$1,440", status: "nominal" },
      { id: "quotes", label: "QUOTES", value: 8, status: "nominal" },
    ],
  };

  return industryMetrics[industry];
}

// System Status
export function getSystemStatus(): SystemStatus {
  return {
    online: true,
    latency: 24,
    uptime: 99.9,
    activeCalls: 1,
    version: "v2.4.0",
  };
}

// Generate Technical Logs
export function generateSystemLogs(): LogEntry[] {
  const now = new Date();
  const formatTime = (offset: number) => {
    const d = new Date(now.getTime() - offset * 1000);
    return d.toTimeString().slice(0, 8);
  };

  return [
    {
      id: "1",
      timestamp: formatTime(0),
      type: "SYS",
      message: "WEBSOCKET_HEARTBEAT_ACK",
    },
    {
      id: "2",
      timestamp: formatTime(2),
      type: "CALL",
      message: "AUDIO_STREAM_INIT [codec=opus]",
    },
    {
      id: "3",
      timestamp: formatTime(5),
      type: "INFO",
      message: "VAD_TRIGGER threshold=0.42",
    },
    {
      id: "4",
      timestamp: formatTime(8),
      type: "INFO",
      message: "STT_RESULT confidence=0.97",
    },
    {
      id: "5",
      timestamp: formatTime(12),
      type: "SYS",
      message: "LLM_INFERENCE latency=124ms",
    },
    {
      id: "6",
      timestamp: formatTime(15),
      type: "INFO",
      message: "TTS_GENERATE chars=156",
    },
    {
      id: "7",
      timestamp: formatTime(18),
      type: "CALL",
      message: "AUDIO_CHUNK_TX seq=4872",
    },
    {
      id: "8",
      timestamp: formatTime(22),
      type: "SYS",
      message: "REDIS_CACHE_HIT key=rates_2024",
    },
    {
      id: "9",
      timestamp: formatTime(25),
      type: "INFO",
      message: "BOOKING_INTENT detected=true",
    },
    {
      id: "10",
      timestamp: formatTime(30),
      type: "WARN",
      message: "BUFFER_NEAR_FULL 87%",
    },
  ];
}

// Context Interface
interface ConfigContextType {
  config: AppConfig;
  systemStatus: SystemStatus;
  metrics: Metric[];
  logs: LogEntry[];
  updateConfig: <K extends keyof AppConfig>(
    key: K,
    value: AppConfig[K],
  ) => void;
  updateNestedConfig: <K extends keyof AppConfig>(
    key: K,
    nestedKey: string,
    value: unknown,
  ) => void;
  resetConfig: () => void;
  switchIndustry: (industry: Industry) => void;
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  isLoaded: boolean;
}

const ConfigContext = createContext<ConfigContextType | null>(null);

const STORAGE_KEY = "lumentra_config";

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIGS.hotel);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppConfig;
        setConfig(parsed);
      }
    } catch {
      console.warn("[CONFIG] Failed to load config, using defaults");
    }
    setLogs(generateSystemLogs());
    setIsLoaded(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {
        console.warn("[CONFIG] Failed to persist config");
      }
    }
  }, [config, isLoaded]);

  const updateConfig = useCallback(
    <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateNestedConfig = useCallback(
    <K extends keyof AppConfig>(key: K, nestedKey: string, value: unknown) => {
      setConfig((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] as Record<string, unknown>),
          [nestedKey]: value,
        },
      }));
    },
    [],
  );

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIGS.hotel);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const switchIndustry = useCallback((industry: Industry) => {
    setConfig(DEFAULT_CONFIGS[industry]);
  }, []);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toTimeString().slice(0, 8),
    };
    setLogs((prev) => [newEntry, ...prev].slice(0, 100));
  }, []);

  const value: ConfigContextType = {
    config,
    systemStatus: getSystemStatus(),
    metrics: getMetrics(config.industry),
    logs,
    updateConfig,
    updateNestedConfig,
    resetConfig,
    switchIndustry,
    addLog,
    isLoaded,
  };

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return context;
}

export { DEFAULT_CONFIGS };
