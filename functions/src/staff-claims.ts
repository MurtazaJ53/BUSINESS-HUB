import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

// Initialize admin if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Triggered whenever a staff document is created or updated.
 * Packs the permission matrix into custom claims for short-circuiting rules.
 */
export const onStaffWrite = onDocumentWritten("shops/{shopId}/staff/{uid}", async (event) => {
  const shopId = event.params.shopId;
  const uid = event.params.uid;

  // If document was deleted, remove claims (or just handle missing data)
  if (!event.data?.after.exists) {
    console.log(`Staff ${uid} deleted. Removing custom claims.`);
    try {
      await admin.auth().setCustomUserClaims(uid, null);
    } catch (err) {
      console.error("Error removing custom claims:", err);
    }
    return;
  }

  const data = event.data.after.data();
  const permissions = data?.permissions || {};

  // Pack permissions into a compact object for claims
  // We only include 'true' or objects (like price limits) to save space
  const perms: any = {};
  
  for (const modId in permissions) {
    const modActions = permissions[modId];
    if (typeof modActions === 'object' && modActions !== null) {
      const activeActions: any = {};
      let hasActions = false;
      
      for (const actId in modActions) {
        const val = modActions[actId];
        if (val === true || (typeof val === 'object' && val !== null)) {
          activeActions[actId] = val;
          hasActions = true;
        }
      }
      
      if (hasActions) {
        perms[modId] = activeActions;
      }
    }
  }

  console.log(`Setting custom claims for staff ${uid} in shop ${shopId}`, perms);

  try {
    await admin.auth().setCustomUserClaims(uid, {
      shopId,
      perms
    });
  } catch (err) {
    console.error("Error setting custom claims:", err);
  }
});
