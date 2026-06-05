import { requireMembership } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { CategoryCreateForm } from "./CategoryCreateForm";
import { CategoryRow } from "./CategoryRow";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const { workspace } = await requireMembership(slug);

  const cats = await db.category.findMany({
    where: { workspaceId: workspace.id },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const income = cats.filter((c) => c.kind === "INCOME");
  const expense = cats.filter((c) => c.kind === "EXPENSE");

  return (
    <div className="flex flex-col gap-8 max-w-[1240px] mx-auto w-full">
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white mt-2">
          Categories
        </h1>
        <p className="text-gray-2 text-sm mt-2">
          Used to group transactions and set monthly budgets. Categories with
          existing transactions can&apos;t be deleted yet.
        </p>
      </header>

      <CategoryCreateForm slug={slug} />

      <div className="grid md:grid-cols-2 gap-6">
        <CategoryTable
          slug={slug}
          title="Income"
          items={income}
          base={workspace.baseCurrency}
        />
        <CategoryTable
          slug={slug}
          title="Expense"
          items={expense}
          base={workspace.baseCurrency}
        />
      </div>
    </div>
  );
}

function CategoryTable({
  slug,
  title,
  items,
  base,
}: {
  slug: string;
  title: string;
  items: {
    id: string;
    name: string;
    monthlyBudget: { toString(): string } | null;
  }[];
  base: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{title}</Eyebrow>
      <div className="mb-card">
        <div className="hidden sm:grid grid-cols-[1fr_140px_80px] px-4 py-3 border-b border-line">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
            Name
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
            Budget / mo
          </span>
          <span />
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-3 text-sm">
            No categories
          </div>
        ) : (
          items.map((c) => (
            <CategoryRow
              key={c.id}
              category={{ ...c, monthlyBudget: c.monthlyBudget?.toString() ?? null }}
              slug={slug}
              base={base}
            />
          ))
        )}
      </div>
    </div>
  );
}
