import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { USING_DB, db, listDirectory } from "@/lib/store";
import { ADMIN_COOKIE, isAdmin, keyMatches } from "@/lib/sponsor/admin";
import { BID_WINDOW_DAYS } from "@/lib/sponsor/constants";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  logo_hash: string;
  hidden: boolean;
  hidden_reason: string | null;
  total: number | null;
  reports: number;
};

async function login(form: FormData) {
  "use server";
  const key = String(form.get("key") ?? "");
  if (keyMatches(key)) {
    (await cookies()).set(ADMIN_COOKIE, key, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  redirect("/admin");
}

const card = "border border-line bg-bg-card p-4";
const btn = "border border-line px-3 py-1.5 text-[12px] text-gray-1 hover:border-line-strong hover:text-gold";

export default async function Admin() {
  if (!(await isAdmin())) {
    return (
      <form action={login} className="mx-auto mt-10 max-w-sm space-y-4 border border-line p-6">
        <h1 className="text-xl font-bold text-white">Admin</h1>
        <input
          name="key"
          type="password"
          placeholder="Admin key"
          autoFocus
          className="w-full border border-line bg-bg-elev px-3 py-2.5 text-sm outline-none focus:border-line-strong"
        />
        <button className="w-full border border-line-strong bg-tint-gold-soft px-4 py-2.5 text-sm font-semibold text-gold">
          Masuk
        </button>
      </form>
    );
  }
  if (!USING_DB) return <p className="text-sm text-gray-2">Admin butuh DATABASE_URL.</p>;

  const p = await db();
  const since = new Date(Date.now() - BID_WINDOW_DAYS * 86400_000);
  const rows = await p.$queryRaw<Row[]>`
    select s.id, s.name, s.tagline, s.url, s.logo_hash, s.hidden, s.hidden_reason,
      (select sum(usd) from sponsor_bids b where b.sponsor_id = s.id and b.kind = 'bid' and b.created_at > ${since}) as total,
      (select count(*)::int from sponsor_reports r where r.sponsor_id = s.id) as reports
    from sponsors s order by total desc nulls last, s.created_at desc limit 200`;
  const totals = await p.$queryRaw<{ kind: string; n: number; usd: number }[]>`
    select kind, count(*)::int as n, coalesce(sum(usd), 0) as usd from sponsor_bids group by kind`;
  const orphans = await p.$queryRaw<{ signature: string; amount: number; created_at: Date }[]>`
    select signature, amount, created_at from sponsor_bids where kind = 'bid_unknown_sponsor'
    order by created_at desc limit 20`;
  const unlisted = await p.$queryRaw<{ slug: string; title: string }[]>`
    select slug, title from "Campaign" where not listed and "closedAt" is null order by "createdAt" desc limit 100`;
  const listed = await listDirectory();

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-extrabold text-white">Admin</h1>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className={card}>
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-3">Kampanye di direktori</p>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{listed.length}</p>
          <p className="text-[11px] text-gray-3">{unlisted.length} disembunyikan</p>
        </div>
        {["bid", "tip", "bid_unknown_sponsor"].map((k) => {
          const t = totals.find((x) => x.kind === k);
          return (
            <div key={k} className={card}>
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-3">
                {k === "bid" ? "Tawaran sponsor (total)" : k === "tip" ? "Dukungan (total)" : "Tawaran tak cocok"}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold text-gold">${Number(t?.usd ?? 0).toFixed(2)}</p>
              <p className="text-[11px] text-gray-3">{t?.n ?? 0} pembayaran</p>
            </div>
          );
        })}
      </div>

      <section className="space-y-2">
        <h2 className="eyebrow">Sponsor</h2>
        {rows.map((r) => (
          <div key={r.id} className={`${card} flex flex-wrap items-center gap-4 ${r.hidden ? "opacity-60" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/sponsor/logo/${r.id}?v=${r.logo_hash}`} alt="" width={44} height={44} className="border border-line" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white">
                {r.name} <span className="font-mono text-[11px] text-gray-3">{r.id}</span>
              </p>
              <p className="truncate text-sm text-gray-2">{r.tagline}</p>
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-gold">
                {r.url}
              </a>
            </div>
            <div className="text-right text-sm">
              <p className="font-mono font-bold text-up">${Number(r.total ?? 0).toFixed(2)}</p>
              <p className={r.reports ? "text-gold" : "text-gray-3"}>{r.reports} laporan</p>
              {r.hidden && <p className="text-down">tersembunyi ({r.hidden_reason})</p>}
            </div>
            <form action="/api/admin" method="post">
              <input type="hidden" name="id" value={r.id} />
              <button name="action" value={r.hidden ? "show" : "hide"} className={btn}>
                {r.hidden ? "Tampilkan" : "Sembunyikan"}
              </button>
            </form>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-2">Belum ada sponsor.</p>}
      </section>

      {orphans.length > 0 && (
        <section className={card}>
          <h2 className="font-bold text-white">Pembayaran dengan id sponsor tak dikenal</h2>
          <p className="text-[12px] text-gray-2">Memo mirip tawaran Bingkai tapi tidak cocok dengan sponsor mana pun.</p>
          {orphans.map((o) => (
            <div key={o.signature} className="mt-2 flex justify-between font-mono text-[11px]">
              <a
                className="text-gold"
                href={`https://solscan.io/tx/${o.signature.split(":")[0]}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {o.signature.slice(0, 20)}…
              </a>
              <span>
                ${Number(o.amount).toFixed(2)} · {new Date(o.created_at).toLocaleString("id-ID")}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="eyebrow">Direktori kampanye</h2>
        <p className="text-[12px] text-gray-3">Sembunyikan kampanye uji coba atau yang tidak pantas dari beranda. Kampanyenya tetap bisa dibuka lewat tautan.</p>
        <div className="divide-y divide-line border border-line">
          {listed.map((c) => (
            <div key={c.slug} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <a href={`/k/${c.slug}`} target="_blank" className="min-w-0 truncate text-gray-1 hover:text-gold">
                {c.title} <span className="font-mono text-[11px] text-gray-3">/{c.slug} · ↓{c.downloads}</span>
              </a>
              <form action="/api/admin" method="post">
                <input type="hidden" name="id" value={c.slug} />
                <button name="action" value="unlist" className={btn}>
                  Sembunyikan
                </button>
              </form>
            </div>
          ))}
          {unlisted.map((c) => (
            <div key={c.slug} className="flex items-center justify-between gap-3 px-4 py-2 text-sm opacity-60">
              <span className="min-w-0 truncate text-gray-2">
                {c.title} <span className="font-mono text-[11px]">(tersembunyi)</span>
              </span>
              <form action="/api/admin" method="post">
                <input type="hidden" name="id" value={c.slug} />
                <button name="action" value="list" className={btn}>
                  Tampilkan
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
