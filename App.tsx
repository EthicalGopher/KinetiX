import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/components/HomeScreen';
import { CameraScreen } from './src/components/CameraScreen';
import { getDeviceInfo, getRecommendedModel, ModelComplexity } from './src/utils/deviceSpecs';
import * as ScreenOrientation from 'expo-screen-orientation';

type Screen = 'home' | 'camera';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedModel, setSelectedModel] = useState<ModelComplexity>('medium');

  useEffect(() => {
    async function lockLandscape() {
      try {
        if (ScreenOrientation && ScreenOrientation.lockAsync) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
      } catch (e) {}
    }
    lockLandscape();

    try {
      const info = getDeviceInfo();
      const rec = getRecommendedModel(info.totalMemoryGb);
      setSelectedModel(rec);
    } catch (e) {}
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        {currentScreen === 'home' ? (
          <HomeScreen
            onOpenCamera={() => setCurrentScreen('camera')}
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
          />
        ) : (
          <CameraScreen
            selectedModel={selectedModel}
            onClose={() => setCurrentScreen('home')}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
