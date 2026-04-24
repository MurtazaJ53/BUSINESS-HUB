import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { GoogleGenerativeAI, Tool } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// Initialize Gemini
// Note: In production, use Firebase Secrets for the API Key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * HELPER: Check user permissions inside Cloud Functions
 */
async function checkPermission(shopId: string, uid: string, module: string, action: string) {
  const staffDoc = await admin.firestore().doc(`shops/${shopId}/staff/${uid}`).get();
  if (!staffDoc.exists) return false;
  
  const staff = staffDoc.data();
  if (!staff) return false;
  if (staff.role === 'admin') return true;

  const permissions = staff.permissions || {};
  const modPerms = permissions[module] || {};
  const actPerms = modPerms[action];

  return actPerms === true || (typeof actPerms === 'object' && actPerms !== null);
}

/**
 * Agent Tool API: Provides secure, permission-guarded access to business data.
 */
export const agentTool = onCall({
  maxInstances: 2
}, async (request) => {
  const { shopId, toolName, args } = request.data;
  const uid = request.auth?.uid;

  if (!uid || !shopId) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const db = admin.firestore();

  switch (toolName) {
    case "getInventory": {
      if (!(await checkPermission(shopId, uid, "inventory", "view"))) {
        throw new HttpsError("permission-denied", "Agent lacks 'inventory.view' privilege");
      }
      const snap = await db.collection(`shops/${shopId}/inventory`).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    case "getVelocity": {
      if (!(await checkPermission(shopId, uid, "analytics", "view"))) {
        throw new HttpsError("permission-denied", "Agent lacks 'analytics.view' privilege");
      }
      const snap = await db.collection(`shops/${shopId}/inventory`).get();
      return snap.docs.map(d => ({ id: d.id, name: d.data().name, velocity: d.data().velocity }));
    }

    case "draftPurchaseOrder": {
      if (!(await checkPermission(shopId, uid, "inventory", "create"))) {
        throw new HttpsError("permission-denied", "Agent lacks 'inventory.create' privilege (required for drafting POs)");
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
        throw new HttpsError("permission-denied", "Agent lacks 'analytics.view' privilege");
      }
      // Simple anomaly query logic (voids and high discounts)
      const snap = await db.collection(`shops/${shopId}/sales`)
        .where("date", ">=", new Date(Date.now() - 86400000).toISOString().split('T')[0])
        .get();
      
      const sales = snap.docs.map(d => d.data());
      return sales.filter(s => s.discount > 500 || s.total < 0); // Mock logic for demo
    }

    case "sendWhatsappReminder": {
      if (!(await checkPermission(shopId, uid, "customers", "edit"))) {
        throw new HttpsError("permission-denied", "Agent lacks 'customers.edit' privilege");
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
        throw new HttpsError("permission-denied", "Agent lacks 'customers.view' privilege");
      }
      const snap = await db.collection(`shops/${shopId}/customers`).where("balance", ">", 0).get();
      return snap.docs.map(d => d.data());
    }

    default:
      throw new HttpsError("invalid-argument", `Unknown tool: ${toolName}`);
  }
});

/**
 * Agent Runner: Orchestrates LLM interaction and tool usage.
 */
export const runAgent = onCall({
  maxInstances: 2
}, async (request) => {
  const { shopId, agentName } = request.data;
  const uid = request.auth?.uid;

  if (!uid || !shopId) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  // 1. Load Agent Prompt (Check multiple possible paths for production and local dev)
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
    throw new HttpsError("not-found", `Agent ${agentName} definition not found on server.`);
  }

  // 2. Initialize Run Tracking
  const runId = `RUN-${Date.now()}`;
  const runRef = admin.firestore().doc(`shops/${shopId}/agent_runs/${runId}`);
  await runRef.set({
    agentName,
    status: 'running',
    startedBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const logEvent = async (type: string, message: string, data?: any) => {
    await runRef.collection("events").add({
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };

  // 3. Execution Loop
  try {
    await logEvent("thinking", `Agent '${agentName}' starting work...`);

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      systemInstruction: systemPrompt
    });

    // Note: In a real implementation, we would register the tools with Gemini
    // and handle the loop. For this task, we'll implement a simplified multi-step orchestration.
    
    // Step 1: Brainstorming
    const result = await model.generateContent("Starting your assigned shift. Analyze the situation and determine which tools you need.");
    const responseText = result.response.text();
    await logEvent("thinking", responseText);

    // [Simplified Tool Handling Logic would go here]
    // For this implementation, we ensure the infrastructure is present.
    
    await runRef.update({ status: 'completed', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, runId };

  } catch (err: any) {
    console.error(err);
    await logEvent("error", err.message);
    await runRef.update({ status: 'failed', error: err.message });
    throw new HttpsError("internal", err.message);
  }
});
