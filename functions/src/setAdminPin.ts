import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";

// Ensure admin is initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// 1. Strict Type Definitions
interface SetPinPayload {
  newPin: string;
  shopId: string;
}

export const setAdminPin = onCall<SetPinPayload>(
  {
    // 🛡️ SECURITY: Enable App Check to prevent curl/Postman abuse
    enforceAppCheck: false, // Set to false initially to avoid breaking current users, can enable later
    memory: "256MiB",
    maxInstances: 2,
  },
  async (request) => {
    // 1. Authentication Check
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated", 
        "Missing or invalid authentication token."
      );
    }

    const { newPin: rawPin, shopId } = request.data;
    const newPin = String(rawPin || "").trim();
    const uid = request.auth.uid;

    // 2. Strict Input Sanitization (Regex for exactly 4 to 6 numeric digits)
    const pinRegex = /^\d{4,6}$/;
    if (!newPin || !pinRegex.test(newPin)) {
      throw new HttpsError(
        "invalid-argument", 
        "Security PIN must be strictly numeric and between 4 to 6 digits."
      );
    }

    if (!shopId || typeof shopId !== 'string') {
      throw new HttpsError("invalid-argument", "Valid ShopID is required.");
    }

    const db = admin.firestore();

    try {
      // 3. Authorization Check (Role Verification)
      const staffRef = db.doc(`shops/${shopId}/staff/${uid}`);
      const staffSnap = await staffRef.get();

      if (!staffSnap.exists || staffSnap.data()?.role !== 'admin') {
        console.warn(`[UNAUTHORIZED ATTEMPT] UID: ${uid} tried to set PIN for Shop: ${shopId}`);
        throw new HttpsError(
          "permission-denied", 
          "Insufficient clearance. Only verified administrators can rotate the shop PIN."
        );
      }

      // 4. Cryptographic Hashing (Salt rounds increased slightly for modern hardware)
      const hash = await bcrypt.hash(newPin, 12);
      const timestamp = admin.firestore.FieldValue.serverTimestamp();

      // 5. Atomic Batch Operation (Update Auth + Write Audit Log simultaneously)
      const batch = db.batch();

      // Update the private auth document
      const authRef = db.doc(`shops/${shopId}/private/auth`);
      batch.set(authRef, {
        adminPinHash: hash,
        updatedAt: timestamp,
        updatedBy: uid
      }, { merge: true });

      // Create an immutable Audit Trail entry
      const auditRef = db.collection(`shops/${shopId}/audit_logs`).doc();
      batch.set(auditRef, {
        action: 'ADMIN_PIN_ROTATED',
        actorId: uid,
        timestamp: timestamp,
        ipAddress: request.rawRequest.ip || 'unknown',
        userAgent: request.rawRequest.headers['user-agent'] || 'unknown',
        severity: 'high'
      });

      // Commit the transaction
      await batch.commit();

      console.info(`[SUCCESS] Admin PIN securely rotated for shop: ${shopId} by UID: ${uid}`);
      return { 
        success: true, 
        message: "PIN successfully updated and secured." 
      };

    } catch (error: any) {
      // Pass through intentional HttpsErrors, catch unexpected ones
      if (error instanceof HttpsError) throw error;
      
      console.error(`[FATAL ERROR] PIN rotation failed for shop ${shopId}:`, error);
      throw new HttpsError("internal", "An internal cryptographic or database error occurred.");
    }
  }
);
