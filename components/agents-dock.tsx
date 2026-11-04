"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENTS_DOCK_HEIGHT } from "@/lib/agents-dock";
import { isReservedProjectSlug } from "@/lib/project-slug";
import { projectPath } from "@/lib/project-paths";
import { AgentAvatar } from "@/components/agent-avatar";
import { formatZ } from "@/lib/points/rules";
import { agentPageHref } from "@/lib/header-nav";

/** The leaderboard (Ranking) the footer links to; /leaderboard redirects here. */
const LEADERBOARD_HREF = "/workers";

export type DockAgent = {
  id: string;
  name: string;
  avatar: string | null;
  status: "waiting" | "working" | "idle" | "offline";
  /** What it is doing now, in words (never invented). */
  activity: string;
  /** What its work has earned, in points (#710). */
  earnedPoints: number;
  /** Bids it has placed, comments it has written, and points earned today. */
  bids: number;
  comments: number;
  pointsToday: number;
  /** Things you asked it to do that it hasn't marked done (#agent-requests). */
  pendingRequests: number;
};

const STATUS_LABEL: Record<DockAgent["status"], string> = {
  working: "Working",
  waiting: "Waiting for you",
  idle: "Idle",
  offline: "Offline",
};

/** Each status moves the figure its own way (keyframes in app/globals.css). */
const MOTION: Record<DockAgent["status"], string> = {
  working: "motion-safe:animate-[zk-agent-work_0.9s_ease-in-out_infinite]",
  waiting: "motion-safe:animate-[zk-agent-wave_1.6s_ease-in-out_infinite]",
  idle: "motion-safe:animate-[zk-agent-breathe_3.2s_ease-in-out_infinite]",
  offline: "opacity-40 grayscale",
};

const DOT: Record<DockAgent["status"], string> = {
  working: "bg-emerald-500",
  waiting: "bg-amber-500",
  idle: "bg-sky-400",
  offline: "bg-zk-border",
};

/**
 * Your agents, always in view (#agents-dock): a bar fixed to the bottom of the
 * screen with each agent as a small animated figure. A working one bobs as it
 * works, one waiting for you waves, an idle one breathes, an offline one sits
 * greyed out. Hover for what it is doing; click it to open its page.
 * The leaderboard sits at the right of the strip, with Workstream (the agents'
 * work feed, drawn for people, #workstream) as an icon under it, so the strip
 * shows even when you have no agents.
 * Wide screens only: on phones the bottom of the screen holds the navigation tabs.
 */


/** The project the page is in (`/<slug>/...`), or null on a page outside any project. */
function projectSlugFromPath(pathname: string | null): string | null {
  const first = pathname?.split("/").filter(Boolean)[0];
  return first && !isReservedProjectSlug(first) ? decodeURIComponent(first) : null;
}

export function AgentsDock({ agents, defaultProjectSlug = null, version }: {
  agents: DockAgent[];
  /** Workstream's project on pages outside a project. */
  defaultProjectSlug?: string | null;
  /** The running version (package version and short commit), in tiny grey text under the icons. */
  version?: string;
}) {
  const projectSlug = projectSlugFromPath(usePathname()) ?? defaultProjectSlug;
  return (
    // A dedicated strip across the bottom of the screen, its height AGENTS_DOCK_HEIGHT:
    // the page reserves that much at its foot, so everything scrolls above it.
    <nav
      aria-label="Your agents"
      style={{ height: AGENTS_DOCK_HEIGHT }}
      className="fixed inset-x-0 bottom-0 z-30 hidden items-center gap-4 border-t border-zk-border bg-zk-surface px-6 shadow-[0_-2px_10px_rgba(11,23,51,0.06)] lg:flex"
    >
      {/* The agents sit in the middle of the strip; its name ("Your agents") is for screen readers. */}
      <ul className="m-0 mx-auto flex min-w-0 max-w-full list-none items-center justify-center gap-8 overflow-x-auto p-0">
        {agents.map((agent) => (
          <li key={agent.id} className="relative">
            <Link
              href={agentPageHref(agent.name)}
              title={`${agent.name} · ${STATUS_LABEL[agent.status]}: ${agent.activity}`}
              aria-label={`${agent.name}, ${STATUS_LABEL[agent.status]}: ${agent.activity}; earned ${formatZ(agent.earnedPoints)}, ${formatZ(agent.pointsToday)} today; ${agent.bids} bids, ${agent.comments} comments`}
              className="group flex items-center gap-2.5 rounded-xl px-2 py-1 text-left hover:bg-zk-chip focus-visible:outline-2 focus-visible:outline-electric-blue"
            >
              <span className="relative">
                <span className={`block origin-bottom ${MOTION[agent.status]}`}>
                  <AgentAvatar agentId={agent.id} avatar={agent.avatar} size={34} />
                </span>
                <span aria-hidden="true" className={`absolute -right-0.5 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-zk-surface ${DOT[agent.status]}`} />
                {agent.pendingRequests ? (
                  <span title={`${agent.pendingRequests} request${agent.pendingRequests === 1 ? "" : "s"} waiting`} className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-electric-blue-strong px-1 text-[10px] font-bold text-white">
                    {agent.pendingRequests}
                  </span>
                ) : null}
              </span>
              {/* Its name and what it has earned, then what it has done. */}
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="flex items-baseline gap-1.5">
                  <span className="max-w-32 truncate text-[12px] font-semibold text-zk-text2 group-hover:text-zk-text">{agent.name}</span>
                  <span className="font-mono text-[12px] font-bold tabular-nums text-zk-ok-fg" title={`Earned ${formatZ(agent.earnedPoints)} in all`}>
                    {formatZ(agent.earnedPoints)}
                  </span>
                  {/* Today's share, in brackets beside the total. */}
                  <span
                    className={`font-mono text-[11px] tabular-nums ${agent.pointsToday > 0 ? "font-semibold text-zk-ok-fg" : "text-zk-muted"}`}
                    title={`Earned ${formatZ(agent.pointsToday)} today`}
                  >
                    (+{formatZ(agent.pointsToday)})
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-[11px] tabular-nums text-zk-muted">
                  <span title={`${agent.bids} ${agent.bids === 1 ? "bid" : "bids"} placed`}>{agent.bids} {agent.bids === 1 ? "bid" : "bids"}</span>
                  <span aria-hidden="true">·</span>
                  <span title={`${agent.comments} ${agent.comments === 1 ? "comment" : "comments"} written`}>{agent.comments} {agent.comments === 1 ? "comment" : "comments"}</span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* Right side: the leaderboard, with the workstream as an icon under it. */}
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Link
          href={LEADERBOARD_HREF}
          title="Leaderboard"
          aria-label="Leaderboard"
          className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-zk-text2 hover:bg-zk-chip hover:text-zk-text focus-visible:outline-2 focus-visible:outline-electric-blue"
        >
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>
        </Link>
        {projectSlug ? (
          <Link
            href={projectPath(projectSlug, "/workstream")}
            title="Workstream: what agents are asked to do"
            aria-label="Workstream: what agents are asked to do"
            className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-zk-text2 hover:bg-zk-chip hover:text-zk-text focus-visible:outline-2 focus-visible:outline-electric-blue"
          >
            {/* A pulse line: work moving through the project (not the sliders used for filters). */}
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </Link>
        ) : null}
        {version ? (
          <span className="mr-1 select-all font-mono text-[9px] leading-none text-zk-muted" title="The version running">
            {version}
          </span>
        ) : null}
      </div>
    </nav>
  );
}
