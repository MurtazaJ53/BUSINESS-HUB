import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/import/zobaze_import.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../shell/presentation/mobile_surface.dart';

/// Migrate data in from another POS (currently Zobaze .xlsx exports).
class SettingsImportScreen extends ConsumerStatefulWidget {
  const SettingsImportScreen({super.key});

  @override
  ConsumerState<SettingsImportScreen> createState() =>
      _SettingsImportScreenState();
}

class _SettingsImportScreenState extends ConsumerState<SettingsImportScreen> {
  bool _busy = false;
  ZobazeImportResult? _result;
  String? _error;

  Future<void> _import() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
    });
    try {
      final service = ref.read(zobazeImportServiceProvider);
      final file = await service.pickFile();
      if (file == null) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      final result = await service.importFile(file);
      if (!mounted) return;
      setState(() {
        _result = result;
        _busy = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return MobileStandaloneScaffold(
      title: 'Import data',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: <Widget>[
          MobilePanel(
            title: 'Import from Zobaze',
            action: const MobileTag(
              label: 'MIGRATION',
              icon: Icons.swap_horiz_rounded,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  'Moving from Zobaze? Export your Items and Customers as Excel '
                  '(.xlsx) from the Zobaze app, then load them here. Existing '
                  'records with the same details are updated, not duplicated.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: colors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _busy ? null : _import,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.upload_file_rounded),
                  label: Text(
                    _busy ? 'Importing...' : 'Choose Zobaze file (.xlsx)',
                  ),
                ),
              ],
            ),
          ),
          if (_error != null) ...<Widget>[
            const SizedBox(height: 16),
            _Banner(
              icon: Icons.error_rounded,
              color: AppPalette.error,
              title: 'Import failed',
              body: _error!,
            ),
          ],
          if (_result != null) ...<Widget>[
            const SizedBox(height: 16),
            _Banner(
              icon: Icons.check_circle_rounded,
              color: AppPalette.success,
              title: 'Import complete',
              body:
                  '${_result!.inventory} product(s), ${_result!.customers} '
                  'customer(s), and ${_result!.sales} receipt(s) imported.'
                  '\n\n${_result!.warnings.join('\n\n')}',
            ),
          ],
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.icon,
    required this.color,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(body, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
