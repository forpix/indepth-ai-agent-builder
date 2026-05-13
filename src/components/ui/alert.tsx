import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]',
  {
    variants: {
      tone: {
        info: 'border-border bg-bg text-text',
        warning: 'border-warning/30 bg-warning/10 text-text',
        danger: 'border-danger/30 bg-danger/10 text-text',
        success: 'border-success/30 bg-success/10 text-text',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, tone, ...props }, ref) => (
    <div ref={ref} className={cn(alertVariants({ tone }), className)} {...props} />
  ),
);
Alert.displayName = 'Alert';
