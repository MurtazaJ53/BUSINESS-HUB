import { Database } from '@/db/sqlite';
import { tableEvents } from '@/db/events';

export type BackupTrigger = 'manual' | 'scheduled' | 'close';

export interface BackupSettings {
  enabled: boolean;
  scheduledTime: string;
  retentionCount: number;
}

export interface BackupRecord {
  id: string;
  label: string;
  trigger: BackupTrigger;
  createdAt: number;
  sizeBytes: number;
}

export interface BackupPackage {
  version: 1;
  appVersion: string;
  createdAt: string;
  shopId: string | null;
  trigger: BackupTrigger;
  settings: BackupSettings;
  data: Record<string, unknown[]>;
  metadata: Record<string, unknown>;
}

const BACKUP_SETTINGS_KEY = 'backup_settings';
const LAST_BACKUP_KEY = 'last_backup_at';
const LAST_AUTO_BACKUP_KEY = 'last_auto_backup_at';

const TABLES_TO_BACKUP = [
  'inventory',
  'inventory_private',
  'sales',
  'sale_items',
  'sale_payments',
  'customers',
  'customer_payments',
  'expenses',
  'staff',
  'staff_private',
  'attendance',
  'daily_briefings',
  'sync_state',
  'outbox',
] as const;

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: true,
  scheduledTime: '18:00',
  retentionCount: 14,
};

const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return { ...fallback, ...JSON.parse(value) };
  } catch {
    return fallback;
  }
};

const formatBackupLabel = (date: Date, trigger: BackupTrigger) => {
  const triggerLabel = trigger === 'scheduled' ? 'Auto' : trigger === 'close' ? 'Close' : 'Manual';
  const dateLabel = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${triggerLabel} Backup - ${dateLabel} ${timeLabel}`;
};

const getStringSize = (value: string) => new TextEncoder().encode(value).length;

export const getBackupSettings = async (): Promise<BackupSettings> => {
  const rows = await Database.query<{ value: string }>(
    `SELECT value FROM shop_metadata WHERE key = ?;`,
    [BACKUP_SETTINGS_KEY],
  );
  return safeJsonParse(rows[0]?.value, DEFAULT_BACKUP_SETTINGS);
};

export const saveBackupSettings = async (settings: BackupSettings): Promise<void> => {
  const normalized: BackupSettings = {
    enabled: settings.enabled,
    scheduledTime: /^\d{2}:\d{2}$/.test(settings.scheduledTime) ? settings.scheduledTime : DEFAULT_BACKUP_SETTINGS.scheduledTime,
    retentionCount: Math.min(30, Math.max(3, Number(settings.retentionCount) || DEFAULT_BACKUP_SETTINGS.retentionCount)),
  };
  const ts = Date.now();
  await Database.run(
    `INSERT OR REPLACE INTO shop_metadata (key, value, updatedAt, dirty) VALUES (?, ?, ?, 0);`,
    [BACKUP_SETTINGS_KEY, JSON.stringify(normalized), ts],
  );
  tableEvents.emit(['shop_metadata', 'local_backups']);
};

export const listBackups = async (): Promise<BackupRecord[]> => {
  return Database.query<BackupRecord>(
    `SELECT id, label, trigger, createdAt, sizeBytes
     FROM local_backups
     ORDER BY createdAt DESC;`,
  );
};

export const getBackupPayload = async (id: string): Promise<string | null> => {
  const rows = await Database.query<{ payload: string }>(
    `SELECT payload FROM local_backups WHERE id = ?;`,
    [id],
  );
  return rows[0]?.payload ?? null;
};

export const deleteBackup = async (id: string): Promise<void> => {
  await Database.run(`DELETE FROM local_backups WHERE id = ?;`, [id]);
  tableEvents.emit('local_backups');
};

const pruneBackups = async (retain: number): Promise<void> => {
  const rows = await Database.query<{ id: string }>(
    `SELECT id FROM local_backups ORDER BY createdAt DESC;`,
  );
  const stale = rows.slice(retain);
  for (const row of stale) {
    await Database.run(`DELETE FROM local_backups WHERE id = ?;`, [row.id]);
  }
};

const getShopMetadata = async (): Promise<Record<string, unknown>> => {
  const rows = await Database.query<{ key: string; value: string; updatedAt: number }>(
    `SELECT key, value, updatedAt FROM shop_metadata WHERE key != ?;`,
    ['credentials'],
  );

  return rows.reduce<Record<string, unknown>>((acc, row) => {
    try {
      acc[row.key] = JSON.parse(row.value);
    } catch {
      acc[row.key] = row.value;
    }
    return acc;
  }, {});
};

const buildBackupPackage = async (trigger: BackupTrigger, settings: BackupSettings): Promise<BackupPackage> => {
  const { shopId } = (await import('@/lib/useBusinessStore')).useBusinessStore.getState();
  const dataEntries = await Promise.all(
    TABLES_TO_BACKUP.map(async (table) => {
      const rows = await Database.query<Record<string, unknown>>(`SELECT * FROM ${table};`);
      return [table, rows] as const;
    }),
  );

  const metadata = await getShopMetadata();

  return {
    version: 1,
    appVersion: '1.3.3',
    createdAt: new Date().toISOString(),
    shopId,
    trigger,
    settings,
    data: Object.fromEntries(dataEntries),
    metadata,
  };
};

export const createBackup = async (trigger: BackupTrigger = 'manual'): Promise<BackupRecord> => {
  const settings = await getBackupSettings();
  const packageData = await buildBackupPackage(trigger, settings);
  const payload = JSON.stringify(packageData);
  const createdAt = Date.now();
  const backup: BackupRecord = {
    id: `backup_${createdAt}`,
    label: formatBackupLabel(new Date(createdAt), trigger),
    trigger,
    createdAt,
    sizeBytes: getStringSize(payload),
  };

  await Database.run(
    `INSERT INTO local_backups (id, label, trigger, createdAt, sizeBytes, payload)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [backup.id, backup.label, backup.trigger, backup.createdAt, backup.sizeBytes, payload],
  );

  await Database.run(
    `INSERT OR REPLACE INTO shop_metadata (key, value, updatedAt, dirty) VALUES (?, ?, ?, 0);`,
    [LAST_BACKUP_KEY, JSON.stringify({ iso: new Date(createdAt).toISOString() }), createdAt],
  );

  if (trigger === 'scheduled' || trigger === 'close') {
    await Database.run(
      `INSERT OR REPLACE INTO shop_metadata (key, value, updatedAt, dirty) VALUES (?, ?, ?, 0);`,
      [LAST_AUTO_BACKUP_KEY, JSON.stringify({ iso: new Date(createdAt).toISOString() }), createdAt],
    );
  }

  await pruneBackups(settings.retentionCount);
  tableEvents.emit(['shop_metadata', 'local_backups']);
  return backup;
};

export const getLastBackupDate = async (): Promise<string | null> => {
  const rows = await Database.query<{ value: string }>(
    `SELECT value FROM shop_metadata WHERE key = ?;`,
    [LAST_BACKUP_KEY],
  );
  return safeJsonParse(rows[0]?.value, { iso: null as string | null }).iso;
};

export const maybeRunScheduledBackup = async (now = new Date()): Promise<BackupRecord | null> => {
  const settings = await getBackupSettings();
  if (!settings.enabled) return null;

  const [hour, minute] = settings.scheduledTime.split(':').map(Number);
  const scheduledAt = new Date(now);
  scheduledAt.setHours(hour || 0, minute || 0, 0, 0);

  if (now.getTime() < scheduledAt.getTime()) return null;

  const lastAutoRows = await Database.query<{ value: string }>(
    `SELECT value FROM shop_metadata WHERE key = ?;`,
    [LAST_AUTO_BACKUP_KEY],
  );
  const lastAutoIso = safeJsonParse(lastAutoRows[0]?.value, { iso: null as string | null }).iso;
  if (lastAutoIso && new Date(lastAutoIso).toDateString() === now.toDateString()) {
    return null;
  }

  return createBackup('scheduled');
};
