import 'package:flutter/material.dart';

class MobileHeroBanner extends StatelessWidget {
  const MobileHeroBanner({
    super.key,
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.accent = const Color(0xFF38BDF8),
  });

  final String eyebrow;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final compact = MediaQuery.sizeOf(context).width < 420;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(compact ? 24 : 30),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[
            Color(0xFF09101B),
            Color(0xFF0C1423),
            Color(0xFF121A29),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x38000000),
            blurRadius: 28,
            offset: Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        children: <Widget>[
          Positioned(
            top: compact ? -24 : -32,
            right: compact ? -12 : -18,
            child: Container(
              width: compact ? 104 : 130,
              height: compact ? 104 : 130,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accent.withValues(alpha: 0.12),
              ),
            ),
          ),
          Positioned(
            bottom: compact ? -34 : -46,
            left: compact ? -18 : -24,
            child: Container(
              width: compact ? 118 : 150,
              height: compact ? 118 : 150,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x1406B6D4),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.all(compact ? 18 : 22),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final stacked =
                    trailing != null && constraints.maxWidth < (compact ? 520 : 470);
                final content = Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      eyebrow.toUpperCase(),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.52),
                        fontWeight: FontWeight.w900,
                        letterSpacing: compact ? 1.4 : 1.8,
                      ),
                    ),
                    SizedBox(height: compact ? 10 : 12),
                    Text(
                      title,
                      maxLines: compact ? 3 : null,
                      overflow: compact ? TextOverflow.ellipsis : null,
                      style:
                          (compact
                                  ? theme.textTheme.headlineSmall
                                  : theme.textTheme.headlineMedium)
                              ?.copyWith(
                        fontWeight: FontWeight.w900,
                        height: compact ? 0.98 : 0.94,
                        letterSpacing: compact ? -0.8 : -1.15,
                      ),
                    ),
                    SizedBox(height: compact ? 10 : 14),
                    Text(
                      subtitle,
                      maxLines: compact ? 3 : null,
                      overflow: compact ? TextOverflow.ellipsis : null,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                        height: compact ? 1.4 : 1.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                );

                if (trailing == null) {
                  return content;
                }

                if (stacked) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      content,
                      SizedBox(height: compact ? 14 : 18),
                      trailing!,
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Expanded(child: content),
                    const SizedBox(width: 16),
                    trailing!,
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class MobilePanel extends StatelessWidget {
  const MobilePanel({
    super.key,
    required this.title,
    required this.child,
    this.action,
  });

  final String title;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final compact = MediaQuery.sizeOf(context).width < 420;
    final headerChildren = <Widget>[
      Expanded(
        child: Text(
          title,
          style:
              (compact ? theme.textTheme.titleMedium : theme.textTheme.titleLarge)
                  ?.copyWith(
            fontWeight: FontWeight.w900,
            letterSpacing: -0.45,
          ),
        ),
      ),
      if (action case final nextAction?) ...<Widget>[nextAction],
    ];
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0B121F),
        borderRadius: BorderRadius.circular(compact ? 22 : 28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x2A000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(compact ? 16 : 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(children: headerChildren),
            SizedBox(height: compact ? 12 : 16),
            child,
          ],
        ),
      ),
    );
  }
}

class MobileMetricCard extends StatelessWidget {
  const MobileMetricCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.accent = const Color(0xFF38BDF8),
    this.caption,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accent;
  final String? caption;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final compact = MediaQuery.sizeOf(context).width < 420;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(compact ? 20 : 24),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF0A1220),
            borderRadius: BorderRadius.circular(compact ? 20 : 24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Padding(
            padding: EdgeInsets.all(compact ? 14 : 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: compact ? 38 : 42,
                  height: compact ? 38 : 42,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(compact ? 12 : 14),
                  ),
                  child: Icon(icon, color: accent, size: compact ? 18 : 22),
                ),
                SizedBox(height: compact ? 14 : 18),
                Text(
                  label.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.5),
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.25,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  value,
                  style:
                      (compact
                              ? theme.textTheme.titleLarge
                              : theme.textTheme.headlineSmall)
                          ?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.7,
                  ),
                ),
                if (caption != null) ...<Widget>[
                  const SizedBox(height: 8),
                  Text(
                    caption!,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.56),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MobileActionCard extends StatelessWidget {
  const MobileActionCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    this.kicker,
    this.accent = const Color(0xFF38BDF8),
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final String? kicker;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final compact = MediaQuery.sizeOf(context).width < 420;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(compact ? 22 : 28),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(compact ? 22 : 28),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[
                accent.withValues(alpha: 0.34),
                accent.withValues(alpha: 0.14),
                const Color(0xFF0D1424),
              ],
            ),
            border: Border.all(color: accent.withValues(alpha: 0.18)),
          ),
          child: Padding(
            padding: EdgeInsets.all(compact ? 16 : 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: compact ? 48 : 56,
                  height: compact ? 48 : 56,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(compact ? 14 : 18),
                  ),
                  child: Icon(icon, color: Colors.white, size: compact ? 24 : 28),
                ),
                const Spacer(),
                if (kicker != null) ...<Widget>[
                  Text(
                    kicker!.toUpperCase(),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.72),
                      fontWeight: FontWeight.w900,
                      letterSpacing: compact ? 1.1 : 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                Text(
                  title,
                  style:
                      (compact
                              ? theme.textTheme.titleLarge
                              : theme.textTheme.headlineSmall)
                          ?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 0.98,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  maxLines: compact ? 3 : null,
                  overflow: compact ? TextOverflow.ellipsis : null,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w700,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MobileTag extends StatelessWidget {
  const MobileTag({
    super.key,
    required this.label,
    this.icon,
    this.accent = const Color(0xFF38BDF8),
  });

  final String label;
  final IconData? icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accent.withValues(alpha: 0.18)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            if (icon != null) ...<Widget>[
              Icon(icon, color: accent, size: 16),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                color: accent,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.35,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MobileEmptyState extends StatelessWidget {
  const MobileEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        children: <Widget>[
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: const Color(0xFF111827),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, color: Colors.white70, size: 26),
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.62),
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
