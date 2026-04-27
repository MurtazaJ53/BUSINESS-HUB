import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class MobileHomeScreen extends StatelessWidget {
  const MobileHomeScreen({super.key});

  Future<Map<String, dynamic>> _loadSession() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return const {};

    final token = await user.getIdTokenResult(true);
    return {
      'email': user.email ?? '',
      'uid': user.uid,
      'role': token.claims?['role']?.toString() ?? 'unknown',
      'shopId': token.claims?['shopId']?.toString() ?? 'unassigned',
    };
  }

  Future<void> _signOut(BuildContext context) async {
    await FirebaseAuth.instance.signOut();
    if (context.mounted) {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Business Hub Mobile'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => _signOut(context),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _loadSession(),
        builder: (context, snapshot) {
          final session = snapshot.data ?? const <String, dynamic>{};
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Flutter mobile beta',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Signed in as ${session['email'] ?? 'Unknown'}',
                      ),
                      const SizedBox(height: 8),
                      Text('Role: ${session['role'] ?? 'unknown'}'),
                      const SizedBox(height: 4),
                      Text('Shop: ${session['shopId'] ?? 'unassigned'}'),
                      const SizedBox(height: 4),
                      Text('UID: ${session['uid'] ?? 'n/a'}'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const _RouteCard(
                title: 'Dashboard',
                subtitle:
                    'Mobile-first summary surface. Native KPI flow lands here next.',
                route: '/dashboard',
              ),
              const SizedBox(height: 12),
              const _RouteCard(
                title: 'Inventory',
                subtitle:
                    'Paged inventory browsing will replace full catalog loading.',
                route: '/inventory',
              ),
              const SizedBox(height: 12),
              const _RouteCard(
                title: 'POS',
                subtitle:
                    'The first major native performance win will be the new POS.',
                route: '/pos',
              ),
            ],
          );
        },
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
