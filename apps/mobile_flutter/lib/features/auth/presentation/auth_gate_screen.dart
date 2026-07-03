import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/session/mobile_session_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../shell/presentation/mobile_surface.dart';

class AuthGateScreen extends ConsumerStatefulWidget {
  const AuthGateScreen({super.key});

  @override
  ConsumerState<AuthGateScreen> createState() => _AuthGateScreenState();
}

class _AuthGateScreenState extends ConsumerState<AuthGateScreen> {
  final _pinController = TextEditingController();
  bool _isLoggingIn = false;

  void _handleLogin() async {
    if (_pinController.text.isEmpty) return;
    
    setState(() => _isLoggingIn = true);
    
    await ref.read(mobileSessionProvider.notifier).login(_pinController.text);
    
    if (mounted) {
      setState(() => _isLoggingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync = ref.watch(mobileSessionProvider);

    return sessionAsync.when(
      loading: () => const _AuthScaffold(
        child: _BrandedStatus(
          icon: Icons.offline_bolt_rounded,
          eyebrow: 'Local vault',
          title: 'Opening Business Hub',
          subtitle: 'Preparing the local workspace before any cloud sync.',
        ),
      ),
      error: (error, _) => _AuthScaffold(
        child: _BrandedStatus(
          icon: Icons.error_outline_rounded,
          eyebrow: 'Startup issue',
          title: 'Workspace could not open',
          subtitle: error.toString(),
        ),
      ),
      data: (session) {
        if (session != null && session.hasShop) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              context.go(session.defaultRoute);
            }
          });
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }

        // SHOW LOGIN SCREEN IF NO SESSION
        return _AuthScaffold(
          child: MobilePanel(
            title: 'Staff Login',
            action: const MobileTag(label: 'SECURE', icon: Icons.lock_outline),
            child: Column(
              children: [
                const SizedBox(height: 16),
                const Icon(Icons.storefront_rounded, size: 48, color: AppPalette.primary),
                const SizedBox(height: 24),
                Text(
                  'Enter your assigned PIN to unlock the POS terminal.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppPalette.textSecondary,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                TextField(
                  controller: _pinController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 4,
                  style: const TextStyle(fontSize: 24, letterSpacing: 8, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    hintText: '----',
                    counterText: '',
                    filled: true,
                    fillColor: AppPalette.backgroundSoft,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  onSubmitted: (_) => _handleLogin(),
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoggingIn ? null : _handleLogin,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppPalette.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                    ),
                    child: _isLoggingIn
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Text(
                            'UNLOCK TERMINAL',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                          ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _AuthScaffold extends StatelessWidget {
  const _AuthScaffold({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: <Color>[
              AppPalette.background,
              AppPalette.backgroundSoft,
              AppPalette.background,
            ],
          ),
        ),
        child: Stack(
          children: <Widget>[
            const Positioned(
              top: -80,
              left: -40,
              child: _AuraBlob(size: 220, color: Color(0x26E58A47)),
            ),
            const Positioned(
              bottom: -80,
              right: -42,
              child: _AuraBlob(size: 220, color: Color(0x227CA4F8)),
            ),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(22),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: child,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BrandedStatus extends StatelessWidget {
  const _BrandedStatus({
    required this.icon,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String eyebrow;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return MobilePanel(
      title: title,
      action: MobileTag(label: eyebrow.toUpperCase(), icon: icon),
      child: Column(
        children: <Widget>[
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              color: AppPalette.primary.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(26),
            ),
            child: Icon(icon, color: AppPalette.primary, size: 36),
          ),
          const SizedBox(height: 20),
          Text(
            subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppPalette.textSecondary,
              fontWeight: FontWeight.w700,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 18),
          const SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.2),
          ),
        ],
      ),
    );
  }
}

class _AuraBlob extends StatelessWidget {
  const _AuraBlob({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(shape: BoxShape.circle, color: color),
      ),
    );
  }
}
