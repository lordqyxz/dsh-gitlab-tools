// Design-system styling tokens + shared style constants.
//
// All colors use the DSH alias tokens (--dsw-alias-*) so the UI follows the
// active theme (light / dark) via body[data-ds-dark-theme]. Only tokens that
// EXIST in dsh-client-ui-theme/styles/design-platform.css are referenced —
// undefined tokens (bg-elevated / track-bg) with dark fallbacks are what broke
// light mode in an earlier iteration.

import type { CSSProperties } from "react";

export const C = {
  label1: "var(--dsw-alias-label-primary)",
  label2: "var(--dsw-alias-label-secondary)",
  label3: "var(--dsw-alias-label-tertiary)",
  caption: "var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary))",
  border: "var(--dsw-alias-border-l2)",
  borderThin: "var(--dsw-alias-border-l1)",
  surface: "var(--dsw-alias-bg-overlay)",
  layer2: "var(--dsw-alias-bg-layer-2)",
  hover: "var(--dsw-alias-interactive-bg-hover)",
  input: "var(--dsw-alias-bg-base)",
  ok: "var(--dsw-alias-state-success-primary, #46a758)",
  warn: "var(--dsw-alias-state-warn-primary, #f5a524)",
  err: "var(--dsw-alias-state-error-primary, #e5484d)",
  brand: "var(--dsw-brand-accent, #fc6d26)", // GitLab orange; readable on both themes
};

export const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 10px",
  borderBottom: `1px solid ${C.borderThin}`,
  flex: "none",
};

export const iconBtnStyle: CSSProperties = {
  flex: "none",
  width: "22px",
  height: "22px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  background: "transparent",
  color: C.label2,
  fontSize: "13px",
  lineHeight: "1",
};

export const listStyle: CSSProperties = {
  overflowY: "auto",
  flex: "1 1 auto",
  minHeight: "0",
  padding: "4px",
};

export const metaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "4px 8px",
  marginTop: "3px",
  fontSize: "11px",
  lineHeight: "16px",
  color: C.label3,
};

/** Label chip using GitLab's own label colors (bg + contrasting text). */
export function labelChipStyle(l: { color?: string; text_color?: string }): CSSProperties {
  const hex = (v?: string) => (v && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : undefined);
  return {
    padding: "0 5px",
    borderRadius: "4px",
    background: hex(l.color) ?? C.layer2,
    color: hex(l.text_color) ?? C.label2,
    fontSize: "10px",
    lineHeight: "15px",
    whiteSpace: "nowrap",
  };
}

export const hintStyle: CSSProperties = {
  padding: "12px",
  fontSize: "12px",
  lineHeight: "18px",
  color: C.label3,
};

export const inputStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: "6px 8px",
  fontSize: "12px",
  lineHeight: "16px",
  color: C.label1,
  background: C.input,
  border: `1px solid ${C.border}`,
  borderRadius: "6px",
};

export const noticeStyle: CSSProperties = {
  margin: "4px 8px 0",
  padding: "8px",
  borderRadius: "8px",
  background: C.layer2,
  border: `1px solid ${C.borderThin}`,
  flex: "none",
};

export const miniBtnStyle: CSSProperties = {
  padding: "3px 8px",
  fontSize: "11px",
  lineHeight: "15px",
  borderRadius: "5px",
  cursor: "pointer",
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.label2,
};

/** Shared root panel shell for both the tab root and the inline detail view. */
export const rootPanelStyle: CSSProperties = {
  boxSizing: "border-box",
  height: "100%",
  minHeight: "0",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  color: C.label1,
  fontFamily: "var(--ds-font-family, inherit)",
};

export const avatarStyle: CSSProperties = {
  flex: "none",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "11px",
  fontWeight: 600,
  color: C.surface,
  background: C.brand,
};

export const primaryBtnStyle: CSSProperties = {
  padding: "5px 12px",
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: 500,
  borderRadius: "6px",
  cursor: "pointer",
  border: "none",
  background: C.brand,
  color: C.surface,
};

/** Outlined secondary button (settings save/test, etc.). */
export const ghostBtnStyle: CSSProperties = {
  padding: "5px 12px",
  fontSize: "12px",
  lineHeight: "16px",
  borderRadius: "6px",
  cursor: "pointer",
  border: `1px solid ${C.border}`,
};

/** Per-issue "create dev session" ghost button (square, brand-colored glyph). */
export const rowDevBtnStyle: CSSProperties = {
  flex: "none",
  width: "26px",
  height: "26px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  background: "transparent",
  color: C.brand,
};
