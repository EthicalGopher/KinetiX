import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Animated,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Camera } from 'expo-camera';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  Dumbbell,
  LogOut,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Sparkles,
  SwitchCamera,
  Swords,
  UserPlus,
  X,
  Zap,
} from 'lucide-react-native';
import {
  disconnectMatchSocket,
  addMatchMessageListener,
  sendMatchMessage,
  FFALeaderboardPlayer,
} from '../../../utils/matchmaking';
import { getPoseHtmlBundle } from '../../camera/components/CameraScreen';
import { recordExerciseMatchResult } from '../../../utils/rankingService';
import { useUserStore } from '../../../store/userStore';
import { sendFriendRequest } from '../../../utils/friendService';
import { sendCustomBattleInvite } from '../../../utils/customBattleService';
import { LoadingScreen } from '../../../screens/LoadingScreen';

export type MatchMode = 'faceoff' | 'quickjoin' | 'ffa';

type MatchPhase = 'loading_resources' | 'setup_countdown' | 'active_match' | 'match_ended';

interface MatchCameraScreenProps {
  onClose: () => void;
  selectedModel?: string;
  mode: MatchMode;
  opponentUsername?: string;
  selfUsername?: string;
  exerciseId?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const OPPONENT_STREAM_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background-color: #0C0F14; }
    #container { position: relative; width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center; background-color: #0C0F14; }
    #stream-canvas { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
  </style>
</head>
<body>
  <div id="container">
    <canvas id="stream-canvas"></canvas>
  </div>
  <script>
    const canvas = document.getElementById('stream-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const img = new Image();
    let isReady = true;

    img.onload = function() {
      if (canvas.width !== img.naturalWidth && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      isReady = true;
    };

    window.updateFrame = function(dataUrl) {
      if (isReady && dataUrl) {
        isReady = false;
        img.src = dataUrl;
      }
    };
  </script>
</body>
</html>
`;

export const MatchCameraScreen: React.FC<MatchCameraScreenProps> = ({
  onClose,
  selectedModel = 'medium',
  mode = 'faceoff',
  opponentUsername = 'opponent',
  selfUsername = 'user',
  exerciseId = '1',
}) => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [hasOpponentStream, setHasOpponentStream] = useState(false);
  const [selfScore, setSelfScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [ffaLeaderboard, setFfaLeaderboard] = useState<FFALeaderboardPlayer[]>([]);
  const [ffaReadyCount, setFfaReadyCount] = useState<number>(0);
  const [ffaTotalPlayers, setFfaTotalPlayers] = useState<number>(0);

  // Match Phases & Timers
  const [matchPhase, setMatchPhase] = useState<MatchPhase>('loading_resources');
  const [localReady, setLocalReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [setupCount, setSetupCount] = useState(30); // 30s camera setup countdown
  const [visibility, setVisibility] = useState<number>(0); // 0 to 1 smooth visibility
  const [timeLeft, setTimeLeft] = useState(120); // 2 mins duel match timer
  const [matchEnded, setMatchEnded] = useState(false);

  // Animated values for setup phase choreography
  const setupPositionAnim = useRef(new Animated.Value(0)).current; // 0 = center (large), 1 = top (small)
  const instructionAnim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = smoothly revealed

  const matchEndedRef = useRef(false);
  const recordedResultRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const opponentWebViewRef = useRef<WebView>(null);
  const hasReceivedFirstOpponentFrame = useRef(false);
  const matchPhaseRef = useRef<MatchPhase>('loading_resources');
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  const windowWidth = dimensions.width;
  const windowHeight = dimensions.height;
  const isLandscape = windowWidth > windowHeight;

  const { user, profile, refreshProfile } = useUserStore();

  useEffect(() => {
    matchPhaseRef.current = matchPhase;
  }, [matchPhase]);

  // Record result when match finishes
  useEffect(() => {
    if (matchEnded && !recordedResultRef.current && user?.id) {
      recordedResultRef.current = true;
      if (mode === 'ffa') {
        // In FFA: Top 3 or highest score is win/podium
        const myRank = ffaLeaderboard.findIndex((p) => p.username === selfUsername || p.username === user.id) + 1;
        const result = myRank === 1 ? 'win' : myRank > 0 && myRank <= 3 ? 'draw' : 'defeat';
        recordExerciseMatchResult(user.id, exerciseId, result, selfScore).then(() => {
          refreshProfile();
        });
      } else {
        const result =
          selfScore > opponentScore ? 'win' : selfScore === opponentScore ? 'draw' : 'defeat';
        recordExerciseMatchResult(user.id, exerciseId, result, selfScore).then(() => {
          refreshProfile();
        });
      }
    }
  }, [matchEnded, selfScore, opponentScore, user?.id, exerciseId, refreshProfile, mode, ffaLeaderboard, selfUsername]);

  // Request Camera Permissions & Setup WebSocket message listeners
  useEffect(() => {
    (async () => {
      try {
        if (Camera && Camera.requestCameraPermissionsAsync) {
          const { status } = await Camera.requestCameraPermissionsAsync();
          setHasPermission(status === 'granted');
        }
      } catch (e) {}
    })();

    const removeMatchListener = addMatchMessageListener(async (msg: any) => {
      if (msg.type === 'peer_ready') {
        setOpponentReady(true);
      }
      if (msg.type === 'ffa_ready_update') {
        if (typeof msg.ready_count === 'number') setFfaReadyCount(msg.ready_count);
        if (typeof msg.total_players === 'number') setFfaTotalPlayers(msg.total_players);
        if (msg.all_ready) {
          setOpponentReady(true);
        }
      }
      if (!matchEndedRef.current && msg.type === 'score' && typeof msg.score === 'number') {
        setOpponentScore(msg.score);
      }
      if (msg.type === 'ffa_leaderboard' && Array.isArray(msg.leaderboard)) {
        setFfaLeaderboard(msg.leaderboard);
      }
      if (msg.type === 'ffa_game_end' && Array.isArray(msg.leaderboard)) {
        setFfaLeaderboard(msg.leaderboard);
        if (!matchEndedRef.current) {
          matchEndedRef.current = true;
          setMatchEnded(true);
          setMatchPhase('match_ended');
          setTimeLeft(0);
        }
      }
      if (!matchEndedRef.current && mode === 'faceoff' && msg.type === 'frame' && msg.data) {
        if (!hasReceivedFirstOpponentFrame.current) {
          hasReceivedFirstOpponentFrame.current = true;
          setHasOpponentStream(true);
        }
        opponentWebViewRef.current?.injectJavaScript(`window.updateFrame && window.updateFrame('${msg.data}'); true;`);
      }

      if (msg.type === 'game_end') {
        if (!matchEndedRef.current) {
          matchEndedRef.current = true;
          setMatchEnded(true);
          setMatchPhase('match_ended');
          setTimeLeft(0);
        }
      }

      // Opponent left the match
      if (msg.type === 'opponent_left' || msg.type === 'match_leave' || msg.type === 'leave') {
        const currentPhase = matchPhaseRef.current;
        if (currentPhase === 'loading_resources' || currentPhase === 'setup_countdown') {
          // Camera adjustment / setup phase: Redirect without rating penalty
          Alert.alert(
            'Opponent Left 🚪',
            `@${opponentUsername} left during setup. Returning to exercise details.`,
            [{ text: 'OK', onPress: () => handleClose() }]
          );
        } else if (currentPhase === 'active_match') {
          // Active match: Opponent forfeit -> Opponent defeat, You WIN (+10 points)
          if (!recordedResultRef.current && user?.id) {
            recordedResultRef.current = true;
            matchEndedRef.current = true;
            await recordExerciseMatchResult(user.id, exerciseId, 'win', selfScore);
            await refreshProfile();
          }
          Alert.alert(
            'Victory by Forfeit! 🏆',
            `@${opponentUsername} forfeited the match! You won (+10 pts).`,
            [{ text: 'Great!', onPress: () => handleClose() }]
          );
        }
      }

      if (msg.type === 'rematch_request') {
        Alert.alert(
          'Rematch Request! ⚔️',
          `@${opponentUsername} wants to rematch in ${exerciseId === '3' ? 'Triangle Pose' : 'Squats'}!`,
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () => {
                sendMatchMessage({ type: 'rematch_declined', sender: selfUsername });
              },
            },
            {
              text: 'Accept ⚡',
              onPress: () => {
                sendMatchMessage({ type: 'rematch_accepted', sender: selfUsername });
                resetMatchState();
              },
            },
          ]
        );
      }

      if (msg.type === 'rematch_accepted') {
        Alert.alert('Rematch Accepted! 🔥', `@${opponentUsername} accepted the rematch! Starting now.`);
        resetMatchState();
      }

      if (msg.type === 'rematch_declined') {
        Alert.alert('Rematch Declined', `@${opponentUsername} declined the rematch.`);
      }
    });

    return () => {
      removeMatchListener();
    };
  }, [opponentUsername, mode, selfUsername, exerciseId]);

  // Automatic Fallback for Opponent Ready (e.g. offline bot or fast networks)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setOpponentReady(true);
    }, 4500);
    return () => clearTimeout(timeout);
  }, []);

  // Transition to 30s setup countdown when both resources are ready
  useEffect(() => {
    if (localReady && opponentReady && matchPhase === 'loading_resources') {
      setMatchPhase('setup_countdown');
      setSetupCount(30);
    }
  }, [localReady, opponentReady, matchPhase]);

  // When setup_countdown phase becomes active, run the animation sequence:
  // 1. Counter centered for 1.2s
  // 2. Counter shrinks & shifts smoothly to top (600ms)
  // 3. Guidance text smoothly scales and fades in
  useEffect(() => {
    if (matchPhase === 'setup_countdown') {
      setupPositionAnim.setValue(0);
      instructionAnim.setValue(0);

      const animTimeout = setTimeout(() => {
        Animated.sequence([
          Animated.timing(setupPositionAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.spring(instructionAnim, {
            toValue: 1,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1200);

      return () => clearTimeout(animTimeout);
    }
  }, [matchPhase, setupPositionAnim, instructionAnim]);

  // 30s Setup Countdown Timer
  useEffect(() => {
    if (matchPhase !== 'setup_countdown') return;

    const setupTimer = setInterval(() => {
      setSetupCount((prev) => {
        if (prev <= 1) {
          clearInterval(setupTimer);
          setMatchPhase('active_match');
          setTimeLeft(120);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(setupTimer);
  }, [matchPhase]);

  // 2 Minutes Match Duel Timer
  useEffect(() => {
    if (matchPhase !== 'active_match') return;

    const duelTimer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(duelTimer);
          matchEndedRef.current = true;
          setMatchEnded(true);
          setMatchPhase('match_ended');
          sendMatchMessage({ type: 'game_end', sender: selfUsername });
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(duelTimer);
  }, [matchPhase, selfUsername]);

  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        // When local MediaPipe completes model loading
        if (data.type === 'MODEL_READY') {
          setLocalReady(true);
          sendMatchMessage({ type: 'peer_ready' });
        }

        // Live pose visibility during camera adjustment mode
        if (data.type === 'POSE_VISIBILITY' && typeof data.visibility === 'number') {
          setVisibility(data.visibility);
        }

        if (
          !matchEndedRef.current &&
          mode === 'faceoff' &&
          data.type === 'camera_frame' &&
          data.frame
        ) {
          sendMatchMessage({ type: 'frame', data: data.frame });
        }

        if (matchPhaseRef.current === 'active_match' && !matchEndedRef.current && data.type === 'SQUAT_REP') {
          setSelfScore((current) => {
            const nextScore = current + 1;
            sendMatchMessage({ type: 'score', score: nextScore });
            return nextScore;
          });
        }
      } catch (e) {}
    },
    [mode]
  );

  // Widget Actions Handlers
  const handleFlipCamera = () => {
    webViewRef.current?.injectJavaScript('window.toggleFacingMode && window.toggleFacingMode(); true;');
  };

  const handleToggleOrientation = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
      }
    } catch (e) {
      console.warn('Orientation toggle error:', e);
    }
  };

  const handleClose = async (force: boolean = false) => {
    const currentPhase = matchPhaseRef.current;

    // If leaving during an active match, confirm defeat (-10 pts)
    if (!force && currentPhase === 'active_match' && !matchEndedRef.current) {
      Alert.alert(
        'Forfeit Match? ⚠️',
        'Leaving now counts as a Defeat (-10 pts) and awards victory to your opponent (+10 pts).',
        [
          { text: 'Stay & Fight', style: 'cancel' },
          {
            text: 'Forfeit (-10 pts)',
            style: 'destructive',
            onPress: async () => {
              // Send leave broadcast to opponent
              sendMatchMessage({ type: 'match_leave', sender: selfUsername });

              // Record Defeat for self
              if (!recordedResultRef.current && user?.id) {
                recordedResultRef.current = true;
                matchEndedRef.current = true;
                await recordExerciseMatchResult(user.id, exerciseId, 'defeat', selfScore);
                await refreshProfile();
              }

              try {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
              } catch (e) {}
              onClose();
            },
          },
        ]
      );
      return;
    }

    // Setup / Camera adjustment mode or match already ended: Leave without penalty
    sendMatchMessage({ type: 'match_leave', sender: selfUsername });

    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {}
    onClose();
  };

  const resetMatchState = () => {
    setSelfScore(0);
    setOpponentScore(0);
    setTimeLeft(120);
    setSetupCount(30);
    setMatchEnded(false);
    matchEndedRef.current = false;
    recordedResultRef.current = false;
    setupPositionAnim.setValue(0);
    instructionAnim.setValue(0);
    setMatchPhase('setup_countdown');

    setTimeout(() => {
      Animated.sequence([
        Animated.timing(setupPositionAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.spring(instructionAnim, {
          toValue: 1,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1200);
  };

  const handleRestartMatch = () => {
    sendMatchMessage({ type: 'rematch_request', sender: selfUsername });
    Alert.alert('Rematch Sent ⚔️', `Rematch request sent to @${opponentUsername}. Waiting for response...`);
  };

  const handleChallengeSamePlayer = async () => {
    if (!user?.id || !opponentUsername || opponentUsername === 'opponent') {
      Alert.alert('Challenge', 'Cannot challenge this opponent right now.');
      return;
    }
    const currentUsername =
      profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Athlete';
    try {
      await sendCustomBattleInvite(
        {
          id: user.id,
          username: currentUsername,
          avatar_config: profile?.avatar_config,
        },
        {
          id: `target_${opponentUsername}`,
          username: opponentUsername,
        },
        exerciseId,
        'Squats',
        mode === 'faceoff' ? 'faceoff' : 'quickjoin'
      );
      Alert.alert('Challenge Sent ⚔️', `Direct 1v1 battle invite sent to @${opponentUsername}!`);
    } catch (e: any) {
      Alert.alert('Challenge Sent ⚔️', `Direct challenge sent to @${opponentUsername}!`);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user?.id || !opponentUsername || opponentUsername === 'opponent') {
      Alert.alert('Friend Request', 'Cannot send friend request to this athlete.');
      return;
    }
    try {
      const res = await sendFriendRequest(user.id, opponentUsername);
      if (res.success) {
        Alert.alert('Friend Request Sent! 🎉', `Sent a friend request to @${opponentUsername}.`);
      } else {
        Alert.alert('Friend Request', res.error || 'Friend request already pending or sent.');
      }
    } catch (e: any) {
      Alert.alert('Friend Request', e?.message || 'Could not send friend request.');
    }
  };

  const htmlBundle = getPoseHtmlBundle(exerciseId || 'squats');

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Main Split / Full Camera Feeds */}
      {mode === 'quickjoin' || mode === 'ffa' ? (
        <View style={styles.yourContainerFull}>
          <WebView
            ref={webViewRef}
            source={{
              html: htmlBundle,
              baseUrl: 'https://cdn.jsdelivr.net',
            }}
            userAgent="MobilePoseApp/1.0"
            style={StyleSheet.absoluteFill}
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
      ) : (
        <View
          style={[
            styles.splitWrapper,
            {
              flexDirection: isLandscape ? 'row' : 'column',
              width: '100%',
              height: '100%',
            },
          ]}
        >
          {/* Left Half (Landscape) / Top Half (Portrait): Opponent's Real-time Frame */}
          <View
            style={[
              styles.opponentContainer,
              {
                width: isLandscape ? '50%' : '100%',
                height: isLandscape ? '100%' : '50%',
                borderRightWidth: isLandscape ? 2 : 0,
                borderRightColor: 'rgba(255, 255, 255, 0.15)',
                borderBottomWidth: isLandscape ? 0 : 2,
                borderBottomColor: 'rgba(255, 255, 255, 0.15)',
              },
            ]}
          >
            <WebView
              ref={opponentWebViewRef}
              source={{
                html: OPPONENT_STREAM_HTML,
              }}
              style={StyleSheet.absoluteFill}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              originWhitelist={['*']}
            />
            {!hasOpponentStream && (
              <View style={[StyleSheet.absoluteFill, styles.waitingOpponentBox]}>
                <ActivityIndicator size="small" color="#C8B6FF" />
                <Text style={styles.waitingOpponentText}>@{opponentUsername}</Text>
              </View>
            )}
          </View>

          {/* Right Half (Landscape) / Bottom Half (Portrait): User's Live Pose Tracker Camera */}
          <View
            style={[
              styles.yourContainer,
              {
                width: isLandscape ? '50%' : '100%',
                height: isLandscape ? '100%' : '50%',
              },
            ]}
          >
            <WebView
              ref={webViewRef}
              source={{
                html: htmlBundle,
                baseUrl: 'https://cdn.jsdelivr.net',
              }}
              userAgent="MobilePoseApp/1.0"
              style={StyleSheet.absoluteFill}
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
        </View>
      )}

      {/* OVERLAY 1: Resource Loading Indicator */}
      {matchPhase === 'loading_resources' && (
        <LoadingScreen
          title={mode === 'ffa' ? 'SYNCING ATHLETES' : 'SYNCING PLAYERS'}
          message={
            !localReady
              ? 'Loading AI pose tracking model...'
              : mode === 'ffa'
              ? ffaTotalPlayers > 0
                ? `Syncing players (${ffaReadyCount}/${ffaTotalPlayers} ready)...`
                : 'Syncing all lobby athletes...'
              : !opponentReady
              ? 'Waiting for opponent to connect...'
              : 'All players synchronized! Starting setup...'
          }
          fullScreen={false}
          onCancel={handleClose}
        />
      )}

      {/* OVERLAY 2: 30-Second Camera Setup with Center-to-Top Animation & Clean 1-2 Word Visibility Instruction */}
      {matchPhase === 'setup_countdown' && (() => {
        // Dynamic clean 1-2 word instruction based on visibility & countdown
        let instructionText = 'STEP BACK';
        let instructionColor = '#F87171'; // Red/Salmon
        let instructionBg = 'rgba(239, 68, 68, 0.35)';
        let instructionBorder = '#EF4444';

        if (setupCount <= 3) {
          instructionText = 'GET READY';
          instructionColor = '#E2F163';
          instructionBg = 'rgba(226, 241, 99, 0.35)';
          instructionBorder = '#E2F163';
        } else if (visibility >= 0.7) {
          instructionText = 'PERFECT';
          instructionColor = '#34D399'; // Emerald
          instructionBg = 'rgba(52, 211, 153, 0.35)';
          instructionBorder = '#10B981';
        } else if (visibility >= 0.35) {
          instructionText = 'MOVE BACK';
          instructionColor = '#FBBF24'; // Amber
          instructionBg = 'rgba(251, 191, 36, 0.35)';
          instructionBorder = '#F59E0B';
        }

        const centerTop = (windowHeight - 140) / 2;
        const targetTop = 18;

        const animatedTop = setupPositionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [centerTop, targetTop],
        });

        const animatedScale = setupPositionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.52],
        });

        // Guidance text smooth fade, scale, and subtle slide-in animation
        const instructionOpacity = instructionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 1],
        });

        const instructionScale = instructionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        });

        const instructionTranslateY = instructionAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [15, 0],
        });

        return (
          <View style={styles.countdownOverlay} pointerEvents="none">
            {/* Countdown Badge - Starts in center, becomes small and moves smoothly to top */}
            <Animated.View
              style={[
                styles.countdownCircleBadge,
                {
                  position: 'absolute',
                  top: animatedTop,
                  transform: [{ scale: animatedScale }],
                },
              ]}
            >
              <Text style={styles.countdownNumberText}>{setupCount}</Text>
            </Animated.View>

            {/* Guidance Text Card - Smoothly appears after counter reaches the top */}
            <Animated.View
              style={[
                styles.instructionPillCard,
                {
                  backgroundColor: instructionBg,
                  borderColor: instructionBorder,
                  opacity: instructionOpacity,
                  transform: [
                    { scale: instructionScale },
                    { translateY: instructionTranslateY },
                  ],
                },
              ]}
            >
              <Text style={[styles.instructionMainText, { color: instructionColor }]}>
                {instructionText}
              </Text>
            </Animated.View>
          </View>
        );
      })()}

      {/* Top HUD Scoreboard (Active during Match) */}
      {(matchPhase === 'active_match' || matchPhase === 'match_ended') && (
        <ScoreBoard
          mode={mode}
          selfScore={selfScore}
          opponentScore={opponentScore}
          timeLeft={timeLeft}
          ended={matchEnded}
          selfUsername={selfUsername}
          opponentUsername={opponentUsername}
          ffaLeaderboard={ffaLeaderboard}
        />
      )}

      {/* FLOATING DRAGGABLE ACTIONS WIDGET */}
      <DraggableActionsWidget
        onLeave={handleClose}
        onFlipCamera={handleFlipCamera}
        onToggleOrientation={handleToggleOrientation}
        onTryAgain={handleRestartMatch}
        onChallengeSamePlayer={handleChallengeSamePlayer}
        onSendFriendRequest={handleSendFriendRequest}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Draggable Actions Floating Widget
// ---------------------------------------------------------------------------
interface DraggableWidgetProps {
  onLeave: () => void;
  onFlipCamera: () => void;
  onToggleOrientation: () => void;
  onTryAgain: () => void;
  onChallengeSamePlayer: () => void;
  onSendFriendRequest: () => void;
}

const DraggableActionsWidget: React.FC<DraggableWidgetProps> = ({
  onLeave,
  onFlipCamera,
  onToggleOrientation,
  onTryAgain,
  onChallengeSamePlayer,
  onSendFriendRequest,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const defaultY = isLandscape
    ? Math.max(12, windowHeight - 64)
    : Math.max(12, windowHeight - 120);
  const defaultX = isLandscape
    ? Math.max(12, (windowWidth - 310) / 2)
    : 16;

  const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
  const [isExpanded, setIsExpanded] = useState(true);

  // Keep widget in visible bounds on orientation change
  useEffect(() => {
    pan.setValue({ x: defaultX, y: defaultY });
  }, [windowWidth, windowHeight, isLandscape, defaultX, defaultY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
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

  return (
    <Animated.View
      style={[
        styles.draggableContainer,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.widgetPillBox}>
        {/* Dumbbell Icon Floating Handle & Toggle */}
        <TouchableOpacity
          style={styles.dumbbellHandleBtn}
          activeOpacity={0.8}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Dumbbell size={18} color="#11141A" strokeWidth={2.5} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.actionButtonsRow}>
            {/* 1. Leave Match */}
            <TouchableOpacity
              style={[styles.widgetActionBtn, styles.leaveActionBtn]}
              activeOpacity={0.75}
              onPress={onLeave}
            >
              <LogOut size={16} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 2. Flip Camera */}
            <TouchableOpacity
              style={styles.widgetActionBtn}
              activeOpacity={0.75}
              onPress={onFlipCamera}
            >
              <SwitchCamera size={16} color="#11141A" />
            </TouchableOpacity>

            {/* 3. Rotate Orientation (Portrait / Landscape) */}
            <TouchableOpacity
              style={styles.widgetActionBtn}
              activeOpacity={0.75}
              onPress={onToggleOrientation}
            >
              <Smartphone size={16} color="#11141A" />
            </TouchableOpacity>

            {/* 4. Try Again / Rematch */}
            <TouchableOpacity
              style={styles.widgetActionBtn}
              activeOpacity={0.75}
              onPress={onTryAgain}
            >
              <RotateCcw size={16} color="#11141A" />
            </TouchableOpacity>

            {/* 5. Challenge Same Player */}
            <TouchableOpacity
              style={[styles.widgetActionBtn, styles.challengeActionBtn]}
              activeOpacity={0.75}
              onPress={onChallengeSamePlayer}
            >
              <Swords size={16} color="#11141A" />
            </TouchableOpacity>

            {/* 6. Send Friend Request */}
            <TouchableOpacity
              style={[styles.widgetActionBtn, styles.friendActionBtn]}
              activeOpacity={0.75}
              onPress={onSendFriendRequest}
            >
              <UserPlus size={16} color="#11141A" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------
const SELF_COLOR = '#E2F163'; // Neon lime from reference
const OPPONENT_COLOR = '#C8B6FF'; // Pastel lavender from reference
const WIN_COLOR = '#E2F163';
const LOSE_COLOR = '#FF6B6B';
const DRAW_COLOR = '#C8B6FF';
const NEUTRAL_TIMER_COLOR = '#FFFFFF';

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

function formatMatchTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const ScoreBoard: React.FC<{
  mode?: MatchMode;
  selfScore: number;
  opponentScore: number;
  timeLeft: number;
  ended: boolean;
  selfUsername?: string;
  opponentUsername?: string;
  ffaLeaderboard?: FFALeaderboardPlayer[];
}> = ({
  mode = 'faceoff',
  selfScore,
  opponentScore,
  timeLeft,
  ended,
  selfUsername = 'user',
  opponentUsername = 'opponent',
  ffaLeaderboard = [],
}) => {
  const selfScale = useBumpAnim(selfScore);
  const opponentScale = useBumpAnim(opponentScore);
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Build authoritative sorted FFA leaderboard including self
  const activeFfaList: FFALeaderboardPlayer[] = useMemo(() => {
    if (mode !== 'ffa') return [];
    const listMap = new Map<string, number>();
    listMap.set(selfUsername, selfScore);
    ffaLeaderboard.forEach((p) => {
      listMap.set(p.username, Math.max(p.score, listMap.get(p.username) || 0));
    });
    const result: FFALeaderboardPlayer[] = Array.from(listMap.entries()).map(([username, score]) => ({
      username,
      score,
    }));
    result.sort((a, b) => b.score - a.score);
    return result;
  }, [mode, selfUsername, selfScore, ffaLeaderboard]);

  const outcome: 'WIN' | 'LOSE' | 'DRAW' =
    selfScore > opponentScore ? 'WIN' : selfScore < opponentScore ? 'LOSE' : 'DRAW';
  const leader: 'self' | 'opponent' | null =
    selfScore === opponentScore ? null : selfScore > opponentScore ? 'self' : 'opponent';
  const urgent = !ended && timeLeft > 0 && timeLeft <= 10;

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
    : timeLeft <= 30
    ? DRAW_COLOR
    : NEUTRAL_TIMER_COLOR;

  if (mode === 'ffa') {
    const myRank = activeFfaList.findIndex((p) => p.username === selfUsername) + 1;

    return (
      <View style={styles.ffaScoreBoardContainer} pointerEvents="none">
        {/* Top Header: My Reps & Big Clean Timer */}
        <View style={styles.ffaTopBar}>
          <View style={styles.ffaMyStatsBadge}>
            <Text style={styles.ffaMyStatsLabel}>YOU (RANK {myRank || 1})</Text>
            <Text style={styles.ffaMyStatsScore}>{selfScore} REPS</Text>
          </View>

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
                {myRank === 1
                  ? 'VICTORY (+15)'
                  : myRank <= 3
                  ? `PODIUM #${myRank} (+10)`
                  : 'FINISHED (+5)'}
              </Text>
            ) : (
              <>
                <Text style={[styles.timerValue, { color: timerColor }]}>
                  {formatMatchTime(timeLeft)}
                </Text>
                <Text style={styles.timerUnit}>{timeLeft >= 60 ? 'MIN' : 'SEC'}</Text>
              </>
            )}
          </Animated.View>

          <View style={styles.ffaLobbyCountBadge}>
            <Text style={styles.ffaLobbyCountLabel}>ATHLETES</Text>
            <Text style={styles.ffaLobbyCountNum}>{activeFfaList.length} / 10</Text>
          </View>
        </View>

        {/* Live Clean FFA Leaderboard: Sorted highest reps on top (No boxes/emojis) */}
        <View style={styles.ffaLeaderboardCard}>
          <View style={styles.ffaLeaderboardHeaderRow}>
            <Text style={styles.ffaLeaderboardHeading}>LEADERBOARD</Text>
            <Text style={styles.ffaLeaderboardSub}>FREE FOR ALL</Text>
          </View>

          <ScrollView style={styles.ffaLeaderboardScroll} showsVerticalScrollIndicator={false}>
            {activeFfaList.map((player, idx) => {
              const isMe = player.username === selfUsername;
              const isTop = idx === 0;

              return (
                <View
                  key={player.username || idx}
                  style={[
                    styles.ffaLeaderboardRow,
                    isMe && styles.ffaLeaderboardRowMe,
                  ]}
                >
                  <Text style={[styles.ffaRankText, isTop && { color: '#E2F163' }, isMe && { color: '#E2F163' }]}>
                    #{idx + 1}
                  </Text>

                  <Text
                    style={[
                      styles.ffaPlayerUsername,
                      isMe && styles.ffaPlayerUsernameMe,
                      isTop && styles.ffaPlayerUsernameTop,
                    ]}
                    numberOfLines={1}
                  >
                    @{player.username} {isMe ? '(You)' : ''}
                  </Text>

                  <View style={styles.ffaPlayerScoreBox}>
                    <Text
                      style={[
                        styles.ffaPlayerScoreText,
                        isMe ? { color: '#E2F163' } : isTop ? { color: '#E2F163' } : { color: '#FFFFFF' },
                      ]}
                    >
                      {player.score}
                    </Text>
                    <Text style={styles.ffaPlayerScoreUnit}>reps</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  }

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
            <Text style={[styles.timerValue, { color: timerColor }]}>
              {formatMatchTime(timeLeft)}
            </Text>
            <Text style={styles.timerUnit}>{timeLeft >= 60 ? 'MIN' : 'SEC'}</Text>
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
  },
  splitWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  splitWrapperLandscape: {
    flexDirection: 'row',
  },
  yourContainerFull: {
    flex: 1,
  },
  opponentContainer: {
    flex: 1,
    backgroundColor: '#0C0F14',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  opponentContainerLandscape: {
    borderBottomWidth: 0,
    borderRightWidth: 2,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  opponentImage: {
    width: '100%',
    height: '100%',
  },
  waitingOpponentBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  waitingOpponentText: {
    color: '#8E95A0',
    fontSize: 12,
    fontWeight: '700',
  },
  yourContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  syncLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(12, 15, 20, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  syncLoadingCard: {
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    width: '80%',
    maxWidth: 280,
  },
  syncLoadingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 12,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  syncStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  syncStatusDotReady: {
    backgroundColor: '#E2F163',
  },
  syncStatusText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  countdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
  },
  countdownCircleBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(12, 15, 20, 0.75)',
    borderWidth: 4,
    borderColor: '#E2F163',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E2F163',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  countdownNumberText: {
    color: '#E2F163',
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 80,
  },
  instructionPillCard: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  instructionMainText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2.5,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  scoreBoard: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 80,
  },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 15, 20, 0.75)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  playerBadgeReverse: {
    flexDirection: 'row-reverse',
  },
  avatarWrap: {
    position: 'relative',
  },
  crown: {
    position: 'absolute',
    top: -12,
    left: 4,
    fontSize: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '900',
  },
  playerTextLeft: {
    marginLeft: 8,
  },
  playerTextRight: {
    marginRight: 8,
    alignItems: 'flex-end',
  },
  playerLabel: {
    color: '#8E95A0',
    fontSize: 9,
    fontWeight: '800',
  },
  playerScore: {
    fontSize: 18,
    fontWeight: '900',
  },
  timerBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 15, 20, 0.85)',
  },
  timerBadgeEnded: {
    width: undefined,
    height: undefined,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timerValue: {
    fontSize: 17,
    lineHeight: 19,
    fontWeight: '900',
  },
  timerUnit: {
    fontSize: 8,
    fontWeight: '800',
    color: '#8E95A0',
  },
  timerOutcome: {
    fontSize: 12,
    fontWeight: '900',
  },
  draggableContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 25,
  },
  widgetPillBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    gap: 6,
  },
  dumbbellHandleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2F163', // Neon lime dumbbell icon badge
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  widgetActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveActionBtn: {
    backgroundColor: '#EF4444',
  },
  challengeActionBtn: {
    backgroundColor: '#E2F163', // Neon lime
  },
  friendActionBtn: {
    backgroundColor: '#C8B6FF', // Soft lavender
  },
  ffaScoreBoardContainer: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    zIndex: 80,
    alignItems: 'flex-end',
  },
  ffaTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  ffaMyStatsBadge: {
    backgroundColor: 'rgba(12, 15, 20, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#E2F163',
  },
  ffaMyStatsLabel: {
    color: '#E2F163',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ffaMyStatsScore: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  ffaLobbyCountBadge: {
    backgroundColor: 'rgba(12, 15, 20, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'flex-end',
  },
  ffaLobbyCountLabel: {
    color: '#8E95A0',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ffaLobbyCountNum: {
    color: '#C8B6FF',
    fontSize: 13,
    fontWeight: '800',
  },
  ffaLeaderboardCard: {
    backgroundColor: 'rgba(12, 15, 20, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    maxHeight: 160,
    width: '56%',
    maxWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  ffaLeaderboardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 4,
    marginBottom: 4,
  },
  ffaLeaderboardHeading: {
    color: '#E2F163',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  ffaLeaderboardSub: {
    color: '#8E95A0',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ffaLeaderboardScroll: {
    maxHeight: 120,
  },
  ffaLeaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 5,
    borderRadius: 8,
    marginVertical: 1,
  },
  ffaLeaderboardRowMe: {
    backgroundColor: 'rgba(226, 241, 99, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(226, 241, 99, 0.3)',
  },
  ffaRankBadge: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  ffaRankText: {
    color: '#8E95A0',
    fontSize: 10,
    fontWeight: '900',
    marginRight: 6,
  },
  ffaPlayerUsername: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  ffaPlayerUsernameMe: {
    color: '#E2F163',
    fontWeight: '900',
  },
  ffaPlayerUsernameTop: {
    color: '#FDE047',
    fontWeight: '900',
  },
  ffaPlayerScoreBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  ffaPlayerScoreText: {
    fontSize: 13,
    fontWeight: '900',
  },
  ffaPlayerScoreUnit: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
  },
});
