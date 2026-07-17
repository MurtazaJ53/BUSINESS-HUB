import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/import/universal_import.dart';
import '../../../core/import/universal_import_service.dart';
import '../../../core/import/zobaze_import.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../shell/presentation/mobile_surface.dart';
import 'universal_import_sheet.dart';

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
  String? _successText;

  Future<void> _import() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _successText = null;
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

  /// Pick a CSV/XLSX file of any layout, auto-map its columns, let the user
  /// confirm, then import via the universal engine.
  Future<void> _importUniversal(ImportKind kind, String label) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _successText = null;
    });
    try {
      final picked = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: <String>['csv', 'xlsx', 'xls'],
      );
      final path = picked?.files.single.path;
      if (path == null) {
        if (mounted) setState(() => _busy = false);
        return;
      }
      final file = File(path);
      ParsedTable? table;
      if (path.toLowerCase().endsWith('.csv')) {
        table = parseCsv(await file.readAsString());
      } else {
        table = parseXlsxBytes(await file.readAsBytes());
      }
      if (table == null) {
        throw Exception(
          "Couldn't read this Excel file. Please re-save it as CSV and try again.",
        );
      }
      if (table.headers.isEmpty || table.rows.isEmpty) {
        throw Exception('No rows found. The first line must be column headers.');
      }
      if (!mounted) return;
      final mapping = await showMappingSheet(
        context,
        table: table,
        kind: kind,
        title: 'Import $label',
      );
      if (mapping == null) {
        if (mounted) setState(() => _busy = false);
        return; // cancelled
      }
      final mapped = mapRows(table, kind, mapping: mapping);
      final service = ref.read(universalImportServiceProvider);
      final outcome = switch (kind) {
        ImportKind.products => await service.importProducts(mapped),
        ImportKind.customers => await service.importCustomers(mapped),
        ImportKind.sales => await service.importSales(mapped),
        ImportKind.suppliers => throw Exception('Suppliers import is not available yet.'),
      };
      if (!mounted) return;
      setState(() {
        _busy = false;
        _successText = '${outcome.imported} $label imported'
            '${outcome.skipped > 0 ? ' (${outcome.skipped} skipped)' : ''}.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.toString();
      });
    }
  }

  /// Import customers straight from the phone's address book (name + first
  /// phone), without saving anything to the device's contacts.
  Future<void> _importContacts() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _successText = null;
    });
    try {
      final status = await FlutterContacts.permissions.request(PermissionType.read);
      if (status != PermissionStatus.granted && status != PermissionStatus.limited) {
        throw Exception('Contacts permission denied. Enable it in Settings to import.');
      }
      final contacts = await FlutterContacts.getAll(
        properties: <ContactProperty>{ContactProperty.name, ContactProperty.phone},
      );
      final rows = <Map<String, String>>[];
      for (final c in contacts) {
        final name = (c.displayName ?? '').trim();
        final phone = c.phones.isNotEmpty ? c.phones.first.number.trim() : '';
        if (name.isEmpty && phone.isEmpty) continue;
        rows.add(<String, String>{'name': name.isEmpty ? phone : name, 'phone': phone});
      }
      if (rows.isEmpty) throw Exception('No contacts with a name or phone were found.');
      final service = ref.read(universalImportServiceProvider);
      final outcome = await service.importCustomers(
        MappedImport(rows, const <String>[], ColumnMapping(const <String>[], const <String, int>{})),
      );
      if (!mounted) return;
      setState(() {
        _busy = false;
        _successText = '${outcome.imported} customer(s) imported from contacts.';
      });
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = e.toString(); });
    }
  }

  /// Save CSV text to a user-chosen location; returns a status message.
  Future<void> _saveCsv(String content, String fileName) async {
    final path = await FilePicker.platform.saveFile(
      fileName: fileName,
      type: FileType.custom,
      allowedExtensions: <String>['csv'],
      bytes: utf8.encode(content),
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (path != null) _successText = 'Saved $fileName.';
    });
  }

  Future<void> _downloadTemplate(ImportKind kind, String label) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _successText = null;
    });
    try {
      await _saveCsv(templateCsvFor(kind), '${label}_template.csv');
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = e.toString(); });
    }
  }

  Future<void> _exportCsv(ImportKind kind, String label) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _result = null;
      _successText = null;
    });
    try {
      final service = ref.read(universalImportServiceProvider);
      final csv = kind == ImportKind.products
          ? await service.exportProductsCsv()
          : await service.exportCustomersCsv();
      await _saveCsv(csv, '${label}_export.csv');
    } catch (e) {
      if (mounted) setState(() { _busy = false; _error = e.toString(); });
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
          _UniversalCard(
            title: 'Products & inventory',
            subtitle:
                'CSV or Excel from any app. We auto-detect columns like name, '
                'price, stock, SKU — you confirm before importing.',
            icon: Icons.inventory_2_rounded,
            busy: _busy,
            onTap: () => _importUniversal(ImportKind.products, 'products'),
            onSample: () => _downloadTemplate(ImportKind.products, 'products'),
            onExport: () => _exportCsv(ImportKind.products, 'products'),
          ),
          const SizedBox(height: 16),
          _UniversalCard(
            title: 'Customers (clients)',
            subtitle:
                'CSV or Excel with name, phone, balance/advance in any column '
                'order. Existing customers are updated, not duplicated.',
            icon: Icons.people_alt_rounded,
            busy: _busy,
            onTap: () => _importUniversal(ImportKind.customers, 'customers'),
            onSample: () => _downloadTemplate(ImportKind.customers, 'customers'),
            onExport: () => _exportCsv(ImportKind.customers, 'customers'),
            onContacts: _importContacts,
          ),
          const SizedBox(height: 16),
          _UniversalCard(
            title: 'Sales history (POS)',
            subtitle:
                'CSV or Excel with one row per bill (total, date, payment, '
                'customer). Imported as historical sales — shown in History & '
                'Reports; they do not change current stock.',
            icon: Icons.receipt_long_rounded,
            busy: _busy,
            onTap: () => _importUniversal(ImportKind.sales, 'sales'),
            onSample: () => _downloadTemplate(ImportKind.sales, 'sales'),
          ),
          const SizedBox(height: 16),
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
          if (_successText != null) ...<Widget>[
            const SizedBox(height: 16),
            _Banner(
              icon: Icons.check_circle_rounded,
              color: AppPalette.success,
              title: 'Import complete',
              body: _successText!,
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

class _UniversalCard extends StatelessWidget {
  const _UniversalCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.busy,
    required this.onTap,
    this.onSample,
    this.onExport,
    this.onContacts,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool busy;
  final VoidCallback onTap;
  final VoidCallback? onSample;
  final VoidCallback? onExport;
  final VoidCallback? onContacts;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return MobilePanel(
      title: title,
      action: const MobileTag(label: 'ANY FORMAT', icon: Icons.auto_awesome_rounded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy ? null : onTap,
            icon: Icon(icon),
            label: const Text('Choose file (.csv / .xlsx)'),
          ),
          if (onContacts != null)
            TextButton.icon(
              onPressed: busy ? null : onContacts,
              icon: const Icon(Icons.contacts_rounded, size: 18),
              label: const Text('Import from phone contacts'),
            ),
          Wrap(
            spacing: 8,
            children: <Widget>[
              if (onSample != null)
                TextButton.icon(
                  onPressed: busy ? null : onSample,
                  icon: const Icon(Icons.description_outlined, size: 18),
                  label: const Text('Sample'),
                ),
              if (onExport != null)
                TextButton.icon(
                  onPressed: busy ? null : onExport,
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('Export CSV'),
                ),
            ],
          ),
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
