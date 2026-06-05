import Link from "next/link";
import { NavDiamond } from "./NavDiamond";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { signOutAction } from "@/server/actions/auth";
import type { WorkspaceType } from "@prisma/client";

type Item = {
  slug: string;
  name: string;
  type: WorkspaceType;
  baseCurrency: string;
};

export function AppTopbar({
  current,
  workspaces,
  userEmail,
  alertCount = 0,
}: {
  current: Item;
  workspaces: Item[];
  userEmail?: string | null;
  alertCount?: number;
}) {
  return (
    <header className="shrink-0 z-40 border-b border-line bg-topbar-bg backdrop-blur-[10px]">
      <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">

        {/* Brand + workspace switcher */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="https://metricbase.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2.5 shrink-0"
            aria-label="MetricBase"
          >
            <NavDiamond size={20} />
            <span className="font-sans font-extrabold text-[15px] tracking-[-0.02em] text-white leading-none">
              Metric<span className="text-gold">BASE</span>
            </span>
          </Link>

          {/* Separator */}
          <span className="hidden md:block w-px h-5 bg-line shrink-0" />

          {/* App label */}
          <span className="hidden md:block font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3 shrink-0">
            Financial Tracker
          </span>

          {/* Separator */}
          <span className="hidden md:block w-px h-5 bg-line shrink-0" />

          <WorkspaceSwitcher current={current} workspaces={workspaces} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 md:gap-5">
          <ThemeToggle />
          {userEmail && (
            <Link
              href="/app/profile"
              className="font-mono text-[11px] text-gray-3 hover:text-gold transition-colors hidden md:inline tracking-[0.15em]"
            >
              {userEmail}
            </Link>
          )}
          <form action={signOutAction} className="hidden md:block">
            <button
              type="submit"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors"
            >
              Sign out
            </button>
          </form>
          <MobileNav workspaceSlug={current.slug} />
        </div>

      </div>
    </header>
  );
}
