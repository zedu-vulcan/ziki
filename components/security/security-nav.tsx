"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-blue";

export function SecurityNav() {
  const pathname = usePathname()?.replace(/\/+$/, "") ?? "";
  const home = "/security";
  const newFinding = "/security/new";

  return (
    <nav
      aria-label="Security"
      className="mx-auto mb-5 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3"
    >
      <Link
        href={home}
        aria-current={pathname === home ? "page" : undefined}
        className={`rounded-md text-xl font-extrabold tracking-[-0.01em] text-zk-text hover:text-zk-accent ${focus}`}
      >
        Security
      </Link>
      {pathname === newFinding ? null : (
        <Link
          href={newFinding}
          className={`inline-flex min-h-10 shrink-0 items-center rounded-full bg-electric-blue-strong px-4 text-sm font-bold text-white transition hover:opacity-90 ${focus}`}
        >
          Report a finding
        </Link>
      )}
    </nav>
  );
}
