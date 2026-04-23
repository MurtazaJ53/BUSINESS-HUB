import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.businesshub.pro',
  appName: 'Business Hub',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false, // Security: Disable cleartext traffic
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: "#0ea5e9",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
    },
  },
};

export default config;
