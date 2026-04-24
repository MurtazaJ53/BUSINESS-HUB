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
exports.setAdminPin = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcryptjs"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.setAdminPin = (0, https_1.onCall)({
    enforceAppCheck: false,
    memory: "256MiB",
    maxInstances: 2,
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Missing or invalid authentication token.");
    }
    const { newPin: rawPin, shopId } = request.data;
    const newPin = String(rawPin || "").trim();
    const uid = request.auth.uid;
    const pinRegex = /^\d{4,6}$/;
    if (!newPin || !pinRegex.test(newPin)) {
        throw new https_1.HttpsError("invalid-argument", "Security PIN must be strictly numeric and between 4 to 6 digits.");
    }
    if (!shopId || typeof shopId !== 'string') {
        throw new https_1.HttpsError("invalid-argument", "Valid ShopID is required.");
    }
    const db = admin.firestore();
    try {
        const staffRef = db.doc(`shops/${shopId}/staff/${uid}`);
        const staffSnap = await staffRef.get();
        if (!staffSnap.exists || ((_a = staffSnap.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
            console.warn(`[UNAUTHORIZED ATTEMPT] UID: ${uid} tried to set PIN for Shop: ${shopId}`);
            throw new https_1.HttpsError("permission-denied", "Insufficient clearance. Only verified administrators can rotate the shop PIN.");
        }
        const hash = await bcrypt.hash(newPin, 12);
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        const batch = db.batch();
        const authRef = db.doc(`shops/${shopId}/private/auth`);
        batch.set(authRef, {
            adminPinHash: hash,
            updatedAt: timestamp,
            updatedBy: uid
        }, { merge: true });
        const auditRef = db.collection(`shops/${shopId}/audit_logs`).doc();
        batch.set(auditRef, {
            action: 'ADMIN_PIN_ROTATED',
            actorId: uid,
            timestamp: timestamp,
            ipAddress: request.rawRequest.ip || 'unknown',
            userAgent: request.rawRequest.headers['user-agent'] || 'unknown',
            severity: 'high'
        });
        await batch.commit();
        console.info(`[SUCCESS] Admin PIN securely rotated for shop: ${shopId} by UID: ${uid}`);
        return {
            success: true,
            message: "PIN successfully updated and secured."
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error(`[FATAL ERROR] PIN rotation failed for shop ${shopId}:`, error);
        throw new https_1.HttpsError("internal", "An internal cryptographic or database error occurred.");
    }
});
//# sourceMappingURL=setAdminPin.js.map