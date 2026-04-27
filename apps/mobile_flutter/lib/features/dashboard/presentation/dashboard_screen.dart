import 'package:flutter/material.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _InfoTile(
            title: 'Why Flutter dashboard',
            body:
                'The mobile dashboard should open from local summary tables first, then hydrate cloud sync and charts later.',
          ),
          SizedBox(height: 12),
          _InfoTile(
            title: 'Performance target',
            body:
                'No full-table scans on first paint. KPI summaries, low-stock preview, and recent activity should all come from precomputed local aggregates.',
          ),
          SizedBox(height: 12),
          _InfoTile(
            title: 'Next implementation',
            body:
                'Port auth-aware dashboard queries, local summary repository, and deferred chart rendering.',
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(body),
          ],
        ),
      ),
    );
  }
}
