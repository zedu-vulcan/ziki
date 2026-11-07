"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-errors";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SECURITY_SEVERITIES } from "./model";

const LIMITS = {
  title: 200,
  description: 5000,
  location: 300,
  steps: 5000,
} as const;

type Field = "title" | "description" | "severity" | "location" | "steps";
type Values = Record<Field, string>;

function validate(values: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  const title = values.title.trim();
  const description = values.description.trim();
  const location = values.location.trim();
  const steps = values.steps.trim();

  if (title.length < 3) errors.title = "Enter at least 3 characters.";
  if (!SECURITY_SEVERITIES.some((severity) => severity === values.severity)) {
    errors.severity = "Choose a severity.";
  }
  if (description.length < 10) errors.description = "Enter at least 10 characters.";
  if (location.length < 3) errors.location = "Enter at least 3 characters.";
  if (steps.length < 10) errors.steps = "Enter at least 10 characters.";

  return errors;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-zk-text">
      {children}
    </label>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span aria-hidden="true" className="font-mono text-xs tabular-nums text-zk-text2">
      {value}/{max}
    </span>
  );
}

export function ReportFindingForm() {
  const id = useId();
  const [values, setValues] = useState<Values>({
    title: "",
    description: "",
    severity: "",
    location: "",
    steps: "",
  });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const errors = validate(values);
  const visibleErrors = Object.entries(errors).reduce<Record<string, string>>(
    (current, [field, error]) => {
      if (touched[field as Field] && error) current[field] = error;
      return current;
    },
    {},
  );
  const isValid = Object.keys(errors).length === 0;

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function describe(field: Field, hintId?: string) {
    const ids = [
      hintId,
      visibleErrors[field] ? `${id}-${field}-error` : undefined,
    ].filter(Boolean);
    return {
      "aria-invalid": visibleErrors[field] ? true : undefined,
      "aria-describedby": ids.length ? ids.join(" ") : undefined,
    };
  }

  function markTouched(field: Field) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function preventSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zk-text">Report a finding</h1>
        <p className="mt-1 text-sm text-zk-text2">
          Share enough detail for a careful review.
        </p>
      </div>

      <div
        role="status"
        className="rounded-xl border border-zk-warn-bd bg-zk-warn-bg px-4 py-3 text-sm text-zk-warn-fg"
      >
        <p className="font-bold">Reporting isn&apos;t open yet.</p>
        <p className="mt-0.5">
          This form will not send or save your information.
        </p>
      </div>

      <form
        className="space-y-7 rounded-[20px] border border-zk-border bg-zk-surface p-5 sm:p-8"
        onSubmit={preventSubmission}
      >
        <div>
          <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
          <Input
            id={`${id}-title`}
            name="title"
            required
            autoComplete="off"
            minLength={3}
            maxLength={LIMITS.title}
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            onBlur={() => markTouched("title")}
            placeholder="A short summary of the finding"
            {...describe("title")}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-zk-text2">Use 3 to 200 characters.</p>
            <Counter value={values.title.length} max={LIMITS.title} />
          </div>
          <FieldError formId={id} field="title" errors={visibleErrors} />
        </div>

        <div>
          <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
          <p id={`${id}-description-help`} className="mb-2 text-sm text-zk-text2">
            Explain what happened. Do not include passwords, tokens, or other private information.
          </p>
          <Textarea
            id={`${id}-description`}
            name="description"
            required
            rows={5}
            minLength={10}
            maxLength={LIMITS.description}
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            onBlur={() => markTouched("description")}
            {...describe("description", `${id}-description-help`)}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-zk-text2">Use 10 to 5,000 characters.</p>
            <Counter value={values.description.length} max={LIMITS.description} />
          </div>
          <FieldError formId={id} field="description" errors={visibleErrors} />
        </div>

        <div>
          <FieldLabel htmlFor={`${id}-severity`}>Severity</FieldLabel>
          <Select
            id={`${id}-severity`}
            name="severity"
            required
            value={values.severity}
            onChange={(event) => update("severity", event.target.value)}
            onBlur={() => markTouched("severity")}
            {...describe("severity")}
          >
            <option value="">Choose a severity</option>
            {SECURITY_SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </Select>
          <FieldError formId={id} field="severity" errors={visibleErrors} />
        </div>

        <div>
          <FieldLabel htmlFor={`${id}-location`}>Where was it found?</FieldLabel>
          <Input
            id={`${id}-location`}
            name="location"
            required
            autoComplete="off"
            minLength={3}
            maxLength={LIMITS.location}
            value={values.location}
            onChange={(event) => update("location", event.target.value)}
            onBlur={() => markTouched("location")}
            placeholder="e.g. Sign-in flow or account settings"
            {...describe("location")}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-zk-text2">Use 3 to 300 characters.</p>
            <Counter value={values.location.length} max={LIMITS.location} />
          </div>
          <FieldError formId={id} field="location" errors={visibleErrors} />
        </div>

        <div>
          <FieldLabel htmlFor={`${id}-steps`}>Steps to reproduce</FieldLabel>
          <p id={`${id}-steps-help`} className="mb-2 text-sm text-zk-text2">
            List the steps in order, without including private information.
          </p>
          <Textarea
            id={`${id}-steps`}
            name="steps"
            required
            rows={5}
            minLength={10}
            maxLength={LIMITS.steps}
            value={values.steps}
            onChange={(event) => update("steps", event.target.value)}
            onBlur={() => markTouched("steps")}
            {...describe("steps", `${id}-steps-help`)}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-zk-text2">Use 10 to 5,000 characters.</p>
            <Counter value={values.steps.length} max={LIMITS.steps} />
          </div>
          <FieldError formId={id} field="steps" errors={visibleErrors} />
        </div>

        <p className="rounded-xl border border-zk-border bg-zk-bg px-4 py-3 text-sm text-zk-text2">
          Please test only systems you have permission to assess. Give the team time to review a report before sharing it publicly.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled>
            Reporting isn&apos;t open yet
          </Button>
          {!isValid ? (
            <p className="text-sm text-zk-muted">
              Complete each field to check your report.
            </p>
          ) : (
            <p className="text-sm text-zk-muted">
              Submissions are not being accepted. Nothing will be sent or saved.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
