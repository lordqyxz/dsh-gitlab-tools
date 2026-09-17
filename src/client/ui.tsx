// 轻量 UI 原语层 —— shadcn/ui 思路的本地化：组件归插件所有、零新增依赖、
// 样式走宿主 design-platform 的 --dsw-alias-* token（自动适配宿主明暗主题）。
// 不直接引入 shadcn/ui 的原因：其组件绑定 Tailwind 类名体系，需要 Tailwind 构建
// 管线并把生成的全局 CSS 注入宿主页面（无法 scoped，会与宿主样式互相污染）；
// Radix 交互层（portal/z-index）也与本 GUI 的 overlay 体系有冲突风险。
// 这里取其精髓——小而可组合、样式可预测的本地原语。

import type { CSSProperties, ReactNode } from "react";
import { C } from "./theme";

const badgeBase: CSSProperties = {
  padding: "0 5px",
  borderRadius: "6px",
  background: C.border,
  color: C.label2,
  fontSize: "10.5px",
  lineHeight: "15px",
  whiteSpace: "nowrap",
};

const TONES: Record<string, CSSProperties> = {
  neutral: {},
  ok: { color: C.ok },
  err: { color: C.err },
  warn: { color: C.warn },
  brand: { color: C.brand },
};

/** 徽章：来源 / 类型 / 处置结果等小标签。 */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  const t = TONES[tone] || TONES.neutral;
  return <span style={{ ...badgeBase, ...t }}>{children}</span>;
}

/** 幽灵按钮：统一尺寸与 disabled 态。 */
export function Btn({ children, onClick, disabled, title, active }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}) {
  const base: CSSProperties = {
    padding: "3px 8px",
    borderRadius: "8px",
    border: "1px solid " + (active ? C.brand : C.border),
    background: "transparent",
    color: active ? C.brand : C.label2,
    fontSize: "11px",
    lineHeight: "16px",
    cursor: "pointer",
  };
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} style={{ ...base, ...(disabled ? { opacity: 0.5, cursor: "default" } : {}) }}>
      {children}
    </button>
  );
}

/** 状态卡容器：键值行的分组底板。 */
export function StatusCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "8px 10px", borderRadius: "8px", background: C.surface, border: "1px solid " + C.border }}>
      {children}
    </div>
  );
}

/** 键值状态行：label 定宽，值可换行；warn 时红色。 */
export function StatusRow({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "8px", fontSize: "11px", lineHeight: "17px" }}>
      <span style={{ color: C.label3, flex: "0 0 64px" }}>{label}</span>
      <span style={{ color: warn ? C.err : C.label1, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

/** 流水/列表卡片容器（事件行等）。 */
export function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "6px 8px", borderRadius: "8px", background: C.surface, border: "1px solid " + C.border }}>
      {children}
    </div>
  );
}

/** 元信息小行（时间 / 徽章组）。 */
export function MetaLine({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "baseline", fontSize: "10.5px", lineHeight: "15px", color: C.label3 }}>
      {children}
    </div>
  );
}

/** 空态 / 次要提示。 */
export function Hint({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: "11px", lineHeight: "16px", color: C.label3 }}>{children}</div>;
}
