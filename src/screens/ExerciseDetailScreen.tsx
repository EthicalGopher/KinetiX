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
  ArrowLeft,
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
import { ExerciseIcon } from '../components/ExerciseIcon';
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
  image_url?: string;
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
  onOpenCamera?: (exerciseId?: string, exerciseName?: string) => void;
}

export const ExerciseDetailScreen: React.FC<ExerciseDetailScreenProps> = ({
  exercise,
  detailTab,
  onBack,
  onJoinQueue,
  onDetailTabChange,
  onStartCustomMatch,
  onOpenCamera,
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

  return (
    <View style={styles.detailScreenContainer}>
      <Header
        leftAction={
          <TouchableOpacity style={styles.backButtonCircle} activeOpacity={0.8} onPress={onBack}>
            <ArrowLeft size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      {/* HERO BANNER CARD (Neon Lime & Lavender Highlight Theme) */}
      <View style={styles.detailBannerCard}>
        <View style={styles.bannerTopRow}>
          <View style={styles.ratingBadge}>
            <ExerciseIcon
              imageUrl={exercise.image_url}
              icon={exercise.icon}
              size={22}
              fontSize={16}
              containerStyle={{ marginRight: 6 }}
            />
            <Text style={styles.ratingLabel}>{exercise.name} Score</Text>
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
          <View style={styles.starLevelBadge}>
            <Text style={styles.levelBadgeEmoji}>{levelInfo.badge}</Text>
            <Text style={styles.levelBadgeNumber}>LVL {levelInfo.level}</Text>
          </View>

          <View style={styles.userRankInfo}>
            <View style={styles.rankTitleRow}>
              <Text style={styles.rankTitle}>{levelInfo.title}</Text>
              <View style={styles.tierTag}>
                <Text style={styles.tierTagText}>
                  {exercise.name} {levelInfo.tier}
                </Text>
              </View>
            </View>
            <Text style={styles.playedWonStats}>
              {exerciseMatchesPlayed} Matches • {exerciseMatchesWon} Wins ({winRate}% WR) • {exerciseReps} Reps
            </Text>
          </View>
        </View>

        {/* Level XP Progress Track */}
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
                { width: `${levelInfo.progressPercent}%` },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Sub Navigation Bar (Pill selector from reference) */}
      <View style={styles.detailSubNavTabBar}>
        <TouchableOpacity
          style={[styles.detailSubTabItem, detailTab === 'workouts' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => onDetailTabChange('workouts')}
        >
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
            tintColor="#E2F163"
            colors={['#E2F163', '#C8B6FF']}
          />
        }
      >
        {detailTab === 'workouts' ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.matchmakingSectionHeader}>
                {exercise.name.toUpperCase()} QUEUES
              </Text>
            </View>

            {/* QUEUE CARDS IN REFERENCE WORKOUT PLAN STYLE */}
            {[
              {
                id: 'solo_practice',
                title: `${exercise.name} Solo Practice`,
                description: `On-device AI pose tracking with real-time joint feedback & form coaching`,
                icon: '🎯',
                actionText: 'START',
                isFriendQueue: false,
                isSoloMode: true,
                bgTheme: 'dark',
              },
              {
                id: 'faceoff',
                title: `${exercise.name} Faceoff (1v1)`,
                description: `Live video duel with camera feed and AI parallel depth rep counting`,
                icon: '⚔️',
                actionText: 'PLAY',
                isFriendQueue: false,
                isSoloMode: false,
                bgTheme: 'dark',
              },
              {
                id: 'quick_start',
                title: `${exercise.name} Quick Start (1v1)`,
                description: `Private 1v1 score duel`,
                icon: '⚡',
                actionText: 'PLAY',
                isFriendQueue: false,
                isSoloMode: false,
                bgTheme: 'dark',
              },
              {
                id: 'custom_friend',
                title: `${exercise.name} Friend Duel (1v1)`,
                description: `Challenge online friends to a direct 1v1 ${exercise.name} battle`,
                icon: '👥',
                actionText: 'PLAY',
                isFriendQueue: true,
                isSoloMode: false,
                bgTheme: 'dark',
              },
            ].map((queue) => {
              const isLavender = queue.bgTheme === 'lavender';
              return (
                <View
                  key={queue.id}
                  style={[
                    styles.queueItemCard,
                    isLavender && styles.queueItemCardLavender,
                  ]}
                >
                  <View style={[styles.queueIconBox, isLavender && styles.queueIconBoxLavender]}>
                    <Text style={{ fontSize: 24 }}>{queue.icon}</Text>
                  </View>

                  <View style={styles.queueInfoBox}>
                    <View style={styles.queueTitleRow}>
                      <Text
                        style={[
                          styles.queueTitleText,
                          isLavender && styles.queueTitleTextLavender,
                        ]}
                      >
                        {queue.title}
                      </Text>
                      {queue.isSoloMode && (
                        <View style={styles.soloBadgePill}>
                          <Text style={styles.soloBadgePillText}>SOLO</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.queueDescText,
                        isLavender && styles.queueDescTextLavender,
                      ]}
                    >
                      {queue.description}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.joinButton,
                      queue.isSoloMode && styles.soloJoinButton,
                      isLavender && styles.joinButtonLavender,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (queue.isSoloMode) {
                        if (onOpenCamera) {
                          onOpenCamera(exercise.id, exercise.name);
                        }
                      } else if (queue.isFriendQueue) {
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
                        queue.isSoloMode && styles.soloJoinButtonText,
                        isLavender && styles.joinButtonTextLavender,
                      ]}
                    >
                      {queue.actionText}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        ) : detailTab === 'leaderboard' ? (
          <View style={styles.leaderboardContainer}>
            {/* My Rank Summary */}
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

            {/* Standings List */}
            <View style={styles.standingsHeaderRow}>
              <Text style={styles.standingsHeaderTitle}>
                🏆 {exercise.name.toUpperCase()} LEADERBOARD
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={loadLeaderboardData}>
                <Text style={styles.standingsRefreshText}>Refresh 🔄</Text>
              </TouchableOpacity>
            </View>

            {loadingLeaderboard ? (
              <View style={styles.centerLoadingBox}>
                <ActivityIndicator size="small" color="#E2F163" />
                <Text style={styles.loadingLeaderboardText}>
                  Loading {exercise.name} rankings...
                </Text>
              </View>
            ) : leaderboard.length === 0 ? (
              <View style={styles.emptyLeaderboardBox}>
                <ExerciseIcon
                  imageUrl={exercise.image_url}
                  icon={exercise.icon}
                  size={54}
                  fontSize={32}
                  containerStyle={{ marginBottom: 10 }}
                />
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

                      <View style={styles.leaderboardAvatarWrapper}>
                        <Avatar
                          username={entry.username}
                          size={38}
                          config={entry.avatar_config}
                        />
                      </View>

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
              <Text style={styles.tabInfoTitle}>⚡ {exercise.name} Scoring Rules</Text>
              <View style={styles.rulePointRow}>
                <View style={[styles.rulePointBadge, { backgroundColor: '#E2F163' }]}>
                  <Text style={[styles.rulePointBadgeText, { color: '#11141A' }]}>+10 PTS</Text>
                </View>
                <Text style={styles.rulePointDesc}>Awarded for winning a {exercise.name} duel.</Text>
              </View>

              <View style={styles.rulePointRow}>
                <View style={[styles.rulePointBadge, { backgroundColor: '#C8B6FF' }]}>
                  <Text style={[styles.rulePointBadgeText, { color: '#11141A' }]}>+5 PTS</Text>
                </View>
                <Text style={styles.rulePointDesc}>Awarded to both players in a draw.</Text>
              </View>

              <View style={styles.rulePointRow}>
                <View style={[styles.rulePointBadge, { backgroundColor: '#FFD6E0' }]}>
                  <Text style={[styles.rulePointBadgeText, { color: '#11141A' }]}>-10 PTS</Text>
                </View>
                <Text style={styles.rulePointDesc}>Deducted on match defeat (floor: 0).</Text>
              </View>
            </View>

            <View style={styles.tabInfoCard}>
              <Text style={styles.tabInfoTitle}>🎖️ {exercise.name} Level Tiers</Text>
              <View style={styles.tierGrid}>
                {[
                  { lvl: 'LVL 1', name: 'Rookie 🥉', range: '0 - 99 pts' },
                  { lvl: 'LVL 2', name: 'Challenger 🥈', range: '100 - 249 pts' },
                  { lvl: 'LVL 3', name: 'Warrior 🥇', range: '250 - 499 pts' },
                  { lvl: 'LVL 4', name: 'Master 💎', range: '500 - 999 pts' },
                  { lvl: 'LVL 5', name: 'Champion 👑', range: '1,000 - 1,999 pts' },
                  { lvl: 'LVL 6', name: 'Grandmaster ⚡', range: '2,000+ pts' },
                ].map((tier, i) => (
                  <View key={i} style={styles.tierCardItem}>
                    <Text style={styles.tierCardLvl}>{tier.lvl}</Text>
                    <Text style={styles.tierCardName}>{tier.name}</Text>
                    <Text style={styles.tierCardRange}>{tier.range}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.rulesContainer}>
            <View style={styles.tabInfoCard}>
              <Text style={styles.tabInfoTitle}>🛍️ Exercise Upgrades & Avatars</Text>
              <Text style={styles.tabInfoBody}>
                Unlock custom DiceBear avatar themes and special battle particle trails as you advance your mastery tiers!
              </Text>
            </View>
          </View>
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
                <Users size={18} color="#11141A" style={{ marginRight: 6 }} />
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
                <X size={18} color="#11141A" />
              </TouchableOpacity>
            </View>

            {/* If invite is currently sent and waiting */}
            {activeSentInvite ? (
              <View style={styles.waitingInsideModalBox}>
                <View style={styles.inviteWaitingIconBox}>
                  <Swords size={32} color="#11141A" />
                </View>
                <Text style={styles.inviteWaitingTitle}>Challenge Sent!</Text>
                <Text style={styles.inviteWaitingDesc}>
                  Invited <Text style={styles.highlightFriend}>@{activeSentInvite.receiverUsername}</Text> to a 1v1 {exercise.name}{' '}
                  {activeSentInvite.mode === 'faceoff' ? 'Faceoff' : 'Score Duel'}.
                </Text>
                <View style={styles.inviteTimerBox}>
                  <ActivityIndicator size="small" color="#11141A" style={{ marginRight: 8 }} />
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
                      color="#11141A"
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.modeToggleText,
                        selectedBattleMode === 'faceoff' && styles.modeToggleTextActive,
                      ]}
                    >
                      Faceoff (Camera)
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
                      color="#11141A"
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.modeToggleText,
                        selectedBattleMode === 'quickjoin' && styles.modeToggleTextActive,
                      ]}
                    >
                      Score Duel
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Direct Challenge by Username Write-in */}
                <View style={styles.directChallengeRow}>
                  <View style={styles.directInputWrap}>
                    <Search size={14} color="#6B7280" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.directInput}
                      placeholder="Challenge athlete by @username..."
                      placeholderTextColor="#6B7280"
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
                      <ActivityIndicator size="small" color="#11141A" />
                      <Text style={styles.friendsLoadingText}>Loading friends list...</Text>
                    </View>
                  ) : friends.length === 0 ? (
                    <View style={styles.emptyFriendsBox}>
                      <Users size={28} color="#4B5563" style={{ marginBottom: 6 }} />
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
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <View style={styles.btnRow}>
                                  <Swords size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
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
  detailScreenContainer: { flex: 1, backgroundColor: '#0C0F14' },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#181D26',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBannerCard: {
    backgroundColor: '#161B22',
    borderRadius: 26,
    marginHorizontal: 16,
    marginTop: 6,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#212631',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  ratingLabel: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  ratingNumBox: {
    backgroundColor: '#E2F163', // Neon lime score box
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 6,
  },
  ratingNumText: { color: '#11141A', fontSize: 12, fontWeight: '900' },
  scoreRulesPill: {
    backgroundColor: '#C8B6FF', // Soft lavender rules pill
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  scoreRulesText: { color: '#11141A', fontSize: 10, fontWeight: '800' },
  bannerStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  starLevelBadge: {
    backgroundColor: '#212631',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E2F163',
  },
  levelBadgeEmoji: { fontSize: 20 },
  levelBadgeNumber: { fontSize: 11, fontWeight: '900', marginTop: 2, color: '#E2F163' },
  userRankInfo: { marginLeft: 14, flex: 1 },
  rankTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  tierTag: {
    backgroundColor: 'rgba(226, 241, 99, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tierTagText: { fontSize: 10, fontWeight: '800', color: '#E2F163' },
  playedWonStats: { color: '#9CA3AF', fontSize: 11, marginTop: 3 },
  progressContainer: { marginTop: 14 },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' },
  progressSubLabel: { color: '#E2F163', fontSize: 11, fontWeight: '800' },
  rankProgressTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: '#212631',
    overflow: 'hidden',
  },
  rankProgressFill: { height: '100%', borderRadius: 6, backgroundColor: '#E2F163' },
  detailSubNavTabBar: {
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  detailSubTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailSubTabItemActive: {
    backgroundColor: '#FFFFFF', // Active white pill
  },
  detailSubTabText: { color: '#8E95A0', fontSize: 11, fontWeight: '800' },
  detailSubTabTextActive: { color: '#11141A' },
  detailScrollView: { flex: 1 },
  detailScrollContent: { paddingHorizontal: 16, paddingBottom: 110 },
  sectionHeaderRow: { marginTop: 16, marginBottom: 10 },
  matchmakingSectionHeader: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 26,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  queueItemCardLavender: {
    backgroundColor: '#C8B6FF', // Highlighted lavender card
    borderColor: 'transparent',
  },
  queueIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#212631',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueIconBoxLavender: {
    backgroundColor: 'rgba(17, 20, 26, 0.1)',
  },
  queueInfoBox: { flex: 1, marginLeft: 12, marginRight: 8 },
  queueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  queueTitleText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  queueTitleTextLavender: { color: '#11141A' },
  queueBadgePill: {
    backgroundColor: '#212631',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  queueBadgePillLavender: {
    backgroundColor: '#FFFFFF',
  },
  queueBadgePillText: { color: '#E2F163', fontSize: 9, fontWeight: '800' },
  queueBadgePillTextLavender: { color: '#11141A' },
  soloBadgePill: {
    backgroundColor: 'rgba(226, 241, 99, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(226, 241, 99, 0.4)',
  },
  soloBadgePillText: {
    color: '#E2F163',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  queueDescText: { color: '#9CA3AF', fontSize: 11, marginTop: 4, lineHeight: 15 },
  queueDescTextLavender: { color: '#374151' },
  joinButton: {
    backgroundColor: '#E2F163',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  soloJoinButton: {
    backgroundColor: '#E2F163',
  },
  joinButtonLavender: {
    backgroundColor: '#11141A',
  },
  joinButtonText: { color: '#11141A', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  soloJoinButtonText: { color: '#11141A' },
  joinButtonTextLavender: { color: '#FFFFFF' },
  leaderboardContainer: { marginTop: 14 },
  myRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#C8B6FF',
    borderRadius: 24,
    padding: 14,
    marginBottom: 16,
  },
  myRankLeft: { flexDirection: 'row', alignItems: 'center' },
  myRankInfo: { marginLeft: 10 },
  myRankName: { color: '#11141A', fontSize: 15, fontWeight: '900' },
  myRankTier: { color: '#374151', fontSize: 11, fontWeight: '700', marginTop: 2 },
  myRankRight: { alignItems: 'flex-end' },
  myRankPoints: { color: '#11141A', fontSize: 18, fontWeight: '900' },
  myRankSub: { color: '#374151', fontSize: 11, marginTop: 2, fontWeight: '700' },
  standingsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  standingsHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  standingsRefreshText: { color: '#E2F163', fontSize: 12, fontWeight: '700' },
  centerLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  loadingLeaderboardText: { color: '#9CA3AF', fontSize: 12 },
  emptyLeaderboardBox: {
    alignItems: 'center',
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyLeaderboardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyLeaderboardDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  leaderboardListBox: {
    backgroundColor: '#161B22',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  leaderboardRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  top1Row: { backgroundColor: 'rgba(226, 241, 99, 0.06)' },
  myHighlightRow: { backgroundColor: 'rgba(200, 182, 255, 0.1)' },
  rankBadgeBox: { width: 34, alignItems: 'center', justifyContent: 'center' },
  podiumEmoji: { fontSize: 20 },
  rankNumberText: { color: '#8E95A0', fontSize: 13, fontWeight: '800' },
  leaderboardAvatarWrapper: { marginLeft: 4, marginRight: 10 },
  leaderboardNameBox: { flex: 1 },
  leaderboardUsername: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  myUsernameText: { color: '#E2F163', fontWeight: '800' },
  leaderboardSubText: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  leaderboardScoreBox: { alignItems: 'flex-end' },
  leaderboardScoreNum: { color: '#E2F163', fontSize: 15, fontWeight: '900' },
  leaderboardScoreUnit: { color: '#6B7280', fontSize: 9, fontWeight: '800' },
  rulesContainer: { marginTop: 14, gap: 12 },
  tabInfoCard: {
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabInfoTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  tabInfoBody: { color: '#CBD5E1', fontSize: 13, lineHeight: 20 },
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
  rulePointBadgeText: { fontSize: 11, fontWeight: '900' },
  rulePointDesc: { color: '#CBD5E1', fontSize: 12, marginLeft: 12, flex: 1 },
  tierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierCardItem: {
    width: '48%',
    backgroundColor: '#212631',
    borderRadius: 16,
    padding: 12,
  },
  tierCardLvl: { color: '#E2F163', fontSize: 10, fontWeight: '800' },
  tierCardName: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 2 },
  tierCardRange: { color: '#9CA3AF', fontSize: 10, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  friendModalCard: {
    backgroundColor: '#C8B6FF', // Soft pastel lavender modal card
    borderRadius: 28,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
  },
  friendModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  friendModalTitle: {
    color: '#11141A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(17, 20, 26, 0.08)',
  },
  waitingInsideModalBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  inviteWaitingIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  inviteWaitingTitle: {
    color: '#11141A',
    fontSize: 20,
    fontWeight: '900',
  },
  inviteWaitingDesc: {
    color: '#374151',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  highlightFriend: {
    color: '#11141A',
    fontWeight: '900',
  },
  inviteTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
  },
  inviteTimerText: {
    color: '#11141A',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelInviteBtn: {
    backgroundColor: '#11141A',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
  },
  cancelInviteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(17, 20, 26, 0.08)',
    borderRadius: 16,
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
    borderRadius: 12,
  },
  modeToggleBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  modeToggleText: {
    color: '#4B5563',
    fontSize: 11,
    fontWeight: '700',
  },
  modeToggleTextActive: {
    color: '#11141A',
    fontWeight: '900',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  directInput: {
    flex: 1,
    color: '#11141A',
    fontSize: 12,
    paddingVertical: 10,
    fontWeight: '600',
  },
  directSendBtn: {
    backgroundColor: '#11141A',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsSubHeader: {
    color: '#11141A',
    fontSize: 11,
    fontWeight: '900',
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
    color: '#374151',
    fontSize: 11,
  },
  emptyFriendsBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  emptyFriendsTitle: {
    color: '#11141A',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyFriendsSubtitle: {
    color: '#4B5563',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  friendsRosterBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  friendRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17, 20, 26, 0.05)',
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
    backgroundColor: '#E2F163',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  friendRosterInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  friendRosterName: {
    color: '#11141A',
    fontSize: 13,
    fontWeight: '800',
  },
  friendRosterUsername: {
    color: '#4B5563',
    fontSize: 11,
    marginTop: 1,
  },
  challengeActionBtn: {
    backgroundColor: '#11141A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  challengeActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
