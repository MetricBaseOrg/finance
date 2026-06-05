import { requireUser } from "@/server/workspace";
import { db } from "@/server/db";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { Topnav } from "@/components/mb/Topnav";
import { ProfileEditForm } from "./ProfileEditForm";
import Link from "next/link";

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      accounts: { select: { provider: true } },
      memberships: {
        include: { workspace: { select: { slug: true, name: true } } },
      },
    },
  });
  if (!user) {
    return null;
  }
  return (
    <>
      <Topnav sectionLabel="Profile" />
      <main className="flex-1 px-4 sm:px-6 py-8 max-w-2xl mx-auto w-full">
        <div className="flex flex-col gap-8">
          <Link
            href="/app"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors self-start"
          >
            ← Back to app
          </Link>
          <header>
            <Eyebrow>Profile</Eyebrow>
            <div className="flex items-start gap-4 mt-2">
              {user.image && (
                <img
                  src={user.image}
                  alt="Profile avatar"
                  className="w-16 h-16 object-cover rounded-full flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-white">
                  Your account
                </h1>
                <p className="text-gray-2 text-sm mt-2">
                  Your name appears across MetricBase. Email is your sign-in
                  identifier and can&apos;t be changed here.
                </p>
              </div>
            </div>
          </header>

          <ProfileEditForm initialName={user.name ?? ""} initialImage={user.image} />

          <div className="mb-card p-6 flex flex-col gap-3">
            <Eyebrow>Account</Eyebrow>
            <div className="flex justify-between gap-3 border-b border-line pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
                Email
              </span>
              <span className="text-white text-sm break-all text-right">
                {user.email}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-b border-line pb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
                Sign-in providers
              </span>
              <span className="font-mono text-xs text-gold">
                {user.accounts.length > 0
                  ? user.accounts.map((a) => a.provider).join(", ")
                  : "Magic link"}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
                Member since
              </span>
              <span className="font-mono text-xs text-gray-2">
                {user.createdAt.toISOString().slice(0, 10)}
              </span>
            </div>
          </div>

          <div className="mb-card p-6 flex flex-col gap-3">
            <Eyebrow>Your workspaces</Eyebrow>
            <div className="flex flex-col">
              {user.memberships.map((m) => (
                <Link
                  key={m.id}
                  href={`/app/${m.workspace.slug}/dashboard`}
                  className="flex justify-between items-center py-3 border-b border-line last:border-b-0 hover:bg-[var(--color-bg-hover)] -mx-2 px-2 transition-colors"
                >
                  <span className="text-white">{m.workspace.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3">
                    {m.role} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
