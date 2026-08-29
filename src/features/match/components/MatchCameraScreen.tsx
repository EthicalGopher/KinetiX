import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Camera, CameraView } from 'expo-camera';
import {
  connectStreamSocket,
  disconnectStreamSocket,
  disconnectMatchSocket,
  addStreamMessageListener,
  addMatchMessageListener,
  sendMatchMessage,
  sendStreamFrame,
} from '../../../utils/matchmaking';

const SERVER_HOST = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';

export type MatchMode = 'faceoff' | 'quickjoin';

interface MatchCameraScreenProps {
  onClose: () => void;
  selectedModel?: string;
  mode: MatchMode;
  opponentUsername?: string;
  selfUsername?: string;
}

export const MatchCameraScreen: React.FC<MatchCameraScreenProps> = ({
  onClose,
  selectedModel = 'medium',
  mode = 'faceoff',
  opponentUsername = 'opponent',
  selfUsername = 'user',
}) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [opponentFrame, setOpponentFrame] = useState<string | null>(null);
  const [selfScore, setSelfScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [matchEnded, setMatchEnded] = useState(false);
  const matchEndedRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const streamListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();

    if (mode === 'faceoff') {
      connectStreamSocket(opponentUsername, 'viewer');
      streamListenerRef.current = addStreamMessageListener((msg: any) => {
        if (msg.type === 'frame' && msg.data) {
          setOpponentFrame(msg.data);
        }
      });
    }

    const removeMatchListener = addMatchMessageListener((msg: any) => {
      if (!matchEndedRef.current && msg.type === 'score' && typeof msg.score === 'number') {
        setOpponentScore(msg.score);
      }
    });
    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          matchEndedRef.current = true;
          setMatchEnded(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      if (streamListenerRef.current) streamListenerRef.current();
      removeMatchListener();
      clearInterval(timer);
      disconnectStreamSocket();
      disconnectMatchSocket();
    };
  }, [opponentUsername, mode]);

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'camera_frame' && data.frame) {
        sendStreamFrame(data.frame);
      }
      if (!matchEndedRef.current && data.type === 'SQUAT_REP') {
        setSelfScore((current) => {
          const nextScore = current + 1;
          sendMatchMessage({ type: 'score', score: nextScore });
          return nextScore;
        });
      }
    } catch (e) {}
  }, []);

  if (mode === 'quickjoin') {
    return (
      <View style={styles.container}>
        <StatusBar hidden />

        <View style={styles.yourContainerFull}>
          <View style={styles.yourHeaderFull}>
            <Text style={styles.yourLabel}>YOU</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.redDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          {hasPermission ? (
            <CameraView
              style={styles.cameraViewFull}
              facing="front"
            />
          ) : (
            <View style={styles.videoPlaceholderFull}>
              <Text style={styles.placeholderText}>🔒 Camera access needed</Text>
            </View>
          )}

          <WebView
            ref={webViewRef}
            source={{
              uri: `${SERVER_HOST}/pose?model=${selectedModel}&user=${encodeURIComponent(selfUsername)}`,
              headers: { 'ngrok-skip-browser-warning': 'true' },
            }}
            userAgent="MobilePoseApp/1.0"
            style={styles.hiddenWebView}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowUniversalAccessFromFileURLs
            allowingReadAccessToURL="*"
            mixedContentMode="always"
            originWhitelist={['*']}
            onMessage={handleWebViewMessage}
          />
        </View>

        <ScoreBoard selfScore={selfScore} opponentScore={opponentScore} timeLeft={timeLeft} ended={matchEnded} />

        <View style={styles.bottomOverlay}>
          <Text style={styles.matchStatusText}>QUICK START MATCH</Text>
          <TouchableOpacity
            style={styles.leaveButton}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={styles.leaveButtonText}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Opponent View - Right Side */}
      <View style={styles.opponentContainer}>
        <View style={styles.opponentHeader}>
          <Text style={styles.opponentLabel}>OPPONENT</Text>
          <View style={styles.onlineIndicator}>
            <View style={styles.greenDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
        </View>
        <View style={styles.videoPlaceholder}>
          {opponentFrame ? (
            <Image source={{ uri: opponentFrame }} style={styles.opponentVideo} resizeMode="cover" />
          ) : (
            <Text style={styles.placeholderText}>👤 Waiting for opponent feed...</Text>
          )}
        </View>
      </View>

      {/* Vertical Divider */}
      <View style={styles.divider} />

      {/* Your View - Left Side */}
      <View style={styles.yourContainer}>
        <View style={styles.yourHeader}>
          <Text style={styles.yourLabel}>YOU</Text>
          <View style={styles.liveIndicator}>
            <View style={styles.redDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {hasPermission ? (
          <CameraView
            style={styles.cameraView}
            facing="front"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.placeholderText}>🔒 Camera access needed</Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{
            uri: `${SERVER_HOST}/pose?model=${selectedModel}&user=${encodeURIComponent(selfUsername)}`,
            headers: { 'ngrok-skip-browser-warning': 'true' },
          }}
          userAgent="MobilePoseApp/1.0"
          style={styles.hiddenWebView}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          allowFileAccess
          allowUniversalAccessFromFileURLs
          allowingReadAccessToURL="*"
          mixedContentMode="always"
          originWhitelist={['*']}
          onMessage={handleWebViewMessage}
        />
      </View>

      <ScoreBoard selfScore={selfScore} opponentScore={opponentScore} timeLeft={timeLeft} ended={matchEnded} />

      {/* Bottom Overlay with Match Info */}
      <View style={styles.bottomOverlay}>
        <View style={styles.matchInfo}>
          <Text style={styles.matchStatusText}>MATCH FOUND</Text>
          <Text style={styles.timerText}>00:00</Text>
        </View>
        <TouchableOpacity
          style={styles.leaveButton}
          activeOpacity={0.8}
          onPress={onClose}
        >
          <Text style={styles.leaveButtonText}>Leave Match</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ScoreBoard: React.FC<{
  selfScore: number;
  opponentScore: number;
  timeLeft: number;
  ended: boolean;
}> = ({ selfScore, opponentScore, timeLeft, ended }) => (
  <View style={styles.scoreBoard} pointerEvents="none">
    <View style={styles.scorePlayer}>
      <Text style={styles.scorePlayerLabel}>YOU</Text>
      <Text style={styles.scoreValue}>{selfScore}</Text>
    </View>
    <View style={styles.scoreTimer}>
      <Text style={styles.scoreTimerLabel}>{ended ? 'MATCH OVER' : 'TIME'}</Text>
      <Text style={styles.scoreTimerValue}>{ended ? (selfScore > opponentScore ? 'WIN' : selfScore < opponentScore ? 'LOSE' : 'DRAW') : `${timeLeft}s`}</Text>
    </View>
    <View style={styles.scorePlayer}>
      <Text style={styles.scorePlayerLabel}>OPPONENT</Text>
      <Text style={styles.scoreValue}>{opponentScore}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    flexDirection: 'row',
  },
  opponentContainer: {
    flex: 1,
    borderRightColor: '#333',
    borderRightWidth: 2,
  },
  opponentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  opponentLabel: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  onlineText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  opponentVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    color: '#666',
    fontSize: 18,
  },
  divider: {
    width: 2,
    backgroundColor: '#333',
  },
  yourContainer: {
    flex: 1,
    position: 'relative',
  },
  yourHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  yourLabel: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 4,
  },
  liveText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  cameraView: {
    flex: 1,
  },
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scoreBoard: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  scorePlayer: {
    alignItems: 'center',
    minWidth: 88,
  },
  scorePlayerLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  scoreTimer: {
    alignItems: 'center',
  },
  scoreTimerLabel: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreTimerValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  matchInfo: {
    flex: 1,
    alignItems: 'center',
  },
  matchStatusText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  leaveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  leaveButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  yourContainerFull: {
    flex: 1,
    position: 'relative',
  },
  yourHeaderFull: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  cameraViewFull: {
    flex: 1,
  },
  videoPlaceholderFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
});
