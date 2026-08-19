// dsh-gitlab-tools — client half (browser bundle) entry point.
// Two additive surfaces, no shipped UI displaced:
//   1. dsh-better-sidebar tab → a "GitLab Issues" activity-bar tab (same level
//      as explorer / git / subagent / terminal / browser), registered through
//      the better-sidebar service (`ctx.get('betterSidebar').registerTab`).
//      Each issue row can spawn a dev session that implements it.
//   2. settings.section       → a "GitLab Issues" settings page.
//
// The implementation is split into small single-responsibility modules under
// src/client/ (one file per concern — see AGENTS.md "客户端模块拆分原则"):
//   data hooks: use-panel.ts / use-issue-detail.ts / use-session-stats.ts
//   surfaces:   tab.tsx (root) / issue-list.tsx (container) / issue-card.tsx
//               / issue-detail.tsx / note-row.tsx / dev-notice.tsx / settings.tsx
//               / token-fields.tsx
//   helpers:    types.ts / format.ts / state.ts / theme.ts / markdown.ts
//               / sanitize-html.ts / icons.tsx / devsession.ts / session-store.ts
// This file only wires the plugin entry + tab registration.
//
// Built to lib/client.js by scripts/build.mjs (esbuild); platform modules (react,
// react/jsx-runtime) resolve from the loader module table and are never inlined.

import { IssueMark } from "./icons";
import { GitLabIssuesTab } from "./tab";
import { SettingsCard } from "./settings";

const inject = ["slots"];

/** dsh-better-sidebar tab descriptor (same level as explorer/git/subagent/terminal/browser). */
const TAB_DESCRIPTOR = {
  id: "gitlab-tools:issues",
  title: "GitLab Issues",
  icon: (size: number) => <IssueMark size={size} />,
  order: 60,
  single: true,
  component: GitLabIssuesTab,
};

function registerIssuesTab(ctx: { get: (name: string) => unknown }) {
  const tryRegister = () => {
    const bs = ctx.get("betterSidebar") as { registerTab?: (d: unknown) => void } | null | undefined;
    if (bs && typeof bs.registerTab === "function") {
      try {
        bs.registerTab(TAB_DESCRIPTOR);
        return true;
      } catch (e) {
        console.error("[gitlab-tools] betterSidebar registerTab failed:", e);
      }
    }
    return false;
  };
  // better-sidebar applies before us in the boot graph, but retry briefly as a
  // safety net for future load-order changes; the settings page stays up either way.
  if (tryRegister()) return;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (tryRegister() || tries >= 20) window.clearInterval(timer);
  }, 500);
}

function apply(ctx: { slots: { inject: (name: string, factory: () => unknown) => unknown }; get: (name: string) => unknown }) {
  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "gitlab-tools",
        order: 210,
        label: "GitLab Issues",
      },
      SettingsCard
    )
  );
  registerIssuesTab(ctx);
}

export { apply, inject };
