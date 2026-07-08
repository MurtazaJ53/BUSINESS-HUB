import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteField, updateDoc, writeBatch } from 'firebase/firestore';

// NOTE: You must provide your firebase config here if running locally
const firebaseConfig = {
  // your config
};

async function migrateInventory(shopId: string) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  const invRef = collection(db, `shops/${shopId}/inventory`);
  const snapshot = await getDocs(invRef);
  
  console.log(`Found ${snapshot.size} items to check...`);
  
  for (const d of snapshot.docs) {
    const data = d.data();
    if (data.costPrice !== undefined) {
      console.log(`Migrating item ${d.id} (${data.name})...`);
      
      // 1. Move to inventory_private
      await setDoc(doc(db, `shops/${shopId}/inventory_private`, d.id), {
        id: d.id,
        costPrice: data.costPrice,
        lastPurchaseDate: data.lastPurchaseDate || new Date().toISOString()
      }, { merge: true });
      
      // 2. Delete from public inventory
      await updateDoc(doc(db, `shops/${shopId}/inventory`, d.id), {
        costPrice: deleteField()
      });
      
      console.log(`Done for ${d.id}`);
    }
  }
  
  console.log('Migration complete.');
}
