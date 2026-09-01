import React, { useState, useEffect } from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

export interface ExerciseIconProps {
  imageUrl?: string;
  icon?: string;
  size?: number;
  fontSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// In-memory cache for remote SVG text to prevent redundant re-fetching
const svgCache: Record<string, string> = {};

export const ExerciseIcon: React.FC<ExerciseIconProps> = ({
  imageUrl,
  icon = '🏋️',
  size = 40,
  fontSize,
  containerStyle,
  imageStyle,
  textStyle,
}) => {
  const [svgContent, setSvgContent] = useState<string | null>(() => {
    if (imageUrl && (imageUrl.includes('.svg') || imageUrl.includes('svg+xml')) && svgCache[imageUrl]) {
      return svgCache[imageUrl];
    }
    return null;
  });
  const [loadError, setLoadError] = useState(false);

  const cleanUrl = imageUrl?.trim();
  const isSvg = !!cleanUrl && (cleanUrl.toLowerCase().includes('.svg') || cleanUrl.toLowerCase().includes('svg+xml'));

  useEffect(() => {
    let isMounted = true;
    setLoadError(false);

    if (!cleanUrl) {
      setSvgContent(null);
      return;
    }

    if (isSvg) {
      if (svgCache[cleanUrl]) {
        setSvgContent(svgCache[cleanUrl]);
        return;
      }

      fetch(cleanUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((xml) => {
          if (isMounted) {
            if (xml.includes('<svg')) {
              svgCache[cleanUrl] = xml;
              setSvgContent(xml);
            } else {
              setLoadError(true);
            }
          }
        })
        .catch((err) => {
          console.warn('[ExerciseIcon] Failed to load SVG URL:', cleanUrl, err);
          if (isMounted) {
            setLoadError(true);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [cleanUrl, isSvg]);

  const calculatedFontSize = fontSize ?? Math.round(size * 0.7);

  if (cleanUrl && !loadError) {
    if (isSvg) {
      if (svgContent) {
        return (
          <View style={[styles.container, { width: size, height: size }, containerStyle]}>
            <SvgXml
              xml={svgContent}
              width={size}
              height={size}
              style={[styles.image, imageStyle]}
            />
          </View>
        );
      }
    } else {
      // Standard bitmap image (PNG, JPG, WebP)
      return (
        <View style={[styles.container, { width: size, height: size }, containerStyle]}>
          <Image
            source={{ uri: cleanUrl }}
            style={[styles.image, { width: size, height: size }, imageStyle]}
            resizeMode="contain"
            onError={() => setLoadError(true)}
          />
        </View>
      );
    }
  }

  // Fallback to emoji icon
  return (
    <View style={[styles.container, { width: size, height: size }, containerStyle]}>
      <Text style={[styles.emojiText, { fontSize: calculatedFontSize }, textStyle]}>
        {icon}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  emojiText: {
    textAlign: 'center',
    includeFontPadding: false,
    backgroundColor: 'transparent',
  },
});
