import Link from "next/link";
import { redirect } from "next/navigation";
import { Topnav } from "@/components/mb/Topnav";
import { Eyebrow } from "@/components/mb/Eyebrow";
import { GoldButton } from "@/components/mb/GoldButton";
import { auth } from "@/server/auth";
import { signInWithEmail, signInWithGoogle } from "@/server/actions/auth";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <>
      <Topnav sectionLabel="Sign in" />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md mb-card p-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>Open Beta</Eyebrow>
            <h1 className="font-sans text-2xl font-extrabold text-white">
              Sign in to MetricBase
            </h1>
            <p className="text-sm text-gray-2">
              Enter your email — we&apos;ll send you a magic link. Or continue
              with Google.
            </p>
          </div>

          <form action={signInWithEmail} className="flex flex-col gap-3">
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

          <form action={signInWithGoogle}>
            <GoldButton type="submit" variant="outline" className="w-full">
              Continue with Google
            </GoldButton>
          </form>

          <p className="text-xs text-gray-3 text-center mt-2">
            By continuing you agree to the{" "}
            <Link
              href="https://metricbase.org/terms"
              className="text-gold hover:text-gold-bright"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="https://metricbase.org/privacy"
              className="text-gold hover:text-gold-bright"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
