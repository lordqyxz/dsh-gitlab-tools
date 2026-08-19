// Data hooks: settings + issue-list polling (`usePanel`) and the inline issue
// detail + discussion thread (`useIssueDetail`, incl. comment POST).
//
// All network goes through the host proxy routes (/gitlab-tools/*); the token
// never reaches the browser.

import { useCallback, useEffect, useRef, useState } from "react";
import { refreshSignal } from "./state";
import type { DetailState, IssueDetail, IssuesResp, Note, PanelState, SettingsResp } from "./types";

/**
 * Shared data hook: settings (refresh interval) + issue list, with polling + save
 * fan-out. `active` pauses everything while the surface is hidden (e.g. the
 * better-sidebar tab collapsed/backgrounded) and resumes on becoming visible.
 */
export function usePanel(active = true) {
  const [settings, setSettings] = useState<{ defaultProject: string; refreshMs: number } | null>(null);
  const [state, setState] = useState<PanelState>({ loading: true, data: null, error: null });

  const loadIssues = useCallback((project?: string) => {
    setState((prev) => ({ loading: true, data: prev.data, error: null }));
    const q = project ? `?project=${encodeURIComponent(project)}` : "";
    fetch(`/gitlab-tools/issues${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: IssuesResp) => {
        setState({
          loading: false,
          data: json,
          error: json.ok ? null : json.message || "查询失败",
        });
      })
      .catch((e) => {
        setState({ loading: false, data: null, error: String((e && e.message) || e) });
      });
  }, []);

  const loadSettings = useCallback(() => {
    fetch("/gitlab-tools/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: SettingsResp) => {
        if (!json || json.ok !== true) return;
        setSettings((prev) => {
          const next = { defaultProject: json.defaultProject ?? "", refreshMs: json.refreshMs ?? 120000 };
          if (prev && prev.defaultProject === next.defaultProject && prev.refreshMs === next.refreshMs) {
            return prev; // same reference → React bails out, no re-render loop
          }
          return next;
        });
      })
      .catch(() => {
        /* settings are optional; surface still renders from defaults */
      });
  }, []);

  // Mirror the current refreshMs into a ref so the recursive poll reads a fresh
  // value on every tick — a settings change takes effect without a remount.
  const refreshMsRef = useRef(120000);
  refreshMsRef.current = settings?.refreshMs ?? 120000;

  useEffect(() => {
    if (!active) return; // hidden surface: no fetch, no poll
    loadSettings();
    loadIssues();
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(() => {
        loadSettings();
        loadIssues();
        schedule();
      }, refreshMsRef.current);
    };
    schedule();
    const dispose = refreshSignal.subscribe(() => {
      loadSettings();
      loadIssues();
    });
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      dispose();
    };
  }, [active, loadIssues, loadSettings]);

  return { settings, state, loadIssues };
}

/** Inline detail + discussion thread for one issue; POSTs comments via proxy. */
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
