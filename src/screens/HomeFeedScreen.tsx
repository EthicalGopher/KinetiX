import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  ChevronRight,
  Flame,
  Gamepad2,
  Plus,
  Settings,
  Sparkles,
  Swords,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { Avatar } from '../components/Avatar';
import { useUserStore } from '../store/userStore';
import { fetchFriends, FriendshipItem } from '../utils/friendService';

export interface ExerciseItem {
  id: string;
  name: string;
  category: 'all' | 'strength' | 'cardio' | 'flexibility';
  icon: string;
  isFavorite?: boolean;
  bgGradient?: string;
  description?: string;
}

interface HomeFeedScreenProps {
  onlineCount: number;
  selectedModel: 'light' | 'medium' | 'high';
  onExerciseSelect: (exercise: ExerciseItem) => void;
  onSettingsPress: () => void;
  onOpenCamera: () => void;
  onNavigateToTab?: (tab: 'profile' | 'workouts') => void;
}

export const HomeFeedScreen: React.FC<HomeFeedScreenProps> = ({
  onlineCount,
  selectedModel,
  onExerciseSelect,
  onSettingsPress,
  onOpenCamera,
  onNavigateToTab,
}) => {
  const { user } = useUserStore();
  const [friends, setFriends] = useState<FriendshipItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState<boolean>(false);

  const defaultExercise: ExerciseItem = {
    id: '1',
    name: 'Squats',
    category: 'strength',
    icon: '🏋️',
    isFavorite: true,
    description: 'AI Real-time MediaPipe Pose Tracker for Parallel Depth & Rep Counting',
  };

  const loadFriendsList = useCallback(async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
    try {
      const list = await fetchFriends(user.id);
      setFriends(list);
    } catch (e) {
      console.warn('Failed to load friends on home feed:', e);
    } finally {
      setLoadingFriends(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFriendsList();
  }, [loadFriendsList]);

  return (
    <ScrollView
      style={styles.feedScrollView}
      contentContainerStyle={styles.feedScrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. ONLINE ATHLETES & FRIENDS SECTION */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.headerLeftRow}>
          <Users size={14} color="#818CF8" style={{ marginRight: 6 }} />
          <Text style={styles.sectionHeaderTitle}>ONLINE FRIENDS</Text>
        </View>

        <View style={styles.onlineBadgePill}>
          <View style={styles.pulseGreenDot} />
          <Text style={styles.onlineBadgeText}>{onlineCount} Online</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalAvatarRow}
      >
        {/* Add Friend Button */}
        <TouchableOpacity
          style={styles.avatarItem}
          activeOpacity={0.8}
          onPress={() => onNavigateToTab?.('profile')}
        >
          <View style={styles.addFriendCircle}>
            <UserPlus size={24} color="#60A5FA" />
            <View style={styles.plusIconBadge}>
              <Plus size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.avatarLabel} numberOfLines={1}>
            Add Friend
          </Text>
        </TouchableOpacity>

        {/* Real Friends List */}
        {friends.map((item) => (
          <TouchableOpacity
            key={item.friendship_id}
            style={styles.avatarItem}
            activeOpacity={0.8}
            onPress={() => onNavigateToTab?.('profile')}
          >
            <View style={styles.avatarWrapper}>
              <Avatar
                username={item.friend.username}
                size={58}
                config={item.friend.avatar_config}
              />
              <View style={styles.onlinePresenceDot} />
            </View>
            <Text style={styles.avatarLabel} numberOfLines={1}>
              {item.friend.username}
            </Text>
          </TouchableOpacity>
        ))}

        {/* If no friends yet, show helpful prompt athlete */}
        {friends.length === 0 && !loadingFriends && (
          <TouchableOpacity
            style={styles.avatarItem}
            activeOpacity={0.8}
            onPress={() => onNavigateToTab?.('profile')}
          >
            <View style={[styles.avatarWrapper, styles.placeholderFriendCircle]}>
              <Avatar username="plato_bot" size={58} />
              <View style={styles.onlinePresenceDot} />
            </View>
            <Text style={styles.avatarLabel} numberOfLines={1}>
              platoBot
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 2. DAILY FITNESS CHALLENGE */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.headerLeftRow}>
          <Flame size={15} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={styles.sectionHeaderTitle}>DAILY CHALLENGE</Text>
        </View>
      </View>

      <View style={styles.featuredCard}>
        <View style={styles.questHeaderRow}>
          <View style={styles.questIconCircle}>
            <Trophy size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.questSubTitle}>DAILY QUEST</Text>
            <Text style={styles.questTitle}>Complete 1 Duel</Text>
          </View>
          <View style={styles.questTimeRow}>
            <Text style={styles.questTimerText}>ACTIVE NOW</Text>
          </View>
        </View>

        <View style={styles.questProgressTrack}>
          <View style={styles.questProgressFill} />
        </View>

        <View style={styles.questTaskItem}>
          <View style={styles.taskIconBox}>
            <Swords size={18} color="#818CF8" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.taskTitle}>Squats 1v1 Battle</Text>
            <Text style={styles.taskSubtitle}>Test your parallel squat depth against opponents</Text>
          </View>
          <TouchableOpacity
            style={styles.goButton}
            activeOpacity={0.8}
            onPress={() => onExerciseSelect(defaultExercise)}
          >
            <Text style={styles.goButtonText}>PLAY</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3. AI POSE TRACKER LIVE CAMERA CARD */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.headerLeftRow}>
          <Sparkles size={15} color="#60A5FA" style={{ marginRight: 6 }} />
          <Text style={styles.sectionHeaderTitle}>AI POSE TRACKER</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.aiTrackerCard}
        activeOpacity={0.9}
        onPress={onOpenCamera}
      >
        <View style={styles.aiCardBody}>
          <View style={styles.aiIconCircle}>
            <Camera size={26} color="#60A5FA" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.aiCardTitle}>Practice Solo Camera</Text>
            <Text style={styles.aiCardSubtitle}>
              MediaPipe real-time joint skeleton & rep counter ({selectedModel})
            </Text>
          </View>
        </View>

        <View style={styles.aiCardFooter}>
          <TouchableOpacity
            style={styles.settingsPill}
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              onSettingsPress();
            }}
          >
            <Settings size={13} color="#94A3B8" style={{ marginRight: 4 }} />
            <Text style={styles.settingsPillText}>Settings</Text>
          </TouchableOpacity>

          <View style={styles.launchPill}>
            <Text style={styles.launchPillText}>Start Practice</Text>
            <ChevronRight size={14} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  feedScrollView: {
    flex: 1,
    backgroundColor: '#0D111A',
  },
  feedScrollContent: {
    paddingBottom: 32,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  onlineBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  pulseGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  horizontalAvatarRow: {
    paddingHorizontal: 16,
    gap: 14,
  },
  avatarItem: {
    alignItems: 'center',
    width: 66,
  },
  avatarWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderFriendCircle: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 30,
  },
  onlinePresenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0D111A',
  },
  addFriendCircle: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#161F30',
    borderWidth: 1.5,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  featuredCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  questHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questSubTitle: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  questTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 1,
  },
  questTimeRow: {
    alignItems: 'flex-end',
  },
  questTimerText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  questProgressTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    marginTop: 12,
  },
  questProgressFill: {
    width: '50%',
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  questTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  taskTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  taskSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  goButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  goButtonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  aiTrackerCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  aiCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  aiCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  aiCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingsPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  launchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  launchPillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
