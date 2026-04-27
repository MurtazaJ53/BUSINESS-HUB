import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MobileHomeScreen extends StatelessWidget {
  const MobileHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Business Hub Mobile')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _HeroCard(),
          SizedBox(height: 16),
          _RouteCard(
            title: 'Dashboard',
            subtitle: 'Lightweight summary tiles backed by precomputed metrics.',
            route: '/dashboard',
          ),
          SizedBox(height: 12),
          _RouteCard(
            title: 'Inventory',
            subtitle: 'Paged catalog and virtualized lists for large stock sets.',
            route: '/inventory',
          ),
          SizedBox(height: 12),
          _RouteCard(
            title: 'POS',
            subtitle: 'Fast local-first cart and stock access with SQLite reads.',
            route: '/pos',
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Flutter mobile rewrite',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'This app is being rebuilt for smoother Android performance with local SQLite, background sync, and mobile-first rendering.',
              style: theme.textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({
    required this.title,
    required this.subtitle,
    required this.route,
  });

  final String title;
  final String subtitle;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.go(route),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 8),
              Text(subtitle),
            ],
          ),
        ),
      ),
    );
  }
}
