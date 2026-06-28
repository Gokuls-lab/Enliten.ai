import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  FadeInLeft,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import {
  ChartBar as BarChart,
  Bell,
  BookOpen,
  Calendar,
  Calendar1,
  CheckCircle,
  ChevronRight,
  Clock,
  Crown,
  CreditCard as Edit,
  Layers,
  Target,
  TrendingUp,
  X,
  Bot,
  Quote,
  Sparkles,
  Zap,
  Shield,
  Star,
  Play,
  Infinity,
  Sparkle,
  PhoneCall,
  FileText,
  Newspaper,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';

// ─── RESPONSIVE UTILITIES ────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;

// Soft background colors for subject initials
const SOFT_COLORS = [
  '#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF3E0', '#FCE4EC',
  '#E0F7FA', '#F1F8E9', '#FFF8E1', '#FBE9E7', '#EDE7F6',
];

// Generate consistent color from subject name
const getSubjectColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SOFT_COLORS[Math.abs(hash) % SOFT_COLORS.length];
};

// Subject Initial Fallback Component
const SubjectInitial = ({ name, size = 48 }: { name: string; size?: number }) => {
  const initial = name?.charAt(0)?.toUpperCase() || 'S';
  const bgColor = getSubjectColor(name || 'Subject');
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: bgColor,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text style={{
        fontSize: size * 0.45,
        fontWeight: '700',
        color: '#555',
      }}>{initial}</Text>
    </View>
  );
};

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuizModes } from '@/lib/QuizModes';
import { supabase } from '@/lib/supabase';
import { prefetchOfflineBank } from '@/utils/offlineSync';
import EvaluateMainModal from '@/components/EvaluateMainModal';

const today = new Date();

// ─── MOTIVATIONAL QUOTES ─────────────────────────────────────────────────────
const MOTIVATIONAL_QUOTES = [
  { text: "Your potential is infinite. Keep pushing boundaries.", author: "Dr. A.P.J. Abdul Kalam" },
  { text: "Small daily improvements lead to stunning results.", author: "Robin Sharma" },
  { text: "Focus on progress, not perfection.", author: "Bill Gates" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Every expert was once a beginner.", author: "Pablo Picasso" },
  { text: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },
];

// ─── QUIZ MODES ─────────────────────────────────────────────────────────────
const QUIZ_MODES = [
  { id: 'daily', title: 'Daily Challenge', icon: Calendar, subtitle: 'Fresh question daily', color: '#6366F1', order_index: 0, isPremium: false },
  { id: 'flashcard', title: 'Flashcards', icon: Layers, subtitle: 'Spaced repetition', color: '#EC4899', order_index: 1, isPremium: true },
  { id: 'quick_10', title: 'Quick Quiz', icon: Target, subtitle: '10 questions fast', color: '#8B5CF6', order_index: 2, isPremium: false },
  { id: 'pyq', title: 'Previous Year', icon: Calendar1, subtitle: 'PYQ Practice', color: '#06B6D4', order_index: 3, isPremium: false },
  { id: 'timed', title: 'Timed Challenge', icon: Clock, subtitle: 'Beat the clock', color: '#F59E0B', order_index: 4, isPremium: false },
  { id: 'level_up', title: 'Level Up', icon: TrendingUp, subtitle: 'Progressive mastery', color: '#10B981', order_index: 5, isPremium: true },
  { id: 'missed', title: 'Revise Mistakes', icon: X, subtitle: 'Learn from errors', color: '#EF4444', order_index: 6, isPremium: true },
  { id: 'weakest_subject', title: 'Weak Areas', icon: BarChart, subtitle: 'Focus on gaps', color: '#F97316', order_index: 7, isPremium: true },
  { id: 'full_test', title: 'Mock Test', icon: CheckCircle, subtitle: 'Full exam simulation', color: '#890D8C', order_index: 8, isPremium: false },
  { id: 'custom', title: 'Custom Quiz', icon: Edit, subtitle: 'Build your own', color: '#0EA5E9', order_index: 9, isPremium: true },
];

// ─── QUICK TOOLS ────────────────────────────────────────────────────────────
const QUICK_TOOLS: Array<{
  id: string;
  title: string;
  desc: string;
  icon: any;
  gradient: [string, string];
  live?: boolean;
  new?: boolean;
  badge?: string;
}> = [
    { id: 'ai_mentor', title: 'AI Mentor', desc: 'Your smart tutor', icon: Bot, gradient: ['#6366F1', '#8B5CF6'], live: false },
    { id: 'daily_news', title: 'Daily News', desc: 'Current affairs', icon: Newspaper, gradient: ['#3B82F6', '#8B5CF6'], new: false },
    { id: 'evaluate_main', title: 'Evaluate Mains', desc: 'AI answer evaluation', icon: FileText, gradient: ['#F59E0B', '#EF4444'], new: true },
    { id: 'mock_interview', title: 'Mock Interview', desc: 'TNPSC call practice', icon: PhoneCall, gradient: ['#EC4899', '#F97316'], live: false },
  ];

function enrichModesFromLocal(fetchedModes: any[]): any[] {
  return fetchedModes.map(fetched => {
    const local = QUIZ_MODES.find(localMode => localMode.id === fetched.id);
    return {
      ...fetched,
      subtitle: local?.id === 'daily' ? today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : fetched.subtitle,
      icon: local?.icon,
      color: local?.color,
      order_index: local?.order_index,
      isPremium: fetched.is_premium,
    };
  });
}

// ─── ANIMATED COMPONENTS ─────────────────────────────────────────────────────

// Shimmer effect component
const ShimmerEffect = ({ width = 120, height = 16, borderRadius = 8 }) => {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmerValue.value, [0, 1], [-width, width]);
    return {
      transform: [{ translateX }],
      opacity: 0.3,
    };
  });

  return (
    <View style={{ width, height, borderRadius, backgroundColor: 'rgba(128,128,128,0.15)', overflow: 'hidden' }}>
      <Animated.View style={[{ width: width * 0.5, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' }, animatedStyle]} />
    </View>
  );
};

// Pulse dot animation
const PulseDot = ({ color = '#10B981' }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, animatedStyle]} />
  );
};

// Floating particle
const FloatingParticle = ({ delay = 0, size = 4, color = '#6366F1' }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const runAnimation = () => {
      opacity.value = withSequence(
        withTiming(0.6, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      );
      translateY.value = withSequence(
        withTiming(-30, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      );
      translateX.value = withSequence(
        withTiming(10, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-10, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      );
    };

    setTimeout(() => {
      runAnimation();
      setInterval(runAnimation, 8000);
    }, delay);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, animatedStyle]} />
  );
};

// Interactive card with spring animation
const SpringCard = ({ children, onPress, style, noShadow = true }: { children: React.ReactNode; onPress: () => void; style?: any; noShadow?: boolean }) => {
  const scale = useSharedValue(1);
  const shadow = useSharedValue(noShadow ? 0 : 8);

  const animatedStyle = useAnimatedStyle(() => {
    const baseStyle: any = { transform: [{ scale: scale.value }] };
    if (!noShadow) {
      baseStyle.shadowOpacity = shadow.value / 100;
    }
    return baseStyle;
  });

  return (
    <Animated.View style={[!noShadow && { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6 }, style, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
          if (!noShadow) shadow.value = withTiming(4, { duration: 100 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 300 });
          if (!noShadow) shadow.value = withTiming(8, { duration: 200 });
        }}
        onPress={onPress}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Circular animated progress
const CircularProgress = ({ percentage, size = 80, strokeWidth = 6, color = '#6366F1', children }: any) => {
  const animatedPercentage = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    animatedPercentage.value = withTiming(percentage, { duration: 1500, easing: Easing.out(Easing.cubic) });
  }, [percentage]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (animatedPercentage.value / 100) * circumference;
    return { strokeDashoffset };
  });

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
        <Defs>
          <SvgLinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(128,128,128,0.08)" strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeLinecap="round"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ justifyContent: 'center', alignItems: 'center' }}>{children}</View>
    </View>
  );
};

// Animated Circle for SVG
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Glowing orb effect
const GlowingOrb = ({ color = '#6366F1', size = 60 }) => {
  const pulse = useSharedValue(0.5);
  const glow = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0.5, { duration: 2000 })
      ),
      -1,
      false
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(20, { duration: 2000 }),
        withTiming(10, { duration: 2000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowRadius: glow.value,
  }));

  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8 }, animatedStyle]} />
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function StudyScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const { user } = useAuth();
  const { isPro } = useRevenueCat();
  const { exam } = useExam();

  const { data: rawQuizModes, isLoading: isQuizModesLoading } = useQuizModes();
  const quizModes = Array.isArray(rawQuizModes) ? enrichModesFromLocal(rawQuizModes) : [];

  const [studiedDays, setStudiedDays] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [isNotificationsModalVisible, setIsNotificationsModalVisible] = useState(false);
  const [expandedNotifications, setExpandedNotifications] = useState<string[]>([]);
  const [examProgress, setExamProgress] = useState({ total: 0, correct: 0, loading: true });
  const [quoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));
  const [isEvaluateModalVisible, setIsEvaluateModalVisible] = useState(false);

  // Target subjects state
  const TARGETS_STORAGE_KEY = 'user_subject_targets';
  const [targets, setTargets] = useState<any[]>([]);
  const [targetProgress, setTargetProgress] = useState<Record<string, { total: number; completed: number }>>({});

  // Animation values
  const headerBgOpacity = useSharedValue(0);
  const quoteFloat = useSharedValue(0);
  const quoteScale = useSharedValue(1);
  const quoteOpacity = useSharedValue(1);
  const bellPulse = useSharedValue(1);

  const glowPulse = useSharedValue(0.4);
  const shineTranslate = useSharedValue(-200);

  // Continuous animations
  useEffect(() => {
    quoteFloat.value = withRepeat(
      withTiming(-4, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    glowPulse.value = withRepeat(
      withTiming(0.9, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    shineTranslate.value = withRepeat(
      withSequence(
        withTiming(220, { duration: 1400, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withDelay(3000, withTiming(-220, { duration: 0 }))
      ),
      -1,
      false
    );
  }, []);

  const glowAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: glowPulse.value,
      transform: [{ scale: interpolate(glowPulse.value, [0.4, 0.9], [0.96, 1.06]) }],
    };
  });

  const shineAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: shineTranslate.value },
        { rotate: '-30deg' },
      ],
    };
  });

  // Unread notifications pulse
  const unreadCount = notifications.filter((n) => !readNotificationIds.includes(n.id)).length;
  useEffect(() => {
    if (unreadCount > 0) {
      bellPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 300 }),
          withTiming(1, { duration: 300 })
        ),
        -1,
        true
      );
    } else {
      bellPulse.value = withTiming(1, { duration: 200 });
    }
  }, [unreadCount]);



  // Fetch exam progress
  useEffect(() => {
    const fetchExamProgress = async () => {
      if (!user || !exam) {
        setExamProgress(prev => ({ ...prev, loading: false }));
        return;
      }
      setExamProgress(prev => ({ ...prev, loading: true }));
      try {
        let totalQuery = supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exam', exam.id);
        if (!isPro) totalQuery = totalQuery.eq('is_premium', false);
        const { count: totalCount } = await totalQuery;

        let answeredQuery = supabase
          .from('user_answers')
          .select('question_id, questions!inner(id, exam, is_premium)')
          .eq('user_id', user.id)
          .eq('is_correct', true)
          .eq('questions.exam', exam.id);
        if (!isPro) answeredQuery = answeredQuery.eq('questions.is_premium', false);
        const { data: answeredData } = await answeredQuery;

        const uniqueCorrect = new Set((answeredData || []).map((a: any) => a.question_id)).size;
        setExamProgress({ total: totalCount || 0, correct: uniqueCorrect, loading: false });

        if (exam?.id) prefetchOfflineBank(exam.id, user.id, isPro);
      } catch (err) {
        console.error('Error:', err);
        setExamProgress(prev => ({ ...prev, loading: false }));
      }
    };
    fetchExamProgress();
  }, [user, exam, isPro]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('is_active', true)
          .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
          .order('created_at', { ascending: false });

        const filtered = (data || []).filter((n) => n.target_platform === 'all' || n.target_platform === Platform.OS);
        setNotifications(filtered);

        const readIdsStr = await AsyncStorage.getItem('read_notifications');
        if (readIdsStr) setReadNotificationIds(JSON.parse(readIdsStr));
      } catch (err) {
        console.error('Notifications error:', err);
      }
    };
    fetchNotifications();
  }, []);

  // Load target subjects and fetch their progress
  useFocusEffect(
    React.useCallback(() => {
      const loadTargets = async () => {
        try {
          const stored = await AsyncStorage.getItem(TARGETS_STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            setTargets(parsed);
            
            // Fetch progress for each target
            if (parsed.length > 0 && user && exam) {
              const progressMap: Record<string, { total: number; completed: number }> = {};
              
              // Get all file resources for the exam
              const { data: fileExams } = await supabase
                .from('file_resource_exams')
                .select('*, file_resources(*)')
                .eq('exam_id', exam.id);

              if (fileExams) {
                const allFiles = fileExams
                  .map((d: any) => d.file_resources)
                  .filter((f: any) => f != null);

                // Get user's read progress
                const { data: progData } = await supabase
                  .from('user_note_progress')
                  .select('file_resource_id')
                  .eq('user_id', user.id);
                
                const readIds = new Set(progData?.map((p: any) => p.file_resource_id) || []);

                // Calculate progress for each target
                for (const target of parsed) {
                  const subjectFiles = allFiles.filter((f: any) => f.subject_id === target.id);
                  const total = subjectFiles.length;
                  const completed = subjectFiles.filter((f: any) => readIds.has(f.id)).length;
                  progressMap[target.id] = { total, completed };
                }
                
                setTargetProgress(progressMap);
                
                // Auto-remove completed targets
                const completedTargets = parsed.filter((t: any) => {
                  const prog = progressMap[t.id];
                  return prog && prog.total > 0 && prog.completed === prog.total;
                });
                
                if (completedTargets.length > 0) {
                  const remaining = parsed.filter((t: any) => {
                    const prog = progressMap[t.id];
                    return !(prog && prog.total > 0 && prog.completed === prog.total);
                  });
                  setTargets(remaining);
                  await AsyncStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(remaining));
                }
              }
            }
          } else {
            setTargets([]);
          }
        } catch (e) {
          console.error('Error loading targets:', e);
        }
      };
      
      loadTargets();
    }, [user, exam])
  );

  const removeTarget = async (targetId: string) => {
    try {
      const stored = await AsyncStorage.getItem(TARGETS_STORAGE_KEY);
      const currentTargets = stored ? JSON.parse(stored) : [];
      const updated = currentTargets.filter((t: any) => t.id !== targetId);
      setTargets(updated);
      await AsyncStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error removing target:', e);
    }
  };

  const toggleExpandNotification = async (id: string) => {
    let newReadIds = [...readNotificationIds];
    if (!readNotificationIds.includes(id)) {
      newReadIds.push(id);
      setReadNotificationIds(newReadIds);
      await AsyncStorage.setItem('read_notifications', JSON.stringify(newReadIds));
    }
    if (expandedNotifications.includes(id)) {
      setExpandedNotifications(expandedNotifications.filter((i) => i !== id));
    } else {
      setExpandedNotifications([...expandedNotifications, id]);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleQuizMode = async (mode: any) => {
    if (mode.isPremium && !isPro) {
      Alert.alert('Premium Feature', 'Unlock with Enliten Pro for $2.99/month', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/subscription') },
      ]);
      return;
    }
    try {
      if (mode.id === 'daily') router.push('/quiz/daily');
      else if (mode.id === 'level_up') router.push('/quiz/levelup');
      else if (mode.id === 'flashcard') router.push('/flashcards');
      else router.push(`/quiz/${mode.id}`);
    } catch (err) {
      Alert.alert('Error', 'Could not start quiz.');
    }
  };

  const handleShortcut = (shortcut: any) => {
    if (shortcut.id === 'ai_mentor') router.push('/ai-mentor');
    else if (shortcut.id === 'mock_interview') router.push('/mock-interview');
    else if (shortcut.id === 'evaluate_main') setIsEvaluateModalVisible(true);
    else if (shortcut.id === 'daily_news') router.push('/news');
  };

  // Animated styles
  const quoteAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: quoteFloat.value }, { scale: quoteScale.value }],
    opacity: quoteOpacity.value,
  }));

  const bellAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bellPulse.value }],
  }));

  const progressPercentage = examProgress.total > 0 ? Math.min((examProgress.correct / examProgress.total) * 100, 100) : 0;

  return (
    <View style={styles.container}>
      {/* ─── ULTRA-MODERN TOP NAVIGATION ─── */}
      <BlurView intensity={Platform.OS === 'ios' ? 60 : 90} tint={isDark ? 'dark' : 'light'} style={[styles.topNav, { paddingTop: insets.top + 4 }]}>
        <View style={styles.topNavContent}>
          {/* Left section: Avatar + Logo */}
          <View style={styles.navLeft}>
            <View style={styles.avatarWrapper}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={[styles.userAvatar, isPro && styles.userAvatarPro]} />
              ) : (
                <View style={[styles.userAvatarPlaceholder, { backgroundColor: '#8B5CF6' }, isPro && styles.userAvatarPro]}>
                  <Text style={styles.userAvatarText}>
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
              {isPro && (
                <View style={styles.proCrownBadge}>
                  <Crown size={10} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              )}
            </View>
            <Text style={[styles.logoText, { color: colors.text }]}>
              Enliten<Text style={{ color: colors.primary }}>.ai</Text>
            </Text>
          </View>

          {/* Right actions */}
          <View style={styles.navActions}>
            {/* Streak pill */}
            <TouchableOpacity activeOpacity={0.8} style={styles.streakPill}>
              <LottieView source={require('@/assets/animations/Fire Streak Orange.json')} autoPlay loop style={styles.streakAnim} />
              <Text style={[styles.streakCount, { color: colors.text }]}>{studiedDays.length}</Text>
            </TouchableOpacity>

            {/* Notification bell */}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setIsNotificationsModalVisible(true)} style={styles.bellBtn}>
              <Animated.View style={bellAnimatedStyle}>
                <Bell size={20} color={colors.text} strokeWidth={2} />
              </Animated.View>
              {unreadCount > 0 && <View style={styles.notificationBadge} />}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* ─── MAIN CONTENT ─── */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
      >
        {/* ─── HERO SECTION ─── */}
        <View style={styles.heroSection}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroGreeting}>{getGreeting()}</Text>
            <Text style={styles.heroName}>
              {user?.full_name ? user.full_name.split(' ')[0] : 'Learner'}
            </Text>
            {exam && (
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/exam-selection')} style={styles.examBadge}>
                <Target size={12} color="#0EA5E9" />
                <Text style={styles.examBadgeText}>{exam.short_name}</Text>
                <ChevronRight size={10} color="#0EA5E9" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ─── MINIMALIST QUOTE ─── */}
        <View style={styles.quoteWrapper}>
          <View style={styles.minimalQuoteContainer}>
            <View style={styles.minimalQuoteContentRow}>
              <Quote size={28} color="#3B82F6" strokeWidth={3} style={styles.minimalQuoteIcon} />
              <Animated.View style={[styles.minimalQuoteTextContainer, quoteAnimatedStyle]}>
                <Text style={styles.minimalQuoteText}>
                  {MOTIVATIONAL_QUOTES[quoteIndex].text}
                </Text>
                <Text style={styles.minimalQuoteAuthor}>
                  {MOTIVATIONAL_QUOTES[quoteIndex].author}
                </Text>
              </Animated.View>
            </View>
          </View>
        </View>

        {/* ─── PROGRESS DASHBOARD ─── */}
        {(examProgress.loading || examProgress.total > 0) && (
          <SpringCard onPress={() => router.push('/profile')} style={styles.progressCard}>
            <LinearGradient colors={[colors.card, colors.card]} style={styles.progressCardInner}>
              <View style={styles.progressHeader}>
                <View style={styles.progressTitleRow}>
                  <View style={styles.progressIconContainer}>
                    {examProgress.loading ? (
                      <ShimmerEffect width={62} height={62} borderRadius={16} />
                    ) : (
                      <LottieView source={require('@/assets/animations/read book.json')} autoPlay loop style={styles.progressLottieAnim} />
                    )}
                  </View>
                  <View>
                    {examProgress.loading ? (
                      <ShimmerEffect width={120} height={16} borderRadius={4} />
                    ) : (
                      <>
                        <Text style={styles.progressTitleText}>Practice Progress</Text>
                        <Text style={styles.progressSubtitleText}>{exam?.short_name || 'Your Exam'}</Text>
                      </>
                    )}
                  </View>
                </View>
                {examProgress.loading ? (
                  <ShimmerEffect width={70} height={70} borderRadius={35} />
                ) : (
                  <CircularProgress percentage={progressPercentage} size={70} strokeWidth={5} color={colors.primary}>
                    <Text style={styles.progressPercentText}>{Math.round(progressPercentage)}%</Text>
                  </CircularProgress>
                )}
              </View>

              <View style={styles.progressStatsRow}>
                <View style={styles.statItem}>
                  {examProgress.loading ? (
                    <ShimmerEffect width={40} height={22} borderRadius={4} />
                  ) : (
                    <Text style={styles.statValue}>{examProgress.correct}</Text>
                  )}
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  {examProgress.loading ? (
                    <ShimmerEffect width={40} height={22} borderRadius={4} />
                  ) : (
                    <Text style={styles.statValue}>{examProgress.total - examProgress.correct}</Text>
                  )}
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  {examProgress.loading ? (
                    <ShimmerEffect width={40} height={22} borderRadius={4} />
                  ) : (
                    <Text style={styles.statValue}>{examProgress.total}</Text>
                  )}
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>

              {!examProgress.loading && !isPro && (
                <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/subscription')} style={styles.upgradeBanner}>
                  <Crown size={14} color="#F59E0B" />
                  <Text style={styles.upgradeBannerText}>Unlock all questions & premium modes</Text>
                  <ChevronRight size={14} color="#F59E0B" />
                </TouchableOpacity>
              )}
            </LinearGradient>
          </SpringCard>
        )}

        {/* ─── NO PROGRESS - SHOW PREMIUM CTA ─── */}
        {!isPro && examProgress.loading === false && examProgress.total === 0 && (
          <SpringCard onPress={() => router.push('/subscription')} style={styles.premiumCtaCard}>
            <LinearGradient colors={['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.05)']} style={styles.premiumCtaInner}>
              <View style={styles.premiumCtaContent}>
                <View style={styles.premiumCtaIcon}>
                  <Crown size={28} color="#F59E0B" />
                </View>
                <View style={styles.premiumCtaText}>
                  <Text style={styles.premiumCtaTitle}>Start Your Journey</Text>
                  <Text style={styles.premiumCtaSubtitle}>Unlock all quiz modes & features</Text>
                </View>
                <View style={styles.premiumCtaArrow}>
                  <ChevronRight size={22} color="#F59E0B" />
                </View>
              </View>
            </LinearGradient>
          </SpringCard>
        )}

        {/* ─── TARGET SUBJECTS ─── */}
        {targets.length > 0 && (
          <View style={styles.targetsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Targets</Text>
              <View style={styles.sectionAccent} />
            </View>
            {targets.map((target) => {
              const prog = targetProgress[target.id];
              const total = prog?.total || target.totalLessons || 0;
              const completed = prog?.completed || 0;
              const remaining = total - completed;
              const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <TouchableOpacity
                  key={target.id}
                  onPress={() => {
                    router.push('/(tabs)/notes');
                  }}
                  style={[styles.targetCard, { borderColor: colors.border }]}
                  activeOpacity={0.7}
                >
                  <View style={styles.targetCardRow}>
                    <View style={styles.targetImageWrap}>
                      {target.image_url ? (
                        <Image source={{ uri: target.image_url }} style={styles.targetImage} />
                      ) : (
                        <SubjectInitial name={target.name} size={48} />
                      )}
                    </View>
                    <View style={styles.targetInfo}>
                      <Text style={styles.targetName} numberOfLines={1}>{target.name}</Text>
                      <Text style={styles.targetLessons}>{total} lessons</Text>
                      <View style={styles.targetProgressBar}>
                        <View style={[styles.targetProgressFill, { width: `${percentage}%` }]} />
                      </View>
                      <View style={styles.targetProgressText}>
                        <Text style={styles.targetCompleted}>{completed} completed</Text>
                        <Text style={styles.targetRemaining}>{remaining} left</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.targetRemoveBtn}
                      onPress={() => removeTarget(target.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color={colors.subText} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── QUICK TOOLS GRID ─── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Tools</Text>
            <View style={styles.sectionAccent} />
          </View>

          <View style={styles.toolsGrid}>
            {QUICK_TOOLS.map((tool, index) => {
              const IconComponent = tool.icon;
              return (
                <View key={tool.id} style={styles.toolCardWrapper}>
                  <SpringCard onPress={() => handleShortcut(tool)} style={[styles.toolCard, { borderColor: tool.gradient[0] + '30' }]}>
                    <LinearGradient colors={[tool.gradient[0] + '12', tool.gradient[0] + '03']} style={styles.toolCardInner}>
                      <View style={styles.toolHeader}>
                        <View style={[styles.toolIconBg, { backgroundColor: tool.gradient[0] }]}>
                          <IconComponent size={20} color="#FFFFFF" strokeWidth={2} />
                        </View>
                        {tool.live && (
                          <View style={styles.liveBadge}>
                            <PulseDot />
                            <Text style={styles.liveText}>LIVE</Text>
                          </View>
                        )}
                        {tool.new && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newText}>NEW</Text>
                          </View>
                        )}
                        {tool.badge && (
                          <View style={styles.proBadge}>
                            <Text style={styles.proText}>{tool.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.toolTitle}>{tool.title}</Text>
                      <Text style={styles.toolDesc}>{tool.desc}</Text>
                    </LinearGradient>
                  </SpringCard>
                </View>
              );
            })}
          </View>
        </View>

        {/* ─── QUIZ MODES ─── */}
        <View style={styles.quizModesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quiz Modes</Text>
            <View style={styles.sectionAccent} />
          </View>

          {isQuizModesLoading && (
            <View style={styles.loadingContainer}>
              <ShimmerEffect width={width - 40} height={70} borderRadius={16} />
              <View style={{ height: 12 }} />
              <ShimmerEffect width={width - 40} height={70} borderRadius={16} />
              <View style={{ height: 12 }} />
              <ShimmerEffect width={width - 40} height={70} borderRadius={16} />
            </View>
          )}

          {quizModes?.sort((a, b) => a.order_index - b.order_index).map((mode: any, index: number) => {
            const IconComponent = mode.icon;
            if (!mode.is_active) return null;

            return (
              <View key={mode.id}>
                <SpringCard onPress={() => handleQuizMode(mode)} style={[styles.quizModeCard, { backgroundColor: colors.card, borderColor: colors.border }]} noShadow>
                  <View style={styles.quizModeRow}>
                    <View style={[styles.quizModeIconContainer, { backgroundColor: mode.color + '15' }]}>
                      <IconComponent size={20} color={mode.color} strokeWidth={2.5} />
                    </View>
                    <View style={styles.quizModeInfo}>
                      <Text style={styles.quizModeTitle}>{mode.title}</Text>
                      <Text style={styles.quizModeSubtitle}>{mode.subtitle}</Text>
                    </View>
                    {mode.isPremium ? (
                      <View style={[styles.premiumBadge, isPro ? styles.premiumUnlocked : styles.premiumLocked]}>
                        {isPro ? (
                          <>
                            <CheckCircle size={10} color="#10B981" />
                            <Text style={styles.premiumUnlockedText}>Unlocked</Text>
                          </>
                        ) : (
                          <>
                            <Crown size={10} color="#F59E0B" />
                            <Text style={styles.premiumLockedText}>Pro</Text>
                          </>
                        )}
                      </View>
                    ) : (
                      <ChevronRight size={20} color={colors.subText} strokeWidth={1.5} />
                    )}
                  </View>
                </SpringCard>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ─── FLOATING AI MENTOR BUTTON ─── */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 90 }]}>
        <Animated.View style={[styles.fabGlow, glowAnimatedStyle]} />
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/ai-mentor')} style={styles.fabTouchable}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <View style={styles.fabGlossOverlay} />
            <View style={styles.fabContentRow}>
              {/* <LottieView
                source={require('@/assets/animations/ai.json')}
                autoPlay
                loop
                style={styles.fabLottie}
              /> */}
              <Sparkle size={18} color="#fff" />
              <Text style={styles.fabText}>Ask AI Mentor</Text>
            </View>
            <Animated.View style={[styles.fabShine, shineAnimatedStyle]} />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ─── NOTIFICATIONS MODAL ─── */}
      <Modal visible={isNotificationsModalVisible} transparent animationType="slide" onRequestClose={() => setIsNotificationsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Notifications</Text>
              <TouchableOpacity onPress={() => setIsNotificationsModalVisible(false)} style={styles.modalCloseBtn}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationsList}>
              {notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <Bell size={48} color={colors.subText} strokeWidth={1} />
                  <Text style={[styles.emptyText, { color: colors.subText }]}>All caught up! 🎉</Text>
                </View>
              ) : (
                notifications.map((notif) => {
                  const isExpanded = expandedNotifications.includes(notif.id);
                  const isRead = readNotificationIds.includes(notif.id);

                  return (
                    <TouchableOpacity
                      key={notif.id}
                      style={[styles.notificationCard, { borderColor: isRead ? colors.border : colors.primary }]}
                      onPress={() => toggleExpandNotification(notif.id)}
                      activeOpacity={0.8}
                    >
                      {!isRead && <View style={styles.unreadIndicator} />}
                      <Text style={styles.notificationTitleText}>{notif.title}</Text>
                      <Text style={styles.notificationMessageText} numberOfLines={isExpanded ? undefined : 2}>{notif.message}</Text>
                      <Text style={styles.notificationTimeText}>{new Date(notif.created_at).toLocaleDateString()}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── EVALUATE MAINS MODAL ─── */}
      <EvaluateMainModal visible={isEvaluateModalVisible} onClose={() => setIsEvaluateModalVisible(false)} />
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.gradientStart },
    scrollView: { flex: 1 },

    // Top Navigation
    topNav: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    topNavContent: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    logoText: {
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: -1,
    },
    navLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatarWrapper: {
      position: 'relative',
    },
    userAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.border,
    },
    userAvatarPro: {
      borderWidth: 2,
      borderColor: '#8B5CF6',
    },
    proCrownBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#8B5CF6',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.card,
    },
    userAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userAvatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    navActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: 20,
      paddingRight: 12,
      paddingLeft: 6,
      height: 34,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.3)',
    },
    streakAnim: { width: 26, height: 26, marginRight: 2 },
    streakCount: { fontSize: 14, fontWeight: '800' },
    bellBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    notificationBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#EF4444',
      borderWidth: 1.5,
      borderColor: colors.card,
    },

    // Hero Section
    heroSection: {
      marginTop: 16,
      marginBottom: 20,
    },
    heroLeft: {
      marginBottom: 4,
    },
    heroGreeting: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: '#10B981', // Emerald color instead of primary
      marginBottom: 6,
    },
    heroName: {
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: -1.5,
      color: colors.text,
      marginBottom: 10,
    },
    examBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#0EA5E9' + '15', // Sky Blue
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      alignSelf: 'flex-start',
      gap: 6,
      borderWidth: 1,
      borderColor: '#0EA5E9' + '30',
    },
    examBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#0EA5E9',
    },

    // Quote Card (Minimalist)
    quoteWrapper: {
      marginTop: 20,
      marginBottom: 32,
      paddingHorizontal: 8,
    },
    minimalQuoteContainer: {
      flexDirection: 'column',
    },
    minimalQuoteContentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    minimalQuoteIcon: {
      marginRight: 12,
      marginTop: -2,
    },
    minimalQuoteTextContainer: {
      flex: 1,
    },
    minimalQuoteText: {
      fontSize: 18,
      fontWeight: '500',
      fontStyle: 'italic',
      color: colors.text,
      lineHeight: 26,
      marginBottom: 10,
    },
    minimalQuoteAuthor: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.subText,
    },

    // Section Header
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: colors.text,
    },
    sectionAccent: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },

    // Progress Card
    progressCard: {
      marginBottom: 24,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressCardInner: {
      padding: 20,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    progressTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    progressIconContainer: {
      width: 62,
      height: 62,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    progressLottieAnim: {
      width: 100,
      height: 100,
    },
    progressTitleText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    progressSubtitleText: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.primary,
    },
    progressPercentText: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
    },
    progressStatsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.subText,
      marginTop: 2,
    },
    statDivider: {
      width: 1,
      height: '100%',
      backgroundColor: colors.border,
    },
    upgradeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(245,158,11,0.1)',
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: 'rgba(245,158,11,0.2)',
    },
    upgradeBannerText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#F59E0B',
    },

    // Premium CTA
    premiumCtaCard: {
      marginBottom: 24,
      borderRadius: 20,
      overflow: 'hidden',
    },
    premiumCtaInner: {
      padding: 18,
    },
    premiumCtaContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    premiumCtaIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    premiumCtaText: {
      flex: 1,
    },
    premiumCtaTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 2,
    },
    premiumCtaSubtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.subText,
    },
    premiumCtaArrow: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(245,158,11,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Tools Grid
    toolsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
      marginBottom: 28,
    },
    toolCardWrapper: {
      width: '48.5%',
    },
    toolCard: {
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      overflow: 'hidden',
    },
    toolCardInner: {
      padding: 16,
      minHeight: 110,
    },
    toolHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    toolIconBg: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(16,185,129,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      gap: 4,
    },
    liveText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#10B981',
    },
    newBadge: {
      backgroundColor: 'rgba(245,158,11,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    newText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#F59E0B',
    },
    proBadge: {
      backgroundColor: 'rgba(139,92,246,0.15)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    proText: {
      fontSize: 9,
      fontWeight: '800',
      color: '#8B5CF6',
    },
    toolTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    toolDesc: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.subText,
    },

    // Quiz Modes
    quizModesSection: {
      marginBottom: 30,
    },
    quizModeCard: {
      marginBottom: 12,
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
    },
    quizModeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    quizModeIconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    quizModeInfo: {
      flex: 1,
    },
    quizModeTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    quizModeSubtitle: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.subText,
    },
    premiumBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      gap: 4,
    },
    premiumLocked: {
      backgroundColor: 'rgba(245,158,11,0.1)',
    },
    premiumUnlocked: {
      backgroundColor: 'rgba(16,185,129,0.1)',
    },
    premiumLockedText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#F59E0B',
    },
    premiumUnlockedText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#10B981',
    },

    // Loading
    loadingContainer: {
      paddingVertical: 10,
    },

    // Target Subjects
    targetsSection: {
      marginBottom: 24,
    },
    targetCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 12,
      overflow: 'hidden',
    },
    targetCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    targetImageWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.inputBg,
    },
    targetImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    targetInfo: {
      flex: 1,
      marginLeft: 14,
    },
    targetName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    targetLessons: {
      fontSize: 12,
      color: colors.subText,
      marginBottom: 8,
    },
    targetProgressBar: {
      height: 6,
      backgroundColor: colors.inputBg,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 6,
    },
    targetProgressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    targetProgressText: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    targetCompleted: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    targetRemaining: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.subText,
    },
    targetRemoveBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 8,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      height: '80%',
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 24,
      paddingBottom: 40,
      borderWidth: 1,
      borderBottomWidth: 0,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: '800',
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.inputBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationsList: {
      paddingBottom: 20,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
    },
    notificationCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    unreadIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginTop: 6,
    },
    notificationTitleText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    notificationMessageText: {
      fontSize: 13,
      color: colors.subText,
      marginTop: 4,
      lineHeight: 18,
    },
    notificationTimeText: {
      fontSize: 11,
      color: colors.subText,
      marginTop: 6,
    },

    // Floating Action Button (FAB)
    fabContainer: {
      position: 'absolute',
      alignSelf: 'center',
      zIndex: 1000,
    },
    fabTouchable: {
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1.2,
      borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    fabGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
      overflow: 'hidden',
    },
    fabGlossOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    fabContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      zIndex: 2,
    },
    fabText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.2,
      textShadowColor: 'rgba(0, 0, 0, 0.15)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    fabLottie: {
      width: 34,
      height: 24,
      marginRight: -1,
      marginLeft: -2,
    },
    fabGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 24,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
      elevation: 10,
    },
    fabShine: {
      position: 'absolute',
      top: -30,
      bottom: -30,
      width: 35,
      backgroundColor: 'rgba(255, 255, 255, 0.45)',
      opacity: 0.5,
      zIndex: 3,
    },
  });
