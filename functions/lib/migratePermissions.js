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
exports.migratePermissions = void 0;
const admin = __importStar(require("firebase-admin"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const chunkArray = (array, size) => {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
};
const migratePermissions = async () => {
    const db = admin.firestore();
    console.info('🚀 --- Starting Permissions Migration (v2 Matrix Architecture) ---');
    try {
        const shopsSnap = await db.collection('shops').get();
        console.info(`📦 Found ${shopsSnap.size} workspaces to process.`);
        let totalMigrated = 0;
        for (const shopDoc of shopsSnap.docs) {
            const shopId = shopDoc.id;
            const staffColl = db.collection(`shops/${shopId}/staff`);
            const staffSnap = await staffColl.get();
            if (staffSnap.empty)
                continue;
            const staffChunks = chunkArray(staffSnap.docs, 450);
            for (const [chunkIndex, chunk] of staffChunks.entries()) {
                const batch = db.batch();
                let hasChanges = false;
                for (const staffDoc of chunk) {
                    const data = staffDoc.data();
                    const legacyPermissions = data.permissions;
                    if (!legacyPermissions || !Array.isArray(legacyPermissions)) {
                        continue;
                    }
                    const matrix = {};
                    legacyPermissions.forEach((p) => {
                        switch (p) {
                            case 'inventory':
                            case 'stock-alerts':
                                matrix.inventory = matrix.inventory || {};
                                matrix.inventory.view = true;
                                break;
                            case 'sell':
                                matrix.sales = matrix.sales || {};
                                matrix.sales.view = true;
                                matrix.sales.create = true;
                                break;
                            case 'history':
                                matrix.sales = matrix.sales || {};
                                matrix.sales.view = true;
                                break;
                            case 'customers':
                                matrix.customers = matrix.customers || {};
                                matrix.customers.view = true;
                                matrix.customers.create = true;
                                matrix.customers.edit = true;
                                break;
                            case 'expenses':
                                matrix.expenses = matrix.expenses || {};
                                matrix.expenses.view = true;
                                matrix.expenses.create = true;
                                break;
                            case 'analytics':
                            case 'dashboard':
                                matrix.analytics = matrix.analytics || {};
                                matrix.analytics.view = true;
                                break;
                            case 'team':
                                matrix.team = matrix.team || {};
                                matrix.team.view = true;
                                break;
                            default:
                                console.warn(`⚠️ Unknown legacy permission [${p}] found for user ${staffDoc.id}`);
                        }
                    });
                    batch.update(staffDoc.ref, {
                        permissions: matrix,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    hasChanges = true;
                    totalMigrated++;
                }
                if (hasChanges) {
                    await batch.commit();
                    console.info(`✅ Migrated chunk ${chunkIndex + 1}/${staffChunks.length} for workspace: ${shopId}`);
                }
            }
        }
        console.info(`🎉 Successfully migrated ${totalMigrated} total staff members.`);
        console.info('🏁 --- Migration Complete ---');
    }
    catch (error) {
        console.error('❌ [FATAL] Migration failed mid-execution:', error);
        throw error;
    }
};
exports.migratePermissions = migratePermissions;
//# sourceMappingURL=migratePermissions.js.map