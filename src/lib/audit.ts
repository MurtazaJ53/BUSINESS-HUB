import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Log sensitive events or significant system activities for audit trails.
 */
export async function logAuditEntry(
  shopId: string, 
  userId: string, 
  userEmail: string,
  event: 'RECONCILIATION_VARIANCE' | 'INVENTORY_PURGE' | 'ADMIN_ELEVATION' | 'BULK_IMPORT',
  details: string,
  metadata: Record<string, any> = {}
) {
  try {
    await addDoc(collection(db, 'shops', shopId, 'audit_logs'), {
      userId,
      userEmail,
      event,
      details,
      metadata,
      timestamp: serverTimestamp()
    });
    console.log(`Audit log entry created: ${event}`);
  } catch (err) {
    console.error('Failed to create audit log entry', err);
  }
}
