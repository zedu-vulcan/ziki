import { FindingsBoard } from "@/components/security/findings-board";
import {
  SECURITY_STAGES,
  type SecurityFinding,
  type SecurityStage,
} from "@/components/security/model";
import { LoadError } from "@/components/load-error";
import { logLoadFailure } from "@/lib/load-error";
import { getSecurityFindings } from "./data";

export const metadata = { title: "Security" };

function isSecurityStage(value: string | undefined): value is SecurityStage {
  return SECURITY_STAGES.some((stage) => stage === value);
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SecurityPage({ searchParams }: Props) {
  const { stage: requestedStage } = await searchParams;
  const stage =
    typeof requestedStage === "string" && isSecurityStage(requestedStage)
      ? requestedStage
      : "reported";

  let findings: SecurityFinding[];
  try {
    findings = await getSecurityFindings();
  } catch (error) {
    return (
      <LoadError
        title="Security findings could not be loaded"
        reference={logLoadFailure("[security findings] preview data failed to load", error)}
      />
    );
  }

  return <FindingsBoard findings={findings} stage={stage} />;
}
