import { useEffect } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CircleAlert,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizePopupMessage, useAppPopupStore } from '@/lib/popup';

const variantStyles = {
  info: {
    icon: BellRing,
    shell: 'border-primary/20 bg-card/95',
    iconWrap: 'bg-primary/12 text-primary',
    eyebrow: 'text-primary',
    button: 'bg-primary text-primary-foreground hover:brightness-110',
  },
  success: {
    icon: BadgeCheck,
    shell: 'border-emerald-500/20 bg-card/95',
    iconWrap: 'bg-emerald-500/12 text-emerald-400',
    eyebrow: 'text-emerald-400',
    button: 'bg-emerald-500 text-white hover:brightness-110',
  },
  warning: {
    icon: AlertTriangle,
    shell: 'border-amber-500/20 bg-card/95',
    iconWrap: 'bg-amber-500/12 text-amber-400',
    eyebrow: 'text-amber-400',
    button: 'bg-amber-500 text-slate-950 hover:brightness-110',
  },
  error: {
    icon: CircleAlert,
    shell: 'border-red-500/20 bg-card/95',
    iconWrap: 'bg-red-500/12 text-red-400',
    eyebrow: 'text-red-400',
    button: 'bg-red-500 text-white hover:brightness-110',
  },
} as const;

export default function AppPopupHost() {
  const popup = useAppPopupStore((state) => state.current);
  const closePopup = useAppPopupStore((state) => state.closePopup);
  const showPopup = useAppPopupStore((state) => state.showPopup);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalAlert = window.alert.bind(window);

    window.alert = (message?: unknown) => {
      showPopup({
        title: 'System Notice',
        message: normalizePopupMessage(message),
        variant: 'warning',
        confirmText: 'Close',
      });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showPopup]);

  useEffect(() => {
    if (!popup) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        closePopup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [popup, closePopup]);

  if (!popup) return null;

  const styles = variantStyles[popup.variant];
  const Icon = styles.icon;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <button
        aria-label="Close popup"
        className="absolute inset-0 bg-background/82 backdrop-blur-md"
        onClick={closePopup}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-popup-title"
        aria-describedby="app-popup-message"
        className={cn(
          'relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border shadow-2xl animate-in fade-in zoom-in-95 duration-200',
          styles.shell
        )}
      >
        <button
          onClick={closePopup}
          className="absolute right-5 top-5 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Dismiss popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7 sm:p-8">
          <div className="mb-6 flex items-start gap-4 pr-10">
            <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', styles.iconWrap)}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className={cn('text-[10px] font-black uppercase tracking-[0.28em]', styles.eyebrow)}>
                Business Hub Alert
              </p>
              <h2 id="app-popup-title" className="mt-2 text-2xl font-black tracking-tight text-foreground">
                {popup.title}
              </h2>
            </div>
          </div>

          <p
            id="app-popup-message"
            className="rounded-[1.5rem] border border-border/60 bg-background/40 px-5 py-4 text-sm font-medium leading-relaxed text-muted-foreground"
          >
            {popup.message}
          </p>

          <div className="mt-6 flex justify-end">
            <button
              autoFocus
              onClick={closePopup}
              className={cn(
                'min-w-28 rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.22em] shadow-lg transition-all active:scale-95',
                styles.button
              )}
            >
              {popup.confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
