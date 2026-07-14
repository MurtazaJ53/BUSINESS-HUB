/// Parser for price/weight-embedded EAN-13 barcodes printed by retail weighing
/// scales. The exact field layout varies by scale brand, so it is expressed as
/// a [WeightBarcodeConfig]; the default matches the most common in-store format:
///
///   prefix(1) itemCode(5) embeddedValue(6) check(1)   e.g. 2 12345 001250 8
///
/// where the 6-digit value is a price in the smallest currency unit (paise),
/// so `001250` -> ₹12.50. Adjust the config to your scale if fields differ.
class WeightBarcodeConfig {
  const WeightBarcodeConfig({
    this.prefixes = const <String>['2'],
    this.itemCodeStart = 1,
    this.itemCodeLength = 5,
    this.valueStart = 6,
    this.valueLength = 6,
    this.valueDivisor = 100,
    this.totalLength = 13,
  });

  final List<String> prefixes;
  final int itemCodeStart;
  final int itemCodeLength;
  final int valueStart;
  final int valueLength;

  /// Divide the embedded integer by this to get a currency amount
  /// (100 -> the value is in paise).
  final double valueDivisor;
  final int totalLength;

  static const WeightBarcodeConfig standard = WeightBarcodeConfig();
}

/// Price for a weighed/loose line: rate per unit × weight, rounded to paise.
/// Returns 0 for non-positive inputs.
double weighedLinePrice({required double rate, required double weight}) {
  if (rate <= 0 || weight <= 0) return 0;
  return double.parse((rate * weight).toStringAsFixed(2));
}

class WeightBarcode {
  const WeightBarcode({required this.itemCode, required this.embeddedValue});

  /// The PLU / item lookup digits.
  final String itemCode;

  /// The decoded price (or weight) amount.
  final double embeddedValue;
}

/// Returns a [WeightBarcode] if [raw] is a price/weight-embedded scale barcode
/// under [config], or null for a normal product barcode.
WeightBarcode? parseWeightBarcode(
  String raw, {
  WeightBarcodeConfig config = WeightBarcodeConfig.standard,
}) {
  final code = raw.trim();
  if (code.length != config.totalLength) return null;
  if (!RegExp(r'^\d+$').hasMatch(code)) return null;
  if (!config.prefixes.any(code.startsWith)) return null;

  final itemEnd = config.itemCodeStart + config.itemCodeLength;
  final valueEnd = config.valueStart + config.valueLength;
  if (itemEnd > code.length || valueEnd > code.length) return null;

  final itemCode = code.substring(config.itemCodeStart, itemEnd);
  final rawValue = int.tryParse(code.substring(config.valueStart, valueEnd));
  if (rawValue == null) return null;

  return WeightBarcode(
    itemCode: itemCode,
    embeddedValue: rawValue / config.valueDivisor,
  );
}
