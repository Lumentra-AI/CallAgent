// Lumentra Core - Type Definitions
// High-Performance Operations Platform Schema

export type Industry = "hotel" | "medical" | "service";

export interface AppConfig {
  industry: Industry;
  businessName: string;
  accentColor: "emerald" | "cyan" | "violet";
  voiceSettings: VoiceSettings;
  pricing: PricingConfig;
}

export interface VoiceSettings {
  language: string;
  voiceId: string;
  speakingRate: number;
  silenceTimeout: number;
}

export interface PricingConfig {
  baseRate: number;
  currency: string;
  taxRate: number;
  additionalFees: AdditionalFee[];
}

export interface AdditionalFee {
  label: string;
  amount: number;
  type: "fixed" | "percentage";
}

export interface Metric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  status?: "nominal" | "warning" | "critical";
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "INFO" | "WARN" | "ERR" | "SYS" | "CALL";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface CallSession {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: "active" | "completed" | "failed";
  revenue?: number;
  transcript?: TranscriptEntry[];
}

export interface TranscriptEntry {
  speaker: "user" | "ai";
  text: string;
  timestamp: string;
}

export interface SystemStatus {
  online: boolean;
  latency: number;
  uptime: number;
  activeCalls: number;
  version: string;
}

export type SpeakerState = "idle" | "user" | "ai" | "processing";

export interface WaveformConfig {
  color: string;
  amplitude: number;
  frequency: number;
  enabled: boolean;
}
