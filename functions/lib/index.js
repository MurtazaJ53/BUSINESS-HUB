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
exports.runPermissionsMigration = exports.adminSequesterData = exports.setAdminPin = exports.redeemAdminPin = exports.runAgent = exports.agentTool = exports.onAlertCreated = exports.computeVelocity = exports.emitOperationsHeartbeat = exports.onBackgroundJobWrite = exports.onExpenseWriteSummary = exports.onCustomerWriteSummary = exports.onCustomerPaymentWriteSummary = exports.onAttendanceWriteSummary = exports.onSaleWrite = exports.onStaffWrite = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const migratePermissions_1 = require("./migratePermissions");
const v2_1 = require("firebase-functions/v2");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
(0, v2_1.setGlobalOptions)({
    region: "us-central1",
    maxInstances: 50,
    cpu: 1,
    memory: "512MiB"
});
var staff_claims_1 = require("./staff-claims");
Object.defineProperty(exports, "onStaffWrite", { enumerable: true, get: function () { return staff_claims_1.onStaffWrite; } });
var aggregates_1 = require("./aggregates");
Object.defineProperty(exports, "onSaleWrite", { enumerable: true, get: function () { return aggregates_1.onSaleWrite; } });
var summaries_1 = require("./summaries");
Object.defineProperty(exports, "onAttendanceWriteSummary", { enumerable: true, get: function () { return summaries_1.onAttendanceWriteSummary; } });
Object.defineProperty(exports, "onCustomerPaymentWriteSummary", { enumerable: true, get: function () { return summaries_1.onCustomerPaymentWriteSummary; } });
Object.defineProperty(exports, "onCustomerWriteSummary", { enumerable: true, get: function () { return summaries_1.onCustomerWriteSummary; } });
Object.defineProperty(exports, "onExpenseWriteSummary", { enumerable: true, get: function () { return summaries_1.onExpenseWriteSummary; } });
var jobs_1 = require("./jobs");
Object.defineProperty(exports, "onBackgroundJobWrite", { enumerable: true, get: function () { return jobs_1.onBackgroundJobWrite; } });
var observability_1 = require("./observability");
Object.defineProperty(exports, "emitOperationsHeartbeat", { enumerable: true, get: function () { return observability_1.emitOperationsHeartbeat; } });
var velocity_1 = require("./velocity");
Object.defineProperty(exports, "computeVelocity", { enumerable: true, get: function () { return velocity_1.computeVelocity; } });
var messaging_1 = require("./messaging");
Object.defineProperty(exports, "onAlertCreated", { enumerable: true, get: function () { return messaging_1.onAlertCreated; } });
var agents_1 = require("./agents");
Object.defineProperty(exports, "agentTool", { enumerable: true, get: function () { return agents_1.agentTool; } });
Object.defineProperty(exports, "runAgent", { enumerable: true, get: function () { return agents_1.runAgent; } });
var redeemAdminPin_1 = require("./redeemAdminPin");
Object.defineProperty(exports, "redeemAdminPin", { enumerable: true, get: function () { return redeemAdminPin_1.redeemAdminPin; } });
var setAdminPin_1 = require("./setAdminPin");
Object.defineProperty(exports, "setAdminPin", { enumerable: true, get: function () { return setAdminPin_1.setAdminPin; } });
var adminSequesterData_1 = require("./adminSequesterData");
Object.defineProperty(exports, "adminSequesterData", { enumerable: true, get: function () { return adminSequesterData_1.adminSequesterData; } });
exports.runPermissionsMigration = (0, https_1.onCall)({
    memory: "512MiB",
    maxInstances: 1,
    timeoutSeconds: 540
}, async (request) => {
    if (!request.auth) {
        throw new Error("Unauthenticated.");
    }
    await (0, migratePermissions_1.migratePermissions)();
    return { success: true };
});
//# sourceMappingURL=index.js.map