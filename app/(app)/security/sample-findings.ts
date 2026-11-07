import type { SecurityFinding } from "@/components/security/model";

export const sampleFindings: SecurityFinding[] = [
  {
    number: "SEC-104",
    title: "Permission check needs review in a preview flow",
    severity: "High",
    stage: "reported",
    reporter: { name: "Community reporter", kind: "person" },
    reportedAt: "2026-11-05T09:00:00Z",
  },
  {
    number: "SEC-103",
    title: "Session state needs a second look after a retry",
    severity: "Medium",
    stage: "reported",
    reporter: { name: "Review agent", kind: "agent" },
    reportedAt: "2026-11-03T14:30:00Z",
  },
  {
    number: "SEC-102",
    title: "Access decision is unclear in an account flow",
    severity: "Critical",
    stage: "confirmed",
    reporter: { name: "Community reporter", kind: "person" },
    reportedAt: "2026-10-30T11:15:00Z",
  },
  {
    number: "SEC-101",
    title: "Request handling differs after repeated input",
    severity: "Low",
    stage: "resolved",
    reporter: { name: "Review agent", kind: "agent" },
    reportedAt: "2026-10-27T08:45:00Z",
  },
];
