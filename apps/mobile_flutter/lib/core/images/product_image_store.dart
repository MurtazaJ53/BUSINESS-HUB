import 'dart:io';

import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Persists product photos inside the app's documents directory so a path
/// stored in the database keeps resolving across restarts (the OS picker hands
/// back a temp/cache path that can be evicted at any time).
class ProductImageStore {
  ProductImageStore({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  static const String _folder = 'product_images';

  Future<Directory> _dir() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(base.path, _folder));
    if (!dir.existsSync()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  /// Let the user pick from the camera or gallery, downscale/compress it, and
  /// copy it into permanent storage. Returns the stored absolute path, or null
  /// if the user cancelled.
  Future<String?> pickAndStore({required ImageSource source}) async {
    final picked = await _picker.pickImage(
      source: source,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 80,
    );
    if (picked == null) return null;
    final dir = await _dir();
    final ext = p.extension(picked.path).isNotEmpty
        ? p.extension(picked.path)
        : '.jpg';
    final dest = p.join(
      dir.path,
      'img_${DateTime.now().microsecondsSinceEpoch}$ext',
    );
    final bytes = await picked.readAsBytes();
    await File(dest).writeAsBytes(bytes, flush: true);
    return dest;
  }

  /// Best-effort delete of a stored photo. Safe to call with a null/empty path
  /// or a file that is already gone.
  Future<void> deleteIfOwned(String? path) async {
    if (path == null || path.isEmpty) return;
    if (!path.contains(_folder)) return;
    try {
      final file = File(path);
      if (file.existsSync()) await file.delete();
    } catch (_) {
      // A leftover image file is harmless; never let cleanup break a save.
    }
  }
}
