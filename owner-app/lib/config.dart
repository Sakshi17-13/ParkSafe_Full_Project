class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.1.2:4000',
  );

  static const visitorBaseUrl = String.fromEnvironment(
    'VISITOR_BASE_URL',
    defaultValue: 'http://192.168.1.2:5173',
  );

  static const socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://192.168.1.2:4000',
  );
}