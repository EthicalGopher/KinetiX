import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dumbbell, Flame, Sparkles } from 'lucide-react-native';

interface GetStartedScreenProps {
  onGetStarted: () => void;
  onLogIn: () => void;
}

export const GetStartedScreen: React.FC<GetStartedScreenProps> = ({
  onGetStarted,
  onLogIn,
}) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D111A" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Brand Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandTitle}>plato</Text>
        </View>

        {/* 3-Card Activity Gallery */}
        <View style={styles.galleryContainer}>
          {/* Card 1: Mobility & Yoga */}
          <View style={[styles.galleryCard, styles.cardLeft]}>
            <View style={styles.cardGlowGreen} />
            <View style={styles.cardTopBadge}>
              <Sparkles size={14} color="#34D399" />
            </View>
            <View style={styles.cardIconBox}>
              <Text style={styles.cardEmoji}>🧘‍♀️</Text>
            </View>
            <View style={styles.cardBottomLabel}>
              <Text style={styles.cardTagText}>MOBILITY</Text>
              <Text style={styles.cardTitleText}>Yoga & Core</Text>
            </View>
          </View>

          {/* Card 2: AI Strength Training (Featured Center) */}
          <View style={[styles.galleryCard, styles.cardCenter]}>
            <View style={styles.cardGlowBlue} />
            <View style={[styles.cardTopBadge, styles.badgeBlue]}>
              <Dumbbell size={14} color="#60A5FA" />
            </View>
            <View style={styles.cardIconBox}>
              <Text style={styles.cardEmojiCenter}>🏋️‍♂️</Text>
            </View>
            <View style={styles.cardBottomLabel}>
              <Text style={[styles.cardTagText, styles.tagBlue]}>AI TRACKING</Text>
              <Text style={styles.cardTitleText}>Gym & Strength</Text>
            </View>
          </View>

          {/* Card 3: 1v1 Battles & Cardio */}
          <View style={[styles.galleryCard, styles.cardRight]}>
            <View style={styles.cardGlowPurple} />
            <View style={[styles.cardTopBadge, styles.badgePurple]}>
              <Flame size={14} color="#F472B6" />
            </View>
            <View style={styles.cardIconBox}>
              <Text style={styles.cardEmoji}>🏃‍♀️</Text>
            </View>
            <View style={styles.cardBottomLabel}>
              <Text style={[styles.cardTagText, styles.tagPurple]}>1v1 DUEL</Text>
              <Text style={styles.cardTitleText}>Cardio Battles</Text>
            </View>
          </View>
        </View>

        {/* Bottom Welcome Info */}
        <View style={styles.infoSection}>
          <Text style={styles.welcomeHeading}>Welcome to plato</Text>
          <Text style={styles.welcomeDescription}>
            Unlock a complete AI-powered fitness experience. Real-time form tracking,
            1v1 multiplayer workouts, and holistic training for a healthier, stronger you.
          </Text>

          {/* Primary Action Button */}
          <TouchableOpacity
            style={styles.getStartedButton}
            activeOpacity={0.88}
            onPress={onGetStarted}
          >
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </TouchableOpacity>

          {/* Carousel Indicator Dots */}
          <View style={styles.dotsContainer}>
            <View style={styles.dotInactive} />
            <View style={styles.dotActive} />
            <View style={styles.dotInactive} />
          </View>

          {/* Log In Link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginQuestion}>Already have an account? </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onLogIn}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D111A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  brandHeader: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 20,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  galleryContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 310,
    marginVertical: 10,
    gap: 8,
  },
  galleryCard: {
    flex: 1,
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  cardLeft: {
    transform: [{ translateY: 10 }],
    backgroundColor: '#13202E',
  },
  cardCenter: {
    transform: [{ translateY: -10 }],
    height: '105%',
    backgroundColor: '#182740',
    borderColor: 'rgba(96, 165, 250, 0.35)',
    zIndex: 5,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  cardRight: {
    transform: [{ translateY: 10 }],
    backgroundColor: '#20162E',
  },
  cardGlowGreen: {
    position: 'absolute',
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  cardGlowBlue: {
    position: 'absolute',
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
  },
  cardGlowPurple: {
    position: 'absolute',
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(236, 72, 153, 0.14)',
  },
  cardTopBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 6,
    borderRadius: 12,
  },
  badgeBlue: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  badgePurple: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
  },
  cardIconBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardEmoji: {
    fontSize: 42,
  },
  cardEmojiCenter: {
    fontSize: 52,
  },
  cardBottomLabel: {
    alignItems: 'center',
    width: '100%',
    paddingBottom: 6,
  },
  cardTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  tagBlue: {
    color: '#60A5FA',
  },
  tagPurple: {
    color: '#F472B6',
  },
  cardTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  infoSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  welcomeHeading: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  welcomeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 12,
    marginBottom: 26,
  },
  getStartedButton: {
    backgroundColor: '#0F766E',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    gap: 6,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
  },
  dotActive: {
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F766E',
  },
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  loginQuestion: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  loginLink: {
    color: '#14B8A6',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
