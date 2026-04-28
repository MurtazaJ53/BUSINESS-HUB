String formatCurrency(num amount) {
  final negative = amount < 0;
  final absolute = amount.abs().round().toString();
  if (absolute.length <= 3) {
    return '${negative ? '-' : ''}₹$absolute';
  }

  final lastThree = absolute.substring(absolute.length - 3);
  var leading = absolute.substring(0, absolute.length - 3);
  final chunks = <String>[];
  while (leading.length > 2) {
    chunks.insert(0, leading.substring(leading.length - 2));
    leading = leading.substring(0, leading.length - 2);
  }
  if (leading.isNotEmpty) {
    chunks.insert(0, leading);
  }

  return '${negative ? '-' : ''}₹${chunks.join(',')},$lastThree';
}

String formatCompactDate(DateTime value) {
  final local = value.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month/${local.year}';
}
