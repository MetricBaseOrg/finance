export const APP_NAME = "MetricBase Financial Tracker";
export const APP_TAGLINE = "Read your own books.";
export const BRAND_DOMAIN = "metricbase.org";
export const APP_DOMAIN = "apps.metricbase.org";

export const METRICBASE_LINKS = {
  home: "https://metricbase.org",
  contact: "https://metricbase.org/contact",
  energy: "https://energy.metricbase.org",
  chain: "https://chain.metricbase.org",
  saham: "https://saham.metricbase.org",
  journal: "https://metricbase.org/journal",
} as const;

export const SUPPORTED_CURRENCIES = ["IDR", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const INVITE_TTL_DAYS = 7;
export const DIVIDEND_CATEGORY_NAME = "Dividends";

export const DEFAULT_INDIVIDUAL_CATEGORIES = {
  income: ["Salary", "Freelance", "Investments", "Dividends", "Other Income"],
  expense: [
    "Housing",
    "Food",
    "Transport",
    "Utilities",
    "Health",
    "Entertainment",
    "Shopping",
    "Other Expense",
  ],
};

export const DEFAULT_COMPANY_CATEGORIES = {
  income: ["Revenue", "Service Fees", "Interest Income", "Dividends", "Other Income"],
  expense: [
    "Payroll",
    "Rent",
    "Software",
    "Marketing",
    "Professional Fees",
    "Travel",
    "Office",
    "Other Expense",
  ],
};
