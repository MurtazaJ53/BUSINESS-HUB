/// Mobile sync direction:
/// - local SQLite is authoritative for UI reads
/// - backend command APIs are the target commerce write path
/// - reads can remain mixed during migration, but writes are queued locally first
///   and replayed as commands in the background
final class SyncStrategy {
  const SyncStrategy._();

  static const localFirst = true;
  static const conflictModel = 'command-replay-with-domain-epoch-guard';
  static const queueName = 'commerce_outbox';
}
