import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ExerciseCard } from '../components/ExerciseCard';
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

interface ExercisesScreenProps {
  exercises: ExerciseItem[];
  queueCounts: Record<string, number>;
  selectedCategory: ExerciseItem['category'];
  onCategoryChange: (category: ExerciseItem['category']) => void;
  onExerciseSelect: (exercise: ExerciseItem) => void;
}

export const ExercisesScreen: React.FC<ExercisesScreenProps> = ({
  exercises,
  queueCounts,
  selectedCategory,
  onCategoryChange,
  onExerciseSelect,
}) => {
  const filteredExercises = exercises.filter((item) => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'new') return item.isNew;
    return item.category === selectedCategory;
  });

  return (
    <View style={styles.exercisesScreenContainer}>
      <Header/>

      <View style={styles.categoryBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScrollContent}>
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('all')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.categoryChipTextActive]}>🎮 All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'new' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('new')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'new' && styles.categoryChipTextActive]}>✨ New</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'strength' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('strength')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'strength' && styles.categoryChipTextActive]}>💪 Strength</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'cardio' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('cardio')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'cardio' && styles.categoryChipTextActive]}>⚡ Cardio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'flexibility' && styles.categoryChipActive]}
            activeOpacity={0.8}
            onPress={() => onCategoryChange('flexibility')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'flexibility' && styles.categoryChipTextActive]}>🧘 Mobility</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.gridScrollView} contentContainerStyle={styles.gridScrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.heroFeaturedCard} activeOpacity={0.88} onPress={() => onExerciseSelect(exercises[0])}>
          <View style={styles.heroFeaturedOverlay}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTagBadge}>
                <Text style={styles.heroTagBadgeText}>FEATURED EXERCISE</Text>
              </View>
              <View style={styles.queueCountBadge}>
                <Text style={{ fontSize: 11 }}>👥 {queueCounts['1'] || 0}</Text>
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
  exercisesScreenContainer: { flex: 1, backgroundColor: '#111622' },
  sortIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#172033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortIconText: {
    color: '#FFF',
    fontWeight: '700',
  },
  categoryBarWrapper: { marginBottom: 8 },
  categoryScrollContent: { paddingHorizontal: 14, gap: 8 },
  categoryChip: {
    backgroundColor: '#172033',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  categoryChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: 'rgba(96,165,250,0.4)',
  },
  categoryChipText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  categoryChipTextActive: { color: '#FFF', fontWeight: '700' },
  gridScrollView: { flex: 1 },
  gridScrollContent: { paddingHorizontal: 14, paddingBottom: 16 },
  heroFeaturedCard: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroFeaturedOverlay: {
    flex: 1,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTagBadge: {
    backgroundColor: 'rgba(15, 118, 110, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroTagBadgeText: {
    fontSize: 11,
    color: '#A7F3D0',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  queueCountBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  heroCenterArt: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroBottomRow: { marginTop: 2 },
  heroCardTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '800' },
  heroCardSubtitle: { color: '#E2E8F0', fontSize: 12, marginTop: 4 },
  exerciseGridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
});
