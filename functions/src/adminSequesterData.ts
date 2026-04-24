import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * adminSequesterData
 * Atomic cleanup of sensitive data from standard staff-facing collections.
 * Moves Cost Prices, Salaries, and PINs to restricted 'private' collections.
 */
export const adminSequesterData = onCall({
  memory: "512MiB",
  timeoutSeconds: 300,
  maxInstances: 5
}, async (request) => {
  // 1. Authentication & Authorization Check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const { shopId } = request.data;
  const uid = request.auth.uid;

  if (!shopId) {
    throw new HttpsError("invalid-argument", "ShopID is required for isolation.");
  }

  const db = admin.firestore();
  
  // Verify Admin Status via Custom Claims
  if (request.auth.token.role !== 'admin' && request.auth.token.shopId !== shopId) {
     throw new HttpsError("permission-denied", "Only shop administrators can trigger sequestration.");
  }

  const stats = {
    inventoryMigrated: 0,
    staffMigrated: 0,
    shopKeys: false
  };

  try {
    const batch = db.batch();
    const base = `shops/${shopId}`;

    // --- PHASE 1: SEQUESTER INVENTORY COST PRICES ---
    const inventorySnap = await db.collection(`${base}/inventory`).get();
    inventorySnap.forEach(doc => {
      const data = doc.data();
      if (data.costPrice !== undefined) {
        // Move to private collection
        const privateRef = db.doc(`${base}/inventory_private/${doc.id}`);
        batch.set(privateRef, { 
          costPrice: data.costPrice,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Strip from public collection
        batch.update(doc.ref, { 
          costPrice: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        stats.inventoryMigrated++;
      }
    });

    // --- PHASE 2: SEQUESTER STAFF FINANCIALS & PINS ---
    const staffSnap = await db.collection(`${base}/staff`).get();
    staffSnap.forEach(doc => {
      const data = doc.data();
      if (data.salary !== undefined || data.pin !== undefined) {
        const privateRef = db.doc(`${base}/staff_private/${doc.id}`);
        batch.set(privateRef, {
          salary: data.salary || 0,
          pin: data.pin || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Strip from public collection
        batch.update(doc.ref, {
          salary: admin.firestore.FieldValue.delete(),
          pin: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        stats.staffMigrated++;
      }
    });

    // --- PHASE 3: SEQUESTER SHOP MASTER KEYS ---
    const shopRef = db.doc(`shops/${shopId}`);
    const shopSnap = await shopRef.get();
    if (shopSnap.exists) {
      const settings = shopSnap.data()?.settings || {};
      if (settings.adminPin || settings.staffPin) {
        const authRef = db.doc(`${base}/private/auth`);
        batch.set(authRef, {
          adminPin: settings.adminPin || "",
          staffPin: settings.staffPin || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Wipe from public settings
        batch.update(shopRef, {
          "settings.adminPin": admin.firestore.FieldValue.delete(),
          "settings.staffPin": admin.firestore.FieldValue.delete()
        });
        stats.shopKeys = true;
      }
    }

    // --- EXECUTE ATOMIC TRANSACTION ---
    await batch.commit();

    return {
      success: true,
      message: "Data successfully sequestered into private vaults.",
      stats
    };

  } catch (err: any) {
    console.error("[SEQUESTER_ERROR]", err);
    throw new HttpsError("internal", err.message || "Failed to complete sequestration.");
  }
});
