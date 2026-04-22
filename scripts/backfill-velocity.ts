import * as admin from 'firebase-admin';
import { parseArgs } from 'util';

/**
 * Backfill script to compute inventory velocity, ABC/XYZ classification, and ROP.
 * Usage: npx tsx scripts/backfill-velocity.ts --shopId <ID>
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

  // Initialize Firebase Admin
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  const db = admin.firestore();
  console.log(`Starting velocity backfill for shop: ${shopId}`);

  const now = new Date();
  const getPastDate = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  const windows = {
    "7d": getPastDate(7),
    "30d": getPastDate(30),
    "90d": getPastDate(90)
  };

  // 1. Fetch sales from the last 90 days
  const salesSnapshot = await db.collection(`shops/${shopId}/sales`)
    .where("date", ">=", windows["90d"])
    .get();

  const sales = salesSnapshot.docs.map(d => d.data());
  console.log(`Analyzing ${sales.length} sales for velocity...`);

  // 2. Aggregate sales by item
  const itemStats: Record<string, {
    units: { "7d": number; "30d": number; "90d": number };
    revenue: number;
    dailySales: number[];
  }> = {};

  const getItemStats = (id: string) => {
    if (!itemStats[id]) {
      itemStats[id] = {
        units: { "7d": 0, "30d": 0, "90d": 0 },
        revenue: 0,
        dailySales: new Array(90).fill(0)
      };
    }
    return itemStats[id];
  };

  for (const sale of sales) {
    const saleDate = new Date(sale.date);
    const daysAgo = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysAgo < 0 || daysAgo >= 90) continue;

    for (const item of (sale.items || [])) {
      const stats = getItemStats(item.itemId);
      const qty = item.quantity || 0;
      const rev = (item.price || 0) * qty;

      stats.units["90d"] += qty;
      stats.dailySales[daysAgo] += qty;
      stats.revenue += rev;

      if (daysAgo < 30) stats.units["30d"] += qty;
      if (daysAgo < 7) stats.units["7d"] += qty;
    }
  }

  // 3. Fetch Inventory Items
  const inventorySnapshot = await db.collection(`shops/${shopId}/inventory`).get();
  const items = inventorySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  // 4. ABC Classification (By Revenue)
  const sortedByRevenue = [...items].sort((a, b) => {
    const revA = itemStats[a.id]?.revenue || 0;
    const revB = itemStats[b.id]?.revenue || 0;
    return revB - revA;
  });

  const totalShopRevenue = sortedByRevenue.reduce((sum, item) => sum + (itemStats[item.id]?.revenue || 0), 0);
  let cumulativeRevenue = 0;

  // 5. Final Calculation loop
  const batch = db.batch();
  let batchCount = 0;

  for (const item of sortedByRevenue) {
    const stats = itemStats[item.id] || { units: { "7d": 0, "30d": 0, "90d": 0 }, revenue: 0, dailySales: new Array(90).fill(0) };
    
    // ABC
    cumulativeRevenue += stats.revenue;
    const revenuePct = totalShopRevenue > 0 ? (cumulativeRevenue / totalShopRevenue) : 1;
    const abc = revenuePct <= 0.8 ? "A" : revenuePct <= 0.95 ? "B" : "C";

    // XYZ (Coefficient of Variation)
    const dailyAvg = stats.units["90d"] / 90;
    let variance = 0;
    if (stats.units["90d"] > 0) {
      variance = stats.dailySales.reduce((sum, val) => sum + Math.pow(val - dailyAvg, 2), 0) / 90;
    }
    const sigma = Math.sqrt(variance);
    const cv = dailyAvg > 0 ? (sigma / dailyAvg) : 99;
    const xyz = cv < 0.5 ? "X" : cv < 1.0 ? "Y" : "Z";

    // Lead time metrics
    const daysOfCover = (item.stock || 0) > 0 && dailyAvg > 0 ? (item.stock / dailyAvg) : 0;
    const leadTime = 7;
    const safetyStock = 3 * sigma;
    const reorderPoint = Math.ceil(dailyAvg * leadTime + safetyStock);
    
    const holdingCost = (item.price || 1) * 0.2;
    const orderingCost = 100;
    const annualDemand = dailyAvg * 365;
    const eoq = holdingCost > 0 ? Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost)) : 0;

    // Status
    let status = "dead";
    if (stats.units["7d"] > 0) status = "fast";
    else if (stats.units["30d"] > 0) status = "medium";
    else if (stats.units["90d"] > 0) status = "slow";

    const velocity = {
      last7d: stats.units["7d"],
      last30d: stats.units["30d"],
      last90d: stats.units["90d"],
      dailyAvg: Number(dailyAvg.toFixed(2)),
      daysOfCover: Number(daysOfCover.toFixed(1)),
      reorderPoint,
      eoq,
      status,
      abc,
      xyz,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    batch.update(db.doc(`shops/${shopId}/inventory/${item.id}`), { velocity });
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`Committed batch of 400 items...`);
      // No need to reset batchCount if we just want to stop, 
      // but in a script we should probably just keep going.
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Velocity backfill completed for ${batchCount} items.`);
}

main().catch(err => {
  console.error('Velocity backfill failed:', err);
  process.exit(1);
});
