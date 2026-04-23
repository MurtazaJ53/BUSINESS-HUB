import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

/**
 * Firestore Security Rules Assertions
 * 
 * Verifies the Phase 0.5 hardening:
 * 1. Strictly blocked access to /private vault.
 * 2. Split staff write: allowed self-update for non-sensitive fields only.
 * 3. Base membership restrictions.
 */
describe("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "business-hub-rules-test",
      firestore: {
        // Path relative to this test file: ../../firestore.rules
        rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  it("denies access to /private vault for all direct client reads (even admins)", async () => {
    const admin = testEnv.authenticatedContext("admin_uid", { shopId: "shop1" });
    await assertFails(getDoc(doc(admin.firestore(), "shops/shop1/private/auth")));
  });

  it("allows staff members to update their own non-sensitive fields", async () => {
    const alice = testEnv.authenticatedContext("alice_uid", { shopId: "shop1" });
    
    // Seed database without rules restriction
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "shops/shop1/staff/alice_uid"), {
        name: "Alice",
        role: "staff",
        salary: 1000,
        phone: "1234567890"
      });
    });

    // SUCCESS: Updating name/phone
    await assertSucceeds(updateDoc(doc(alice.firestore(), "shops/shop1/staff/alice_uid"), {
      name: "Alice Updated",
      phone: "0987654321"
    }));

    // FAILURE: Attempting to update role
    await assertFails(updateDoc(doc(alice.firestore(), "shops/shop1/staff/alice_uid"), {
      role: "admin"
    }));
    
    // FAILURE: Attempting to update salary
    await assertFails(updateDoc(doc(alice.firestore(), "shops/shop1/staff/alice_uid"), {
      salary: 5000
    }));
    
    // FAILURE: Attempting to update permissions (if they existed)
    await assertFails(updateDoc(doc(alice.firestore(), "shops/shop1/staff/alice_uid"), {
      permissions: { inventory: { edit: true } }
    }));
  });

  it("blocks all access for unauthenticated users", async () => {
    const rando = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(rando.firestore(), "shops/shop1/inventory/item1")));
  });

  it("enforces shop membership for data access", async () => {
    const bob = testEnv.authenticatedContext("bob_uid", { shopId: "shop2" });
    // Bob belongs to shop2, trying to read shop1
    await assertFails(getDoc(doc(bob.firestore(), "shops/shop1/inventory/item1")));
  });
});
