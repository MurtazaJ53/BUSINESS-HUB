"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onBackgroundJobWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
const summaries_1 = require("./summaries");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const setJobState = async (ref, status, extra = {}) => {
    await ref.set({
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...extra,
    }, { merge: true });
};
const chunkArray = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
};
const claimQueuedJob = async (ref) => {
    return db.runTransaction(async (tx) => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists)
            return false;
        const data = snapshot.data() || {};
        if (data.status !== "queued")
            return false;
        tx.set(ref, {
            status: "running",
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
    });
};
const rebuildCustomerTotalsFromSales = async (shopId) => {
    const [customerSnapshot, salesSnapshot] = await Promise.all([
        db.collection(`shops/${shopId}/customers`).get(),
        db.collection(`shops/${shopId}/sales`).where("customerId", "!=", null).get(),
    ]);
    const totalsByCustomerId = new Map();
    salesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const customerId = String(data.customerId || "");
        if (!customerId)
            return;
        totalsByCustomerId.set(customerId, (totalsByCustomerId.get(customerId) || 0) + Number(data.total || 0));
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
    await (0, summaries_1.rebuildCustomerCreditSummaries)(shopId);
    await (0, summaries_1.rebuildDashboardSnapshot)(shopId);
};
const importInventoryBatch = async (shopId, items) => {
    for (const chunk of chunkArray(items, 350)) {
        const batch = db.batch();
        chunk.forEach((item) => {
            const id = String(item.id || "");
            if (!id)
                return;
            batch.set(db.doc(`shops/${shopId}/inventory/${id}`), {
                ...item,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await batch.commit();
    }
};
const importCustomersBatch = async (shopId, items) => {
    for (const chunk of chunkArray(items, 350)) {
        const batch = db.batch();
        chunk.forEach((item) => {
            const id = String(item.id || "");
            if (!id)
                return;
            batch.set(db.doc(`shops/${shopId}/customers/${id}`), {
                ...item,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await batch.commit();
    }
};
const importSalesBatch = async (shopId, sales) => {
    for (const chunk of chunkArray(sales, 125)) {
        const batch = db.batch();
        chunk.forEach((sale) => {
            const id = String(sale.id || "");
            if (!id)
                return;
            batch.set(db.doc(`shops/${shopId}/sales/${id}`), {
                ...sale,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await batch.commit();
    }
};
const processJob = async (shopId, type, payload) => {
    switch (type) {
        case "REBUILD_DASHBOARD":
            await (0, summaries_1.rebuildDashboardSnapshot)(shopId);
            return;
        case "REBUILD_CUSTOMER_CREDITS":
            await (0, summaries_1.rebuildCustomerCreditSummaries)(shopId, typeof payload.customerId === "string" ? payload.customerId : undefined);
            return;
        case "REBUILD_CUSTOMER_TOTALS_FROM_SALES":
            await rebuildCustomerTotalsFromSales(shopId);
            return;
        case "REBUILD_PAYROLL_SUMMARIES":
            await (0, summaries_1.rebuildPayrollSummaries)(shopId, {
                monthKey: typeof payload.monthKey === "string" ? payload.monthKey : undefined,
                staffIds: Array.isArray(payload.staffIds) ? payload.staffIds.map(String) : undefined,
            });
            return;
        case "IMPORT_INVENTORY_BATCH":
            await importInventoryBatch(shopId, Array.isArray(payload.items) ? payload.items : []);
            return;
        case "IMPORT_CUSTOMERS_BATCH":
            await importCustomersBatch(shopId, Array.isArray(payload.items) ? payload.items : []);
            return;
        case "IMPORT_SALES_BATCH":
            await importSalesBatch(shopId, Array.isArray(payload.sales) ? payload.sales : []);
            return;
        default:
            throw new Error(`Unsupported job type: ${String(type)}`);
    }
};
const handleImportSuccess = async (shopId, jobRef, jobData, processedCount) => {
    const importId = typeof jobData.importId === "string" ? jobData.importId : null;
    if (!importId)
        return;
    const importRef = db.doc(`shops/${shopId}/imports/${importId}`);
    await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(importRef);
        if (!snapshot.exists)
            return;
        const current = snapshot.data() || {};
        const importType = String(current.importType || jobData.importType || "");
        const nextCompletedJobs = Number(current.completedJobs || 0) + 1;
        const nextCompletedDataJobs = Number(current.completedDataJobs || 0)
            + (String(jobData.type || "").startsWith("IMPORT_") ? 1 : 0);
        const nextProcessedItems = Number(current.processedItems || 0) + processedCount;
        const dataJobCount = Number(current.dataJobCount || current.totalJobs || 0);
        let nextTotalJobs = Number(current.totalJobs || 0);
        const postProcessQueued = !!current.postProcessQueued;
        const updates = {
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
        }
        else if (nextCompletedJobs >= nextTotalJobs) {
            updates.status = "completed";
            updates.finishedAt = admin.firestore.FieldValue.serverTimestamp();
            updates.errorSummary = admin.firestore.FieldValue.delete();
        }
        tx.set(importRef, updates, { merge: true });
    });
};
const handleImportFailure = async (shopId, jobData, errorSummary) => {
    const importId = typeof jobData.importId === "string" ? jobData.importId : null;
    if (!importId)
        return;
    await db.doc(`shops/${shopId}/imports/${importId}`).set({
        status: "failed",
        failedJobs: admin.firestore.FieldValue.increment(1),
        errorSummary,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
};
exports.onBackgroundJobWrite = (0, firestore_1.onDocumentWritten)({
    document: "shops/{shopId}/jobs/{jobId}",
    memory: "1GiB",
    timeoutSeconds: 540,
    maxInstances: 10,
}, async (event) => {
    var _a;
    const after = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    if (!(after === null || after === void 0 ? void 0 : after.exists))
        return;
    const data = after.data();
    if (data.status !== "queued")
        return;
    const claimed = await claimQueuedJob(after.ref);
    if (!claimed)
        return;
    try {
        await setJobState(after.ref, "running", { progress: 5 });
        await processJob(event.params.shopId, String(data.type || ""), data.payload || {});
        await setJobState(after.ref, "completed", {
            progress: 100,
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            errorSummary: admin.firestore.FieldValue.delete(),
        });
        await handleImportSuccess(event.params.shopId, after.ref, data, Number(data.itemCount || 0));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await setJobState(after.ref, "failed", {
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            errorSummary: message,
            retryCount: admin.firestore.FieldValue.increment(1),
        });
        await handleImportFailure(event.params.shopId, data, message);
    }
});
//# sourceMappingURL=jobs.js.map