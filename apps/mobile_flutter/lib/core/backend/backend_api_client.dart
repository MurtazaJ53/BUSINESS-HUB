import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mobile_models.dart';

final backendApiClientProvider = Provider<BackendApiClient>((ref) {
  return BackendApiClient(
    baseUrl: const String.fromEnvironment(
      'BUSINESS_HUB_API_BASE_URL',
      defaultValue: 'http://10.0.2.2:8000/api/v1',
    ),
  );
});

class BackendApiException implements Exception {
  BackendApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class BackendCommandResponse {
  const BackendCommandResponse({
    required this.commandId,
    required this.receiptId,
    required this.duplicate,
    required this.resultStatus,
    this.entityId,
  });

  final String commandId;
  final String receiptId;
  final bool duplicate;
  final String resultStatus;
  final String? entityId;
}

class WorkspaceSessionHeartbeatPayload {
  const WorkspaceSessionHeartbeatPayload({
    required this.appInstanceId,
    required this.deviceLabel,
    required this.platformName,
    required this.packageName,
    required this.appVersion,
    required this.buildNumber,
    required this.releaseChannel,
    required this.releaseTag,
    this.metadata = const <String, dynamic>{},
  });

  final String appInstanceId;
  final String deviceLabel;
  final String platformName;
  final String packageName;
  final String appVersion;
  final String buildNumber;
  final String releaseChannel;
  final String releaseTag;
  final Map<String, dynamic> metadata;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'app_instance_id': appInstanceId,
    'device_label': deviceLabel,
    'platform_name': platformName,
    'package_name': packageName,
    'app_version': appVersion,
    'build_number': buildNumber,
    'release_channel': releaseChannel,
    'release_tag': releaseTag,
    'metadata_json': metadata,
  };
}

class UserMfaVerifyPayload {
  const UserMfaVerifyPayload({required this.purpose, required this.code});

  final String purpose;
  final String code;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'purpose': purpose,
    'code': code,
  };
}

class BackendApiClient {
  BackendApiClient({required this.baseUrl});

  final String baseUrl;

  Future<DomainControlState> getDomainState({
    required User user,
    required String shopId,
    required String domain,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/domain-state/$domain/',
    );

    return DomainControlState.fromJson(decoded, fallbackDomain: domain);
  }

  Future<BackendCommandResponse> submitSaleCommand({
    required User user,
    required String shopId,
    required Map<String, dynamic> payload,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/sales/commands/',
      body: payload,
    );

    return BackendCommandResponse(
      commandId: (decoded['command_id'] ?? '').toString(),
      receiptId: (decoded['receipt_id'] ?? '').toString(),
      duplicate: decoded['duplicate'] == true,
      resultStatus: (decoded['result_status'] ?? '').toString(),
      entityId: decoded['sale'] is Map
          ? (decoded['sale']['id'] ?? '').toString()
          : null,
    );
  }

  Future<BackendCommandResponse> submitPaymentCommand({
    required User user,
    required String shopId,
    required Map<String, dynamic> payload,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/payments/commands/',
      body: payload,
    );

    return BackendCommandResponse(
      commandId: (decoded['command_id'] ?? '').toString(),
      receiptId: (decoded['receipt_id'] ?? '').toString(),
      duplicate: decoded['duplicate'] == true,
      resultStatus: (decoded['result_status'] ?? '').toString(),
      entityId: decoded['payment'] is Map
          ? (decoded['payment']['id'] ?? '').toString()
          : null,
    );
  }

  Future<List<Map<String, dynamic>>> fetchRecentSales({
    required User user,
    required String shopId,
    int limit = 40,
  }) async {
    final decoded = await _requestList(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/sales/',
    );

    if (decoded.length <= limit) {
      return decoded;
    }
    return decoded.take(limit).toList(growable: false);
  }

  Future<List<BackendCustomerSummary>> fetchCustomers({
    required User user,
    required String shopId,
    String query = '',
  }) async {
    final normalized = query.trim();
    final path = normalized.isEmpty
        ? '/shops/$shopId/customers/'
        : '/shops/$shopId/customers/?q=${Uri.encodeQueryComponent(normalized)}';
    final decoded = await _requestList(user: user, method: 'GET', path: path);
    return decoded.map(_mapCustomerSummary).toList(growable: false);
  }

  Future<BackendCustomerSummary> createCustomer({
    required User user,
    required String shopId,
    required String name,
    String? phone,
    String? email,
    String? notes,
    double openingBalance = 0,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/customers/',
      body: <String, dynamic>{
        'name': name,
        'phone': phone ?? '',
        'email': email ?? '',
        'notes': notes ?? '',
        'opening_balance': openingBalance.toStringAsFixed(2),
      },
    );
    return _mapCustomerSummary(decoded);
  }

  Future<BackendCustomerSummary> updateCustomer({
    required User user,
    required String shopId,
    required String customerId,
    required String name,
    String? phone,
    String? email,
    String? notes,
    String status = 'active',
  }) async {
    final decoded = await _request(
      user: user,
      method: 'PUT',
      path: '/shops/$shopId/customers/$customerId/',
      body: <String, dynamic>{
        'name': name,
        'phone': phone ?? '',
        'email': email ?? '',
        'notes': notes ?? '',
        'status': status,
      },
    );
    return _mapCustomerSummary(decoded);
  }

  Future<List<CustomerLedgerPreviewEntry>> fetchCustomerLedger({
    required User user,
    required String shopId,
    required String customerId,
  }) async {
    final decoded = await _requestList(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/customers/$customerId/ledger/',
    );
    return decoded
        .map(
          (row) => CustomerLedgerPreviewEntry(
            id: (row['id'] ?? '').toString(),
            eventType: (row['event_type'] ?? 'adjustment').toString(),
            amountDelta: _asDouble(row['amount_delta']),
            occurredAt: _asDateTime(row['occurred_at']),
            note: _nullableText(row['note']),
            actorName: _nullableText(row['actor_name']),
          ),
        )
        .toList(growable: false);
  }

  Future<CustomerLedgerPreviewEntry> createCustomerLedgerEntry({
    required User user,
    required String shopId,
    required String customerId,
    required CustomerLedgerMutationDraft draft,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/customers/$customerId/ledger/',
      body: draft.toJson(),
    );

    return CustomerLedgerPreviewEntry(
      id: (decoded['id'] ?? '').toString(),
      eventType: (decoded['event_type'] ?? draft.eventType).toString(),
      amountDelta: _asDouble(decoded['amount_delta'] ?? draft.amountDelta),
      occurredAt: _asDateTime(decoded['occurred_at'] ?? draft.occurredAt),
      note: _nullableText(decoded['note'] ?? draft.note),
      actorName: _nullableText(decoded['actor_name']),
    );
  }

  Future<WorkspaceAccessSessionHeartbeatResult> sendWorkspaceSessionHeartbeat({
    required User user,
    required String shopId,
    required WorkspaceSessionHeartbeatPayload payload,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/sessions/mobile/heartbeat/',
      body: payload.toJson(),
    );

    return WorkspaceAccessSessionHeartbeatResult(
      sessionId: (decoded['session_id'] ?? '').toString(),
      status: (decoded['status'] ?? '').toString(),
      deviceLabel: (decoded['device_label'] ?? payload.deviceLabel).toString(),
      shouldSignOut: decoded['should_sign_out'] == true,
      shouldWipeLocalData: decoded['should_wipe_local_data'] == true,
      revokeReason: _nullableText(decoded['revoke_reason']),
      revokedAt: _asNullableDateTime(decoded['revoked_at']),
      wipeRequestedAt: _asNullableDateTime(decoded['wipe_requested_at']),
      wipeAcknowledgedAt: _asNullableDateTime(decoded['wipe_acknowledged_at']),
    );
  }

  Future<UserMfaStatus> getUserMfaStatus({required User user}) async {
    final decoded = await _request(
      user: user,
      method: 'GET',
      path: '/session/mfa/',
    );
    return _mapUserMfaStatus(decoded);
  }

  Future<UserMfaStatus> beginUserMfaEnrollment({required User user}) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/session/mfa/enroll/',
      body: const <String, dynamic>{},
    );
    return _mapUserMfaStatus(decoded);
  }

  Future<UserMfaVerifyResult> verifyUserMfaCode({
    required User user,
    required UserMfaVerifyPayload payload,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/session/mfa/verify/',
      body: payload.toJson(),
    );
    return UserMfaVerifyResult(
      status: _mapUserMfaStatus(
        Map<String, dynamic>.from(decoded['status'] as Map<String, dynamic>),
      ),
      verifiedAt: _asDateTime(decoded['verified_at']),
      verifiedUntil: _asDateTime(decoded['verified_until']),
    );
  }

  Future<UserMfaStatus> disableUserMfa({
    required User user,
    required String code,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/session/mfa/disable/',
      body: <String, dynamic>{'code': code},
    );
    return _mapUserMfaStatus(decoded);
  }

  Future<WorkspacePulseSnapshot> getWorkspacePulse({
    required User user,
    required String shopId,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/projections/pulse/',
    );

    return WorkspacePulseSnapshot(
      refreshedAt: _asDateTime(decoded['refreshed_at']),
      headline: WorkspacePulseHeadline(
        title: (decoded['headline']?['title'] ?? '').toString(),
        body: (decoded['headline']?['body'] ?? '').toString(),
        route: (decoded['headline']?['route'] ?? '/history').toString(),
        ctaLabel: (decoded['headline']?['cta_label'] ?? 'Open').toString(),
        tone: (decoded['headline']?['tone'] ?? 'info').toString(),
      ),
      stats: WorkspacePulseStats(
        openTaskCount: _asInt(decoded['stats']?['open_task_count']),
        criticalAnomalyCount: _asInt(decoded['stats']?['critical_anomaly_count']),
        warningAnomalyCount: _asInt(decoded['stats']?['warning_anomaly_count']),
        staleSessionCount: _asInt(decoded['stats']?['stale_session_count']),
        wipePendingCount: _asInt(decoded['stats']?['wipe_pending_count']),
        openPlanRequestCount: _asInt(decoded['stats']?['open_plan_request_count']),
        lowStockCount: _asInt(decoded['stats']?['low_stock_count']),
      ),
      tasks: ((decoded['tasks'] ?? const <dynamic>[]) as List<dynamic>)
          .whereType<Map>()
          .map(
            (row) => WorkspacePulseTask(
              code: (row['code'] ?? '').toString(),
              priority: (row['priority'] ?? 'medium').toString(),
              tone: (row['tone'] ?? 'info').toString(),
              title: (row['title'] ?? '').toString(),
              body: (row['body'] ?? '').toString(),
              route: (row['route'] ?? '/history').toString(),
              ctaLabel: (row['cta_label'] ?? 'Open').toString(),
              count: _asInt(row['count']),
              metadata: row['metadata_json'] is Map
                  ? Map<String, dynamic>.from(row['metadata_json'] as Map)
                  : const <String, dynamic>{},
            ),
          )
          .toList(growable: false),
      anomalies: ((decoded['anomalies'] ?? const <dynamic>[]) as List<dynamic>)
          .whereType<Map>()
          .map(
            (row) => WorkspacePulseAnomaly(
              code: (row['code'] ?? '').toString(),
              severity: (row['severity'] ?? 'info').toString(),
              title: (row['title'] ?? '').toString(),
              body: (row['body'] ?? '').toString(),
              route: (row['route'] ?? '/history').toString(),
              ctaLabel: (row['cta_label'] ?? 'Open').toString(),
              metricValue: (row['metric_value'] ?? '').toString(),
              metadata: row['metadata_json'] is Map
                  ? Map<String, dynamic>.from(row['metadata_json'] as Map)
                  : const <String, dynamic>{},
            ),
          )
          .toList(growable: false),
    );
  }

  Future<void> acknowledgeWorkspaceSessionWipe({
    required User user,
    required String shopId,
    required String sessionId,
  }) async {
    await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/sessions/$sessionId/wipe-ack/',
    );
  }

  Future<Map<String, dynamic>> _request({
    required User user,
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw BackendApiException(
        'Missing Firebase auth token for backend request.',
      );
    }

    if (baseUrl.trim().isEmpty) {
      throw BackendApiException(
        'BUSINESS_HUB_API_BASE_URL is not configured for Flutter mobile.',
      );
    }

    final client = HttpClient();
    try {
      final url = Uri.parse('${baseUrl.replaceAll(RegExp(r"/$"), "")}$path');
      final request = await client.openUrl(method, url);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      if (body != null) {
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
        request.write(jsonEncode(body));
      }

      final response = await request.close();
      final bodyText = await utf8.decodeStream(response);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw BackendApiException(
          'Backend request failed (${response.statusCode}) for $path: $bodyText',
          statusCode: response.statusCode,
        );
      }

      if (bodyText.trim().isEmpty) {
        return <String, dynamic>{};
      }
      return Map<String, dynamic>.from(
        jsonDecode(bodyText) as Map<String, dynamic>,
      );
    } finally {
      client.close(force: true);
    }
  }

  Future<List<Map<String, dynamic>>> _requestList({
    required User user,
    required String method,
    required String path,
  }) async {
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw BackendApiException(
        'Missing Firebase auth token for backend request.',
      );
    }

    if (baseUrl.trim().isEmpty) {
      throw BackendApiException(
        'BUSINESS_HUB_API_BASE_URL is not configured for Flutter mobile.',
      );
    }

    final client = HttpClient();
    try {
      final url = Uri.parse('${baseUrl.replaceAll(RegExp(r"/$"), "")}$path');
      final request = await client.openUrl(method, url);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');

      final response = await request.close();
      final bodyText = await utf8.decodeStream(response);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw BackendApiException(
          'Backend request failed (${response.statusCode}) for $path: $bodyText',
          statusCode: response.statusCode,
        );
      }

      if (bodyText.trim().isEmpty) {
        return const <Map<String, dynamic>>[];
      }

      final decoded = jsonDecode(bodyText);
      if (decoded is! List) {
        throw BackendApiException(
          'Backend request for $path did not return a list payload.',
        );
      }
      return decoded
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
    } finally {
      client.close(force: true);
    }
  }

  BackendCustomerSummary _mapCustomerSummary(Map<String, dynamic> row) {
    return BackendCustomerSummary(
      id: (row['id'] ?? '').toString(),
      name: (row['name'] ?? 'Unnamed customer').toString(),
      phone: _nullableText(row['phone']),
      email: _nullableText(row['email']),
      totalSpent: _asDouble(row['total_spent']),
      balance: _asDouble(row['balance']),
      status: (row['status'] ?? 'active').toString(),
      notes: _nullableText(row['notes']),
    );
  }

  UserMfaStatus _mapUserMfaStatus(Map<String, dynamic> row) {
    return UserMfaStatus(
      totpEnabled: row['totp_enabled'] == true,
      totpPendingEnrollment: row['totp_pending_enrollment'] == true,
      enabledAt: _asNullableDateTime(row['enabled_at']),
      lastVerifiedAt: _asNullableDateTime(row['last_verified_at']),
      issuerLabel: (row['issuer_label'] ?? 'Business Hub').toString(),
      accountLabel: (row['account_label'] ?? '').toString(),
      challengeWindowSeconds: row['challenge_window_seconds'] is num
          ? (row['challenge_window_seconds'] as num).toInt()
          : int.tryParse('${row['challenge_window_seconds']}') ?? 0,
      pendingManualSecret: (row['pending_manual_secret'] ?? '').toString(),
      pendingOtpauthUri: (row['pending_otpauth_uri'] ?? '').toString(),
    );
  }
}

double _asDouble(Object? value) {
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}

int _asInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

DateTime _asDateTime(Object? value) {
  if (value is DateTime) {
    return value;
  }
  if (value is String) {
    return DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
  }
  return DateTime.now();
}

DateTime? _asNullableDateTime(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is DateTime) {
    return value;
  }
  if (value is String) {
    return DateTime.tryParse(value)?.toLocal();
  }
  return null;
}

String? _nullableText(Object? value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}
