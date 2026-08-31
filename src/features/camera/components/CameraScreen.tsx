import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';
import type { MainTab } from '../../../components/HomeScreen';

export type ModelComplexity = 'light' | 'medium' | 'high';

interface CameraScreenProps {
  onClose: () => void;
  selectedModel: ModelComplexity;
}

const RAW_HOST = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';
const SERVER_HOST = RAW_HOST.replace(/\/+$/, '');

export const POSE_HTML_BUNDLE = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body, html { width: 100%; height: 100%; overflow: hidden; background-color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #container { position: relative; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; background-color: #000; }
    video { position: absolute; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
    canvas { position: absolute; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); pointer-events: none; }

    /* ---------- Loader ---------- */
    #loader-overlay {
      position: absolute; z-index: 20; width: 82%; max-width: 300px;
      background: rgba(15, 23, 42, 0.92); border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px; padding: 22px 20px; text-align: center; color: #F8FAFC;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .spinner {
      width: 34px; height: 34px; margin: 0 auto 14px;
      border-radius: 50%; border: 3px solid rgba(255, 255, 255, 0.12);
      border-top-color: #818CF8; animation: spin 0.85s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-icon { font-size: 28px; margin-bottom: 12px; display: none; }
    .loader-title { font-size: 15px; font-weight: 700; color: #F8FAFC; margin-bottom: 5px; letter-spacing: 0.01em; }
    .loader-status { font-size: 12.5px; color: #94A3B8; margin-bottom: 14px; min-height: 16px; line-height: 16px; }

    .progress-track {
      width: 100%; height: 6px; background-color: #1E293B; border-radius: 8px;
      overflow: hidden; margin-bottom: 6px;
    }
    .progress-fill {
      height: 100%; width: 5%; background: #6366F1;
      border-radius: 8px; transition: width 0.25s ease, background-color 0.2s ease;
    }
    .progress-percentage { font-size: 11px; font-weight: 600; color: #64748B; text-align: right; }

    #retry-btn {
      display: none; margin-top: 12px; background-color: #6366F1; color: #fff;
      border: none; padding: 9px 22px; border-radius: 20px; font-weight: 600;
      font-size: 12.5px; cursor: pointer; letter-spacing: 0.01em;
    }

    /* ---------- HUD: STATE & VISIBILITY ---------- */
    #hud {
      position: absolute; z-index: 10;
      top: max(82px, calc(env(safe-area-inset-top) + 68px));
      left: max(14px, env(safe-area-inset-left));
      padding: 7px 11px; border-radius: 16px;
      background: rgba(12, 15, 20, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
      font-variant-numeric: tabular-nums;
      display: flex; flex-direction: column; gap: 5px;
      min-width: 136px;
    }
    @media (orientation: landscape) {
      #hud {
        top: 68px;
        left: max(14px, env(safe-area-inset-left));
      }
    }
    .hud-row {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .hud-label-tag {
      font-size: 9px; font-weight: 800; letter-spacing: 0.08em; color: #8E95A0;
      text-transform: uppercase;
    }
    .state-badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(226, 241, 99, 0.14); border: 1px solid rgba(226, 241, 99, 0.35);
      border-radius: 10px; padding: 3px 8px;
      transition: all 0.2s ease;
    }
    .state-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #E2F163;
      box-shadow: 0 0 8px 1px #E2F163; transition: all 0.2s ease;
    }
    .state-text {
      font-size: 11.5px; font-weight: 900; letter-spacing: 0.04em; color: #E2F163;
      text-transform: uppercase; transition: color 0.2s ease;
    }
    .vis-box {
      display: flex; align-items: center; gap: 7px;
    }
    .vis-value {
      font-size: 12px; font-weight: 800; color: #E2F163;
    }
    .vis-track {
      width: 48px; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, 0.12);
      overflow: hidden;
    }
    .vis-fill {
      height: 100%; width: 0%; border-radius: 3px; background: #E2F163;
      transition: width 0.2s ease, background-color 0.2s ease;
    }
    #hud-hint {
      margin-top: 2px; padding: 4px 8px; border-radius: 8px;
      background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
      font-size: 10px; font-weight: 700; color: #FCA5A5; display: none; text-align: center;
    }
  </style>

  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js" crossorigin="anonymous"></script>
</head>
<body>
  <div id="container">
    <div id="loader-overlay">
      <div class="spinner" id="loader-spinner"></div>
      <div class="loader-icon" id="loader-icon">⚠️</div>
      <div class="loader-title">Loading pose model</div>
      <div class="loader-status" id="loader-status-text">Setting things up…</div>

      <div class="progress-track">
        <div class="progress-fill" id="progress-bar-fill"></div>
      </div>
      <div class="progress-percentage" id="progress-pct-text">20%</div>

      <button id="retry-btn" onclick="location.reload()">Retry</button>
    </div>

    <video id="video" playsinline webkit-playsinline muted></video>
    <canvas id="canvas"></canvas>

    <div id="hud">
      <div class="hud-row">
        <span class="hud-label-tag">STATE</span>
        <div id="state-badge" class="state-badge">
          <span id="state-dot" class="state-dot"></span>
          <span id="state-value" class="state-text">Top</span>
        </div>
      </div>
      <div class="hud-row">
        <span class="hud-label-tag">VISIBILITY</span>
        <div class="vis-box">
          <span id="visibility-value" class="vis-value">--</span>
          <div class="vis-track"><div id="visibility-fill" class="vis-fill"></div></div>
        </div>
      </div>
      <div id="hud-hint">⚠️ Step back into frame</div>
    </div>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const loaderOverlay = document.getElementById('loader-overlay');
    const statusText = document.getElementById('loader-status-text');
    const progressFill = document.getElementById('progress-bar-fill');
    const pctText = document.getElementById('progress-pct-text');
    const retryBtn = document.getElementById('retry-btn');
    const spinnerEl = document.getElementById('loader-spinner');
    const iconEl = document.getElementById('loader-icon');

    let currentProgress = 20;
    let poseInstance = null;
    let selectedComplexity = 1;
    let thumbCanvas = null;
    let thumbCtx = null;
    let lastThumbTime = 0;

    function setProgress(pct, statusMsg, isError) {
      currentProgress = Math.max(currentProgress, Math.min(100, pct));
      progressFill.style.width = currentProgress + '%';
      pctText.textContent = Math.round(currentProgress) + '%';
      if (statusMsg) statusText.textContent = statusMsg;
      if (isError) {
        spinnerEl.style.display = 'none';
        iconEl.style.display = 'inline-block';
        retryBtn.style.display = 'inline-block';
        statusText.style.color = '#F87171';
        progressFill.style.background = '#F87171';
      }
    }

    // ---------- Squat state machine ----------
    const REQUIRED_LANDMARKS = [11, 12, 23, 24, 25, 26, 27, 28];
    const KNEE_UP_THRESHOLD = 155;
    const KNEE_BOTTOM_THRESHOLD = 95;
    const SMOOTHING_WINDOW = 5;
    const DEBOUNCE_FRAMES = 4;
    const kneeValues = [];
    const visibilityValues = [];
    let confirmedState = 'TOP';
    let candidateState = null;
    let candidateCount = 0;
    let repCount = 0;
    let reachedBottom = false;

    function average(values, value) {
      values.push(value);
      if (values.length > SMOOTHING_WINDOW) values.shift();
      return values.reduce((sum, item) => sum + item, 0) / values.length;
    }

    function angle(a, b, c) {
      const ba = { x: a.x - b.x, y: a.y - b.y };
      const bc = { x: c.x - b.x, y: c.y - b.y };
      const radians = Math.atan2(bc.y, bc.x) - Math.atan2(ba.y, ba.x);
      const degrees = Math.abs(radians * 180 / Math.PI);
      return degrees > 180 ? 360 - degrees : degrees;
    }

    function classifyState(knee) {
      if (confirmedState === 'TOP') return knee >= KNEE_UP_THRESHOLD ? 'TOP' : 'DOWN';
      if (confirmedState === 'BOTTOM') return knee <= 100 ? 'BOTTOM' : 'DOWN';
      if (knee <= KNEE_BOTTOM_THRESHOLD) return 'BOTTOM';
      if (knee >= KNEE_UP_THRESHOLD) return 'TOP';
      return 'DOWN';
    }

    // Returns true the frame a rep is completed (TOP -> DOWN -> BOTTOM -> TOP).
    function updateState(rawState) {
      if (rawState === confirmedState) {
        candidateState = null;
        candidateCount = 0;
        return false;
      }
      candidateCount = rawState === candidateState ? candidateCount + 1 : 1;
      candidateState = rawState;
      if (candidateCount < DEBOUNCE_FRAMES) return false;

      if (candidateState === 'BOTTOM') reachedBottom = true;
      let completedRep = false;
      if (candidateState === 'TOP' && confirmedState === 'DOWN') {
        if (reachedBottom) {
          repCount += 1;
          completedRep = true;
        }
        reachedBottom = false;
      }
      confirmedState = candidateState;
      candidateState = null;
      candidateCount = 0;
      return completedRep;
    }

    // ---------- HUD rendering ----------
    const STATE_STYLE = {
      TOP: { text: 'Standing ▲', color: '#E2F163', bg: 'rgba(226, 241, 99, 0.15)', border: 'rgba(226, 241, 99, 0.35)' },
      DOWN: { text: 'Squatting ▼', color: '#C8B6FF', bg: 'rgba(200, 182, 255, 0.18)', border: 'rgba(200, 182, 255, 0.4)' },
      BOTTOM: { text: 'Parallel ✓', color: '#34D399', bg: 'rgba(52, 211, 153, 0.2)', border: 'rgba(52, 211, 153, 0.45)' }
    };

    function renderState(state) {
      const cfg = STATE_STYLE[state] || STATE_STYLE.TOP;
      const dot = document.getElementById('state-dot');
      const label = document.getElementById('state-value');
      const badge = document.getElementById('state-badge');
      if (dot) {
        dot.style.background = cfg.color;
        dot.style.boxShadow = '0 0 8px 1px ' + cfg.color;
      }
      if (label) {
        label.textContent = cfg.text;
        label.style.color = cfg.color;
      }
      if (badge) {
        badge.style.background = cfg.bg;
        badge.style.borderColor = cfg.border;
      }
    }

    function renderVisibility(value) {
      const valueEl = document.getElementById('visibility-value');
      const fillEl = document.getElementById('visibility-fill');
      const hintEl = document.getElementById('hud-hint');
      const pct = Math.round(value * 100);
      const color = value >= 0.7 ? '#E2F163' : value >= 0.4 ? '#FBBF24' : '#F87171';
      if (valueEl) {
        valueEl.textContent = pct + '%';
        valueEl.style.color = color;
      }
      if (fillEl) {
        fillEl.style.width = Math.max(4, pct) + '%';
        fillEl.style.backgroundColor = color;
      }
      if (hintEl) {
        hintEl.style.display = value < 0.5 ? 'block' : 'none';
      }
    }

    function updateSquatHud(pose) {
      const visibility = Math.min(...REQUIRED_LANDMARKS.map((index) => pose[index].visibility ?? 1));
      const smoothVisibility = average(visibilityValues, visibility);
      renderVisibility(smoothVisibility);

      if (smoothVisibility < 0.5) {
        candidateState = null;
        candidateCount = 0;
        return;
      }

      const leftKnee = angle(pose[23], pose[25], pose[27]);
      const rightKnee = angle(pose[24], pose[26], pose[28]);
      const smoothKnee = average(kneeValues, (leftKnee + rightKnee) / 2);

      const instantState = smoothKnee <= KNEE_BOTTOM_THRESHOLD ? 'BOTTOM' : smoothKnee >= KNEE_UP_THRESHOLD ? 'TOP' : 'DOWN';
      const completedRep = updateState(classifyState(smoothKnee));
      renderState(instantState);

      if (completedRep && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SQUAT_REP', repCount }));
      }
    }

    // ---------- Pose model + camera ----------
    async function initApp() {
      try {
        setProgress(40, 'Preparing pose tracker…');

        if (typeof window.Pose === 'undefined') {
          throw new Error('Pose library is still loading. Please wait.');
        }

        const POSE_CONNECTIONS = [
          [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
          [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
          [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
          [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
          [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
        ];

        poseInstance = new window.Pose({
          locateFile: (file) => {
            setProgress(65, 'Loading model files…');
            return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/' + file;
          }
        });

        poseInstance.setOptions({
          modelComplexity: selectedComplexity,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.4,
          minTrackingConfidence: 0.4
        });

        let modelReady = false;

        poseInstance.onResults((results) => {
          if (!modelReady) {
            modelReady = true;
            setProgress(100, 'Ready');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MODEL_READY' }));
            }
            setTimeout(() => {
              loaderOverlay.style.opacity = '0';
              loaderOverlay.style.transform = 'scale(0.95)';
              setTimeout(() => { loaderOverlay.style.display = 'none'; }, 300);
            }, 250);
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // High-Speed Smooth HD Camera Stream for 1v1 Faceoff (25 FPS, 480x360)
          const nowTime = Date.now();
          if (nowTime - lastThumbTime >= 40 && video && video.videoWidth > 0) {
            lastThumbTime = nowTime;
            try {
              if (!thumbCanvas) {
                thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = 480;
                thumbCanvas.height = 360;
                thumbCtx = thumbCanvas.getContext('2d', { alpha: false });
              }
              thumbCtx.drawImage(video, 0, 0, 480, 360);
              const frameJpeg = thumbCanvas.toDataURL('image/jpeg', 0.65);
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'camera_frame', frame: frameJpeg }));
              }
            } catch (e) {}
          }

          const landmarks = results.poseLandmarks;

          if (landmarks && landmarks.length > 0) {
            updateSquatHud(landmarks);

            ctx.lineWidth = 4;
            ctx.strokeStyle = '#6366F1';
            for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
              const start = landmarks[startIdx];
              const end = landmarks[endIdx];
              if (start && end && (start.visibility ?? 1) > 0.3 && (end.visibility ?? 1) > 0.3) {
                ctx.beginPath();
                ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
                ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
                ctx.stroke();
              }
            }

            for (const lm of landmarks) {
              if ((lm.visibility ?? 1) > 0.3) {
                ctx.beginPath();
                ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#10B981';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
              }
            }

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POSE_DETECTED', count: landmarks.length }));
            }
          } else if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NO_PERSON', count: 0 }));
          }
        });

        setProgress(85, 'Starting camera…');

        let currentFacingMode = 'user';
        let currentStream = null;

        function startCamera(facingMode) {
          if (currentStream) {
            currentStream.getTracks().forEach((track) => track.stop());
          }

          const constraints = {
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          };

          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setProgress(currentProgress, 'Camera access is not available on this device', true);
            return;
          }

          navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            currentStream = stream;
            video.srcObject = stream;
            video.onloadedmetadata = resizeCanvas;
            video.play().catch((err) => console.warn('Camera playback error:', err));
            setProgress(95, 'Finishing setup…');

            async function sendFrame() {
              if (video.readyState >= 2 && poseInstance) {
                await poseInstance.send({ image: video });
              }
              requestAnimationFrame(sendFrame);
            }
            sendFrame();
          }).catch((err) => {
            setProgress(currentProgress, 'Camera access error: ' + err.message, true);
            console.error(err);
          });
        }

        window.toggleFacingMode = function () {
          currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
          startCamera(currentFacingMode);
        };

        window.setInitialComplexity = function (level) {
          selectedComplexity = level;
          if (poseInstance) {
            poseInstance.setOptions({
              modelComplexity: level,
              smoothLandmarks: true,
              minDetectionConfidence: 0.4,
              minTrackingConfidence: 0.4
            });
          }
        };

        startCamera(currentFacingMode);
      } catch (err) {
        setProgress(currentProgress, 'Something went wrong: ' + (err && err.message ? err.message : String(err)), true);
        console.error(err);
      }
    }

    function resizeCanvas() {
      if (video && video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  </script>
</body>
</html>
`;

export const CameraScreen: React.FC<CameraScreenProps> = ({ onClose, selectedModel }) => {
  const [poseStatus, setPoseStatus] = useState<string>('Connecting to Backend Server...');
  const [poseDetected, setPoseDetected] = useState<boolean>(false);
  const webViewRef = useRef<WebView | null>(null);

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(true);
  const line1Rotate = useRef(new Animated.Value(1)).current;
  const line2Scale = useRef(new Animated.Value(0)).current;
  const line3Rotate = useRef(new Animated.Value(1)).current;
  const menuItemsAnim = useRef(
    [0, 1].map(() => new Animated.Value(1))
  ).current;

  const pan = useRef(new Animated.ValueXY({ x: 16, y: 40 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  useEffect(() => {
    async function requestPermissions() {
      try {
        if (Camera && Camera.requestCameraPermissionsAsync) {
          await Camera.requestCameraPermissionsAsync();
        }
      } catch (e) {
        console.warn('Camera permission request error:', e);
      }
    }
    requestPermissions();
  }, []);

  const numericComplexity = selectedModel === 'light' ? 0 : selectedModel === 'high' ? 2 : 1;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'POSE_DETECTED') {
        const label =
          selectedModel === 'light'
            ? 'Light Model'
            : selectedModel === 'high'
            ? 'High Model'
            : 'Medium Model';
        setPoseStatus(`🧍 MediaPipe Active (${label})`);
        setPoseDetected(true);
      } else if (data.type === 'NO_PERSON') {
        setPoseStatus('🔍 Searching for Person in Frame...');
        setPoseDetected(false);
      }
    } catch (e) {}
  };

  const handleToggleFlip = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.toggleFacingMode(); true;');
    }
  };

  const handleWebViewLoad = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.setInitialComplexity(${numericComplexity}); true;`);
    }
  };

  const getModelLabel = () => {
    switch (selectedModel) {
      case 'light':
        return '⚡ Light Model';
      case 'high':
        return '🔥 High Model';
      case 'medium':
      default:
        return '🎯 Medium Model';
    }
  };

  const toggleMenu = () => {
    const nextOpen = !isMenuOpen;
    setIsMenuOpen(nextOpen);

    Animated.parallel([
      Animated.timing(line1Rotate, {
        toValue: nextOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(line2Scale, {
        toValue: nextOpen ? 0 : 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(line3Rotate, {
        toValue: nextOpen ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();

    Animated.stagger(100, [
      Animated.spring(menuItemsAnim[0], {
        toValue: nextOpen ? 1 : 0,
        friction: 8,
        useNativeDriver: false,
      }),
      Animated.spring(menuItemsAnim[1], {
        toValue: nextOpen ? 1 : 0,
        friction: 8,
        useNativeDriver: false,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <WebView
        ref={webViewRef}
        source={{
          html: POSE_HTML_BUNDLE,
          baseUrl: 'https://cdn.jsdelivr.net',
        }}
        userAgent="MobilePoseApp/1.0"
        style={StyleSheet.absoluteFillObject}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL="*"
        mixedContentMode="always"
        originWhitelist={['*']}
        onMessage={handleMessage}
        onLoadEnd={handleWebViewLoad}
       />

      {/* Draggable Hamburger Radial Menu */}
      <Animated.View
        style={[styles.menuContainer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        {...panResponder.panHandlers}
      >
        {menuItemsAnim.map((anim, i) => {
          const itemConfigs = [
            { icon: '✕', color: '#EF4444', label: 'Close', onPress: onClose },
            { icon: '🔄', color: '#3B82F6', label: 'Flip', onPress: handleToggleFlip },
          ];
          const pos = [
            { x: 80, y: -90 },
            { x: 150, y: -45 },
          ];
          const cfg = itemConfigs[i];
          const position = pos[i];
          const translateX = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, position.x - 40],
          });
          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, position.y],
          });
          const itemScale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
          });
          return (
            <Animated.View
              key={cfg.label}
              style={[
                styles.menuItem,
                {
                  backgroundColor: cfg.color,
                  opacity: anim,
                  transform: [{ translateX }, { translateY }, { scale: itemScale }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.menuItemInner}
                activeOpacity={0.85}
                onPress={cfg.onPress ? cfg.onPress : undefined}
              >
                <Text style={styles.menuItemText}>{cfg.icon}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Hamburger Toggle Button */}
        <TouchableOpacity
          style={styles.hamburgerBtn}
          activeOpacity={0.85}
          onPress={toggleMenu}
        >
          <Animated.View
            style={[
              styles.hamburgerLine,
              {
                top: '50%',
                left: '50%',
                marginLeft: -12.5,
                marginTop: -1.5,
                transform: [
                  {
                    rotate: line1Rotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '45deg'],
                    }),
                  },
                  {
                    translateY: line1Rotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.hamburgerLine,
              {
                top: '50%',
                left: '50%',
                marginLeft: -12.5,
                marginTop: -1.5,
                transform: [
                  {
                    scaleX: line2Scale.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.1, 1],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.hamburgerLine,
              {
                top: '50%',
                left: '50%',
                marginLeft: -12.5,
                marginTop: -1.5,
                transform: [
                  {
                    rotate: line3Rotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '-45deg'],
                    }),
                  },
                  {
                    translateY: line3Rotate.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  menuItem: {
    position: 'absolute',
    top: 0,
    left: -40,
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 26,
  },
  hamburgerBtn: {
    position: 'absolute',
    zIndex: 10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  hamburgerLine: {
    position: 'absolute',
    width: 25,
    height: 3,
    backgroundColor: '#596778',
  },
});
