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

import type { MainTab } from '../components/HomeScreen';
import type { ModelComplexity } from '../utils/deviceSpecs';
import { disconnectMatchSocket } from '../utils/matchmaking';
import { supabase } from '../utils/supabase';

export default function AppShell() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMatchCamera, setIsMatchCamera] = useState<boolean>(false);
  const [matchWaiting, setMatchWaiting] = useState<boolean>(false);
  const [opponentUsername, setOpponentUsername] = useState<string>('');
  const [matchMode, setMatchMode] = useState<'faceoff' | 'quickjoin'>('faceoff');
  const [selectedModel, setSelectedModel] = useState<ModelComplexity>('medium');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
      }
      setIsAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        setShowAuthModal(false);
      } else if (_event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

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

  if (isAuthLoading) {
    return (
      <SafeAreaProvider>
        <View style={[styles.container, styles.centerLoading]}>
          <ActivityIndicator size="large" color="#0F766E" />
          <Text style={styles.loadingText}>Loading plato...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {!currentUser ? (
          /* Authentication Gatekeeper: User must sign up / log in to proceed */
          <View style={{ flex: 1 }}>
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
          </View>
        ) : isFullscreen ? (
          isMatchCamera ? (
            <MatchCameraScreen
              selectedModel={selectedModel}
              mode={matchMode}
              opponentUsername={opponentUsername}
              selfUsername={currentUser?.user_metadata?.username || currentUser?.email || 'user'}
              onClose={() => {
                setIsMatchCamera(false);
                setIsFullscreen(false);
                setActiveTab('home');
              }}
            />
          ) : (
            <CameraScreen
              selectedModel={selectedModel}
              onClose={() => {
                setIsFullscreen(false);
                setActiveTab('home');
              }}
            />
          )
        ) : (
          <View style={{ flex: 1 }}>
            <HomeScreen
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenCamera={() => {
                setIsFullscreen(true);
              }}
              onOpenMatchCamera={(opponent: string, mode: 'faceoff' | 'quickjoin') => {
                setMatchWaiting(false);
                setOpponentUsername(opponent);
                setMatchMode(mode);
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
            />

            <TabBar
              activeTab={activeTab}
              onTabPress={(tab) => setActiveTab(tab)}
              onProfilePress={() => {
                setAuthMode('signin');
                setShowAuthModal(true);
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
});
