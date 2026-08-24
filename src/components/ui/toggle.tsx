/* shadcn/ui — vendored. Restyle via tokens/variants only (SPEC.md §3). */
import * as React from 'react';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-tool font-ui text-sm font-medium text-ink-soft transition-colors hover:bg-desk-deep focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 data-[state=on]:bg-guide data-[state=on]:text-paper',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-border-hairline bg-surface',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5 text-xs',
        lg: 'h-10 min-w-10 px-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
