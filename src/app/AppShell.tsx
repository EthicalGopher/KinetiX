import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

import { GetStartedScreen } from '../screens/GetStartedScreen';
import { HomeScreen } from '../components/HomeScreen';
import { AuthModal } from '../features/auth/components/AuthModal';
import { CameraScreen } from '../features/camera/components/CameraScreen';
import { MatchCameraScreen } from '../features/match/components/MatchCameraScreen';
import { TabBar } from '../components/TabBar';

import { Swords, Video, Zap, Check, X, Flame } from 'lucide-react-native';
import { Avatar } from '../components/Avatar';
import type { MainTab } from '../components/HomeScreen';
import type { ModelComplexity } from '../utils/deviceSpecs';
import { connectMatchSocket, disconnectMatchSocket } from '../utils/matchmaking';
import { supabase } from '../utils/supabase';
import { useUserStore } from '../store/userStore';
import {
  initBattleChannel,
  acceptCustomBattleInvite,
  declineCustomBattleInvite,
  BattleInvite,
} from '../utils/customBattleService';

export default function AppShell() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMatchCamera, setIsMatchCamera] = useState<boolean>(false);
  const [matchWaiting, setMatchWaiting] = useState<boolean>(false);
  const [opponentUsername, setOpponentUsername] = useState<string>('');
  const [matchMode, setMatchMode] = useState<'faceoff' | 'quickjoin'>('faceoff');
  const [matchExerciseId, setMatchExerciseId] = useState<string>('1');
  const [selectedModel, setSelectedModel] = useState<ModelComplexity>('medium');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [incomingInvite, setIncomingInvite] = useState<BattleInvite | null>(null);

  const [soloExerciseId, setSoloExerciseId] = useState<string>('1');
  const [soloExerciseName, setSoloExerciseName] = useState<string>('Squats');
  const { activeTab, setActiveTab, setUser } = useUserStore();

  // Listen for incoming 1v1 battle invites from friends
  useEffect(() => {
    if (!currentUser?.id) return;

    const cleanup = initBattleChannel(currentUser.id, (invite) => {
      setIncomingInvite(invite);
    });

    return () => {
      cleanup();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setUser(session.user);
      }
      setIsAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setUser(session.user);
        setShowAuthModal(false);
      } else if (_event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [setUser]);

  useEffect(() => {
    async function updateOrientation() {
      try {
        if (ScreenOrientation) {
          if (isFullscreen) {
            if (ScreenOrientation.unlockAsync) {
              await ScreenOrientation.unlockAsync();
            } else if (ScreenOrientation.lockAsync) {
              await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
            }
          } else {
            if (ScreenOrientation.lockAsync) {
              await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            }
          }
        }
      } catch (e) {
        // ignore orientation errors on unsupported devices
      }
    }

    updateOrientation();
  }, [isFullscreen]);

  const handleAcceptIncomingInvite = async () => {
    if (!incomingInvite) return;
    const currentUsername =
      currentUser?.user_metadata?.username ||
      currentUser?.email?.split('@')[0] ||
      'Player';

    const matchRoomId = await acceptCustomBattleInvite(incomingInvite, currentUsername);
    const opponent = incomingInvite.senderUsername;
    const mode = incomingInvite.mode;
    const exerciseId = incomingInvite.exerciseId;

    setIncomingInvite(null);

    // Connect to the room and open match camera
    connectMatchSocket(currentUsername, matchRoomId);
    setOpponentUsername(opponent);
    setMatchMode(mode);
    setMatchExerciseId(exerciseId);
    setIsMatchCamera(true);
    setIsFullscreen(true);
  };

  const handleDeclineIncomingInvite = async () => {
    if (!incomingInvite) return;
    await declineCustomBattleInvite(incomingInvite);
    setIncomingInvite(null);
  };

  if (isAuthLoading) {
    return (
      <SafeAreaProvider>
        <View style={[styles.container, styles.centerLoading]}>
          <ActivityIndicator size="large" color="#E2F163" />
          <Text style={styles.loadingText}>Initializing Ojas...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {!currentUser ? (
          <GetStartedScreen
            onGetStarted={() => {
              setAuthMode('signup');
              setShowAuthModal(true);
            }}
            onLogIn={() => {
              setAuthMode('signin');
              setShowAuthModal(true);
            }}
          />
        ) : isMatchCamera ? (
          <MatchCameraScreen
            key={`match-${matchMode}-${opponentUsername}-${matchExerciseId}`}
            selectedModel={selectedModel}
            mode={matchMode}
            opponentUsername={opponentUsername}
            selfUsername={currentUser?.user_metadata?.username || currentUser?.email || 'user'}
            exerciseId={matchExerciseId}
            onClose={() => {
              setIsMatchCamera(false);
              setIsFullscreen(false);
              setActiveTab('home');
              if (matchExerciseId) {
                useUserStore.getState().setSelectedExerciseId(matchExerciseId);
              }
            }}
          />
        ) : isFullscreen ? (
          <CameraScreen
            selectedModel={selectedModel}
            exerciseId={soloExerciseId}
            exerciseName={soloExerciseName}
            onClose={() => {
              setIsFullscreen(false);
              setActiveTab('home');
              if (soloExerciseId) {
                useUserStore.getState().setSelectedExerciseId(soloExerciseId);
              }
            }}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <HomeScreen
              activeTab={activeTab as MainTab}
              onTabChange={setActiveTab}
              onOpenCamera={(exerciseId?: string, exerciseName?: string) => {
                if (exerciseId) setSoloExerciseId(exerciseId);
                if (exerciseName) setSoloExerciseName(exerciseName);
                setIsFullscreen(true);
              }}
              onOpenMatchCamera={(opponent: string, mode: 'faceoff' | 'quickjoin', exerciseId?: string) => {
                setMatchWaiting(false);
                setOpponentUsername(opponent);
                setMatchMode(mode);
                if (exerciseId) setMatchExerciseId(exerciseId);
                setIsMatchCamera(true);
                setIsFullscreen(true);
              }}
              onEnterQueue={() => setMatchWaiting(true)}
              onCancelQueue={() => {
                disconnectMatchSocket();
                setMatchWaiting(false);
              }}
              onShowAuthModal={() => {
                setAuthMode('signin');
                setShowAuthModal(true);
              }}
              currentUser={currentUser}
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              onLogout={() => {
                setCurrentUser(null);
                setActiveTab('home');
              }}
            />

            <TabBar
              activeTab={activeTab}
              onTabPress={(tab) => setActiveTab(tab)}
              onProfilePress={() => {
                setActiveTab('profile');
              }}
            />
          </View>
        )}

        <AuthModal
          visible={showAuthModal}
          initialMode={authMode}
          onClose={() => setShowAuthModal(false)}
          onUserChange={(user) => {
            setCurrentUser(user);
            if (user) setShowAuthModal(false);
          }}
        />

        {matchWaiting && (
          <View style={styles.matchWaitingOverlay}>
            <View style={styles.matchWaitingCard}>
              <ActivityIndicator size="large" color="#E2F163" />
              <Text style={styles.matchWaitingTitle}>Finding Opponent</Text>
              <Text style={styles.matchWaitingDesc}>Waiting for another player to join...</Text>
              <TouchableOpacity
                style={styles.cancelQueueButton}
                activeOpacity={0.85}
                onPress={() => {
                  disconnectMatchSocket();
                  setMatchWaiting(false);
                }}
              >
                <Text style={styles.cancelQueueButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Incoming 1v1 Battle Challenge Modal */}
        {incomingInvite && (
          <View style={styles.incomingInviteOverlay}>
            <View style={styles.incomingInviteCard}>
              <View style={styles.incomingBadgePill}>
                <Swords size={13} color="#E2F163" />
                <Text style={styles.incomingBadgeText}>INCOMING 1V1 DUEL</Text>
              </View>

              <View style={styles.incomingAvatarWrapper}>
                <View style={styles.avatarGlowRing}>
                  <Avatar
                    username={incomingInvite.senderUsername}
                    size={72}
                    config={incomingInvite.senderAvatar}
                  />
                </View>
              </View>

              <Text style={styles.incomingSenderName}>
                @{incomingInvite.senderUsername}
              </Text>
              <Text style={styles.incomingChallengeText}>
                has challenged you to a 1v1{' '}
                <Text style={{ color: '#E2F163', fontWeight: '900' }}>
                  {incomingInvite.exerciseName}
                </Text>{' '}
                {incomingInvite.mode === 'faceoff' ? 'Live Camera Faceoff' : 'Score Duel'}!
              </Text>

              <View style={styles.incomingActionRow}>
                <TouchableOpacity
                  style={styles.incomingDeclineBtn}
                  activeOpacity={0.75}
                  onPress={handleDeclineIncomingInvite}
                >
                  <X size={15} color="#94A3B8" style={{ marginRight: 4 }} />
                  <Text style={styles.incomingDeclineText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.incomingAcceptBtn}
                  activeOpacity={0.85}
                  onPress={handleAcceptIncomingInvite}
                >
                  <Swords size={16} color="#0C0F14" style={{ marginRight: 6 }} />
                  <Text style={styles.incomingAcceptText}>ACCEPT BATTLE</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0F14',
  },
  matchWaitingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  matchWaitingCard: {
    backgroundColor: '#161B22',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  matchWaitingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  matchWaitingDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  cancelQueueButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
  },
  cancelQueueButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  centerLoading: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D111A',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
  },
  incomingInviteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 200,
  },
  incomingInviteCard: {
    backgroundColor: '#161B22',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 10,
  },
  incomingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(226, 241, 99, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(226, 241, 99, 0.35)',
    gap: 6,
    marginBottom: 16,
  },
  incomingBadgeText: {
    color: '#E2F163',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  incomingAvatarWrapper: {
    marginBottom: 12,
  },
  avatarGlowRing: {
    padding: 3,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: '#C8B6FF',
  },
  incomingSenderName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  incomingChallengeText: {
    color: '#94A3B8',
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  incomingActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    width: '100%',
  },
  incomingDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  incomingDeclineText: {
    color: '#94A3B8',
    fontSize: 13.5,
    fontWeight: '800',
  },
  incomingAcceptBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2F163',
    borderRadius: 18,
    paddingVertical: 14,
    shadowColor: '#E2F163',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  incomingAcceptText: {
    color: '#0C0F14',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
