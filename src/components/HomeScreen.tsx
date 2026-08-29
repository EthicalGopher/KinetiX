import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDeviceInfo, getRecommendedModel, ModelComplexity } from '../utils/deviceSpecs';
import {
  fetchQueueCounts,
  connectMatchSocket,
  disconnectMatchSocket,
  addMatchMessageListener,
  connectPresenceSocket,
  disconnectPresenceSocket,
} from '../utils/matchmaking';

export type MainTab = 'home' | 'explore' | 'workouts' | 'social' | 'profile';
type SubTab = 'feed' | 'news';
type ExerciseCategory = 'all' | 'new' | 'strength' | 'cardio' | 'flexibility';
type DetailSubTab = 'workouts' | 'shop' | 'leaderboard' | 'how_to_play';

interface ExerciseItem {
  id: string;
  name: string;
  category: ExerciseCategory;
  icon: string;
  isFavorite?: boolean;
  isNew?: boolean;
  bgGradient: string;
}

const EXERCISES_DATA: ExerciseItem[] = [
  { id: '1', name: 'Squats', category: 'strength', icon: '🏋️', isFavorite: true, isNew: true, bgGradient: '#2563EB' },
  { id: '2', name: 'Pushups', category: 'strength', icon: '💪', isFavorite: true, bgGradient: '#1D4ED8' },
  { id: '3', name: 'Lunges', category: 'strength', icon: '🦵', bgGradient: '#1E293B' },
  { id: '4', name: 'Plank Hold', category: 'flexibility', icon: '⏱️', isFavorite: true, bgGradient: '#0F172A' },
  { id: '5', name: 'Jumping Jacks', category: 'cardio', icon: '⚡', bgGradient: '#1E1B4B' },
  { id: '6', name: 'High Knees', category: 'cardio', icon: '🏃', isNew: true, bgGradient: '#312E81' },
  { id: '7', name: 'Bicep Curls', category: 'strength', icon: '🦾', bgGradient: '#1E293B' },
  { id: '8', name: 'Burpees', category: 'cardio', icon: '🔥', isFavorite: true, bgGradient: '#4C1D95' },
];

interface HomeScreenProps {
  isCameraActive: boolean;
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onOpenCamera: () => void;
  onOpenMatchCamera: (opponent: string) => void;
  onEnterQueue: () => void;
  onCancelQueue: () => void;
  onShowAuthModal: () => void;
  currentUser: any;
  selectedModel: ModelComplexity;
  onSelectModel: (model: ModelComplexity) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  isCameraActive,
  activeTab,
  onTabChange,
  onOpenCamera,
  onOpenMatchCamera,
  onEnterQueue,
  onCancelQueue,
  onShowAuthModal,
  currentUser,
  selectedModel,
  onSelectModel,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('feed');
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>('all');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseItem | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<DetailSubTab>('workouts');
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('Mobile Device');
  const [totalRamGb, setTotalRamGb] = useState<number>(4.0);
  const [recommendedModel, setRecommendedModel] = useState<ModelComplexity>('medium');
   const [onlineCount, setOnlineCount] = useState<number>(0);
   const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
   const [isQueued, setIsQueued] = useState<boolean>(false);
   const [matchState, setMatchState] = useState<'idle' | 'waiting' | 'matched'>('idle');

  // Dismissible feed banners state
  const [showIdBanner, setShowIdBanner] = useState<boolean>(true);
  const [showXpBanner, setShowXpBanner] = useState<boolean>(true);

  const isFirstTabRender = useRef(true);

  useEffect(() => {
    if (isFirstTabRender.current) {
      isFirstTabRender.current = false;
      return;
    }
    setSelectedExercise(null);
  }, [activeTab]);

  useEffect(() => {
    try {
      const info = getDeviceInfo();
      setDeviceName(info.modelName);
      setTotalRamGb(info.totalMemoryGb);
      const rec = getRecommendedModel(info.totalMemoryGb);
      setRecommendedModel(rec);
    } catch (e) {
      setDeviceName('Mobile Device');
      setRecommendedModel('medium');
    }
  }, []);

     useEffect(() => {
       const userId = currentUser?.user?.id || currentUser?.id || undefined;
       if (userId) {
         connectPresenceSocket(userId);
       }

       const refreshCounts = async () => {
         try {
           const data = await fetchQueueCounts();
           setOnlineCount(data.total_online);
           setQueueCounts(data.exercise_counts);
         } catch (e) {
           console.log('[Matchmaking] fetch counts failed:', (e as Error).message);
         }
       };
       refreshCounts();
       const interval = setInterval(refreshCounts, 3000);
       return () => {
         clearInterval(interval);
         disconnectPresenceSocket();
       };
     }, [currentUser]);

  const getModelTitle = (model: ModelComplexity) => {
    switch (model) {
      case 'light':
        return 'Light Model (Lite)';
      case 'high':
        return 'High Model (Heavy)';
      case 'medium':
      default:
        return 'Medium Model (Full)';
    }
  };

  const filteredExercises = EXERCISES_DATA.filter((item) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'new') return item.isNew;
    return item.category === selectedCategory;
  });

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
          We're working hard to bring you the {featureName} module. Stay tuned for upcoming updates!
        </Text>
        <TouchableOpacity
          style={styles.devBackButton}
          activeOpacity={0.8}
          onPress={() => {
            setSelectedExercise(null);
            onTabChange('home');
            setActiveSubTab('feed');
          }}
        >
          <Text style={styles.devBackButtonText}>← Return to Feed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleJoinQueue = (exercise: ExerciseItem) => {
    if (!currentUser) {
      onShowAuthModal();
      return;
    }
    onEnterQueue();
    setIsQueued(true);
    setMatchState('waiting');

    const userId = currentUser.user?.id || currentUser.id || `anon_${Date.now()}`;
    connectMatchSocket(userId, exercise.id);

    const cleanup = addMatchMessageListener((msg) => {
      if (msg.type === 'matched') {
        setMatchState('matched');
        onOpenMatchCamera(msg.opponent);
        cleanup();
        disconnectMatchSocket();
      }
    });
  };

  const handleCancelQueue = () => {
    setIsQueued(false);
    setMatchState('idle');
    onCancelQueue();
  };

  /* EXERCISE DETAIL / MATCHMAKING QUEUES VIEW (Matches Reference Screenshot) */
  const renderExerciseDetailScreen = (exercise: ExerciseItem) => (
    <View style={styles.detailScreenContainer}>
      {/* Top Header Bar */}
      <View style={styles.detailTopHeader}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => setSelectedExercise(null)}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.detailPageTitle}>{exercise.name}</Text>

        <TouchableOpacity style={styles.detailFavButton} activeOpacity={0.7}>
          <Text style={{ fontSize: 18 }}>{exercise.isFavorite ? '💙' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Stats & Rank Header Banner */}
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

      {/* Sub Tabs Bar (WORKOUTS | SHOP | LEADERBOARD | HOW TO PLAY) */}
      <View style={styles.detailSubNavTabBar}>
        <TouchableOpacity
          style={[styles.detailSubTabItem, detailSubTab === 'workouts' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setDetailSubTab('workouts')}
        >
          <Text style={[styles.detailSubTabText, detailSubTab === 'workouts' && styles.detailSubTabTextActive]}>
            WORKOUTS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailSubTab === 'shop' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setDetailSubTab('shop')}
        >
          <Text style={[styles.detailSubTabText, detailSubTab === 'shop' && styles.detailSubTabTextActive]}>
            SHOP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailSubTab === 'leaderboard' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setDetailSubTab('leaderboard')}
        >
          <Text style={[styles.detailSubTabText, detailSubTab === 'leaderboard' && styles.detailSubTabTextActive]}>
            LEADERBOARD
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.detailSubTabItem, detailSubTab === 'how_to_play' && styles.detailSubTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setDetailSubTab('how_to_play')}
        >
          <Text style={[styles.detailSubTabText, detailSubTab === 'how_to_play' && styles.detailSubTabTextActive]}>
            HOW TO PLAY
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Queues or Sub-Tab Content */}
      <ScrollView
        style={styles.detailScrollView}
        contentContainerStyle={styles.detailScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {detailSubTab === 'workouts' ? (
          <>
            {/* Create Private Game Card */}
            <TouchableOpacity
              style={styles.createPrivateCard}
              activeOpacity={0.85}
              onPress={() => handleJoinQueue(exercise)}
>
              <View style={styles.crownIconBox}>
                <Text style={{ fontSize: 26 }}>👑</Text>
              </View>
              <Text style={styles.createPrivateTitle}>Create Private Game</Text>
            </TouchableOpacity>

            {/* Matchmaking Queues Section Header */}
            <Text style={styles.matchmakingSectionHeader}>MATCHMAKING QUEUES</Text>

            {/* Queue Item 1: Quick Play */}
            <View style={styles.queueItemCard}>
              <View style={styles.queueIconBox}>
                <Text style={{ fontSize: 22 }}>{exercise.icon}</Text>
              </View>
              <View style={styles.queueInfoBox}>
                <View style={styles.queueTitleRow}>
                  <Text style={styles.queueTitleText}>Quick Play</Text>
                  <Text style={styles.popularTagText}>Most Popular 🔥</Text>
                </View>
                <Text style={styles.queueDescText}>
                  Live, {exercise.name} 1v1, Form Tracking, Normal Scoring
                </Text>
              </View>
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => handleJoinQueue(exercise)}>
                <Text style={styles.joinButtonText}>JOIN</Text>
              </TouchableOpacity>
            </View>

            {/* Queue Item 2: Ranked */}
            <View style={styles.queueItemCard}>
              <View style={styles.queueIconBox}>
                <Text style={{ fontSize: 22 }}>{exercise.icon}</Text>
              </View>
              <View style={styles.queueInfoBox}>
                <Text style={styles.queueTitleText}>Ranked</Text>
                <Text style={styles.queueDescText}>
                  Live, {exercise.name} 2v2 PRO, Precision Scoring
                </Text>
              </View>
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => handleJoinQueue(exercise)}>
                <Text style={styles.joinButtonText}>JOIN</Text>
              </TouchableOpacity>
            </View>

            {/* Queue Item 3: Ranked (Precision) */}
            <View style={styles.queueItemCard}>
              <View style={styles.queueIconBox}>
                <Text style={{ fontSize: 22 }}>{exercise.icon}</Text>
              </View>
              <View style={styles.queueInfoBox}>
                <Text style={styles.queueTitleText}>Ranked (Precision)</Text>
                <Text style={styles.queueDescText}>
                  Live, {exercise.name} Strict Form, High Accuracy Scoring
                </Text>
              </View>
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => handleJoinQueue(exercise)}>
                <Text style={styles.joinButtonText}>JOIN</Text>
              </TouchableOpacity>
            </View>

            {/* Queue Item 4: Endurance Mode */}
            <View style={styles.queueItemCard}>
              <View style={styles.queueIconBox}>
                <Text style={{ fontSize: 22 }}>{exercise.icon}</Text>
              </View>
              <View style={styles.queueInfoBox}>
                <Text style={styles.queueTitleText}>Endurance Challenge</Text>
                <Text style={styles.queueDescText}>
                  Max Reps in 60s, Single Player, Leaderboard Ranked
                </Text>
              </View>
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => handleJoinQueue(exercise)}>
                <Text style={styles.joinButtonText}>JOIN</Text>
              </TouchableOpacity>
            </View>

            {/* Queue Item 5: 2v2 Pro */}
            <View style={styles.queueItemCard}>
              <View style={styles.queueIconBox}>
                <Text style={{ fontSize: 22 }}>{exercise.icon}</Text>
              </View>
              <View style={styles.queueInfoBox}>
                <Text style={styles.queueTitleText}>2v2 Pro</Text>
                <Text style={styles.queueDescText}>
                  Co-op Workout Challenge, Team Joint Tracking
                </Text>
              </View>
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => handleJoinQueue(exercise)}>
                <Text style={styles.joinButtonText}>JOIN</Text>
              </TouchableOpacity>
            </View>

            {/* Queue Item 6: Speed Reps */}
            <View style={styles.queueItemCard}>
              <View style={styles.queueIconBox}>
                <Text style={{ fontSize: 22 }}>{exercise.icon}</Text>
              </View>
              <View style={styles.queueInfoBox}>
                <Text style={styles.queueTitleText}>Speed Reps</Text>
                <Text style={styles.queueDescText}>
                  Fast Tempo Mode, Live Rep Counter
                </Text>
              </View>
              <TouchableOpacity style={styles.joinButton} activeOpacity={0.85} onPress={() => handleJoinQueue(exercise)}>
                <Text style={styles.joinButtonText}>JOIN</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : detailSubTab === 'leaderboard' ? (
          <View style={styles.tabInfoCard}>
            <Text style={styles.tabInfoTitle}>🏆 Global Leaderboard</Text>
            <View style={styles.leaderboardRow}>
              <Text style={styles.rankPosText}>#1</Text>
              <Text style={styles.rankNameText}>Alex_Pro</Text>
              <Text style={styles.rankScoreText}>2,450 pts</Text>
            </View>
            <View style={styles.leaderboardRow}>
              <Text style={styles.rankPosText}>#2</Text>
              <Text style={styles.rankNameText}>Sarah_Fit</Text>
              <Text style={styles.rankScoreText}>2,310 pts</Text>
            </View>
            <View style={styles.leaderboardRow}>
              <Text style={styles.rankPosText}>#3</Text>
              <Text style={styles.rankNameText}>You (chomuop)</Text>
              <Text style={styles.rankScoreText}>1,200 pts</Text>
            </View>
          </View>
        ) : detailSubTab === 'how_to_play' ? (
          <View style={styles.tabInfoCard}>
            <Text style={styles.tabInfoTitle}>📖 How to Play & Position Camera</Text>
            <Text style={styles.tabInfoBody}>
              1. Stand 5-7 feet away from your phone camera in landscape mode.{'\n'}
              2. Ensure your full body is visible in the frame.{'\n'}
               3. Perform your exercise reps cleanly. The MediaPipe tracker will automatically count reps & analyze form accuracy.
            </Text>
          </View>
        ) : (
          renderUnderDevelopment('Item Shop')
        )}
      </ScrollView>
    </View>
  );

  /* EXERCISES GRID SCREEN VIEW */
  const renderExercisesScreen = () => (
    <View style={styles.exercisesScreenContainer}>
      {/* Exercises Screen Top Header */}
      <View style={styles.exerciseTopHeader}>
        <View style={styles.avatarCircleSmall}>
          <Text style={{ fontSize: 18 }}>👩‍🦰</Text>
        </View>
        <Text style={styles.exercisePageTitle}>Exercises</Text>
        <TouchableOpacity style={styles.sortIconButton} activeOpacity={0.7}>
          <Text style={styles.sortIconText}>↓↑</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Category Filter Bar */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.categoryChipTextActive]}>
              🎮 All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'new' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('new')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'new' && styles.categoryChipTextActive]}>
              ✨ New
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'strength' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('strength')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'strength' && styles.categoryChipTextActive]}>
              💪 Strength
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'cardio' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('cardio')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'cardio' && styles.categoryChipTextActive]}>
              ⚡ Cardio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'flexibility' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedCategory('flexibility')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'flexibility' && styles.categoryChipTextActive]}>
              🧘 Mobility
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

              {/* Exercise Cards Grid */}
      <ScrollView
        style={styles.gridScrollView}
        contentContainerStyle={styles.gridScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Hero Card (Full Width) */}
        <TouchableOpacity
          style={styles.heroFeaturedCard}
          activeOpacity={0.88}
          onPress={() => setSelectedExercise(EXERCISES_DATA[0])}
        >
          <View style={styles.heroFeaturedOverlay}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTagBadge}>
                <Text style={styles.heroTagBadgeText}>FEATURED EXERCISE</Text>
              </View>
              <View style={styles.queueCountBadge}>
                <Text style={{ fontSize: 11 }}>👥 {(queueCounts['1'] || 0).toString()}</Text>
              </View>
            </View>

            <View style={styles.heroCenterArt}>
              <Text style={{ fontSize: 48 }}>🏋️</Text>
            </View>

            <View style={styles.heroBottomRow}>
              <Text style={styles.heroCardTitle}>Squats Pose Tracker</Text>
              <Text style={styles.heroCardSubtitle}>Tap to open exercise queues & modes</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 2-Column Grid */}
        <View style={styles.exerciseGridContainer}>
          {filteredExercises.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridCard}
              activeOpacity={0.85}
              onPress={() => setSelectedExercise(item)}
            >
              {/* Card Header row with queue count instead of heart */}
              <View style={styles.gridCardHeaderRow}>
                {item.isNew ? (
                  <View style={styles.newMiniBadge}>
                    <Text style={styles.newMiniBadgeText}>NEW</Text>
                  </View>
                ) : (
                  <View />
                )}
                <View style={styles.gridFavBadge}>
                  <Text style={{ fontSize: 11 }}>
                    👥 {(queueCounts[item.id] || 0).toString()}
                  </Text>
                </View>
              </View>

              {/* Center Art Icon */}
              <View style={styles.gridIconCenter}>
                <Text style={{ fontSize: 34 }}>{item.icon}</Text>
              </View>

              {/* Card Footer Title */}
              <View style={styles.gridCardFooter}>
                <Text style={styles.gridCardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D111A" />

      {/* Top Header Bar (Only visible when activeTab is 'home' and no detail screen selected) */}
      {activeTab === 'home' && !selectedExercise && (
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.avatarContainer}
            activeOpacity={0.8}
            onPress={() => onShowAuthModal()}
          >
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 20 }}>👩‍🦰</Text>
            </View>
            <View style={styles.onlineDot} />
          </TouchableOpacity>

          <Text style={styles.brandTitle}>plato</Text>

          <View style={styles.pointsBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.pointsText}>{onlineCount}</Text>
            <Text style={styles.groupIcon}>👥</Text>
          </View>
        </View>
      )}

      {/* Sub Navigation Bar (FEED | NEWS) - Only on Home */}
      {activeTab === 'home' && !selectedExercise && (
        <View style={styles.subNavBar}>
          <TouchableOpacity
            style={[styles.subNavTab, activeSubTab === 'feed' && styles.subNavTabActive]}
            activeOpacity={0.8}
            onPress={() => setActiveSubTab('feed')}
          >
            <Text style={[styles.subNavTabText, activeSubTab === 'feed' && styles.subNavTabTextActive]}>
              FEED
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subNavTab, activeSubTab === 'news' && styles.subNavTabActive]}
            activeOpacity={0.8}
            onPress={() => setActiveSubTab('news')}
          >
            <View style={styles.newsTabRow}>
              <Text style={[styles.subNavTabText, activeSubTab === 'news' && styles.subNavTabTextActive]}>
                NEWS
              </Text>
              <View style={styles.redBadgeDot} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {selectedExercise ? (
          renderExerciseDetailScreen(selectedExercise)
        ) : activeTab === 'workouts' ? (
          renderExercisesScreen()
        ) : activeTab !== 'home' ? (
          renderUnderDevelopment(
            activeTab === 'explore'
              ? 'Explore Section'
              : activeTab === 'social'
              ? 'Friends & Leaderboards'
              : 'User Profile & Inventory'
          )
        ) : activeSubTab === 'news' ? (
          renderUnderDevelopment('News & Updates Feed')
        ) : (
          <ScrollView
            style={styles.feedScrollView}
            contentContainerStyle={styles.feedScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ONLINE / FAVORITES Horizontal Scroll Bar */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>ONLINE/FAVORITES</Text>
              <Text style={styles.sectionHeaderArrow}>▼</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalAvatarRow}
            >
              <TouchableOpacity style={styles.avatarItem} activeOpacity={0.8}>
                <View style={[styles.avatarCircleLarge, styles.addFriendCircle]}>
                  <Text style={{ fontSize: 18 }}>👩‍🦰</Text>
                  <View style={styles.plusIconBadge}>
                    <Text style={styles.plusIconText}>+</Text>
                  </View>
                </View>
                <Text style={styles.avatarLabel} numberOfLines={1}>Add Fri...</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarItem}
                activeOpacity={0.8}
                onPress={() => setSelectedExercise(EXERCISES_DATA[0])}
              >
                <View style={styles.avatarCircleLarge}>
                  <Text style={{ fontSize: 22 }}>🏋️</Text>
                </View>
                <Text style={styles.avatarLabel} numberOfLines={1}>Squats</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarItem}
                activeOpacity={0.8}
                onPress={() => setSelectedExercise(EXERCISES_DATA[1])}
              >
                <View style={styles.avatarCircleLarge}>
                  <Text style={{ fontSize: 22 }}>💪</Text>
                </View>
                <Text style={styles.avatarLabel} numberOfLines={1}>Pushups</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarItem}
                activeOpacity={0.8}
                onPress={() => setSelectedExercise(EXERCISES_DATA[3])}
              >
                <View style={styles.avatarCircleLarge}>
                  <Text style={{ fontSize: 22 }}>⏱️</Text>
                </View>
                <Text style={styles.avatarLabel} numberOfLines={1}>Plank</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.avatarItem}
                activeOpacity={0.8}
                onPress={() => setSelectedExercise(EXERCISES_DATA[4])}
              >
                <View style={styles.avatarCircleLarge}>
                  <Text style={{ fontSize: 22 }}>⚡</Text>
                </View>
                <Text style={styles.avatarLabel} numberOfLines={1}>Jacks</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* FEATURED Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>FEATURED</Text>
              <Text style={styles.sectionHeaderArrow}>▲</Text>
            </View>

            {/* Daily Quest Card */}
            <View style={styles.featuredCard}>
              <View style={styles.questHeaderRow}>
                <View style={styles.questIconCircle}>
                  <Text style={{ fontSize: 20 }}>🗡️</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.questSubTitle}>DAILY QUEST</Text>
                  <Text style={styles.questTitle}>Win 2 Games</Text>
                </View>
                <View style={styles.questTimeRow}>
                  <Text style={styles.questTimerText}>21H 39MIN</Text>
                  <Text style={styles.questDetailsArrow}>DETAILS ▼</Text>
                </View>
              </View>

              <View style={styles.questProgressTrack}>
                <View style={styles.questProgressFill} />
              </View>

              {/* Task 1 */}
              <View style={styles.questTaskItem}>
                <View style={styles.taskIconBox}>
                  <Text style={{ fontSize: 18 }}>🎮</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.taskTitle}>Win 1 Game</Text>
                  <Text style={styles.taskSubtitle}>Play in Conversation</Text>
                </View>
                <TouchableOpacity
                  style={styles.goButton}
                  activeOpacity={0.8}
                  onPress={() => setSelectedExercise(EXERCISES_DATA[0])}
                >
                  <Text style={styles.goButtonText}>Go</Text>
                </TouchableOpacity>
              </View>

              {/* Task 2 */}
              <View style={styles.questTaskItem}>
                <View style={styles.taskIconBox}>
                  <Text style={{ fontSize: 18 }}>🎮</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.taskTitle}>Win 1 Game</Text>
                  <Text style={styles.taskSubtitle}>Play Private Game</Text>
                </View>
                <TouchableOpacity
                  style={styles.goButton}
                  activeOpacity={0.8}
                  onPress={() => setSelectedExercise(EXERCISES_DATA[1])}
                >
                  <Text style={styles.goButtonText}>Go</Text>
                </TouchableOpacity>
              </View>

              {/* Rewards Footer */}
              <View style={styles.rewardsRow}>
                <Text style={styles.rewardsLabel}>Rewards</Text>
                <View style={styles.rewardPill}>
                  <Text style={{ fontSize: 14 }}>🪙</Text>
                  <Text style={styles.rewardText}>150 Coins</Text>
                </View>
                <View style={styles.rewardPill}>
                  <Text style={{ fontSize: 14 }}>💎</Text>
                  <Text style={styles.rewardText}>100 Hype</Text>
                </View>
              </View>
            </View>

            {/* Pose Tracker Featured Launcher Card */}
            <TouchableOpacity
              style={styles.featuredCard}
              activeOpacity={0.9}
              onPress={() => setSelectedExercise(EXERCISES_DATA[0])}
            >
              <View style={styles.aiCardAccentBar} />
              <View style={styles.aiCardBody}>
                <View style={styles.aiIconCircle}>
                  <Text style={{ fontSize: 26 }}>🤳</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                   <Text style={styles.aiCardTitle}>Live Camera</Text>
                  <Text style={styles.aiCardSubtitle}>
                    Real-time MediaPipe joint tracking ({getModelTitle(selectedModel)})
                  </Text>
                </View>
              </View>
              <View style={styles.aiCardFooter}>
                <TouchableOpacity
                  style={styles.settingsPill}
                  activeOpacity={0.8}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowSettingsModal(true);
                  }}
                >
                  <Text style={styles.settingsPillText}>⚙️ Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.launchPill}
                  activeOpacity={0.85}
                  onPress={() => setSelectedExercise(EXERCISES_DATA[0])}
                >
                  <Text style={styles.launchPillText}>Open Camera →</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {/* Activity Feed List Items */}
            <TouchableOpacity style={styles.feedItemRow} activeOpacity={0.8}>
              <View style={[styles.feedAvatarCircle, { backgroundColor: '#4C1D95' }]}>
                <Text style={{ fontSize: 20 }}>🪐</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.feedItemHeader}>
                  <Text style={styles.feedItemTitle}>👥 GCU boiiis</Text>
                  <Text style={styles.feedItemTime}>05/07/26</Text>
                </View>
                <Text style={styles.feedItemSnippet}>You: Hi</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.feedItemRow} activeOpacity={0.8}>
              <View style={[styles.feedAvatarCircle, { backgroundColor: '#1E3A8A' }]}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.feedItemHeader}>
                  <Text style={styles.feedItemTitle}>PlatoBot</Text>
                  <Text style={styles.feedItemTime}>03/05/26</Text>
                </View>
                <Text style={styles.feedItemSnippet} numberOfLines={1}>
                  PlatoBot: You'll have more fun if you invite your friends...
                </Text>
              </View>
            </TouchableOpacity>

            {/* Dismissible Info Banners */}
            {showIdBanner && (
              <View style={styles.infoBannerRow}>
                <View style={styles.infoBannerAvatar}>
                  <Text style={{ fontSize: 18 }}>👩‍🦰</Text>
                </View>
                <Text style={styles.infoBannerText}>
                  Your Plato ID is <Text style={{ fontWeight: '700', color: '#FFF' }}>chomuop</Text>. You can change it in Profile
                </Text>
                <TouchableOpacity onPress={() => setShowIdBanner(false)} style={styles.closeBannerBtn}>
                  <Text style={styles.closeBannerText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {showXpBanner && (
              <View style={styles.infoBannerRow}>
                <View style={styles.infoBannerAvatar}>
                  <Text style={{ fontSize: 18 }}>🎲</Text>
                </View>
                <Text style={styles.infoBannerText}>
                  Play <Text style={{ fontWeight: '700', color: '#FFF' }}>Games</Text> to earn XP, level up and unlock titles
                </Text>
                <TouchableOpacity onPress={() => setShowXpBanner(false)} style={styles.closeBannerBtn}>
                  <Text style={styles.closeBannerText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {/* Bottom Navigation Bar */}
      {/* Bottom Navigation Bar — hidden when floating camera widget is active */}
      {!isCameraActive && (
        <View style={styles.bottomTabBar}>
          {/* Tab 1: Home */}
          <TouchableOpacity
            style={styles.tabBarItem}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedExercise(null);
              onTabChange('home');
            }}
          >
            <View style={[styles.tabIconCircle, activeTab === 'home' && !selectedExercise && styles.tabIconCircleActive]}>
              <Text style={{ fontSize: 20 }}>🏠</Text>
            </View>
          </TouchableOpacity>

          {/* Tab 2: Explore */}
          <TouchableOpacity
            style={styles.tabBarItem}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedExercise(null);
              onTabChange('explore');
            }}
          >
            <View style={[styles.tabIconCircle, activeTab === 'explore' && styles.tabIconCircleActive]}>
              <Text style={{ fontSize: 20 }}>👓</Text>
            </View>
          </TouchableOpacity>

          {/* Tab 3: Exercises / Workouts */}
          <TouchableOpacity
            style={styles.tabBarItem}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedExercise(null);
              onTabChange('workouts');
            }}
          >
            <View style={[styles.tabIconCircle, (activeTab === 'workouts' || selectedExercise) && styles.tabIconCircleActive]}>
              <Text style={{ fontSize: 20 }}>🎮</Text>
            </View>
          </TouchableOpacity>

          {/* Tab 4: Social */}
          <TouchableOpacity
            style={styles.tabBarItem}
            activeOpacity={0.8}
            onPress={() => {
              setSelectedExercise(null);
              onTabChange('social');
            }}
          >
            <View style={[styles.tabIconCircle, activeTab === 'social' && styles.tabIconCircleActive]}>
              <Text style={{ fontSize: 20 }}>👥</Text>
            </View>
          </TouchableOpacity>

          {/* Tab 5: Profile */}
          <TouchableOpacity
            style={styles.tabBarItem}
            activeOpacity={0.8}
            onPress={onShowAuthModal}
          >
            <View style={[styles.tabIconCircle, activeTab === 'profile' && styles.tabIconCircleActive]}>
              <Text style={{ fontSize: 20 }}>🎒</Text>
              <View style={styles.tabRedBadgeDot} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Hardware Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚙️ Settings & Model Choice</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Text style={styles.modalCloseIconText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              <View style={styles.specCard}>
                <Text style={styles.specCardTitle}>📱 Detected Device Specs</Text>
                <Text style={styles.specDetailText}>
                  Model: <Text style={styles.specHighlightText}>{deviceName}</Text> | Memory:{' '}
                  <Text style={styles.specHighlightText}>{totalRamGb} GB RAM</Text>
                </Text>
                <Text style={styles.specDetailText}>
                  Hardware Recommendation:{' '}
                  <Text style={styles.specRecommendText}>
                    {getModelTitle(recommendedModel)}
                  </Text>
                </Text>
              </View>

              <Text style={styles.modelSectionHeading}>Select Pose Model:</Text>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedModel === 'light' && styles.optionCardSelected,
                ]}
                activeOpacity={0.85}
                onPress={() => onSelectModel('light')}
              >
                <View style={styles.optionHeaderRow}>
                  <Text style={styles.optionTitle}>⚡ Light Model (Lite)</Text>
                  {recommendedModel === 'light' && (
                    <View style={styles.recommendBadge}>
                      <Text style={styles.recommendBadgeText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionDescription}>
                  Fastest FPS & lowest memory (~2.7 MB). Best for entry-level phones.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedModel === 'medium' && styles.optionCardSelected,
                ]}
                activeOpacity={0.85}
                onPress={() => onSelectModel('medium')}
              >
                <View style={styles.optionHeaderRow}>
                  <Text style={styles.optionTitle}>🎯 Medium Model (Full)</Text>
                  {recommendedModel === 'medium' && (
                    <View style={styles.recommendBadge}>
                      <Text style={styles.recommendBadgeText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionDescription}>
                  Balanced speed & joint accuracy (~6.2 MB). Ideal for mid-range phones.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedModel === 'high' && styles.optionCardSelected,
                ]}
                activeOpacity={0.85}
                onPress={() => onSelectModel('high')}
              >
                <View style={styles.optionHeaderRow}>
                  <Text style={styles.optionTitle}>🔥 High Model (Heavy)</Text>
                  {recommendedModel === 'high' && (
                    <View style={styles.recommendBadge}>
                      <Text style={styles.recommendBadgeText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.optionDescription}>
                  Maximum joint precision (~27 MB). Best for high-end flagship phones.
                </Text>
              </TouchableOpacity>

              {/* Under Development Features */}
              <View style={styles.specCard}>
                <Text style={styles.specCardTitle}>🚧 3D VR Avatar System</Text>
                <Text style={styles.specDetailText}>
                  3D VRM Kalidokit full-body rigging is currently <Text style={{ color: '#F59E0B', fontWeight: '700' }}>Under Development</Text> for a future release.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.saveSettingsButton}
              activeOpacity={0.8}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.saveSettingsButtonText}>Save & Apply Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111622',
  },
  topHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#111622',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A3447',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#111622',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2333',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  pointsText: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 6,
  },
  groupIcon: {
    fontSize: 13,
  },
  subNavBar: {
    flexDirection: 'row',
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#111622',
  },
  subNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subNavTabActive: {
    borderBottomColor: '#2563EB',
  },
  subNavTabText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subNavTabTextActive: {
    color: '#2563EB',
  },
  newsTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  redBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginLeft: 4,
  },
  mainContent: {
    flex: 1,
  },
  feedScrollView: {
    flex: 1,
  },
  feedScrollContent: {
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionHeaderTitle: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHeaderArrow: {
    color: '#718096',
    fontSize: 10,
  },
  horizontalAvatarRow: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  avatarItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 64,
  },
  avatarCircleLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addFriendCircle: {
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  plusIconBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
  avatarLabel: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  featuredCard: {
    backgroundColor: '#182030',
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  questHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  questIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2E1065',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questSubTitle: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  questTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 1,
  },
  questTimeRow: {
    alignItems: 'flex-end',
  },
  questTimerText: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '600',
  },
  questDetailsArrow: {
    color: '#718096',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  questProgressTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    marginBottom: 14,
    overflow: 'hidden',
  },
  questProgressFill: {
    width: '40%',
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  questTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskSubtitle: {
    color: '#718096',
    fontSize: 11,
    marginTop: 1,
  },
  goButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  goButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rewardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  rewardsLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 12,
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  rewardText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  aiCardAccentBar: {
    height: 4,
    backgroundColor: '#2563EB',
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
  },
  aiCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  aiCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  aiCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  aiCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  settingsPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingsPillText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  launchPill: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  launchPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  feedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  feedAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  feedItemTime: {
    color: '#718096',
    fontSize: 11,
  },
  feedItemSnippet: {
    color: '#A0AEC0',
    fontSize: 13,
    marginTop: 2,
  },
  infoBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182030',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  infoBannerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  infoBannerText: {
    flex: 1,
    color: '#A0AEC0',
    fontSize: 12,
    lineHeight: 16,
  },
  closeBannerBtn: {
    padding: 4,
    marginLeft: 6,
  },
  closeBannerText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '600',
  },

  /* EXERCISES SCREEN STYLES */
  exercisesScreenContainer: {
    flex: 1,
    backgroundColor: '#111622',
  },
  exerciseTopHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  avatarCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2A3447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exercisePageTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  sortIconButton: {
    padding: 6,
  },
  sortIconText: {
    color: '#A0AEC0',
    fontSize: 16,
    fontWeight: '700',
  },
  categoryBarWrapper: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryScrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: '#182030',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryChipText: {
    color: '#718096',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  gridScrollView: {
    flex: 1,
  },
  gridScrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  heroFeaturedCard: {
    height: 160,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  heroFeaturedOverlay: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTagBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroTagBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  favHeartCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueCountBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenterArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottomRow: {},
  heroCardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroCardSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  exerciseGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48.5%',
    height: 124,
    backgroundColor: '#182030',
    borderRadius: 16,
    marginBottom: 12,
    padding: 12,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  gridCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newMiniBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  newMiniBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  gridFavBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  gridIconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  gridCardFooter: {},
  gridCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  /* EXERCISE DETAIL SCREEN STYLES (MATCHES 3rd SCREENSHOT) */
  detailScreenContainer: {
    flex: 1,
    backgroundColor: '#111622',
  },
  detailTopHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 6,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  detailPageTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  detailFavButton: {
    paddingLeft: 12,
    paddingVertical: 6,
  },
  detailBannerCard: {
    backgroundColor: '#182030',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bannerRankRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  ratingLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  ratingNumBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
  },
  ratingNumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  infoIconText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  bannerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  starLevelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#60A5FA',
  },
  userRankInfo: {},
  rankTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  playedWonStats: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  rankProgressTrack: {
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rankProgressFill: {
    width: '25%',
    height: '100%',
    backgroundColor: '#2563EB',
  },
  detailSubNavTabBar: {
    flexDirection: 'row',
    height: 42,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
  },
  detailSubTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  detailSubTabItemActive: {
    borderBottomColor: '#2563EB',
  },
  detailSubTabText: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '700',
  },
  detailSubTabTextActive: {
    color: '#2563EB',
  },
  detailScrollView: {
    flex: 1,
  },
  detailScrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  createPrivateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182030',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  crownIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  createPrivateTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  matchmakingSectionHeader: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  queueItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182030',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  queueIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  queueInfoBox: {
    flex: 1,
    marginRight: 8,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  popularTagText: {
    color: '#F97316',
    fontSize: 10,
    fontWeight: '700',
  },
  queueDescText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  joinButton: {
    backgroundColor: '#84CC16',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 16,
  },
  joinButtonText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabInfoCard: {
    backgroundColor: '#182030',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabInfoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  tabInfoBody: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  rankPosText: {
    color: '#84CC16',
    fontSize: 14,
    fontWeight: '800',
    width: 36,
  },
  rankNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  rankScoreText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },

  /* UNDER DEVELOPMENT STYLES */
  devContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  devCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#182030',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  devIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  devIconText: {
    fontSize: 32,
  },
  devTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  devPillTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 14,
  },
  devPillTagText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
  },
  devSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  devBackButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  devBackButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomTabBar: {
    height: 60,
    backgroundColor: '#111622',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconCircle: {
    width: 44,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIconCircleActive: {
    backgroundColor: '#1E293B',
  },
  tabRedBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalCloseIconText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
    padding: 4,
  },
  specCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  specCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  specDetailText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  specHighlightText: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  specRecommendText: {
    color: '#10B981',
    fontWeight: '700',
  },
  modelSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
    marginBottom: 10,
  },
  optionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  optionCardSelected: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  optionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  recommendBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recommendBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  optionDescription: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  saveSettingsButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 12,
  },
  saveSettingsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
