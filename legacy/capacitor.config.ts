import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.businesshub.pro',
  appName: 'Business Hub',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: false,
    allowNavigation: [
      'accounts.google.com',
      'business-hub-pro.firebaseapp.com',
      'business-hub-pro.web.app',
      '*.googleapis.com'
    ]
  },
  // Spoof UserAgent to allow Google Login inside the app's WebView
  // This removes the "Version/X.X" string that Google uses to identify and block WebViews.
  overrideUserAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0ea5e9',
      overlaysWebView: true
    },
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#0ea5e9",
      showSpinner: false,
      androidScaleType: "CENTER_CROP"
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    },
  },
};

export default config;
