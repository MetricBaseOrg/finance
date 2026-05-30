import Link from "next/link";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { GoldButton } from "@/components/mb/GoldButton";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { AcceptInviteForm } from "./AcceptInviteForm";
import { inviteSignInWithEmail, inviteSignInWithGoogle } from "./actions";

function Shell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-6">
        <span
          className="inline-block h-7 w-7 rotate-45 border border-[var(--gold)]"
          style={{ background: "rgba(201,168,76,0.4)" }}
        />
        <span className="text-base font-extrabold tracking-tight">
          Metric<span className="text-[var(--gold)]">BASE</span>
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--muted)]">
          {label}
        </span>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg">{children}</div>
      </div>
    </main>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  const invite = await db.orgInvite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite) {
    return (
      <Shell label="Invite">
        <BunEmpty
          title="This invite link is invalid"
          description="The link may have been mistyped or revoked. Ask an admin for a new one."
          action={
            <Link href="/">
              <GoldButton variant="primary">← Home</GoldButton>
            </Link>
          }
        />
      </Shell>
    );
  }

  const expired = invite.expiresAt.getTime() <= new Date().getTime();

  if (!session?.user) {
    if (expired) {
      return (
        <Shell label="Invite">
          <BunEmpty
            title="This invite has expired"
            description="Ask an admin to send you a fresh invite link."
          />
        </Shell>
      );
    }
    const emailAction = inviteSignInWithEmail.bind(null, token);
    const googleAction = inviteSignInWithGoogle.bind(null, token);
    return (
      <Shell label="Invite">
        <div className="mb-card p-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>You&apos;re invited</Eyebrow>
            <h1 className="font-sans text-2xl font-extrabold text-white">
              Join {invite.organization.name}
            </h1>
            <p className="text-sm text-gray-2">
              Sign in to accept this {invite.role.toLowerCase()} invite. We&apos;ll
              bring you right back here.
            </p>
          </div>
          <form action={emailAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-2">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder="you@company.com"
                className="mb-input"
                autoComplete="email"
                defaultValue={invite.email ?? ""}
              />
            </label>
            <GoldButton type="submit" variant="primary">
              Send magic link
            </GoldButton>
          </form>
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-line" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
              or
            </span>
            <span className="flex-1 h-px bg-line" />
          </div>
          <form action={googleAction}>
            <GoldButton type="submit" variant="outline" className="w-full">
              Continue with Google
            </GoldButton>
          </form>
        </div>
      </Shell>
    );
  }

  const alreadyMember = await db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: invite.organizationId,
      },
    },
  });

  if (alreadyMember) {
    return (
      <Shell label="Invite">
        <BunEmpty
          title="You're already a member"
          description={`You already have access to ${invite.organization.name}.`}
          action={
            <Link href={`/finance/${invite.organization.slug}/dashboard`}>
              <GoldButton variant="primary">→ Go to workspace</GoldButton>
            </Link>
          }
        />
      </Shell>
    );
  }

  if (expired) {
    return (
      <Shell label="Invite">
        <BunEmpty
          title="This invite has expired"
          description="Ask an admin to send you a fresh invite link."
        />
      </Shell>
    );
  }

  if (invite.acceptedAt) {
    return (
      <Shell label="Invite">
        <BunEmpty
          title="This invite has already been used"
          description="Ask an admin for a new link if you still need access."
        />
      </Shell>
    );
  }

  if (
    invite.email &&
    invite.email !== (session.user.email ?? "").toLowerCase()
  ) {
    return (
      <Shell label="Invite">
        <BunEmpty
          title="This invite is for a different email"
          description={`It was issued for ${invite.email}. Sign in with that address to accept it.`}
        />
      </Shell>
    );
  }

  return (
    <Shell label="Invite">
      <div className="mb-card p-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Eyebrow>You&apos;re invited</Eyebrow>
          <h1 className="font-sans text-2xl font-extrabold text-white">
            Join {invite.organization.name}
          </h1>
          <p className="text-sm text-gray-2">
            You&apos;ll join as{" "}
            <span className="text-gold font-mono">{invite.role}</span> using{" "}
            <span className="text-gold font-mono">{session.user.email}</span>.
          </p>
        </div>
        <AcceptInviteForm token={token} />
      </div>
    </Shell>
  );
}
