import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Temporary hand-written Firebase options for the Flutter mobile scaffold.
///
/// After Flutter is installed, replace this with the generated file from:
/// `flutterfire configure`
final class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'FlutterFire options are only prepared for Android in this scaffold.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDe8LA-KHFoi_nxoqXxVdjAxG_fDSTXkrw',
    appId: '1:631267912572:android:7f9c187945998c544f12f9',
    messagingSenderId: '631267912572',
    projectId: 'business-hub-pro',
    storageBucket: 'business-hub-pro.firebasestorage.app',
  );
}
