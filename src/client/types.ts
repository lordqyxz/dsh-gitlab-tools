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
  aiUsername?: string;
  aiAccounts?: string[];
  aiIdentity?: string;
  aiIdentitySource?: string;
  aiIdentityWarning?: string;
  aiIdentityNotice?: string;
  configured?: boolean;
  tokenConfigured?: boolean;
  aiTokenConfigured?: boolean;
  code?: string;
  message?: string;
};

/** AI 身份下拉候选（/gitlab-tools/service-accounts 的条目）。 */
export type ServiceAccount = {
  username: string;
  name?: string;
  id?: number | null;
  source?: string;
  hasToken?: boolean;
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
