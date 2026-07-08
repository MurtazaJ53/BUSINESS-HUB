import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

export const emitOperationsHeartbeat = onSchedule({
  schedule: "every 15 minutes",
  memory: "256MiB",
  maxInstances: 1,
}, async () => {
  const jobsSnapshot = await db.collectionGroup("jobs").get();
  const summary = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };

  jobsSnapshot.forEach((docSnap) => {
    const status = String(docSnap.data().status || "queued") as keyof typeof summary;
    if (status in summary) summary[status] += 1;
  });

  await db.doc("platform/observability/functions").set({
    jobs: summary,
    heartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
    scannedJobDocs: jobsSnapshot.size,
    region: "us-central1",
  }, { merge: true });
});
