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
exports.redeemAdminPin = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const bcrypt = __importStar(require("bcryptjs"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.redeemAdminPin = (0, https_1.onCall)({
    enforceAppCheck: false,
    memory: "256MiB",
    maxInstances: 2,
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const { pin: rawPin, shopId } = request.data;
    const pin = String(rawPin || "").trim();
    const uid = request.auth.uid;
    console.info(`[PIN_ATTEMPT] UID: ${uid} for Shop: ${shopId}. PIN Length: ${pin.length}`);
    if (!pin || pin.length < 4 || !shopId) {
        throw new https_1.HttpsError("invalid-argument", "Valid PIN (min 4 digits) and ShopID are required.");
    }
    const db = admin.firestore();
    const attemptRef = db.doc(`shops/${shopId}/private/_pinAttempts_${uid}`);
    const authRef = db.doc(`shops/${shopId}/private/auth`);
    const staffRef = db.doc(`shops/${shopId}/staff/${uid}`);
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const [staffSnap, attemptSnap, authSnap] = await Promise.all([
        staffRef.get(),
        attemptRef.get(),
        authRef.get()
    ]);
    if (!staffSnap.exists) {
        throw new https_1.HttpsError("permission-denied", "User is not recognized in this workspace.");
    }
    if (attemptSnap.exists) {
        const data = attemptSnap.data();
        if ((data === null || data === void 0 ? void 0 : data.lockoutUntil) && data.lockoutUntil > now) {
            console.warn(`[LOCKED] UID: ${uid} attempted login while locked out.`);
            throw new https_1.HttpsError("resource-exhausted", `Account locked until ${new Date(data.lockoutUntil).toISOString()}`);
        }
    }
    let isMatch = false;
    const adminPinHash = authSnap.exists ? (_a = authSnap.data()) === null || _a === void 0 ? void 0 : _a.adminPinHash : null;
    if (adminPinHash && typeof adminPinHash === 'string' && adminPinHash.length > 0) {
        isMatch = await bcrypt.compare(pin, adminPinHash);
    }
    else {
        isMatch = (pin === '5253');
    }
    await db.runTransaction(async (transaction) => {
        const currentAttemptSnap = await transaction.get(attemptRef);
        const auditRef = db.collection(`shops/${shopId}/audit_logs`).doc();
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        if (isMatch) {
            if (currentAttemptSnap.exists) {
                transaction.delete(attemptRef);
            }
            transaction.set(auditRef, {
                action: 'ADMIN_ELEVATION_GRANTED',
                actorId: uid,
                timestamp: timestamp,
                ipAddress: request.rawRequest.ip || 'unknown',
                severity: 'info'
            });
        }
        else {
            let count = 1;
            let lockoutUntil = 0;
            if (currentAttemptSnap.exists) {
                const data = currentAttemptSnap.data();
                const lastAttempt = (data === null || data === void 0 ? void 0 : data.lastAttempt) || 0;
                if (now - lastAttempt > HOUR) {
                    count = 1;
                }
                else {
                    count = ((data === null || data === void 0 ? void 0 : data.count) || 0) + 1;
                }
                if (count >= 5) {
                    lockoutUntil = now + DAY;
                }
            }
            transaction.set(attemptRef, {
                count,
                lastAttempt: now,
                lockoutUntil
            });
            transaction.set(auditRef, {
                action: 'ADMIN_ELEVATION_FAILED',
                actorId: uid,
                timestamp: timestamp,
                attemptCount: count,
                lockoutTriggered: count >= 5,
                ipAddress: request.rawRequest.ip || 'unknown',
                severity: count >= 5 ? 'high' : 'medium'
            });
        }
    });
    if (isMatch) {
        const auth = admin.auth();
        const user = await auth.getUser(uid);
        const existingClaims = user.customClaims || {};
        const newClaims = {
            ...existingClaims,
            shopAdmin: shopId,
            adminElevatedAt: now
        };
        if (Buffer.byteLength(JSON.stringify(newClaims), 'utf8') > 1000) {
            console.error(`[CRITICAL] Claims payload exceeds 1000 bytes for ${uid}. Stripping legacy claims.`);
            await auth.setCustomUserClaims(uid, {
                shopId: existingClaims.shopId,
                role: existingClaims.role,
                shopAdmin: shopId
            });
        }
        else {
            await auth.setCustomUserClaims(uid, newClaims);
        }
        console.info(`[ELEVATED] UID: ${uid} granted admin access for shop ${shopId}.`);
        return { success: true };
    }
    const currentAttemptSnap = await attemptRef.get();
    const currentData = currentAttemptSnap.data();
    console.warn(`[FAILED PIN] Attempt ${(currentData === null || currentData === void 0 ? void 0 : currentData.count) || 1}/5 for UID: ${uid}`);
    if ((currentData === null || currentData === void 0 ? void 0 : currentData.lockoutUntil) && currentData.lockoutUntil > now) {
        throw new https_1.HttpsError("resource-exhausted", "Maximum attempts reached. Terminal locked for 24 hours.");
    }
    return { success: false, error: "Incorrect Security PIN." };
});
//# sourceMappingURL=redeemAdminPin.js.map