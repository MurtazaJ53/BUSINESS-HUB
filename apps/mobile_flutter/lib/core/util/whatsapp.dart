import 'package:url_launcher/url_launcher.dart';

/// Normalise an Indian phone number to wa.me's expected `<countrycode><number>`
/// (no +, spaces or dashes). Assumes India (91) when no country code is given.
String normalizeWhatsAppNumber(String raw) {
  var digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.length == 10) {
    digits = '91$digits';
  } else if (digits.length == 11 && digits.startsWith('0')) {
    digits = '91${digits.substring(1)}';
  }
  return digits;
}

/// Open a WhatsApp chat with [phone], optionally pre-filling [message].
/// Returns false if the number is unusable or no handler is available.
Future<bool> openWhatsApp({required String phone, String message = ''}) async {
  final number = normalizeWhatsAppNumber(phone);
  if (number.length < 11) return false;
  final uri = Uri.parse(
    'https://wa.me/$number${message.isEmpty ? '' : '?text=${Uri.encodeComponent(message)}'}',
  );
  if (!await canLaunchUrl(uri)) return false;
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}
