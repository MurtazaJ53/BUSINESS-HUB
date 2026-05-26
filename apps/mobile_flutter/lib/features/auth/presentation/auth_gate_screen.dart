import 'package:firebase_auth/firebase_auth.dart';
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
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  bool _submitting = false;
  bool _obscurePassword = true;
  bool _recoveryMode = false;
  String? _error;
  bool _redirecting = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
    } on FirebaseAuthException catch (error) {
      setState(() {
        _error = switch (error.code) {
          'invalid-credential' => 'Invalid email or password.',
          'user-not-found' => 'No account found for this email.',
          'wrong-password' => 'Incorrect password.',
          'network-request-failed' => 'Network error. Check your connection.',
          _ => error.message ?? 'Sign-in failed.',
        };
      });
    } catch (_) {
      setState(() {
        _error = 'Unexpected sign-in error.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _sendResetEmail() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      setState(() {
        _error = 'Enter your email first, then tap recovery.';
      });
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: email);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password reset email sent.')),
      );
      setState(() {
        _recoveryMode = false;
      });
    } on FirebaseAuthException catch (error) {
      setState(() {
        _error = error.message ?? 'Could not send reset email.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync = ref.watch(mobileSessionProvider);

    return sessionAsync.when(
      loading: () => const _AuthScaffold(
        child: _BrandedStatus(
          icon: Icons.lock_clock_rounded,
          eyebrow: 'Secure handoff',
          title: 'Starting Business Hub Pro',
          subtitle: 'Restoring your workspace vault and checking live access.',
        ),
      ),
      error: (error, _) => _AuthScaffold(
        child: _BrandedStatus(
          icon: Icons.error_outline_rounded,
          eyebrow: 'Session issue',
          title: 'We could not restore the session',
          subtitle: error.toString(),
        ),
      ),
      data: (session) {
        if (session != null) {
          if (session.hasShop && !_redirecting) {
            _redirecting = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                context.go(session.defaultRoute);
              }
            });
          }

          if (!session.hasShop) {
            _redirecting = false;
            return _AuthScaffold(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const _BrandedStatus(
                    icon: Icons.sync_problem_rounded,
                    eyebrow: 'Workspace access missing',
                    title:
                        'Your email is signed in, but this shop is not attached yet',
                    subtitle:
                        'Ask the owner or store admin to add this exact email in Workspace team first. After that, sign in again, or use password recovery if this is your first mobile login.',
                  ),
                  const SizedBox(height: 18),
                  FilledButton.tonalIcon(
                    onPressed: () async {
                      await FirebaseAuth.instance.signOut();
                    },
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('Sign out'),
                  ),
                ],
              ),
            );
          }

          return const _AuthScaffold(
            child: _BrandedStatus(
              icon: Icons.verified_user_rounded,
              eyebrow: 'Access granted',
              title: 'Opening your command center',
              subtitle:
                  'Business Hub is mounting the local vault and hydrating the mobile workspace.',
            ),
          );
        }

        _redirecting = false;
        return _AuthScaffold(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              children: <Widget>[
                const _AuthHero(),
                const SizedBox(height: 18),
                _AuthCard(
                  emailController: _emailController,
                  passwordController: _passwordController,
                  formKey: _formKey,
                  submitting: _submitting,
                  obscurePassword: _obscurePassword,
                  recoveryMode: _recoveryMode,
                  error: _error,
                  onTogglePassword: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                  onModeChange: (recovery) {
                    setState(() {
                      _recoveryMode = recovery;
                      _error = null;
                    });
                  },
                  onSubmit: _recoveryMode ? _sendResetEmail : _signIn,
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
              AppPalette.backgroundAlt,
            ],
          ),
        ),
        child: Stack(
          children: <Widget>[
            const Positioned(
              top: -90,
              left: -50,
              child: _AuraBlob(size: 220, color: Color(0x26E58A47)),
            ),
            const Positioned(
              top: 120,
              right: -44,
              child: _AuraBlob(size: 180, color: Color(0x22F0C879)),
            ),
            const Positioned(
              bottom: -60,
              left: 18,
              child: _AuraBlob(size: 200, color: Color(0x1E7CA4F8)),
            ),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(22),
                  child: child,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthHero extends StatelessWidget {
  const _AuthHero();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return MobilePanel(
      title: 'Command the shop from your pocket',
      action: const MobileTag(
        label: 'LIVE LINK ACTIVE',
        icon: Icons.wifi_tethering_rounded,
        accent: AppPalette.jade,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 62,
                height: 62,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  gradient: const LinearGradient(
                    colors: <Color>[AppPalette.gold, AppPalette.primary],
                  ),
                ),
                child: const Icon(
                  Icons.storefront_rounded,
                  color: Colors.white,
                  size: 30,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Business Hub Pro',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        height: 1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'ZARRA ECOSYSTEM',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppPalette.textMuted,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.2,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Local vault speed. Live cloud continuity. Premium operations in your hand.',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: AppPalette.textSecondary,
              height: 1.5,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: const <Widget>[
              MobileTag(
                label: 'LOCAL-FIRST OPENING',
                icon: Icons.offline_bolt_rounded,
              ),
              MobileTag(
                label: 'FIREBASE SECURED',
                icon: Icons.shield_rounded,
                accent: AppPalette.jade,
              ),
              MobileTag(
                label: 'PREMIUM CHECKOUT FLOW',
                icon: Icons.point_of_sale_rounded,
                accent: AppPalette.gold,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AuthCard extends StatelessWidget {
  const _AuthCard({
    required this.emailController,
    required this.passwordController,
    required this.formKey,
    required this.submitting,
    required this.obscurePassword,
    required this.recoveryMode,
    required this.error,
    required this.onTogglePassword,
    required this.onModeChange,
    required this.onSubmit,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final GlobalKey<FormState> formKey;
  final bool submitting;
  final bool obscurePassword;
  final bool recoveryMode;
  final String? error;
  final VoidCallback onTogglePassword;
  final ValueChanged<bool> onModeChange;
  final Future<void> Function() onSubmit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return MobilePanel(
      title: recoveryMode ? 'Recover account access' : 'Operator sign in',
      action: MobileTag(
        label: recoveryMode ? 'RECOVERY MODE' : 'SECURE LOGIN',
        icon: recoveryMode ? Icons.key_rounded : Icons.lock_rounded,
        accent: recoveryMode ? AppPalette.gold : AppPalette.primary,
      ),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            DecoratedBox(
              decoration: BoxDecoration(
                color: AppPalette.panelStrong,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: AppPalette.lineSoft),
              ),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: _AuthModeButton(
                        active: !recoveryMode,
                        label: 'Sign in',
                        icon: Icons.login_rounded,
                        onTap: () => onModeChange(false),
                      ),
                    ),
                    Expanded(
                      child: _AuthModeButton(
                        active: recoveryMode,
                        label: 'Recover',
                        icon: Icons.restart_alt_rounded,
                        onTap: () => onModeChange(true),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              recoveryMode
                  ? 'We will send a reset link to the operator email you enter below.'
                  : 'Use the same Business Hub account that already owns or belongs to your shop workspace.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppPalette.textSecondary,
                fontWeight: FontWeight.w600,
                height: 1.45,
              ),
            ),
            const SizedBox(height: 18),
            TextFormField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Operator email',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Email is required';
                }
                return null;
              },
            ),
            if (!recoveryMode) ...<Widget>[
              const SizedBox(height: 14),
              TextFormField(
                controller: passwordController,
                obscureText: obscurePassword,
                decoration: InputDecoration(
                  labelText: 'Secure password',
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                  suffixIcon: IconButton(
                    onPressed: onTogglePassword,
                    icon: Icon(
                      obscurePassword
                          ? Icons.visibility_rounded
                          : Icons.visibility_off_rounded,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Password is required';
                  }
                  return null;
                },
              ),
            ],
            if (error != null) ...<Widget>[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF2D1819),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: AppPalette.coral.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: AppPalette.coral,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        error!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFFFFE1DD),
                          fontWeight: FontWeight.w700,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: submitting ? null : onSubmit,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(58),
              ),
              child: submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.2),
                    )
                  : Text(
                      recoveryMode
                          ? 'Send recovery email'
                          : 'Enter command center',
                    ),
            ),
            const SizedBox(height: 14),
            Text(
              'The mobile app mounts local SQLite first, then syncs your live workspace after sign-in.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppPalette.textMuted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthModeButton extends StatelessWidget {
  const _AuthModeButton({
    required this.active,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final bool active;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppPalette.primary : Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              Icon(
                icon,
                size: 18,
                color: active
                    ? const Color(0xFF1A1008)
                    : AppPalette.textSecondary,
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: active
                      ? const Color(0xFF1A1008)
                      : AppPalette.textSecondary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
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
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppPalette.panelMuted,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Icon(icon, color: Colors.white, size: 34),
          ),
          const SizedBox(height: 20),
          Text(
            subtitle,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppPalette.textSecondary,
              fontWeight: FontWeight.w600,
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
