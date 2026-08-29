import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import {
  UserProfile,
  getOrCreateUserProfile,
  updateUserProfile,
  generateDefaultAvatar,
} from '../utils/profileService';
import { supabase } from '../utils/supabase';

interface ProfileScreenProps {
  currentUser: any;
  onBack: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentUser,
  onBack,
  onLogout,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Form Fields
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [fitnessGoal, setFitnessGoal] = useState<string>('Strength & Stamina');
  const [avatarConfig, setAvatarConfig] = useState<any>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        const data = await getOrCreateUserProfile(currentUser);
        setProfile(data);
        setUsername(data.username || '');
        setFullName(data.full_name || '');
        setPhoneNumber(data.phone_number || '');
        setBio(data.bio || '');
        setFitnessGoal(data.fitness_goal || 'Strength & Stamina');
        setAvatarConfig(data.avatar_config || generateDefaultAvatar(data.username || 'user'));
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [currentUser]);

  const handleRandomizeAvatar = () => {
    const randomSeed = `athlete_${Math.floor(Math.random() * 100000)}`;
    const newConfig = generateDefaultAvatar(randomSeed);
    setAvatarConfig(newConfig);
  };

  const handleSaveProfile = async () => {
    if (!currentUser?.id) return;
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateUserProfile(currentUser.id, {
        username: username.trim(),
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        bio: bio.trim(),
        fitness_goal: fitnessGoal,
        avatar_config: avatarConfig,
      });

      if (result.success) {
        setProfile((prev) => (prev ? { ...prev, ...result.data } : null));
        setIsEditing(false);
        Alert.alert('Success', 'Your profile has been updated!');
      } else {
        Alert.alert('Update Failed', result.error || 'Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of plato?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          onLogout();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your athlete profile...</Text>
      </View>
    );
  }

  const winRate =
    profile && profile.matches_played > 0
      ? Math.round((profile.matches_won / profile.matches_played) * 100)
      : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D111A" />

      {/* Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ATHLETE PROFILE</Text>
        <TouchableOpacity
          style={[styles.editToggleBtn, isEditing && styles.editToggleBtnActive]}
          activeOpacity={0.8}
          onPress={() => {
            if (isEditing) {
              handleSaveProfile();
            } else {
              setIsEditing(true);
            }
          }}
        >
          <Text style={styles.editToggleBtnText}>{isEditing ? (isSaving ? 'Saving...' : 'Done') : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Hero Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrapper}>
            <Avatar username={username || 'athlete'} size={110} config={avatarConfig} />
          </View>

          {isEditing && (
            <View style={styles.avatarEditContainer}>
              <TouchableOpacity
                style={styles.randomizeBtn}
                activeOpacity={0.8}
                onPress={handleRandomizeAvatar}
              >
                <Text style={styles.randomizeBtnText}>🎲 Randomize Avatar</Text>
              </TouchableOpacity>

              <View style={styles.styleSelectorRow}>
                {[
                  { id: 'adventurer', label: '🧙 Adventurer' },
                  { id: 'fun-emoji', label: '😃 Emoji' },
                  { id: 'bottts', label: '🤖 Robot' },
                  { id: 'lorelei', label: '🌸 Lorelei' },
                  { id: 'pixel-art', label: '👾 Pixel' },
                ].map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.styleChip,
                      avatarConfig?.style === st.id && styles.styleChipActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setAvatarConfig((prev: any) => ({
                        ...(prev || {}),
                        seed: prev?.seed || username || 'athlete',
                        style: st.id,
                      }));
                    }}
                  >
                    <Text
                      style={[
                        styles.styleChipText,
                        avatarConfig?.style === st.id && styles.styleChipTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.heroName}>{fullName || username || 'plato Athlete'}</Text>
          <Text style={styles.heroUsername}>@{username || 'athlete'}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badgePill}>
              <Text style={styles.badgeText}>⚡ Verified Athlete</Text>
            </View>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366F1' }]}>
              <Text style={[styles.badgeText, { color: '#818CF8' }]}>🏆 Rank: Gold</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🏋️</Text>
            <Text style={styles.statValue}>{profile?.total_squats || 0}</Text>
            <Text style={styles.statLabel}>Total Squats</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⚔️</Text>
            <Text style={styles.statValue}>{profile?.matches_played || 0}</Text>
            <Text style={styles.statLabel}>1v1 Duels</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>👑</Text>
            <Text style={styles.statValue}>{profile?.matches_won || 0}</Text>
            <Text style={styles.statLabel}>Victories</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{winRate}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>

        {/* Profile Details Form */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={username}
              onChangeText={setUsername}
              editable={isEditing}
              placeholder="e.g. alex_fitness"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={fullName}
              onChangeText={setFullName}
              editable={isEditing}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              editable={isEditing}
              placeholder="e.g. +1 555-0199"
              placeholderTextColor="#64748B"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Registered Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={currentUser?.email || 'user@example.com'}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio / Motivation</Text>
            <TextInput
              style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
              value={bio}
              onChangeText={setBio}
              editable={isEditing}
              placeholder="Tell others what drives your workouts..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Primary Fitness Goal</Text>
            <TextInput
              style={[styles.input, !isEditing && styles.inputDisabled]}
              value={fitnessGoal}
              onChangeText={setFitnessGoal}
              editable={isEditing}
              placeholder="e.g. Hypertrophy, Mobility, 1v1 Dominance"
              placeholderTextColor="#64748B"
            />
          </View>
        </View>

        {/* Action Buttons */}
        {isEditing ? (
          <TouchableOpacity
            style={styles.saveActionButton}
            activeOpacity={0.85}
            onPress={handleSaveProfile}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveActionButtonText}>💾 Save Profile Changes</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.editActionButton}
            activeOpacity={0.85}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.editActionButtonText}>✏️ Edit Profile</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.85}
          onPress={handleLogoutPress}
        >
          <Text style={styles.logoutButtonText}>🚪 Log Out of plato</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D111A',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#121826',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  editToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  editToggleBtnActive: {
    backgroundColor: '#6366F1',
  },
  editToggleBtnText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  avatarWrapper: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarEditContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  randomizeBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
  },
  randomizeBtnText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700',
  },
  styleSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  styleChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  styleChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#818CF8',
  },
  styleChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  styleChipTextActive: {
    color: '#FFFFFF',
  },
  heroName: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  heroUsername: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  badgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#161F30',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#161F30',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 18,
  },
  sectionHeader: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  inputDisabled: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    color: '#CBD5E1',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  saveActionButton: {
    backgroundColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  saveActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  editActionButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  editActionButtonText: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '800',
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
