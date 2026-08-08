import 'package:business_hub_mobile/core/sync/outbox_error.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('isPermanentOutboxRejection', () {
    test('400/404/422 are permanent -> dead-letter', () {
      expect(isPermanentOutboxRejection(400), isTrue);
      expect(isPermanentOutboxRejection(404), isTrue);
      expect(isPermanentOutboxRejection(422), isTrue);
    });

    test('auth/rate-limit/cutover 4xx are transient -> retry', () {
      expect(isPermanentOutboxRejection(401), isFalse);
      expect(isPermanentOutboxRejection(403), isFalse);
      expect(isPermanentOutboxRejection(409), isFalse);
      expect(isPermanentOutboxRejection(429), isFalse);
    });

    test('network(null) and 5xx are transient -> retry', () {
      expect(isPermanentOutboxRejection(null), isFalse);
      expect(isPermanentOutboxRejection(500), isFalse);
      expect(isPermanentOutboxRejection(503), isFalse);
    });
  });
}
