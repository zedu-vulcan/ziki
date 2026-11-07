import type { SecurityFinding } from "@/components/security/model";
import { sampleFindings } from "./sample-findings";

export async function getSecurityFindings(): Promise<SecurityFinding[]> {
  return sampleFindings;
}
