import Link from "next/link";
import type { Slot } from "@/lib/sponsor/board";
import { MIN_TOTAL_USD, SLOT_COUNT } from "@/lib/sponsor/constants";
import ReportAd from "@/components/ReportAd";

/* Sponsor placements. Ads sit beside the tool, never inside a supporter's photo, and
   links are rel="sponsored" so they pass no search ranking. */

function Logo({ src, size }: { src: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 border border-line bg-white/5 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/** Landing page: all five slots, empty ones invite a sponsor. */
export function SponsorBoard({ board, price }: { board: Slot[]; price: number }) {
  const empty = Math.max(0, SLOT_COUNT - board.length);
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {board.map((s) => (
          <li key={s.id} className="group relative col-span-2 flex border sm:col-span-1 border-line bg-bg-card hover:border-line-strong lg:flex-col">
            <a
              href={s.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="flex flex-1 items-center gap-3 p-3 lg:flex-col lg:items-start"
            >
              <Logo src={s.logo} size={44} />
              <span className="min-w-0 space-y-0.5">
                <span className="block truncate text-sm font-bold text-white group-hover:text-gold">{s.name}</span>
                <span className="line-clamp-2 block text-[12px] leading-snug text-gray-2">{s.tagline}</span>
              </span>
            </a>
            <span className="absolute right-2 top-2 font-mono text-[9px] text-gray-3">#{s.rank}</span>
            <ReportAd id={s.id} className="absolute bottom-1.5 right-2" />
          </li>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          // On phones two empty slots say enough; five dashed boxes would fill the screen.
          <li key={`empty-${i}`} className={i > 1 ? "max-sm:hidden" : ""}>
            <Link
              href="/sponsor"
              className="flex h-full min-h-[76px] items-center justify-center border border-dashed border-line px-3 py-4 text-center font-mono text-[10px] uppercase tracking-wider text-gray-3 hover:border-line-strong hover:text-gold"
            >
              Slot kosong · mulai ${MIN_TOTAL_USD}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-3">
        Lima slot, diperebutkan lewat lelang terbuka. Masuk papan sekarang mulai{" "}
        <span className="text-gray-1">${price} USDC</span>.{" "}
        <Link href="/sponsor" className="text-gold hover:text-gold-bright">
          Pasang iklan →
        </Link>
      </p>
    </div>
  );
}

/** Campaign page: one quiet row under the editor. */
export function SponsorStrip({ board }: { board: Slot[] }) {
  return (
    <aside aria-label="Sponsor" className="border-t border-line pt-4">
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-gray-3">
        <span>Sponsor · Bingkai tetap gratis berkat mereka</span>
        <Link href="/sponsor" className="hover:text-gold">
          Pasang iklan
        </Link>
      </div>
      {board.length === 0 ? (
        <Link
          href="/sponsor"
          className="block border border-dashed border-line px-3 py-3 text-center text-[12px] text-gray-3 hover:border-line-strong hover:text-gold"
        >
          Slot sponsor masih kosong. Tampilkan mereknya di sini mulai ${MIN_TOTAL_USD}.
        </Link>
      ) : (
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {board.map((s) => (
            <li key={s.id} className="group relative w-64 shrink-0 snap-start border border-line bg-bg-card hover:border-line-strong">
              <a
                href={s.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="flex items-center gap-2.5 p-2.5 pr-7"
              >
                <Logo src={s.logo} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-white group-hover:text-gold">{s.name}</span>
                  <span className="block truncate text-[11px] text-gray-2">{s.tagline}</span>
                </span>
              </a>
              <ReportAd id={s.id} className="absolute right-1.5 top-1.5" />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
