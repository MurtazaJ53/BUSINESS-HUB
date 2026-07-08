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
exports.onStaffWrite = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
exports.onStaffWrite = (0, firestore_1.onDocumentWritten)({
    document: "shops/{shopId}/staff/{uid}",
    memory: "256MiB",
    maxInstances: 2,
}, async (event) => {
    var _a;
    const { shopId, uid } = event.params;
    const auth = admin.auth();
    if (!((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists)) {
        console.info(`[SECURITY] Staff ${uid} removed from shop ${shopId}. Wiping claims.`);
        try {
            await auth.setCustomUserClaims(uid, null);
            await auth.revokeRefreshTokens(uid);
            console.info(`[SUCCESS] Sessions terminated for ${uid}`);
        }
        catch (err) {
            if (err.code !== 'auth/user-not-found') {
                console.error(`[ERROR] Failed to revoke claims for ${uid}:`, err);
            }
        }
        return;
    }
    const data = event.data.after.data();
    const role = data.role || 'staff';
    const status = data.status || 'active';
    const rawPermissions = data.permissions || {};
    if (status === 'suspended') {
        console.warn(`[SECURITY] Staff ${uid} is marked suspended. Revoking functional access.`);
        await auth.setCustomUserClaims(uid, { shopId, role: 'suspended' });
        await auth.revokeRefreshTokens(uid);
        return;
    }
    const compressedPerms = {};
    for (const [modId, modActions] of Object.entries(rawPermissions)) {
        if (typeof modActions === 'object' && modActions !== null) {
            const activeActions = {};
            let hasActions = false;
            for (const [actId, val] of Object.entries(modActions)) {
                if (val === true || (typeof val === 'object' && val !== null)) {
                    activeActions[actId] = val;
                    hasActions = true;
                }
            }
            if (hasActions) {
                compressedPerms[modId] = activeActions;
            }
        }
    }
    const claimsPayload = {
        shopId,
        role,
        perms: compressedPerms
    };
    const payloadSize = Buffer.byteLength(JSON.stringify(claimsPayload), 'utf8');
    if (payloadSize > 1000) {
        console.error(`[CRITICAL LIMIT] Claims payload for ${uid} is ${payloadSize} bytes! Max is 1000.`);
        await auth.setCustomUserClaims(uid, {
            shopId,
            role,
            perms: { _error: "PAYLOAD_TOO_LARGE" }
        });
        return;
    }
    console.info(`[AUTH SYNC] Setting claims for ${uid}. Payload size: ${payloadSize} bytes.`);
    try {
        await auth.setCustomUserClaims(uid, claimsPayload);
    }
    catch (err) {
        if (err.code !== 'auth/user-not-found') {
            console.error(`[ERROR] Failed to set custom claims for ${uid}:`, err);
        }
    }
});
//# sourceMappingURL=staff-claims.js.map