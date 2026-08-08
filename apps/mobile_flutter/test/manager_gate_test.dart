import 'package:business_hub_mobile/core/security/manager_gate.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ManagerGate.verifyPin', () {
    test('accepts the exact PIN', () {
      expect(ManagerGate.verifyPin('4821', expected: '4821'), isTrue);
    });

    test('rejects a wrong PIN of the same length', () {
      expect(ManagerGate.verifyPin('4822', expected: '4821'), isFalse);
    });

    test('rejects a PIN of the wrong length', () {
      expect(ManagerGate.verifyPin('482', expected: '4821'), isFalse);
      expect(ManagerGate.verifyPin('48210', expected: '4821'), isFalse);
    });

    test('an empty expected PIN means the gate is disabled (auto-approve)', () {
      expect(ManagerGate.verifyPin('anything', expected: ''), isTrue);
    });
  });
}
