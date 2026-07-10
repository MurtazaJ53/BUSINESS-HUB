import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Minimal on-device crash log. Field crashes append here so they can be
/// recovered from the device (or a full Sentry/Crashlytics SDK later).
class CrashLogger {
  CrashLogger._();

  static File? _file;
  static const int _maxBytes = 256 * 1024;

  static Future<void> init() async {
    try {
      final dir = await getApplicationDocumentsDirectory();
      _file = File(p.join(dir.path, 'crash.log'));
    } catch (_) {
      // Diagnostics must never crash the app.
    }
  }

  static void record(Object error, StackTrace? stack, {String kind = 'error'}) {
    final file = _file;
    if (file == null) return;
    try {
      file.writeAsStringSync(
        '${DateTime.now().toIso8601String()} [$kind] $error\n${stack ?? ''}\n---\n',
        mode: FileMode.append,
        flush: true,
      );
      if (file.lengthSync() > _maxBytes) {
        final text = file.readAsStringSync();
        file.writeAsStringSync(text.substring(text.length - _maxBytes ~/ 2));
      }
    } catch (_) {
      // Ignore logging failures.
    }
  }
}
