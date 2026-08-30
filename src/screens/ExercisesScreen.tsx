import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ExerciseCard } from '../components/ExerciseCard';
import { Header } from '../components/Header';
import { DEFAULT_EXERCISES, fetchExercisesFromSupabase } from '../utils/exerciseService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - 32;

export interface ExerciseItem {
  id: string;
  name: string;
  category: 'all' | 'strength' | 'cardio' | 'flexibility';
  icon: string;
  description?: string;
  bgGradient?: string;
  isFavorite?: boolean;
}

interface ExercisesScreenProps {
  exercises?: ExerciseItem[];
  queueCounts: Record<string, number>;
  selectedCategory: ExerciseItem['category'];
  onCategoryChange: (category: ExerciseItem['category']) => void;
  onExerciseSelect: (exercise: ExerciseItem) => void;
  onRefreshExercises?: () => Promise<void>;
}

export const ExercisesScreen: React.FC<ExercisesScreenProps> = ({
  exercises: propExercises,
  queueCounts,
  selectedCategory,
  onCategoryChange,
  onExerciseSelect,
  onRefreshExercises,
}) => {
  const [exercisesList, setExercisesList] = useState<ExerciseItem[]>(propExercises || DEFAULT_EXERCISES);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (propExercises && propExercises.length > 0) {
      setExercisesList(propExercises);
    } else {
      loadExercises();
    }
  }, [propExercises]);

  const loadExercises = async () => {
    setIsLoading(true);
    try {
      const data = await fetchExercisesFromSupabase();
      if (data && data.length > 0) {
        setExercisesList(data);
      }
    } catch (e) {
      console.warn('Error fetching exercises in ExercisesScreen:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefreshExercises) {
        await onRefreshExercises();
      } else {
        await loadExercises();
      }
    } finally {
      setRefreshing(false);
    }
  };

  const filteredExercises = exercisesList.filter((item) => {
    if (selectedCategory === 'all') return true;
    return item.category === selectedCategory;
  });

  const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (CAROUSEL_CARD_WIDTH + 12));
    setCarouselIndex(Math.max(0, Math.min(index, exercisesList.length - 1)));
  };

  return (
    <View style={styles.exercisesScreenContainer}>
      <Header />

      {/* Category Pills Filter */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('all')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.categoryChipTextActive]}>
              🎮 All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'strength' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('strength')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'strength' && styles.categoryChipTextActive]}>
              💪 Strength
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'cardio' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('cardio')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'cardio' && styles.categoryChipTextActive]}>
              ⚡ Cardio
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'flexibility' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('flexibility')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'flexibility' && styles.categoryChipTextActive]}>
              🧘 Mobility
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.gridScrollView}
        contentContainerStyle={styles.gridScrollContent}
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
        {/* Top Carousel: Exercises Displayed One After Another */}
        <View style={styles.carouselSection}>
          <ScrollView
            horizontal
            pagingEnabled={false}
            snapToInterval={CAROUSEL_CARD_WIDTH + 12}
            snapToAlignment="center"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleCarouselScroll}
            scrollEventThrottle={16}
            contentContainerStyle={styles.carouselScrollContent}
          >
            {exercisesList.map((item) => {
              const count = queueCounts[item.id] || 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.carouselCard, { width: CAROUSEL_CARD_WIDTH }]}
                  activeOpacity={0.88}
                  onPress={() => onExerciseSelect(item)}
                >
                  <View style={styles.carouselCardOverlay}>
                    <View style={styles.carouselTopRow}>
                      <View style={styles.categoryPillBadge}>
                        <Text style={styles.categoryPillBadgeText}>
                          {item.category === 'strength' ? '💪 Strength' : item.category === 'cardio' ? '⚡ Cardio' : '🧘 Mobility'}
                        </Text>
                      </View>
                      <View style={styles.queueCountBadge}>
                        <View style={styles.greenPulseDot} />
                        <Text style={styles.queueCountBadgeText}>{count} active</Text>
                      </View>
                    </View>

                    <View style={styles.carouselCenterArt}>
                      <View style={styles.emojiGlowCircle}>
                        <Text style={styles.carouselEmoji}>{item.icon}</Text>
                      </View>
                    </View>

                    <View style={styles.carouselBottomRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.carouselCardTitle}>{item.name} Pose Tracker</Text>
                        <Text style={styles.carouselCardSubtitle} numberOfLines={1}>
                          {item.description || 'AI MediaPipe Real-time Pose & Rep Tracking'}
                        </Text>
                      </View>

                      <View style={styles.carouselPlayBtn}>
                        <Text style={styles.carouselPlayBtnText}>PLAY</Text>
                        <Text style={styles.carouselPlayArrow}>➔</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Carousel Pagination Dots if multiple exercises */}
          {exercisesList.length > 1 && (
            <View style={styles.paginationDotsRow}>
              {exercisesList.map((item, idx) => (
                <View
                  key={item.id}
                  style={[
                    styles.paginationDot,
                    carouselIndex === idx && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Section Heading */}
        <Text style={styles.sectionHeaderTitle}>ALL EXERCISES</Text>

        {/* Exercises Grid */}
        <View style={styles.exerciseGridContainer}>
          {filteredExercises.map((item) => (
            <ExerciseCard
              key={item.id}
              item={item}
              queueCount={queueCounts[item.id] || 0}
              onPress={() => onExerciseSelect(item)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  exercisesScreenContainer: {
    flex: 1,
    backgroundColor: '#0D111A',
  },
  categoryBarWrapper: {
    paddingVertical: 10,
    backgroundColor: '#121826',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#182030',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  categoryChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  gridScrollView: {
    flex: 1,
  },
  gridScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  carouselSection: {
    marginBottom: 20,
  },
  carouselScrollContent: {
    gap: 12,
  },
  carouselCard: {
    height: 215,
    maxWidth: "100%",
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  carouselCardOverlay: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'space-between',
  },
  carouselTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryPillBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryPillBadgeText: {
    fontSize: 11,
    color: '#C7D2FE',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  queueCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  greenPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  queueCountBadgeText: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
  },
  carouselCenterArt: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  emojiGlowCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  carouselEmoji: {
    fontSize: 42,
  },
  carouselBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  carouselCardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  carouselCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  carouselPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 4,
  },
  carouselPlayBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  carouselPlayArrow: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  paginationDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#6366F1',
  },
  sectionHeaderTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  exerciseGridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
});

