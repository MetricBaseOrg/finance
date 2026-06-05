import Link from "next/link";
import { NavDiamond } from "./NavDiamond";

export function Topnav({ sectionLabel }: { sectionLabel?: string }) {
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-[var(--color-bg-elev)]/94 backdrop-blur-[10px]">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <NavDiamond size={28} />
          <span className="font-sans text-base font-extrabold tracking-tight">
            Metric<span className="text-gold">BASE</span>
          </span>
          {sectionLabel && (
            <span className="hidden md:inline-block ml-3 pl-3 border-l border-line font-mono text-[10px] uppercase tracking-[0.25em] text-gray-2">
              {sectionLabel}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/sign-in"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-in"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-black bg-gold hover:bg-gold-bright px-4 py-2 transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
