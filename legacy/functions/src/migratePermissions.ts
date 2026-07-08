import * as admin from "firebase-admin";

// Ensure initialization if running as a standalone script
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- 1. Strict Type Definitions ---
type LegacyPermission = 
  | 'inventory' | 'sell' | 'customers' | 'expenses' 
  | 'analytics' | 'team' | 'history' | 'dashboard' | 'stock-alerts';

interface ModuleActions {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
}

interface PermissionMatrix {
  inventory?: ModuleActions;
  sales?: ModuleActions;
  customers?: ModuleActions;
  expenses?: ModuleActions;
  analytics?: ModuleActions;
  team?: ModuleActions;
}

// Utility function to split large arrays into safe Firestore batch sizes
const chunkArray = <T>(array: T[], size: number): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

export const migratePermissions = async (): Promise<void> => {
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

      if (staffSnap.empty) continue;

      // 🛡️ CRITICAL FIX: Firestore limits batches to 500 operations. 
      // We chunk into 450 to leave a safe buffer.
      const staffChunks = chunkArray(staffSnap.docs, 450);

      for (const [chunkIndex, chunk] of staffChunks.entries()) {
        const batch = db.batch();
        let hasChanges = false;

        for (const staffDoc of chunk) {
          const data = staffDoc.data();
          const legacyPermissions = data.permissions;

          // Idempotency check: Skip if it's already an object (migrated) or missing
          if (!legacyPermissions || !Array.isArray(legacyPermissions)) {
            continue;
          }

          const matrix: PermissionMatrix = {};

          // --- 2. Clean Data Mapping ---
          (legacyPermissions as LegacyPermission[]).forEach((p) => {
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

          // --- 3. Atomic Update with Server Timestamp ---
          batch.update(staffDoc.ref, {
            permissions: matrix,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() // Prevents client clock skew
          });

          hasChanges = true;
          totalMigrated++;
        }

        // Commit the specific chunk
        if (hasChanges) {
          await batch.commit();
          console.info(`✅ Migrated chunk ${chunkIndex + 1}/${staffChunks.length} for workspace: ${shopId}`);
        }
      }
    }

    console.info(`🎉 Successfully migrated ${totalMigrated} total staff members.`);
    console.info('🏁 --- Migration Complete ---');

  } catch (error) {
    console.error('❌ [FATAL] Migration failed mid-execution:', error);
    throw error;
  }
};
