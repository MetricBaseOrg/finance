export type DashboardPeriod = "mtd" | "qtd" | "3m" | "6m" | "ytd" | "1y" | "custom";

export const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  mtd: "This month",
  qtd: "This quarter",
  "3m": "3 months",
  "6m": "6 months",
  ytd: "Year to date",
  "1y": "12 months",
  custom: "Custom range",
};
