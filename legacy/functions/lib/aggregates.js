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
exports.onSaleWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
exports.onSaleWrite = (0, firestore_1.onDocumentWritten)({
    document: "shops/{shopId}/sales/{saleId}",
    maxInstances: 2
}, async (event) => {
    var _a, _b;
    const shopId = event.params.shopId;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before;
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after;
    const beforeData = (before === null || before === void 0 ? void 0 : before.exists) ? before.data() : null;
    const afterData = (after === null || after === void 0 ? void 0 : after.exists) ? after.data() : null;
    const saleDate = ((afterData === null || afterData === void 0 ? void 0 : afterData.date) || (beforeData === null || beforeData === void 0 ? void 0 : beforeData.date) || "").split("T")[0];
    if (!saleDate)
        return;
    const aggregateRef = admin.firestore().doc(`shops/${shopId}/aggregates_daily/${saleDate}`);
    let deltaRevenue = 0;
    let deltaCogs = 0;
    let deltaGrossProfit = 0;
    let deltaTxCount = 0;
    const deltaUnitsByCategory = {};
    const deltaPaymentMix = {};
    if (afterData) {
        deltaRevenue += afterData.total || 0;
        deltaTxCount += beforeData ? 0 : 1;
        for (const item of (afterData.items || [])) {
            const quantity = item.quantity || 0;
            const cost = (item.costPrice || 0) * quantity;
            deltaCogs += cost;
            const category = item.category || "Uncategorized";
            deltaUnitsByCategory[category] = (deltaUnitsByCategory[category] || 0) + quantity;
        }
        for (const pay of (afterData.payments || [])) {
            const mode = pay.mode || "OTHERS";
            deltaPaymentMix[mode] = (deltaPaymentMix[mode] || 0) + (pay.amount || 0);
        }
        if ((afterData.payments || []).length === 0 && afterData.paymentMode) {
            deltaPaymentMix[afterData.paymentMode] = (deltaPaymentMix[afterData.paymentMode] || 0) + (afterData.total || 0);
        }
    }
    if (beforeData) {
        deltaRevenue -= beforeData.total || 0;
        deltaTxCount -= afterData ? 0 : 1;
        for (const item of (beforeData.items || [])) {
            const quantity = item.quantity || 0;
            const cost = (item.costPrice || 0) * quantity;
            deltaCogs -= cost;
            const category = item.category || "Uncategorized";
            deltaUnitsByCategory[category] = (deltaUnitsByCategory[category] || 0) - quantity;
        }
        for (const pay of (beforeData.payments || [])) {
            const mode = pay.mode || "OTHERS";
            deltaPaymentMix[mode] = (deltaPaymentMix[mode] || 0) - (pay.amount || 0);
        }
        if ((beforeData.payments || []).length === 0 && beforeData.paymentMode) {
            deltaPaymentMix[beforeData.paymentMode] = (deltaPaymentMix[beforeData.paymentMode] || 0) - (beforeData.total || 0);
        }
    }
    deltaGrossProfit = deltaRevenue - deltaCogs;
    const updates = {
        revenue: admin.firestore.FieldValue.increment(deltaRevenue),
        cogs: admin.firestore.FieldValue.increment(deltaCogs),
        grossProfit: admin.firestore.FieldValue.increment(deltaGrossProfit),
        txCount: admin.firestore.FieldValue.increment(deltaTxCount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    for (const [cat, val] of Object.entries(deltaUnitsByCategory)) {
        if (val !== 0) {
            updates[`unitsByCategory.${cat}`] = admin.firestore.FieldValue.increment(val);
        }
    }
    for (const [mode, val] of Object.entries(deltaPaymentMix)) {
        if (val !== 0) {
            updates[`paymentMix.${mode}`] = admin.firestore.FieldValue.increment(val);
        }
    }
    try {
        await aggregateRef.set(updates, { merge: true });
        console.log(`Updated aggregate for ${shopId} on ${saleDate}`);
    }
    catch (err) {
        console.error(`Error updating aggregate for ${shopId}`, err);
    }
});
//# sourceMappingURL=aggregates.js.map