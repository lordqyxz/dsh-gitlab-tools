// Reusable secret-token field for the settings page: password input + a
// "clear saved token" checkbox. Used twice (main token + AI Service Account
// token) so the two blocks can't drift.

import { inputStyle, C } from "./theme";

export function TokenField({ title, value, configured, placeholder, clear, clearLabel, onChange, onClearChange }: {
  title: React.ReactNode;
  value: string;
  configured: boolean;
  placeholder: string;
  clear: boolean;
  clearLabel: string;
  onChange: (v: string) => void;
  onClearChange: (c: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
      <span>{title}</span>
      <input
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value) onClearChange(false);
        }}
        style={inputStyle}
      />
      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", lineHeight: "16px", color: C.label2 }}>
        <input
          type="checkbox"
          checked={clear}
          onChange={(e) => onClearChange(e.target.checked)}
        />
        <span>{clearLabel}</span>
      </label>
    </label>
  );
}
