import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";

/**
 * Server-side PIN verification.
 * Prevents clients from needing to read sensitive hashes from the private vault.
 */
export const redeemAdminPin = onCall(async (request) => {
  // 1. Auth Check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { pin, shopId } = request.data;
  if (!pin || !shopId) {
    throw new HttpsError("invalid-argument", "PIN and ShopID required");
  }

  // 2. Authorization Check: Ensure the user belongs to the shop
  const staffSnap = await admin.firestore().doc(`shops/${shopId}/staff/${request.auth.uid}`).get();
  if (!staffSnap.exists) {
    throw new HttpsError("permission-denied", "User is not a member of this shop.");
  }

  // 3. Fetch the Hashed PIN from the Private Vault
  const authSnap = await admin.firestore().doc(`shops/${shopId}/private/auth`).get();
  
  if (!authSnap.exists) {
    throw new HttpsError("not-found", "Admin PIN not initialized for this shop.");
  }

  const { adminPinHash } = authSnap.data() as { adminPinHash: string };

  if (!adminPinHash) {
    throw new HttpsError("failed-precondition", "Security configuration missing in private vault.");
  }

  // 4. Verification
  const isMatch = bcrypt.compareSync(pin, adminPinHash);

  if (isMatch) {
    console.log(`Admin PIN verified for UID: ${request.auth.uid} in Shop: ${shopId}`);
    return { success: true };
  }

  console.warn(`Failed Admin PIN attempt for UID: ${request.auth.uid} in Shop: ${shopId}`);
  return { success: false, error: "Incorrect Admin PIN." };
});
