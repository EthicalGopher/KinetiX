import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  username: string;
  size?: number;
}

const getSeedValue = (username: string) => {
  return username.split('').reduce((value, character) => value + character.charCodeAt(0), 0);
};

export const Avatar: React.FC<AvatarProps> = ({ username, size = 36 }) => {
  const label = username.trim().charAt(0).toUpperCase() || '?';
  const colors = ['#2563EB', '#0F766E', '#B45309', '#BE123C', '#4338CA'];
  const backgroundColor = colors[getSeedValue(username) % colors.length];

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <Text style={[styles.label, { fontSize: size * 0.42 }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
