// Create-a-dev-session-for-an-issue: fetch the issue body + comments up front,
// embed them in the startup prompt (so the agent doesn't spend tokens/rounds
// re-fetching), then (when a working directory is available) auto-start a new
// dev session. No host changes needed — pure client via ctx.get("sessions") and
// the existing /gitlab-tools proxy GET routes.

import type { DevNotice, Issue, ProjectDir } from "./types";
import { registerIssueSession } from "./session-store";

type WorkspaceItem = { workspaceId: string; path?: string };
type WorkspacesSvc = { list?: { getSnapshot?: () => { items?: WorkspaceItem[] } | undefined } };

/** Normalize a project path for comparison (group/project; case-insensitive). */
function normProject(p?: string): string {
  return (p ?? "").trim().toLowerCase();
}

/**
 * Resolve the DSH workspace that owns `cwd` (exact path match first, then the
 * longest workspace path that contains it). Returns undefined when no workspace
 * matches — caller then falls back to creating with a bare `cwd`.
 */
export function resolveWorkspaceId(ctx: unknown, cwd: string): string | undefined {
  const workspaces = ((ctx as { get?: (name: string) => unknown })?.get?.("workspaces")) as WorkspacesSvc | undefined;
  const items = workspaces?.list?.getSnapshot?.()?.items ?? [];
  if (!items.length) return undefined;
  const norm = (p: string) => p.replace(/[\\/]+$/, "");
  const base = norm(cwd);
  let best: { workspaceId: string; path: string } | undefined;
  for (const w of items) {
    const p = w.path ? norm(w.path) : "";
    if (!p) continue;
    if (p === base) return w.workspaceId; // exact match
    if (base === p || base.startsWith(p + "/") || base.startsWith(p + "\\")) {
      if (!best || p.length > best.path.length) best = { workspaceId: w.workspaceId, path: p };
    }
  }
  return best?.workspaceId;
}

/** Issue body + comments, fetched once at startup and embedded in the prompt. */
export type IssueContext = { description: string; notes: string };

/**
 * Pull the issue's full description and its discussion thread through the host
 * proxy (GET routes, no token in the browser). Failures degrade gracefully to
 * empty strings — the prompt still works, the agent just falls back to tools.
 */
export async function fetchIssueContext(project: string | undefined, iid: number): Promise<IssueContext> {
  const qp = `project=${encodeURIComponent(project ?? "")}&iid=${iid}`;
  let description = "";
  let notes = "";
  try {
    const r = await fetch(`/gitlab-tools/issue?${qp}`, { cache: "no-store" });
    const j = await r.json();
    if (j && j.ok === true && j.issue && typeof j.issue.description === "string") {
      description = j.issue.description;
    }
  } catch {
    /* optional */
  }
  try {
    const r = await fetch(`/gitlab-tools/issue/notes?${qp}`, { cache: "no-store" });
    const j = await r.json();
    if (j && j.ok === true && Array.isArray(j.notes)) {
      notes = j.notes
        .map((n) => {
          const who = n.system ? "系统" : `@${n.author?.username ?? "?"}`;
          const when = n.created_at ? `_(${n.created_at})_` : "";
          // Collapse newlines so each comment stays one markdown list item.
          const body = String(n.body ?? "").replace(/\s*\n\s*/g, " ").trim();
          return `- **${who}** ${when}: ${body || "（空）"}`;
        })
        .join("\n");
    }
  } catch {
    /* optional */
  }
  return { description, notes };
}

/** Build the task prompt handed to the new dev session (auto-started when suitable). */
export function buildPrompt(issue: Issue, project?: string, cwd?: string, context?: IssueContext): string {
  const labels = issue.labels.length ? issue.labels.map((l) => l.name).join(", ") : "无";
  const assignee = issue.assignees.length ? `@${issue.assignees[0].username}` : "未指派";
  const hasBody = Boolean(context?.description?.trim());
  const hasNotes = Boolean(context?.notes?.trim());
  return [
    `请处理 GitLab issue #${issue.iid}：${issue.title || "(无标题)"}`,
    "",
    `- 项目：${project || "（未知）"}`,
    `- 状态：${issue.state} · 标签：${labels} · 指派人：${assignee}`,
    `- Issue 链接：${issue.web_url}`,
    cwd ? `- 工作目录：${cwd}` : "- 工作目录：（未设置）",
    "",
    "",
    "## Issue 内容（启动时已内嵌，无需再调用工具重复拉取）",
    "### 正文",
    hasBody ? context!.description.split("\n").map((l) => `> ${l}`).join("\n") : "> （无正文）",
    "",
    "### 既有讨论",
    hasNotes ? context!.notes : "- （无既有讨论）",
    "",
    "## 开发规程（务必按此执行：先规划、先确认，再动手）",
    "0. 【只读调研·不写代码】基于上面已内嵌的 issue 正文与讨论（不必再 GitLab 工具 重复拉取），" +
      (cwd
        ? `clone/定位仓库后，评估【该 issue 与当前代码的匹配程度】：需求能落在哪些现有模块/代码路径上、改动范围大概多大。`
        : `评估该 issue 与代码的匹配程度：先确定/克隆该项目到合适工作目录。`) +
      " 这一步只调研，绝不开始写代码。",
    "1. 【制定 plan】把【开发计划】用 gitlab_create_note 发到 issue #${issue.iid} 的评论里——含：对需求的理解、方案选择、issue 与代码匹配度评估、疑问点、实施步骤、工作量估计。",
    "2. 【更新标签】用 gitlab_api 更新该 issue 的标签以反映当前状态（例如标为「规划中/待确认」或你按需新建的状态标签），但先不要把「进行中」标得太早。",
    "3. 【触发对话·等待确认】把 plan 同步到 issue 评论，必要时在对话里向用户说明并明确询问确认。**等待用户确认后再开始实际开发。**",
    "4. 【确认后实现】用户确认后，严格按 plan 实现；期间若用户在 issue 评论或对话里回复（答复疑问、给新方案、@ 你，新增的评论不在启动内容里），用 gitlab_api 调 GET projects/{id}/issues/{iid}/notes?sort=desc&order_by=created_at 增量读取新增讨论（与启动内嵌内容取差集）并把反馈正确加载进执行流，不要忽略。",
    "5. 【收尾】实现完成后，用 gitlab_create_note 在 issue 上补充实现说明/结论（必要时提交 MR），说明如何验证，并把标签更新为已完成/进行中对应的状态。",
    "",
    "## 对话交互",
    "用户在对话里 @ 你或直接对你说话时，都要正确响应其请求；若该请求属于某个 issue，先经 gitlab_api 读该 issue 讨论再回应。",
  ].join("\n");
}

/**
 * Auto-check then act: if we can pick a working directory (the configured
 * project→folder mapping first, else the current session's cwd), create a new
 * dev session there and auto-send the issue task. Otherwise do NOT auto-start —
 * return the prompt for the user to copy instead.
 *
 * Grouping: the new session is created with the resolved `workspaceId` of the
 * target folder (not a bare `cwd`), so it lands in the correct workspace group.
 */
export async function createDevSession(
  ctx: unknown,
  scope: { sessionId?: string; cwd?: string } | undefined,
  issue: Issue,
  project?: string,
  projectDirs?: ProjectDir[]
): Promise<DevNotice> {
  type Sessions = {
    create?: (opts: { cwd?: string; workspaceId?: string }) => Promise<string>;
    open?: (id: string) => void;
    binding?: (id: string) => { session?: { prompt?: (content: unknown[], mode: string) => Promise<unknown> } };
  };
  const sessions = ((ctx as { get?: (name: string) => unknown })?.get?.("sessions") as Sessions | undefined);
  if (!sessions || typeof sessions.create !== "function") {
    return { kind: "err", text: "DSH 会话服务不可用，无法创建开发会话" };
  }
  // Fetch the issue body + comments up front so they can be embedded in the
  // prompt (saves the agent a round trip + tokens at startup).
  const context = await fetchIssueContext(project, issue.iid);
  // Target folder: configured project→folder mapping wins, else current cwd.
  const mapped = (projectDirs ?? []).find((m) => normProject(m.project) === normProject(project));
  const cwd = (mapped?.dir && mapped.dir.trim()) || scope?.cwd;
  const suitable = typeof cwd === "string" && cwd.trim() !== "";
  const prompt = buildPrompt(issue, project, cwd, context);
  try {
    if (!suitable) {
      return {
        kind: "warn",
        text: "无法确定项目工作目录（未配置项目→文件夹映射，当前会话也没有工作目录）。请到 设置 → GitLab Issues 配置项目文件夹，或复制下方提示词手动发送。",
        prompt,
      };
    }
    const workspaceId = resolveWorkspaceId(ctx, cwd);
    const sessionId = await sessions.create(workspaceId ? { workspaceId } : { cwd });
    if (typeof sessionId !== "string" || !sessionId) {
      return { kind: "err", text: "创建会话失败（未返回 sessionId）" };
    }
    // Remember the issue→session link so the card can show live progress/tokens.
    registerIssueSession(project, issue.iid, sessionId);
    const session = sessions.binding?.(sessionId)?.session;
    if (session && typeof session.prompt === "function") {
      await session.prompt([{ type: "text", text: prompt }], "queue");
      return { kind: "ok", text: `已创建开发会话并自动启动任务 · #${issue.iid}`, sessionId };
    }
    return { kind: "warn", text: "已创建会话，但未能自动发送任务（请复制提示词手动发送）", prompt, sessionId };
  } catch (e) {
    return { kind: "err", text: "创建失败：" + String((e && (e as Error).message) || e) };
  }
}
