import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ExerciseCardProps {
  item: {
    id: string;
    name: string;
    icon: string;
    isNew?: boolean;
    bgGradient?: string;
  };
  queueCount: number;
  onPress: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({ item, queueCount, onPress }) => {
  return (
    <TouchableOpacity style={styles.gridCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.gridCardHeaderRow}>
        {item.isNew ? (
          <View style={styles.newMiniBadge}>
            <Text style={styles.newMiniBadgeText}>NEW</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={styles.gridFavBadge}>
          <Text style={{ fontSize: 11, color: '#FFF' }}>{queueCount}</Text>
        </View>
      </View>

      <View style={styles.gridIconCenter}>
        <Text style={{ fontSize: 34 }}>{item.icon}</Text>
      </View>

      <View style={styles.gridCardFooter}>
        <Text style={styles.gridCardTitle} numberOfLines={1}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gridCard: {
    width: '48%',
    minHeight: 162,
    backgroundColor: '#182030',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  gridCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  newMiniBadge: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  newMiniBadgeText: {
    fontSize: 9,
    color: '#FFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gridFavBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  gridIconCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 86,
  },
  gridCardFooter: {
    marginTop: 4,
  },
  gridCardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
});
