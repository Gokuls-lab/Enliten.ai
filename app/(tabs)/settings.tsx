import React from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { resetAdaptiveProgress } from '@/lib/flashcards';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bell, Calendar, ChevronRight, Crown, Globe, CircleHelp as HelpCircle, LogOut, Mail, Moon, Shield, Sun, Trash2, User, Sparkles, RefreshCw } from 'lucide-react-native';
import { PACKAGE_TYPE } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [language, setLanguage] = React.useState('en');
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const { user, signOut } = useAuth();
  const { isPro, customerInfo, currentOffering } = useRevenueCat();
  const { exam } = useExam();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = React.useState(true);
  const [soundEffects, setSoundEffects] = React.useState(true);
  const [dailyReminders, setDailyReminders] = React.useState(true);
  
  const [usageStatus, setUsageStatus] = React.useState<any>(null);
  const [loadingUsage, setLoadingUsage] = React.useState(true);
  const [refreshingUsage, setRefreshingUsage] = React.useState(false);

  const NOTIFICATIONS_KEY = 'notifications_enabled';
  const SOUND_KEY = 'sound_effects_enabled';
  const REMINDER_KEY = 'daily_reminders_enabled';

  const fetchUsage = React.useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) {
      setRefreshingUsage(true);
    } else {
      setLoadingUsage(true);
    }
    try {
      const { data, error } = await supabase.rpc('get_user_usage_status', { p_user_id: user.id });
      if (!error && data) {
        setUsageStatus(data);
      }
    } catch (err) {
      console.error('Error fetching usage', err);
    } finally {
      if (isRefresh) {
        setRefreshingUsage(false);
      } else {
        setLoadingUsage(false);
      }
    }
  }, [user]);

  React.useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const pulseAnim = React.useRef(new Animated.Value(0.5)).current;
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  React.useEffect(() => {
    if (refreshingUsage) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ).start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
  }, [refreshingUsage, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const renderSkeleton = () => (
    <View style={{ gap: 12 }}>
      {[1, 2].map(i => (
        <View key={i} style={styles.usageCard}>
          <View style={styles.usageHeader}>
            <Animated.View style={{ width: 100, height: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 8, opacity: pulseAnim }} />
            <Animated.View style={{ width: 40, height: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 8, opacity: pulseAnim }} />
          </View>
          <Animated.View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 4, marginVertical: 12, opacity: pulseAnim }} />
          <Animated.View style={{ width: 150, height: 14, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', borderRadius: 7, opacity: pulseAnim }} />
        </View>
      ))}
    </View>
  );

  const formatTimeLeft = (resetTimeStr: string | null) => {
    if (!resetTimeStr) return 'No usage yet';
    const resetTime = new Date(resetTimeStr).getTime();
    const now = new Date().getTime();
    const diff = resetTime - now;
    
    if (diff <= 0) return 'Window refreshed';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `Resets in ${days}d ${hours}h ${minutes}m`;
    return `Resets in ${hours} hours ${minutes} minutes`;
  };

  React.useEffect(() => {
    // Load persisted settings
    (async () => {
      const notif = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      const sound = await AsyncStorage.getItem(SOUND_KEY);
      const reminder = await AsyncStorage.getItem(REMINDER_KEY);
      if (notif !== null) setNotifications(notif === 'true');
      if (sound !== null) setSoundEffects(sound === 'true');
      if (reminder !== null) setDailyReminders(reminder === 'true');
    })();
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem(NOTIFICATIONS_KEY, notifications.toString());
    if (notifications) {
      Notifications.requestPermissionsAsync();
    } else {
      Notifications.cancelAllScheduledNotificationsAsync();
    }
  }, [notifications]);

  React.useEffect(() => {
    AsyncStorage.setItem(SOUND_KEY, soundEffects.toString());
    // Use soundEffects state elsewhere in app to mute/unmute
  }, [soundEffects]);

  React.useEffect(() => {
    AsyncStorage.setItem(REMINDER_KEY, dailyReminders.toString());
    if (dailyReminders) {
      // Schedule daily reminder at 8am
      Notifications.cancelAllScheduledNotificationsAsync();
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Study Reminder',
          body: 'Time to practice on Cyber Cruciora!',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 8,
          minute: 0,
        },
      }).catch(e => console.log('Notification scheduling error:', e.message));
    } else {
      Notifications.cancelAllScheduledNotificationsAsync();
    }
  }, [dailyReminders]);

  // Handlers for support links
  const handleHelp = () => {
    router.push('/help');
  };
  const handleContact = () => {
    Linking.openURL('mailto:support@thecybercruciora.com');
  };
  const handlePrivacy = () => {
    WebBrowser.openBrowserAsync('https://thecybercruciora.com/privacy');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  };

  const handleUpgrade = () => {
    Alert.alert(
      'Upgrade to Premium',
      'Unlock all quiz modes, detailed analytics, and unlimited practice questions.',
      [
        { text: 'Maybe Later', style: 'cancel' },
        { text: 'Upgrade Now', onPress: () => router.push('/subscription') },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      "Reset All Progress",
      "Warning:- This will permanently erase data for the current exam:\n\n• Your quiz history and results\n• All performance statistics\n• Study time tracking\n• Achievement records\n• Level Up Progress\n\nThis action cannot be undone. Do you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete quiz sessions for the current exam
              await supabase
                .from('quiz_sessions')
                .delete()
                .eq('user_id', user?.id)
                .eq('exam_id', exam.id);

              // Get all question IDs for the current exam to delete associated answers
              const { data: examQuestions, error: questionsError } = await supabase
                .from('questions')
                .select('id')
                .eq('exam', exam.id);

              if (questionsError) throw questionsError;

              const questionIds = examQuestions.map(q => q.id);

              if (questionIds.length > 0) {
                // Delete user answers for the questions in the current exam
                await supabase
                  .from('user_answers')
                  .delete()
                  .eq('user_id', user?.id)
                  .in('question_id', questionIds);
              }

              // Note: user_progress is not exam-specific, so we might not want to reset it here
              // or we need a more granular progress tracking per exam.
              // For now, we'll leave it as is, but it's a point for future improvement.
              // Delete user_progress
              console.log('[SettingsScreen] Resetting level for:', { uid: user?.id, examId: exam?.id });
              const { error: rpcError } = await supabase.rpc('update_exam_stage', {
                uid: user?.id,
                exam_id: exam?.id,
                new_stage: 0,
              });

              if (rpcError) {
                console.error('[SettingsScreen] RPC Error:', rpcError);
                throw rpcError;
              } else {
                console.log('[SettingsScreen] Level reset RPC successful');
              }


              // Reset Adaptive Flashcard Progress
              if (user?.id) {
                await resetAdaptiveProgress(user.id, exam?.id);
              }

              ToastAndroid.show('All progress has been reset successfully', ToastAndroid.SHORT);
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Define dynamic titles (same as subscription page)
  const PACKAGE_TITLES: Partial<Record<PACKAGE_TYPE, string>> = {
    [PACKAGE_TYPE.MONTHLY]: "Cyber Starter (Monthly)",
    [PACKAGE_TYPE.THREE_MONTH]: "Cyber Shield (Quarterly)",
    [PACKAGE_TYPE.SIX_MONTH]: "Cyber Sentinel (Semi-Annual)",
    [PACKAGE_TYPE.ANNUAL]: "Cyber Guardian (Annual)",
    [PACKAGE_TYPE.LIFETIME]: "Cyber Elite (Lifetime)",
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 90 }}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Your profile information</Text>
          </View>

          {/* Profile Section */}
          <View style={styles.section}>
            {/* <Text style={styles.sectionTitle}>Profile</Text> */}
            <View style={styles.profileCard}>
              <View style={styles.profileInfo}>
                <View style={styles.avatar}>
                  {user?.avatar_url ? (
                    <ExpoImage
                      source={{ uri: user.avatar_url }}
                      style={{ width: '100%', height: '100%', borderRadius: 16 }}
                      priority="high"
                      contentFit="cover"
                      transition={1000}
                    />
                  ) : (
                    <User size={24} color={colors.text} strokeWidth={2} />
                  )}
                </View>
                <View style={styles.profileText}>
                  <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
                  <Text style={styles.profileEmail}>{user?.email}</Text>
                  {/* Only show the small badge when NOT premium - Premium users see the detailed card below */}
                  {!isPro && (
                    <View style={styles.subscriptionBadge}>
                      <Crown size={14} color="#64748B" strokeWidth={2} />
                      <Text style={[styles.subscriptionText, { color: colors.subText }]}>
                        Free Plan
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {/* <TouchableOpacity onPress={() => router.push('/profile')}>
                <ChevronRight size={20} color="#94A3B8" strokeWidth={2} />
              </TouchableOpacity> */}
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/exam-selection')}>
              <View style={styles.menuItemInfo}>
                <Text style={styles.menuItemText}>Course Selection</Text>
              </View>
              <ChevronRight size={20} color={colors.subText} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Subscription Section */}
          {/* Subscription Section */}
          <View style={styles.section}>
            {!isPro ? (
              <TouchableOpacity style={styles.premiumCard} onPress={handleUpgrade}>
                <LinearGradient
                  colors={["#F59E0B", '#D97706']}
                  style={styles.premiumGradient}
                >
                  <Crown size={24} color="#0F172A" strokeWidth={2} />
                  <View style={styles.premiumText}>
                    <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                    <Text style={styles.premiumSubtitle}>Unlock all features and quiz modes</Text>
                  </View>
                  <ChevronRight size={20} color="#0F172A" strokeWidth={2} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={[styles.premiumCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.primaryMuted,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 14
                  }}>
                    <Crown size={22} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: 2 }}>Pro Access</Text>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Active Subscription</Text>
                  </View>
                </View>

                {(() => {
                  // Get the first active entitlement dynamically
                  const activeEntitlements = customerInfo?.entitlements?.active ?? {};
                  const entitlementKeys = Object.keys(activeEntitlements);
                  const ent = entitlementKeys.length > 0 ? activeEntitlements[entitlementKeys[0]] : null;

                  const expiration = ent?.expirationDate || customerInfo?.latestExpirationDate;
                  const productIdentifier = ent?.productIdentifier;
                  const isSandbox = ent?.isSandbox;

                  // Format the date properly
                  let dateStr = 'Lifetime';
                  if (expiration) {
                    const expDate = new Date(expiration);
                    dateStr = expDate.toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });
                  }

                  // Resolve detailed Plan Name using Current Offering
                  // 1. Try to find the package in the current offering that matches this product ID
                  let displayTitle = 'Premium Subscription';

                  if (productIdentifier) {
                    // Attempt to find matching package
                    const matchingPackage = currentOffering?.availablePackages.find(
                      pkg => pkg.product.identifier === productIdentifier
                    );

                    if (matchingPackage) {
                      // Best case: Found in offering, use mapped title
                      displayTitle = PACKAGE_TITLES[matchingPackage.packageType] || matchingPackage.product.title;
                    } else {
                      // Fallback: Check ID string for clues
                      const lowerId = productIdentifier.toLowerCase();
                      if (lowerId.includes('month')) displayTitle = "Cyber Starter (Monthly)";
                      else if (lowerId.includes('quarter') || lowerId.includes('3_month')) displayTitle = "Cyber Shield (Quarterly)";
                      else if (lowerId.includes('half') || lowerId.includes('6_month')) displayTitle = "Cyber Sentinel (Semi-Annual)";
                      else if (lowerId.includes('year') || lowerId.includes('annual')) displayTitle = "Cyber Guardian (Annual)";
                      else if (lowerId.includes('life')) displayTitle = "Cyber Elite (Lifetime)";
                      else {
                        // Last resort: Capitalize ID
                        displayTitle = productIdentifier.charAt(0).toUpperCase() + productIdentifier.slice(1).replace(/_/g, ' ');
                      }
                    }
                  }

                  return (
                    <View style={{ width: '100%' }}>
                      <View style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 16
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                          <Text style={{ color: colors.subText, fontSize: 14 }}>Plan Type</Text>
                          <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }}>{displayTitle}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: colors.subText, fontSize: 14 }}>Renewal Date</Text>
                          <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }}>{dateStr}</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        onPress={() => {
                          if (isSandbox) {
                            if (Platform.OS === 'android') {
                              ToastAndroid.show('Test Mode: Cannot cancel manually', ToastAndroid.SHORT);
                            } else {
                              Alert.alert('Test Mode', 'In Sandbox, subscriptions expire automatically.');
                            }
                          } else {
                            if (customerInfo?.managementURL) {
                              Linking.openURL(customerInfo.managementURL);
                            } else {
                              Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
                            }
                          }
                        }}
                        style={{
                          paddingVertical: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'transparent'
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginRight: 8 }}>Manage Subscription</Text>
                        <ChevronRight size={16} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </View>
            )}
          </View>

          {/* AI Usage Limits Section */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>AI Mentor Usage</Text>
              <TouchableOpacity onPress={() => fetchUsage(true)} disabled={refreshingUsage || loadingUsage} style={{ padding: 4 }}>
                <Animated.View style={{ opacity: refreshingUsage ? 0.7 : 1, transform: [{ rotate: spin }] }}>
                  <RefreshCw size={18} color={colors.subText} />
                </Animated.View>
              </TouchableOpacity>
            </View>
            
            {loadingUsage ? (
              renderSkeleton()
            ) : usageStatus ? (
              <Animated.View style={{ gap: 12, opacity: refreshingUsage ? 0.6 : 1 }}>
                {/* 5-Hour / Rolling Usage */}
                <View style={styles.usageCard}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageTitle}>Rolling Usage</Text>
                    <Text style={styles.usagePercentage}>{usageStatus.five_hour.percentage}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${usageStatus.five_hour.percentage}%`, backgroundColor: usageStatus.five_hour.percentage >= 100 ? '#EF4444' : '#3B82F6' }]} />
                  </View>
                  <Text style={styles.usageNextReset}>
                    {formatTimeLeft(usageStatus.five_hour.next_reset)}
                  </Text>
                </View>

                {/* 7-Day / Weekly Usage */}
                <View style={styles.usageCard}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.usageTitle}>Weekly Usage</Text>
                    <Text style={styles.usagePercentage}>{usageStatus.seven_day.percentage}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${usageStatus.seven_day.percentage}%`, backgroundColor: usageStatus.seven_day.percentage >= 100 ? '#EF4444' : '#3B82F6' }]} />
                  </View>
                  <Text style={styles.usageNextReset}>
                    {formatTimeLeft(usageStatus.seven_day.next_reset)}
                  </Text>
                </View>
              </Animated.View>
            ) : (
              <View style={[styles.usageCard, { justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }]}>
                <Text style={{color: colors.subText}}>Usage info unavailable</Text>
              </View>
            )}
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Globe size={20} color={colors.text} strokeWidth={2} />
                <Text style={styles.settingText}>{"Language"}</Text>
              </View>
              <Switch
                value={language === "ta"}
                onValueChange={(val) => {
                  setLanguage(val ? 'ta' : 'en');
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
              <Text style={{ position: 'absolute', right: 65, color: colors.subText }}>{language === 'ta' ? 'தமிழ்' : 'English'}</Text>
            </View>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                {isDark ? (
                  <Moon size={20} color={colors.text} strokeWidth={2} />
                ) : (
                  <Sun size={20} color={colors.text} strokeWidth={2} />
                )}
                <Text style={styles.settingText}>Dark Mode</Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Bell size={20} color={colors.text} strokeWidth={2} />
                <Text style={styles.settingText}>Push Notifications</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Calendar size={20} color={colors.text} strokeWidth={2} />
                <Text style={styles.settingText}>Daily Study Reminders</Text>
              </View>
              <Switch
                value={dailyReminders}
                onValueChange={setDailyReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {/* <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Volume2 size={20} color="#F8FAFC" strokeWidth={2} />
                <Text style={styles.settingText}>Sound Effects</Text>
              </View>
              <Switch
                value={soundEffects}
                onValueChange={setSoundEffects}
                trackColor={{ false: '#475569', true: '#8A2BE2' }}
                thumbColor="#FFFFFF"
              />
            </View> */}
          </View>

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>

            <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
              <View style={styles.menuItemInfo}>
                <HelpCircle size={20} color={colors.text} strokeWidth={2} />
                <Text style={styles.menuItemText}>Help & FAQ</Text>
              </View>
              <ChevronRight size={20} color={colors.subText} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleContact}>
              <View style={styles.menuItemInfo}>
                <Mail size={20} color={colors.text} strokeWidth={2} />
                <Text style={styles.menuItemText}>Contact Support</Text>
              </View>
              <ChevronRight size={20} color={colors.subText} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handlePrivacy}>
              <View style={styles.menuItemInfo}>
                <Shield size={20} color={colors.text} strokeWidth={2} />
                <Text style={styles.menuItemText}>Privacy Policy</Text>
              </View>
              <ChevronRight size={20} color={colors.subText} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <View style={{ ...styles.section, paddingBottom: vs(20) }}>
            <Text style={styles.sectionTitle}>Account</Text>

            <TouchableOpacity style={[styles.menuItem, styles.dangerItem]} onPress={handleResetData}>
              <View style={styles.menuItemInfo}>
                <Trash2 size={20} color="#EF4444" strokeWidth={2} />
                <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Reset All Progress</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
              <View style={styles.menuItemInfo}>
                <LogOut size={20} color="#EF4444" strokeWidth={2} />
                <Text style={[styles.menuItemText, { color: '#EF4444' }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    // paddingTop removed (dynamic)
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 20, // Reduced from 40
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subText,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.subText,
    marginBottom: 8,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subscriptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  premiumCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  premiumText: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  premiumSubtitle: {
    fontSize: 14,
    color: '#1E293B',
  },
  settingItem: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  menuItem: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  menuItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  signOutItem: {
    borderColor: '#7F1D1D',
    backgroundColor: colors.card,
  },
  dangerItem: {
    borderColor: '#7F1D1D',
    backgroundColor: colors.card,
    marginBottom: 12,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  appVersion: {
    fontSize: 14,
    color: colors.subText,
    marginBottom: 4,
  },
  appCopyright: {
    fontSize: 12,
    color: colors.subText,
  },
  usageCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  usageCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  usageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageNextReset: {
    fontSize: 13,
    color: colors.subText,
  },
  usagePercentage: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
