import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../models/mobile_session.dart';
import '../runtime/mobile_runtime_config.dart';

const String _pinHashKey = 'owner_pin_hash';

class MobileSessionNotifier extends AsyncNotifier<MobileSession?> {
  @override
  Future<MobileSession?> build() async {
    // Start unauthenticated.
    return null;
  }

  String _hash(String pin) =>
      sha256.convert(utf8.encode('business-hub:$pin')).toString();

  /// Whether an owner PIN has already been set (first-run vs returning).
  Future<bool> hasPin() async {
    final stored = await ref.read(shopRepositoryProvider).readSetting(
      _pinHashKey,
    );
    return stored != null && stored.isNotEmpty;
  }

  /// Verify the PIN (or set it on first run). Returns true on success, false
  /// on an incorrect PIN. The workspace only unlocks on success.
  Future<bool> login(String pin) async {
    final shopRepo = ref.read(shopRepositoryProvider);
    final stored = await shopRepo.readSetting(_pinHashKey);
    final hashed = _hash(pin);

    if (stored == null || stored.isEmpty) {
      // First run: this PIN becomes the owner PIN.
      await shopRepo.writeSetting(_pinHashKey, hashed);
    } else if (stored != hashed) {
      // Wrong PIN — stay locked.
      return false;
    }

    state = const AsyncValue.loading();

    // Seed the shop document only once, so signing out never wipes edited
    // Business details.
    final existing = await shopRepo.readSetting('settings');
    if (existing == null || existing.isEmpty) {
      await shopRepo.saveShopDocument(<String, dynamic>{
        'name': MobileRuntimeConfig.localShopName,
        'tagline': 'Business Hub',
        'footer': 'Thank you for your business!',
        'currency': 'INR',
        'plan_tier': 'growth',
        'enabled_features': <String, bool>{
          'inventory': true,
          'pos': true,
          'customers': true,
          'history': true,
          'team': true,
          'attendance': true,
          'expenses': true,
          'advanced_ops': true,
        },
      });
    }

    state = AsyncValue.data(MobileSession.localOwner());
    return true;
  }

  /// Change the owner PIN. Returns false if the current PIN is wrong.
  Future<bool> changePin(String currentPin, String newPin) async {
    final shopRepo = ref.read(shopRepositoryProvider);
    final stored = await shopRepo.readSetting(_pinHashKey);
    if (stored != null && stored.isNotEmpty && stored != _hash(currentPin)) {
      return false;
    }
    await shopRepo.writeSetting(_pinHashKey, _hash(newPin));
    return true;
  }

  /// Clear the owner PIN (e.g. forgot PIN → reset). Does not touch shop data.
  Future<void> resetPin() async {
    await ref.read(shopRepositoryProvider).writeSetting(_pinHashKey, '');
    state = const AsyncValue.data(null);
  }

  void logout() {
    state = const AsyncValue.data(null);
  }
}

final mobileSessionProvider =
    AsyncNotifierProvider<MobileSessionNotifier, MobileSession?>(() {
      return MobileSessionNotifier();
    });
