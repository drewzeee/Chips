export const NET_WORTH_RANGE_OPTIONS = [
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },
  { label: "All", value: "all" },
] as const;

export type NetWorthRangeValue = (typeof NET_WORTH_RANGE_OPTIONS)[number]["value"];

export const DEFAULT_NET_WORTH_RANGE: NetWorthRangeValue = "6m";
