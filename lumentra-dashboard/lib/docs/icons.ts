import {
  Shield,
  Phone,
  Users,
  Server,
  Code,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Shield,
  Phone,
  Users,
  Server,
  Code,
  AlertTriangle,
  FileText,
};

export function getIcon(name: string): LucideIcon {
  return iconMap[name] || FileText;
}
