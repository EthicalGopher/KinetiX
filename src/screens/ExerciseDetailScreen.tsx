import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Header } from '../components/Header';

interface ExerciseItem {
  id: string;
  name: string;
  category: 'all' | 'new' | 'strength' | 'cardio' | 'flexibility';
  icon: string;
  isFavorite?: boolean;
  isNew?: boolean;
  bgGradient?: string;
}

interface ExerciseDetailScreenProps {
  exercise: ExerciseItem;
  detailTab: 'workouts' | 'shop' | 'leaderboard' | 'how_to_play';
  onBack: () => void;
  onJoinQueue: (exercise: ExerciseItem, queue: 'faceoff' | 'quick_start') => void;
  onDetailTabChange: (tab: 'workouts' | 'shop' | 'leaderboard' | 'how_to_play') => void;
}

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({
  exercise,
  detailTab,
  onBack,
  onJoinQueue,
  onDetailTabChange,
}) => {
  const renderUnderDevelopment = (featureName: string) => (
    <View style={styles.devContainer}>
      <View style={styles.devCard}>
        <View style={styles.devIconBadge}>
          <Text style={styles.devIconText}>🚧</Text>
        </View>
        <Text style={styles.devTitle}>{featureName}</Text>
        <View style={styles.devPillTag}>
          <Text style={styles.devPillTagText}>Under Development</Text>
        </View>
        <Text style={styles.devSubtitle}>We are working hard to bring you the {featureName} module.</Text>
        <TouchableOpacity style={styles.devBackButton} activeOpacity={0.8} onPress={onBack}>
          <Text style={styles.devBackButtonText}>← Return to Feed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.detailScreenContainer}>
      <Header
        leftAction={(
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        rightAction={(
          <TouchableOpacity style={styles.detailFavButton} activeOpacity={0.7}>
            <Text style={{ fontSize: 18 }}>{exercise.isFavorite ? '💙' : '🤍'}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.detailBannerCard}>
        <View style={styles.bannerRankRow}>
          <View style={styles.ratingBadge}>
            <Text style={{ fontSize: 13, marginRight: 4 }}>🛡️</Text>
            <Text style={styles.ratingLabel}>Ranked Rating:</Text>
            <View style={styles.ratingNumBox}>
              <Text style={styles.ratingNumText}>1200</Text>
            </View>
            <Text style={styles.infoIconText}>ℹ️</Text>
          </View>
        </View>

        <View style={styles.bannerStatsRow}>
          <View style={styles.starLevelBadge}>
            <Text style={{ fontSize: 14 }}>⭐ 1</Text>
          </View>

          <View style={styles.userRankInfo}>
            <Text style={styles.rankTitle}>Newbie</Text>
            <Text style={styles.playedWonStats}>Played: 0  Won: 0</Text>
          </View>
        </View>

        <View style={styles.rankProgressTrack}>
          <View style={styles.rankProgressFill} />
        </View>
      </View>

      <View style={styles.detailSubNavTabBar}>
        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'workouts' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('workouts')}
        >
          <Text style={[styles.detailSubTabText, detailTab === 'workouts' && styles.detailSubTabTextActive]}>WORKOUTS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'shop' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('shop')}
        >
          <Text style={[styles.detailSubTabText, detailTab === 'shop' && styles.detailSubTabTextActive]}>SHOP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'leaderboard' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('leaderboard')}
        >
          <Text style={[styles.detailSubTabText, detailTab === 'leaderboard' && styles.detailSubTabTextActive]}>LEADERBOARD</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'how_to_play' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('how_to_play')}
        >
          <Text style={[styles.detailSubTabText, detailTab === 'how_to_play' && styles.detailSubTabTextActive]}>HOW TO PLAY</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.detailScrollView} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
        {detailTab === 'workouts' ? (
          <>
            <Text style={styles.matchmakingSectionHeader}>EXERCISE QUEUES</Text>

            {[
              { id: 'faceoff', title: 'Faceoff', description: 'Live 1v1 video duel (both cameras visible)', icon: '⚔️' },
              { id: 'quick_start', title: 'Quick Start', description: '1v1 private match (score battle, cameras hidden)', icon: '⚡' },
            ].map((queue) => (
              <View key={queue.id} style={styles.queueItemCard}>
                <View style={styles.queueIconBox}>
                  <Text style={{ fontSize: 22 }}>{queue.icon}</Text>
                </View>
                <View style={styles.queueInfoBox}>
                  <View style={styles.queueTitleRow}>
                    <Text style={styles.queueTitleText}>{queue.title}</Text>
                    {queue.id === 'faceoff' && <Text style={styles.popularTagText}>LIVE 🔥</Text>}
                  </View>
                  <Text style={styles.queueDescText}>{queue.description} for {exercise.name}</Text>
                </View>
                <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => onJoinQueue(exercise, queue.id as 'faceoff' | 'quick_start')}>
                  <Text style={styles.joinButtonText}>PLAY</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : detailTab === 'leaderboard' ? (
          <View style={styles.tabInfoCard}>
            <Text style={styles.tabInfoTitle}>🏆 Global Leaderboard</Text>
            <View style={styles.leaderboardRow}><Text style={styles.rankPosText}>#1</Text><Text style={styles.rankNameText}>Alex_Pro</Text><Text style={styles.rankScoreText}>2,450 pts</Text></View>
            <View style={styles.leaderboardRow}><Text style={styles.rankPosText}>#2</Text><Text style={styles.rankNameText}>Sarah_Fit</Text><Text style={styles.rankScoreText}>2,310 pts</Text></View>
            <View style={styles.leaderboardRow}><Text style={styles.rankPosText}>#3</Text><Text style={styles.rankNameText}>You (chomuop)</Text><Text style={styles.rankScoreText}>1,200 pts</Text></View>
          </View>
        ) : detailTab === 'how_to_play' ? (
          <View style={styles.tabInfoCard}>
            <Text style={styles.tabInfoTitle}>📖 How to Play & Position Camera</Text>
            <Text style={styles.tabInfoBody}>{[
              '1. Stand 5-7 feet away from your phone camera in landscape mode.',
              '2. Ensure your full body is visible in the frame.',
              '3. Perform your exercise reps cleanly. The MediaPipe tracker will automatically count reps & analyze form accuracy.',
            ].join('\n')}</Text>
          </View>
        ) : (
          renderUnderDevelopment('Item Shop')
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  detailScreenContainer: { flex: 1, backgroundColor: '#111622' },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  detailPageTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  detailFavButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#172033', alignItems: 'center', justifyContent: 'center' },
  detailBannerCard: { backgroundColor: '#1E293B', borderRadius: 20, marginHorizontal: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  bannerRankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 },
  ratingLabel: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },
  ratingNumBox: { backgroundColor: '#1D4ED8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginHorizontal: 6 },
  ratingNumText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  infoIconText: { marginLeft: 6, fontSize: 12 },
  bannerStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  starLevelBadge: { backgroundColor: '#172033', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  userRankInfo: { marginLeft: 12 },
  rankTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  playedWonStats: { color: '#94A3B8', fontSize: 12 },
  rankProgressTrack: { marginTop: 16, height: 8, borderRadius: 8, backgroundColor: '#0F172A', overflow: 'hidden' },
  rankProgressFill: { width: '40%', height: '100%', backgroundColor: '#2563EB', borderRadius: 8 },
  detailSubNavTabBar: { flexDirection: 'row', marginTop: 14, paddingHorizontal: 14, gap: 6 },
  detailSubTabItem: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#172033', alignItems: 'center' },
  detailSubTabItemActive: { backgroundColor: '#1D4ED8' },
  detailSubTabText: { color: '#C7D2FE', fontSize: 10, fontWeight: '700' },
  detailSubTabTextActive: { color: '#FFF' },
  detailScrollView: { flex: 1 },
  detailScrollContent: { paddingHorizontal: 14, paddingBottom: 22 },
  matchmakingSectionHeader: { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 10 },
  queueItemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#182030', borderRadius: 18, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  queueIconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  queueInfoBox: { flex: 1, marginLeft: 12 },
  queueTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queueTitleText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  popularTagText: { color: '#F59E0B', fontSize: 10, fontWeight: '700' },
  queueDescText: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  joinButton: { backgroundColor: '#2563EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  joinButtonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  tabInfoCard: { backgroundColor: '#182030', borderRadius: 20, padding: 18, marginTop: 18 },
  tabInfoTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  leaderboardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rankPosText: { color: '#F8FAFC', fontWeight: '700' },
  rankNameText: { color: '#E2E8F0', flex: 1, marginLeft: 12 },
  rankScoreText: { color: '#93C5FD', fontWeight: '700' },
  tabInfoBody: { color: '#E2E8F0', fontSize: 13, lineHeight: 20 },
  devContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  devCard: { backgroundColor: '#182030', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
  devIconBadge: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center' },
  devIconText: { fontSize: 28 },
  devTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 16 },
  devPillTag: { marginTop: 10, backgroundColor: 'rgba(245, 158, 11, 0.2)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  devPillTagText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  devSubtitle: { color: '#CBD5E1', textAlign: 'center', lineHeight: 22, marginTop: 14 },
  devBackButton: { marginTop: 18, backgroundColor: '#2563EB', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  devBackButtonText: { color: '#FFF', fontWeight: '700' },
});
