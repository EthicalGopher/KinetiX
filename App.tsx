import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/components/HomeScreen';
import { AuthModal } from './src/components/AuthModal';
import type { MainTab } from './src/components/HomeScreen';
import { CameraScreen } from './src/components/CameraScreen';
import { MatchCameraScreen, type MatchMode } from './src/components/MatchCameraScreen';
import { getDeviceInfo, getRecommendedModel, ModelComplexity } from './src/utils/deviceSpecs';
import * as ScreenOrientation from 'expo-screen-orientation';

import { FloatingCameraWidget } from './src/components/FloatingCameraWidget';

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMatchCamera, setIsMatchCamera] = useState<boolean>(false);
  const [matchWaiting, setMatchWaiting] = useState<boolean>(false);
  const [opponentUsername, setOpponentUsername] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<ModelComplexity>('medium');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
      } catch (e) {}
    }
    updateOrientation();

    try {
      const info = getDeviceInfo();
      const rec = getRecommendedModel(info.totalMemoryGb);
      setSelectedModel(rec);
    } catch (e) {}
  }, [isFullscreen]);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {/* Fullscreen Camera or Match Camera */}
        {isFullscreen ? (
          isMatchCamera ? (
            <MatchCameraScreen
              selectedModel={selectedModel}
              opponentUsername={opponentUsername}
              selfUsername={currentUser?.email || 'user'}
              onClose={() => {
                setIsMatchCamera(false);
                setIsFullscreen(false);
              }}
            />
          ) : (
            <CameraScreen
              selectedModel={selectedModel}
              onClose={() => {
                setIsFullscreen(false);
                setIsCameraActive(true);
              }}
            />
          )
        ) : (
          <View style={{ flex: 1 }}>
            {/* Always keep HomeScreen active */}
            <HomeScreen
              isCameraActive={isCameraActive}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onOpenCamera={() => {
                setIsCameraActive(true);
                setIsFullscreen(true);
              }}
              onOpenMatchCamera={(opponent: string) => {
                setMatchWaiting(false);
                setOpponentUsername(opponent);
                setIsMatchCamera(true);
                setIsFullscreen(true);
              }}
              onEnterQueue={() => setMatchWaiting(true)}
              onCancelQueue={() => setMatchWaiting(false)}
               onShowAuthModal={() => setShowAuthModal(true)}
               currentUser={currentUser}
               selectedModel={selectedModel}
               onSelectModel={setSelectedModel}
            />

            {/* Draggable Floating Camera Blob Widget Overlay */}
            {isCameraActive && (
              <FloatingCameraWidget
                selectedModel={selectedModel}
                onClose={() => setIsCameraActive(false)}
                onExpandFullscreen={() => setIsFullscreen(true)}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onProfilePress={() => setShowAuthModal(true)}
              />
            )}
          </View>
        )}

        <AuthModal
          visible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onUserChange={setCurrentUser}
        />

        {/* Matchmaking Waiting Overlay */}
        {matchWaiting && (
          <View style={styles.matchWaitingOverlay}>
            <View style={styles.matchWaitingCard}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.matchWaitingTitle}>Finding Opponent</Text>
              <Text style={styles.matchWaitingDesc}>
                Waiting for another player to join...
              </Text>
              <TouchableOpacity
                style={styles.cancelQueueButton}
                activeOpacity={0.85}
                onPress={() => {
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
});
