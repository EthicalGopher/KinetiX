import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from '../components/Avatar';

interface ExerciseItem {
  id: string;
  name: string;
  category: 'all' | 'new' | 'strength' | 'cardio' | 'flexibility';
  icon: string;
  isFavorite?: boolean;
  isNew?: boolean;
  bgGradient?: string;
}

interface HomeFeedScreenProps {
  onlineCount: number;
  selectedModel: 'light' | 'medium' | 'high';
  onExerciseSelect: (exercise: ExerciseItem) => void;
  onSettingsPress: () => void;
  onOpenCamera: () => void;
  onBack: () => void;
}

export const HomeFeedScreen: React.FC<HomeFeedScreenProps> = ({
  onlineCount,
  selectedModel,
  onExerciseSelect,
  onSettingsPress,
  onOpenCamera,
  onBack,
}) => {
  const exercises: ExerciseItem[] = [
    { id: '1', name: 'Squats', category: 'strength', icon: '🏋️', isFavorite: true, isNew: true },
    { id: '2', name: 'Pushups', category: 'strength', icon: '💪', isFavorite: true },
    { id: '3', name: 'Lunges', category: 'strength', icon: '🦵' },
    { id: '4', name: 'Plank Hold', category: 'flexibility', icon: '⏱️', isFavorite: true },
    { id: '5', name: 'Jumping Jacks', category: 'cardio', icon: '⚡' },
  ];

  return (
    <ScrollView style={styles.feedScrollView} contentContainerStyle={styles.feedScrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>ONLINE/FAVORITES</Text>
        <Text style={styles.sectionHeaderArrow}>▼</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalAvatarRow}>
        <TouchableOpacity style={styles.avatarItem} activeOpacity={0.8}>
          <View style={[styles.avatarCircleLarge, styles.addFriendCircle]}>
            <Avatar username="add-friend" size={62} />
            <View style={styles.plusIconBadge}><Text style={styles.plusIconText}>+</Text></View>
          </View>
          <Text style={styles.avatarLabel} numberOfLines={1}>Add Fri...</Text>
        </TouchableOpacity>

        {exercises.slice(0, 4).map((item) => (
          <TouchableOpacity key={item.id} style={styles.avatarItem} activeOpacity={0.8} onPress={() => onExerciseSelect(item)}>
            <View style={styles.avatarCircleLarge}><Avatar username={item.name} size={62} /></View>
            <Text style={styles.avatarLabel} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderTitle}>FEATURED</Text>
        <Text style={styles.sectionHeaderArrow}>▲</Text>
      </View>

      <View style={styles.featuredCard}>
        <View style={styles.questHeaderRow}>
          <View style={styles.questIconCircle}><Text style={{ fontSize: 20 }}>🗡️</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.questSubTitle}>DAILY QUEST</Text>
            <Text style={styles.questTitle}>Win 2 Games</Text>
          </View>
          <View style={styles.questTimeRow}>
            <Text style={styles.questTimerText}>21H 39MIN</Text>
            <Text style={styles.questDetailsArrow}>DETAILS ▼</Text>
          </View>
        </View>

        <View style={styles.questProgressTrack}><View style={styles.questProgressFill} /></View>

        <View style={styles.questTaskItem}>
          <View style={styles.taskIconBox}><Text style={{ fontSize: 18 }}>🎮</Text></View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.taskTitle}>Win 1 Game</Text>
            <Text style={styles.taskSubtitle}>Play in Conversation</Text>
          </View>
          <TouchableOpacity style={styles.goButton} activeOpacity={0.8} onPress={() => onExerciseSelect(exercises[0])}>
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.questTaskItem}>
          <View style={styles.taskIconBox}><Text style={{ fontSize: 18 }}>🎮</Text></View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.taskTitle}>Win 1 Game</Text>
            <Text style={styles.taskSubtitle}>Play Private Game</Text>
          </View>
          <TouchableOpacity style={styles.goButton} activeOpacity={0.8} onPress={() => onExerciseSelect(exercises[1])}>
            <Text style={styles.goButtonText}>Go</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rewardsRow}>
          <Text style={styles.rewardsLabel}>Rewards</Text>
          <View style={styles.rewardPill}><Text style={{ fontSize: 14 }}>🪙</Text><Text style={styles.rewardText}>150 Coins</Text></View>
          <View style={styles.rewardPill}><Text style={{ fontSize: 14 }}>💎</Text><Text style={styles.rewardText}>100 Hype</Text></View>
        </View>
      </View>

      <TouchableOpacity style={styles.featuredCard} activeOpacity={0.9} onPress={() => onExerciseSelect(exercises[0])}>
        <View style={styles.aiCardAccentBar} />
        <View style={styles.aiCardBody}>
          <View style={styles.aiIconCircle}><Text style={{ fontSize: 26 }}>🤳</Text></View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.aiCardTitle}>Live Camera</Text>
            <Text style={styles.aiCardSubtitle}>Real-time MediaPipe joint tracking ({selectedModel})</Text>
          </View>
        </View>

        <View style={styles.aiCardFooter}>
          <TouchableOpacity style={styles.settingsPill} activeOpacity={0.8} onPress={(e) => { e.stopPropagation(); onSettingsPress(); }}>
            <Text style={styles.settingsPillText}>⚙️ Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.launchPill} activeOpacity={0.85} onPress={onOpenCamera}>
            <Text style={styles.launchPillText}>Open Camera →</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.feedItemRow} activeOpacity={0.8}>
        <View style={styles.feedAvatarCircle}><Avatar username="GCU boiiis" size={42} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.feedItemHeader}><Text style={styles.feedItemTitle}>👥 GCU boiiis</Text><Text style={styles.feedItemTime}>05/07/26</Text></View>
          <Text style={styles.feedItemSnippet}>You: Hi</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.feedItemRow} activeOpacity={0.8}>
        <View style={styles.feedAvatarCircle}><Avatar username="PlatoBot" size={42} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={styles.feedItemHeader}><Text style={styles.feedItemTitle}>PlatoBot</Text><Text style={styles.feedItemTime}>03/05/26</Text></View>
          <Text style={styles.feedItemSnippet} numberOfLines={1}>PlatoBot: You'll have more fun if you invite your friends...</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  feedScrollView: { flex: 1 },
  feedScrollContent: { paddingBottom: 20 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginTop: 18, marginBottom: 10 },
  sectionHeaderTitle: { color: '#94A3B8', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  sectionHeaderArrow: { color: '#94A3B8', fontSize: 12 },
  horizontalAvatarRow: { paddingHorizontal: 14, gap: 12 },
  avatarItem: { alignItems: 'center', width: 74 },
  avatarCircleLarge: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#182030', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  addFriendCircle: { position: 'relative' },
  plusIconBadge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  plusIconText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  avatarLabel: { color: '#E2E8F0', fontSize: 11, marginTop: 8 },
  featuredCard: { backgroundColor: '#182030', borderRadius: 20, marginHorizontal: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  questHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  questIconCircle: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  questSubTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  questTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', marginTop: 2 },
  questTimeRow: { alignItems: 'flex-end' },
  questTimerText: { color: '#93C5FD', fontSize: 10, fontWeight: '700' },
  questDetailsArrow: { color: '#94A3B8', fontSize: 10, marginTop: 4 },
  questProgressTrack: { height: 10, borderRadius: 8, backgroundColor: '#0F172A', overflow: 'hidden', marginTop: 14 },
  questProgressFill: { width: '62%', height: '100%', backgroundColor: '#2563EB', borderRadius: 8 },
  questTaskItem: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  taskIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  taskTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  taskSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  goButton: { backgroundColor: '#1D4ED8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  goButtonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  rewardsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 },
  rewardsLabel: { color: '#E2E8F0', fontWeight: '700', fontSize: 12 },
  rewardPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  rewardText: { color: '#F8FAFC', marginLeft: 6, fontSize: 12, fontWeight: '700' },
  aiCardAccentBar: { width: 4, height: 60, backgroundColor: '#60A5FA', borderRadius: 4 },
  aiCardBody: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  aiIconCircle: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#1E3A8A', alignItems: 'center', justifyContent: 'center' },
  aiCardTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  aiCardSubtitle: { color: '#CBD5E1', fontSize: 12, marginTop: 3 },
  aiCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  settingsPill: { backgroundColor: '#0F172A', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  settingsPillText: { color: '#E2E8F0', fontWeight: '700' },
  launchPill: { backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  launchPillText: { color: '#FFF', fontWeight: '800' },
  feedItemRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
  feedAvatarCircle: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  feedItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feedItemTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  feedItemTime: { color: '#94A3B8', fontSize: 11 },
  feedItemSnippet: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },
});
