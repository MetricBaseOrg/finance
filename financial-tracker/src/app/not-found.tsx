import Link from "next/link";
import { Topnav } from "@/components/mb/Topnav";
import { BunEmpty } from "@/components/mb/BunEmpty";
import { GoldButton } from "@/components/mb/GoldButton";

export default function NotFound() {
  return (
    <>
      <Topnav sectionLabel="Not found · 404" />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg">
          <BunEmpty
            title="Bun can't find this page"
            description="The link is broken or the page never existed. Head back to the dashboard."
            action={
              <Link href="/">
                <GoldButton variant="primary">← Home</GoldButton>
              </Link>
            }
          />
        </div>
      </main>
    </>
  );
}
