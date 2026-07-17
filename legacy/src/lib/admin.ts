import { httpsCallable } from 'firebase/functions';

import { functions } from './firebase';

export const verifyAdminPin = async (pin: string, shopId: string): Promise<void> => {
  const normalizedPin = pin.trim();
  if (!normalizedPin) {
    throw new Error('Security PIN is required.');
  }

  try {
    const redeemPin = httpsCallable(functions, 'redeemAdminPin');
    const result = await redeemPin({ pin: normalizedPin, shopId });
    if (!(result.data as any)?.success) {
      throw new Error((result.data as any)?.error || 'Invalid Security PIN.');
    }
  } catch (error: any) {
    const code = String(error?.code || '');
    const message = String(error?.message || '');

    if (code.includes('failed-precondition') || message.toLowerCase().includes('not initialized')) {
      throw new Error('Admin PIN is not set yet. Open Settings to create it first.');
    }

    if (code.includes('resource-exhausted')) {
      throw new Error('Too many failed PIN attempts. Please wait and try again later.');
    }

    throw new Error(message.replace(/^functions\/[a-z-]+:\s*/i, '') || 'Invalid Security PIN.');
  }
};
