import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface PushConfig {
  shopId: string | null;
  uid: string | null;
}

export function usePushNotifications(shopId: string | null) {
  const navigate = useNavigate();
  const listenersRef = useRef<PluginListenerHandle[]>([]);
  
  // Backwards compatibility for the call in App.tsx which only passes shopId
  // We need the current UID for the user-centric device mapping
  const uid = Capacitor.isNativePlatform() ? (window as any).firebase?.auth?.currentUser?.uid : null;

  useEffect(() => {
    // Fail fast if not on mobile or missing core context
    if (!shopId || !Capacitor.isNativePlatform()) return;

    let isMounted = true;

    const initializePush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('[Push Service] Permissions denied by user.');
          return;
        }

        const deviceInfo = await Device.getInfo();
        const deviceName = `${deviceInfo.manufacturer} ${deviceInfo.model}`;

        const regListener = await PushNotifications.addListener(
          'registration', 
          async (token: Token) => {
            if (!isMounted) return;
            console.info(`[Push Service] Device registered: ${token.value.substring(0, 15)}...`);
            
            try {
              // Architecture Fix: Tie the device token to the specific UID if available
              const currentUid = uid || (window as any).firebase?.auth?.currentUser?.uid || 'anonymous';
              const safeTokenId = encodeURIComponent(token.value);
              const tokenRef = doc(db, `shops/${shopId}/staff/${currentUid}/devices/${safeTokenId}`);
              
              await setDoc(tokenRef, {
                token: token.value,
                platform: Capacitor.getPlatform(),
                deviceName: deviceName,
                osVersion: deviceInfo.osVersion,
                updatedAt: serverTimestamp(),
                status: 'active'
              }, { merge: true });

            } catch (e) {
              console.error('[Push Service] Database sync failed:', e);
            }
          }
        );

        const errorListener = await PushNotifications.addListener(
          'registrationError', 
          (error) => console.error('[Push Service] Framework registration failed:', error)
        );

        const receiveListener = await PushNotifications.addListener(
          'pushNotificationReceived', 
          (notification) => {
            console.info('[Push Service] Foreground payload received:', notification.title);
          }
        );

        const actionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed', 
          (action: ActionPerformed) => {
            console.info('[Push Service] User interacted with notification.');
            const payloadData = action.notification.data;
            if (payloadData && payloadData.route) {
              navigate(payloadData.route);
            }
          }
        );

        listenersRef.current = [regListener, errorListener, receiveListener, actionListener];
        await PushNotifications.register();

      } catch (error) {
        console.error('[Push Service] Critical initialization failure:', error);
      }
    };

    initializePush();

    return () => {
      isMounted = false;
      if (Capacitor.isNativePlatform()) {
        listenersRef.current.forEach(listener => listener.remove());
        listenersRef.current = [];
      }
    };
  }, [shopId, navigate, uid]);
}
