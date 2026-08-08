import '../../../core/models/mobile_models.dart';

/// A product whose sibling variants have been folded together for display.
class VariantGroup {
  VariantGroup({
    required this.groupId,
    required this.baseName,
    required this.variants,
  });

  final String groupId;
  final String baseName;
  final List<InventoryCatalogItem> variants;

  double get minPrice =>
      variants.map((v) => v.price).reduce((a, b) => a < b ? a : b);

  double get totalStock => variants.fold<double>(0, (s, v) => s + v.stock);
}

/// Strip the trailing " (label)" a variant row carries so a group tile can show
/// just the product name.
String variantBaseName(InventoryCatalogItem item) {
  final label = item.variantLabel;
  if (label != null && label.isNotEmpty) {
    final suffix = ' ($label)';
    if (item.name.endsWith(suffix)) {
      return item.name.substring(0, item.name.length - suffix.length);
    }
  }
  return item.name;
}

/// Fold the flat catalog into display entries: plain items stay as-is, while
/// sibling variants collapse into a single [VariantGroup] at the position of
/// the group's first variant, preserving overall order.
///
/// Returned entries are either an [InventoryCatalogItem] or a [VariantGroup].
List<Object> groupCatalog(List<InventoryCatalogItem> items) {
  final entries = <Object>[];
  final groupIndex = <String, int>{};
  for (final item in items) {
    if (item.hasVariantGroup) {
      final gid = item.variantGroupId!;
      final existing = groupIndex[gid];
      if (existing == null) {
        groupIndex[gid] = entries.length;
        entries.add(
          VariantGroup(
            groupId: gid,
            baseName: variantBaseName(item),
            variants: <InventoryCatalogItem>[item],
          ),
        );
      } else {
        (entries[existing] as VariantGroup).variants.add(item);
      }
    } else {
      entries.add(item);
    }
  }
  return entries;
}
