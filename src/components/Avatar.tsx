import React, { useState, useMemo } from 'react';
import { StyleSheet, View, Image, Text } from 'react-native';

export type AvatarStyle = 'adventurer' | 'fun-emoji' | 'bottts' | 'lorelei' | 'thumbs' | 'pixel-art';

export interface AvatarConfig {
  seed: string;
  style?: AvatarStyle;
  bgColor?: string;
}

export interface AvatarProps {
  username?: string;
  size?: number;
  config?: AvatarConfig | string | any;
  customStyle?: any;
}

const AVATAR_BG_COLORS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf', 'c7f9cc', 'ffbe0b'];

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

export const getAvatarUri = (seed: string, style: AvatarStyle = 'adventurer', bgColor?: string): string => {
  const cleanSeed = encodeURIComponent(seed.trim() || 'athlete');
  const bg = bgColor || AVATAR_BG_COLORS[Math.abs(hashString(seed)) % AVATAR_BG_COLORS.length];
  return `https://api.dicebear.com/9.x/${style}/png?seed=${cleanSeed}&backgroundColor=${bg}&radius=50&size=256`;
};

export const Avatar: React.FC<AvatarProps> = ({
  username = 'athlete',
  size = 36,
  config,
  customStyle,
}) => {
  const [imageError, setImageError] = useState(false);

  const { seed, style, bgColor } = useMemo(() => {
    if (typeof config === 'string') {
      return { seed: config, style: 'adventurer' as AvatarStyle, bgColor: undefined };
    }
    if (config && typeof config === 'object') {
      return {
        seed: config.seed || username || 'athlete',
        style: (config.style as AvatarStyle) || 'adventurer',
        bgColor: config.bgColor,
      };
    }
    return { seed: username || 'athlete', style: 'adventurer' as AvatarStyle, bgColor: undefined };
  }, [config, username]);

  const uri = useMemo(() => getAvatarUri(seed, style, bgColor), [seed, style, bgColor]);

  const fallbackColor = useMemo(() => {
    const colors = ['#2563EB', '#0F766E', '#B45309', '#BE123C', '#4338CA', '#7C3AED'];
    return colors[Math.abs(hashString(seed)) % colors.length];
  }, [seed]);

  const initial = (seed.charAt(0) || '?').toUpperCase();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fallbackColor,
        },
        customStyle,
      ]}
    >
      {!imageError ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.fallbackText, { fontSize: size * 0.42 }]}>{initial}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

