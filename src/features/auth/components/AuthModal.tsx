import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '../../../utils/supabase';
import { Avatar } from '../../../components/Avatar';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onUserChange?: (user: any) => void;
  initialMode?: 'signin' | 'signup';
}

type AuthStep = 'welcome' | 'auth' | 'verify_email' | 'profile';

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onUserChange, initialMode = 'signin' }) => {
  const [step, setStep] = useState<AuthStep>('auth');
  const [isSignUp, setIsSignUp] = useState<boolean>(initialMode === 'signup');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [username, setUsername] = useState<string>('chomuop');
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [resendStatus, setResendStatus] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setIsSignUp(initialMode === 'signup');
      setErrorMsg('');
      setResendStatus('');
    }
  }, [visible, initialMode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
      if (session?.user) {
        setUser(session.user);
        setStep('profile');
        if (onUserChange) onUserChange(session.user);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      if (session?.user) {
        setUser(session.user);
        setStep('profile');
        if (onUserChange) onUserChange(session.user);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        setStep('welcome');
        if (onUserChange) onUserChange(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async () => {
    setErrorMsg('');
    setResendStatus('');
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        });
        if (error) {
          setErrorMsg(error.message);
        } else if (data.session) {
          // Auto-confirm enabled in Supabase
          setUser(data.user);
          setStep('profile');
          if (onUserChange) onUserChange(data.user);
        } else {
          // Email confirmation is required by Supabase!
          // User must verify email before logging in.
          setStep('verify_email');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setErrorMsg(error.message);
        } else {
          setUser(data.user);
          setStep('profile');
          if (onUserChange) onUserChange(data.user);
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unexpected error during authentication');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) return;
    setResending(true);
    setErrorMsg('');
    setResendStatus('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setResendStatus('Verification email resent successfully! Check your inbox.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setUser(null);
    setStep('welcome');
    setEmail('');
    setPassword('');
    if (onUserChange) onUserChange(null);
    setLoading(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>
              {user ? '👤 User Profile' : step === 'welcome' ? 'Welcome' : step === 'verify_email' ? '✉️ Verify Email' : isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {user || step === 'profile' ? (
            <View style={styles.profileContainer}>
              <View style={styles.avatarLarge}>
                <Avatar username={user?.user_metadata?.username || user?.email || username || 'guest'} size={72} />
              </View>
              <Text style={styles.userNameText}>{user?.user_metadata?.username || username}</Text>
              <Text style={styles.userEmailText}>{user?.email}</Text>

              <View style={styles.statusBadge}>
                <View style={styles.greenDot} />
                <Text style={styles.statusBadgeText}>Online</Text>
              </View>

              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              <TouchableOpacity
                style={styles.signOutButton}
                activeOpacity={0.8}
                onPress={handleSignOut}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : step === 'verify_email' ? (
            <View style={styles.verifyContainer}>
              <View style={styles.verifyIconBadge}>
                <Text style={{ fontSize: 32 }}>📬</Text>
              </View>
              <Text style={styles.verifyTitle}>Check Your Inbox</Text>
              <Text style={styles.verifyDescription}>
                We sent a verification link to:{'\n'}
                <Text style={styles.verifyHighlightEmail}>{email}</Text>
                {'\n\n'}
                Please open the confirmation link in your email to activate your account, then proceed to sign in.
              </Text>

              {resendStatus ? <Text style={styles.successText}>{resendStatus}</Text> : null}
              {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

              <TouchableOpacity
                style={styles.getStartedButton}
                activeOpacity={0.85}
                onPress={() => {
                  setIsSignUp(false);
                  setStep('auth');
                  setErrorMsg('');
                  setResendStatus('');
                }}
              >
                <Text style={styles.getStartedButtonText}>Proceed to Sign In →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendButton}
                activeOpacity={0.8}
                onPress={handleResendVerification}
                disabled={resending}
              >
                {resending ? (
                  <ActivityIndicator color="#94A3B8" size="small" />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Verification Email</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : step === 'welcome' ? (
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeSubtext}>
                Join thousands of users tracking their fitness journey in real-time.
              </Text>

              <TouchableOpacity
                style={styles.getStartedButton}
                activeOpacity={0.85}
                onPress={() => setStep('auth')}
              >
                <Text style={styles.getStartedButtonText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                {isSignUp && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Username</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. chomuop"
                      placeholderTextColor="#64748B"
                      value={username}
                      onChangeText={setUsername}
                    />
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="name@example.com"
                    placeholderTextColor="#64748B"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748B"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <TouchableOpacity
                  style={styles.submitButton}
                  activeOpacity={0.85}
                  onPress={handleAuth}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {isSignUp ? 'Sign Up' : 'Sign In'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => {
                    setErrorMsg('');
                    setIsSignUp(!isSignUp);
                  }}
                >
                  <Text style={styles.switchModeText}>
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#182030',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  welcomeSubtext: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  getStartedButton: {
    backgroundColor: '#2563EB',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  profileContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2A3447',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userNameText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userEmailText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
  },
  keyTipText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    lineHeight: 15,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusBadgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formContainer: {
    marginTop: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  switchModeButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  verifyContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  verifyIconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  verifyDescription: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  verifyHighlightEmail: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  resendButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  successText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
});
