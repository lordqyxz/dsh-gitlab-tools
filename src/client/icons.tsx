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

/** "Create a dev session" glyph (circle + plus) — the per-issue action button. */
export function DevSessionMark({ size = 14 }: { size?: number }) {
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
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
