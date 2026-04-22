import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * Triggered when a new alert is created in shops/{shopId}/alerts/{alertId}.
 * Sends push notifications to all registered device tokens for that shop.
 */
export const onAlertCreated = functions.firestore
  .document('shops/{shopId}/alerts/{alertId}')
  .onCreate(async (snap, context) => {
    const alert = snap.data();
    const { shopId } = context.params;

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

    const payload: admin.messaging.MessagingPayload = {
      notification: {
        title: alert.title || 'Business Hub Alert',
        body: alert.message || 'New high-priority business event detected.',
        sound: 'default',
        clickAction: 'FCM_PLUGIN_ACTIVITY',
        icon: 'fcm_push_icon'
      },
      data: {
        shopId,
        alertId: context.params.alertId,
        type: 'BUSINESS_ALERT'
      }
    };

    try {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      console.log(`Successfully sent ${response.successCount} messages for alert ${context.params.alertId}`);
      
      // Cleanup expired tokens
      const expiredTokens: string[] = [];
      response.results.forEach((result, index) => {
        const error = result.error;
        if (error) {
          if (error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/registration-token-not-registered') {
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
