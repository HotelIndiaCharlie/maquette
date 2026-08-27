/* shadcn/ui — vendored. Restyle via tokens/variants only (SPEC.md §3). */
import { Toaster as Sonner, type ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'font-ui text-sm bg-surface text-ink border border-border-hairline rounded-tool shadow-paper',
          description: 'text-ink-soft',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
          error: 'border-mark text-ink',
        },
      }}
      {...props}
    />
  );
}

export { toast } from 'sonner';
