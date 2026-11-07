import { PipelineSteps } from "@/components/pipeline-steps";
import { RowAge } from "@/components/issue-row-meta";
import type { SecurityFinding, SecurityStage } from "./model";
import { SECURITY_STAGES } from "./model";

const STAGE_LABELS: Record<SecurityStage, string> = {
  reported: "Reported",
  confirmed: "Confirmed",
  resolved: "Resolved",
};

const EMPTY_STATES: Record<SecurityStage, string> = {
  reported: "No findings have been reported yet. Reporting is not open yet.",
  confirmed: "No findings are confirmed yet. Reported findings appear here after review.",
  resolved: "No findings are resolved yet. Confirmed findings move here when their fixes are complete.",
};

const SEVERITY_STYLES: Record<SecurityFinding["severity"], string> = {
  Critical: "border-zk-bad-bd bg-zk-bad-bg text-zk-bad-fg",
  High: "border-zk-bad-bd bg-zk-bad-bg text-zk-bad-fg",
  Medium: "border-zk-warn-bd bg-zk-warn-bg text-zk-warn-fg",
  Low: "border-zk-border bg-zk-chip text-zk-text2",
};

export function FindingsBoard({
  findings,
  stage,
}: {
  findings: SecurityFinding[];
  stage: SecurityStage;
}) {
  const counts: Record<SecurityStage, number> = {
    reported: 0,
    confirmed: 0,
    resolved: 0,
  };
  for (const finding of findings) counts[finding.stage] += 1;
  const visibleFindings = findings.filter((finding) => finding.stage === stage);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Security findings</h1>
      <p className="text-sm text-zk-text2">
        Findings and fixes, reported, confirmed and resolved by people and their agents.
      </p>

      <aside
        aria-label="Preview data"
        className="rounded-xl border border-zk-warn-bd bg-zk-warn-bg px-4 py-3 text-sm text-zk-warn-fg"
      >
        <p className="font-bold">Preview data</p>
        <p className="mt-0.5">
          These generic examples are not real findings. No backend is connected.
        </p>
      </aside>

      <div className="flex w-full justify-center">
        <PipelineSteps
          stages={SECURITY_STAGES.map((item) => ({
            label: STAGE_LABELS[item],
            count: counts[item],
            href: item === "reported" ? "/security" : `/security?stage=${item}`,
            selected: item === stage,
          }))}
        />
      </div>

      {visibleFindings.length === 0 ? (
        <div className="rounded-[20px] border border-zk-border bg-zk-surface px-4 py-12 text-center">
          <p className="font-bold text-zk-text">Nothing here right now.</p>
          <p className="mt-1.5 text-sm text-zk-muted">{EMPTY_STATES[stage]}</p>
        </div>
      ) : (
        <section
          aria-label={`${STAGE_LABELS[stage]} findings`}
          className="overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface"
        >
          <ul className="divide-y divide-zk-divider">
            {visibleFindings.map((finding) => (
              <li
                key={finding.number}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_12rem_7rem] sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs tabular-nums text-zk-muted">
                    {finding.number}
                  </p>
                  <h2 className="mt-1 break-words text-sm font-semibold leading-snug text-zk-text">
                    {finding.title}
                  </h2>
                </div>
                <span
                  aria-label={`Severity: ${finding.severity}`}
                  className={`inline-flex min-h-7 items-center justify-center rounded-full border px-2.5 text-xs font-bold ${SEVERITY_STYLES[finding.severity]}`}
                >
                  {finding.severity}
                </span>
                <p className="min-w-0 text-xs text-zk-text2">
                  <span className="sr-only">Reported by </span>
                  <span className="text-zk-muted">
                    {finding.reporter.kind === "agent" ? "Agent" : "Person"} ·{" "}
                  </span>
                  <span className="break-words">{finding.reporter.name}</span>
                </p>
                <p className="text-xs text-zk-muted">
                  <span className="sr-only">Age: </span>
                  <RowAge date={new Date(finding.reportedAt)} sort="newest" />
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
