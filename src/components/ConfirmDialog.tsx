import { AlertCircle, X, Check, Trash2, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  inputValue?: string;
  onInputChange?: (val: string) => void;
  inputPlaceholder?: string;
  inputType?: string;
  icon?: React.ReactNode;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  inputValue,
  onInputChange,
  inputPlaceholder = 'Enter amount...',
  inputType = 'number',
  icon
}: ConfirmDialogProps) {
  if (!open) return null;

  const colors = {
    primary: 'bg-primary text-primary-foreground hover:shadow-primary/30',
    warning: 'bg-orange-500 text-white hover:shadow-orange-500/30',
    danger: 'bg-red-500 text-white hover:shadow-red-500/30'
  };

  const iconColors = {
    primary: 'text-primary bg-primary/10',
    warning: 'text-orange-500 bg-orange-500/10',
    danger: 'text-red-500 bg-red-500/10'
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-sm glass-card rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-all text-muted-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={cn("h-16 w-16 rounded-3xl flex items-center justify-center mb-6 animate-bounce-subtle", iconColors[variant])}>
            {icon ? icon : (variant === 'danger' ? <Trash2 className="h-8 w-8" /> : <AlertCircle className="h-8 w-8" />)}
          </div>

          <h3 className="text-xl font-black tracking-tight mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed px-2">
            {description}
          </p>

          {onInputChange && (
            <div className="w-full mt-6 px-2">
              <div className="relative group">
                <input 
                  type={inputType}
                  autoFocus
                  autoComplete="new-password"
                  placeholder={inputPlaceholder}
                  value={inputValue}
                  onChange={(e) => onInputChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/30"
                  onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 w-full mt-8">
            <button
              onClick={onClose}
              className="py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-all text-muted-foreground"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:-translate-y-1 active:translate-y-0",
                colors[variant]
              )}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
