import 'package:flutter/material.dart';

/// Manager-authorization gate for high-risk POS actions (void a sale, delete a
/// Khata entry, open the drawer without a sale). Today it verifies a manager
/// PIN; to upgrade to a fingerprint prompt, add the `local_auth` package and
/// call `LocalAuthentication().authenticate(...)` inside [requireManagerApproval]
/// before/instead of the PIN dialog — the call sites don't change.
class ManagerGate {
  /// Manager PIN, seeded from --dart-define BUSINESS_HUB_MANAGER_PIN.
  /// When empty, the gate is disabled (approval auto-granted) so a shop that
  /// hasn't configured a PIN isn't locked out.
  static const String _configuredPin =
      String.fromEnvironment('BUSINESS_HUB_MANAGER_PIN');

  static bool get isEnabled => _configuredPin.isNotEmpty;

  /// Constant-time-ish PIN check (compares every char so timing doesn't leak the
  /// matched prefix length).
  static bool verifyPin(String entered, {String? expected}) {
    final target = expected ?? _configuredPin;
    if (target.isEmpty) return true; // gate disabled
    if (entered.length != target.length) return false;
    var mismatch = 0;
    for (var i = 0; i < target.length; i++) {
      mismatch |= entered.codeUnitAt(i) ^ target.codeUnitAt(i);
    }
    return mismatch == 0;
  }

  /// Prompt for the manager PIN guarding [reason]. Returns true if approved (or
  /// if the gate is disabled). Never throws.
  static Future<bool> requireManagerApproval(
    BuildContext context, {
    required String reason,
  }) async {
    if (!isEnabled) return true;
    final controller = TextEditingController();
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        String? error;
        return StatefulBuilder(
          builder: (dialogContext, setState) {
            void submit() {
              if (verifyPin(controller.text.trim())) {
                Navigator.pop(dialogContext, true);
              } else {
                setState(() => error = 'Incorrect manager PIN.');
              }
            }

            return AlertDialog(
              title: const Text('Manager approval'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(reason),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    autofocus: true,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Manager PIN',
                      errorText: error,
                    ),
                    onSubmitted: (_) => submit(),
                  ),
                ],
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(onPressed: submit, child: const Text('Approve')),
              ],
            );
          },
        );
      },
    );
    return approved ?? false;
  }
}
