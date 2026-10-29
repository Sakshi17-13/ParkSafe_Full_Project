import "dart:io";
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'api_service.dart';
import 'config.dart';

const navy = Color(0xFF07345D);
const blue = Color(0xFF147DF0);
const pale = Color(0xFFF2F6FB);
void main() => runApp(const ParkSafeApp());

class ParkSafeApp extends StatelessWidget {
  const ParkSafeApp({super.key});
  @override Widget build(BuildContext context) => MaterialApp(title: 'ParkSafe', debugShowCheckedModeBanner: false, theme: ThemeData(useMaterial3: true, scaffoldBackgroundColor: pale, colorScheme: ColorScheme.fromSeed(seedColor: blue), appBarTheme: const AppBarTheme(backgroundColor: navy, foregroundColor: Colors.white, elevation: 0)), home: const AuthScreen());
}

class AuthScreen extends StatefulWidget { const AuthScreen({super.key}); @override State<AuthScreen> createState() => _AuthScreenState(); }
class _AuthScreenState extends State<AuthScreen> {
  final name = TextEditingController(); final email = TextEditingController(); final password = TextEditingController(); bool register = false, busy = false; String error = '';
  Future<void> submit() async { setState(() { busy = true; error = ''; }); try { final d = register ? await ApiService.register(name.text.trim(), email.text.trim(), password.text) : await ApiService.login(email.text.trim(), password.text); if (!mounted) return; Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => MainShell(owner: Map<String,dynamic>.from(d['owner'])))); } catch(e) { setState(() => error = e.toString().replaceFirst('Exception: ', '')); } finally { if(mounted)setState(() => busy = false); } }
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [const SizedBox(height: 20), Container(height: 76,width: 76,decoration: BoxDecoration(color: blue,borderRadius: BorderRadius.circular(24)),child: const Icon(Icons.directions_car_filled,color: Colors.white,size: 42)), const SizedBox(height: 14), const Text('ParkSafe',textAlign: TextAlign.center,style: TextStyle(fontSize: 30,fontWeight: FontWeight.w800,color: navy)), const Text('Connect. Park. Stay Safe.',textAlign: TextAlign.center,style: TextStyle(color: Colors.blueGrey)), const SizedBox(height: 30), SegmentedButton<bool>(segments: const [ButtonSegment(value:false,label:Text('Login')),ButtonSegment(value:true,label:Text('Register'))], selected:{register}, onSelectionChanged:(s)=>setState(()=>register=s.first)), const SizedBox(height: 20), if(register) _field(name,'Full name',Icons.person), _field(email,'Email',Icons.email), _field(password,'Password',Icons.lock,obscure:true), if(error.isNotEmpty) Padding(padding:const EdgeInsets.symmetric(vertical:8),child:Text(error,style:const TextStyle(color:Colors.red))), const SizedBox(height: 12), FilledButton(onPressed:busy?null:submit,style:FilledButton.styleFrom(padding:const EdgeInsets.all(16),backgroundColor:blue),child:Text(busy?'Please wait…':register?'Create account':'Login')), const SizedBox(height: 18), const Text('Your contact details stay private.',textAlign:TextAlign.center,style:TextStyle(color:Colors.blueGrey,fontSize:12))]))))));
  Widget _field(TextEditingController c,String label,IconData icon,{bool obscure=false})=>Padding(padding:const EdgeInsets.only(bottom:12),child:TextField(controller:c,obscureText:obscure,decoration:InputDecoration(prefixIcon:Icon(icon),labelText:label,border:OutlineInputBorder(borderRadius:BorderRadius.circular(13)),filled:true,fillColor:Colors.white)));
}

class MainShell extends StatefulWidget { final Map<String,dynamic> owner; const MainShell({super.key,required this.owner}); @override State<MainShell> createState()=>_MainShellState(); }
class _MainShellState extends State<MainShell> {
  int tab=0; io.Socket? socket; Map<String,dynamic>? incoming;
  @override void initState(){super.initState(); _connectSocket();}
  Future<void> _connectSocket() async { final token=await ApiService.token; if(token==null)return; socket=io.io(AppConfig.socketUrl,io.OptionBuilder().setTransports(['websocket']).setAuth({'token':token}).disableAutoConnect().build()); socket!.connect(); socket!.on('call:incoming',(data){if(!mounted)return;setState(()=>incoming=Map<String,dynamic>.from(data));}); }
  @override void dispose(){socket?.dispose();super.dispose();}
  @override Widget build(BuildContext context){final pages=[Dashboard(owner:widget.owner,onAdd:()=>setState(()=>tab=1),onVehicles:()=>setState(()=>tab=1),onMessages:()=>setState(()=>tab=2),socket:socket,incoming:incoming,onClearCall:()=>setState(()=>incoming=null)),VehiclesScreen(socket:socket),MessagesScreen(socket:socket),ProfileScreen(owner:widget.owner,onLogout:()async{socket?.dispose();await ApiService.clearToken();if(mounted)Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>const AuthScreen()),(_)=>false);})];return Scaffold(body:pages[tab],bottomNavigationBar:NavigationBar(selectedIndex:tab,onDestinationSelected:(i)=>setState(()=>tab=i),destinations:const [NavigationDestination(icon:Icon(Icons.home_outlined),selectedIcon:Icon(Icons.home),label:'Home'),NavigationDestination(icon:Icon(Icons.directions_car_outlined),selectedIcon:Icon(Icons.directions_car),label:'Vehicles'),NavigationDestination(icon:Icon(Icons.chat_bubble_outline),selectedIcon:Icon(Icons.chat),label:'Messages'),NavigationDestination(icon:Icon(Icons.person_outline),selectedIcon:Icon(Icons.person),label:'Profile')]),);}
}

class Dashboard extends StatefulWidget { final Map<String,dynamic> owner; final VoidCallback onAdd,onVehicles,onMessages,onClearCall; final io.Socket? socket; final Map<String,dynamic>? incoming; const Dashboard({super.key,required this.owner,required this.onAdd,required this.onVehicles,required this.onMessages,required this.socket,required this.incoming,required this.onClearCall}); @override State<Dashboard> createState()=>_DashboardState(); }
class _DashboardState extends State<Dashboard>{int vehicleCount=0,messageCount=0;List<dynamic> recent=[];@override void initState(){super.initState();load();}Future<void> load()async{try{final v=await ApiService.vehicles();final m=await ApiService.messages();if(mounted)setState(()=>vehicleCount=v.length);if(mounted)setState(()=>messageCount=m.length);if(mounted)setState(()=>recent=m.take(3).toList());}catch(_){} }
@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('ParkSafe',style:TextStyle(fontWeight:FontWeight.w800)),actions:[IconButton(onPressed:load,icon:const Icon(Icons.refresh)),const Padding(padding:EdgeInsets.only(right:16),child:CircleAvatar(backgroundColor:Colors.white24,child:Icon(Icons.person,color:Colors.white)))]),body:RefreshIndicator(onRefresh:load,child:ListView(padding:const EdgeInsets.all(18),children:[Container(padding:const EdgeInsets.all(20),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(20)),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text('Hello, ${widget.owner['name']??'Owner'}!',style:const TextStyle(fontSize:23,fontWeight:FontWeight.w800)),const SizedBox(height:5),const Text('Manage your vehicles and stay connected.',style:TextStyle(color:Colors.blueGrey)),const SizedBox(height:20),Row(children:[_stat('$vehicleCount','Vehicles',Icons.directions_car),const SizedBox(width:12),_stat('$messageCount','Messages',Icons.mark_unread_chat_alt)]),const SizedBox(height:18),SizedBox(width:double.infinity,child:FilledButton.icon(onPressed:widget.onAdd,icon:const Icon(Icons.add),label:const Text('Add Vehicle'),style:FilledButton.styleFrom(padding:const EdgeInsets.all(15))))])),if(widget.incoming!=null) Card(color:const Color(0xFFE4F2FF),child:ListTile(leading:const CircleAvatar(child:Icon(Icons.call)),title:Text('Incoming call · ${widget.incoming!['vehicleNumber']??'Your vehicle'}'),subtitle:const Text('Tap to accept the call'),trailing:FilledButton(onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>OwnerCallScreen(call:widget.incoming!,socket:widget.socket,onClose:widget.onClearCall))),child:const Text('Open')))),const SizedBox(height:22),Row(mainAxisAlignment:MainAxisAlignment.spaceBetween,children:[const Text('Recent Messages',style:TextStyle(fontSize:18,fontWeight:FontWeight.w800)),TextButton(onPressed:widget.onMessages,child:const Text('View all'))]),if(recent.isEmpty) const _Empty(icon:Icons.chat_bubble_outline,title:'No messages yet',subtitle:'Visitor messages will appear here.') else ...recent.map((m)=>Card(color:Colors.white,child:ListTile(leading:const CircleAvatar(child:Icon(Icons.chat_bubble)),title:Text(m['content']??'' ,maxLines:1,overflow:TextOverflow.ellipsis),subtitle:Text('About ${m['vehicleNumber']??'your vehicle'}'),onTap:widget.onMessages))),const SizedBox(height:18),OutlinedButton.icon(onPressed:widget.onVehicles,icon:const Icon(Icons.directions_car),label:const Text('Manage vehicles'))])));
Widget _stat(String n,String label,IconData icon)=>Expanded(child:Container(padding:const EdgeInsets.all(15),decoration:BoxDecoration(color:const Color(0xFFEAF4FF),borderRadius:BorderRadius.circular(15)),child:Row(children:[Icon(icon,color:blue,size:25),const SizedBox(width:10),Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(n,style:const TextStyle(fontWeight:FontWeight.w800,fontSize:20)),Text(label,style:const TextStyle(fontSize:11,color:Colors.blueGrey))])])));}

class VehiclesScreen extends StatefulWidget { final io.Socket? socket; const VehiclesScreen({super.key,required this.socket}); @override State<VehiclesScreen> createState()=>_VehiclesScreenState(); }
class _VehiclesScreenState extends State<VehiclesScreen>{List<dynamic> vehicles=[];bool loading=true;String error='';@override void initState(){super.initState();load();}Future<void> load()async{setState(()=>loading=true);try{vehicles=await ApiService.vehicles();error='';}catch(e){error=e.toString();}if(mounted)setState(()=>loading=false);}Future<void> add()async{final result=await showDialog<Map<String,String>>(context:context,builder:(_)=>const AddVehicleDialog());if(result==null)return;try{final d=await ApiService.addVehicle(result['number']!,result['model']!,result['color']!);await load();if(mounted)Navigator.push(context,MaterialPageRoute(builder:(_)=>QrScreen(vehicle:Map<String,dynamic>.from(d))));}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString().replaceFirst('Exception: ',''))));}}
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Vehicles'),
        actions: [
          IconButton(
            onPressed: add,
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: add,
        icon: const Icon(Icons.add),
        label: const Text('Add Vehicle'),
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error.isNotEmpty
                ? Center(child: Text(error))
                : vehicles.isEmpty
                    ? const _Empty(
                        icon: Icons.directions_car,
                        title: 'No vehicles added',
                        subtitle: 'Add a vehicle to generate its QR code.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: vehicles.length,
                        itemBuilder: (context, i) {
                          final v = Map<String, dynamic>.from(vehicles[i]);
                          return Card(
                            color: Colors.white,
                            margin: const EdgeInsets.only(bottom: 14),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 76,
                                        height: 76,
                                        decoration: BoxDecoration(
                                          color: pale,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: const Icon(
                                          Icons.directions_car,
                                          size: 42,
                                          color: navy,
                                        ),
                                      ),
                                      const SizedBox(width: 13),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              v['number'] ?? '',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 16,
                                              ),
                                            ),
                                            Text(v['model'] ?? ''),
                                            Text(
                                              v['color'] ?? '',
                                              style: const TextStyle(
                                                color: Colors.blueGrey,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Chip(
                                        label: Text(
                                          'Active',
                                          style: TextStyle(
                                            color: Colors.green,
                                            fontSize: 11,
                                          ),
                                        ),
                                        backgroundColor: Color(0xFFE4F7ED),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton.icon(
                                          onPressed: () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (_) => QrScreen(vehicle: v),
                                            ),
                                          ),
                                          icon: const Icon(Icons.qr_code_2),
                                          label: const Text('View QR'),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      IconButton(
                                        onPressed: () => _delete(v['_id']),
                                        icon: const Icon(
                                          Icons.delete_outline,
                                          color: Colors.red,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
Future<void> _delete(String? id)async{if(id==null)return;final ok=await showDialog<bool>(context:context,builder:(_)=>AlertDialog(title:const Text('Delete vehicle?'),content:const Text('Messages for this vehicle will also be deleted.'),actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Delete'))]));if(ok==true){try{final t=await ApiService.token;await ApiServiceDelete.delete(id,t!);await load();}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}}}}
class ApiServiceDelete { static Future<void> delete(String id,String token) async { final r=await httpDelete(Uri.parse('${AppConfig.apiBaseUrl}/api/vehicles/$id'),token);if(r!=200)throw Exception('Could not delete vehicle');} }
Future<int> httpDelete(Uri uri,String token)async{ final client=HttpClient();try{final req=await client.deleteUrl(uri);req.headers.set('Authorization','Bearer $token');final res=await req.close();await res.drain();return res.statusCode;}finally{client.close();}}

class AddVehicleDialog extends StatefulWidget {const AddVehicleDialog({super.key});@override State<AddVehicleDialog> createState()=>_AddVehicleDialogState();}
class _AddVehicleDialogState extends State<AddVehicleDialog>{final number=TextEditingController(),model=TextEditingController(),color=TextEditingController(text:'White');String error='';@override Widget build(BuildContext context)=>AlertDialog(title:const Text('Add Vehicle'),content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[_input(number,'Vehicle Number'),_input(model,'Vehicle Model'),_input(color,'Vehicle Color'),if(error.isNotEmpty)Text(error,style:const TextStyle(color:Colors.red))])),actions:[TextButton(onPressed:()=>Navigator.pop(context),child:const Text('Cancel')),FilledButton(onPressed:(){if(number.text.trim().isEmpty||model.text.trim().isEmpty||color.text.trim().isEmpty){setState(()=>error='Fill all fields');return;}Navigator.pop(context,{'number':number.text.trim().toUpperCase(),'model':model.text.trim(),'color':color.text.trim()});},child:const Text('Save Vehicle'))]);Widget _input(TextEditingController c,String label)=>Padding(padding:const EdgeInsets.only(bottom:12),child:TextField(controller:c,decoration:InputDecoration(labelText:label,border:const OutlineInputBorder())));}

class QrScreen extends StatelessWidget {final Map<String,dynamic> vehicle;const QrScreen({super.key,required this.vehicle});@override Widget build(BuildContext context){final url='${AppConfig.visitorBaseUrl}/vehicle/${vehicle['_id']}';return Scaffold(appBar:AppBar(title:const Text('Vehicle QR Code')),body:Center(child:SingleChildScrollView(padding:const EdgeInsets.all(24),child:Container(width:430,padding:const EdgeInsets.all(24),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(22)),child:Column(children:[const Icon(Icons.verified_user,color:blue,size:45),const Text('ParkSafe',style:TextStyle(fontSize:26,fontWeight:FontWeight.w800,color:navy)),const SizedBox(height:20),QrImageView(data:url,size:240,backgroundColor:Colors.white),const SizedBox(height:18),Text(vehicle['number']??'',style:const TextStyle(fontWeight:FontWeight.w800,fontSize:21)),Text('${vehicle['model']} · ${vehicle['color']}',style:const TextStyle(color:Colors.blueGrey)),const SizedBox(height:12),const Text('Scan to contact the vehicle owner',textAlign:TextAlign.center),const SizedBox(height:12),SelectableText(url,textAlign:TextAlign.center,style:const TextStyle(color:blue,fontSize:12)),const SizedBox(height:20),const Text('Tip: the scanning phone must be able to reach this website URL.',textAlign:TextAlign.center,style:TextStyle(color:Colors.blueGrey,fontSize:11))])))));}}

class MessagesScreen extends StatefulWidget{final io.Socket? socket;const MessagesScreen({super.key,required this.socket});@override State<MessagesScreen> createState()=>_MessagesScreenState();}
class _MessagesScreenState extends State<MessagesScreen>{List<dynamic> messages=[];bool loading=true;String error='';@override void initState(){super.initState();widget.socket?.on('new-message',_onNewMessage);load();}void _onNewMessage(dynamic _){if(mounted)load();}@override void dispose(){widget.socket?.off('new-message',_onNewMessage);super.dispose();}Future<void> load()async{setState(()=>loading=true);try{messages=await ApiService.messages();error='';}catch(e){error=e.toString();}if(mounted)setState(()=>loading=false);}
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          IconButton(onPressed: load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error.isNotEmpty
                ? Center(child: Text(error))
                : messages.isEmpty
                    ? const _Empty(
                        icon: Icons.chat_bubble_outline,
                        title: 'No messages yet',
                        subtitle: 'Messages from visitors will show up here.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(14),
                        itemCount: messages.length,
                        itemBuilder: (context, i) {
                          final m = Map<String, dynamic>.from(messages[i]);
                          return Card(
                            color: Colors.white,
                            child: ListTile(
                              leading: const CircleAvatar(
                                backgroundColor: Color(0xFFE1F0FF),
                                child: Icon(Icons.chat_bubble, color: blue),
                              ),
                              title: Text(m['content'] ?? ''),
                              subtitle: Text(
                                "${m['vehicleNumber'] ?? 'Vehicle'} · "
                                "${m['createdAt']?.toString().split('T').first ?? ''}",
                              ),
                              trailing: Icon(
                                m['readAt'] == null
                                    ? Icons.circle
                                    : Icons.check_circle,
                                color: m['readAt'] == null ? blue : Colors.green,
                                size: 14,
                              ),
                              onTap: () => _detail(m),
                            ),
                          );
                        },
                      ),
      ),
    );
  }
Future<void> _detail(Map<String,dynamic> m)async{final reply=TextEditingController(text:m['reply']??'');try{await ApiService.markRead(m['_id']);}catch(_){}if(!mounted)return;await showDialog(context:context,builder:(_)=>AlertDialog(title:Text(m['vehicleNumber']??'Message'),content:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[Text(m['content']??''),const SizedBox(height:20),TextField(controller:reply,maxLines:3,decoration:const InputDecoration(labelText:'Reply (optional)',border:OutlineInputBorder())),if((m['reply']??'').toString().isNotEmpty)Padding(padding:const EdgeInsets.only(top:10),child:Text('Saved reply: ${m['reply']}'))])),actions:[TextButton(onPressed:()=>Navigator.pop(context),child:const Text('Close')),FilledButton(onPressed:()async{try{if(reply.text.trim().isNotEmpty)await ApiService.reply(m['_id'],reply.text.trim());if(context.mounted)Navigator.pop(context);await load();}catch(e){if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(e.toString())));}},child:const Text('Save Reply'))]));}
}

class ProfileScreen extends StatelessWidget{final Map<String,dynamic> owner;final Future<void> Function() onLogout;const ProfileScreen({super.key,required this.owner,required this.onLogout});@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Profile')),body:ListView(padding:const EdgeInsets.all(18),children:[Card(color:Colors.white,child:Padding(padding:const EdgeInsets.all(20),child:Row(children:[const CircleAvatar(radius:29,backgroundColor:Color(0xFFD9ECFF),child:Icon(Icons.person,color:blue,size:32)),const SizedBox(width:14),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(owner['name']??'ParkSafe Owner',style:const TextStyle(fontWeight:FontWeight.w800,fontSize:18)),Text(owner['email']??'',style:const TextStyle(color:Colors.blueGrey,fontSize:12))]))]))),const SizedBox(height:12),Card(color:Colors.white,child:Column(children:[const ListTile(leading:Icon(Icons.edit_outlined),title:Text('Edit profile')),const Divider(height:1),const ListTile(leading:Icon(Icons.notifications_outlined),title:Text('Notifications')),const Divider(height:1),const ListTile(leading:Icon(Icons.info_outline),title:Text('About ParkSafe')),const Divider(height:1),ListTile(leading:const Icon(Icons.logout,color:Colors.red),title:const Text('Logout',style:TextStyle(color:Colors.red)),onTap:onLogout)]))]));}
class _Empty extends StatelessWidget{final IconData icon;final String title,subtitle;const _Empty({required this.icon,required this.title,required this.subtitle});@override Widget build(BuildContext context)=>Center(child:Padding(padding:const EdgeInsets.all(28),child:Column(mainAxisSize:MainAxisSize.min,children:[Icon(icon,size:52,color:blue),const SizedBox(height:14),Text(title,style:const TextStyle(fontWeight:FontWeight.w800,fontSize:18)),const SizedBox(height:7),Text(subtitle,textAlign:TextAlign.center,style:const TextStyle(color:Colors.blueGrey))])));}

class OwnerCallScreen extends StatefulWidget{final Map<String,dynamic> call;final io.Socket? socket;final VoidCallback onClose;const OwnerCallScreen({super.key,required this.call,required this.socket,required this.onClose});@override State<OwnerCallScreen> createState()=>_OwnerCallScreenState();}
class _OwnerCallScreenState extends State<OwnerCallScreen>{RTCPeerConnection? pc;MediaStream? stream;String status='Incoming call';String error='';bool accepted=false;late final String callId;@override void initState(){super.initState();callId=widget.call['callId'].toString();widget.socket?.emit('call:join',{'callId':callId});widget.socket?.on('call:signal',_signal);}
Future<void> _signal(dynamic raw)async{final d=Map<String,dynamic>.from(raw);if(d['callId']!=callId)return;try{if(d['type']=='offer'&&accepted){await pc?.setRemoteDescription(RTCSessionDescription(d['sdp']['sdp'],d['sdp']['type']));final answer=await pc!.createAnswer();await pc!.setLocalDescription(answer);widget.socket?.emit('call:signal',{'type':'answer','callId':callId,'sdp':{'sdp':answer.sdp,'type':answer.type}});setState(()=>status='Call connected');}else if(d['type']=='ice'&&d['candidate']!=null){await pc?.addCandidate(RTCIceCandidate(d['candidate']['candidate'],d['candidate']['sdpMid'],d['candidate']['sdpMLineIndex']));}else if(d['type']=='ended'||d['type']=='rejected'){setState(()=>status='Call ended');}}catch(e){setState(()=>error=e.toString());}}
Future<void> accept()async{try{final cfg={'iceServers':[{'urls':'stun:stun.l.google.com:19302'}]};pc=await createPeerConnection(cfg);pc!.onIceCandidate=(c){if(c.candidate!=null)widget.socket?.emit('call:signal',{'type':'ice','callId':callId,'candidate':{'candidate':c.candidate,'sdpMid':c.sdpMid,'sdpMLineIndex':c.sdpMLineIndex}});};stream=await navigator.mediaDevices.getUserMedia({'audio':true,'video':false});for(final track in stream!.getTracks()){await pc!.addTrack(track,stream!);}setState(()=>accepted=true);widget.socket?.emit('call:signal',{'type':'accepted','callId':callId});setState(()=>status='Connecting audio…');}catch(e){setState(()=>error='Microphone/WebRTC error: $e');}}
Future<void> end()async{widget.socket?.emit('call:signal',{'type':'ended','callId':callId});await stream?.dispose();await pc?.close();widget.socket?.off('call:signal',_signal);widget.onClose();if(mounted)Navigator.pop(context);}
@override void dispose(){widget.socket?.off('call:signal',_signal);stream?.dispose();pc?.close();super.dispose();}
@override Widget build(BuildContext context)=>Scaffold(backgroundColor:navy,appBar:AppBar(backgroundColor:navy,title:const Text('ParkSafe Call'),leading:IconButton(onPressed:end,icon:const Icon(Icons.arrow_back))),body:Center(child:Padding(padding:const EdgeInsets.all(28),child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[const CircleAvatar(radius:64,backgroundColor:Color(0xFF145184),child:Icon(Icons.directions_car,size:60,color:Colors.white)),const SizedBox(height:26),Text(status,style:const TextStyle(color:Colors.white,fontSize:24,fontWeight:FontWeight.w800)),const SizedBox(height:8),Text(widget.call['vehicleNumber']??'Your vehicle',style:const TextStyle(color:Colors.white70)),if(error.isNotEmpty)Padding(padding:const EdgeInsets.all(12),child:Text(error,style:const TextStyle(color:Colors.orangeAccent))),const SizedBox(height:35),if(!accepted)FilledButton.icon(onPressed:accept,icon:const Icon(Icons.call),label:const Text('Accept call'),style:FilledButton.styleFrom(backgroundColor:Colors.green,padding:const EdgeInsets.symmetric(horizontal:30,vertical:16)))else const Text('Audio connection requested',style:TextStyle(color:Colors.white70)),const SizedBox(height:15),FilledButton.icon(onPressed:end,icon:const Icon(Icons.call_end),label:const Text('End call'),style:FilledButton.styleFrom(backgroundColor:Colors.red,padding:const EdgeInsets.symmetric(horizontal:30,vertical:16)))]))));}
