import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

/**
 * Triggered whenever a sale is created, updated, or deleted.
 * Updates the daily aggregates for the shop.
 */
export const onSaleWrite = onDocumentWritten({
  document: "shops/{shopId}/sales/{saleId}",
  maxInstances: 2
}, async (event) => {
  const shopId = event.params.shopId;
  const before = event.data?.before;
  const after = event.data?.after;

  // 1. Determine the impact of the change
  const beforeData = before?.exists ? before.data() : null;
  const afterData = after?.exists ? after.data() : null;

  // Use the date from the existing or new record (favoring after for moves, though date moves are rare)
  const saleDate = (afterData?.date || beforeData?.date || "").split("T")[0];
  if (!saleDate) return;

  const aggregateRef = admin.firestore().doc(`shops/${shopId}/aggregates_daily/${saleDate}`);

  // 2. Calculate deltas
  let deltaRevenue = 0;
  let deltaCogs = 0;
  let deltaGrossProfit = 0;
  let deltaTxCount = 0;
  const deltaUnitsByCategory: Record<string, number> = {};
  const deltaPaymentMix: Record<string, number> = {};

  if (afterData) {
    // Add new values
    deltaRevenue += afterData.total || 0;
    deltaTxCount += beforeData ? 0 : 1; // Only count if purely new
    
    for (const item of (afterData.items || [])) {
      const quantity = item.quantity || 0;
      const cost = (item.costPrice || 0) * quantity;
      deltaCogs += cost;
      
      // We assume category is in the sale item if denormalized, 
      // otherwise we'll have to default to 'Uncategorized' for now
      // or look it up (expensive). Based on our plan, we'll try to find it or use a default.
      const category = item.category || "Uncategorized";
      deltaUnitsByCategory[category] = (deltaUnitsByCategory[category] || 0) + quantity;
    }
    
    for (const pay of (afterData.payments || [])) {
      const mode = pay.mode || "OTHERS";
      deltaPaymentMix[mode] = (deltaPaymentMix[mode] || 0) + (pay.amount || 0);
    }
    // Fallback for legacy paymentMode if payments array is empty
    if ((afterData.payments || []).length === 0 && afterData.paymentMode) {
        deltaPaymentMix[afterData.paymentMode] = (deltaPaymentMix[afterData.paymentMode] || 0) + (afterData.total || 0);
    }
  }

  if (beforeData) {
    // Subtract old values
    deltaRevenue -= beforeData.total || 0;
    deltaTxCount -= afterData ? 0 : 1; // Only reduce if purely deleted
    
    for (const item of (beforeData.items || [])) {
      const quantity = item.quantity || 0;
      const cost = (item.costPrice || 0) * quantity;
      deltaCogs -= cost;
      
      const category = item.category || "Uncategorized";
      deltaUnitsByCategory[category] = (deltaUnitsByCategory[category] || 0) - quantity;
    }
    
    for (const pay of (beforeData.payments || [])) {
      const mode = pay.mode || "OTHERS";
      deltaPaymentMix[mode] = (deltaPaymentMix[mode] || 0) - (pay.amount || 0);
    }
    if ((beforeData.payments || []).length === 0 && beforeData.paymentMode) {
        deltaPaymentMix[beforeData.paymentMode] = (deltaPaymentMix[beforeData.paymentMode] || 0) - (beforeData.total || 0);
    }
  }

  deltaGrossProfit = deltaRevenue - deltaCogs;

  // 3. Construct update object
  const updates: any = {
    revenue: admin.firestore.FieldValue.increment(deltaRevenue),
    cogs: admin.firestore.FieldValue.increment(deltaCogs),
    grossProfit: admin.firestore.FieldValue.increment(deltaGrossProfit),
    txCount: admin.firestore.FieldValue.increment(deltaTxCount),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // Handle nested map increments
  for (const [cat, val] of Object.entries(deltaUnitsByCategory)) {
    if (val !== 0) {
      updates[`unitsByCategory.${cat}`] = admin.firestore.FieldValue.increment(val);
    }
  }
  for (const [mode, val] of Object.entries(deltaPaymentMix)) {
    if (val !== 0) {
      updates[`paymentMix.${mode}`] = admin.firestore.FieldValue.increment(val);
    }
  }

  // 4. Commit to Firestore
  try {
    await aggregateRef.set(updates, { merge: true });
    console.log(`Updated aggregate for ${shopId} on ${saleDate}`);
  } catch (err) {
    console.error(`Error updating aggregate for ${shopId}`, err);
  }
});
