import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
        secondary: 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-200',
        destructive: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
        success: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
        warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
        outline: 'border border-gray-200 text-gray-700 dark:border-slate-600 dark:text-slate-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
