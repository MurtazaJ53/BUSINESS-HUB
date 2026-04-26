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
exports.onAttendanceWriteSummary = exports.onExpenseWriteSummary = exports.onCustomerPaymentWriteSummary = exports.onCustomerWriteSummary = void 0;
exports.rebuildDashboardSnapshot = rebuildDashboardSnapshot;
exports.rebuildCustomerCreditSummaries = rebuildCustomerCreditSummaries;
exports.rebuildPayrollSummaries = rebuildPayrollSummaries;
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const toDateKey = (value) => {
    if (!value)
        return null;
    if (typeof value === "string")
        return value.slice(0, 10);
    if (value instanceof Date)
        return value.toISOString().slice(0, 10);
    return null;
};
const toMonthKey = (dateKey) => dateKey.slice(0, 7).replace("-", "");
const monthRangeFromKey = (monthKey) => {
    const normalized = monthKey && /^\d{6}$/.test(monthKey)
        ? `${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}`
        : new Date().toISOString().slice(0, 7);
    const start = `${normalized}-01`;
    const monthStart = new Date(`${start}T00:00:00.000Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    nextMonth.setUTCDate(0);
    return {
        monthKey: normalized.replace("-", ""),
        start,
        end: nextMonth.toISOString().slice(0, 10),
    };
};
const parseNumber = (value) => {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
};
const roundOne = (value) => Number(value.toFixed(1));
const applyDailyMetricDelta = async (shopId, dateKey, field, delta) => {
    if (!dateKey || delta === 0)
        return;
    await db.doc(`shops/${shopId}/aggregates_daily/${dateKey}`).set({
        [field]: admin.firestore.FieldValue.increment(delta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
};
const buildPaidAmountMap = (expenses, staffByName) => {
    expenses.forEach((docSnap) => {
        const data = docSnap.data();
        const description = String(data.description || "");
        for (const staff of staffByName.values()) {
            if (description.includes(staff.name)) {
                staff.paidAmount += parseNumber(data.amount);
            }
        }
    });
};
async function rebuildDashboardSnapshot(shopId) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const trailingStart = new Date();
    trailingStart.setUTCDate(trailingStart.getUTCDate() - 29);
    const trailingStartKey = trailingStart.toISOString().slice(0, 10);
    const monthStartKey = `${todayKey.slice(0, 7)}-01`;
    const [dailyAggs, monthExpenses] = await Promise.all([
        db.collection(`shops/${shopId}/aggregates_daily`)
            .where(firestore_1.FieldPath.documentId(), ">=", trailingStartKey)
            .where(firestore_1.FieldPath.documentId(), "<=", todayKey)
            .get(),
        db.collection(`shops/${shopId}/expenses`)
            .where("date", ">=", monthStartKey)
            .where("date", "<=", todayKey)
            .get(),
    ]);
    let trailingRevenue = 0;
    let trailingGrossProfit = 0;
    let trailingTxCount = 0;
    let todayRevenue = 0;
    let todayTxCount = 0;
    dailyAggs.forEach((docSnap) => {
        const data = docSnap.data();
        const revenue = parseNumber(data.revenue);
        const grossProfit = parseNumber(data.grossProfit);
        const txCount = parseNumber(data.txCount);
        trailingRevenue += revenue;
        trailingGrossProfit += grossProfit;
        trailingTxCount += txCount;
        if (docSnap.id === todayKey) {
            todayRevenue = revenue;
            todayTxCount = txCount;
        }
    });
    const monthExpenseTotal = monthExpenses.docs.reduce((sum, docSnap) => sum + parseNumber(docSnap.data().amount), 0);
    await db.doc(`shops/${shopId}/dashboard_snapshot/current`).set({
        trailing30dRevenue: Math.round(trailingRevenue),
        trailing30dGrossProfit: Math.round(trailingGrossProfit),
        trailing30dNetProfit: Math.round(trailingGrossProfit - monthExpenseTotal),
        trailing30dTxCount: trailingTxCount,
        todayRevenue: Math.round(todayRevenue),
        todayTxCount,
        monthExpenseTotal: Math.round(monthExpenseTotal),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
}
async function rebuildCustomerCreditSummaries(shopId, customerId) {
    const customersQuery = customerId
        ? db.collection(`shops/${shopId}/customers`).where(firestore_1.FieldPath.documentId(), "==", customerId)
        : db.collection(`shops/${shopId}/customers`);
    const snapshot = await customersQuery.get();
    if (snapshot.empty)
        return;
    const batch = db.batch();
    snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        batch.set(db.doc(`shops/${shopId}/customer_credit_summary/${docSnap.id}`), {
            customerId: docSnap.id,
            name: data.name || "",
            phone: data.phone || "",
            balance: parseNumber(data.balance),
            totalSpent: parseNumber(data.totalSpent),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await batch.commit();
}
async function rebuildPayrollSummaries(shopId, options = {}) {
    const { monthKey, staffIds } = options;
    const range = monthRangeFromKey(monthKey);
    const [staffDocs, privateDocs, attendanceDocs, expenseDocs] = await Promise.all([
        db.collection(`shops/${shopId}/staff`).get(),
        db.collection(`shops/${shopId}/staff_private`).get(),
        db.collection(`shops/${shopId}/attendance`)
            .where("date", ">=", range.start)
            .where("date", "<=", range.end)
            .get(),
        db.collection(`shops/${shopId}/expenses`)
            .where("date", ">=", range.start)
            .where("date", "<=", range.end)
            .get(),
    ]);
    const filterIds = (staffIds === null || staffIds === void 0 ? void 0 : staffIds.length) ? new Set(staffIds) : null;
    const privateById = new Map();
    privateDocs.forEach((docSnap) => {
        privateById.set(docSnap.id, parseNumber(docSnap.data().salary));
    });
    const staffById = new Map();
    const staffByName = new Map();
    staffDocs.forEach((docSnap) => {
        if (filterIds && !filterIds.has(docSnap.id))
            return;
        const data = docSnap.data();
        const seed = {
            id: docSnap.id,
            name: String(data.name || docSnap.id),
            role: data.role,
            salary: privateById.get(docSnap.id) || 0,
            fullDays: 0,
            halfDays: 0,
            absentDays: 0,
            leaveDays: 0,
            totalHours: 0,
            overtimeHours: 0,
            bonusTotal: 0,
            paidAmount: 0,
        };
        staffById.set(docSnap.id, seed);
        staffByName.set(seed.name, seed);
    });
    attendanceDocs.forEach((docSnap) => {
        const data = docSnap.data();
        const seed = staffById.get(String(data.staffId || ""));
        if (!seed)
            return;
        const status = String(data.status || "ABSENT");
        if (status === "PRESENT")
            seed.fullDays += 1;
        else if (status === "HALF_DAY")
            seed.halfDays += 1;
        else if (status === "LEAVE")
            seed.leaveDays += 1;
        else
            seed.absentDays += 1;
        seed.totalHours += parseNumber(data.totalHours);
        seed.overtimeHours += parseNumber(data.overtime);
        seed.bonusTotal += parseNumber(data.bonus);
    });
    buildPaidAmountMap(expenseDocs.docs.filter((docSnap) => {
        const category = String(docSnap.data().category || "");
        return category === "Staff Salary" || category === "Advance Salary";
    }), staffByName);
    const batch = db.batch();
    staffById.forEach((seed) => {
        const effectiveDays = seed.fullDays + seed.halfDays * 0.5;
        const dailyRate = seed.salary / 30;
        const hourlyRate = dailyRate / 9;
        const overtimePay = seed.overtimeHours * hourlyRate;
        const earned = Math.round((effectiveDays * dailyRate) + overtimePay + seed.bonusTotal);
        batch.set(db.doc(`shops/${shopId}/staff_payroll_summary/${seed.id}_${range.monthKey}`), {
            staffId: seed.id,
            monthKey: range.monthKey,
            staffName: seed.name,
            role: seed.role || "staff",
            baseSalary: seed.salary,
            effectiveDays,
            fullDays: seed.fullDays,
            halfDays: seed.halfDays,
            absentDays: seed.absentDays,
            leaveDays: seed.leaveDays,
            totalHours: roundOne(seed.totalHours),
            overtimeHours: roundOne(seed.overtimeHours),
            bonusTotal: Math.round(seed.bonusTotal),
            overtimePay: Math.round(overtimePay),
            earned,
            paidAmount: Math.round(seed.paidAmount),
            outstanding: Math.max(0, earned - Math.round(seed.paidAmount)),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    await batch.commit();
}
exports.onCustomerWriteSummary = (0, firestore_2.onDocumentWritten)({
    document: "shops/{shopId}/customers/{customerId}",
    maxInstances: 2,
}, async (event) => {
    await rebuildCustomerCreditSummaries(event.params.shopId, event.params.customerId);
});
exports.onCustomerPaymentWriteSummary = (0, firestore_2.onDocumentWritten)({
    document: "shops/{shopId}/customer_payments/{paymentId}",
    maxInstances: 2,
}, async (event) => {
    var _a, _b;
    const shopId = event.params.shopId;
    const afterData = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists) ? event.data.after.data() : null;
    const beforeData = ((_b = event.data) === null || _b === void 0 ? void 0 : _b.before.exists) ? event.data.before.data() : null;
    const beforeDate = toDateKey(beforeData === null || beforeData === void 0 ? void 0 : beforeData.date);
    const afterDate = toDateKey(afterData === null || afterData === void 0 ? void 0 : afterData.date);
    if (beforeDate && beforeDate === afterDate) {
        const delta = parseNumber(afterData === null || afterData === void 0 ? void 0 : afterData.amount) - parseNumber(beforeData === null || beforeData === void 0 ? void 0 : beforeData.amount);
        await applyDailyMetricDelta(shopId, afterDate, "customerPaymentTotal", delta);
    }
    else {
        await applyDailyMetricDelta(shopId, beforeDate, "customerPaymentTotal", -parseNumber(beforeData === null || beforeData === void 0 ? void 0 : beforeData.amount));
        await applyDailyMetricDelta(shopId, afterDate, "customerPaymentTotal", parseNumber(afterData === null || afterData === void 0 ? void 0 : afterData.amount));
    }
    await rebuildDashboardSnapshot(event.params.shopId);
});
exports.onExpenseWriteSummary = (0, firestore_2.onDocumentWritten)({
    document: "shops/{shopId}/expenses/{expenseId}",
    maxInstances: 2,
}, async (event) => {
    var _a, _b;
    const shopId = event.params.shopId;
    const afterData = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists) ? event.data.after.data() : null;
    const beforeData = ((_b = event.data) === null || _b === void 0 ? void 0 : _b.before.exists) ? event.data.before.data() : null;
    const beforeDate = toDateKey(beforeData === null || beforeData === void 0 ? void 0 : beforeData.date);
    const afterDate = toDateKey(afterData === null || afterData === void 0 ? void 0 : afterData.date);
    if (beforeDate && beforeDate === afterDate) {
        const delta = parseNumber(afterData === null || afterData === void 0 ? void 0 : afterData.amount) - parseNumber(beforeData === null || beforeData === void 0 ? void 0 : beforeData.amount);
        await applyDailyMetricDelta(shopId, afterDate, "expenseTotal", delta);
    }
    else {
        await applyDailyMetricDelta(shopId, beforeDate, "expenseTotal", -parseNumber(beforeData === null || beforeData === void 0 ? void 0 : beforeData.amount));
        await applyDailyMetricDelta(shopId, afterDate, "expenseTotal", parseNumber(afterData === null || afterData === void 0 ? void 0 : afterData.amount));
    }
    await rebuildDashboardSnapshot(shopId);
    const category = String((afterData === null || afterData === void 0 ? void 0 : afterData.category) || (beforeData === null || beforeData === void 0 ? void 0 : beforeData.category) || "");
    const payrollDates = new Set([beforeDate, afterDate].filter(Boolean));
    if (category === "Staff Salary" || category === "Advance Salary") {
        for (const payrollDate of payrollDates) {
            await rebuildPayrollSummaries(shopId, { monthKey: toMonthKey(payrollDate) });
        }
    }
});
exports.onAttendanceWriteSummary = (0, firestore_2.onDocumentWritten)({
    document: "shops/{shopId}/attendance/{attendanceId}",
    maxInstances: 2,
}, async (event) => {
    var _a, _b;
    const shopId = event.params.shopId;
    const afterData = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.after.exists) ? event.data.after.data() : null;
    const beforeData = ((_b = event.data) === null || _b === void 0 ? void 0 : _b.before.exists) ? event.data.before.data() : null;
    const dateKey = toDateKey((afterData === null || afterData === void 0 ? void 0 : afterData.date) || (beforeData === null || beforeData === void 0 ? void 0 : beforeData.date));
    const staffId = String((afterData === null || afterData === void 0 ? void 0 : afterData.staffId) || (beforeData === null || beforeData === void 0 ? void 0 : beforeData.staffId) || "");
    if (!dateKey || !staffId)
        return;
    await rebuildPayrollSummaries(shopId, {
        monthKey: toMonthKey(dateKey),
        staffIds: [staffId],
    });
});
//# sourceMappingURL=summaries.js.map