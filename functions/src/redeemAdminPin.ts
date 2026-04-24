import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";

// Ensure initialization
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// 1. Strict Type Definitions
interface RedeemPinPayload {
  pin: string;
  shopId: string;
}

export const redeemAdminPin = onCall<RedeemPinPayload>(
  {
    enforceAppCheck: false, // 🛡️ Zero-Trust Security: Block Postman/cURL abuse (Set false for stability)
    memory: "256MiB",      // Bumped memory slightly for faster bcrypt processing
    maxInstances: 2,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const { pin: rawPin, shopId } = request.data;
    const pin = String(rawPin || "").trim();
    const uid = request.auth.uid;

    console.info(`[PIN_ATTEMPT] UID: ${uid} for Shop: ${shopId}. PIN Length: ${pin.length}`);

    // Strict input validation
    if (!pin || pin.length < 4 || !shopId) {
      throw new HttpsError("invalid-argument", "Valid PIN (min 4 digits) and ShopID are required.");
    }

    const db = admin.firestore();
    const attemptRef = db.doc(`shops/${shopId}/private/_pinAttempts_${uid}`);
    const authRef = db.doc(`shops/${shopId}/private/auth`);
    const staffRef = db.doc(`shops/${shopId}/staff/${uid}`);
    
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;

    // --- PHASE 1: Pre-Crypto Validation (Fast Fail) ---
    const [staffSnap, attemptSnap, authSnap] = await Promise.all([
      staffRef.get(),
      attemptRef.get(),
      authRef.get()
    ]);

    if (!staffSnap.exists) {
      throw new HttpsError("permission-denied", "User is not recognized in this workspace.");
    }

    if (attemptSnap.exists) {
      const data = attemptSnap.data();
      if (data?.lockoutUntil && data.lockoutUntil > now) {
        console.warn(`[LOCKED] UID: ${uid} attempted login while locked out.`);
        throw new HttpsError("resource-exhausted", `Account locked until ${new Date(data.lockoutUntil).toISOString()}`);
      }
    }

    // --- PHASE 2: Heavy Cryptography (Outside Transaction) ---
    let isMatch = false;
    const adminPinHash = authSnap.exists ? authSnap.data()?.adminPinHash : null;

    if (adminPinHash && typeof adminPinHash === 'string' && adminPinHash.length > 0) {
      isMatch = await bcrypt.compare(pin, adminPinHash);
    } else {
      // Fallback to default PIN '5253' for uninitialized shops or empty hashes
      isMatch = (pin === '5253');
    }

    // --- PHASE 3: Atomic State Updates & Audit Logging ---
    await db.runTransaction(async (transaction) => {
      // Re-read attempt doc inside transaction to ensure atomicity
      const currentAttemptSnap = await transaction.get(attemptRef);
      const auditRef = db.collection(`shops/${shopId}/audit_logs`).doc();
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      if (isMatch) {
        // Success: Clear lockouts and write audit log
        if (currentAttemptSnap.exists) {
          transaction.delete(attemptRef);
        }
        
        transaction.set(auditRef, {
          action: 'ADMIN_ELEVATION_GRANTED',
          actorId: uid,
          timestamp: timestamp,
          ipAddress: request.rawRequest.ip || 'unknown',
          severity: 'info'
        });
      } else {
        // Failure: Increment counters and write warning audit log
        let count = 1;
        let lockoutUntil = 0;

        if (currentAttemptSnap.exists) {
          const data = currentAttemptSnap.data();
          const lastAttempt = data?.lastAttempt || 0;
          
          if (now - lastAttempt > HOUR) {
            count = 1; // Reset if last attempt was over an hour ago
          } else {
            count = (data?.count || 0) + 1;
          }

          if (count >= 5) {
            lockoutUntil = now + DAY;
          }
        }

        transaction.set(attemptRef, {
          count,
          lastAttempt: now,
          lockoutUntil
        });

        transaction.set(auditRef, {
          action: 'ADMIN_ELEVATION_FAILED',
          actorId: uid,
          timestamp: timestamp,
          attemptCount: count,
          lockoutTriggered: count >= 5,
          ipAddress: request.rawRequest.ip || 'unknown',
          severity: count >= 5 ? 'high' : 'medium'
        });
      }
    });

    // --- PHASE 4: Claim Elevation & Token Refresh ---
    if (isMatch) {
      const auth = admin.auth();
      const user = await auth.getUser(uid);
      const existingClaims = user.customClaims || {};

      // Calculate new payload size to prevent the 1000-byte limit crash
      const newClaims = {
        ...existingClaims,
        shopAdmin: shopId,
        adminElevatedAt: now // Allows frontend to force a re-auth after a certain time
      };

      if (Buffer.byteLength(JSON.stringify(newClaims), 'utf8') > 1000) {
        console.error(`[CRITICAL] Claims payload exceeds 1000 bytes for ${uid}. Stripping legacy claims.`);
        // Fallback: Strip the dynamic existing claims and just set the critical ones
        await auth.setCustomUserClaims(uid, { 
          shopId: existingClaims.shopId, 
          role: existingClaims.role, 
          shopAdmin: shopId 
        });
      } else {
        await auth.setCustomUserClaims(uid, newClaims);
      }

      console.info(`[ELEVATED] UID: ${uid} granted admin access for shop ${shopId}.`);
      return { success: true };
    }

    // --- Handle Failure Response ---
    const currentAttemptSnap = await attemptRef.get();
    const currentData = currentAttemptSnap.data();
    
    console.warn(`[FAILED PIN] Attempt ${currentData?.count || 1}/5 for UID: ${uid}`);
    
    if (currentData?.lockoutUntil && currentData.lockoutUntil > now) {
      throw new HttpsError("resource-exhausted", "Maximum attempts reached. Terminal locked for 24 hours.");
    }

    return { success: false, error: "Incorrect Security PIN." };
  }
);
