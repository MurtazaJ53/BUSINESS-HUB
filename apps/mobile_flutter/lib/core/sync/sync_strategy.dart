/// Mobile sync direction:
/// - local SQLite is authoritative for UI reads
/// - Firestore is the cloud sync and sharing layer
/// - writes are queued locally first, then flushed in background
final class SyncStrategy {
  const SyncStrategy._();

  static const localFirst = true;
  static const conflictModel = 'last-write-wins-with-audit';
  static const queueName = 'mobile_outbox';
}
