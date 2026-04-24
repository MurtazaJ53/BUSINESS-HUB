import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from 'firebase-admin';

/**
 * Triggered when a new alert is created in shops/{shopId}/alerts/{alertId}.
 * Sends push notifications to all registered device tokens for that shop.
 */
export const onAlertCreated = onDocumentCreated('shops/{shopId}/alerts/{alertId}', async (event) => {
    const snap = event.data;
    if (!snap) return;
    const alert = snap.data();
    const { shopId, alertId } = event.params;

    // Only push high severity alerts to mobile
    if (alert.severity !== 'high' && alert.severity !== 'critical') {
      return;
    }

    // Get all device tokens for this shop
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
      // Use the new v1 sendEachForMulticast API for batching messages
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Successfully sent ${response.successCount} messages for alert ${alertId}`);
      
      // Cleanup expired tokens
      const expiredTokens: string[] = [];
      response.responses.forEach((res, index) => {
        if (!res.success) {
          const error = res.error;
          if (error && (
              error.code === 'messaging/invalid-registration-token' ||
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


    } catch (e) {
      console.error('Push notification delivery failed:', e);
    }
  });
