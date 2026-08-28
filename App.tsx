import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/components/HomeScreen';
import { AuthModal } from './src/components/AuthModal';
import type { MainTab } from './src/components/HomeScreen';
import { CameraScreen } from './src/components/CameraScreen';
import { getDeviceInfo, getRecommendedModel, ModelComplexity } from './src/utils/deviceSpecs';
import * as ScreenOrientation from 'expo-screen-orientation';

import { FloatingCameraWidget } from './src/components/FloatingCameraWidget';

export default function App() {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelComplexity>('medium');
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

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
        {/* Fullscreen Camera Screen */}
        {isFullscreen ? (
          <CameraScreen
            selectedModel={selectedModel}
            onClose={() => {
              setIsFullscreen(false);
              setIsCameraActive(true);
            }}
          />
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
              onShowAuthModal={() => setShowAuthModal(true)}
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
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111622',
  },
});
