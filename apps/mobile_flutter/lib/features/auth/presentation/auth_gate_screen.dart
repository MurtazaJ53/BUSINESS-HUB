import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/session/mobile_session_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../shell/presentation/mobile_surface.dart';

class AuthGateScreen extends ConsumerWidget {
  const AuthGateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
        }

        return const _AuthScaffold(
          child: _BrandedStatus(
            icon: Icons.verified_rounded,
            eyebrow: 'Ready',
            title: 'Command center is ready',
            subtitle:
                'Business Hub is local-first now. Live sync can be switched on when the backend is available.',
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
