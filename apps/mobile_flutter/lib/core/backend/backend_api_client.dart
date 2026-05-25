import 'dart:async';
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
  static const Duration _requestTimeout = Duration(seconds: 8);

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

  Future<List<ShopMembershipAccessRecord>> getShopMemberships({
    required User user,
  }) async {
    final decoded = await _requestList(
      user: user,
      method: 'GET',
      path: '/shops/',
    );
    return decoded
        .map(
          (row) => ShopMembershipAccessRecord(
            id: (row['id'] ?? '').toString(),
            role: (row['role'] ?? 'staff').toString(),
            roleLabel: (row['role_label'] ?? 'Staff').toString(),
            roleSummary: (row['role_summary'] ?? '').toString(),
            roleProfile: (row['role_profile'] ?? '').toString(),
            status: (row['status'] ?? 'active').toString(),
            shopId: (row['shop_id'] ?? '').toString(),
            shopName: (row['shop_name'] ?? '').toString(),
            shopSlug: (row['shop_slug'] ?? '').toString(),
            shopCurrencyCode: (row['shop_currency_code'] ?? 'INR').toString(),
            shopTimezone: (row['shop_timezone'] ?? 'Asia/Kolkata').toString(),
            shopPlanTier: (row['shop_plan_tier'] ?? 'growth').toString(),
            shopEnabledFeatures: row['shop_enabled_features'] is Map
                ? Map<String, bool>.from(
                    (row['shop_enabled_features'] as Map).map(
                      (key, value) => MapEntry(key.toString(), value == true),
                    ),
                  )
                : const <String, bool>{},
          ),
        )
        .toList(growable: false);
  }

  Future<List<WorkspaceTeamMemberRecord>> getWorkspaceTeamMembers({
    required User user,
    required String shopId,
  }) async {
    final decoded = await _requestList(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/team/',
    );
    return decoded.map(_mapWorkspaceTeamMember).toList(growable: false);
  }

  Future<WorkspaceTeamMemberRecord> createWorkspaceTeamMember({
    required User user,
    required String shopId,
    required String email,
    String fullName = '',
    String phone = '',
    String role = 'staff',
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/team/',
      body: <String, dynamic>{
        'email': email,
        'full_name': fullName,
        'phone': phone,
        'role': role,
      },
    );
    return _mapWorkspaceTeamMember(decoded);
  }

  Future<WorkspaceTeamMemberRecord> updateWorkspaceTeamMember({
    required User user,
    required String shopId,
    required String membershipId,
    String? role,
    String? status,
  }) async {
    final body = <String, dynamic>{};
    if (role != null) {
      body['role'] = role;
    }
    if (status != null) {
      body['status'] = status;
    }
    final decoded = await _request(
      user: user,
      method: 'PATCH',
      path: '/shops/$shopId/team/$membershipId/',
      body: body,
    );
    return _mapWorkspaceTeamMember(decoded);
  }

  Future<AttendanceSummarySnapshot> getAttendanceSummary({
    required User user,
    required String shopId,
    String? membershipId,
  }) async {
    final query = membershipId == null || membershipId.trim().isEmpty
        ? ''
        : '?membership_id=${Uri.encodeQueryComponent(membershipId.trim())}';
    final decoded = await _request(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/attendance/summary/$query',
    );
    return AttendanceSummarySnapshot(
      totalSessions: _asInt(decoded['total_sessions']),
      presentCount: _asInt(decoded['present_count']),
      leaveCount: _asInt(decoded['leave_count']),
      activeWorkersToday: _asInt(decoded['active_workers_today']),
    );
  }

  Future<List<AttendanceSessionRecord>> getAttendanceSessions({
    required User user,
    required String shopId,
    String? membershipId,
  }) async {
    final query = membershipId == null || membershipId.trim().isEmpty
        ? ''
        : '?membership_id=${Uri.encodeQueryComponent(membershipId.trim())}';
    final decoded = await _requestList(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/attendance/$query',
    );
    return decoded.map(_mapAttendanceSession).toList(growable: false);
  }

  Future<AttendanceSessionRecord> createAttendanceSession({
    required User user,
    required String shopId,
    required String membershipId,
    required DateTime sessionDate,
    required String status,
    DateTime? clockInAt,
    DateTime? clockOutAt,
    String note = '',
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/attendance/',
      body: <String, dynamic>{
        'membership_id': membershipId,
        'session_date': sessionDate.toIso8601String().split('T').first,
        'status': status,
        'clock_in_at': clockInAt?.toIso8601String(),
        'clock_out_at': clockOutAt?.toIso8601String(),
        'note': note,
      },
    );
    return _mapAttendanceSession(decoded);
  }

  Future<ExpenseSummarySnapshot> getExpenseSummary({
    required User user,
    required String shopId,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/expenses/summary/',
    );
    return ExpenseSummarySnapshot(
      totalEntries: _asInt(decoded['total_entries']),
      totalAmount: _asDouble(decoded['total_amount']),
      uniqueCategories: _asInt(decoded['unique_categories']),
      biggestCategory: _nullableText(decoded['biggest_category']),
    );
  }

  Future<List<ExpenseRecord>> getExpenses({
    required User user,
    required String shopId,
    String query = '',
    String category = '',
  }) async {
    final queryParts = <String>[];
    if (query.trim().isNotEmpty) {
      queryParts.add('q=${Uri.encodeQueryComponent(query.trim())}');
    }
    if (category.trim().isNotEmpty) {
      queryParts.add('category=${Uri.encodeQueryComponent(category.trim())}');
    }
    final path = queryParts.isEmpty
        ? '/shops/$shopId/expenses/'
        : '/shops/$shopId/expenses/?${queryParts.join('&')}';
    final decoded = await _requestList(user: user, method: 'GET', path: path);
    return decoded.map(_mapExpense).toList(growable: false);
  }

  Future<ExpenseRecord> createExpense({
    required User user,
    required String shopId,
    required String category,
    required double amount,
    required DateTime expenseDate,
    String description = '',
    String paymentMethod = 'CASH',
    String paymentReference = '',
  }) async {
    final decoded = await _request(
      user: user,
      method: 'POST',
      path: '/shops/$shopId/expenses/',
      body: <String, dynamic>{
        'category': category,
        'amount': amount.toStringAsFixed(2),
        'description': description,
        'payment_method': paymentMethod,
        'payment_reference': paymentReference,
        'expense_date': expenseDate.toIso8601String().split('T').first,
      },
    );
    return _mapExpense(decoded);
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
        criticalAnomalyCount: _asInt(
          decoded['stats']?['critical_anomaly_count'],
        ),
        warningAnomalyCount: _asInt(decoded['stats']?['warning_anomaly_count']),
        staleSessionCount: _asInt(decoded['stats']?['stale_session_count']),
        wipePendingCount: _asInt(decoded['stats']?['wipe_pending_count']),
        openPlanRequestCount: _asInt(
          decoded['stats']?['open_plan_request_count'],
        ),
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

  Future<List<WorkspacePulseSignal>> getWorkspacePulseSignals({
    required User user,
    required String shopId,
    String? status,
  }) async {
    final path = status == null || status.trim().isEmpty
        ? '/shops/$shopId/projections/pulse/signals/'
        : '/shops/$shopId/projections/pulse/signals/?status=${Uri.encodeQueryComponent(status.trim())}';
    final decoded = await _requestList(user: user, method: 'GET', path: path);
    return decoded
        .map(
          (row) => WorkspacePulseSignal(
            id: (row['id'] ?? '').toString(),
            signalKind: (row['signal_kind'] ?? '').toString(),
            code: (row['code'] ?? '').toString(),
            status: (row['status'] ?? 'open').toString(),
            signalLevel: (row['signal_level'] ?? '').toString(),
            signalRank: _asInt(row['signal_rank']),
            tone: (row['tone'] ?? '').toString(),
            title: (row['title'] ?? '').toString(),
            body: (row['body'] ?? '').toString(),
            route: (row['route'] ?? '/history').toString(),
            ctaLabel: (row['cta_label'] ?? 'Open').toString(),
            metricValue: (row['metric_value'] ?? '').toString(),
            count: _asInt(row['count']),
            firstDetectedAt: _asDateTime(row['first_detected_at']),
            lastDetectedAt: _asDateTime(row['last_detected_at']),
            lastSnapshotRefreshedAt: _asDateTime(
              row['last_snapshot_refreshed_at'],
            ),
            assignedMembershipId: _nullableText(row['assigned_membership_id']),
            assignedMemberName: _nullableText(row['assigned_member_name']),
            assignedMemberRole: _nullableText(row['assigned_member_role']),
            assignedAt: _asNullableDateTime(row['assigned_at']),
            assignedByName: _nullableText(row['assigned_by_name']),
            acknowledgedAt: _asNullableDateTime(row['acknowledged_at']),
            acknowledgedByName: _nullableText(row['acknowledged_by_name']),
            isEscalated: row['is_escalated'] == true,
            escalatedAt: _asNullableDateTime(row['escalated_at']),
            escalatedByName: _nullableText(row['escalated_by_name']),
            escalationNote: (row['escalation_note'] ?? '').toString(),
            followUpNote: (row['follow_up_note'] ?? '').toString(),
            resolvedAt: _asNullableDateTime(row['resolved_at']),
            resolvedByName: _nullableText(row['resolved_by_name']),
            resolutionNote: (row['resolution_note'] ?? '').toString(),
            metadata: row['metadata_json'] is Map
                ? Map<String, dynamic>.from(row['metadata_json'] as Map)
                : const <String, dynamic>{},
          ),
        )
        .toList(growable: false);
  }

  Future<WorkspacePulseSignal> updateWorkspacePulseSignal({
    required User user,
    required String shopId,
    required String signalId,
    required String action,
    String note = '',
    String? assigneeMembershipId,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'PATCH',
      path: '/shops/$shopId/projections/pulse/signals/$signalId/',
      body: <String, dynamic>{
        'action': action,
        'note': note,
        if (assigneeMembershipId != null &&
            assigneeMembershipId.trim().isNotEmpty)
          'assignee_membership_id': assigneeMembershipId,
      },
    );

    return WorkspacePulseSignal(
      id: (decoded['id'] ?? '').toString(),
      signalKind: (decoded['signal_kind'] ?? '').toString(),
      code: (decoded['code'] ?? '').toString(),
      status: (decoded['status'] ?? 'open').toString(),
      signalLevel: (decoded['signal_level'] ?? '').toString(),
      signalRank: _asInt(decoded['signal_rank']),
      tone: (decoded['tone'] ?? '').toString(),
      title: (decoded['title'] ?? '').toString(),
      body: (decoded['body'] ?? '').toString(),
      route: (decoded['route'] ?? '/history').toString(),
      ctaLabel: (decoded['cta_label'] ?? 'Open').toString(),
      metricValue: (decoded['metric_value'] ?? '').toString(),
      count: _asInt(decoded['count']),
      firstDetectedAt: _asDateTime(decoded['first_detected_at']),
      lastDetectedAt: _asDateTime(decoded['last_detected_at']),
      lastSnapshotRefreshedAt: _asDateTime(
        decoded['last_snapshot_refreshed_at'],
      ),
      assignedMembershipId: _nullableText(decoded['assigned_membership_id']),
      assignedMemberName: _nullableText(decoded['assigned_member_name']),
      assignedMemberRole: _nullableText(decoded['assigned_member_role']),
      assignedAt: _asNullableDateTime(decoded['assigned_at']),
      assignedByName: _nullableText(decoded['assigned_by_name']),
      acknowledgedAt: _asNullableDateTime(decoded['acknowledged_at']),
      acknowledgedByName: _nullableText(decoded['acknowledged_by_name']),
      isEscalated: decoded['is_escalated'] == true,
      escalatedAt: _asNullableDateTime(decoded['escalated_at']),
      escalatedByName: _nullableText(decoded['escalated_by_name']),
      escalationNote: (decoded['escalation_note'] ?? '').toString(),
      followUpNote: (decoded['follow_up_note'] ?? '').toString(),
      resolvedAt: _asNullableDateTime(decoded['resolved_at']),
      resolvedByName: _nullableText(decoded['resolved_by_name']),
      resolutionNote: (decoded['resolution_note'] ?? '').toString(),
      metadata: decoded['metadata_json'] is Map
          ? Map<String, dynamic>.from(decoded['metadata_json'] as Map)
          : const <String, dynamic>{},
    );
  }

  Future<List<WorkspaceAccessSessionRecord>> getWorkspaceAccessSessions({
    required User user,
    required String shopId,
  }) async {
    final decoded = await _requestList(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/sessions/',
    );
    return decoded
        .map(
          (row) => WorkspaceAccessSessionRecord(
            id: (row['id'] ?? '').toString(),
            memberName: (row['member_name'] ?? '').toString(),
            memberEmail: (row['member_email'] ?? '').toString(),
            membershipRoleSnapshot: (row['membership_role_snapshot'] ?? 'staff')
                .toString(),
            roleLabel: (row['role_label'] ?? 'Staff').toString(),
            status: (row['status'] ?? 'active').toString(),
            deviceLabel: (row['device_label'] ?? '').toString(),
            platformName: (row['platform_name'] ?? '').toString(),
            packageName: (row['package_name'] ?? '').toString(),
            appVersion: (row['app_version'] ?? '').toString(),
            buildNumber: (row['build_number'] ?? '').toString(),
            releaseChannel: (row['release_channel'] ?? '').toString(),
            releaseTag: (row['release_tag'] ?? '').toString(),
            lastSeenAt: _asNullableDateTime(row['last_seen_at']),
            revokedAt: _asNullableDateTime(row['revoked_at']),
            revokeReason: _nullableText(row['revoke_reason']),
            wipeRequested: row['wipe_requested'] == true,
            wipeRequestedAt: _asNullableDateTime(row['wipe_requested_at']),
            wipeAcknowledgedAt: _asNullableDateTime(
              row['wipe_acknowledged_at'],
            ),
            trustScore: _asInt(row['trust_score']),
            trustLevel: (row['trust_level'] ?? 'review').toString(),
            trustSummary: (row['trust_summary'] ?? '').toString(),
            trustReasons:
                ((row['trust_reasons'] ?? const <dynamic>[]) as List<dynamic>)
                    .map((item) => item.toString())
                    .where((item) => item.trim().isNotEmpty)
                    .toList(growable: false),
            metadata: row['metadata_json'] is Map
                ? Map<String, dynamic>.from(row['metadata_json'] as Map)
                : const <String, dynamic>{},
            canManage: row['can_manage'] == true,
            createdAt: _asDateTime(row['created_at']),
            updatedAt: _asDateTime(row['updated_at']),
          ),
        )
        .toList(growable: false);
  }

  Future<WorkspaceAccessSessionRecord> updateWorkspaceAccessSession({
    required User user,
    required String shopId,
    required String sessionId,
    required String action,
    String note = '',
  }) async {
    final decoded = await _request(
      user: user,
      method: 'PATCH',
      path: '/shops/$shopId/sessions/$sessionId/',
      body: <String, dynamic>{'action': action, 'note': note},
    );

    return WorkspaceAccessSessionRecord(
      id: (decoded['id'] ?? '').toString(),
      memberName: (decoded['member_name'] ?? '').toString(),
      memberEmail: (decoded['member_email'] ?? '').toString(),
      membershipRoleSnapshot: (decoded['membership_role_snapshot'] ?? 'staff')
          .toString(),
      roleLabel: (decoded['role_label'] ?? 'Staff').toString(),
      status: (decoded['status'] ?? 'active').toString(),
      deviceLabel: (decoded['device_label'] ?? '').toString(),
      platformName: (decoded['platform_name'] ?? '').toString(),
      packageName: (decoded['package_name'] ?? '').toString(),
      appVersion: (decoded['app_version'] ?? '').toString(),
      buildNumber: (decoded['build_number'] ?? '').toString(),
      releaseChannel: (decoded['release_channel'] ?? '').toString(),
      releaseTag: (decoded['release_tag'] ?? '').toString(),
      lastSeenAt: _asNullableDateTime(decoded['last_seen_at']),
      revokedAt: _asNullableDateTime(decoded['revoked_at']),
      revokeReason: _nullableText(decoded['revoke_reason']),
      wipeRequested: decoded['wipe_requested'] == true,
      wipeRequestedAt: _asNullableDateTime(decoded['wipe_requested_at']),
      wipeAcknowledgedAt: _asNullableDateTime(decoded['wipe_acknowledged_at']),
      trustScore: _asInt(decoded['trust_score']),
      trustLevel: (decoded['trust_level'] ?? 'review').toString(),
      trustSummary: (decoded['trust_summary'] ?? '').toString(),
      trustReasons:
          ((decoded['trust_reasons'] ?? const <dynamic>[]) as List<dynamic>)
              .map((item) => item.toString())
              .where((item) => item.trim().isNotEmpty)
              .toList(growable: false),
      metadata: decoded['metadata_json'] is Map
          ? Map<String, dynamic>.from(decoded['metadata_json'] as Map)
          : const <String, dynamic>{},
      canManage: decoded['can_manage'] == true,
      createdAt: _asDateTime(decoded['created_at']),
      updatedAt: _asDateTime(decoded['updated_at']),
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
    client.connectionTimeout = _requestTimeout;
    try {
      final url = Uri.parse('${baseUrl.replaceAll(RegExp(r"/$"), "")}$path');
      final request = await client
          .openUrl(method, url)
          .timeout(_requestTimeout);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      if (body != null) {
        request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
        request.write(jsonEncode(body));
      }

      final response = await request.close().timeout(_requestTimeout);
      final bodyText = await utf8
          .decodeStream(response)
          .timeout(_requestTimeout);
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
    } on TimeoutException {
      throw BackendApiException(
        'Backend request timed out for $path. Check connectivity or backend load.',
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
    client.connectionTimeout = _requestTimeout;
    try {
      final url = Uri.parse('${baseUrl.replaceAll(RegExp(r"/$"), "")}$path');
      final request = await client
          .openUrl(method, url)
          .timeout(_requestTimeout);
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');

      final response = await request.close().timeout(_requestTimeout);
      final bodyText = await utf8
          .decodeStream(response)
          .timeout(_requestTimeout);
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
    } on TimeoutException {
      throw BackendApiException(
        'Backend request timed out for $path. Check connectivity or backend load.',
      );
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

  WorkspaceTeamMemberRecord _mapWorkspaceTeamMember(Map<String, dynamic> row) {
    return WorkspaceTeamMemberRecord(
      id: (row['id'] ?? '').toString(),
      memberName: (row['member_name'] ?? 'Workspace member').toString(),
      memberEmail: (row['member_email'] ?? '').toString(),
      phone: (row['phone'] ?? '').toString(),
      role: (row['role'] ?? 'staff').toString(),
      roleLabel: (row['role_label'] ?? 'Staff').toString(),
      roleSummary: (row['role_summary'] ?? '').toString(),
      roleProfile: (row['role_profile'] ?? '').toString(),
      status: (row['status'] ?? 'active').toString(),
      permissionsVersion: _asInt(row['permissions_version']),
      permissions: row['permissions_json'] is Map
          ? Map<String, dynamic>.from(row['permissions_json'] as Map)
          : const <String, dynamic>{},
      isCurrentUser: row['is_current_user'] == true,
      canManage: row['can_manage'] == true,
      createdAt: _asDateTime(row['created_at']),
      updatedAt: _asDateTime(row['updated_at']),
    );
  }

  AttendanceSessionRecord _mapAttendanceSession(Map<String, dynamic> row) {
    return AttendanceSessionRecord(
      id: (row['id'] ?? '').toString(),
      membershipId: (row['membership_id'] ?? '').toString(),
      memberName: (row['member_name'] ?? 'Team member').toString(),
      memberRole: (row['member_role'] ?? 'staff').toString(),
      sessionDate: _asDateTime(row['session_date']),
      clockInAt: _asNullableDateTime(row['clock_in_at']),
      clockOutAt: _asNullableDateTime(row['clock_out_at']),
      status: (row['status'] ?? 'ABSENT').toString(),
      totalHours: row['total_hours'] == null
          ? null
          : _asDouble(row['total_hours']),
      overtimeHours: _asDouble(row['overtime_hours']),
      bonusAmount: _asDouble(row['bonus_amount']),
      note: (row['note'] ?? '').toString(),
      tombstone: row['tombstone'] == true,
    );
  }

  ExpenseRecord _mapExpense(Map<String, dynamic> row) {
    return ExpenseRecord(
      id: (row['id'] ?? '').toString(),
      category: (row['category'] ?? 'Expense').toString(),
      amount: _asDouble(row['amount']),
      description: (row['description'] ?? '').toString(),
      paymentMethod: (row['payment_method'] ?? 'CASH').toString(),
      paymentReference: (row['payment_reference'] ?? '').toString(),
      expenseDate: _asDateTime(row['expense_date']),
      actorName: _nullableText(row['actor_name']),
      tombstone: row['tombstone'] == true,
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
