// dsh-gitlab-tools — client half (browser bundle) entry point.
// Two additive surfaces, no shipped UI displaced:
//   1. dsh-better-sidebar tab → a "GitLab Issues" activity-bar tab (same level
//      as explorer / git / subagent / terminal / browser), registered through
//      the better-sidebar service (`betterSidebar.registerTab`).
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

/** dsh-better-sidebar tab descriptor (same level as explorer/git/subagent/terminal). */
const TAB_DESCRIPTOR = {
  id: "gitlab-tools:issues",
  title: "GitLab Issues",
  icon: (size: number) => <IssueMark size={size} />,
  order: 60,
  single: true,
  component: GitLabIssuesTab,
  // 声明式「功能设置」：字段持久化在 better-sidebar 的 pluginSettings["gitlab-tools:issues"]，
  // 优先级高于设置页（host 路由）的同类配置；见 use-panel.ts 的合并逻辑。
  settings: {
    pluginToggles: [
      {
        key: "defaultProject",
        type: "text",
        title: "默认项目 / Default project",
        placeholder: "group/project",
        desc: "留空回退到设置页的默认项目 / Empty falls back to the settings page value",
      },
      {
        key: "refreshMs",
        type: "number",
        min: 5000,
        max: 3600000,
        unit: "ms",
        title: "刷新间隔 / Refresh interval",
        desc: "覆盖设置页的轮询间隔 / Overrides the settings page polling interval",
      },
    ],
  },
};

/** Services the sub-fiber (ctx.inject callback) may touch. betterSidebar is declared there. */
interface InjectedCtx {
  effect: (fn: () => unknown, name?: string) => unknown;
  betterSidebar: { registerTab: (descriptor: unknown) => () => void };
}

interface PluginCtx {
  slots: { inject: (name: string, factory: () => unknown) => unknown };
  effect: (fn: () => unknown, name?: string) => unknown;
  inject: (services: string[], cb: (svc: InjectedCtx) => unknown) => { dispose: () => void };
}

function registerIssuesTab(ctx: PluginCtx) {
  // Wait on the betterSidebar service (cordis inject fiber) instead of the old
  // 500ms×20 polling cap: dsh-better-sidebar 0.18+ mounts its client half later
  // than the fixed 10s window assumed, so the cap expired before the service
  // existed and the tab silently never registered (regression 2026-09). The
  // inject fiber parks until the service appears; if dsh-better-sidebar is
  // absent it stays pending harmlessly and the settings page keeps working.
  ctx.effect(() => {
    const fiber = ctx.inject(["betterSidebar"], (svc) =>
      svc.effect(
        () => svc.betterSidebar.registerTab(TAB_DESCRIPTOR),
        "gitlab-tools: register issues tab",
      ),
    );
    return () => fiber.dispose();
  }, "gitlab-tools: betterSidebar tab");
}

function apply(ctx: PluginCtx) {
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
