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

const POSE_HTML_BUNDLE = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { width: 100%; height: 100%; overflow: hidden; background-color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #container { position: relative; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; }
    video { position: absolute; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
    canvas { position: absolute; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); pointer-events: none; }
    
    #loader-overlay {
      position: absolute; z-index: 20; width: 85%; max-width: 360px;
      background: rgba(30, 41, 59, 0.94); border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 24px; padding: 24px; text-align: center; color: #F8FAFC;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); backdrop-filter: blur(16px);
      transition: opacity 0.4s ease, transform 0.4s ease;
    }
    .loader-icon { font-size: 36px; margin-bottom: 12px; display: inline-block; }
    .loader-title { font-size: 18px; font-weight: 700; color: #F8FAFC; margin-bottom: 6px; }
    .loader-status { font-size: 13px; color: #94A3B8; margin-bottom: 16px; min-height: 20px; line-height: 18px; }
    
    .progress-track {
      width: 100%; height: 10px; background-color: #0F172A; border-radius: 10px;
      overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 8px;
    }
    .progress-fill {
      height: 100%; width: 5%; background: linear-gradient(90deg, #6366F1, #818CF8);
      border-radius: 10px; transition: width 0.25s ease;
    }
    .progress-percentage { font-size: 12px; font-weight: 600; color: #818CF8; text-align: right; }
    
    #retry-btn {
      display: none; margin-top: 14px; background-color: #6366F1; color: #fff;
      border: none; padding: 10px 20px; border-radius: 20px; font-weight: 600;
      font-size: 13px; cursor: pointer;
    }

    #squat-hud {
      position: absolute; z-index: 10; top: 16px; left: 16px; min-width: 190px;
      padding: 12px 14px; border: 1px solid rgba(255,255,255,.16);
      border-radius: 14px; background: rgba(15,23,42,.78); color: #F8FAFC;
      font-size: 12px; line-height: 1.7; backdrop-filter: blur(10px);
    }
    #squat-hud strong { color: #93C5FD; }
    #squat-state { font-weight: 800; color: #10B981; }
  </style>
  <script>
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        const legacyGetUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;
        if (!legacyGetUserMedia) {
          return Promise.reject(new Error('getUserMedia is not supported in this WebView context'));
        }
        return new Promise(function(resolve, reject) {
          legacyGetUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  </script>
</head>
<body>
  <div id="container">
    <div id="loader-overlay">
      <div class="loader-icon" id="loader-icon">📦</div>
      <div class="loader-title">Loading Pose Model</div>
      <div class="loader-status" id="loader-status-text">Connecting to Local Backend Server...</div>
      
      <div class="progress-track">
        <div class="progress-fill" id="progress-bar-fill"></div>
      </div>
      <div class="progress-percentage" id="progress-pct-text">10%</div>
      
      <button id="retry-btn" onclick="location.reload()">🔄 Retry</button>
    </div>

    <video id="video" playsinline webkit-playsinline muted></video>
    <canvas id="canvas"></canvas>
    <div id="squat-hud">
      <div><strong>STATE</strong> <span id="squat-state">UP</span></div>
      <div><strong>REPS</strong> <span id="squat-reps">0</span></div>
      <div><strong>KNEE</strong> <span id="squat-knee">--</span></div>
      <div><strong>HIP</strong> <span id="squat-hip">--</span></div>
      <div><strong>VISIBILITY</strong> <span id="squat-visibility">--</span></div>
    </div>
  </div>

  <script>
    // Patch fetch and XHR to automatically skip ngrok browser warning pages
    const _origFetch = window.fetch;
    window.fetch = function(url, init) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.append('ngrok-skip-browser-warning', 'true');
      } else {
        init.headers['ngrok-skip-browser-warning'] = 'true';
      }
      return _origFetch(url, init);
    };

    const _origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      const res = _origXHROpen.apply(this, [method, url, ...rest]);
      try {
        this.setRequestHeader('ngrok-skip-browser-warning', 'true');
      } catch (e) {}
      return res;
    };

    async function loadScript(url) {
      try {
        const resp = await fetch(url, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!resp.ok) {
          throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
        }
        const jsContent = await resp.text();
        const script = document.createElement('script');
        script.textContent = jsContent;
        document.head.appendChild(script);
      } catch (err) {
        console.error('Failed script fetch:', err);
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
    }

    const REQUIRED_LANDMARKS = [11, 12, 23, 24, 25, 26, 27, 28];
    const KNEE_UP_THRESHOLD = 160;
    const KNEE_BOTTOM_THRESHOLD = 100;
    const SMOOTHING_WINDOW = 5;
    const DEBOUNCE_FRAMES = 5;
    const kneeValues = [];
    const hipValues = [];
    const visibilityValues = [];
    let confirmedState = 'UP';
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
      if (confirmedState === 'UP') return knee >= KNEE_UP_THRESHOLD ? 'UP' : 'DOWN';
      if (confirmedState === 'BOTTOM') return knee <= KNEE_BOTTOM_THRESHOLD ? 'BOTTOM' : 'DOWN';
      if (knee <= KNEE_BOTTOM_THRESHOLD) return 'BOTTOM';
      if (knee >= KNEE_UP_THRESHOLD) return 'UP';
      return 'DOWN';
    }

    function updateState(rawState) {
      if (rawState === confirmedState) {
        candidateState = null;
        candidateCount = 0;
        return;
      }
      candidateCount = rawState === candidateState ? candidateCount + 1 : 1;
      candidateState = rawState;
      if (candidateCount < DEBOUNCE_FRAMES) return;

      if (candidateState === 'BOTTOM') reachedBottom = true;
      let completedRep = false;
      if (candidateState === 'UP' && confirmedState === 'DOWN') {
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

    function updateSquatHud(pose) {
      const visibility = Math.min(...REQUIRED_LANDMARKS.map((index) => pose[index].visibility || 1));
      const smoothVisibility = average(visibilityValues, visibility);
      document.getElementById('squat-visibility').textContent = smoothVisibility.toFixed(2);
      if (smoothVisibility < 0.5) {
        candidateState = null;
        candidateCount = 0;
        document.getElementById('squat-knee').textContent = '--';
        document.getElementById('squat-hip').textContent = '--';
        return;
      }

      const leftKnee = angle(pose[23], pose[25], pose[27]);
      const rightKnee = angle(pose[24], pose[26], pose[28]);
      const leftHip = angle(pose[11], pose[23], pose[25]);
      const rightHip = angle(pose[12], pose[24], pose[26]);
      const smoothKnee = average(kneeValues, (leftKnee + rightKnee) / 2);
      const smoothHip = average(hipValues, (leftHip + rightHip) / 2);
      const completedRep = updateState(classifyState(smoothKnee));
      document.getElementById('squat-state').textContent = confirmedState;
      document.getElementById('squat-reps').textContent = repCount;
      document.getElementById('squat-knee').textContent = smoothKnee.toFixed(1) + ' deg';
      document.getElementById('squat-hip').textContent = smoothHip.toFixed(1) + ' deg';
      if (completedRep && window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SQUAT_REP', repCount }));
      }
    }

    async function initApp() {
      const LOCAL_STATIC = "${SERVER_HOST}/static";

      try {
        setProgress(25, 'Loading Camera Utilities from Backend...');
        await loadScript(LOCAL_STATIC + '/camera_utils.js');

        setProgress(45, 'Loading Pose Library from Backend...');
        await loadScript(LOCAL_STATIC + '/pose.js');

        if (typeof window.Pose === 'undefined') {
          throw new Error('Pose library failed to initialize');
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
            setProgress(70, 'Downloading Model Asset: ' + file);
            return LOCAL_STATIC + '/' + file;
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
            setProgress(100, 'Backend Pose Model Loaded Successfully!');
            setTimeout(() => {
              loaderOverlay.style.opacity = '0';
              loaderOverlay.style.transform = 'scale(0.9)';
              setTimeout(() => { loaderOverlay.style.display = 'none'; }, 400);
            }, 300);
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (results.poseLandmarks && results.poseLandmarks.length > 0) {
            updateSquatHud(results.poseLandmarks[0]);
            ctx.lineWidth = 4.5;
            ctx.strokeStyle = '#6366F1';
            for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
              const start = results.poseLandmarks[startIdx];
              const end = results.poseLandmarks[endIdx];
              if (start && end && (start.visibility || 1) > 0.3 && (end.visibility || 1) > 0.3) {
                ctx.beginPath();
                ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
                ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
                ctx.stroke();
              }
            }

            for (const lm of results.poseLandmarks) {
              if ((lm.visibility || 1) > 0.3) {
                ctx.beginPath();
                ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 6.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#10B981';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
              }
            }

            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'POSE_DETECTED',
                count: results.poseLandmarks.length
              }));
            }
          } else {
            document.getElementById('squat-state').textContent = 'NO PERSON';
            document.getElementById('squat-visibility').textContent = '0.00';
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NO_PERSON',
                count: 0
              }));
            }
          }
        });

        setProgress(85, 'Accessing Front Selfie Camera...');

        let currentFacingMode = 'user';
        let currentStream = null;

        function startCamera(facingMode) {
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
          }

          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 640 },
              height: { ideal: 480 }
            },
            audio: false
          };

          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
              currentStream = stream;
              video.srcObject = stream;
              video.play().catch((err) => {
                console.warn('Camera playback could not start:', err);
              });
              setProgress(95, 'Starting Neural Processing...');

              async function sendFrame() {
                if (video.readyState >= 2 && poseInstance) {
                  await poseInstance.send({ image: video });
                }
                requestAnimationFrame(sendFrame);
              }
              sendFrame();
            }).catch((err) => {
              setProgress(currentProgress, '⚠️ Camera Access Error: ' + err.message, true);
              console.error(err);
            });
          } else {
            setProgress(currentProgress, '⚠️ navigator.mediaDevices.getUserMedia is unavailable', true);
          }
        }

        window.toggleFacingMode = function() {
          currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
          startCamera(currentFacingMode);
        };

        window.setInitialComplexity = function(level) {
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
        const msg = err && err.message ? err.message : String(err);
        setProgress(currentProgress, '⚠️ Backend Error (' + msg + ') - Ensure server.py is running at ' + LOCAL_STATIC, true);
        console.error(err);
      }
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    initApp();
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
          uri: `${SERVER_HOST}/pose`,
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        }}
        userAgent="MobilePoseApp/1.0"
        style={StyleSheet.absoluteFillObject}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
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
