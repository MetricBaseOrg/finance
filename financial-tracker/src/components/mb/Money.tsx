import { cn } from "@/lib/utils";
import { formatMoney, type DecimalLike } from "@/lib/money";

export function Money({
  value,
  currency,
  compact,
  sign,
  className,
}: {
  value: DecimalLike;
  currency: string;
  compact?: boolean;
  sign?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("mono", className)}>
      {formatMoney(value, currency, { compact, sign })}
    </span>
  );
}
