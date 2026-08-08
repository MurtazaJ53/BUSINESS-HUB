import admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';

// Initialize the Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const [, , shopId, pin] = process.argv;

if (!shopId || !pin) {
  console.error('Usage: npx tsx scripts/seed-admin-pin.ts <shopId> <pin>');
  process.exit(1);
}

async function seed() {
  try {
    const hash = bcrypt.hashSync(pin, 12);
    await admin.firestore().doc(`shops/${shopId}/private/auth`).set({
      adminPinHash: hash,
      createdAt: Date.now()
    });
    console.log(`Successfully seeded admin PIN for shop: ${shopId}`);
  } catch (err) {
    console.error('Error seeding admin PIN:', err);
    process.exit(1);
  }
}

seed();
