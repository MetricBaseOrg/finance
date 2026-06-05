import { cn } from "@/lib/utils";

export function NavDiamond({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", className)}
      style={{
        width: size,
        height: size,
        transform: "rotate(45deg)",
        border: "1.5px solid var(--color-gold)",
        background: "rgba(201, 168, 76, 0.4)",
      }}
    />
  );
}
