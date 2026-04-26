import * as admin from 'firebase-admin';
import { parseArgs } from 'util';

/**
 * Backfill script to populate aggregates_daily from historical sales.
 * Usage: npx tsx scripts/backfill-aggregates.ts --shopId <ID>
 */

async function main() {
  const { values } = parseArgs({
    options: {
      shopId: { type: 'string' },
    },
  });

  const shopId = values.shopId;
  if (!shopId) {
    console.error('Error: --shopId is required');
    process.exit(1);
  }

  // Initialize Firebase Admin (Assumes GOOGLE_APPLICATION_CREDENTIALS or local ADC)
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  console.log(`Starting backfill for shop: ${shopId}`);

  // 1. Fetch all source rows for the shop
  const [salesSnapshot, expensesSnapshot, customerPaymentsSnapshot] = await Promise.all([
    db.collection(`shops/${shopId}/sales`).orderBy('date').get(),
    db.collection(`shops/${shopId}/expenses`).orderBy('date').get(),
    db.collection(`shops/${shopId}/customer_payments`).orderBy('date').get(),
  ]);
  console.log(`Found ${salesSnapshot.size} sales, ${expensesSnapshot.size} expenses, ${customerPaymentsSnapshot.size} customer payments.`);

  const dailyGroups: Record<string, any[]> = {};

  salesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const date = (data.date || '').split('T')[0];
    if (!date) return;
    
    if (!dailyGroups[date]) dailyGroups[date] = [];
    dailyGroups[date].push(data);
  });

  expensesSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const date = (data.date || '').split('T')[0];
    if (!date) return;
    if (!dailyGroups[date]) dailyGroups[date] = [];
    dailyGroups[date].push({ __kind: 'expense', ...data });
  });

  customerPaymentsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const date = (data.date || '').split('T')[0];
    if (!date) return;
    if (!dailyGroups[date]) dailyGroups[date] = [];
    dailyGroups[date].push({ __kind: 'customer_payment', ...data });
  });

  // 2. Process each day
  for (const [date, sales] of Object.entries(dailyGroups)) {
    console.log(`Processing ${date} (${sales.length} sales)`);

    let revenue = 0;
    let cogs = 0;
    let expenseTotal = 0;
    let customerPaymentTotal = 0;
    let txCount = 0;
    const unitsByCategory: Record<string, number> = {};
    const paymentMix: Record<string, number> = {};

    sales.forEach(sale => {
      if (sale.__kind === 'expense') {
        expenseTotal += sale.amount || 0;
        return;
      }
      if (sale.__kind === 'customer_payment') {
        customerPaymentTotal += sale.amount || 0;
        return;
      }

      revenue += sale.total || 0;
      txCount += 1;
      
      (sale.items || []).forEach((item: any) => {
        const qty = item.quantity || 0;
        cogs += (item.costPrice || 0) * qty;
        const cat = item.category || 'Uncategorized';
        unitsByCategory[cat] = (unitsByCategory[cat] || 0) + qty;
      });

      (sale.payments || []).forEach((pay: any) => {
        const mode = pay.mode || 'OTHERS';
        paymentMix[mode] = (paymentMix[mode] || 0) + (pay.amount || 0);
      });
      
      // Legacy fallback
      if ((sale.payments || []).length === 0 && sale.paymentMode) {
        paymentMix[sale.paymentMode] = (paymentMix[sale.paymentMode] || 0) + (sale.total || 0);
      }
    });

    const aggregateData = {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      txCount,
      expenseTotal,
      customerPaymentTotal,
      unitsByCategory,
      paymentMix,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.doc(`shops/${shopId}/aggregates_daily/${date}`).set(aggregateData);
  }

  console.log('Backfill completed successfully.');
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
