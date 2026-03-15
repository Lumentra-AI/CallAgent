/**
 * Types for the chatbot settings page
 */

export interface KnowledgeBaseItem {
  id: string;
  tenant_id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type WidgetPosition = "bottom-right" | "bottom-left";

export type ContactCollectionMode = "soft" | "persistent";

export interface ChatAppearanceConfig {
  chat_widget_enabled: boolean;
  theme_color: string;
  logo_url: string;
  greeting: string;
  position: WidgetPosition;
}

export interface ChatBehaviorConfig {
  contact_collection_mode: ContactCollectionMode;
  escalation_triggers: string;
  offline_message: string;
  max_conversation_length: number;
}

export type ChatbotTab = "appearance" | "behavior" | "knowledge" | "embed";
