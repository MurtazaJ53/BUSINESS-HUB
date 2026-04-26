import * as admin from 'firebase-admin';
import { onCall } from "firebase-functions/v2/https";
import { migratePermissions } from "./migratePermissions";

import { setGlobalOptions } from "firebase-functions/v2";

// Initialize the Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

setGlobalOptions({ 
  region: "us-central1",
  maxInstances: 50,
  cpu: 1,
  memory: "512MiB"
});

// v2 Firestore Triggers
export { onStaffWrite } from "./staff-claims";
export { onSaleWrite } from "./aggregates";
export {
  onAttendanceWriteSummary,
  onCustomerPaymentWriteSummary,
  onCustomerWriteSummary,
  onExpenseWriteSummary,
} from "./summaries";
export { onBackgroundJobWrite } from "./jobs";
export { emitOperationsHeartbeat } from "./observability";

// v2 Background Computations
export { computeVelocity } from "./velocity";
export { onAlertCreated } from "./messaging";

// v2 AI & Agents
export { agentTool, runAgent } from "./agents";

// v2 Security & Identity
export { redeemAdminPin } from "./redeemAdminPin";
export { setAdminPin } from "./setAdminPin";
export { adminSequesterData } from "./adminSequesterData";

// Administrative Utilities
export const runPermissionsMigration = onCall({
  memory: "512MiB", 
  maxInstances: 1,
  timeoutSeconds: 540 
}, async (request) => {
  // Allow the workspace owner or shop admins to trigger migration
  if (!request.auth) {
    throw new Error("Unauthenticated.");
  }
  
  await migratePermissions();
  return { success: true };
});
