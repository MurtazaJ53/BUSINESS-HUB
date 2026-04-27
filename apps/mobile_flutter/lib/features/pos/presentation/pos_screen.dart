import 'package:flutter/material.dart';

class PosScreen extends StatelessWidget {
  const PosScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('POS')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _InfoTile(
            title: 'POS direction',
            body:
                'The Flutter POS will read small local slices from SQLite and keep the cart in memory, avoiding giant catalog renders and WebView jank.',
          ),
          SizedBox(height: 12),
          _InfoTile(
            title: 'Barcode and search',
            body:
                'Barcode lookup, exact SKU match, and category paging should all stay local-first for instant response.',
          ),
          SizedBox(height: 12),
          _InfoTile(
            title: 'Next implementation',
            body:
                'Port cart state, product lookup repository, payment flow, force-sale guardrails, and receipt sync.',
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
