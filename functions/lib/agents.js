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
exports.runAgent = exports.agentTool = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
async function checkPermission(shopId, uid, module, action) {
    const staffDoc = await admin.firestore().doc(`shops/${shopId}/staff/${uid}`).get();
    if (!staffDoc.exists)
        return false;
    const staff = staffDoc.data();
    if (!staff)
        return false;
    if (staff.role === 'admin')
        return true;
    const permissions = staff.permissions || {};
    const modPerms = permissions[module] || {};
    const actPerms = modPerms[action];
    return actPerms === true || (typeof actPerms === 'object' && actPerms !== null);
}
exports.agentTool = (0, https_1.onCall)({
    maxInstances: 2
}, async (request) => {
    var _a;
    const { shopId, toolName, args } = request.data;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid || !shopId) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const db = admin.firestore();
    switch (toolName) {
        case "getInventory": {
            if (!(await checkPermission(shopId, uid, "inventory", "view"))) {
                throw new https_1.HttpsError("permission-denied", "Agent lacks 'inventory.view' privilege");
            }
            const snap = await db.collection(`shops/${shopId}/inventory`).get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        case "getVelocity": {
            if (!(await checkPermission(shopId, uid, "analytics", "view"))) {
                throw new https_1.HttpsError("permission-denied", "Agent lacks 'analytics.view' privilege");
            }
            const snap = await db.collection(`shops/${shopId}/inventory`).get();
            return snap.docs.map(d => ({ id: d.id, name: d.data().name, velocity: d.data().velocity }));
        }
        case "draftPurchaseOrder": {
            if (!(await checkPermission(shopId, uid, "inventory", "create"))) {
                throw new https_1.HttpsError("permission-denied", "Agent lacks 'inventory.create' privilege (required for drafting POs)");
            }
            const poId = `PO-${Date.now()}`;
            const poData = {
                ...args,
                id: poId,
                status: 'draft',
                createdAt: new Date().toISOString(),
                createdBy: 'AIAgent'
            };
            await db.collection(`shops/${shopId}/purchase_orders`).doc(poId).set(poData);
            return { success: true, poId };
        }
        case "getSalesAnomalies": {
            if (!(await checkPermission(shopId, uid, "analytics", "view"))) {
                throw new https_1.HttpsError("permission-denied", "Agent lacks 'analytics.view' privilege");
            }
            const snap = await db.collection(`shops/${shopId}/sales`)
                .where("date", ">=", new Date(Date.now() - 86400000).toISOString().split('T')[0])
                .get();
            const sales = snap.docs.map(d => d.data());
            return sales.filter(s => s.discount > 500 || s.total < 0);
        }
        case "sendWhatsappReminder": {
            if (!(await checkPermission(shopId, uid, "customers", "edit"))) {
                throw new https_1.HttpsError("permission-denied", "Agent lacks 'customers.edit' privilege");
            }
            const qId = `MSG-${Date.now()}`;
            await db.collection(`shops/${shopId}/outbound_queue`).doc(qId).set({
                ...args,
                type: 'WHATSAPP',
                status: 'pending_approval',
                createdAt: new Date().toISOString()
            });
            return { success: true, queueId: qId };
        }
        case "getOutstandingCredit": {
            if (!(await checkPermission(shopId, uid, "customers", "view"))) {
                throw new https_1.HttpsError("permission-denied", "Agent lacks 'customers.view' privilege");
            }
            const snap = await db.collection(`shops/${shopId}/customers`).where("balance", ">", 0).get();
            return snap.docs.map(d => d.data());
        }
        default:
            throw new https_1.HttpsError("invalid-argument", `Unknown tool: ${toolName}`);
    }
});
exports.runAgent = (0, https_1.onCall)({
    maxInstances: 2
}, async (request) => {
    var _a;
    const { shopId, agentName } = request.data;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid || !shopId) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    const possiblePaths = [
        path.join(__dirname, `../agents/${agentName}.md`),
        path.join(__dirname, `../../agents/${agentName}.md`),
        path.join(process.cwd(), `agents/${agentName}.md`)
    ];
    let systemPrompt = "";
    let found = false;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            systemPrompt = fs.readFileSync(p, "utf-8");
            found = true;
            break;
        }
    }
    if (!found) {
        throw new https_1.HttpsError("not-found", `Agent ${agentName} definition not found on server.`);
    }
    const runId = `RUN-${Date.now()}`;
    const runRef = admin.firestore().doc(`shops/${shopId}/agent_runs/${runId}`);
    await runRef.set({
        agentName,
        status: 'running',
        startedBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const logEvent = async (type, message, data) => {
        await runRef.collection("events").add({
            type,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    };
    try {
        await logEvent("thinking", `Agent '${agentName}' starting work...`);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            systemInstruction: systemPrompt
        });
        const result = await model.generateContent("Starting your assigned shift. Analyze the situation and determine which tools you need.");
        const responseText = result.response.text();
        await logEvent("thinking", responseText);
        await runRef.update({ status: 'completed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { success: true, runId };
    }
    catch (err) {
        console.error(err);
        await logEvent("error", err.message);
        await runRef.update({ status: 'failed', error: err.message });
        throw new https_1.HttpsError("internal", err.message);
    }
});
//# sourceMappingURL=agents.js.map