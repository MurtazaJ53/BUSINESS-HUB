import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../database/local_database.dart';

final backupServiceProvider = Provider<BackupService>((ref) {
  return BackupService(ref.watch(localDatabaseProvider));
});

/// Local backup / restore of the whole SQLite database.
///
/// Backups use SQLite `VACUUM INTO`, which writes a complete, consistent copy
/// of the live database into a new file (safe even while the app has it open).
/// Restore replaces the live database file and requires an app restart.
class BackupService {
  BackupService(this._db);

  final BusinessHubDatabase _db;

  static const String _dbFileName = 'business_hub_mobile.sqlite';

  Future<Directory> backupsDir() async {
    final base =
        (await getExternalStorageDirectory()) ??
        await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(base.path, 'business-hub-backups'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  /// Locate the live database file (drift_flutter stores it in the app
  /// documents or support directory depending on platform/version).
  Future<String> _liveDbPath() async {
    final candidates = <Directory>[
      await getApplicationDocumentsDirectory(),
      await getApplicationSupportDirectory(),
    ];
    for (final dir in candidates) {
      final file = File(p.join(dir.path, _dbFileName));
      if (await file.exists()) return file.path;
    }
    return p.join(candidates.first.path, _dbFileName);
  }

  String _timestamp() {
    final t = DateTime.now();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${t.year}${two(t.month)}${two(t.day)}-${two(t.hour)}${two(t.minute)}${two(t.second)}';
  }

  /// Create a full, consistent backup file. Returns the created file.
  Future<File> createBackup() async {
    final dir = await backupsDir();
    final path = p.join(dir.path, 'business-hub-${_timestamp()}.sqlite');
    // Escape single quotes for the SQL string literal.
    final escaped = path.replaceAll("'", "''");
    await _db.customStatement("VACUUM INTO '$escaped'");
    return File(path);
  }

  /// Newest-first list of existing backups.
  Future<List<File>> listBackups() async {
    final dir = await backupsDir();
    final files = dir
        .listSync()
        .whereType<File>()
        .where((f) => f.path.endsWith('.sqlite'))
        .toList();
    files.sort((a, b) => b.path.compareTo(a.path));
    return files;
  }

  Future<void> deleteBackup(File backup) async {
    if (await backup.exists()) {
      await backup.delete();
    }
  }

  // ---- CSV export ----------------------------------------------------------

  Future<Directory> exportsDir() async {
    final base =
        (await getExternalStorageDirectory()) ??
        await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(base.path, 'business-hub-exports'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  String _cell(Object? value) {
    final s = (value ?? '').toString();
    if (s.contains(',') || s.contains('"') || s.contains('\n')) {
      return '"${s.replaceAll('"', '""')}"';
    }
    return s;
  }

  String _row(List<Object?> cells) => cells.map(_cell).join(',');

  Future<File> _writeCsv(String name, String content) async {
    final dir = await exportsDir();
    final file = File(p.join(dir.path, '$name-${_timestamp()}.csv'));
    await file.writeAsString(content);
    return file;
  }

  Future<File> exportInventoryCsv() async {
    final rows = await _db.select(_db.inventoryEntries).get();
    final buf = StringBuffer()
      ..writeln(
        _row(<Object?>[
          'id',
          'name',
          'sku',
          'category',
          'price',
          'stock',
          'gst_rate',
          'archived',
        ]),
      );
    for (final r in rows) {
      buf.writeln(
        _row(<Object?>[
          r.id,
          r.name,
          r.sku,
          r.category,
          r.price,
          r.stock,
          r.gstRate,
          r.tombstone,
        ]),
      );
    }
    return _writeCsv('inventory', buf.toString());
  }

  Future<File> exportCustomersCsv() async {
    final rows = await _db.select(_db.customerEntries).get();
    final buf = StringBuffer()
      ..writeln(
        _row(<Object?>[
          'id',
          'name',
          'phone',
          'email',
          'balance_due',
          'total_spent',
          'status',
        ]),
      );
    for (final r in rows) {
      buf.writeln(
        _row(<Object?>[
          r.id,
          r.name,
          r.phone,
          r.email,
          r.balance,
          r.totalSpent,
          r.status,
        ]),
      );
    }
    return _writeCsv('customers', buf.toString());
  }

  Future<File> exportSalesCsv() async {
    final rows = await _db.select(_db.salesEntries).get();
    final buf = StringBuffer()
      ..writeln(
        _row(<Object?>[
          'id',
          'date',
          'total',
          'discount',
          'payment_mode',
          'customer_name',
          'customer_phone',
          'sync_status',
        ]),
      );
    for (final r in rows) {
      buf.writeln(
        _row(<Object?>[
          r.id,
          r.date,
          r.total,
          r.discount,
          r.paymentMode,
          r.customerName,
          r.customerPhone,
          r.syncStatus,
        ]),
      );
    }
    return _writeCsv('sales', buf.toString());
  }

  /// Replace the live database with a backup. The app MUST be restarted after
  /// this — the caller should close the app so the restored file is opened
  /// fresh on next launch.
  Future<void> restoreBackup(File backup) async {
    if (!await backup.exists()) {
      throw StateError('Backup file no longer exists.');
    }
    final livePath = await _liveDbPath();
    // Release the file handles before overwriting.
    await _db.close();
    await backup.copy(livePath);
    for (final suffix in const <String>['-wal', '-shm']) {
      final sidecar = File('$livePath$suffix');
      if (await sidecar.exists()) {
        await sidecar.delete();
      }
    }
  }
}
