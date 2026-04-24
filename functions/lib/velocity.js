"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVelocity = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
exports.computeVelocity = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *",
    memory: "512MiB",
    maxInstances: 1
}, async (event) => {
    const db = admin.firestore();
    const shopsSnapshot = await db.collection("shops").get();
    for (const shopDoc of shopsSnapshot.docs) {
        const shopId = shopDoc.id;
        console.log(`Computing velocity for shop: ${shopId}`);
        try {
            await processShopVelocity(shopId);
        }
        catch (err) {
            console.error(`Failed to process velocity for shop ${shopId}`, err);
        }
    }
});
async function processShopVelocity(shopId) {
    const db = admin.firestore();
    const now = new Date();
    const getPastDate = (days) => {
        const d = new Date(now);
        d.setDate(d.getDate() - days);
        return d.toISOString();
    };
    const windows = {
        "7d": getPastDate(7),
        "30d": getPastDate(30),
        "90d": getPastDate(90)
    };
    const salesSnapshot = await db.collection(`shops/${shopId}/sales`)
        .where("date", ">=", windows["90d"])
        .get();
    const sales = salesSnapshot.docs.map(d => d.data());
    const itemStats = {};
    const getItemStats = (id) => {
        if (!itemStats[id]) {
            itemStats[id] = {
                units: { "7d": 0, "30d": 0, "90d": 0 },
                revenue: 0,
                dailySales: new Array(90).fill(0)
            };
        }
        return itemStats[id];
    };
    const ninetyDaysAgo = new Date(windows["90d"]);
    for (const sale of sales) {
        const saleDate = new Date(sale.date);
        const daysAgo = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysAgo < 0 || daysAgo >= 90)
            continue;
        for (const item of (sale.items || [])) {
            const stats = getItemStats(item.itemId);
            const qty = item.quantity || 0;
            const rev = (item.price || 0) * qty;
            stats.units["90d"] += qty;
            stats.dailySales[daysAgo] += qty;
            stats.revenue += rev;
            if (daysAgo < 30)
                stats.units["30d"] += qty;
            if (daysAgo < 7)
                stats.units["7d"] += qty;
        }
    }
    const inventorySnapshot = await db.collection(`shops/${shopId}/inventory`).get();
    const items = inventorySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const sortedByRevenue = [...items].sort((a, b) => {
        var _a, _b;
        const revA = ((_a = itemStats[a.id]) === null || _a === void 0 ? void 0 : _a.revenue) || 0;
        const revB = ((_b = itemStats[b.id]) === null || _b === void 0 ? void 0 : _b.revenue) || 0;
        return revB - revA;
    });
    const totalShopRevenue = sortedByRevenue.reduce((sum, item) => { var _a; return sum + (((_a = itemStats[item.id]) === null || _a === void 0 ? void 0 : _a.revenue) || 0); }, 0);
    let cumulativeRevenue = 0;
    const batch = db.batch();
    let batchCount = 0;
    for (const item of sortedByRevenue) {
        const stats = itemStats[item.id] || { units: { "7d": 0, "30d": 0, "90d": 0 }, revenue: 0, dailySales: new Array(90).fill(0) };
        cumulativeRevenue += stats.revenue;
        const revenuePct = totalShopRevenue > 0 ? (cumulativeRevenue / totalShopRevenue) : 1;
        const abc = revenuePct <= 0.8 ? "A" : revenuePct <= 0.95 ? "B" : "C";
        const dailyAvg = stats.units["90d"] / 90;
        let variance = 0;
        if (stats.units["90d"] > 0) {
            variance = stats.dailySales.reduce((sum, val) => sum + Math.pow(val - dailyAvg, 2), 0) / 90;
        }
        const sigma = Math.sqrt(variance);
        const cv = dailyAvg > 0 ? (sigma / dailyAvg) : 99;
        const xyz = cv < 0.5 ? "X" : cv < 1.0 ? "Y" : "Z";
        const daysOfCover = (item.stock || 0) > 0 && dailyAvg > 0 ? (item.stock / dailyAvg) : 0;
        const leadTime = 7;
        const safetyStock = 3 * sigma;
        const reorderPoint = Math.ceil(dailyAvg * leadTime + safetyStock);
        const holdingCost = (item.price || 1) * 0.2;
        const orderingCost = 100;
        const annualDemand = dailyAvg * 365;
        const eoq = holdingCost > 0 ? Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / holdingCost)) : 0;
        let status = "dead";
        if (stats.units["7d"] > 0)
            status = "fast";
        else if (stats.units["30d"] > 0)
            status = "medium";
        else if (stats.units["90d"] > 0)
            status = "slow";
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
        batch.set(db.doc(`shops/${shopId}/inventory/${item.id}`), { velocity }, { merge: true });
        batchCount++;
        if (batchCount >= 400) {
            await batch.commit();
        }
    }
    if (batchCount > 0) {
        await batch.commit();
    }
}
//# sourceMappingURL=velocity.js.map