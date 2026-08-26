import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';

interface HomeScreenProps {
  onOpenCamera: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onOpenCamera }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" hidden />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Camera Test App</Text>
          <View style={styles.badgeContainer}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Landscape Game Mode</Text>
          </View>
        </View>
      </View>

      {/* Main Content / Card Section */}
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.85}
          onPress={onOpenCamera}
        >
          {/* Card Accent Top Bar */}
          <View style={styles.cardAccentBar} />

          <View style={styles.cardBody}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>🤳</Text>
            </View>

            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Test</Text>
              <Text style={styles.cardDescription}>
                Tap to open Front Camera with live MediaPipe Pose tracking
              </Text>
            </View>

            <View style={styles.actionPill}>
              <Text style={styles.actionPillText}>Open Camera →</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          React Native • Expo SDK 54 • MediaPipe WebSocket Pose Stream
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  badgeText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '80%',
    maxWidth: 580,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  cardAccentBar: {
    height: 5,
    backgroundColor: '#6366F1',
    width: '100%',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  iconText: {
    fontSize: 28,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  actionPill: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginLeft: 16,
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  footerText: {
    color: '#64748B',
    fontSize: 11,
  },
});
