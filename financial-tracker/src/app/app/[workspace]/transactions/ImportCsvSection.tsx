"use client";

import { useActionState, useRef } from "react";
import { importTransactions, type ImportResult } from "@/server/actions/transactions";
import { Eyebrow } from "@/components/mb/Eyebrow";

type Account = { name: string };
type Category = { name: string; kind: string };

function downloadTemplate(accounts: Account[], categories: Category[]) {
  const incomeEx = categories.find((c) => c.kind === "INCOME")?.name ?? "Income Category";
  const expenseEx = categories.find((c) => c.kind === "EXPENSE")?.name ?? "Expense Category";
  const acct1 = accounts[0]?.name ?? "Account Name";
  const acct2 = accounts[1]?.name ?? acct1;
  const today = new Date().toISOString().slice(0, 10);

  const rows = [
    "date,type,account,amount,memo,category,counter_account",
    `${today},INCOME,${acct1},5000.00,Monthly salary,${incomeEx},`,
    `${today},EXPENSE,${acct1},200.00,Groceries,${expenseEx},`,
    `${today},TRANSFER,${acct1},1000.00,Savings transfer,,${acct2}`,
  ].join("\n");

  const blob = new Blob([rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "metricbase-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportCsvSection({
  slug,
  accounts,
  categories,
}: {
  slug: string;
  accounts: Account[];
  categories: Category[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boundAction = importTransactions.bind(null, slug);
  const [result, formAction, pending] = useActionState<ImportResult | undefined, FormData>(
    boundAction,
    undefined,
  );

  return (
    <div className="mb-card p-5 flex flex-col gap-4">
      <Eyebrow>Import CSV</Eyebrow>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button
          type="button"
          onClick={() => downloadTemplate(accounts, categories)}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold border border-gold hover:bg-gold hover:text-black px-3 py-2 transition-colors shrink-0"
        >
          Download Template
        </button>

        <form action={formAction} className="flex flex-1 gap-3 items-center flex-wrap">
          <label className="flex-1 min-w-[200px]">
            <span className="sr-only">CSV file</span>
            <input
              ref={fileRef}
              type="file"
              name="csv"
              accept=".csv,text/csv"
              required
              className="w-full font-mono text-[11px] text-gray-2 file:mr-3 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.15em] file:bg-transparent file:border file:border-line file:text-gold file:px-2 file:py-1 file:cursor-pointer hover:file:border-gold transition-colors"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-black bg-gold hover:bg-gold-bright px-3 py-2 transition-colors disabled:opacity-50 shrink-0"
          >
            {pending ? "Importing…" : "Import"}
          </button>
        </form>
      </div>

      <p className="font-mono text-[10px] text-gray-3 uppercase tracking-[0.15em]">
        Columns: date · type · account · amount · memo · category · counter_account
      </p>

      {result && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          {result.imported > 0 && (
            <p className="font-mono text-[11px] text-[var(--color-up)]">
              ✓ {result.imported} transaction{result.imported !== 1 ? "s" : ""} imported
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="flex flex-col gap-1">
              {result.errors.map((e, i) => (
                <li key={i} className="font-mono text-[11px] text-[var(--color-down)]">
                  {e}
                </li>
              ))}
            </ul>
          )}
          {result.imported === 0 && result.errors.length === 0 && (
            <p className="font-mono text-[11px] text-gray-3">No rows to import.</p>
          )}
        </div>
      )}
    </div>
  );
}
