import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'expo-camera';

export type ModelComplexity = 'light' | 'medium' | 'high';

interface CameraScreenProps {
  onClose: () => void;
  selectedModel: ModelComplexity;
}

const SERVER_HOST = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';

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
              video.play();
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
        onPermissionRequest={(event: any) => {
          if (event && event.nativeEvent && event.nativeEvent.resources) {
            // Android WebView permission handler
          }
          if (typeof (event as any).grant === 'function') {
            (event as any).grant((event as any).resources);
          }
        }}
        onMessage={handleMessage}
        onLoadEnd={handleWebViewLoad}
      />

      <SafeAreaView style={styles.overlayHeader}>
        <TouchableOpacity style={styles.glassButton} activeOpacity={0.8} onPress={onClose}>
          <Text style={styles.glassButtonText}>✕ Close</Text>
        </TouchableOpacity>

        <View style={styles.glassPillBadge}>
          <Text style={styles.glassPillBadgeText}>{getModelLabel()}</Text>
        </View>

        <TouchableOpacity style={styles.glassButton} activeOpacity={0.8} onPress={handleToggleFlip}>
          <Text style={styles.glassButtonText}>🔄 Flip</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView style={styles.overlayFooter}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: poseDetected ? '#10B981' : '#F59E0B' }]} />
          <Text style={styles.statusPillText}>{poseStatus}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  glassButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  glassPillBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  glassPillBadgeText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  overlayFooter: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusPillText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
});
