import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "./constants";

export const finAccountSchema = z.object({
  name: z.string().min(1).max(60),
  type: z.enum(["BANK", "CASH", "CRYPTO", "BROKERAGE", "CREDIT", "OTHER"]),
  currency: z.enum(SUPPORTED_CURRENCIES),
  openingBalance: z.coerce.number().finite(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  kind: z.enum(["INCOME", "EXPENSE"]),
  monthlyBudget: z
    .union([z.literal(""), z.coerce.number().nonnegative()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  color: z.string().max(20).optional().nullable(),
});

export type FinAccountInput = z.infer<typeof finAccountSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;

// ─── Phase 2: invites & members ─────────────────────────────────────────────

export const inviteCreateSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
  email: z
    .union([z.literal(""), z.string().email()])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
});

export const memberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
export type MemberRoleInput = z.infer<typeof memberRoleSchema>;

// ─── Phase 2: investments ───────────────────────────────────────────────────

export const positionCreateSchema = z.object({
  finAccountId: z.string().min(1),
  symbol: z.string().min(1).max(20).transform((s) => s.trim().toUpperCase()),
  name: z.string().max(80).optional().nullable(),
});

export const lotBuySchema = z.object({
  positionId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  costPerUnit: z.coerce.number().positive(),
  fees: z
    .union([z.literal(""), z.coerce.number().nonnegative()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  acquiredAt: z.coerce.date(),
});

export const lotSellSchema = z.object({
  positionId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  pricePerUnit: z.coerce.number().positive(),
  fees: z
    .union([z.literal(""), z.coerce.number().nonnegative()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  soldAt: z.coerce.date(),
  postTransaction: z.coerce.boolean(),
});

export const dividendSchema = z.object({
  positionId: z.string().min(1),
  totalAmount: z.coerce.number().positive(),
  payDate: z.coerce.date(),
});

export const positionPriceSchema = z.object({
  positionId: z.string().min(1),
  lastPrice: z.coerce.number().positive(),
});

export type PositionCreateInput = z.infer<typeof positionCreateSchema>;
export type LotBuyInput = z.infer<typeof lotBuySchema>;
export type LotSellInput = z.infer<typeof lotSellSchema>;
export type DividendInput = z.infer<typeof dividendSchema>;
export type PositionPriceInput = z.infer<typeof positionPriceSchema>;
