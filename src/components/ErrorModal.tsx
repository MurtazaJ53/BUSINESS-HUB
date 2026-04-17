import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export default function ErrorModal({ isOpen, title, message, onClose }: ErrorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Dialogue Content */}
      <div className="relative z-10 w-full max-w-sm glass-card rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 border border-red-500/20">
        <div className="bg-red-500/10 p-8 flex flex-col items-center text-center">
          <div className="h-16 w-16 bg-red-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/20 mb-6">
            <AlertTriangle className="h-8 w-8" />
          </div>
          
          <h2 className="text-xl font-black text-red-500 uppercase tracking-widest mb-2">
            {title}
          </h2>
          
          <p className="text-sm font-bold text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>

        <div className="p-6 bg-card">
          <button
            onClick={onClose}
            className="w-full py-4 bg-accent hover:bg-red-500 hover:text-white rounded-2xl font-black text-sm transition-all uppercase tracking-[0.2em] shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
