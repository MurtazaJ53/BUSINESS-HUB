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

  /// Public origin of the admin website, e.g. `https://shop.example.com`.
  ///
  /// Used to build the khata statement link a customer opens from a WhatsApp
  /// reminder. Deliberately empty by default: the site has no public domain
  /// yet, and a wrong guess would send customers a link that goes nowhere.
  /// While this is empty the app sends reminders without a statement link and
  /// does not mint one, rather than burning a token nobody can use.
  ///
  /// Set it at build time once a domain exists:
  ///   --dart-define=BUSINESS_HUB_WEB_APP_BASE_URL=https://shop.example.com
  static const String webAppBaseUrl = String.fromEnvironment(
    'BUSINESS_HUB_WEB_APP_BASE_URL',
  );

  // 2s was far too short for a hosted backend over a mobile network (and a
  // free-tier host that can cold-start). 30s is a sane general default;
  // override with BUSINESS_HUB_BACKEND_TIMEOUT_MS for slower/faster hosts.
  static const int backendTimeoutMs = int.fromEnvironment(
    'BUSINESS_HUB_BACKEND_TIMEOUT_MS',
    defaultValue: 30000,
  );
}
