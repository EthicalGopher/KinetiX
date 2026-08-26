import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { HomeScreen } from './src/components/HomeScreen';
import { CameraScreen } from './src/components/CameraScreen';

type Screen = 'home' | 'camera';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  useEffect(() => {
    // Lock app orientation to horizontal game-style landscape mode
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (e) {
        console.log('Error locking screen orientation:', e);
      }
    }
    lockLandscape();
  }, []);

  return (
    <View style={styles.container}>
      {currentScreen === 'home' ? (
        <HomeScreen onOpenCamera={() => setCurrentScreen('camera')} />
      ) : (
        <CameraScreen onClose={() => setCurrentScreen('home')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
