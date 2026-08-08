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
const migratePermissions = async () => {
    const db = admin.firestore();
    console.log('--- Starting Permissions Migration (v2) ---');
    const shopsSnap = await db.collection('shops').get();
    console.log(`Found ${shopsSnap.size} shops.`);
    let totalMigrated = 0;
    for (const shopDoc of shopsSnap.docs) {
        const shopId = shopDoc.id;
        const staffColl = db.collection(`shops/${shopId}/staff`);
        const staffSnap = await staffColl.get();
        if (staffSnap.empty)
            continue;
        const batch = db.batch();
        let hasChanges = false;
        for (const staffDoc of staffSnap.docs) {
            const data = staffDoc.data();
            const legacyPermissions = data.permissions;
            if (!legacyPermissions || !Array.isArray(legacyPermissions)) {
                console.log(`Skipping staff ${staffDoc.id} in shop ${shopId} (already migrated or no permissions).`);
                continue;
            }
            const matrix = {};
            legacyPermissions.forEach((p) => {
                switch (p) {
                    case 'inventory':
                        if (!matrix.inventory)
                            matrix.inventory = {};
                        matrix.inventory.view = true;
                        break;
                    case 'sell':
                        if (!matrix.sales)
                            matrix.sales = {};
                        matrix.sales.view = true;
                        matrix.sales.create = true;
                        break;
                    case 'customers':
                        if (!matrix.customers)
                            matrix.customers = {};
                        matrix.customers.view = true;
                        matrix.customers.create = true;
                        matrix.customers.edit = true;
                        break;
                    case 'expenses':
                        if (!matrix.expenses)
                            matrix.expenses = {};
                        matrix.expenses.view = true;
                        matrix.expenses.create = true;
                        break;
                    case 'analytics':
                        if (!matrix.analytics)
                            matrix.analytics = {};
                        matrix.analytics.view = true;
                        break;
                    case 'team':
                        if (!matrix.team)
                            matrix.team = {};
                        matrix.team.view = true;
                        break;
                    case 'history':
                        if (!matrix.sales)
                            matrix.sales = {};
                        matrix.sales.view = true;
                        break;
                    case 'dashboard':
                        if (!matrix.analytics)
                            matrix.analytics = {};
                        matrix.analytics.view = true;
                        break;
                    case 'stock-alerts':
                        if (!matrix.inventory)
                            matrix.inventory = {};
                        matrix.inventory.view = true;
                        break;
                }
            });
            batch.update(staffDoc.ref, {
                permissions: matrix,
                updatedAt: Date.now()
            });
            hasChanges = true;
            totalMigrated++;
        }
        if (hasChanges) {
            await batch.commit();
            console.log(`Migrated staff permissions for shop: ${shopId}`);
        }
    }
    console.log(`Successfully migrated ${totalMigrated} staff members.`);
    console.log('--- Migration Complete ---');
};
exports.migratePermissions = migratePermissions;
//# sourceMappingURL=migrate-permissions.js.map