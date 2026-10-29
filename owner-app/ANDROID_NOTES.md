# Android platform notes
The Dart source and `pubspec.yaml` are included. Generate the Android runner folder if missing:

```powershell
flutter create . --platforms=android
flutter pub get
```

Add the following permissions above `<application>` in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

For local HTTP development only, add `android:usesCleartextTraffic="true"` to the `<application ...>` element. Remove cleartext traffic and use HTTPS in production.
