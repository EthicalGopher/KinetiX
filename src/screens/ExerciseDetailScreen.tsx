import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Camera,
  Check,
  ChevronRight,
  Flame,
  Gamepad2,
  Info,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react-native';
import { Avatar } from '../components/Avatar';
import { Header } from '../components/Header';
import { useUserStore } from '../store/userStore';
import {
  calculateLevel,
  fetchExerciseLeaderboard,
  fetchUserExerciseStats,
  ExerciseLeaderboardEntry,
  LevelInfo,
  UserExerciseStats,
} from '../utils/rankingService';
import { fetchFriends, FriendshipItem } from '../utils/friendService';
import {
  sendCustomBattleInvite,
  initBattleChannel,
  BattleMode,
  BattleInvite,
} from '../utils/customBattleService';

export interface ExerciseItem {
  id: string;
  name: string;
  category: 'all' | 'strength' | 'cardio' | 'flexibility';
  icon: string;
  description?: string;
  isFavorite?: boolean;
  bgGradient?: string;
}

interface ExerciseDetailScreenProps {
  exercise: ExerciseItem;
  detailTab: 'workouts' | 'shop' | 'leaderboard' | 'how_to_play';
  onBack: () => void;
  onJoinQueue: (exercise: ExerciseItem, queue: 'faceoff' | 'quick_start') => void;
  onDetailTabChange: (tab: 'workouts' | 'shop' | 'leaderboard' | 'how_to_play') => void;
  onStartCustomMatch?: (
    opponent: string,
    mode: 'faceoff' | 'quickjoin',
    exerciseId: string,
    customRoomId?: string
  ) => void;
}

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({
  exercise,
  detailTab,
  onBack,
  onJoinQueue,
  onDetailTabChange,
  onStartCustomMatch,
}) => {
  const { profile, user, refreshProfile } = useUserStore();
  const [exerciseStats, setExerciseStats] = useState<UserExerciseStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<ExerciseLeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Custom Challenge State & Modals
  const [showFriendChallengeModal, setShowFriendChallengeModal] = useState<boolean>(false);
  const [friends, setFriends] = useState<FriendshipItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedBattleMode, setSelectedBattleMode] = useState<BattleMode>('faceoff');
  const [customUsername, setCustomUsername] = useState<string>('');
  const [challengingFriendId, setChallengingFriendId] = useState<string | null>(null);
  const [activeSentInvite, setActiveSentInvite] = useState<BattleInvite | null>(null);
  const [inviteTimeoutSeconds, setInviteTimeoutSeconds] = useState<number>(30);
  const inviteTimerRef = useRef<any>(null);

  // Exercise-specific points and match counters
  const exercisePoints = exerciseStats?.points ?? 0;
  const exerciseMatchesPlayed = exerciseStats?.matches_played ?? 0;
  const exerciseMatchesWon = exerciseStats?.matches_won ?? 0;
  const exerciseReps = exerciseStats?.reps_completed ?? 0;
  const levelInfo: LevelInfo = calculateLevel(exercisePoints, exercise.name);

  const winRate =
    exerciseMatchesPlayed > 0
      ? Math.round((exerciseMatchesWon / exerciseMatchesPlayed) * 100)
      : 0;

  const loadExerciseData = useCallback(async () => {
    if (user?.id) {
      try {
        const stats = await fetchUserExerciseStats(user.id, exercise.id);
        setExerciseStats(stats);
      } catch (e) {
        console.warn('Failed to load user exercise stats:', e);
      }
    }
  }, [user?.id, exercise.id]);

  const loadLeaderboardData = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await fetchExerciseLeaderboard(exercise.id, 50);
      setLeaderboard(data);
    } catch (e) {
      console.warn('Failed to load exercise leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [exercise.id]);

  const loadFriendsList = useCallback(async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
    try {
      const list = await fetchFriends(user.id);
      setFriends(list);
    } catch (e) {
      console.warn('Failed to load friends:', e);
    } finally {
      setLoadingFriends(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadExerciseData();
    loadFriendsList();
  }, [loadExerciseData, loadFriendsList]);

  useEffect(() => {
    if (detailTab === 'leaderboard') {
      loadLeaderboardData();
    }
  }, [detailTab, loadLeaderboardData]);

  // Subscribe to responses for outgoing challenge invites
  useEffect(() => {
    if (!user?.id) return;

    const cleanup = initBattleChannel(
      user.id,
      undefined,
      (response) => {
        if (activeSentInvite && response.inviteId === activeSentInvite.id) {
          clearInterval(inviteTimerRef.current);
          if (response.accepted) {
            setActiveSentInvite(null);
            setShowFriendChallengeModal(false);
            if (onStartCustomMatch) {
              onStartCustomMatch(
                response.opponentUsername || activeSentInvite.receiverUsername,
                activeSentInvite.mode,
                exercise.id,
                response.matchRoomId || activeSentInvite.matchRoomId
              );
            } else {
              onJoinQueue(
                exercise,
                activeSentInvite.mode === 'faceoff' ? 'faceoff' : 'quick_start'
              );
            }
          } else {
            setActiveSentInvite(null);
            Alert.alert('Duel Declined', `@${activeSentInvite.receiverUsername} declined your battle invitation.`);
          }
        }
      }
    );

    return () => {
      cleanup();
      clearInterval(inviteTimerRef.current);
    };
  }, [user?.id, activeSentInvite, exercise, onStartCustomMatch, onJoinQueue]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshProfile(),
        loadExerciseData(),
        loadLeaderboardData(),
        loadFriendsList(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleChallengeFriend = async (targetFriend: { id: string; username: string }) => {
    if (!user?.id) return;
    const currentUsername =
      profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Athlete';

    setChallengingFriendId(targetFriend.id);
    try {
      const invite = await sendCustomBattleInvite(
        {
          id: user.id,
          username: currentUsername,
          avatar_config: profile?.avatar_config,
        },
        {
          id: targetFriend.id,
          username: targetFriend.username,
        },
        exercise.id,
        exercise.name,
        selectedBattleMode
      );

      setActiveSentInvite(invite);
      setInviteTimeoutSeconds(30);

      clearInterval(inviteTimerRef.current);
      inviteTimerRef.current = setInterval(() => {
        setInviteTimeoutSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(inviteTimerRef.current);
            setActiveSentInvite(null);
            Alert.alert('Invite Expired', `Battle challenge to @${targetFriend.username} timed out.`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert('Challenge Error', e?.message || 'Could not send battle challenge.');
    } finally {
      setChallengingFriendId(null);
    }
  };

  const handleChallengeByUsername = async () => {
    if (!customUsername.trim()) {
      Alert.alert('Missing Username', 'Please enter a valid athlete username to challenge.');
      return;
    }
    const targetUsername = customUsername.trim();

    const matchedFriend = friends.find(
      (f) => f.friend.username.toLowerCase() === targetUsername.toLowerCase()
    );

    if (matchedFriend) {
      handleChallengeFriend(matchedFriend.friend);
      setCustomUsername('');
      return;
    }

    handleChallengeFriend({
      id: `custom_${targetUsername}`,
      username: targetUsername,
    });
    setCustomUsername('');
  };

  const cancelOutgoingInvite = () => {
    clearInterval(inviteTimerRef.current);
    setActiveSentInvite(null);
  };

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
        <Text style={styles.devSubtitle}>
          We are working hard to bring you the {featureName} module.
        </Text>
        <TouchableOpacity style={styles.devBackButton} activeOpacity={0.8} onPress={onBack}>
          <Text style={styles.devBackButtonText}>← Return to Exercises</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.detailScreenContainer}>
      <Header
        leftAction={
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        }
      />

      {/* Per-Exercise Level & Points Banner Card */}
      <View style={styles.detailBannerCard}>
        <View style={styles.bannerRankRow}>
          <View style={styles.ratingBadge}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>{exercise.icon}</Text>
            <Text style={styles.ratingLabel}>{exercise.name} Score:</Text>
            <View style={styles.ratingNumBox}>
              <Text style={styles.ratingNumText}>{exercisePoints} PTS</Text>
            </View>
          </View>

          <View style={styles.scoreRulesPill}>
            <Text style={styles.scoreRulesText}>+10 Win • +5 Draw • -10 Loss</Text>
          </View>
        </View>

        {/* Dynamic Game Level Status & Badges */}
        <View style={styles.bannerStatsRow}>
          <View style={[styles.starLevelBadge, { borderColor: levelInfo.color }]}>
            <Text style={styles.levelBadgeEmoji}>{levelInfo.badge}</Text>
            <Text style={[styles.levelBadgeNumber, { color: levelInfo.color }]}>
              LVL {levelInfo.level}
            </Text>
          </View>

          <View style={styles.userRankInfo}>
            <View style={styles.rankTitleRow}>
              <Text style={styles.rankTitle}>{levelInfo.title}</Text>
              <View style={[styles.tierTag, { backgroundColor: levelInfo.color + '26' }]}>
                <Text style={[styles.tierTagText, { color: levelInfo.color }]}>
                  {exercise.name} {levelInfo.tier}
                </Text>
              </View>
            </View>
            <Text style={styles.playedWonStats}>
              Matches: {exerciseMatchesPlayed} • Won: {exerciseMatchesWon} ({winRate}% WR) • {exerciseReps} Reps
            </Text>
          </View>
        </View>

        {/* Level XP Progress Track for This Game */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>
              {exercise.name} Mastery ({levelInfo.progressPercent}%)
            </Text>
            <Text style={styles.progressSubLabel}>
              {levelInfo.level < 6
                ? `${levelInfo.pointsToNext} pts to Level ${levelInfo.level + 1}`
                : 'MAX LEVEL ⚡'}
            </Text>
          </View>

          <View style={styles.rankProgressTrack}>
            <View
              style={[
                styles.rankProgressFill,
                { width: `${levelInfo.progressPercent}%`, backgroundColor: levelInfo.color },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Sub Navigation Bar */}
      <View style={styles.detailSubNavTabBar}>
        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'workouts' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('workouts')}
        >
          <Swords
            size={13}
            color={detailTab === 'workouts' ? '#FFFFFF' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.detailSubTabText,
              detailTab === 'workouts' && styles.detailSubTabTextActive,
            ]}
          >
            PLAY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'leaderboard' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('leaderboard')}
        >
          <Trophy
            size={13}
            color={detailTab === 'leaderboard' ? '#FFFFFF' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.detailSubTabText,
              detailTab === 'leaderboard' && styles.detailSubTabTextActive,
            ]}
          >
            LEADERBOARD
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'how_to_play' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('how_to_play')}
        >
          <Info
            size={13}
            color={detailTab === 'how_to_play' ? '#FFFFFF' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.detailSubTabText,
              detailTab === 'how_to_play' && styles.detailSubTabTextActive,
            ]}
          >
            RULES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'shop' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('shop')}
        >
          <Gamepad2
            size={13}
            color={detailTab === 'shop' ? '#FFFFFF' : '#94A3B8'}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.detailSubTabText,
              detailTab === 'shop' && styles.detailSubTabTextActive,
            ]}
          >
            SHOP
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.detailScrollView}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
            colors={['#6366F1', '#2563EB']}
          />
        }
      >
        {detailTab === 'workouts' ? (
          <>
            <Text style={styles.matchmakingSectionHeader}>
              {exercise.name.toUpperCase()} QUEUES
            </Text>

            {/* QUEUE CARDS (Faceoff, Quick Start, Custom Friend Battle) */}
            {[
              {
                id: 'faceoff',
                title: `Faceoff (1v1)`,
                description: `Live video duel with both player cameras visible and real-time ${exercise.name} rep counting`,
                icon: '⚔️',
                actionText: 'PLAY',
                isFriendQueue: false,
              },
              {
                id: 'quick_start',
                title: `Quick Start (1v1)`,
                description: `Private 1v1 battle (score battle, camera video hidden for privacy)`,
                icon: '⚡',
                actionText: 'PLAY',
                isFriendQueue: false,
              },
              {
                id: 'custom_friend',
                title: `Friend Duel (1v1)`,
                description: `Challenge online friends to a direct 1v1 ${exercise.name} battle with camera or score`,
                icon: '👥',
                actionText: 'Play',
                isFriendQueue: true,
              },
            ].map((queue) => (
              <View key={queue.id} style={styles.queueItemCard}>
                <View style={styles.queueIconBox}>
                  <Text style={{ fontSize: 24 }}>{queue.icon}</Text>
                </View>
                <View style={styles.queueInfoBox}>
                  <View style={styles.queueTitleRow}>
                    <Text style={styles.queueTitleText}>{queue.title}</Text>
                  </View>
                  <Text style={styles.queueDescText}>{queue.description}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.joinButton,
                    queue.isFriendQueue && styles.friendChallengeButton,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (queue.isFriendQueue) {
                      setShowFriendChallengeModal(true);
                      loadFriendsList();
                    } else {
                      onJoinQueue(exercise, queue.id as 'faceoff' | 'quick_start');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.joinButtonText,
                      queue.isFriendQueue && styles.friendChallengeButtonText,
                    ]}
                  >
                    {queue.actionText}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : detailTab === 'leaderboard' ? (
          <View style={styles.leaderboardContainer}>
            {/* Top User Personal Ranking Summary for this Game */}
            <View style={styles.myRankCard}>
              <View style={styles.myRankLeft}>
                <Avatar
                  username={profile?.username || user?.email || 'user'}
                  size={46}
                  config={profile?.avatar_config}
                />
                <View style={styles.myRankInfo}>
                  <Text style={styles.myRankName}>
                    {profile?.full_name || profile?.username || 'You'} (You)
                  </Text>
                  <Text style={styles.myRankTier}>
                    {levelInfo.badge} {exercise.name} LVL {levelInfo.level} • {levelInfo.title}
                  </Text>
                </View>
              </View>

              <View style={styles.myRankRight}>
                <Text style={styles.myRankPoints}>{exercisePoints} PTS</Text>
                <Text style={styles.myRankSub}>
                  {exerciseMatchesWon}W / {exerciseMatchesPlayed}P
                </Text>
              </View>
            </View>

            {/* Standings Header for this Exercise */}
            <View style={styles.standingsHeaderRow}>
              <Text style={styles.standingsHeaderTitle}>
                🏆 {exercise.name.toUpperCase()} LEADERBOARD
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={loadLeaderboardData}>
                <Text style={styles.standingsRefreshText}>🔄 Refresh</Text>
              </TouchableOpacity>
            </View>

            {loadingLeaderboard ? (
              <View style={styles.centerLoadingBox}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.loadingLeaderboardText}>
                  Loading {exercise.name} rankings...
                </Text>
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyLeaderboardBox}>
                <Text style={{ fontSize: 32 }}>{exercise.icon}</Text>
                <Text style={styles.emptyLeaderboardTitle}>
                  No {exercise.name} Rankings Yet
                </Text>
                <Text style={styles.emptyLeaderboardDesc}>
                  Be the first athlete to duel in {exercise.name} and claim Rank #1!
                </Text>
              </View>
            ) : (
              <View style={styles.leaderboardListBox}>
                {leaderboard.map((entry, index) => {
                  const isTop1 = index === 0;
                  const isTop2 = index === 1;
                  const isTop3 = index === 2;
                  const entryLevel = calculateLevel(entry.points, exercise.name);
                  const isMe = user?.id && entry.user_id === user.id;

                  return (
                    <View
                      key={entry.user_id}
                      style={[
                        styles.leaderboardRowItem,
                        isTop1 && styles.top1Row,
                        isMe && styles.myHighlightRow,
                      ]}
                    >
                      {/* Rank Position */}
                      <View style={styles.rankBadgeBox}>
                        {isTop1 ? (
                          <Text style={styles.podiumEmoji}>🥇</Text>
                        ) : isTop2 ? (
                          <Text style={styles.podiumEmoji}>🥈</Text>
                        ) : isTop3 ? (
                          <Text style={styles.podiumEmoji}>🥉</Text>
                        ) : (
                          <Text style={styles.rankNumberText}>#{index + 1}</Text>
                        )}
                      </View>

                      {/* Avatar */}
                      <View style={styles.leaderboardAvatarWrapper}>
                        <Avatar
                          username={entry.username}
                          size={38}
                          config={entry.avatar_config}
                        />
                      </View>

                      {/* Username & Level */}
                      <View style={styles.leaderboardNameBox}>
                        <Text
                          style={[styles.leaderboardUsername, isMe && styles.myUsernameText]}
                          numberOfLines={1}
                        >
                          {entry.full_name || entry.username} {isMe ? '(You)' : ''}
                        </Text>
                        <Text style={styles.leaderboardSubText}>
                          {entryLevel.badge} LVL {entryLevel.level} • {entry.matches_won}W •{' '}
                          {entry.reps_completed} Reps
                        </Text>
                      </View>

                      {/* Points */}
                      <View style={styles.leaderboardScoreBox}>
                        <Text style={styles.leaderboardScoreNum}>{entry.points}</Text>
                        <Text style={styles.leaderboardScoreUnit}>PTS</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : detailTab === 'how_to_play' ? (
          <View style={styles.rulesContainer}>
            <View style={styles.tabInfoCard}>
              <Text style={styles.tabInfoTitle}>{exercise.name} Scoring Rules</Text>
              <View style={styles.rulePointRow}>
                <View style={[styles.rulePointBadge, { backgroundColor: '#10B981' }]}>
                  <Text style={styles.rulePointBadgeText}>+10 PTS</Text>
                </View>
                <Text style={styles.rulePointDesc}>Awarded for winning a {exercise.name} duel.</Text>
              </View>

              <View style={styles.rulePointRow}>
                <View style={[styles.rulePointBadge, { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.rulePointBadgeText}>+5 PTS</Text>
                </View>
                <Text style={styles.rulePointDesc}>Awarded to both players in a draw.</Text>
              </View>

              <View style={styles.rulePointRow}>
                <View style={[styles.rulePointBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.rulePointBadgeText}>-10 PTS</Text>
                </View>
                <Text style={styles.rulePointDesc}>Deducted on match defeat (floor: 0).</Text>
              </View>
            </View>

            <View style={styles.tabInfoCard}>
              <Text style={styles.tabInfoTitle}>{exercise.name} Level Tiers</Text>
              <View style={styles.tierGrid}>
                {[
                  { lvl: 'LVL 1', name: 'Rookie ', range: '0 - 99 pts' },
                  { lvl: 'LVL 2', name: 'Challenger ', range: '100 - 249 pts' },
                  { lvl: 'LVL 3', name: 'Warrior ', range: '250 - 499 pts' },
                  { lvl: 'LVL 4', name: 'Master ', range: '500 - 999 pts' },
                  { lvl: 'LVL 5', name: 'Champion ', range: '1,000 - 1,999 pts' },
                  { lvl: 'LVL 6', name: 'Grandmaster ', range: '2,000+ pts' },
                ].map((tier, i) => (
                  <View key={i} style={styles.tierCardItem}>
                    <Text style={styles.tierCardLvl}>{tier.lvl}</Text>
                    <Text style={styles.tierCardName}>{tier.name}</Text>
                    <Text style={styles.tierCardRange}>{tier.range}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.tabInfoCard}>
              <Text style={styles.tabInfoTitle}>Camera Positioning Guide</Text>
              <Text style={styles.tabInfoBody}>
                {[
                  '1. Stand 5-7 feet away from your camera in landscape orientation.',
                  '2. Ensure your full body is clearly visible in the video frame.',
                  '3. Perform each rep cleanly and with good form.',
                  '4. The MediaPipe AI pose tracker will automatically validate form and count repetitions.',
                ].join('\n\n')}
              </Text>
            </View>
          </View>
        ) : (
          renderUnderDevelopment('Item Shop & Upgrades')
        )}
      </ScrollView>

      {/* FRIEND CHALLENGE SELECTION MODAL */}
      <Modal
        visible={showFriendChallengeModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!activeSentInvite) setShowFriendChallengeModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.friendModalCard}>
            <View style={styles.friendModalHeader}>
              <View style={styles.btnRow}>
                <Users size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                <Text style={styles.friendModalTitle}>
                  CHALLENGE A FRIEND (1v1 {exercise.name.toUpperCase()})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  cancelOutgoingInvite();
                  setShowFriendChallengeModal(false);
                }}
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* If invite is currently sent and waiting */}
            {activeSentInvite ? (
              <View style={styles.waitingInsideModalBox}>
                <View style={styles.inviteWaitingIconBox}>
                  <Swords size={32} color="#F59E0B" />
                </View>
                <Text style={styles.inviteWaitingTitle}>Challenge Sent!</Text>
                <Text style={styles.inviteWaitingDesc}>
                  Invited <Text style={styles.highlightFriend}>@{activeSentInvite.receiverUsername}</Text> to a 1v1 {exercise.name}{' '}
                  {activeSentInvite.mode === 'faceoff' ? 'Faceoff' : 'Score Duel'}.
                </Text>
                <View style={styles.inviteTimerBox}>
                  <ActivityIndicator size="small" color="#6366F1" style={{ marginRight: 8 }} />
                  <Text style={styles.inviteTimerText}>
                    Waiting for response ({inviteTimeoutSeconds}s)...
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelInviteBtn}
                  activeOpacity={0.85}
                  onPress={cancelOutgoingInvite}
                >
                  <Text style={styles.cancelInviteBtnText}>Cancel Invitation</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Battle Mode Toggle */}
                <View style={styles.modeToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      selectedBattleMode === 'faceoff' && styles.modeToggleBtnActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedBattleMode('faceoff')}
                  >
                    <Video
                      size={14}
                      color={selectedBattleMode === 'faceoff' ? '#FFFFFF' : '#94A3B8'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.modeToggleText,
                        selectedBattleMode === 'faceoff' && styles.modeToggleTextActive,
                      ]}
                    >
                      Faceoff (Camera Duel)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeToggleBtn,
                      selectedBattleMode === 'quickjoin' && styles.modeToggleBtnActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setSelectedBattleMode('quickjoin')}
                  >
                    <Zap
                      size={14}
                      color={selectedBattleMode === 'quickjoin' ? '#FFFFFF' : '#94A3B8'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.modeToggleText,
                        selectedBattleMode === 'quickjoin' && styles.modeToggleTextActive,
                      ]}
                    >
                      Score Duel (Private)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Direct Challenge by Username Write-in */}
                <View style={styles.directChallengeRow}>
                  <View style={styles.directInputWrap}>
                    <Search size={14} color="#64748B" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.directInput}
                      placeholder="Challenge any athlete by @username..."
                      placeholderTextColor="#64748B"
                      value={customUsername}
                      onChangeText={setCustomUsername}
                      autoCapitalize="none"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.directSendBtn}
                    activeOpacity={0.85}
                    onPress={handleChallengeByUsername}
                    disabled={!customUsername.trim()}
                  >
                    <Send size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                {/* Friends List */}
                <Text style={styles.friendsSubHeader}>
                  YOUR FRIENDS ({friends.length})
                </Text>

                <ScrollView style={styles.friendsModalScroll} showsVerticalScrollIndicator={false}>
                  {loadingFriends ? (
                    <View style={styles.friendsLoadingBox}>
                      <ActivityIndicator size="small" color="#6366F1" />
                      <Text style={styles.friendsLoadingText}>Loading friends list...</Text>
                    </View>
                  ) : friends.length === 0 ? (
                    <View style={styles.emptyFriendsBox}>
                      <Users size={28} color="#64748B" style={{ marginBottom: 6 }} />
                      <Text style={styles.emptyFriendsTitle}>No Friends Added Yet</Text>
                      <Text style={styles.emptyFriendsSubtitle}>
                        Add friends in your Profile tab to send them instant 1v1 battle invites!
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.friendsRosterBox}>
                      {friends.map((item) => {
                        const isChallengingThis = challengingFriendId === item.friend.id;
                        return (
                          <View key={item.friendship_id} style={styles.friendRosterRow}>
                            <View style={styles.friendRosterAvatarWrap}>
                              <Avatar
                                username={item.friend.username}
                                size={40}
                                config={item.friend.avatar_config}
                              />
                              <View style={styles.onlineBadgeDot} />
                            </View>

                            <View style={styles.friendRosterInfo}>
                              <Text style={styles.friendRosterName} numberOfLines={1}>
                                {item.friend.full_name || item.friend.username}
                              </Text>
                              <Text style={styles.friendRosterUsername}>
                                @{item.friend.username}
                              </Text>
                            </View>

                            <TouchableOpacity
                              style={styles.challengeActionBtn}
                              activeOpacity={0.85}
                              onPress={() => handleChallengeFriend(item.friend)}
                              disabled={isChallengingThis}
                            >
                              {isChallengingThis ? (
                                <ActivityIndicator size="small" color="#000000" />
                              ) : (
                                <View style={styles.btnRow}>
                                  <Swords size={12} color="#000000" style={{ marginRight: 4 }} />
                                  <Text style={styles.challengeActionBtnText}>CHALLENGE</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  detailScreenContainer: { flex: 1, backgroundColor: '#0D111A' },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBannerCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  ratingLabel: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  ratingNumBox: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  ratingNumText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  scoreRulesPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  scoreRulesText: { color: '#A5B4FC', fontSize: 10, fontWeight: '800' },
  bannerStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  starLevelBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  levelBadgeEmoji: { fontSize: 20 },
  levelBadgeNumber: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  userRankInfo: { marginLeft: 14, flex: 1 },
  rankTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  tierTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierTagText: { fontSize: 10, fontWeight: '800' },
  playedWonStats: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  progressContainer: { marginTop: 14 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' },
  progressSubLabel: { color: '#818CF8', fontSize: 11, fontWeight: '700' },
  rankProgressTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  rankProgressFill: { height: '100%', borderRadius: 6 },
  detailSubNavTabBar: {
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  detailSubTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailSubTabItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  detailSubTabText: { color: '#94A3B8', fontSize: 10, fontWeight: '800' },
  detailSubTabTextActive: { color: '#FFFFFF' },
  detailScrollView: { flex: 1 },
  detailScrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  matchmakingSectionHeader: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 10,
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F30',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  queueIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  queueInfoBox: { flex: 1, marginLeft: 12, marginRight: 8 },
  queueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  queueTitleText: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  queueBadgePill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  queueBadgePillText: { color: '#FBBF24', fontSize: 9, fontWeight: '800' },
  queueDescText: { color: '#94A3B8', fontSize: 11, marginTop: 4, lineHeight: 15 },
  joinButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinButtonText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  friendChallengeButton: {
  },
  friendChallengeButtonText: {
    color: '#FFF',
  },
  leaderboardContainer: { marginTop: 14 },
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    marginBottom: 16,
  },
  myRankLeft: { flexDirection: 'row', alignItems: 'center' },
  myRankInfo: { marginLeft: 10 },
  myRankName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  myRankTier: { color: '#A5B4FC', fontSize: 11, fontWeight: '700', marginTop: 2 },
  myRankRight: { alignItems: 'flex-end' },
  myRankPoints: { color: '#38BDF8', fontSize: 16, fontWeight: '900' },
  myRankSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  standingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  standingsHeaderTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  standingsRefreshText: { color: '#A5B4FC', fontSize: 12, fontWeight: '700' },
  centerLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  loadingLeaderboardText: { color: '#94A3B8', fontSize: 12 },
  emptyLeaderboardBox: {
    alignItems: 'center',
    backgroundColor: '#161F30',
    borderRadius: 18,
    padding: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyLeaderboardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyLeaderboardDesc: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  leaderboardListBox: {
    backgroundColor: '#161F30',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  leaderboardRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  top1Row: { backgroundColor: 'rgba(245, 158, 11, 0.08)' },
  myHighlightRow: { backgroundColor: 'rgba(99, 102, 241, 0.12)' },
  rankBadgeBox: { width: 34, alignItems: 'center', justifyContent: 'center' },
  podiumEmoji: { fontSize: 20 },
  rankNumberText: { color: '#94A3B8', fontSize: 13, fontWeight: '800' },
  leaderboardAvatarWrapper: { marginLeft: 4, marginRight: 10 },
  leaderboardNameBox: { flex: 1 },
  leaderboardUsername: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  myUsernameText: { color: '#60A5FA', fontWeight: '800' },
  leaderboardSubText: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  leaderboardScoreBox: { alignItems: 'flex-end' },
  leaderboardScoreNum: { color: '#38BDF8', fontSize: 15, fontWeight: '900' },
  leaderboardScoreUnit: { color: '#64748B', fontSize: 9, fontWeight: '800' },
  rulesContainer: { marginTop: 14, gap: 12 },
  tabInfoCard: {
    backgroundColor: '#161F30',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabInfoTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  rulePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rulePointBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  rulePointBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  rulePointDesc: { color: '#CBD5E1', fontSize: 12, marginLeft: 12, flex: 1 },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierCardItem: {
    width: '48%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tierCardLvl: { color: '#818CF8', fontSize: 10, fontWeight: '800' },
  tierCardName: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', marginTop: 2 },
  tierCardRange: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  tabInfoBody: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  friendModalCard: {
    backgroundColor: '#161F30',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  friendModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  friendModalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  waitingInsideModalBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  inviteWaitingIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  inviteWaitingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  inviteWaitingDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  highlightFriend: {
    color: '#60A5FA',
    fontWeight: '800',
  },
  inviteTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  inviteTimerText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelInviteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
  },
  cancelInviteBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
    gap: 4,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  modeToggleBtnActive: {
    backgroundColor: '#2563EB',
  },
  modeToggleText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  directChallengeRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  directInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  directInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    paddingVertical: 8,
  },
  directSendBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsSubHeader: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  friendsModalScroll: {
    maxHeight: 220,
  },
  friendsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  friendsLoadingText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  emptyFriendsBox: {
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyFriendsTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyFriendsSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  friendsRosterBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  friendRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  friendRosterAvatarWrap: {
    position: 'relative',
  },
  onlineBadgeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  friendRosterInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  friendRosterName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  friendRosterUsername: {
    color: '#60A5FA',
    fontSize: 11,
    marginTop: 1,
  },
  challengeActionBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  challengeActionBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  devContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  devCard: {
    backgroundColor: '#161F30',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  devIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devIconText: { fontSize: 28 },
  devTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 16 },
  devPillTag: {
    marginTop: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  devPillTagText: { color: '#FBBF24', fontSize: 11, fontWeight: '700' },
  devSubtitle: { color: '#CBD5E1', textAlign: 'center', lineHeight: 22, marginTop: 14 },
  devBackButton: {
    marginTop: 18,
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  devBackButtonText: { color: '#FFF', fontWeight: '700' },
});
