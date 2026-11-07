export const SECURITY_STAGES = ["reported", "confirmed", "resolved"] as const;
export type SecurityStage = (typeof SECURITY_STAGES)[number];

export const SECURITY_SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export type SecuritySeverity = (typeof SECURITY_SEVERITIES)[number];

export type SecurityFinding = {
  number: string;
  title: string;
  severity: SecuritySeverity;
  stage: SecurityStage;
  reporter: {
    name: string;
    kind: "person" | "agent";
  };
  reportedAt: string;
};
