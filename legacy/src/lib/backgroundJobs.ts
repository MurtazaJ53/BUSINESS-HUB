import { addDoc, collection, doc, serverTimestamp, setDoc, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export type ImportFlowType = 'inventory' | 'customer' | 'sale';

export interface BackgroundJobRecord {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  importId?: string;
  itemCount?: number;
  batchIndex?: number;
  totalBatches?: number;
  errorSummary?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export interface ImportRunRecord {
  id: string;
  importType: ImportFlowType;
  status: 'queued' | 'running' | 'finalizing' | 'completed' | 'failed';
  provider: string;
  filesProcessed: number;
  totalItems: number;
  totalJobs: number;
  dataJobCount: number;
  completedJobs: number;
  completedDataJobs: number;
  failedJobs: number;
  processedItems: number;
  postProcessQueued?: boolean;
  startedAt?: unknown;
  finishedAt?: unknown;
  errorSummary?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
};

const jobTypeByImportType: Record<ImportFlowType, string> = {
  inventory: 'IMPORT_INVENTORY_BATCH',
  customer: 'IMPORT_CUSTOMERS_BATCH',
  sale: 'IMPORT_SALES_BATCH',
};

const chunkSizeByImportType: Record<ImportFlowType, number> = {
  inventory: 75,
  customer: 75,
  sale: 10,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object'
  && value !== null
  && Object.getPrototypeOf(value) === Object.prototype
);

export const sanitizeFirestoreValue = <T>(value: T): T => {
  if (value === undefined) {
    return undefined as T;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeFirestoreValue(entry))
      .filter((entry) => entry !== undefined) as T;
  }

  if (isPlainObject(value)) {
    const sanitizedEntries = Object.entries(value).flatMap(([key, entry]) => {
      const sanitized = sanitizeFirestoreValue(entry);
      return sanitized === undefined ? [] : [[key, sanitized] as const];
    });

    return Object.fromEntries(sanitizedEntries) as T;
  }

  return value;
};

export async function enqueueImportRun(options: {
  shopId: string;
  userId: string;
  userEmail?: string | null;
  type: ImportFlowType;
  provider: string;
  filesProcessed: number;
  items: any[];
}): Promise<{ importId: string; totalJobs: number }> {
  const { shopId, userId, userEmail, type, provider, filesProcessed, items } = options;
  const importRef = doc(collection(db, 'shops', shopId, 'imports'));
  const importId = importRef.id;
  const sanitizedItems = sanitizeFirestoreValue(items);
  const chunks = chunk(sanitizedItems, chunkSizeByImportType[type]);
  const totalJobs = chunks.length;

  await setDoc(importRef, {
    importType: type,
    status: 'queued',
    provider,
    filesProcessed,
    totalItems: sanitizedItems.length,
    totalJobs,
    dataJobCount: totalJobs,
    completedJobs: 0,
    completedDataJobs: 0,
    failedJobs: 0,
    processedItems: 0,
    postProcessQueued: false,
    createdBy: userId,
    createdByEmail: userEmail || 'unknown',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const jobResults = await Promise.allSettled(
    chunks.map((records, index) => addDoc(collection(db, 'shops', shopId, 'jobs'), {
      type: jobTypeByImportType[type],
      status: 'queued',
      progress: 0,
      importId,
      importType: type,
      batchIndex: index + 1,
      totalBatches: totalJobs,
      itemCount: records.length,
      createdBy: userId,
      createdByEmail: userEmail || 'unknown',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      payload: sanitizeFirestoreValue(type === 'sale'
        ? { sales: records }
        : { items: records }),
    })),
  );

  const failedJobWrites = jobResults.filter((result) => result.status === 'rejected');
  if (failedJobWrites.length > 0) {
    const primaryError = failedJobWrites[0].reason instanceof Error
      ? failedJobWrites[0].reason
      : new Error(String(failedJobWrites[0].reason));

    await setDoc(importRef, {
      status: 'failed',
      failedJobs: failedJobWrites.length,
      errorSummary: primaryError.message,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    throw primaryError;
  }

  return { importId, totalJobs };
}

export const mapBackgroundJob = (docSnap: QueryDocumentSnapshot): BackgroundJobRecord => ({
  id: docSnap.id,
  ...(docSnap.data() as Omit<BackgroundJobRecord, 'id'>),
});

export const mapImportRun = (docSnap: QueryDocumentSnapshot): ImportRunRecord => ({
  id: docSnap.id,
  ...(docSnap.data() as Omit<ImportRunRecord, 'id'>),
});
