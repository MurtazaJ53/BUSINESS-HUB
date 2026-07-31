final class MobileRuntimeConfig {
  const MobileRuntimeConfig._();

  static const bool backendSyncEnabled = bool.fromEnvironment(
    'BUSINESS_HUB_BACKEND_SYNC_ENABLED',
    defaultValue: true,
  );

  static const String backendAuthMode = String.fromEnvironment(
    'BUSINESS_HUB_BACKEND_AUTH_MODE',
    defaultValue: 'jwt',
  );

  static const String localShopId = String.fromEnvironment(
    'BUSINESS_HUB_LOCAL_SHOP_ID',
    defaultValue: 'shop-local-owner',
  );

  static const String localOwnerEmail = String.fromEnvironment(
    'BUSINESS_HUB_LOCAL_OWNER_EMAIL',
    defaultValue: 'owner@business-hub.local',
  );

  static const String localOwnerName = String.fromEnvironment(
    'BUSINESS_HUB_LOCAL_OWNER_NAME',
    defaultValue: 'Business Hub Owner',
  );

  static const String localShopName = String.fromEnvironment(
    'BUSINESS_HUB_LOCAL_SHOP_NAME',
    defaultValue: 'Business Hub Pro',
  );

  // 2s was far too short for a hosted backend over a mobile network (and a
  // free-tier host that can cold-start). 30s is a sane general default;
  // override with BUSINESS_HUB_BACKEND_TIMEOUT_MS for slower/faster hosts.
  static const int backendTimeoutMs = int.fromEnvironment(
    'BUSINESS_HUB_BACKEND_TIMEOUT_MS',
    defaultValue: 30000,
  );
}
