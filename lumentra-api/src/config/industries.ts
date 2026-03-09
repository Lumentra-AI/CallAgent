// Canonical industry definitions - single source of truth
// All other files should import from here

export const SUPPORTED_INDUSTRIES = [
  "hotel",
  "motel",
  "restaurant",
  "medical",
  "dental",
  "salon",
  "auto_service",
] as const;

export type IndustryType = (typeof SUPPORTED_INDUSTRIES)[number];

export function isValidIndustry(value: string): value is IndustryType {
  return (SUPPORTED_INDUSTRIES as readonly string[]).includes(value);
}
