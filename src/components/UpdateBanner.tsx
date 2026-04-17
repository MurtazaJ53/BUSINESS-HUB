import React from 'react';
import { Download, X, Sparkles, ChevronRight } from 'lucide-react';
import { UpdateMetadata } from '../hooks/useUpdateCheck';
import { cn } from '../lib/utils';

interface UpdateBannerProps {
  metadata: UpdateMetadata;
  onClose: () => void;
}

export default function UpdateBanner({ metadata, onClose }: UpdateBannerProps) {
  return (
    <div className="fixed top-20 left-4 right-4 z-[100] animate-in slide-in-from-top-10 duration-500">
      <div className="glass-card bg-primary/95 text-white p-4 rounded-3xl shadow-2xl shadow-primary/30 flex items-center justify-between gap-4 border border-white/20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">New Version Available</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-[9px] font-black uppercase tracking-widest">v{metadata.version}</span>
            </div>
            <p className="text-sm font-bold tracking-tight mt-0.5 line-clamp-1">
              {metadata.notes}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a 
            href={metadata.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/90 transition-all flex items-center gap-2 shadow-lg"
          >
            Update Now <Download className="h-3 w-3" />
          </a>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Visual Indicator of Progress */}
      <div className="mt-2 flex justify-center">
        <div className="px-4 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-xl flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground">System Ready for Patching</p>
          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-50" />
        </div>
      </div>
    </div>
  );
}
