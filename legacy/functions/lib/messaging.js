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
exports.onAlertCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
exports.onAlertCreated = (0, firestore_1.onDocumentCreated)('shops/{shopId}/alerts/{alertId}', async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const alert = snap.data();
    const { shopId, alertId } = event.params;
    if (alert.severity !== 'high' && alert.severity !== 'critical') {
        return;
    }
    const tokensSnap = await admin.firestore()
        .collection(`shops/${shopId}/device_tokens`)
        .get();
    const tokens = tokensSnap.docs.map(doc => doc.id);
    if (tokens.length === 0) {
        console.log('No registered device tokens for shop:', shopId);
        return;
    }
    const message = {
        notification: {
            title: alert.title || 'Business Hub Alert',
            body: alert.message || 'New high-priority business event detected.',
        },
        data: {
            shopId,
            alertId: alertId,
            type: 'BUSINESS_ALERT'
        },
        tokens: tokens,
    };
    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`Successfully sent ${response.successCount} messages for alert ${alertId}`);
        const expiredTokens = [];
        response.responses.forEach((res, index) => {
            if (!res.success) {
                const error = res.error;
                if (error && (error.code === 'messaging/invalid-registration-token' ||
                    error.code === 'messaging/registration-token-not-registered')) {
                    expiredTokens.push(tokens[index]);
                }
            }
        });
        if (expiredTokens.length > 0) {
            const batch = admin.firestore().batch();
            expiredTokens.forEach(t => {
                batch.delete(admin.firestore().doc(`shops/${shopId}/device_tokens/${t}`));
            });
            await batch.commit();
            console.log(`Cleaned up ${expiredTokens.length} expired tokens.`);
        }
    }
    catch (e) {
        console.error('Push notification delivery failed:', e);
    }
});
//# sourceMappingURL=messaging.js.map