/**
 * SyncStatusBadge — Visual indicator for sync state
 * 
 * Shows a color-coded dot + label in the header:
 *   🟢 Synced — all changes pushed to cloud
 *   🟡 Syncing — actively pushing/pulling
 *   🔴 Offline — no network, working locally
 *   ⚠️ Error — sync failure (will auto-retry)
 */

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, AlertTriangle, Check } from 'lucide-react';
import { SyncWorker, type SyncStatus } from '../sync/SyncWorker';
import { cn } from '../lib/utils';

export default function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>(SyncWorker.status);

  useEffect(() => {
    const unsub = SyncWorker.onStatusChange(setStatus);
    return () => { unsub(); };
  }, []);

  const config: Record<SyncStatus, { icon: React.ElementType; label: string; color: string; bg: string }> = {
    idle: { icon: Check, label: 'Synced', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    syncing: { icon: Loader2, label: 'Syncing', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
    offline: { icon: CloudOff, label: 'Offline', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
    error: { icon: AlertTriangle, label: 'Sync Error', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  };

  const { icon: Icon, label, color, bg } = config[status];

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all duration-500",
      bg, color
    )}>
      <Icon className={cn("h-3 w-3", status === 'syncing' && 'animate-spin')} />
      <span>{label}</span>
    </div>
  );
}
