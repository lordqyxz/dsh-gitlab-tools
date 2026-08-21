// Filter bar for the issues panel, mirroring GitLab's issue search: a full-text
// search box (title/description, server-side) plus an "assigned to me" toggle
// that is ON by default.

import { C, inputStyle } from "./theme";
import type { PanelFilters } from "./types";

export function IssueFilter({ filters, onChange }: {
  filters: PanelFilters;
  onChange: (patch: Partial<PanelFilters>) => void;
}) {
  const assigned = filters.scope === "assigned_to_me";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "6px 10px 8px",
        borderBottom: `1px solid ${C.borderThin}`,
        flex: "none",
      }}
    >
      <input
        type="text"
        placeholder="搜索标题 / 描述…"
        defaultValue={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
        style={inputStyle}
      />
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "11px",
          lineHeight: "16px",
          color: C.label2,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={assigned}
          onChange={(e) => onChange({ scope: e.target.checked ? "assigned_to_me" : "all" })}
          style={{ margin: "0", accentColor: C.brand }}
        />
        仅看我（指派给我的）
      </label>
    </div>
  );
}
