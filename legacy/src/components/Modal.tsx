import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      <div 
        className={`relative z-10 w-full ${wide ? 'max-w-4xl' : 'max-w-md'} glass-card rounded-3xl flex flex-col max-h-[90vh] border-primary/20 animate-in zoom-in slide-in-from-bottom-4 duration-300`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h2 className="font-black text-xl">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-xl transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
