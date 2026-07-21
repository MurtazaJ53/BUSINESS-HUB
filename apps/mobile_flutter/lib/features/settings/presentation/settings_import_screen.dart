import 'dart:convert';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_contacts/flutter_contacts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/import/universal_import.dart';
import '../../../core/import/xlsx_reader.dart' show looksLikeXlsx;
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
  static String _labelFor(ImportKind k) => switch (k) {
    ImportKind.products => 'products',
    ImportKind.customers => 'customers',
    ImportKind.sales => 'sales',
    ImportKind.expenses => 'expenses',
    ImportKind.suppliers => 'suppliers',
  };

  void _startBusy() => setState(() {
    _busy = true;
    _error = null;
    _result = null;
    _successText = null;
  });

  /// Pick a CSV/XLSX and parse it. Returns null (resetting busy) on cancel; throws
  /// with a clean message on an unreadable file.
  Future<ParsedTable?> _pickTable() async {
    final picked = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: <String>['csv', 'xlsx', 'xls'],
    );
    final path = picked?.files.single.path;
    if (path == null) {
      if (mounted) setState(() => _busy = false);
      return null;
    }
    final file = File(path);
    ParsedTable? table;
    if (path.toLowerCase().endsWith('.csv')) {
      table = parseCsv(await file.readAsString());
    } else {
      final bytes = await file.readAsBytes();
      if (!looksLikeXlsx(bytes)) {
        // Legacy .xls (BIFF) isn't a zip and can't be read by any reader here.
        throw Exception(
          'This is an old .xls file. Open it in Excel/Google Sheets and save it '
          'as .xlsx (or .csv), then import again.',
        );
      }
      table = parseXlsxBytes(bytes);
    }
    if (table == null) {
      throw Exception(
        "Couldn't read this spreadsheet. Please re-save it as .csv and try again.",
      );
    }
    if (table.headers.isEmpty || table.rows.isEmpty) {
      throw Exception('No rows found. The first line must be column headers.');
    }
    return table;
  }

  /// Show the mapping preview for [kind] + [table] and write the confirmed rows.
  Future<void> _runImport(ImportKind kind, ParsedTable table) async {
    final label = _labelFor(kind);
    if (!mounted) return;
    final mapping = await showMappingSheet(
      context, table: table, kind: kind, title: 'Import $label',
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
      ImportKind.expenses => await service.importExpenses(mapped),
      ImportKind.suppliers => throw Exception('Suppliers import is not available yet.'),
    };
    if (!mounted) return;
    setState(() {
      _busy = false;
      _successText = '${outcome.imported} $label imported'
          '${outcome.skipped > 0 ? ' (${outcome.skipped} skipped)' : ''}.'
          // Say it plainly when dates could not be read - these rows got
          // stamped with today, and the owner needs to know their history
          // was re-dated rather than find out from a wrong report later.
          '${outcome.undatedRows > 0 ? ' ${outcome.undatedRows} had an unreadable date and were set to today.' : ''}'
          // Tell them the file was already imported. Without this, a repeat
          // import looks identical to a fresh one and the only way to find out
          // is to go hunting through History.
          '${outcome.replacedRows > 0 ? ' ${outcome.replacedRows} already existed and were updated, not duplicated.' : ''}';
    });
  }

  /// Import a specific data type (user picked the icon).
  Future<void> _importUniversal(ImportKind kind) async {
    if (_busy) return;
    _startBusy();
    try {
      final table = await _pickTable();
      if (table == null) return;
      await _runImport(kind, table);
    } catch (error) {
      if (!mounted) return;
      setState(() { _busy = false; _error = error.toString(); });
    }
  }

  /// Smart import: pick ANY exported file, auto-detect whether it's products /
  /// customers / sales, then route it (asks only if we can't tell).
  Future<void> _smartImport() async {
    if (_busy) return;
    _startBusy();
    try {
      final table = await _pickTable();
      if (table == null) return;
      var kind = detectKind(table.headers);
      if (kind == null) {
        if (!mounted) return;
        kind = await _chooseKind();
        if (kind == null) {
          if (mounted) setState(() => _busy = false);
          return;
        }
      }
      await _runImport(kind, table);
    } catch (error) {
      if (!mounted) return;
      setState(() { _busy = false; _error = error.toString(); });
    }
  }

  Future<ImportKind?> _chooseKind() => showDialog<ImportKind>(
    context: context,
    builder: (ctx) => SimpleDialog(
      title: const Text("Couldn't auto-detect — what is this file?"),
      children: <Widget>[
        for (final k in detectableKinds)
          SimpleDialogOption(
            onPressed: () => Navigator.pop(ctx, k),
            child: Text('${_labelFor(k)[0].toUpperCase()}${_labelFor(k).substring(1)}'),
          ),
      ],
    ),
  );

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
          // 1) Smart import — auto-detect the type from ANY exported file.
          _SmartImportCard(busy: _busy, onTap: _smartImport),
          const SizedBox(height: 16),
          // 2) Or pick a specific type (individual icons).
          MobilePanel(
            title: 'Import a specific type',
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: <Widget>[
                _ImportTile(
                  icon: Icons.inventory_2_rounded,
                  label: 'Stock\n& items',
                  busy: _busy,
                  onTap: () => _importUniversal(ImportKind.products),
                ),
                _ImportTile(
                  icon: Icons.people_alt_rounded,
                  label: 'Clients',
                  busy: _busy,
                  onTap: () => _importUniversal(ImportKind.customers),
                ),
                _ImportTile(
                  icon: Icons.receipt_long_rounded,
                  label: 'Sales\n(history)',
                  busy: _busy,
                  onTap: () => _importUniversal(ImportKind.sales),
                ),
                _ImportTile(
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'Expenses',
                  busy: _busy,
                  onTap: () => _importUniversal(ImportKind.expenses),
                ),
                _ImportTile(
                  icon: Icons.contacts_rounded,
                  label: 'Phone\ncontacts',
                  busy: _busy,
                  onTap: _importContacts,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // 3) Sample templates + CSV export (round-trip).
          MobilePanel(
            title: 'Templates & export',
            child: Wrap(
              spacing: 8,
              children: <Widget>[
                TextButton.icon(
                  onPressed: _busy ? null : () => _downloadTemplate(ImportKind.products, 'products'),
                  icon: const Icon(Icons.description_outlined, size: 18),
                  label: const Text('Products sample'),
                ),
                TextButton.icon(
                  onPressed: _busy ? null : () => _downloadTemplate(ImportKind.customers, 'customers'),
                  icon: const Icon(Icons.description_outlined, size: 18),
                  label: const Text('Customers sample'),
                ),
                TextButton.icon(
                  onPressed: _busy ? null : () => _downloadTemplate(ImportKind.sales, 'sales'),
                  icon: const Icon(Icons.description_outlined, size: 18),
                  label: const Text('Sales sample'),
                ),
                TextButton.icon(
                  onPressed: _busy ? null : () => _downloadTemplate(ImportKind.expenses, 'expenses'),
                  icon: const Icon(Icons.description_outlined, size: 18),
                  label: const Text('Expenses sample'),
                ),
                TextButton.icon(
                  onPressed: _busy ? null : () => _exportCsv(ImportKind.products, 'products'),
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('Export products'),
                ),
                TextButton.icon(
                  onPressed: _busy ? null : () => _exportCsv(ImportKind.customers, 'customers'),
                  icon: const Icon(Icons.download_rounded, size: 18),
                  label: const Text('Export customers'),
                ),
              ],
            ),
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

/// Big primary "import any file" card that auto-detects the data type.
class _SmartImportCard extends StatelessWidget {
  const _SmartImportCard({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return MobilePanel(
      title: 'Smart import',
      action: const MobileTag(label: 'ANY APP', icon: Icons.auto_awesome_rounded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Have an export from Zobaze, Vyapar, Khatabook, Excel — anything? '
            'Pick the file and we auto-detect whether it is products, customers '
            'or sales, match the columns, and let you confirm before importing.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy ? null : onTap,
            icon: const Icon(Icons.auto_fix_high_rounded),
            label: const Text('Import any file (.csv / .xlsx)'),
          ),
        ],
      ),
    );
  }
}

/// A tappable icon tile for importing one specific data type.
class _ImportTile extends StatelessWidget {
  const _ImportTile({
    required this.icon,
    required this.label,
    required this.busy,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SizedBox(
      width: 78,
      child: Material(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: busy ? null : onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.borderSoft),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(icon, color: AppPalette.primary, size: 26),
                const SizedBox(height: 6),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, height: 1.15),
                ),
              ],
            ),
          ),
        ),
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
