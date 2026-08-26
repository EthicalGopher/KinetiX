import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Modal,
  LayoutChangeEvent,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system';
import Svg, { Line, Circle } from 'react-native-svg';

interface CameraScreenProps {
  onClose: () => void;
}

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

const DEFAULT_SERVER_IP = '192.168.29.110';
const DEFAULT_SERVER_PORT = '8000';

const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28],
  [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]
];

export const CameraScreen: React.FC<CameraScreenProps> = ({ onClose }) => {
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const device = useCameraDevice(facing);
  const { hasPermission, requestPermission } = useCameraPermission();

  const [serverIp, setServerIp] = useState<string>(DEFAULT_SERVER_IP);
  const [serverPort, setServerPort] = useState<string>(DEFAULT_SERVER_PORT);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [poseDetected, setPoseDetected] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const cameraRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isCapturingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const isStreamingRef = useRef<boolean>(true);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    isMountedRef.current = true;
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
      }
    };
  }, [serverIp, serverPort]);

  useEffect(() => {
    if (wsConnected && isStreaming) {
      triggerNextFrame();
    }
  }, [wsConnected, isStreaming]);

  const connectWebSocket = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    const wsUrl = `ws://${serverIp}:${serverPort}/ws`;
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setWsConnected(true);
        triggerNextFrame();
      };

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return;
        try {
          const data = JSON.parse(event.data);
          if (data.detected && data.landmarks && data.landmarks.length > 0) {
            setLandmarks(data.landmarks);
            setPoseDetected(true);
          } else {
            setLandmarks([]);
            setPoseDetected(false);
          }
          if (data.fps) {
            setFps(data.fps);
          }
        } catch (e) {}

        isCapturingRef.current = false;
        if (isMountedRef.current && isStreamingRef.current) {
          requestAnimationFrame(() => triggerNextFrame());
        }
      };

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setWsConnected(false);
        isCapturingRef.current = false;
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setWsConnected(false);
        isCapturingRef.current = false;
      };

      wsRef.current = ws;
    } catch (e) {
      setWsConnected(false);
    }
  };

  const triggerNextFrame = async () => {
    if (
      !isMountedRef.current ||
      !isStreamingRef.current ||
      isCapturingRef.current ||
      !cameraRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    try {
      isCapturingRef.current = true;

      const photo = await cameraRef.current.takeSnapshot({
        quality: 50,
      });

      if (isMountedRef.current && photo?.path) {
        const path = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
        const base64 = await FileSystem.readAsStringAsync(path, {
          encoding: 'base64',
        });

        if (
          isMountedRef.current &&
          base64 &&
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          wsRef.current.send(base64);
        } else {
          isCapturingRef.current = false;
        }
      } else {
        isCapturingRef.current = false;
      }
    } catch (e) {
      isCapturingRef.current = false;
      if (isMountedRef.current && isStreamingRef.current) {
        setTimeout(triggerNextFrame, 100);
      }
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const onLayoutContainer = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const handleClose = () => {
    isMountedRef.current = false;
    setIsStreaming(false);
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }
    onClose();
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar hidden />
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.permissionContent}>
          <View style={styles.permissionIconContainer}>
            <Text style={styles.permissionIconText}>📷</Text>
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionMessage}>
            Please grant camera permission to display front camera view with react-native-vision-camera.
          </Text>
          <TouchableOpacity
            style={styles.grantButton}
            activeOpacity={0.8}
            onPress={requestPermission}
          >
            <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (device == null) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>No camera device found...</Text>
      </View>
    );
  }

  const { width, height } = containerSize;

  return (
    <View style={styles.cameraContainer} onLayout={onLayoutContainer}>
      <StatusBar hidden />

      {/* Vision Camera Component */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        device={device}
        isActive={true}
      />

      {/* SVG Overlay: Real-time 33 MediaPipe pose landmarks */}
      {width > 0 && height > 0 && landmarks.length > 0 && (
        <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {POSE_CONNECTIONS.map(([startIdx, endIdx], idx) => {
            const start = landmarks[startIdx];
            const end = landmarks[endIdx];

            if (start && end) {
              const x1 = facing === 'front' ? (1 - start.x) * width : start.x * width;
              const y1 = start.y * height;
              const x2 = facing === 'front' ? (1 - end.x) * width : end.x * width;
              const y2 = end.y * height;

              return (
                <Line
                  key={`line-${idx}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#6366F1"
                  strokeWidth={4.5}
                  strokeLinecap="round"
                />
              );
            }
            return null;
          })}

          {landmarks.map((lm, idx) => {
            const cx = facing === 'front' ? (1 - lm.x) * width : lm.x * width;
            const cy = lm.y * height;

            return (
              <Circle
                key={`dot-${idx}`}
                cx={cx}
                cy={cy}
                r={6.5}
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            );
          })}
        </Svg>
      )}

      {/* Top Overlay Header */}
      <SafeAreaView style={styles.overlayHeader}>
        <TouchableOpacity style={styles.glassButton} activeOpacity={0.8} onPress={handleClose}>
          <Text style={styles.glassButtonText}>✕ Close</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleStreamButton,
            isStreaming ? styles.streamActiveBg : styles.streamInactiveBg,
          ]}
          activeOpacity={0.85}
          onPress={() => {
            if (!wsConnected) {
              setShowConfigModal(true);
            } else {
              const nextState = !isStreaming;
              setIsStreaming(nextState);
              if (nextState) {
                triggerNextFrame();
              }
            }
          }}
        >
          <Text style={styles.toggleStreamText}>
            {isStreaming ? `⚡ Vision Camera (${fps} FPS)` : '⚡ Stream Paused'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.glassButton} activeOpacity={0.8} onPress={toggleCameraFacing}>
          <Text style={styles.glassButtonText}>🔄 Flip</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom Status Indicator */}
      <SafeAreaView style={styles.overlayFooter}>
        <TouchableOpacity
          style={styles.statusPill}
          activeOpacity={0.85}
          onPress={() => setShowConfigModal(true)}
        >
          <View style={[styles.statusDot, { backgroundColor: wsConnected ? '#10B981' : '#F59E0B' }]} />
          <Text style={styles.statusPillText}>
            {isStreaming && poseDetected
              ? `🧍 Vision Camera Pose • ${fps} FPS`
              : isStreaming
              ? '🔍 Searching for Person in Frame...'
              : wsConnected
              ? 'Tap "Stream Paused" to Start'
              : `Tap to set Server IP (${serverIp}:${serverPort})`}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Server IP Config Modal */}
      <Modal visible={showConfigModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Configure Pose Server IP</Text>
            <Text style={styles.modalSubtitle}>
              Set your local computer IP address running Python server.py
            </Text>

            <Text style={styles.inputLabel}>Server IP Address:</Text>
            <TextInput
              style={styles.textInput}
              value={serverIp}
              onChangeText={setServerIp}
              placeholder="e.g. 192.168.29.110"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Server Port:</Text>
            <TextInput
              style={styles.textInput}
              value={serverPort}
              onChangeText={setServerPort}
              placeholder="8000"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.modalCloseButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={() => {
                  setShowConfigModal(false);
                  connectWebSocket();
                }}
              >
                <Text style={styles.modalSaveButtonText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#94A3B8',
    fontSize: 15,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  closeButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  permissionIconText: {
    fontSize: 36,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  grantButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  glassButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleStreamButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  streamActiveBg: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  streamInactiveBg: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  toggleStreamText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  overlayFooter: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusPillText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    fontSize: 14,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  modalCloseButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
  },
  modalCloseButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
