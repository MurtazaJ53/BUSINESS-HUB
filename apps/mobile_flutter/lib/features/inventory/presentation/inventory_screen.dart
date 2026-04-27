import 'package:flutter/material.dart';

class InventoryScreen extends StatelessWidget {
  const InventoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inventory')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _InfoTile(
            title: 'Inventory direction',
            body:
                'Inventory will use paged SQLite reads with lightweight rows and virtualized scrolling instead of rendering the full catalog at once.',
          ),
          SizedBox(height: 12),
          _InfoTile(
            title: 'Sync model',
            body:
                'Edits land in SQLite first, then background sync writes changes to Firestore without blocking UI interaction.',
          ),
          SizedBox(height: 12),
          _InfoTile(
            title: 'Next implementation',
            body:
                'Create Drift tables for inventory and inventory_private, repository queries, and low-stock aggregate views.',
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
