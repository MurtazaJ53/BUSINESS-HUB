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
 */
describe("Firestore Security Rules", () => {
  let testEnv: RulesTestEnvironment | undefined;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "business-hub-rules-test",
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testEnv) {
      throw new Error("Firestore rules test environment did not initialize. Make sure the Firestore emulator is running.");
    }
    await testEnv.clearFirestore();
  });

  it("denies access to /private vault for all direct client reads", async () => {
    const admin = testEnv.authenticatedContext("admin_uid", { shopId: "shop1" });
    await assertFails(getDoc(doc(admin.firestore(), "shops/shop1/private/auth")));
  });

  it("prevents staff from self-promoting to admin or changing sensitive fields", async () => {
    const alice = testEnv.authenticatedContext("alice_uid", { shopId: "shop1" });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "shops/shop1/staff/alice_uid"), {
        name: "Alice",
        role: "staff",
        salary: 1000
      });
    });

    // Fails: self-promotion
    await assertFails(updateDoc(doc(alice.firestore(), "shops/shop1/staff/alice_uid"), {
      role: "admin"
    }));
    
    // Fails: salary change
    await assertFails(updateDoc(doc(alice.firestore(), "shops/shop1/staff/alice_uid"), {
      salary: 5000
    }));
  });

  it("enforces discount limits based on custom claims or staff permissions", async () => {
    const manager = testEnv.authenticatedContext("manager_uid", { 
      shopId: "shop1", 
      perms: { sales: { create: true, override_price: { max: 100 } } } 
    });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "shops/shop1/staff/manager_uid"), {
        role: "staff",
        permissions: { sales: { create: true, override_price: { max: 100 } } }
      });
    });

    // Succeeds: within limit
    await assertSucceeds(setDoc(doc(manager.firestore(), "shops/shop1/sales/sale1"), {
      total: 1000,
      discount: 50,
      updatedAt: Date.now()
    }));

    // Fails: exceeding limit
    await assertFails(setDoc(doc(manager.firestore(), "shops/shop1/sales/sale2"), {
      total: 1000,
      discount: 150,
      updatedAt: Date.now()
    }));
  });

  it("denies setting inventory stock to negative values", async () => {
    const admin = testEnv.authenticatedContext("admin_uid", { shopId: "shop1" });
    
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "shops/shop1/staff/admin_uid"), { role: "admin" });
      await setDoc(doc(context.firestore(), "shops/shop1/inventory/item1"), { name: "Test", stock: 10 });
    });

    // Fails: stock < 0
    await assertFails(updateDoc(doc(admin.firestore(), "shops/shop1/inventory/item1"), {
      stock: -1
    }));
  });

  it("blocks all access for unauthenticated users (Anonymous Denied)", async () => {
    const rando = testEnv.unauthenticatedContext();
    await assertFails(getDoc(doc(rando.firestore(), "shops/shop1/inventory/item1")));
  });

  it("enforces shop isolation (cannot read other shop data)", async () => {
    const bob = testEnv.authenticatedContext("bob_uid", { shopId: "shop2" });
    await assertFails(getDoc(doc(bob.firestore(), "shops/shop1/inventory/item1")));
  });
});
