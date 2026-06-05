import Link from "next/link";
import { Topnav } from "@/components/mb/Topnav";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { GoldButton } from "@/components/mb/GoldButton";
import { NavDiamond } from "@/components/mb/NavDiamond";

export default function HomePage() {
  return (
    <>
      <Topnav sectionLabel="Apps · Financial Tracker" />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-[1240px] px-6 md:px-8 py-24 md:py-32 grid md:grid-cols-[1.3fr_1fr] gap-16 items-center">
          <div className="flex flex-col gap-8">
            <Eyebrow>Phase 0 · Open Beta</Eyebrow>
            <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-white">
              Read your own{" "}
              <span className="text-gold">books</span>.
            </h1>
            <p className="text-lg text-gray-2 max-w-xl leading-relaxed">
              A multi-entity financial tracker for individuals and companies.
              Multi-currency. Sharp corners. No fluff. Built by{" "}
              <span className="text-gold">MetricBase</span> for operators who
              prefer to look at the numbers themselves.
            </p>
            <div className="flex gap-4 pt-2">
              <Link href="/sign-in">
                <GoldButton variant="primary">Start free</GoldButton>
              </Link>
              <a
                href="https://metricbase.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                <GoldButton variant="ghost">MetricBase.org →</GoldButton>
              </a>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-4 text-[10px] sm:text-xs font-mono text-gray-3 uppercase tracking-[0.2em]">
              <span>IDR · USD</span>
              <span className="hidden sm:inline">·</span>
              <span>Personal + Company</span>
              <span className="hidden sm:inline">·</span>
              <span>CSV + PDF Export</span>
            </div>
          </div>

          {/* Faux dashboard preview */}
          <div className="mb-card p-8 flex flex-col gap-6 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <NavDiamond size={24} />
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-2">
                  Workspace · Personal IDR
                </span>
              </div>
              <span className="font-mono text-[10px] text-gold">● Live</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-line p-4 flex flex-col gap-2">
                <Eyebrow>Cashflow MTD</Eyebrow>
                <span className="mono text-2xl font-extrabold text-white">
                  +Rp 12.4M
                </span>
                <span className="font-mono text-[10px] text-[var(--color-up)]">
                  ▲ 18% vs last mo
                </span>
              </div>
              <div className="border border-line p-4 flex flex-col gap-2">
                <Eyebrow>Net Worth</Eyebrow>
                <span className="mono text-2xl font-extrabold text-white">
                  $43,820
                </span>
                <span className="font-mono text-[10px] text-gray-2">
                  base · USD
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-line">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                Recent
              </span>
              {[
                { d: "May 12", t: "Salary · BCA", a: "+Rp 18,500,000" },
                { d: "May 11", t: "AWS · Cards", a: "−$ 142.20" },
                { d: "May 10", t: "Transfer · USD→IDR", a: "≈ Rp 2,310,000" },
              ].map((r) => (
                <div
                  key={r.t}
                  className="flex justify-between text-sm py-2 border-b border-line last:border-b-0"
                >
                  <span className="font-mono text-xs text-gray-2">{r.d}</span>
                  <span className="flex-1 px-4 text-gray-1">{r.t}</span>
                  <span className="mono text-sm text-white">{r.a}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-6 md:px-8 py-20">
            <Eyebrow>Phase 0 Scope</Eyebrow>
            <h2 className="font-sans text-3xl md:text-4xl font-extrabold mt-3 mb-12 text-white max-w-2xl">
              Everything you need to run two sets of books at once.
            </h2>
            <div className="grid md:grid-cols-3 gap-px bg-[var(--color-line)]">
              {[
                {
                  k: "01",
                  t: "Multi-Entity",
                  d: "Switch between your personal ledger and your company books in one click. Separate categories, separate accounts, separate base currency.",
                },
                {
                  k: "02",
                  t: "Multi-Currency",
                  d: "Native IDR and USD with daily FX snapshots. Every transaction stores its rate. Reports never lie about the past.",
                },
                {
                  k: "03",
                  t: "Real Reports",
                  d: "P&L, balance sheet, category breakdowns. Export to CSV for your accountant, PDF for your records.",
                },
              ].map((f) => (
                <div key={f.k} className="bg-[var(--color-black)] p-8">
                  <span className="font-mono text-xs text-gold-dim">
                    {f.k}
                  </span>
                  <h3 className="font-sans text-xl font-bold text-white mt-4 mb-3">
                    {f.t}
                  </h3>
                  <p className="text-gray-2 text-sm leading-relaxed">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-6 md:px-8 py-20 text-center flex flex-col items-center gap-6">
            <Eyebrow>Open Beta · No Card Required</Eyebrow>
            <h2 className="font-sans text-3xl md:text-4xl font-extrabold text-white max-w-xl">
              Start tracking in under a minute.
            </h2>
            <Link href="/sign-in">
              <GoldButton variant="primary">Sign in with email</GoldButton>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1240px] px-6 md:px-8 py-12 grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-3">
            <Eyebrow>MetricBase</Eyebrow>
            <a
              href="https://metricbase.org"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Home
            </a>
            <a
              href="https://metricbase.org/journal"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Journal
            </a>
            <a
              href="https://metricbase.org/contact"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Contact us
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <Eyebrow>Verticals</Eyebrow>
            <a
              href="https://energy.metricbase.org"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Energy
            </a>
            <a
              href="https://chain.metricbase.org"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Crypto
            </a>
            <a
              href="https://saham.metricbase.org"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Saham
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <Eyebrow>Legal</Eyebrow>
            <a
              href="https://metricbase.org/privacy"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Privacy
            </a>
            <a
              href="https://metricbase.org/terms"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Terms
            </a>
            <a
              href="https://metricbase.org/disclaimer"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Disclaimer
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <Eyebrow>App</Eyebrow>
            <Link
              href="/sign-in"
              className="font-mono text-xs text-gray-2 hover:text-gold"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto max-w-[1240px] px-6 md:px-8 py-6 font-mono text-[11px] uppercase tracking-[0.18em] text-gray-3">
            © MetricBase · Apps · Financial Tracker
          </div>
        </div>
      </footer>
    </>
  );
}
