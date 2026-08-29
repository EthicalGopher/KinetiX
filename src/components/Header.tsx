import React, { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Avatar } from './Avatar';

interface HeaderProps {
  username?: string;
  onlineCount?: number;
  onProfilePress?: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  username = 'guest',
  onlineCount,
  onProfilePress,
  leftAction,
  rightAction,
}) => {
  const leftContent = leftAction ?? (
    <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8} onPress={onProfilePress}>
      <View style={styles.avatarCircle}>
        <Avatar username={username} size={36} />
      </View>
      <View style={styles.onlineDot} />
    </TouchableOpacity>
  );

  const defaultRightAction = onlineCount === undefined ? <View style={styles.headerSlot} /> : (
    <View style={styles.pointsBadge}>
      <View style={styles.greenDot} />
      <Text style={styles.pointsText}>{onlineCount}</Text>
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={styles.headerSlot}>{leftContent}</View>
      <Text style={styles.title}>plato</Text>
      <View style={[styles.headerSlot, styles.rightSlot]}>{rightAction ?? defaultRightAction}</View>
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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
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
});
