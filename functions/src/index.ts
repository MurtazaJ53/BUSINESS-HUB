import * as admin from 'firebase-admin';

// Initialize the Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { onStaffWrite } from "./staff-claims";
export { onSaleWrite } from "./aggregates";
export { computeVelocity } from "./velocity";
export { agentTool, runAgent } from "./agents";
export { onAlertCreated } from "./messaging";
export { redeemAdminPin } from "./redeemAdminPin";
