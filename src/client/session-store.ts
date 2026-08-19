// Module-scope mapping from an issue (project#iid) to the dev-session created
// to implement it. Survives re-renders within one page load (not across reloads).

interface Entry {
  sessionId: string;
  createdAt: number;
}

const map = new Map<string, Entry>();

export function issueKey(project: string | undefined, iid: number): string {
  return `${project ?? ""}#${iid}`;
}

export function registerIssueSession(project: string | undefined, iid: number, sessionId: string): void {
  if (!sessionId) return;
  map.set(issueKey(project, iid), { sessionId, createdAt: Date.now() });
}

export function getIssueSession(project: string | undefined, iid: number): Entry | undefined {
  return map.get(issueKey(project, iid));
}
