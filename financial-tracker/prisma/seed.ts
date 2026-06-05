/**
 * Demo seed for local development.
 * Creates a sample user, two workspaces (INDIVIDUAL/IDR + COMPANY/USD), accounts,
 * categories, and 30 transactions over the last 90 days with FX snapshots.
 *
 * Run: `npx tsx prisma/seed.ts`
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const DEMO_EMAIL = "demo@metricbase.local";

async function main() {
  console.log("Seeding demo user and workspaces...");

  let user = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!user) {
    user = await db.user.create({
      data: { email: DEMO_EMAIL, name: "Demo Operator", emailVerified: new Date() },
    });
  }

  // Personal workspace
  let personal = await db.workspace.findUnique({ where: { slug: "demo-personal" } });
  if (!personal) {
    personal = await db.workspace.create({
      data: {
        slug: "demo-personal",
        name: "Demo Personal",
        type: "INDIVIDUAL",
        baseCurrency: "IDR",
        memberships: { create: { userId: user.id, role: "OWNER" } },
        categories: {
          create: [
            { name: "Salary", kind: "INCOME" },
            { name: "Freelance", kind: "INCOME" },
            { name: "Food", kind: "EXPENSE", monthlyBudget: "2500000" },
            { name: "Transport", kind: "EXPENSE", monthlyBudget: "1500000" },
            { name: "Housing", kind: "EXPENSE", monthlyBudget: "5000000" },
            { name: "Entertainment", kind: "EXPENSE", monthlyBudget: "1000000" },
          ],
        },
        finAccounts: {
          create: [
            { name: "BCA Operating", type: "BANK", currency: "IDR", openingBalance: "5000000" },
            { name: "Cash", type: "CASH", currency: "IDR", openingBalance: "500000" },
            { name: "Crypto Cold", type: "CRYPTO", currency: "USD", openingBalance: "1200" },
          ],
        },
      },
    });
  }

  // Company workspace
  let company = await db.workspace.findUnique({ where: { slug: "demo-acme" } });
  if (!company) {
    company = await db.workspace.create({
      data: {
        slug: "demo-acme",
        name: "Demo Acme Pte",
        type: "COMPANY",
        baseCurrency: "USD",
        memberships: { create: { userId: user.id, role: "OWNER" } },
        categories: {
          create: [
            { name: "Revenue", kind: "INCOME" },
            { name: "Service Fees", kind: "INCOME" },
            { name: "Payroll", kind: "EXPENSE", monthlyBudget: "8000" },
            { name: "Software", kind: "EXPENSE", monthlyBudget: "800" },
            { name: "Marketing", kind: "EXPENSE", monthlyBudget: "1500" },
            { name: "Rent", kind: "EXPENSE", monthlyBudget: "1200" },
          ],
        },
        finAccounts: {
          create: [
            { name: "Mercury Checking", type: "BANK", currency: "USD", openingBalance: "12000" },
            { name: "AWS Card", type: "CREDIT", currency: "USD", openingBalance: "0" },
          ],
        },
      },
    });
  }

  // FX snapshot for today (just so seeded txns don't hit the network if offline)
  const today = new Date();
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  await db.fxRate.upsert({
    where: { base_quote_date: { base: "USD", quote: "IDR", date: dayStart } },
    create: { base: "USD", quote: "IDR", date: dayStart, rate: "16400", source: "manual" },
    update: {},
  });
  await db.fxRate.upsert({
    where: { base_quote_date: { base: "IDR", quote: "USD", date: dayStart } },
    create: { base: "IDR", quote: "USD", date: dayStart, rate: "0.0000610", source: "manual" },
    update: {},
  });

  // Seed a handful of personal transactions
  const personalAccounts = await db.finAccount.findMany({
    where: { workspaceId: personal.id },
  });
  const personalCats = await db.category.findMany({
    where: { workspaceId: personal.id },
  });
  const bca = personalAccounts.find((a) => a.name === "BCA Operating")!;
  const salaryCat = personalCats.find((c) => c.name === "Salary")!;
  const foodCat = personalCats.find((c) => c.name === "Food")!;
  const txnCount = await db.transaction.count({ where: { workspaceId: personal.id } });
  if (txnCount === 0) {
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      const daysAgo = Math.floor(Math.random() * 60);
      const isIncome = i % 7 === 0;
      const date = new Date(now - daysAgo * 86_400_000);
      const amount = isIncome ? "18500000" : String(Math.floor(Math.random() * 200_000) + 30_000);
      await db.transaction.create({
        data: {
          workspaceId: personal.id,
          finAccountId: bca.id,
          categoryId: isIncome ? salaryCat.id : foodCat.id,
          date,
          amount,
          currency: "IDR",
          fxRate: "1",
          baseAmount: amount,
          type: isIncome ? "INCOME" : "EXPENSE",
          memo: isIncome ? "Monthly salary" : "Lunch",
        },
      });
    }
  }

  // Investments demo (idempotent): a brokerage account + one position with
  // two FIFO lots and a dividend in the personal workspace.
  let brokerage = await db.finAccount.findFirst({
    where: { workspaceId: personal.id, type: "BROKERAGE" },
  });
  if (!brokerage) {
    brokerage = await db.finAccount.create({
      data: {
        workspaceId: personal.id,
        name: "IBKR Brokerage",
        type: "BROKERAGE",
        currency: "USD",
        openingBalance: "10000",
      },
    });
  }
  let position = await db.position.findFirst({
    where: { finAccountId: brokerage.id, symbol: "AAPL" },
  });
  if (!position) {
    position = await db.position.create({
      data: {
        workspaceId: personal.id,
        finAccountId: brokerage.id,
        symbol: "AAPL",
      },
    });

    const txn1 = await db.transaction.create({
      data: {
        workspaceId: personal.id,
        finAccountId: brokerage.id,
        date: new Date(Date.now() - 120 * 86_400_000),
        amount: "1500",
        currency: "USD",
        fxRate: "1",
        baseAmount: "1500",
        type: "EXPENSE",
        memo: "Buy AAPL",
      }
    });

    const txn2 = await db.transaction.create({
      data: {
        workspaceId: personal.id,
        finAccountId: brokerage.id,
        date: new Date(Date.now() - 40 * 86_400_000),
        amount: "900",
        currency: "USD",
        fxRate: "1",
        baseAmount: "900",
        type: "EXPENSE",
        memo: "Buy AAPL",
      }
    });

    await db.lot.createMany({
      data: [
        {
          positionId: position.id,
          transactionId: txn1.id,
          side: "BUY",
          quantity: "10",
          remainingQty: "10",
          unitCost: "150",
          acquiredDate: new Date(Date.now() - 120 * 86_400_000),
        },
        {
          positionId: position.id,
          transactionId: txn2.id,
          side: "BUY",
          quantity: "5",
          remainingQty: "5",
          unitCost: "180",
          acquiredDate: new Date(Date.now() - 40 * 86_400_000),
        },
      ],
    });
  }

  console.log("✓ Seed complete");
  console.log(`  User: ${user.email}`);
  console.log(`  Workspaces: ${personal.slug}, ${company.slug}`);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect().then(() => process.exit(1));
  });
