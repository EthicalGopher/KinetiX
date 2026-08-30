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
        if (ScreenOrientation && ScreenOrientation.lockAsync) {
          if (isFullscreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
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
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Initializing plato...</Text>
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
            }}
          />
        ) : isFullscreen ? (
          <CameraScreen
            selectedModel={selectedModel}
            onClose={() => {
              setIsFullscreen(false);
              setActiveTab('home');
            }}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <HomeScreen
              activeTab={activeTab as MainTab}
              onTabChange={setActiveTab}
              onOpenCamera={() => {
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
              <ActivityIndicator size="large" color="#2563EB" />
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
                <Flame size={14} color="#F59E0B" />
                <Text style={styles.incomingBadgeText}>INCOMING 1V1 CHALLENGE</Text>
              </View>

              <View style={styles.incomingAvatarWrapper}>
                <Avatar
                  username={incomingInvite.senderUsername}
                  size={68}
                  config={incomingInvite.senderAvatar}
                />
              </View>

              <Text style={styles.incomingSenderName}>
                @{incomingInvite.senderUsername}
              </Text>
              <Text style={styles.incomingChallengeText}>
                has challenged you to a 1v1 <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{incomingInvite.exerciseName}</Text>{' '}
                {incomingInvite.mode === 'faceoff' ? 'Live Camera Faceoff' : 'Score Duel'}!
              </Text>

              <View style={styles.incomingActionRow}>
                <TouchableOpacity
                  style={styles.incomingDeclineBtn}
                  activeOpacity={0.8}
                  onPress={handleDeclineIncomingInvite}
                >
                  <X size={15} color="#EF4444" style={{ marginRight: 4 }} />
                  <Text style={styles.incomingDeclineText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.incomingAcceptBtn}
                  activeOpacity={0.85}
                  onPress={handleAcceptIncomingInvite}
                >
                  <Swords size={15} color="#000000" style={{ marginRight: 6 }} />
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
    backgroundColor: '#111622',
  },
  matchWaitingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  matchWaitingCard: {
    backgroundColor: '#182030',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: '#161F30',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  incomingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    gap: 6,
    marginBottom: 16,
  },
  incomingBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  incomingAvatarWrapper: {
    marginBottom: 10,
  },
  incomingSenderName: {
    color: '#60A5FA',
    fontSize: 18,
    fontWeight: '900',
  },
  incomingChallengeText: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  incomingActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  incomingDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  incomingDeclineText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  incomingAcceptBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 12,
  },
  incomingAcceptText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
