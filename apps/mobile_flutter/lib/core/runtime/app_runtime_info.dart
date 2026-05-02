import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

final appRuntimeInfoProvider = FutureProvider<AppRuntimeInfo>((ref) async {
  return AppRuntimeInfo.load();
});

class AppRuntimeInfo {
  const AppRuntimeInfo({
    required this.appName,
    required this.packageName,
    required this.version,
    required this.buildNumber,
    required this.releaseChannel,
    required this.releaseSha,
    required this.releaseTag,
    required this.pilotScope,
  });

  final String appName;
  final String packageName;
  final String version;
  final String buildNumber;
  final String releaseChannel;
  final String releaseSha;
  final String releaseTag;
  final String pilotScope;

  String get versionLabel => '$version+$buildNumber';

  String get releaseFingerprint =>
      releaseSha.isEmpty ? releaseChannel : '$releaseChannel | $releaseSha';

  String get rolloutScopeLabel =>
      pilotScope.trim().isEmpty ? 'unspecified' : pilotScope.trim();

  static Future<AppRuntimeInfo> load() async {
    final packageInfo = await PackageInfo.fromPlatform();
    return AppRuntimeInfo(
      appName: packageInfo.appName,
      packageName: packageInfo.packageName,
      version: packageInfo.version,
      buildNumber: packageInfo.buildNumber,
      releaseChannel: const String.fromEnvironment(
        'BUSINESS_HUB_RELEASE_CHANNEL',
        defaultValue: 'local',
      ),
      releaseSha: const String.fromEnvironment(
        'BUSINESS_HUB_RELEASE_SHA',
        defaultValue: '',
      ),
      releaseTag: const String.fromEnvironment(
        'BUSINESS_HUB_RELEASE_TAG',
        defaultValue: 'dev-build',
      ),
      pilotScope: const String.fromEnvironment(
        'BUSINESS_HUB_PILOT_SCOPE',
        defaultValue: 'unspecified',
      ),
    );
  }
}
