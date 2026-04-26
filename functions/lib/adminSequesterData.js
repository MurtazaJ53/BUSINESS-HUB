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
exports.adminSequesterData = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcryptjs"));
exports.adminSequesterData = (0, https_1.onCall)({
    memory: "512MiB",
    timeoutSeconds: 300,
    maxInstances: 5
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated.");
    }
    const { shopId } = request.data;
    const uid = request.auth.uid;
    if (!shopId) {
        throw new https_1.HttpsError("invalid-argument", "ShopID is required for isolation.");
    }
    const db = admin.firestore();
    if (request.auth.token.role !== 'admin' || request.auth.token.shopId !== shopId) {
        throw new https_1.HttpsError("permission-denied", "Only shop administrators can trigger sequestration.");
    }
    const stats = {
        inventoryMigrated: 0,
        staffMigrated: 0,
        shopKeys: false
    };
    try {
        const batch = db.batch();
        const base = `shops/${shopId}`;
        const inventorySnap = await db.collection(`${base}/inventory`).get();
        inventorySnap.forEach(doc => {
            const data = doc.data();
            if (data.costPrice !== undefined) {
                const privateRef = db.doc(`${base}/inventory_private/${doc.id}`);
                batch.set(privateRef, {
                    costPrice: data.costPrice,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                batch.update(doc.ref, {
                    costPrice: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                stats.inventoryMigrated++;
            }
        });
        const staffSnap = await db.collection(`${base}/staff`).get();
        staffSnap.forEach(doc => {
            const data = doc.data();
            if (data.salary !== undefined || data.pin !== undefined) {
                const privateRef = db.doc(`${base}/staff_private/${doc.id}`);
                batch.set(privateRef, {
                    salary: data.salary || 0,
                    pin: data.pin || "",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                batch.update(doc.ref, {
                    salary: admin.firestore.FieldValue.delete(),
                    pin: admin.firestore.FieldValue.delete(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                stats.staffMigrated++;
            }
        });
        const shopRef = db.doc(`shops/${shopId}`);
        const shopSnap = await shopRef.get();
        if (shopSnap.exists) {
            const settings = ((_a = shopSnap.data()) === null || _a === void 0 ? void 0 : _a.settings) || {};
            if (settings.adminPin || settings.staffPin) {
                const authRef = db.doc(`${base}/private/auth`);
                const authPayload = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                if (settings.adminPin) {
                    authPayload.adminPinHash = await bcrypt.hash(String(settings.adminPin), 12);
                }
                batch.set(authRef, {
                    ...authPayload
                }, { merge: true });
                batch.update(shopRef, {
                    "settings.adminPin": admin.firestore.FieldValue.delete(),
                    "settings.staffPin": admin.firestore.FieldValue.delete()
                });
                stats.shopKeys = true;
            }
        }
        await batch.commit();
        return {
            success: true,
            message: "Data successfully sequestered into private vaults.",
            stats
        };
    }
    catch (err) {
        console.error("[SEQUESTER_ERROR]", err);
        throw new https_1.HttpsError("internal", err.message || "Failed to complete sequestration.");
    }
});
//# sourceMappingURL=adminSequesterData.js.map