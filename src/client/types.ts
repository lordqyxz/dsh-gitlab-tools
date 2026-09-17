// Shared client-side types for the GitLab Issues surfaces.
// Every byte of GitLab data arrives through the host proxy routes (/gitlab-tools/*)
// so the token never leaves the server.

/** A GitLab label with its server-assigned colors (when label details are fetched). */
export type Label = {
  name: string;
  /** Background color, e.g. "#428bca". */
  color?: string;
  /** Contrasting text color chosen by GitLab, e.g. "#ffffff". */
  text_color?: string;
};

/** Issue list row (from GET /gitlab-tools/issues). */
export type Issue = {
  iid: number;
  title: string;
  state: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  labels: Label[];
  assignees: { username: string; name?: string }[];
  author: { username: string; name?: string } | null;
  milestone: { title: string } | null;
  confidential: boolean;
};

/** Full issue detail (from GET /gitlab-tools/issue): the list shape + description. */
export type IssueDetail = Issue & { description: string };

/** A discussion note/comment (from GET /gitlab-tools/issue/notes). */
export type Note = {
  id: number;
  body: string;
  system: boolean;
  created_at: string;
  author: {
    username: string;
    name?: string;
    /** Full GitLab avatar URL (public /uploads path); null when unavailable. */
    avatar_url?: string | null;
  } | null;
};

/** Project (path_with_namespace) → local folder, used to place dev sessions. */
export type ProjectDir = { project: string; dir: string };

export type SettingsResp = {
  ok: boolean;
  defaultProject?: string;
  host?: string;
  refreshMs?: number;
  projectDirs?: ProjectDir[];
  configured?: boolean;
  tokenConfigured?: boolean;
  aiTokenConfigured?: boolean;
  code?: string;
  message?: string;
};

/** One ingested agent-event row (GET /gitlab-tools/agent-events). */
export type AgentEventRow = {
  receivedAt: string;
  source: string;
  kind: string;
  brief: string;
  responder?: string | null;
  project?: string;
  skipped?: boolean;
};

/** Event-pipeline status block for the Agent 事件 panel. */
export type AgentEventsStatus = {
  receiver: "on" | "off";
  poller: {
    enabled: boolean;
    projects: string[];
    intervalMs: number;
    lastPollAt: string | null;
    lastCycle: { at: string; notes: number; errors: string[] } | null;
    lastCycleError: string | null;
  } | null;
  ntfy: { enabled: boolean; url: string; messages: number; lastError: string | null } | null;
  responder: {
    enabled: boolean;
    mentionUsername?: string;
    maxPerIssuePerHour?: number;
    maxContinuationsPerHour?: number;
    pipelineTriage?: boolean;
  } | null;
  outbound: {
    boundSessions: number;
    postedCount: number;
    lastPostedAt: string | null;
    lastTarget: string | null;
    lastError: string | null;
  } | null;
  aiIdentity: string;
  aiIdentitySource?: string;
  aiIdentityWarning?: string;
};

export type AgentEventsResp = {
  ok: boolean;
  status?: AgentEventsStatus;
  total?: number;
  events?: AgentEventRow[];
  code?: string;
  message?: string;
};

export type AgentPollResp = {
  ok: boolean;
  enabled?: boolean;
  notes?: number;
  errors?: string[];
  message?: string;
};

/** List filters for the issues panel (mirrors GitLab's issue search). */
export type PanelFilters = {
  /** Full-text search on title/description (server-side). */
  search: string;
  /** "assigned_to_me" (default) only lists issues assigned to the current user. */
  scope: "assigned_to_me" | "all";
};

export type IssuesResp = {
  ok: boolean;
  code?: string;
  message?: string;
  project?: string;
  issues?: Issue[];
  updatedAt?: number;
};

export type PanelState = {
  loading: boolean;
  data: IssuesResp | null;
  error: string | null;
};

export type DetailState = {
  loading: boolean;
  issue: IssueDetail | null;
  notes: Note[];
  error: string | null;
};

/** Result of a create-dev-session action. */
export type DevNotice = {
  kind: "ok" | "warn" | "err";
  text: string;
  prompt?: string;
  sessionId?: string;
};

/** Live dev-session runtime stats (from GET /gitlab-tools/session/stats). */
export type SessionStats = {
  ok: boolean;
  sessionId: string;
  exists: boolean;
  running: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  tokensPerSec: number | null;
  firstActiveAt: number | null;
  lastActiveAt: number | null;
  samples: number;
  updatedAt: number;
};
