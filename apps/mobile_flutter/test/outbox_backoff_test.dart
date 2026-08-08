import 'package:business_hub_mobile/core/database/mobile_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('outboxBackoffMs (exponential, capped)', () {
    test('no wait before the first attempt', () {
      expect(outboxBackoffMs(0), 0);
    });

    test('doubles each attempt from 30s', () {
      expect(outboxBackoffMs(1), 30000); // 30s
      expect(outboxBackoffMs(2), 60000); // 1m
      expect(outboxBackoffMs(3), 120000); // 2m
      expect(outboxBackoffMs(4), 240000); // 4m
    });

    test('never exceeds the 1h ceiling', () {
      expect(outboxBackoffMs(50), 3600000);
      expect(outboxBackoffMs(kOutboxMaxAttempts), lessThanOrEqualTo(3600000));
    });

    test('there is a finite attempt ceiling', () {
      expect(kOutboxMaxAttempts, greaterThan(0));
    });
  });
}
