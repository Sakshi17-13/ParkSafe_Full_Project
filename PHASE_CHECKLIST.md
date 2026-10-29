# ParkSafe Phase checklist

## Phase 1 — UI and QR
- [x] Owner login/register screens
- [x] Dashboard, vehicle list, add vehicle dialog
- [x] Unique vehicle QR generated from vehicle ID
- [x] Visitor landing page styled in matching ParkSafe navy/blue palette
- [x] Visitor vehicle detail and anonymous message UI
- [ ] Run Flutter build on the target computer and test on Android emulator
- [ ] Configure the reachable website URL before scanning from another device

## Phase 2 — Integration
- [x] Express + MongoDB backend source
- [x] JWT register/login and authenticated vehicle management
- [x] Public vehicle lookup excludes private owner data
- [x] Anonymous messages saved to MongoDB and shown in owner inbox
- [x] Owner can mark messages read and save a reply
- [x] Socket.IO incoming call signaling
- [x] WebRTC browser-to-Flutter foreground call source
- [ ] Configure HTTPS and TURN for real networks
- [ ] Test calling across different devices/networks
- [ ] Add FCM/background call notification if required
- [ ] Security review, moderation and production deployment

## Demo scope note
The project contains the source for Phase 1 and Phase 2 integration. Because Flutter/Android SDK and npm dependency installation are environment-dependent, this archive was not compiled on this build host. Run the setup guide on your Windows machine and fix any SDK/environment-specific build issue before final submission. Foreground calls may need a TURN service; background/terminated Android calling is not configured.
