import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../models/mobile_session.dart';
import '../runtime/mobile_runtime_config.dart';

const String _staffKey = 'staff_users';
const String _legacyPinKey = 'owner_pin_hash';

/// A local staff account: name + role + hashed PIN.
class StaffUser {
  const StaffUser({
    required this.id,
    required this.name,
    required this.role,
    required this.pinHash,
  });

  final String id;
  final String name;
  final String role; // owner | manager | staff
  final String pinHash;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'id': id,
    'name': name,
    'role': role,
    'pin': pinHash,
  };

  factory StaffUser.fromJson(Map<String, dynamic> j) => StaffUser(
    id: (j['id'] ?? '').toString(),
    name: (j['name'] ?? '').toString(),
    role: (j['role'] ?? 'staff').toString(),
    pinHash: (j['pin'] ?? '').toString(),
  );
}

class MobileSessionNotifier extends AsyncNotifier<MobileSession?> {
  String? _currentStaffId;

  @override
  Future<MobileSession?> build() async => null;

  String _hash(String pin) =>
      sha256.convert(utf8.encode('business-hub:$pin')).toString();

  Future<List<StaffUser>> _loadStaff() async {
    final repo = ref.read(shopRepositoryProvider);
    final raw = await repo.readSetting(_staffKey);
    if (raw == null || raw.isEmpty) {
      // Migrate a legacy single-owner PIN into the staff store.
      final legacy = await repo.readSetting(_legacyPinKey);
      if (legacy != null && legacy.isNotEmpty) {
        final owner = StaffUser(
          id: 'owner',
          name: 'Owner',
          role: 'owner',
          pinHash: legacy,
        );
        await _saveStaff(<StaffUser>[owner]);
        return <StaffUser>[owner];
      }
      return const <StaffUser>[];
    }
    try {
      return (jsonDecode(raw) as List)
          .whereType<Map>()
          .map((m) => StaffUser.fromJson(Map<String, dynamic>.from(m)))
          .toList();
    } catch (_) {
      return const <StaffUser>[];
    }
  }

  Future<void> _saveStaff(List<StaffUser> staff) async {
    await ref
        .read(shopRepositoryProvider)
        .writeSetting(
          _staffKey,
          jsonEncode(staff.map((s) => s.toJson()).toList()),
        );
  }

  /// Whether any staff account exists (first-run vs returning).
  Future<bool> hasPin() async => (await _loadStaff()).isNotEmpty;

  Future<List<StaffUser>> listStaff() => _loadStaff();

  /// Resolve the PIN to a staff member and unlock. First PIN on a fresh
  /// install becomes the owner. Returns false for an unknown PIN.
  Future<bool> login(String pin) async {
    final repo = ref.read(shopRepositoryProvider);
    final staff = await _loadStaff();
    final hashed = _hash(pin);

    StaffUser? user;
    if (staff.isEmpty) {
      user = StaffUser(id: 'owner', name: 'Owner', role: 'owner', pinHash: hashed);
      await _saveStaff(<StaffUser>[user]);
    } else {
      for (final s in staff) {
        if (s.pinHash == hashed) {
          user = s;
          break;
        }
      }
      if (user == null) return false;
    }

    state = const AsyncValue.loading();
    _currentStaffId = user.id;

    // Seed the shop document only once, so signing out never wipes edits.
    final existing = await repo.readSetting('settings');
    if (existing == null || existing.isEmpty) {
      await repo.saveShopDocument(<String, dynamic>{
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

    state = AsyncValue.data(
      MobileSession.localUser(
        staffId: user.id,
        name: user.name,
        role: user.role,
      ),
    );
    return true;
  }

  /// Change the currently signed-in user's PIN.
  Future<bool> changePin(String currentPin, String newPin) async {
    final staff = await _loadStaff();
    final id = _currentStaffId ?? 'owner';
    final idx = staff.indexWhere((s) => s.id == id);
    if (idx < 0) return false;
    if (staff[idx].pinHash != _hash(currentPin)) return false;
    staff[idx] = StaffUser(
      id: staff[idx].id,
      name: staff[idx].name,
      role: staff[idx].role,
      pinHash: _hash(newPin),
    );
    await _saveStaff(staff);
    return true;
  }

  /// Add a staff member. Returns an error message, or null on success.
  Future<String?> addStaff({
    required String name,
    required String role,
    required String pin,
  }) async {
    if (pin.trim().length < 4) return 'PIN must be 4 digits.';
    final staff = await _loadStaff();
    final hashed = _hash(pin);
    if (staff.any((s) => s.pinHash == hashed)) {
      return 'That PIN is already used by another staff member.';
    }
    staff.add(
      StaffUser(
        id: 'staff-${DateTime.now().microsecondsSinceEpoch}',
        name: name.trim().isEmpty ? 'Staff' : name.trim(),
        role: role,
        pinHash: hashed,
      ),
    );
    await _saveStaff(staff);
    return null;
  }

  Future<void> updateStaffRole(String id, String role) async {
    final staff = await _loadStaff();
    final idx = staff.indexWhere((s) => s.id == id);
    if (idx < 0) return;
    staff[idx] = StaffUser(
      id: staff[idx].id,
      name: staff[idx].name,
      role: role,
      pinHash: staff[idx].pinHash,
    );
    await _saveStaff(staff);
  }

  Future<void> removeStaff(String id) async {
    final staff = await _loadStaff();
    staff.removeWhere((s) => s.id == id);
    await _saveStaff(staff);
  }

  void logout() {
    _currentStaffId = null;
    state = const AsyncValue.data(null);
  }
}

final mobileSessionProvider =
    AsyncNotifierProvider<MobileSessionNotifier, MobileSession?>(() {
      return MobileSessionNotifier();
    });
