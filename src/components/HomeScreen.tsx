import React, { useState, useEffect } from 'react';
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

export type { ModelComplexity };
export { getRecommendedModel };

interface HomeScreenProps {
  onOpenCamera: () => void;
  selectedModel: ModelComplexity;
  onSelectModel: (model: ModelComplexity) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenCamera,
  selectedModel,
  onSelectModel,
}) => {
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [deviceName, setDeviceName] = useState<string>('Mobile Device');
  const [totalRamGb, setTotalRamGb] = useState<number>(4.0);
  const [recommendedModel, setRecommendedModel] = useState<ModelComplexity>('medium');

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" hidden />

      <View style={styles.landscapeRow}>
        {/* Left Column: Title & Info */}
        <View style={styles.leftColumn}>
          <View style={styles.badgeContainer}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Horizontal Mode</Text>
          </View>

          <Text style={styles.title}>Camera Test App</Text>
          <Text style={styles.subtitle}>
            Landscape AI Pose Tracking. Tap the card to launch selfie preview.
          </Text>

          <TouchableOpacity
            style={styles.settingsButton}
            activeOpacity={0.8}
            onPress={() => setShowSettingsModal(true)}
          >
            <Text style={styles.settingsButtonText}>⚙️ Hardware Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Right Column: Interactive Card */}
        <View style={styles.rightColumn}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={onOpenCamera}
          >
            <View style={styles.cardAccentBar} />

            <View style={styles.cardBody}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>🤳</Text>
              </View>

              <Text style={styles.cardTitle}>Test Camera</Text>

              <View style={styles.activeModelBadge}>
                <Text style={styles.activeModelBadgeText}>
                  Model: {getModelTitle(selectedModel)}
                  {selectedModel === recommendedModel ? ' (Recommended)' : ''}
                </Text>
              </View>

              <View style={styles.actionPill}>
                <Text style={styles.actionPillText}>Open Camera →</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Modal */}
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
              {/* Hardware Spec Card */}
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

              <Text style={styles.modelSectionHeading}>Select AI Pose Model:</Text>

              {/* Option 1: Light Model */}
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

              {/* Option 2: Medium Model */}
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

              {/* Option 3: High Model */}
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
    backgroundColor: '#0F172A',
  },
  landscapeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  leftColumn: {
    flex: 1,
    paddingRight: 24,
    justifyContent: 'center',
  },
  rightColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  badgeText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 20,
    marginBottom: 20,
  },
  settingsButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    alignSelf: 'flex-start',
  },
  settingsButtonText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  cardAccentBar: {
    height: 6,
    backgroundColor: '#6366F1',
    width: '100%',
  },
  cardBody: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  iconText: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  activeModelBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginBottom: 16,
  },
  activeModelBadgeText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '600',
  },
  actionPill: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
  },
  actionPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
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
    backgroundColor: '#6366F1',
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
