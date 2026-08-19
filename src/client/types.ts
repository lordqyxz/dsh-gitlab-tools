// Shared client-side types for the GitLab Issues surfaces.
// Every byte of GitLab data arrives through the host proxy routes (/gitlab-tools/*)
// so the token never leaves the server.

/** Issue list row (from GET /gitlab-tools/issues). */
export type Issue = {
  iid: number;
  title: string;
  state: string;
  web_url: string;
  created_at: string;
  updated_at: string;
  labels: string[];
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
  author: { username: string; name?: string } | null;
};

export type SettingsResp = {
  ok: boolean;
  defaultProject?: string;
  host?: string;
  refreshMs?: number;
  configured?: boolean;
  tokenConfigured?: boolean;
  aiTokenConfigured?: boolean;
  code?: string;
  message?: string;
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
