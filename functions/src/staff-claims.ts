import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Ensure initialization
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- 1. Strict Type Definitions ---
interface PermissionAction {
  [actionId: string]: boolean | Record<string, any>;
}

interface StaffDocument {
  id: string;
  role?: 'admin' | 'staff' | 'manager';
  status?: 'active' | 'suspended';
  permissions?: Record<string, PermissionAction>;
}

export const onStaffWrite = onDocumentWritten(
  {
    document: "shops/{shopId}/staff/{uid}",
    memory: "256MiB",
    maxInstances: 2,
  },
  async (event) => {
    const { shopId, uid } = event.params;
    const auth = admin.auth();

    // --- 2. Handle Staff Deletion (Total Access Revocation) ---
    if (!event.data?.after.exists) {
      console.info(`[SECURITY] Staff ${uid} removed from shop ${shopId}. Wiping claims.`);
      try {
        // Nullify claims to strip ERP routing privileges
        await auth.setCustomUserClaims(uid, null);
        // FORCE LOGOUT: Revoke refresh tokens so their current session dies immediately
        await auth.revokeRefreshTokens(uid);
        console.info(`[SUCCESS] Sessions terminated for ${uid}`);
      } catch (err: any) {
        // Ignore errors if the user was already deleted directly from Firebase Auth
        if (err.code !== 'auth/user-not-found') {
          console.error(`[ERROR] Failed to revoke claims for ${uid}:`, err);
        }
      }
      return;
    }

    // --- 3. Parse and Validate Document Data ---
    const data = event.data.after.data() as StaffDocument;
    const role = data.role || 'staff';
    const status = data.status || 'active';
    const rawPermissions = data.permissions || {};

    // 🛡️ SECURITY GUARD: Immediate suspension check
    if (status === 'suspended') {
      console.warn(`[SECURITY] Staff ${uid} is marked suspended. Revoking functional access.`);
      await auth.setCustomUserClaims(uid, { shopId, role: 'suspended' });
      await auth.revokeRefreshTokens(uid);
      return;
    }

    // --- 4. JWT Payload Compression ---
    // We strictly filter to only store truthy values to keep the token footprint microscopic.
    const compressedPerms: Record<string, any> = {};

    for (const [modId, modActions] of Object.entries(rawPermissions)) {
      if (typeof modActions === 'object' && modActions !== null) {
        const activeActions: Record<string, any> = {};
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

    // --- 5. Construct & Verify Payload Limit ---
    const claimsPayload = {
      shopId,
      role, // Exposing role at the top level makes frontend routing much faster
      perms: compressedPerms
    };

    // 📏 CRITICAL CHECK: Firebase limits claims to 1000 bytes
    const payloadSize = Buffer.byteLength(JSON.stringify(claimsPayload), 'utf8');
    
    if (payloadSize > 1000) {
      console.error(`[CRITICAL LIMIT] Claims payload for ${uid} is ${payloadSize} bytes! Max is 1000.`);
      // Fallback: Provide role and shop context, but strip granular perms to prevent auth crash
      await auth.setCustomUserClaims(uid, { 
        shopId, 
        role, 
        perms: { _error: "PAYLOAD_TOO_LARGE" } 
      });
      return;
    }

    // --- 6. Apply Validated Claims ---
    console.info(`[AUTH SYNC] Setting claims for ${uid}. Payload size: ${payloadSize} bytes.`);
    try {
      await auth.setCustomUserClaims(uid, claimsPayload);
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        console.error(`[ERROR] Failed to set custom claims for ${uid}:`, err);
      }
    }
  }
);
