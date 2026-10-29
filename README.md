# ParkSafe — Full Project Source (Phase 1 + Phase 2)

ParkSafe lets a vehicle owner register vehicles and generate a QR code. A visitor scans it, sees public vehicle details, and can send an anonymous message or start an internet voice-call request without seeing the owner's phone number.

## Project folders
- `owner-app/` Flutter Android owner app source
- `visitor-web/` React + Vite visitor website
- `backend/` Express API, MongoDB models, JWT auth, messages and Socket.IO signaling
- `SETUP_GUIDE.md` full setup, local testing, network notes and demo steps

## Important implementation notes
- Phase 1 UI and QR generation run locally; the owner app also includes API integration for Phase 2.
- Phase 2 backend integration covers registration/login, vehicle CRUD, public vehicle lookup and anonymous messages/inbox.
- The website includes browser WebRTC call setup and Socket.IO signaling. The Flutter app includes foreground incoming-call signaling/UI and WebRTC audio acceptance source. Browser/app audio calls require HTTPS (except localhost), microphone permission, working network connectivity and STUN/TURN. A TURN server is not bundled; set `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` in the website environment if needed.
- Incoming calls in this student-demo version require the owner app to be open/connected. Background/terminated Android call wake-up requires Firebase Cloud Messaging and Android call notification integration, not included as a configured cloud service.
- No service can guarantee a permanently free TURN/hosting plan. Do not deploy without HTTPS, rate limits, secure secrets and testing.
- Flutter platform folders may need generation using `flutter create . --platforms=android` from `owner-app/` if not present. All app Dart source is included.

## Quick start
See `SETUP_GUIDE.md` before running. Never commit `.env` files or real secrets.
