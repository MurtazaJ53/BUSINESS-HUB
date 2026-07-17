import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { Database } from '@/db/sqlite';
import { tableEvents } from '@/db/events';
import { auth, db, storage } from '@/lib/firebase';
import { SyncWorker } from '@/sync/SyncWorker';

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

export interface CloudBackupRecord extends BackupRecord {
  appVersion: string;
  backupVersion: number;
  checksum: string;
  shopId: string;
  storagePath: string;
  uploadedAt: number;
  uploadedBy: string | null;
}

export interface BackupIntegrity {
  algorithm: 'SHA-256';
  checksum: string;
  rowCounts: Record<string, number>;
  totalRows: number;
}

export interface BackupPackage {
  version: 2;
  appVersion: string;
  createdAt: string;
  shopId: string | null;
  trigger: BackupTrigger;
  settings: BackupSettings;
  clientState: Record<string, string | null>;
  data: Record<string, Record<string, unknown>[]>;
  integrity: BackupIntegrity;
}

export interface RestoreSummary {
  backupId: string;
  createdAt: string;
  checksum: string;
  tableCounts: Record<string, number>;
  totalRows: number;
}

type MutableBackupPackage = Omit<BackupPackage, 'integrity'>;

const APP_VERSION = '1.3.3';
const BACKUP_VERSION = 2;
const BACKUP_SETTINGS_KEY = 'backup_settings';
const LAST_BACKUP_KEY = 'last_backup_at';
const LAST_AUTO_BACKUP_KEY = 'last_auto_backup_at';
const CLOUD_BACKUPS_COLLECTION = 'backup_archives';

const CLIENT_STATE_KEYS = [
  'hub_theme',
  'hub_is_locked',
  'biz_shop_settings',
] as const;

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
  'shop_metadata',
  'sync_state',
  'outbox',
] as const;

const TABLES_TO_CLEAR = [...TABLES_TO_BACKUP].reverse();

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  enabled: true,
  scheduledTime: '18:00',
  retentionCount: 14,
};

const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)
      ? { ...fallback, ...parsed }
      : parsed;
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

const stableCopy = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => stableCopy(entry));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stableCopy(entry)]);
    return Object.fromEntries(entries);
  }

  return value;
};

const stableStringify = (value: unknown): string => JSON.stringify(stableCopy(value));

const rowCountsForData = (data: Record<string, unknown[]>) => {
  const rowCounts = Object.fromEntries(
    Object.entries(data).map(([table, rows]) => [table, rows.length]),
  );
  const totalRows = Object.values(rowCounts).reduce((sum, count) => sum + count, 0);
  return { rowCounts, totalRows };
};

const computeChecksum = async (payload: MutableBackupPackage): Promise<BackupIntegrity> => {
  const source = stableStringify(payload);
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const checksum = Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const { rowCounts, totalRows } = rowCountsForData(payload.data);
  return {
    algorithm: 'SHA-256',
    checksum,
    rowCounts,
    totalRows,
  };
};

const normalizeBackupRow = (row: Record<string, unknown>): Record<string, unknown> => (
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === undefined ? null : value]),
  )
);

const buildInsertStatement = (table: string, row: Record<string, unknown>) => {
  const normalized = normalizeBackupRow(row);
  const columns = Object.keys(normalized);
  if (!columns.length) {
    throw new Error(`Backup row for "${table}" is empty.`);
  }
  const placeholders = columns.map(() => '?').join(', ');
  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders});`,
    params: columns.map((column) => normalized[column]),
  };
};

const toCloudBackupRecord = (snapshotId: string, data: DocumentData): CloudBackupRecord => ({
  id: snapshotId,
  label: data.label,
  trigger: data.trigger,
  createdAt: data.createdAt,
  sizeBytes: data.sizeBytes,
  appVersion: data.appVersion,
  backupVersion: data.backupVersion,
  checksum: data.checksum,
  shopId: data.shopId,
  storagePath: data.storagePath,
  uploadedAt: data.uploadedAt,
  uploadedBy: data.uploadedBy ?? null,
});

const migrateLegacyBackup = (legacy: any): BackupPackage => {
  const fallbackCreatedAt = legacy?.createdAt && !Number.isNaN(Date.parse(legacy.createdAt))
    ? new Date(legacy.createdAt).getTime()
    : Date.now();

  const legacyMetadataRows = Object.entries(legacy?.metadata ?? {}).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value),
    updatedAt: fallbackCreatedAt,
    dirty: 0,
  }));

  const data: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES_TO_BACKUP) {
    if (table === 'shop_metadata') {
      data[table] = legacyMetadataRows;
      continue;
    }
    data[table] = Array.isArray(legacy?.data?.[table])
      ? legacy.data[table].map((row: any) => normalizeBackupRow(row))
      : [];
  }

  const migrated: MutableBackupPackage = {
    version: BACKUP_VERSION,
    appVersion: legacy?.appVersion || APP_VERSION,
    createdAt: legacy?.createdAt || new Date(fallbackCreatedAt).toISOString(),
    shopId: legacy?.shopId ?? null,
    trigger: legacy?.trigger === 'scheduled' || legacy?.trigger === 'close' ? legacy.trigger : 'manual',
    settings: safeJsonParse(JSON.stringify(legacy?.settings ?? {}), DEFAULT_BACKUP_SETTINGS),
    clientState: {},
    data,
  };

  return {
    ...migrated,
    integrity: {
      algorithm: 'SHA-256',
      checksum: '',
      ...rowCountsForData(migrated.data),
    },
  };
};

const normalizeBackupPackage = async (raw: unknown): Promise<BackupPackage> => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Backup file is not a valid JSON object.');
  }

  const legacy = raw as any;
  if (legacy.version === 1) {
    return migrateLegacyBackup(legacy);
  }

  if (legacy.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(legacy.version ?? 'unknown')}.`);
  }

  const normalizedData: Record<string, Record<string, unknown>[]> = {};
  for (const table of TABLES_TO_BACKUP) {
    const rows = legacy?.data?.[table];
    normalizedData[table] = Array.isArray(rows)
      ? rows.map((row: any) => {
          if (!row || typeof row !== 'object' || Array.isArray(row)) {
            throw new Error(`Backup table "${table}" contains an invalid row.`);
          }
          return normalizeBackupRow(row);
        })
      : [];
  }

  const settings = safeJsonParse(JSON.stringify(legacy.settings ?? {}), DEFAULT_BACKUP_SETTINGS);
  const clientState = Object.fromEntries(
    CLIENT_STATE_KEYS.map((key) => [key, legacy?.clientState?.[key] ?? null]),
  );

  const mutablePayload: MutableBackupPackage = {
    version: BACKUP_VERSION,
    appVersion: typeof legacy.appVersion === 'string' ? legacy.appVersion : APP_VERSION,
    createdAt: typeof legacy.createdAt === 'string' ? legacy.createdAt : new Date().toISOString(),
    shopId: typeof legacy.shopId === 'string' ? legacy.shopId : null,
    trigger: legacy.trigger === 'scheduled' || legacy.trigger === 'close' ? legacy.trigger : 'manual',
    settings,
    clientState,
    data: normalizedData,
  };

  const expectedIntegrity = await computeChecksum(mutablePayload);
  const providedChecksum = legacy?.integrity?.checksum;
  if (typeof providedChecksum === 'string' && providedChecksum && providedChecksum !== expectedIntegrity.checksum) {
    throw new Error('Backup checksum verification failed. The file may be incomplete or modified.');
  }

  return {
    ...mutablePayload,
    integrity: {
      ...expectedIntegrity,
      checksum: typeof providedChecksum === 'string' && providedChecksum
        ? providedChecksum
        : expectedIntegrity.checksum,
    },
  };
};

const fetchClientState = (): Record<string, string | null> => (
  Object.fromEntries(CLIENT_STATE_KEYS.map((key) => [key, localStorage.getItem(key)]))
);

const buildBackupPackage = async (trigger: BackupTrigger, settings: BackupSettings): Promise<BackupPackage> => {
  const { shopId } = (await import('@/lib/useBusinessStore')).useBusinessStore.getState();
  const dataEntries = await Promise.all(
    TABLES_TO_BACKUP.map(async (table) => {
      const rows = await Database.query<Record<string, unknown>>(`SELECT * FROM ${table};`);
      return [table, rows.map((row) => normalizeBackupRow(row))] as const;
    }),
  );

  const payload: MutableBackupPackage = {
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    shopId,
    trigger,
    settings,
    clientState: fetchClientState(),
    data: Object.fromEntries(dataEntries),
  };

  const integrity = await computeChecksum(payload);
  return {
    ...payload,
    integrity,
  };
};

const persistBackupRecord = async (backup: BackupRecord, payload: string) => {
  await Database.run(
    `INSERT INTO local_backups (id, label, trigger, createdAt, sizeBytes, payload)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [backup.id, backup.label, backup.trigger, backup.createdAt, backup.sizeBytes, payload],
  );
};

const getCloudBackupDocRef = (shopId: string, backupId: string) => (
  doc(db, 'shops', shopId, CLOUD_BACKUPS_COLLECTION, backupId)
);

const getCloudBackupStoragePath = (shopId: string, backupId: string) => (
  `shops/${shopId}/${CLOUD_BACKUPS_COLLECTION}/${backupId}.json`
);

const getCloudBackupStorageRef = (shopId: string, backupId: string) => (
  ref(storage, getCloudBackupStoragePath(shopId, backupId))
);

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

export const listBackups = async (): Promise<BackupRecord[]> => (
  Database.query<BackupRecord>(
    `SELECT id, label, trigger, createdAt, sizeBytes
     FROM local_backups
     ORDER BY createdAt DESC;`,
  )
);

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

  await persistBackupRecord(backup, payload);

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

export const parseBackupPayload = async (payload: string): Promise<BackupPackage> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  return normalizeBackupPackage(parsed);
};

export const restoreBackupFromPayload = async (payload: string): Promise<RestoreSummary> => {
  const backupPackage = await parseBackupPayload(payload);

  await Database.boot();
  SyncWorker.stop();

  const stmts: Array<{ sql: string; params?: any[] }> = [];
  for (const table of TABLES_TO_CLEAR) {
    stmts.push({ sql: `DELETE FROM ${table};` });
  }

  for (const table of TABLES_TO_BACKUP) {
    const rows = backupPackage.data[table] ?? [];
    for (const row of rows) {
      stmts.push(buildInsertStatement(table, row));
    }
  }

  await Database.transaction(stmts);
  await Database.flush();

  for (const key of CLIENT_STATE_KEYS) {
    const value = backupPackage.clientState[key];
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }

  const verificationResults = await Promise.all(
    TABLES_TO_BACKUP.map(async (table) => {
      const rows = await Database.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table};`);
      return [table, rows[0]?.cnt ?? 0] as const;
    }),
  );
  const verificationCounts = Object.fromEntries(verificationResults);
  for (const [table, expected] of Object.entries(backupPackage.integrity.rowCounts)) {
    if ((verificationCounts[table] ?? 0) !== expected) {
      throw new Error(`Restore verification failed for table "${table}". Expected ${expected} rows, found ${verificationCounts[table] ?? 0}.`);
    }
  }

  tableEvents.emit([
    ...TABLES_TO_BACKUP,
    'local_backups',
  ]);

  return {
    backupId: backupPackage.createdAt,
    createdAt: backupPackage.createdAt,
    checksum: backupPackage.integrity.checksum,
    tableCounts: backupPackage.integrity.rowCounts,
    totalRows: backupPackage.integrity.totalRows,
  };
};

export const uploadLocalBackupToCloud = async (backupId: string): Promise<CloudBackupRecord> => {
  const payload = await getBackupPayload(backupId);
  if (!payload) {
    throw new Error('Backup package not found.');
  }

  const backupPackage = await parseBackupPayload(payload);
  const shopId = backupPackage.shopId;
  if (!shopId) {
    throw new Error('Backup is missing a shop context and cannot be uploaded to cloud.');
  }

  const localBackups = await listBackups();
  const backup = localBackups.find((entry) => entry.id === backupId);
  if (!backup) {
    throw new Error('Local backup metadata not found.');
  }

  const storageRef = getCloudBackupStorageRef(shopId, backupId);
  await uploadBytes(storageRef, new Blob([payload], { type: 'application/json' }), {
    contentType: 'application/json',
    customMetadata: {
      backupId,
      checksum: backupPackage.integrity.checksum,
      shopId,
    },
  });

  const record: CloudBackupRecord = {
    ...backup,
    appVersion: backupPackage.appVersion,
    backupVersion: backupPackage.version,
    checksum: backupPackage.integrity.checksum,
    shopId,
    storagePath: storageRef.fullPath,
    uploadedAt: Date.now(),
    uploadedBy: auth.currentUser?.uid ?? null,
  };

  await setDoc(getCloudBackupDocRef(shopId, backupId), record);
  return record;
};

export const createCloudBackup = async (): Promise<CloudBackupRecord> => {
  const backup = await createBackup('manual');
  return uploadLocalBackupToCloud(backup.id);
};

export const listCloudBackups = async (shopId: string): Promise<CloudBackupRecord[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'shops', shopId, CLOUD_BACKUPS_COLLECTION),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((entry) => toCloudBackupRecord(entry.id, entry.data()));
};

export const getCloudBackupPayload = async (shopId: string, backupId: string): Promise<string> => {
  const url = await getDownloadURL(getCloudBackupStorageRef(shopId, backupId));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cloud backup download failed with status ${response.status}.`);
  }
  return response.text();
};

export const deleteCloudBackup = async (shopId: string, backupId: string): Promise<void> => {
  await Promise.all([
    deleteObject(getCloudBackupStorageRef(shopId, backupId)),
    deleteDoc(getCloudBackupDocRef(shopId, backupId)),
  ]);
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
