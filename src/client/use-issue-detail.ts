// Data hook: inline issue detail + discussion thread for one issue, plus a
// comment POST via the host proxy. All network goes through /gitlab-tools/*.

import { useCallback, useEffect, useState } from "react";
import type { DetailState, IssueDetail, Note } from "./types";

export function useIssueDetail(project: string | undefined, iid: number | undefined) {
  const [state, setState] = useState<DetailState>({ loading: true, issue: null, notes: [], error: null });
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!project || !iid) {
      setState({ loading: false, issue: null, notes: [], error: "缺少项目或 issue 编号" });
      return;
    }
    setState((p) => ({ ...p, loading: true, error: null }));
    const qp = `project=${encodeURIComponent(project)}&iid=${iid}`;
    Promise.all([
      fetch(`/gitlab-tools/issue?${qp}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/gitlab-tools/issue/notes?${qp}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([i, n]) => {
        setState({
          loading: false,
          issue: i.ok ? (i.issue as IssueDetail) : null,
          notes: n.ok ? ((n.notes ?? []) as Note[]) : [],
          error: !i.ok ? i.message || "加载失败" : !n.ok ? n.message || "加载失败" : null,
        });
      })
      .catch((e) => setState({ loading: false, issue: null, notes: [], error: String((e && e.message) || e) }));
  }, [project, iid]);

  useEffect(() => {
    load();
  }, [load]);

  /** Post a comment; resolves `null` on success, else an error message. */
  const post = useCallback(
    async (text: string): Promise<string | null> => {
      const t = text.trim();
      if (!project || !iid || !t) return "评论内容不能为空";
      setPosting(true);
      setPostError(null);
      try {
        const res = await fetch(`/gitlab-tools/issue/notes?project=${encodeURIComponent(project)}&iid=${iid}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: t }),
        });
        const json = await res.json();
        if (!json.ok) {
          const msg = json.message || "评论失败";
          setPostError(msg);
          return msg;
        }
        load();
        return null;
      } catch (e) {
        const msg = String((e && e.message) || e);
        setPostError(msg);
        return msg;
      } finally {
        setPosting(false);
      }
    },
    [project, iid, load]
  );

  return { state, posting, postError, load, post };
}
