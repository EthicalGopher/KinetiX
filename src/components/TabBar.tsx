import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Dumbbell, Home, Search, User, Users } from 'lucide-react-native';

export type TabBarItem = 'home' | 'explore' | 'workouts' | 'social' | 'profile';

interface TabBarProps {
  activeTab: TabBarItem;
  onTabPress: (tab: TabBarItem) => void;
  onProfilePress: () => void;
}

const ACTIVE_BG = '#111827';
const ACTIVE_ICON = '#FFFFFF';
const INACTIVE_ICON = '#9AA3AF';

// Left + right sit alone in their own circles (search / profile, like the reference)
const LEFT_ITEM = { key: 'explore' as const, icon: Search };
const RIGHT_ITEM = { key: 'profile' as const, icon: User };
// These three live together in the middle pill
const MIDDLE_ITEMS = [
  { key: 'home' as const, icon: Home },
  { key: 'workouts' as const, icon: Dumbbell },
  { key: 'social' as const, icon: Users },
];

const AnimatedIcon: React.FC<{
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  active: boolean;
  onPress: () => void;
  size?: number;
}> = ({ Icon, active, onPress, size = 44 }) => {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.iconTouchable}>
      <Animated.View
        style={[
          styles.iconCircle,
          { width: size, height: size, borderRadius: size / 2, transform: [{ scale }] },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: size / 2, backgroundColor: ACTIVE_BG, opacity: progress },
          ]}
        />
        <Icon size={20} color={active ? ACTIVE_ICON : INACTIVE_ICON} strokeWidth={2} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabPress, onProfilePress }) => {
  const handlePress = (key: TabBarItem) => {
    if (key === 'profile') {
      onProfilePress();
    } else {
      onTabPress(key);
    }
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* Left standalone circle */}
      <View style={[styles.group, styles.singleGroup]}>
        <AnimatedIcon
          Icon={LEFT_ITEM.icon}
          active={activeTab === LEFT_ITEM.key}
          onPress={() => handlePress(LEFT_ITEM.key)}
        />
      </View>

      {/* Middle pill */}
      <View style={[styles.group, styles.pillGroup]}>
        {MIDDLE_ITEMS.map((item) => (
          <AnimatedIcon
            key={item.key}
            Icon={item.icon}
            active={activeTab === item.key}
            onPress={() => handlePress(item.key)}
          />
        ))}
      </View>

      {/* Right standalone circle */}
      <View style={[styles.group, styles.singleGroup]}>
        <AnimatedIcon
          Icon={RIGHT_ITEM.icon}
          active={activeTab === RIGHT_ITEM.key}
          onPress={() => handlePress(RIGHT_ITEM.key)}
        />
      </View>
    </View>
  );
};

const shadow = {
  shadowColor: '#1E293B',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 6,
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 104,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  group: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    ...shadow,
  },
  singleGroup: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 56,
    flex: 1,
    marginHorizontal: 12,
  },
  iconTouchable: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});