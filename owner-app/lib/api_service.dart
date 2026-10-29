import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'config.dart';

class ApiService {
static const _storage = FlutterSecureStorage();

static Future<String?> get token async =>
_storage.read(key: 'parksafe_token');

static Future<void> saveToken(String value) =>
_storage.write(key: 'parksafe_token', value: value);

static Future<void> clearToken() =>
_storage.delete(key: 'parksafe_token');

static Future<Map<String, dynamic>> _request(
String path, {
String method = 'GET',
Map<String, dynamic>? body,
bool auth = true,
}) async {
final uri = Uri.parse('${AppConfig.apiBaseUrl}$path');

final headers = <String, String>{
'Content-Type': 'application/json',
};

if (auth) {
final t = await token;
if (t != null) {
headers['Authorization'] = 'Bearer $t';
}
}

late http.Response r;

if (method == 'POST') {
r = await http.post(
uri,
headers: headers,
body: jsonEncode(body ?? {}),
);
} else if (method == 'PATCH') {
r = await http.patch(
uri,
headers: headers,
body: jsonEncode(body ?? {}),
);
} else {
r = await http.get(uri, headers: headers);
}

final data = r.body.isEmpty
? <String, dynamic>{}
    : jsonDecode(r.body) as Map<String, dynamic>;

if (r.statusCode < 200 || r.statusCode >= 300) {
throw Exception(
data['message'] ?? 'Request failed (${r.statusCode})',
);
}

return data;
}

// Login
static Future<Map<String, dynamic>> login(
String email,
String password,
) async {
final d = await _request(
'/api/auth/login',
method: 'POST',
body: {
'email': email,
'password': password,
},
auth: false,
);

await saveToken(d['token']);
return d;
}

// Register
static Future<Map<String, dynamic>> register(
String name,
String email,
String password,
) async {
final d = await _request(
'/api/auth/register',
method: 'POST',
body: {
'name': name,
'email': email,
'password': password,
},
auth: false,
);

await saveToken(d['token']);
return d;
}

// Get the logged-in owner's vehicles
static Future<List<dynamic>> vehicles() async {
final d = await _request('/api/vehicles/mine');
return d['vehicles'] as List<dynamic>;
}

// Add a vehicle
static Future<Map<String, dynamic>> addVehicle(
String number,
String model,
String color,
) async {
final d = await _request(
'/api/vehicles',
method: 'POST',
body: {
'number': number,
'model': model,
'color': color,
},
);

return d['vehicle'] as Map<String, dynamic>;
}

// Get the logged-in owner's messages
// Backend mounts messages.js at /api, so the route is /api/mine.
static Future<List<dynamic>> messages() async {
final d = await _request('/api/mine');
return d['messages'] as List<dynamic>;
}

// Mark a message as read
static Future<void> markRead(String id) async {
await _request(
'/api/$id/read',
method: 'PATCH',
body: {},
);
}

// Reply to a message
static Future<void> reply(String id, String reply) async {
await _request(
'/api/$id/reply',
method: 'PATCH',
body: {
'reply': reply,
},
);
}
}