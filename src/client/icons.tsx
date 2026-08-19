// Shared inline SVG glyphs for the GitLab Issues surfaces.

/** Minimal issue/thread glyph (circle outline + dot) — used as the tab icon + headers. */
export function IssueMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ flex: "none", display: "block" }}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** "Start / play" glyph (triangle) — the per-issue action that starts a dev session. */
export function DevSessionMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ flex: "none", display: "block" }}
    >
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86a1 1 0 0 0-1.5.86z" fill="currentColor" />
    </svg>
  );
}

/** "Stop" glyph (filled square) — pauses/stops a running dev session. */
export function StopMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      style={{ flex: "none", display: "block" }}
    >
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}
