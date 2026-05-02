import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class PosScannerSheet extends StatefulWidget {
  const PosScannerSheet({super.key});

  @override
  State<PosScannerSheet> createState() => _PosScannerSheetState();
}

class _PosScannerSheetState extends State<PosScannerSheet> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  final TextEditingController _manualCodeController = TextEditingController();
  bool _didResolve = false;

  @override
  void dispose() {
    _manualCodeController.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _resolveCode(String rawCode) {
    final code = rawCode.trim();
    if (_didResolve || code.isEmpty || !mounted) {
      return;
    }
    _didResolve = true;
    Navigator.of(context).pop(code);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 18,
          right: 18,
          top: 18,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Scan barcode or exact code',
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Point the camera at a barcode, QR code, or exact inventory code. You can also type the code manually below.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: Colors.white.withValues(alpha: 0.68),
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(26),
              child: AspectRatio(
                aspectRatio: 1,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF050A12),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                  ),
                  child: MobileScanner(
                    controller: _controller,
                    onDetect: (capture) {
                      for (final barcode in capture.barcodes) {
                        final raw = barcode.rawValue;
                        if (raw != null && raw.trim().isNotEmpty) {
                          _resolveCode(raw);
                          break;
                        }
                      }
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _manualCodeController,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.keyboard_alt_rounded),
                labelText: 'Manual code',
                hintText: 'Enter SKU or barcode',
              ),
              onSubmitted: _resolveCode,
            ),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                    label: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _resolveCode(_manualCodeController.text),
                    icon: const Icon(Icons.search_rounded),
                    label: const Text('Use code'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
