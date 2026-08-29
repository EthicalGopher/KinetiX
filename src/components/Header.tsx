import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from './Avatar';
import { useMatchmakingStore } from '../store/matchmakingStore';
import { useUserStore } from '../store/userStore';

export interface HeaderProps {
  title?: string;
  username?: string;
  onlineCount?: number;
  onProfilePress?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'plato',
  username: propUsername,
  onlineCount: propOnlineCount,
  onProfilePress,
  leftAction,
  rightAction,
}) => {
  const storeOnline = useMatchmakingStore((state) => state.total_online);
  const { profile, user, setActiveTab } = useUserStore();

  const activeUsername =
    propUsername ||
    profile?.username ||
    profile?.full_name ||
    user?.user_metadata?.username ||
    user?.email?.split('@')[0] ||
    'athlete';

  const avatarConfig = profile?.avatar_config;
  const displayOnlineCount = propOnlineCount !== undefined ? propOnlineCount : storeOnline;

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      setActiveTab('profile');
    }
  };

  const leftContent = leftAction ?? (
    <TouchableOpacity
      style={styles.avatarContainer}
      activeOpacity={0.8}
      onPress={handleProfilePress}
    >
      <View style={styles.avatarCircle}>
        <Avatar username={activeUsername} size={36} config={avatarConfig} />
      </View>
      <View style={styles.onlineDot} />
    </TouchableOpacity>
  );

  const defaultRightAction = (
    <View style={styles.pointsBadge}>
      <View style={styles.greenDot} />
      <Text style={styles.pointsText}>{displayOnlineCount}</Text>
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={styles.headerSlot}>{leftContent}</View>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.headerSlot, styles.rightSlot]}>
        {rightAction ?? defaultRightAction}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#111622',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerSlot: {
    width: 92,
    alignItems: 'flex-start',
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#111622',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
  },
});
