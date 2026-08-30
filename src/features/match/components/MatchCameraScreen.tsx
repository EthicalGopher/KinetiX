import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Image,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Camera } from 'expo-camera';
import {
  disconnectMatchSocket,
  addMatchMessageListener,
  sendMatchMessage,
} from '../../../utils/matchmaking';
import { POSE_HTML_BUNDLE } from '../../camera/components/CameraScreen';
import { recordExerciseMatchResult } from '../../../utils/rankingService';
import { useUserStore } from '../../../store/userStore';

const SERVER_HOST = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';

export type MatchMode = 'faceoff' | 'quickjoin';

interface MatchCameraScreenProps {
  onClose: () => void;
  selectedModel?: string;
  mode: MatchMode;
  opponentUsername?: string;
  selfUsername?: string;
  exerciseId?: string;
}

export const MatchCameraScreen: React.FC<MatchCameraScreenProps> = ({
  onClose,
  selectedModel = 'medium',
  mode = 'faceoff',
  opponentUsername = 'opponent',
  selfUsername = 'user',
  exerciseId = '1',
}) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [opponentFrame, setOpponentFrame] = useState<string | null>(null);
  const [selfScore, setSelfScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [matchEnded, setMatchEnded] = useState(false);
  const matchEndedRef = useRef(false);
  const recordedResultRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const streamListenerRef = useRef<(() => void) | null>(null);

  const { user, refreshProfile } = useUserStore();

  useEffect(() => {
    if (matchEnded && !recordedResultRef.current && user?.id) {
      recordedResultRef.current = true;
      const result =
        selfScore > opponentScore ? 'win' : selfScore === opponentScore ? 'draw' : 'defeat';
      recordExerciseMatchResult(user.id, exerciseId, result, selfScore).then(() => {
        refreshProfile();
      });
    }
  }, [matchEnded, selfScore, opponentScore, user?.id, exerciseId, refreshProfile]);

  useEffect(() => {
    (async () => {
      try {
        if (Camera && Camera.requestCameraPermissionsAsync) {
          const { status } = await Camera.requestCameraPermissionsAsync();
          setHasPermission(status === 'granted');
        }
      } catch (e) {}
    })();

    const removeMatchListener = addMatchMessageListener((msg: any) => {
      if (!matchEndedRef.current && msg.type === 'score' && typeof msg.score === 'number') {
        setOpponentScore(msg.score);
      }
      if (!matchEndedRef.current && mode === 'faceoff' && msg.type === 'frame' && msg.data) {
        setOpponentFrame(msg.data);
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
      removeMatchListener();
      clearInterval(timer);
      disconnectMatchSocket();
    };
  }, [opponentUsername, mode]);

  const handleWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (!matchEndedRef.current && mode === 'faceoff' && data.type === 'camera_frame' && data.frame) {
        sendMatchMessage({ type: 'frame', data: data.frame });
      }
      if (!matchEndedRef.current && data.type === 'SQUAT_REP') {
        setSelfScore((current) => {
          const nextScore = current + 1;
          sendMatchMessage({ type: 'score', score: nextScore });
          return nextScore;
        });
      }
    } catch (e) {}
  }, [mode]);

  if (mode === 'quickjoin') {
    return (
      <View style={styles.container}>
        <StatusBar hidden />

        <View style={styles.yourContainerFull}>
          

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
            onMessage={handleWebViewMessage}
          />
        </View>

        <ScoreBoard
          selfScore={selfScore}
          opponentScore={opponentScore}
          timeLeft={timeLeft}
          ended={matchEnded}
          selfUsername={selfUsername}
          opponentUsername={opponentUsername}
        />

        <View style={styles.bottomOverlay}>
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
          <Text style={styles.opponentLabel}>OPPONENT ({opponentUsername})</Text>
          <View style={styles.onlineIndicator}>
            <View style={styles.greenDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
        </View>
        <View style={styles.videoPlaceholder}>
          {opponentFrame ? (
            <Image source={{ uri: opponentFrame }} style={styles.opponentVideo} resizeMode="contain" />
          ) : (
            <Text style={styles.placeholderText}>👤 Waiting for opponent feed...</Text>
          )}
        </View>
      </View>

      {/* Vertical Divider */}
      <View style={styles.divider} />

      {/* Your View - Left Side */}
      <View style={styles.yourContainer}>
        

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
          onMessage={handleWebViewMessage}
        />
      </View>

      <ScoreBoard
        selfScore={selfScore}
        opponentScore={opponentScore}
        timeLeft={timeLeft}
        ended={matchEnded}
        selfUsername={selfUsername}
        opponentUsername={opponentUsername}
      />

      {/* Bottom Overlay with Match Info */}
      <View style={styles.bottomOverlay}>
        <View style={styles.matchInfo}>
          <Text style={styles.matchStatusText}>FACEOFF 1v1 MATCH</Text>
          <Text style={styles.timerText}>{timeLeft}s</Text>
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

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

const SELF_COLOR = '#3B82F6';
const OPPONENT_COLOR = '#EF4444';
const WIN_COLOR = '#10B981';
const LOSE_COLOR = '#EF4444';
const DRAW_COLOR = '#FBBF24';
const NEUTRAL_TIMER_COLOR = '#818CF8';

/** Small bounce whenever `value` changes, skipping the initial mount. */
function useBumpAnim(value: number): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    scale.setValue(1.28);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [value, scale]);

  return scale;
}

const ScoreBoard: React.FC<{
  selfScore: number;
  opponentScore: number;
  timeLeft: number;
  ended: boolean;
  selfUsername?: string;
  opponentUsername?: string;
}> = ({
  selfScore,
  opponentScore,
  timeLeft,
  ended,
  selfUsername = 'user',
  opponentUsername = 'opponent',
}) => {
  const selfScale = useBumpAnim(selfScore);
  const opponentScale = useBumpAnim(opponentScore);
  const pulseScale = useRef(new Animated.Value(1)).current;

  const outcome: 'WIN' | 'LOSE' | 'DRAW' =
    selfScore > opponentScore ? 'WIN' : selfScore < opponentScore ? 'LOSE' : 'DRAW';
  const leader: 'self' | 'opponent' | null =
    selfScore === opponentScore ? null : selfScore > opponentScore ? 'self' : 'opponent';
  const urgent = !ended && timeLeft > 0 && timeLeft <= 5;

  useEffect(() => {
    if (!urgent) {
      pulseScale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.12, duration: 320, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1, duration: 320, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [urgent, pulseScale]);

  const timerColor = ended
    ? outcome === 'WIN'
      ? WIN_COLOR
      : outcome === 'LOSE'
      ? LOSE_COLOR
      : DRAW_COLOR
    : urgent
    ? LOSE_COLOR
    : timeLeft <= 10
    ? DRAW_COLOR
    : NEUTRAL_TIMER_COLOR;

  return (
    <View style={styles.scoreBoard} pointerEvents="none">
      <PlayerBadge
        isSelf
        label="YOU"
        username={selfUsername}
        score={selfScore}
        color={SELF_COLOR}
        leading={!ended && leader === 'self'}
        scale={selfScale}
      />

      <Animated.View
        style={[
          styles.timerBadge,
          ended && styles.timerBadgeEnded,
          { borderColor: timerColor },
          ended && { backgroundColor: timerColor + '26' },
          { transform: [{ scale: pulseScale }] },
        ]}
      >
        {ended ? (
          <Text style={[styles.timerOutcome, { color: timerColor }]} numberOfLines={1}>
            {outcome === 'WIN'
              ? 'VICTORY (+10)'
              : outcome === 'DRAW'
              ? 'DRAW (+5)'
              : 'DEFEAT (-10)'}
          </Text>
        ) : (
          <>
            <Text style={[styles.timerValue, { color: timerColor }]}>{timeLeft}</Text>
            <Text style={styles.timerUnit}>SEC</Text>
          </>
        )}
      </Animated.View>

      <PlayerBadge
        label={(opponentUsername || 'OPPONENT').toUpperCase()}
        username={opponentUsername}
        score={opponentScore}
        color={OPPONENT_COLOR}
        leading={!ended && leader === 'opponent'}
        scale={opponentScale}
      />
    </View>
  );
};

const PlayerBadge: React.FC<{
  isSelf?: boolean;
  label: string;
  username: string;
  score: number;
  color: string;
  leading: boolean;
  scale: Animated.Value;
}> = ({ isSelf = false, label, username, score, color, leading, scale }) => {
  const initial = (username || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.playerBadge, !isSelf && styles.playerBadgeReverse]}>
      <View style={styles.avatarWrap}>
        {leading && <Text style={styles.crown}>👑</Text>}
        <View style={[styles.avatar, { borderColor: color, backgroundColor: color + '26' }]}>
          <Text style={[styles.avatarInitial, { color }]}>{initial}</Text>
        </View>
      </View>
      <View style={isSelf ? styles.playerTextLeft : styles.playerTextRight}>
        <Text style={styles.playerLabel} numberOfLines={1}>
          {label}
        </Text>
        <Animated.Text style={[styles.playerScore, { color, transform: [{ scale }] }]}>
          {score}
        </Animated.Text>
      </View>
    </View>
  );
};

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

  // ---- Scoreboard ----
  scoreBoard: {
    position: 'absolute',
    top: 12,
    left: '30%',
    zIndex: 20,
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  playerBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerBadgeReverse: {
    flexDirection: 'row-reverse',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  crown: {
    position: 'absolute',
    top: -15,
    alignSelf: 'center',
    fontSize: 13,
    zIndex: 5,
  },
  playerTextLeft: {
    marginLeft: 8,
    alignItems: 'flex-start',
  },
  playerTextRight: {
    marginRight: 8,
    alignItems: 'flex-end',
  },
  playerLabel: {
    maxWidth: 76,
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  playerScore: {
    marginTop: 1,
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  timerBadgeEnded: {
    width: undefined,
    height: undefined,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timerValue: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerUnit: {
    marginTop: -1,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  timerOutcome: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
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