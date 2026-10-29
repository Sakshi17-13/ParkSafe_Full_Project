import React, { useEffect, useRef, useState } from 'react';
import {
  Link,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  ShieldCheck,
  CarFront,
  LockKeyhole,
  Users,
  ScanLine,
  Phone,
  MessageSquare,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  PhoneOff,
} from 'lucide-react';

const configuredApiUrl = import.meta.env.VITE_API_URL || '';
const pageHostname = window.location.hostname;
const localApiHost = /^(localhost|127(?:\.\d{1,3}){3})$/i.test(pageHostname);
function resolveServiceUrl(value, fallback) {
  const resolved = new URL(value || fallback, window.location.href);
  // A localhost setting works on the development computer but points back to
  // the visitor's phone when the page is opened over the LAN.
  if (!localApiHost && /^(localhost|127(?:\.\d{1,3}){3})$/i.test(resolved.hostname)) {
    resolved.hostname = pageHostname;
  }
  return resolved.toString().replace(/\/+$/, '');
}
const API = resolveServiceUrl(
  configuredApiUrl,
  `${window.location.protocol}//${pageHostname}:4000`
);
const SOCKET = resolveServiceUrl(import.meta.env.VITE_SOCKET_URL, API);

const callId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* -------------------------------------------------------
   BRAND
------------------------------------------------------- */

function Brand({ light = false }) {
  return (
    <Link
      className={`brand ${light ? 'brand-light' : ''}`}
      to="/"
      aria-label="ParkSafe home"
    >
      <span className="brand-mark">
        <CarFront size={21} />
      </span>
      <span>
        Park<span className="blue">Safe</span>
      </span>
    </Link>
  );
}

/* -------------------------------------------------------
   HOME PAGE
------------------------------------------------------- */

function Home() {
  return (
    <div className="home-page">
      <header className="topbar">
        <Brand light />

        <nav>
          <a href="#how">How it Works</a>

          <a href="#privacy">Privacy</a>

          <Link className="nav-cta" to="/scan">
            <ScanLine size={17} />
            Scan QR
          </Link>
        </nav>
      </header>

      <main className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            PRIVATE VEHICLE CONTACT
          </div>

          <h1>
            Connect. Park.
            <br />
            <span>Stay Safe.</span>
          </h1>

          <p>
            Scan the QR code displayed on a parked vehicle to
            contact its owner without revealing personal contact
            details.
          </p>

          <Link className="primary-button" to="/scan">
            <ScanLine size={19} />
            Scan a vehicle QR
          </Link>

          <div className="privacy-note">
            <LockKeyhole size={16} />
            Your personal contact details stay private.
          </div>
        </div>

        <div className="hero-visual">
          <div className="halo" />

          <div className="qr-sticker">
            <div className="fake-qr">
              <span>▦</span>
              <span>▥</span>
              <span>▦</span>
              <span>▥</span>
              <span>▦</span>
              <span>▥</span>
              <span>▦</span>
              <span>▥</span>
              <span>▦</span>
            </div>
            <b>ParkSafe</b>
          </div>

          <div className="car-illustration">
            <CarFront size={176} strokeWidth={1.1} />
          </div>

          <div className="floating-tag">
            <ShieldCheck size={18} />
            Anonymous contact
          </div>
        </div>
      </main>

      <section className="feature-strip" id="privacy">
        <article>
          <span className="feature-icon">
            <ShieldCheck />
          </span>
          <b>Anonymous communication</b>
          <p>Contact the owner without sharing your number.</p>
        </article>

        <article>
          <span className="feature-icon">
            <CarFront />
          </span>
          <b>Resolve parking issues</b>
          <p>Request that a vehicle be moved politely.</p>
        </article>

        <article>
          <span className="feature-icon">
            <LockKeyhole />
          </span>
          <b>Privacy first</b>
          <p>Owner's phone number is not shown.</p>
        </article>

        <article>
          <span className="feature-icon">
            <Users />
          </span>
          <b>Better community</b>
          <p>Help keep entrances and roads clear.</p>
        </article>
      </section>

      <section className="how-section" id="how">
        <div className="section-kicker">SIMPLE AND SAFE</div>

        <h2>How ParkSafe works</h2>

        <div className="steps">
          <article>
            <span>01</span>
            <h3>Scan the QR</h3>
            <p>Use your phone camera on the ParkSafe QR sticker.</p>
          </article>

          <article>
            <span>02</span>
            <h3>Choose a contact option</h3>
            <p>
              View basic vehicle details and choose message or call.
            </p>
          </article>

          <article>
            <span>03</span>
            <h3>Stay private</h3>
            <p>
              Contact the owner without displaying a phone number.
            </p>
          </article>
        </div>

        <Link className="primary-button" to="/scan">
          <ScanLine size={18} />
          Scan QR now
        </Link>
      </section>

      <footer>
        <Brand />
        <span>
          © {new Date().getFullYear()} ParkSafe · Connect. Park. Stay Safe.
        </span>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------
   QR SCANNER PAGE

   Supports camera scanning in compatible browsers.
   Also supports manually entering a vehicle URL or ID.
------------------------------------------------------- */

function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScanning(false);
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  function openVehicle(value) {
    const text = value.trim();

    if (!text) {
      setError('Enter a vehicle QR link or vehicle ID.');
      return;
    }

    try {
      let vehicleId = text;

      if (/^https?:\/\//i.test(text)) {
        const url = new URL(text);

        const match = url.pathname.match(/\/vehicle\/([^/]+)/);

        if (!match) {
          setError(
            'This link does not contain a valid ParkSafe vehicle ID.'
          );
          return;
        }

        vehicleId = decodeURIComponent(match[1]);
      } else if (text.includes('/')) {
        setError('Enter a vehicle ID or a complete ParkSafe vehicle link.');
        return;
      }

      if (!vehicleId || vehicleId.length > 200) {
        setError('Please enter a valid vehicle ID.');
        return;
      }

      stopCamera();
      navigate(`/vehicle/${encodeURIComponent(vehicleId)}`);
    } catch {
      setError('Please enter a valid vehicle QR link or vehicle ID.');
    }
  }

  async function startCamera() {
    setError('');
    setCameraUnavailable(false);

    if (!window.isSecureContext) {
      setCameraUnavailable(true);
      setError(
        'Camera access requires HTTPS. On a local network, use HTTPS or open this page on the same device as localhost. You can also enter the vehicle link below.'
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraUnavailable(true);
      setError(
        'Camera access is unavailable. Use the vehicle link field below.'
      );
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setCameraUnavailable(true);
      setError(
        'QR detection is not supported by this browser. Enter the QR link below.'
      );
      return;
    }

    let stream;

    try {
      const detector = new window.BarcodeDetector({
        formats: ['qr_code'],
      });

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        stopCamera();
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setScanning(true);

      const video = videoRef.current;

      while (
        streamRef.current === stream &&
        videoRef.current === video &&
        video.readyState >= 2
      ) {
        try {
          const results = await detector.detect(video);

          if (results.length > 0 && results[0].rawValue) {
            const value = results[0].rawValue;

            stopCamera();
            openVehicle(value);
            return;
          }
        } catch {
          setError('Unable to read the QR code. Please try again.');
          stopCamera();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (e) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      streamRef.current = null;
      setScanning(false);
      setCameraUnavailable(true);

      setError(
        e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or enter the link below.'
          : 'Could not start the camera. Enter the vehicle link below.'
      );
    }
  }

  return (
    <div className="center-page">
      <Brand />

      <div className="section-kicker">PARKSAFE QR SCANNER</div>

      <h1>Scan a vehicle QR</h1>

      <p>
        Scan the QR sticker attached to a parked vehicle to view its
        details and contact its owner privately.
      </p>

      <div className="scan-page-content">
        {scanning && (
          <div className="scanner-preview">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                maxWidth: '420px',
                borderRadius: '12px',
              }}
            />

            <p>Point your camera at the vehicle QR code.</p>

            <button
              className="outline-button"
              type="button"
              onClick={stopCamera}
            >
              Cancel scanning
            </button>
          </div>
        )}

        {!scanning && (
          <button
            className="primary-button"
            type="button"
            onClick={startCamera}
          >
            <ScanLine size={19} />
            Open camera scanner
          </button>
        )}

        <div className="scan-divider">
          <span>OR ENTER LINK MANUALLY</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            openVehicle(input);
          }}
        >
          <label htmlFor="vehicle-link">Vehicle QR link or ID</label>

          <input
            id="vehicle-link"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste vehicle link or enter ID"
            autoComplete="off"
          />

          {error && <p className="inline-error">{error}</p>}

          <button className="submit-button" type="submit">
            <CarFront size={18} />
            Open vehicle details
          </button>
        </form>

        {cameraUnavailable && (
          <p className="muted">
            Manual entry is available even when camera scanning is not
            supported.
          </p>
        )}
      </div>

      <Link to="/" className="small-link">
        <ArrowLeft size={16} />
        Back to ParkSafe
      </Link>
    </div>
  );
}

/* -------------------------------------------------------
   VEHICLE DETAILS AND ANONYMOUS MESSAGE
------------------------------------------------------- */

function VehiclePage() {
  const { id } = useParams();

  const [vehicle, setVehicle] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [callState, setCallState] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadVehicle() {
      setLoading(true);
      setError('');
      setVehicle(null);

      try {
        const response = await fetch(
          `${API}/api/vehicles/public/${encodeURIComponent(id)}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Vehicle not found.');
        }

        if (!data.vehicle) {
          throw new Error('Vehicle details were not returned by the server.');
        }

        if (alive) {
          setVehicle(data.vehicle);
        }
      } catch (e) {
        if (alive) {
          setError(
            e.message ||
              'Unable to connect to ParkSafe. Please try again.'
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadVehicle();

    return () => {
      alive = false;
    };
  }, [id]);

  async function sendMessage(e) {
    e.preventDefault();

    if (!message.trim()) return;

    setSending(true);
    setError('');

    try {
      const response = await fetch(
        `${API}/api/public/${encodeURIComponent(id)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not send message.');
      }

      setSent(true);
      setMessage('');
    } catch (e) {
      setError(
        e.message ||
          'Unable to send your message. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }

  function startCall() {
    setCallState('starting');
  }

  if (loading) {
    return (
      <div className="center-page">
        <Brand />
        <div className="spinner" />
        <h2>Opening vehicle details</h2>
        <p>Please wait while we fetch the vehicle information…</p>
      </div>
    );
  }

  if (error && !vehicle) {
    return (
      <div className="center-page">
        <Brand />
        <AlertTriangle size={42} color="#e16b37" />
        <h2>Vehicle unavailable</h2>
        <p>{error}</p>
        <Link className="outline-button" to="/">
          Back to ParkSafe
        </Link>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <header className="detail-top">
        <Brand />
        <Link to="/" className="small-link">
          <ArrowLeft size={16} />
          Home
        </Link>
      </header>

      <main className="detail-layout">
        <section className="vehicle-card">
          <div className="car-photo">
            <div className="car-photo-shape">
              <CarFront size={130} strokeWidth={1.2} />
            </div>
            <span className="photo-label">PARKSAFE VEHICLE</span>
          </div>

          <div className="vehicle-info">
            <div className="section-kicker">VEHICLE DETAILS</div>
            <h1>{vehicle.number}</h1>
            <p>
              {vehicle.model} <span>·</span> {vehicle.color}
            </p>
          </div>

          <div className="owner-line">
            <span className="avatar">
              <Users size={22} />
            </span>

            <div>
              <small>Registered owner</small>
              <b>Vehicle Owner</b>
            </div>

            <span className="verified">
              <ShieldCheck size={16} />
              Private
            </span>
          </div>

          <div className="contact-actions">
            <button className="call-button" onClick={startCall}>
              <Phone size={20} />
              <span>
                <b>Call Owner</b>
                <small>Anonymous internet call</small>
              </span>
            </button>

            <a className="message-button" href="#message">
              <MessageSquare size={20} />
              <span>
                <b>Send Message</b>
                <small>Contact owner anonymously</small>
              </span>
            </a>
          </div>

          {callState && (
            <CallPanel
              vehicleId={id}
              vehicleNumber={vehicle.number}
              onClose={() => setCallState('')}
            />
          )}

          <div className="privacy-banner">
            <LockKeyhole size={19} />
            <p>
              Your identity and phone number are not displayed to the
              vehicle owner.
            </p>
          </div>
        </section>

        <section className="message-card" id="message">
          {sent ? (
            <div className="success-panel">
              <CheckCircle2 size={58} />
              <h2>Message sent!</h2>
              <p>Your message has been delivered to the vehicle owner.</p>

              <button
                className="outline-button"
                onClick={() => setSent(false)}
              >
                Send another message
              </button>

              <Link to="/" className="small-link">
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <div className="section-kicker">QUICK AND PRIVATE</div>

              <h2>Send a message</h2>
              <p className="muted">
                Let the owner know what is happening.
              </p>

              <form onSubmit={sendMessage}>
                <label htmlFor="message-text">Your message</label>

                <textarea
                  id="message-text"
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Example: Please move your car. It is blocking the gate."
                  required
                />

                <div className="char-count">{message.length}/500</div>

                <div className="quick-messages">
                  <span>Quick messages</span>

                  <div>
                    {[
                      'Please move your car',
                      'It is blocking the gate',
                      'Parking issue',
                      'Thank you',
                    ].map((text) => (
                      <button
                        type="button"
                        key={text}
                        onClick={() => setMessage(text)}
                      >
                        {text}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <div className="inline-error">{error}</div>}

                <button className="submit-button" disabled={sending}>
                  {sending ? (
                    'Sending…'
                  ) : (
                    <>
                      <MessageSquare size={18} />
                      Send Message
                    </>
                  )}
                </button>
              </form>

              <div className="form-privacy">
                <LockKeyhole size={15} />
                No phone number or identity is shared.
              </div>
            </>
          )}
        </section>
      </main>

      <footer>
        <Brand />
        <span>ParkSafe · A safer way to contact vehicle owners</span>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------
   ANONYMOUS AUDIO CALL
------------------------------------------------------- */

function CallPanel({ vehicleId, vehicleNumber, onClose }) {
  const [status, setStatus] = useState('Connecting to owner…');
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const idRef = useRef(callId());

  useEffect(() => {
    let closed = false;

    const socket = io(`${SOCKET}/visitor`, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    };

    if (import.meta.env.VITE_TURN_URL) {
      config.iceServers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      });
    }

    socket.on('connect', () => {
      socket.emit('call:start', {
        vehicleId,
        callId: idRef.current,
      });

      setStatus('Calling vehicle owner…');
    });

    socket.on('connect_error', () => {
      setError('Cannot connect to the call server. Check the backend.');
      setStatus('Call unavailable');
    });

    socket.on('call:error', (data) => {
      setError(data.message || 'Call could not be started.');
      setStatus('Call unavailable');
    });

    socket.on('call:signal', async (data) => {
      if (closed) return;

      if (data.callId && data.callId !== idRef.current) return;

      if (data.type === 'accepted') {
        setStatus('Owner accepted. Connecting audio…');

        try {
          const pc = new RTCPeerConnection(config);
          pcRef.current = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('call:signal', {
                type: 'ice',
                callId: idRef.current,
                candidate: event.candidate,
              });
            }
          };

          pc.ontrack = (event) => {
            const audio = document.getElementById('remote-audio');

            if (audio) {
              audio.srcObject = event.streams[0];
              audio.play().catch(() => {});
            }
          };

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

          if (closed) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          localRef.current = stream;

          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('call:signal', {
            type: 'offer',
            callId: idRef.current,
            sdp: {
              sdp: offer.sdp,
              type: offer.type,
            },
          });

          setStatus('Connecting audio…');
        } catch (e) {
          setError(
            'Microphone or audio connection error: ' + e.message
          );
          setStatus('Call failed');
        }
      } else if (data.type === 'answer' && pcRef.current) {
        await pcRef.current.setRemoteDescription(data.sdp);
        setStatus('Call connected');
      } else if (
        data.type === 'ice' &&
        pcRef.current &&
        data.candidate
      ) {
        try {
          await pcRef.current.addIceCandidate(data.candidate);
        } catch {
          // Ignore an ICE candidate that cannot be applied.
        }
      } else if (data.type === 'rejected') {
        setStatus('Owner declined the call');
      } else if (data.type === 'ended') {
        setStatus('Call ended');
      }
    });

    return () => {
      closed = true;

      socket.emit('call:signal', {
        type: 'ended',
        callId: idRef.current,
      });

      socket.disconnect();

      localRef.current?.getTracks().forEach((track) => track.stop());
      pcRef.current?.close();
    };
  }, [vehicleId]);

  function endCall() {
    socketRef.current?.emit('call:signal', {
      type: 'ended',
      callId: idRef.current,
    });

    onClose();
  }

  return (
    <div className="call-panel">
      <div className="call-car">
        <CarFront size={34} />
      </div>

      <b>{status}</b>
      <small>{vehicleNumber}</small>

      {error && <p className="inline-error">{error}</p>}

      <audio id="remote-audio" autoPlay />

      <button className="hangup" onClick={endCall}>
        <PhoneOff size={18} />
        End Call
      </button>

      <p className="tiny-note">
        Keep this page open during the call. Microphone access is required.
      </p>
    </div>
  );
}

/* -------------------------------------------------------
   NOT FOUND AND ROUTES
------------------------------------------------------- */

function NotFound() {
  return (
    <div className="center-page">
      <Brand />
      <h2>Page not found</h2>
      <Link to="/" className="primary-button">
        Back to home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/vehicle/:id" element={<VehiclePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
