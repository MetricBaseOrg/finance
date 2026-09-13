"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Salin tautan" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked; the link is visible to copy by hand */
        }
      }}
      className="border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-gold hover:bg-bg-hover"
    >
      {done ? "Tersalin ✓" : label}
    </button>
  );
}
