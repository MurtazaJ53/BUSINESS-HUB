import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { rebuildCustomerCreditSummaries, rebuildDashboardSnapshot, rebuildPayrollSummaries } from "./summaries";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

type JobStatus = "queued" | "running" | "completed" | "failed";
type JobType =
  | "REBUILD_DASHBOARD"
  | "REBUILD_CUSTOMER_CREDITS"
  | "REBUILD_CUSTOMER_TOTALS_FROM_SALES"
  | "REBUILD_PAYROLL_SUMMARIES"
  | "IMPORT_INVENTORY_BATCH"
  | "IMPORT_CUSTOMERS_BATCH"
  | "IMPORT_SALES_BATCH";

type ImportType = "inventory" | "customer" | "sale";

const db = admin.firestore();

const setJobState = async (
  ref: FirebaseFirestore.DocumentReference,
  status: JobStatus,
  extra: Record<string, unknown> = {},
) => {
  await ref.set({
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  }, { merge: true });
};

const chunkArray = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const claimQueuedJob = async (ref: FirebaseFirestore.DocumentReference) => {
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return false;
    const data = snapshot.data() || {};
    if (data.status !== "queued") return false;
    tx.set(ref, {
      status: "running",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
};

const rebuildCustomerTotalsFromSales = async (shopId: string) => {
  const [customerSnapshot, salesSnapshot] = await Promise.all([
    db.collection(`shops/${shopId}/customers`).get(),
    db.collection(`shops/${shopId}/sales`).where("customerId", "!=", null).get(),
  ]);

  const totalsByCustomerId = new Map<string, number>();
  salesSnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const customerId = String(data.customerId || "");
    if (!customerId) return;
    totalsByCustomerId.set(
      customerId,
      (totalsByCustomerId.get(customerId) || 0) + Number(data.total || 0),
    );
  });

  for (const chunk of chunkArray(customerSnapshot.docs, 350)) {
    const batch = db.batch();
    chunk.forEach((customerDoc) => {
      const totalSpent = Math.round(totalsByCustomerId.get(customerDoc.id) || 0);
      batch.set(customerDoc.ref, {
        totalSpent,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }

  await rebuildCustomerCreditSummaries(shopId);
  await rebuildDashboardSnapshot(shopId);
};

const importInventoryBatch = async (shopId: string, items: Record<string, unknown>[]) => {
  for (const chunk of chunkArray(items, 350)) {
    const batch = db.batch();
    chunk.forEach((item) => {
      const id = String(item.id || "");
      if (!id) return;
      batch.set(db.doc(`shops/${shopId}/inventory/${id}`), {
        ...item,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
};

const importCustomersBatch = async (shopId: string, items: Record<string, unknown>[]) => {
  for (const chunk of chunkArray(items, 350)) {
    const batch = db.batch();
    chunk.forEach((item) => {
      const id = String(item.id || "");
      if (!id) return;
      batch.set(db.doc(`shops/${shopId}/customers/${id}`), {
        ...item,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
};

const importSalesBatch = async (shopId: string, sales: Record<string, unknown>[]) => {
  for (const chunk of chunkArray(sales, 125)) {
    const batch = db.batch();
    chunk.forEach((sale) => {
      const id = String(sale.id || "");
      if (!id) return;
      batch.set(db.doc(`shops/${shopId}/sales/${id}`), {
        ...sale,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }
};

const processJob = async (
  shopId: string,
  type: JobType,
  payload: Record<string, unknown>,
) => {
  switch (type) {
    case "REBUILD_DASHBOARD":
      await rebuildDashboardSnapshot(shopId);
      return;
    case "REBUILD_CUSTOMER_CREDITS":
      await rebuildCustomerCreditSummaries(shopId, typeof payload.customerId === "string" ? payload.customerId : undefined);
      return;
    case "REBUILD_CUSTOMER_TOTALS_FROM_SALES":
      await rebuildCustomerTotalsFromSales(shopId);
      return;
    case "REBUILD_PAYROLL_SUMMARIES":
      await rebuildPayrollSummaries(shopId, {
        monthKey: typeof payload.monthKey === "string" ? payload.monthKey : undefined,
        staffIds: Array.isArray(payload.staffIds) ? payload.staffIds.map(String) : undefined,
      });
      return;
    case "IMPORT_INVENTORY_BATCH":
      await importInventoryBatch(shopId, Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : []);
      return;
    case "IMPORT_CUSTOMERS_BATCH":
      await importCustomersBatch(shopId, Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : []);
      return;
    case "IMPORT_SALES_BATCH":
      await importSalesBatch(shopId, Array.isArray(payload.sales) ? payload.sales as Record<string, unknown>[] : []);
      return;
    default:
      throw new Error(`Unsupported job type: ${String(type)}`);
  }
};

const handleImportSuccess = async (
  shopId: string,
  jobRef: FirebaseFirestore.DocumentReference,
  jobData: FirebaseFirestore.DocumentData,
  processedCount: number,
) => {
  const importId = typeof jobData.importId === "string" ? jobData.importId : null;
  if (!importId) return;

  const importRef = db.doc(`shops/${shopId}/imports/${importId}`);

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(importRef);
    if (!snapshot.exists) return;

    const current = snapshot.data() || {};
    const importType = String(current.importType || jobData.importType || "") as ImportType;
    const nextCompletedJobs = Number(current.completedJobs || 0) + 1;
    const nextCompletedDataJobs = Number(current.completedDataJobs || 0)
      + (String(jobData.type || "").startsWith("IMPORT_") ? 1 : 0);
    const nextProcessedItems = Number(current.processedItems || 0) + processedCount;
    const dataJobCount = Number(current.dataJobCount || current.totalJobs || 0);
    let nextTotalJobs = Number(current.totalJobs || 0);
    const postProcessQueued = !!current.postProcessQueued;

    const updates: Record<string, unknown> = {
      status: "running",
      completedJobs: nextCompletedJobs,
      completedDataJobs: nextCompletedDataJobs,
      processedItems: nextProcessedItems,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      startedAt: current.startedAt || admin.firestore.FieldValue.serverTimestamp(),
    };

    if (importType === "sale" && !postProcessQueued && nextCompletedDataJobs >= dataJobCount) {
      const finalizeJobRef = db.collection(`shops/${shopId}/jobs`).doc();
      nextTotalJobs += 1;
      tx.set(finalizeJobRef, {
        type: "REBUILD_CUSTOMER_TOTALS_FROM_SALES",
        status: "queued",
        progress: 0,
        importId,
        importType,
        itemCount: 0,
        batchIndex: dataJobCount + 1,
        totalBatches: nextTotalJobs,
        createdBy: jobData.createdBy || "system",
        createdByEmail: jobData.createdByEmail || "system",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        payload: {},
      });
      updates.postProcessQueued = true;
      updates.totalJobs = nextTotalJobs;
      updates.status = "finalizing";
    } else if (nextCompletedJobs >= nextTotalJobs) {
      updates.status = "completed";
      updates.finishedAt = admin.firestore.FieldValue.serverTimestamp();
      updates.errorSummary = admin.firestore.FieldValue.delete();
    }

    tx.set(importRef, updates, { merge: true });
  });
};

const handleImportFailure = async (
  shopId: string,
  jobData: FirebaseFirestore.DocumentData,
  errorSummary: string,
) => {
  const importId = typeof jobData.importId === "string" ? jobData.importId : null;
  if (!importId) return;

  await db.doc(`shops/${shopId}/imports/${importId}`).set({
    status: "failed",
    failedJobs: admin.firestore.FieldValue.increment(1),
    errorSummary,
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
};

export const onBackgroundJobWrite = onDocumentWritten({
  document: "shops/{shopId}/jobs/{jobId}",
  memory: "1GiB",
  timeoutSeconds: 540,
  maxInstances: 10,
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;

  const data = after.data();
  if (data.status !== "queued") return;

  const claimed = await claimQueuedJob(after.ref);
  if (!claimed) return;

  try {
    await setJobState(after.ref, "running", { progress: 5 });
    await processJob(
      event.params.shopId,
      String(data.type || "") as JobType,
      (data.payload as Record<string, unknown>) || {},
    );
    await setJobState(after.ref, "completed", {
      progress: 100,
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      errorSummary: admin.firestore.FieldValue.delete(),
    });
    await handleImportSuccess(
      event.params.shopId,
      after.ref,
      data,
      Number(data.itemCount || 0),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobState(after.ref, "failed", {
      finishedAt: admin.firestore.FieldValue.serverTimestamp(),
      errorSummary: message,
      retryCount: admin.firestore.FieldValue.increment(1),
    });
    await handleImportFailure(event.params.shopId, data, message);
  }
});
