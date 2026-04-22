import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export function usePushNotifications(shopId: string | null) {
  useEffect(() => {
    if (!shopId || !Capacitor.isNativePlatform()) return;

    let isSubscribed = true;

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Push notification permissions denied.');
          return;
        }

        // Add listeners
        await PushNotifications.addListener('registration', async (token) => {
          if (!isSubscribed || !shopId) return;
          console.log('Push registration success, token: ' + token.value);
          
          try {
            const tokenRef = doc(db, `shops/${shopId}/device_tokens/${token.value}`);
            await setDoc(tokenRef, {
              token: token.value,
              platform: Capacitor.getPlatform(),
              registeredAt: new Date().toISOString()
            }, { merge: true });
            console.log('FCM token recorded in Firestore');
          } catch (e) {
            console.error('Failed to log push token to Firestore', e);
          }
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on push registration: ' + JSON.stringify(error));
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received: ', notification.title);
        });

        // Register with Apple/Google frameworks
        await PushNotifications.register();
      } catch (e) {
        console.error('Push notification setup failed', e);
      }
    };

    registerPush();

    return () => {
      isSubscribed = false;
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [shopId]);
}
