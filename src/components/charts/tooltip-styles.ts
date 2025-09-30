import type { CSSProperties } from "react";

export const tooltipContentStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 20px 32px -24px rgba(15,23,42,0.45)",
  color: "var(--card-foreground)",
  fontSize: "14px",
  fontWeight: 500,
  padding: "8px 12px",
};

export const tooltipLabelStyle: CSSProperties = {
  color: "var(--muted-foreground)",
  fontWeight: 500,
};

export const tooltipItemStyle: CSSProperties = {
  color: "var(--card-foreground)",
  fontWeight: 500,
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
};
