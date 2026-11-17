import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

@pragma('vm:entry-point')
Future<void> parksafeFirebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class ParkSafeNotificationService {
  ParkSafeNotificationService._();

  static final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  static final StreamController<Map<String, dynamic>> _taps =
      StreamController<Map<String, dynamic>>.broadcast();
  static final StreamController<String> _registeredTokens =
      StreamController<String>.broadcast();
  static bool _ready = false;
  static Map<String, dynamic>? _initialData;
  static String? _currentToken;
  static Completer<String>? _registrationWaiter;

  static bool get isReady => _ready;
  static Stream<Map<String, dynamic>> get notificationTaps => _taps.stream;
  static Stream<String> get tokenRefresh => _registeredTokens.stream;

  static Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(parksafeFirebaseBackgroundHandler);

      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      await _local.initialize(
        settings: const InitializationSettings(android: androidSettings),
        onDidReceiveNotificationResponse: (response) {
          final payload = response.payload;
          if (payload == null || payload.isEmpty) return;
          try {
            _dispatchTap(Map<String, dynamic>.from(jsonDecode(payload) as Map));
          } catch (error) {
            debugPrint(
                'ParkSafe notification payload could not be opened: $error');
          }
        },
      );
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              'parksafe_alerts',
              'ParkSafe alerts',
              description:
                  'Visitor messages and call requests for your vehicles.',
              importance: Importance.high,
            ),
          );

      FirebaseMessaging.onMessage.listen(_showForegroundNotification);
      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        _dispatchTap(message.data);
      });
      FirebaseMessaging.instance.onRegistered.listen((token) {
        _currentToken = token;
        _registeredTokens.add(token);
        final waiter = _registrationWaiter;
        if (waiter != null && !waiter.isCompleted) waiter.complete(token);
      });

      final localLaunch = await _local.getNotificationAppLaunchDetails();
      if (localLaunch?.didNotificationLaunchApp == true) {
        final payload = localLaunch?.notificationResponse?.payload;
        if (payload != null && payload.isNotEmpty) {
          try {
            _initialData =
                Map<String, dynamic>.from(jsonDecode(payload) as Map);
          } catch (_) {
            // Ignore an invalid saved notification payload.
          }
        }
      }

      final remoteLaunch = await FirebaseMessaging.instance.getInitialMessage();
      if (remoteLaunch != null) _initialData = remoteLaunch.data;
      _ready = true;
    } catch (error) {
      // Missing Firebase project configuration must not prevent normal login.
      debugPrint('ParkSafe push notifications unavailable: $error');
    }
  }

  static Map<String, dynamic>? takeInitialData() {
    final data = _initialData;
    _initialData = null;
    return data;
  }

  static Future<String?> requestPermissionAndGetToken() async {
    if (!_ready) return null;
    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) {
      return null;
    }
    return _registerAndReadToken();
  }

  static Future<String?> currentToken() async {
    if (!_ready) return null;
    return _currentToken;
  }

  static Future<String?> _registerAndReadToken() async {
    if (_currentToken != null) return _currentToken;
    final waiter = Completer<String>();
    _registrationWaiter = waiter;
    try {
      await FirebaseMessaging.instance.register();
      return await waiter.future.timeout(const Duration(seconds: 20));
    } on TimeoutException {
      return _currentToken;
    } finally {
      if (identical(_registrationWaiter, waiter)) _registrationWaiter = null;
    }
  }

  static void _dispatchTap(Map<String, dynamic> data) {
    if (data.isNotEmpty) _taps.add(Map<String, dynamic>.from(data));
  }

  static Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;
    await _local.show(
      id: message.hashCode,
      title: notification.title ?? 'ParkSafe',
      body: notification.body ?? 'You have a new ParkSafe notification.',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'parksafe_alerts',
          'ParkSafe alerts',
          channelDescription:
              'Visitor messages and call requests for your vehicles.',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
      ),
      payload: jsonEncode(message.data),
    );
  }
}
