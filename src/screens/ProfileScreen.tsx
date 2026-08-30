import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import {
  User,
  Users,
  UserPlus,
  UserCheck,
  Check,
  X,
  Search,
  Trash2,
  Clock,
  Sparkles,
  ShieldCheck,
  LogOut,
  Edit3,
  Save,
  Phone,
  Mail,
  Info,
  Dumbbell,
  ArrowLeft,
  Flame,
} from 'lucide-react-native';
import { Avatar } from '../components/Avatar';
import {
  UserProfile,
  getOrCreateUserProfile,
  updateUserProfile,
  generateDefaultAvatar,
} from '../utils/profileService';
import {
  fetchFriends,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  deleteFriendship,
  FriendshipItem,
} from '../utils/friendService';
import { generateRandomUsername } from '../utils/usernameGenerator';
import { supabase } from '../utils/supabase';

interface ProfileScreenProps {
  currentUser: any;
  onBack: () => void;
  onLogout: () => void;
}

type ProfileTab = 'profile' | 'friends' | 'requests' | 'add_friend';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  currentUser,
  onBack,
  onLogout,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Form Fields
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [fitnessGoal, setFitnessGoal] = useState<string>('Strength & Stamina');
  const [avatarConfig, setAvatarConfig] = useState<any>(null);
  const [isGeneratingUsername, setIsGeneratingUsername] = useState<boolean>(false);

  // Friends State
  const [friends, setFriends] = useState<FriendshipItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendshipItem[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendshipItem[]>([]);
  const [searchUsername, setSearchUsername] = useState<string>('');
  const [isSendingRequest, setIsSendingRequest] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadProfileData = useCallback(async () => {
    if (!currentUser) return;
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
    }
  }, [currentUser]);

  const loadFriendsData = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const [friendsList, incoming, outgoing] = await Promise.all([
        fetchFriends(currentUser.id),
        fetchIncomingRequests(currentUser.id),
        fetchOutgoingRequests(currentUser.id),
      ]);
      setFriends(friendsList);
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
    } catch (err) {
      console.warn('Error loading friends data:', err);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadProfileData(), loadFriendsData()]);
      setIsLoading(false);
    }
    init();
  }, [loadProfileData, loadFriendsData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfileData(), loadFriendsData()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRandomizeAvatar = () => {
    const randomSeed = `athlete_${Math.floor(Math.random() * 100000)}`;
    const newConfig = generateDefaultAvatar(randomSeed, avatarConfig?.style || 'adventurer');
    setAvatarConfig(newConfig);
  };

  const handleGenerateRandomUsername = async () => {
    setIsGeneratingUsername(true);
    try {
      const generated = await generateRandomUsername();
      if (generated) {
        setUsername(generated);
        setAvatarConfig((prev: any) => ({
          ...(prev || {}),
          seed: generated,
        }));
      }
    } catch (e) {
      console.warn('Error generating random username:', e);
    } finally {
      setIsGeneratingUsername(false);
    }
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

  const handleSendFriendRequest = async () => {
    if (!searchUsername.trim()) {
      Alert.alert('Missing Username', 'Please type the username of the athlete you want to add.');
      return;
    }
    if (!currentUser?.id) return;

    setIsSendingRequest(true);
    try {
      const result = await sendFriendRequest(currentUser.id, searchUsername.trim());
      if (result.success) {
        Alert.alert('Success 🎉', result.message || 'Friend request sent!');
        setSearchUsername('');
        await loadFriendsData();
      } else {
        Alert.alert('Request Failed', result.error || 'Could not send friend request.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptRequest = async (item: FriendshipItem) => {
    setActionLoadingId(item.friendship_id);
    try {
      const ok = await acceptFriendRequest(item.friendship_id);
      if (ok) {
        await loadFriendsData();
      } else {
        Alert.alert('Error', 'Failed to accept friend request.');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteOrReject = async (item: FriendshipItem, isRemoveFriend: boolean = false) => {
    if (isRemoveFriend) {
      Alert.alert(
        'Remove Friend',
        `Are you sure you want to remove @${item.friend.username} from your friends?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setActionLoadingId(item.friendship_id);
              try {
                await deleteFriendship(item.friendship_id);
                await loadFriendsData();
              } finally {
                setActionLoadingId(null);
              }
            },
          },
        ]
      );
      return;
    }

    setActionLoadingId(item.friendship_id);
    try {
      await deleteFriendship(item.friendship_id);
      await loadFriendsData();
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading athlete profile...</Text>
      </View>
    );
  }

  const totalRequests = incomingRequests.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D111A" />

      {/* Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.8} onPress={onBack}>
          <ArrowLeft size={18} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ATHLETE HUB</Text>
        <TouchableOpacity
          style={[styles.editButton, isEditing && styles.editButtonActive]}
          activeOpacity={0.8}
          onPress={() => {
            if (isEditing) {
              handleSaveProfile();
            } else {
              setIsEditing(true);
            }
          }}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : isEditing ? (
            <View style={styles.btnRow}>
              <Save size={14} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Save</Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Edit3 size={14} color="#C7D2FE" />
              <Text style={[styles.editButtonText, { color: '#C7D2FE' }]}>Edit</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Sub Navigation Bar for Profile & Friends */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'profile' && styles.subTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('profile')}
        >
          <User size={14} color={activeTab === 'profile' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.subTabText, activeTab === 'profile' && styles.subTabTextActive]}>
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'friends' && styles.subTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('friends')}
        >
          <Users size={14} color={activeTab === 'friends' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.subTabText, activeTab === 'friends' && styles.subTabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'requests' && styles.subTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('requests')}
        >
          <Clock size={14} color={activeTab === 'requests' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.subTabText, activeTab === 'requests' && styles.subTabTextActive]}>
            Requests
          </Text>
          {totalRequests > 0 && (
            <View style={styles.badgeCountPill}>
              <Text style={styles.badgeCountText}>{totalRequests}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeTab === 'add_friend' && styles.subTabItemActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('add_friend')}
        >
          <UserPlus size={14} color={activeTab === 'add_friend' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.subTabText, activeTab === 'add_friend' && styles.subTabTextActive]}>
            Add
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
            colors={['#6366F1', '#2563EB']}
          />
        }
      >
        {activeTab === 'profile' ? (
          <>
            {/* Hero Profile Card */}
            <View style={styles.heroCard}>
              <View style={styles.avatarWrapper}>
                <Avatar
                  username={username || currentUser?.email || 'athlete'}
                  size={100}
                  config={avatarConfig}
                />
              </View>

              {isEditing && (
                <View style={styles.avatarEditContainer}>
                  <TouchableOpacity
                    style={styles.randomizeBtn}
                    activeOpacity={0.8}
                    onPress={handleRandomizeAvatar}
                  >
                    <Sparkles size={14} color="#A5B4FC" style={{ marginRight: 4 }} />
                    <Text style={styles.randomizeBtnText}>Shuffle Look</Text>
                  </TouchableOpacity>

                  <View style={styles.styleSelectorRow}>
                    {[
                      { id: 'adventurer', label: 'Adventurer' },
                      { id: 'fun-emoji', label: 'Emoji' },
                      { id: 'bottts', label: 'Robot' },
                      { id: 'lorelei', label: 'Lorelei' },
                      { id: 'pixel-art', label: 'Pixel' },
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
                  <ShieldCheck size={13} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={styles.badgeText}>Verified Athlete</Text>
                </View>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366F1' },
                  ]}
                >
                  <Users size={13} color="#818CF8" style={{ marginRight: 4 }} />
                  <Text style={[styles.badgeText, { color: '#818CF8' }]}>
                    {friends.length} Friends
                  </Text>
                </View>
              </View>
            </View>

            {/* Profile Details Form */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>

              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>Username</Text>
                  {isEditing && (
                    <TouchableOpacity
                      style={styles.randomizeUsernameBtn}
                      activeOpacity={0.7}
                      onPress={handleGenerateRandomUsername}
                      disabled={isGeneratingUsername}
                    >
                      {isGeneratingUsername ? (
                        <ActivityIndicator size="small" color="#60A5FA" />
                      ) : (
                        <View style={styles.btnRow}>
                          <Sparkles size={11} color="#818CF8" style={{ marginRight: 4 }} />
                          <Text style={styles.randomizeUsernameBtnText}>🎲 Randomize</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
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
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea, !isEditing && styles.inputDisabled]}
                  value={bio}
                  onChangeText={setBio}
                  editable={isEditing}
                  placeholder="Tell other athletes about your fitness journey..."
                  placeholderTextColor="#64748B"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fitness Focus</Text>
                <TextInput
                  style={[styles.input, !isEditing && styles.inputDisabled]}
                  value={fitnessGoal}
                  onChangeText={setFitnessGoal}
                  editable={isEditing}
                  placeholder="e.g. Strength, Calisthenics, Hypertrophy"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            {/* Logout Action */}
            <TouchableOpacity
              style={styles.logoutButton}
              activeOpacity={0.85}
              onPress={async () => {
                try {
                  await supabase.auth.signOut();
                  onLogout();
                } catch (e) {
                  onLogout();
                }
              }}
            >
              <LogOut size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.logoutButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : activeTab === 'friends' ? (
          /* Friends List View */
          <View style={styles.friendsContainer}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>MY FRIENDS ({friends.length})</Text>
              <TouchableOpacity
                style={styles.headerActionPill}
                activeOpacity={0.7}
                onPress={() => setActiveTab('add_friend')}
              >
                <UserPlus size={13} color="#60A5FA" style={{ marginRight: 4 }} />
                <Text style={styles.headerActionPillText}>Add New</Text>
              </TouchableOpacity>
            </View>

            {friends.length === 0 ? (
              <View style={styles.emptyCard}>
                <Users size={36} color="#64748B" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyCardTitle}>No Friends Yet</Text>
                <Text style={styles.emptyCardSubtitle}>
                  Connect with athletes to compete in 1v1 duels and compare workout streaks!
                </Text>
                <TouchableOpacity
                  style={styles.addFriendPrimaryBtn}
                  activeOpacity={0.85}
                  onPress={() => setActiveTab('add_friend')}
                >
                  <UserPlus size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.addFriendPrimaryBtnText}>Find Friends</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.friendListCard}>
                {friends.map((item) => (
                  <View key={item.friendship_id} style={styles.friendRow}>
                    <Avatar
                      username={item.friend.username}
                      size={44}
                      config={item.friend.avatar_config}
                    />
                    <View style={styles.friendInfoBox}>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {item.friend.full_name || item.friend.username}
                      </Text>
                      <Text style={styles.friendUsername}>@{item.friend.username}</Text>
                      {item.friend.fitness_goal ? (
                        <Text style={styles.friendBio} numberOfLines={1}>
                          🎯 {item.friend.fitness_goal}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      style={styles.removeFriendBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteOrReject(item, true)}
                      disabled={actionLoadingId === item.friendship_id}
                    >
                      {actionLoadingId === item.friendship_id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Trash2 size={16} color="#94A3B8" />
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : activeTab === 'requests' ? (
          /* Friend Requests View */
          <View style={styles.friendsContainer}>
            {/* Incoming Requests */}
            <Text style={styles.sectionTitle}>
              INCOMING REQUESTS ({incomingRequests.length})
            </Text>

            {incomingRequests.length === 0 ? (
              <View style={styles.emptyCardMini}>
                <Text style={styles.emptyCardSubtitle}>No incoming friend requests.</Text>
              </View>
            ) : (
              <View style={styles.friendListCard}>
                {incomingRequests.map((item) => (
                  <View key={item.friendship_id} style={styles.friendRow}>
                    <Avatar
                      username={item.friend.username}
                      size={44}
                      config={item.friend.avatar_config}
                    />
                    <View style={styles.friendInfoBox}>
                      <Text style={styles.friendName}>
                        {item.friend.full_name || item.friend.username}
                      </Text>
                      <Text style={styles.friendUsername}>@{item.friend.username}</Text>
                    </View>

                    <View style={styles.requestActionRow}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        activeOpacity={0.8}
                        onPress={() => handleAcceptRequest(item)}
                        disabled={actionLoadingId === item.friendship_id}
                      >
                        {actionLoadingId === item.friendship_id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Check size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectBtn}
                        activeOpacity={0.8}
                        onPress={() => handleDeleteOrReject(item, false)}
                        disabled={actionLoadingId === item.friendship_id}
                      >
                        <X size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Outgoing Requests */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
              PENDING SENT REQUESTS ({outgoingRequests.length})
            </Text>

            {outgoingRequests.length === 0 ? (
              <View style={styles.emptyCardMini}>
                <Text style={styles.emptyCardSubtitle}>No pending sent requests.</Text>
              </View>
            ) : (
              <View style={styles.friendListCard}>
                {outgoingRequests.map((item) => (
                  <View key={item.friendship_id} style={styles.friendRow}>
                    <Avatar
                      username={item.friend.username}
                      size={44}
                      config={item.friend.avatar_config}
                    />
                    <View style={styles.friendInfoBox}>
                      <Text style={styles.friendName}>
                        {item.friend.full_name || item.friend.username}
                      </Text>
                      <Text style={styles.friendUsername}>@{item.friend.username}</Text>
                      <Text style={styles.pendingTag}>⏳ Pending Approval</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.cancelRequestBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeleteOrReject(item, false)}
                      disabled={actionLoadingId === item.friendship_id}
                    >
                      <Text style={styles.cancelRequestText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Add Friend View */
          <View style={styles.friendsContainer}>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader}>SEND FRIEND REQUEST</Text>
              <Text style={styles.addFriendHint}>
                Enter the exact username of the athlete you want to connect with.
              </Text>

              <View style={styles.searchRow}>
                <View style={styles.searchInputWrapper}>
                  <Search size={16} color="#64748B" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Enter athlete username..."
                    placeholderTextColor="#64748B"
                    value={searchUsername}
                    onChangeText={setSearchUsername}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={styles.sendRequestBtn}
                  activeOpacity={0.85}
                  onPress={handleSendFriendRequest}
                  disabled={isSendingRequest}
                >
                  {isSendingRequest ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.btnRow}>
                      <UserPlus size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.sendRequestBtnText}>Send</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoTipBox}>
              <Info size={18} color="#818CF8" style={{ marginRight: 10 }} />
              <Text style={styles.infoTipText}>
                Once the athlete accepts your request from their profile, you will be able to start private 1v1 duels and compare workout milestones!
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D111A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0D111A',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121826',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182030',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 4,
  },
  backButtonText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editButton: {
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editButtonActive: {
    backgroundColor: '#10B981',
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subTabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#121826',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#161F30',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  subTabItemActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  subTabText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  badgeCountPill: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#161F30',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  avatarWrapper: {
    marginBottom: 12,
  },
  avatarEditContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  randomizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 10,
  },
  randomizeBtnText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '700',
  },
  styleSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
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
    fontWeight: '600',
  },
  styleChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroName: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  heroUsername: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  randomizeUsernameBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  randomizeUsernameBtnText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  friendsContainer: {
    marginTop: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  headerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  headerActionPillText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyCardMini: {
    backgroundColor: '#161F30',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 10,
  },
  emptyCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  addFriendPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  addFriendPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  friendListCard: {
    backgroundColor: '#161F30',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  friendInfoBox: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  friendName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  friendUsername: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  friendBio: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  pendingTag: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  removeFriendBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  requestActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRequestBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  cancelRequestText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  addFriendHint: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 10,
  },
  sendRequestBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendRequestBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  infoTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  infoTipText: {
    color: '#CBD5E1',
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
});
