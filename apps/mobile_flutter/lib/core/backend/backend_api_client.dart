import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

class BackendDomainState {
  const BackendDomainState({
    required this.currentEpoch,
    required this.cutoverStatus,
    required this.writeMaster,
  });

  final int currentEpoch;
  final String cutoverStatus;
  final String writeMaster;
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

class BackendApiClient {
  BackendApiClient({required this.baseUrl});

  final String baseUrl;

  Future<BackendDomainState> getDomainState({
    required User user,
    required String shopId,
    required String domain,
  }) async {
    final decoded = await _request(
      user: user,
      method: 'GET',
      path: '/shops/$shopId/domain-state/$domain/',
    );

    final epoch = decoded['current_epoch'];
    return BackendDomainState(
      currentEpoch: epoch is int
          ? epoch
          : epoch is num
          ? epoch.toInt()
          : int.tryParse('$epoch') ?? 1,
      cutoverStatus: (decoded['cutover_status'] ?? 'legacy').toString(),
      writeMaster: (decoded['write_master'] ?? 'firebase').toString(),
    );
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

  Future<Map<String, dynamic>> _request({
    required User user,
    required String method,
    required String path,
    Map<String, dynamic>? body,
  }) async {
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw BackendApiException('Missing Firebase auth token for backend request.');
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
      throw BackendApiException('Missing Firebase auth token for backend request.');
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
        throw BackendApiException('Backend request for $path did not return a list payload.');
      }
      return decoded
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList(growable: false);
    } finally {
      client.close(force: true);
    }
  }
}
