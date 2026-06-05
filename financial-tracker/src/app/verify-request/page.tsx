import { Topnav } from "@/components/mb/Topnav";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { GoldButton } from "@/components/mb/GoldButton";
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <>
      <Topnav sectionLabel="Check your inbox" />
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <BunEmpty
            title="Check your inbox"
            description="We sent you a sign-in link. Click it from the same device — it expires in 10 minutes."
            action={
              <Link href="/">
                <GoldButton variant="ghost">← Back home</GoldButton>
              </Link>
            }
          />
        </div>
      </main>
    </>
  );
}
