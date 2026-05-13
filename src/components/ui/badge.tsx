import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
  {
    variants: {
      tone: {
        default: 'border-border bg-bg text-muted',
        primary: 'border-primary/20 bg-primary/10 text-primary',
        accent: 'border-accent/20 bg-accent/10 text-accent',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-[#92400E]',
        danger: 'border-danger/30 bg-danger/10 text-danger',
      },
    },
    defaultVariants: { tone: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
