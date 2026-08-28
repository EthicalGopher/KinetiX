import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { MainTab } from './HomeScreen';

interface FloatingCameraWidgetProps {
  onClose: () => void;
  selectedModel: 'light' | 'medium' | 'high';
  onExpandFullscreen?: () => void;
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onProfilePress: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const RAW_HOST = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.codequestpro.in';
const SERVER_HOST = RAW_HOST.replace(/\/+$/, '');

const TAB_ITEMS: { key: MainTab; icon: string }[] = [
  { key: 'home', icon: '🏠' },
  { key: 'explore', icon: '👓' },
  { key: 'workouts', icon: '🎮' },
  { key: 'social', icon: '👥' },
  { key: 'profile', icon: '🎒' },
];

export const FloatingCameraWidget: React.FC<FloatingCameraWidgetProps> = ({
  onClose,
  selectedModel,
  onExpandFullscreen,
  activeTab,
  onTabChange,
  onProfilePress,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const webViewRef = useRef<WebView | null>(null);

  // Initial floating position (Bottom Right)
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 240, y: SCREEN_HEIGHT - 280 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only set pan responder if user moves finger more than 4px (allows tapping buttons inside)
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
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

  const handleToggleFacingMode = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('window.toggleFacingMode && window.toggleFacingMode(); true;');
    }
  };

  const numericComplexity = selectedModel === 'light' ? 0 : selectedModel === 'high' ? 2 : 1;

  const handleWebViewLoad = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.setInitialComplexity && window.setInitialComplexity(${numericComplexity}); true;`);
    }
  };

  return (
    <Animated.View
      style={[
        styles.animatedWrapper,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Expanded Live Camera Preview PIP Window */}
      {isExpanded && (
        <View style={styles.pipCameraBox}>
          <WebView
            ref={webViewRef}
            source={{
              uri: `${SERVER_HOST}/pose`,
              headers: { 'ngrok-skip-browser-warning': 'true' },
            }}
            userAgent="MobilePoseApp/1.0"
            style={styles.pipWebView}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            onLoadEnd={handleWebViewLoad}
          />
          <TouchableOpacity style={styles.pipCloseOverlayBtn} onPress={() => setIsExpanded(false)}>
            <Text style={styles.pipCloseText}>↙ Minimize</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Draggable Control Blob matching Plato UI Screenshot */}
      <View style={styles.blobOuterContainer}>
        {/* Outfits Button (Bottom Left Pill) */}
        <TouchableOpacity
          style={styles.outfitPillButton}
          activeOpacity={0.8}
          onPress={() => setIsExpanded(!isExpanded)}
        >
          <Text style={{ fontSize: 18 }}>👕</Text>
        </TouchableOpacity>

        {/* Dark Organic Blob Container */}
        <View style={styles.blobCard}>
          {/* Top Satellite Row */}
          <View style={styles.satelliteTopRow}>
            {/* Snap / Gallery Icon */}
            <TouchableOpacity style={styles.satelliteIconBtn} activeOpacity={0.8} onPress={() => setIsExpanded(!isExpanded)}>
              <Text style={{ fontSize: 18 }}>🖼️</Text>
            </TouchableOpacity>

            {/* End / Close Session Button */}
            <TouchableOpacity style={[styles.satelliteIconBtn, styles.closePhoneBtn]} activeOpacity={0.8} onPress={onClose}>
              <Text style={{ fontSize: 16 }}>📞</Text>
            </TouchableOpacity>
          </View>

          {/* Center Content Row */}
          <View style={styles.satelliteCenterRow}>
            {/* Exercise / Ball Mode Icon */}
            <TouchableOpacity style={styles.satelliteIconBtn} activeOpacity={0.8} onPress={handleToggleFacingMode}>
              <Text style={{ fontSize: 18 }}>🔄</Text>
            </TouchableOpacity>

            {/* Main Blue Camera Video Button */}
            <TouchableOpacity
              style={styles.mainBlueCamButton}
              activeOpacity={0.85}
              onPress={() => {
                if (onExpandFullscreen) {
                  onExpandFullscreen();
                } else {
                  setIsExpanded(!isExpanded);
                }
              }}
            >
              <Text style={{ fontSize: 28 }}>📹</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Satellite Row */}
          <View style={styles.satelliteBottomRow}>
            {/* Audio / Voice Chat Button */}
            <TouchableOpacity
              style={styles.satelliteIconBtn}
              activeOpacity={0.8}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Text style={{ fontSize: 18 }}>{isMuted ? '🔇' : '🎧'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Tab Bar — moved from HomeScreen when camera is active */}
      <View style={styles.floatingTabBar}>
        {TAB_ITEMS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.floatingTabItem,
              activeTab === tab.key && styles.floatingTabItemActive,
            ]}
            activeOpacity={0.8}
            onPress={() => {
              if (tab.key === 'profile') {
                onProfilePress();
              } else {
                onTabChange(tab.key);
              }
            }}
          >
            <Text
              style={[
                styles.floatingTabIcon,
                activeTab === tab.key && styles.floatingTabIconActive,
              ]}
            >
              {tab.icon}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedWrapper: {
    position: 'absolute',
    zIndex: 999,
    alignItems: 'flex-end',
  },
  pipCameraBox: {
    width: 220,
    height: 160,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  pipWebView: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  pipCloseOverlayBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pipCloseText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  blobOuterContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  outfitPillButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#263346',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  blobCard: {
    backgroundColor: '#263346',
    padding: 10,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    minWidth: 140,
  },
  satelliteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 4,
  },
  satelliteCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  satelliteBottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  satelliteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePhoneBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  mainBlueCamButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 22, 34, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 10,
    minWidth: 220,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  floatingTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  floatingTabIcon: {
    fontSize: 18,
    color: '#718096',
  },
  floatingTabIconActive: {
    color: '#60A5FA',
  },
  floatingTabItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderRadius: 14,
    marginVertical: 2,
  },
});
