"use client";

import { useState } from "react";

/** Small "report this ad" flag. Five distinct reporters hide the ad until review. */
export default function ReportAd({ id, className = "" }: { id: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ask" | "done">("idle");

  const send = async () => {
    setState("done");
    await fetch("/api/sponsor/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  };

  if (state === "done") {
    return <span className={`${className} font-mono text-[9px] text-gray-3`}>Dilaporkan</span>;
  }
  if (state === "ask") {
    return (
      <span className={`${className} flex items-center gap-1 bg-bg-elev px-1 font-mono text-[9px]`}>
        <button type="button" onClick={send} className="text-down hover:underline">
          Laporkan?
        </button>
        <button type="button" onClick={() => setState("idle")} className="text-gray-3">
          ✕
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setState("ask")}
      title="Laporkan iklan ini"
      aria-label="Laporkan iklan ini"
      className={`${className} font-mono text-[10px] leading-none text-gray-4 hover:text-down`}
    >
      ⚑
    </button>
  );
}
