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
exports.onStaffWrite = (0, firestore_1.onDocumentWritten)("shops/{shopId}/staff/{uid}", async (event) => {
    var _a;
    const shopId = event.params.shopId;
    const uid = event.params.uid;
    if (!((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists)) {
        console.log(`Staff ${uid} deleted. Removing custom claims.`);
        try {
            await admin.auth().setCustomUserClaims(uid, null);
        }
        catch (err) {
            console.error("Error removing custom claims:", err);
        }
        return;
    }
    const data = event.data.after.data();
    const permissions = (data === null || data === void 0 ? void 0 : data.permissions) || {};
    const perms = {};
    for (const modId in permissions) {
        const modActions = permissions[modId];
        if (typeof modActions === 'object' && modActions !== null) {
            const activeActions = {};
            let hasActions = false;
            for (const actId in modActions) {
                const val = modActions[actId];
                if (val === true || (typeof val === 'object' && val !== null)) {
                    activeActions[actId] = val;
                    hasActions = true;
                }
            }
            if (hasActions) {
                perms[modId] = activeActions;
            }
        }
    }
    console.log(`Setting custom claims for staff ${uid} in shop ${shopId}`, perms);
    try {
        await admin.auth().setCustomUserClaims(uid, {
            shopId,
            perms
        });
    }
    catch (err) {
        console.error("Error setting custom claims:", err);
    }
});
//# sourceMappingURL=staff-claims.js.map