import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, CheckCircle, ChevronDown, Clock, FileText, Play, Plus, Minus } from 'lucide-react-native';
import React, { useEffect, useState, useMemo } from "react";
import { Alert, Dimensions, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

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
const SubjectInitial = ({ name, size = 44 }: { name: string; size?: number }) => {
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

export default function Learn() {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const { exam, subject, setSubject } = useExam();
  const [files, setFiles] = useState<any[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [user, setUser] = useState<any>(null);
  const [unitExpanded, setUnitExpanded] = useState(true);
  const [questionCount, setQuestionCount] = useState(0);
  const [isTargeted, setIsTargeted] = useState(false);

  const TARGETS_STORAGE_KEY = 'user_subject_targets';

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user));
  }, []);

  // Load targets and check if current subject is targeted (syncs on focus)
  useFocusEffect(
    React.useCallback(() => {
      const loadTargets = async () => {
        try {
          const stored = await AsyncStorage.getItem(TARGETS_STORAGE_KEY);
          if (stored && subject) {
            const targets = JSON.parse(stored);
            setIsTargeted(targets.some((t: any) => t.id === subject.id));
          } else {
            setIsTargeted(false);
          }
        } catch (e) {
          console.error('Error loading targets:', e);
        }
      };
      loadTargets();
    }, [subject])
  );

  const addToTargets = async () => {
    if (!subject) return;
    try {
      const stored = await AsyncStorage.getItem(TARGETS_STORAGE_KEY);
      const targets = stored ? JSON.parse(stored) : [];
      
      // Check if already exists
      if (targets.some((t: any) => t.id === subject.id)) return;
      
      const newTarget = {
        id: subject.id,
        name: subject.name,
        image_url: subject.image_url || null,
        totalLessons: files.length,
        addedAt: new Date().toISOString(),
      };
      
      targets.push(newTarget);
      await AsyncStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets));
      setIsTargeted(true);
    } catch (e) {
      console.error('Error adding target:', e);
    }
  };

  const removeFromTargets = async () => {
    if (!subject) return;
    try {
      const stored = await AsyncStorage.getItem(TARGETS_STORAGE_KEY);
      if (!stored) return;
      
      const targets = JSON.parse(stored);
      const updated = targets.filter((t: any) => t.id !== subject.id);
      await AsyncStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(updated));
      setIsTargeted(false);
    } catch (e) {
      console.error('Error removing target:', e);
    }
  };

  useEffect(() => {
    const loadResourcesAndFiles = async () => {
      setLoading(true);

      let currentSubject = subject;
      if (!currentSubject) {
        const { data: subjects } = await supabase.from('subjects').select('*').order('name', { ascending: true }).limit(1);
        if (subjects && subjects.length > 0) {
          currentSubject = subjects[0];
          setSubject(currentSubject);
        }
      }

      if (exam) {
        // Fetch files for exam
        let query = supabase
          .from('file_resource_exams')
          .select(`
                *,
                file_resources (*)
              `)
          .eq('exam_id', exam.id);

        const { data, error } = await query;
        if (!error && data) {
          let loadedFiles = data.map((d: any) => d.file_resources).filter((f: any) => f != null);

          if (currentSubject) {
            // filter by subject_id 
            loadedFiles = loadedFiles.filter((f: any) => !f.subject_id || f.subject_id === currentSubject.id);
          }

          // sort by order_index
          loadedFiles.sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
          setFiles(loadedFiles);

          // load progress
          if (user) {
            const { data: progData } = await supabase.from('user_note_progress').select('*').eq('user_id', user.id);
            const progMap: Record<string, boolean> = {};
            if (progData) {
              progData.forEach((p: any) => { progMap[p.file_resource_id] = p.is_read; });
            }
            setProgress(progMap);
          }

          // Fetch question count for this subject
          if (currentSubject) {
            const { count } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .eq('subject_id', currentSubject.id);
            setQuestionCount(count || 0);
          }
        }
      }
      setLoading(false);
    };

    loadResourcesAndFiles();
  }, [exam, subject, user]);

  const toggleReadStatus = async (fileId: string, currentStatus: boolean) => {
    if (!user) return;
    const newStatus = !currentStatus;

    // Optimistic update
    setProgress(prev => ({ ...prev, [fileId]: newStatus }));

    if (newStatus) {
      const { error } = await supabase.from('user_note_progress').upsert(
        {
          user_id: user.id,
          file_resource_id: fileId,
          is_read: true,
        },
        { onConflict: 'user_id,file_resource_id' }
      );
      if (error) {
        console.error('[toggleReadStatus] upsert error:', error);
        // Revert optimistic update on failure
        setProgress(prev => ({ ...prev, [fileId]: currentStatus }));
      }
    } else {
      const { error } = await supabase
        .from('user_note_progress')
        .delete()
        .match({ user_id: user.id, file_resource_id: fileId });
      if (error) {
        console.error('[toggleReadStatus] delete error:', error);
        // Revert optimistic update on failure
        setProgress(prev => ({ ...prev, [fileId]: currentStatus }));
      }
    }
  };

  function getFileExtension(fileName: string): string | null {
    const parts = fileName?.split('.');
    if (parts && parts.length > 1 && parts[parts.length - 1]) {
      return parts.pop()?.toLowerCase() || null;
    }
    return null;
  }

  const handleOpenLink = (file: any) => {
    let url = '';
    if (file.resource_type === 'file') {
      url = `https://nufmkzmukwplugqvtiie.supabase.co/storage/v1/object/public/notes/${file.file_name}`;
    } else {
      url = file.file_url;
    }

    const isPdf = file.resource_type === 'file' && file.file_name && getFileExtension(file.file_name) === 'pdf';

    if (isPdf) {
      router.push({
        pathname: '/pdf-viewer',
        params: { url, title: file.title, fileName: file.file_name }
      });
    } else {
      Alert.alert(
        'Open external link?',
        'You are about to open an external link. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open', onPress: () => Linking.openURL(url) }
        ]
      );
    }
  };

  const startQuiz = () => {
    router.push({
      pathname: '/quiz/[mode]',
      params: { mode: 'notes_quiz', subject_id: subject?.id }
    });
  };

  // Determine which item is the "active" (currently in-progress) one
  const getItemState = (index: number) => {
    const file = files[index];
    const isRead = progress[file?.id] || false;
    const isFirst = index === 0;
    const isUnlocked = isFirst || progress[files[index - 1]?.id];
    const isActive = isUnlocked && !isRead; // Currently working on this one
    return { isRead, isUnlocked, isActive };
  };

  // Check if an item is a "practice sheet" type
  const isPracticeSheet = (file: any) => {
    return file.title?.toLowerCase().includes('practice') ||
      file.title?.toLowerCase().includes('quiz') ||
      file.title?.toLowerCase().includes('mcq');
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.subjectPill} onPress={() => router.push('/subject-selection')}>
          <BookOpen size={18} color={colors.text} strokeWidth={2} />
          <Text style={styles.subjectPillText} numberOfLines={1}>
            {subject ? subject.name : 'Select Subject'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statsBtn}>
          <LottieView
            source={require('@/assets/animations/Bar chart.json')}
            autoPlay
            loop
            style={{ width: 42, height: 42, backgroundColor: 'transparent' }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── UNIT CARD ── */}
        <TouchableOpacity
          style={styles.unitCard}
          activeOpacity={0.8}
          onPress={() => setUnitExpanded(!unitExpanded)}
        >
          <View style={styles.unitCardTop}>
            {/* Unit Icon – circular image placeholder */}
            <View style={styles.unitIconWrap}>
              {subject?.image_url ? (
                <Image
                  source={{ uri: subject.image_url }}
                  style={styles.unitIconImage}
                  onError={(e) => {
                    // Image failed to load, will show fallback
                  }}
                />
              ) : (
                <SubjectInitial name={subject?.name || 'Subject'} size={44} />
              )}
            </View>
            <View style={styles.unitCardInfo}>
              <Text style={styles.unitTitle}>
                {subject ? subject.name : 'Subject'}
              </Text>
              <Text style={styles.unitSubtitle}>
                {/* Unit 1 · {files.length} lessons */}
                {files.length} lessons
              </Text>
            </View>
            <Animated.View style={[
              styles.chevronWrap,
              unitExpanded && { transform: [{ rotate: '0deg' }] }
            ]}>
              <ChevronDown size={20} color={colors.subText} strokeWidth={2} />
            </Animated.View>
          </View>
          {/* Blue action bar */}
          <TouchableOpacity
            style={[styles.unitActionBar, isTargeted && styles.unitActionBarTargeted]}
            activeOpacity={0.8}
            onPress={(e) => {
              if (isTargeted) {
                removeFromTargets();
              } else {
                addToTargets();
              }
            }}
          >
            <Text style={styles.actionBarText}>
              {isTargeted ? 'Added to targets' : 'Add to targets'}
            </Text>
            <View style={[styles.addBtn, isTargeted && styles.removeBtn]}>
              {isTargeted ? (
                <>
                  <Minus size={14} color="#FFF" strokeWidth={3} />
                  <Text style={styles.addBtnText}>Remove</Text>
                </>
              ) : (
                <>
                  <Plus size={14} color="#FFF" strokeWidth={3} />
                  <Text style={styles.addBtnText}>Add</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── TIMELINE ── */}
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
            <SpinnerAnimation color={colors.primary} />
          </View>
        ) : unitExpanded ? (
          <View style={styles.timelineWrap}>
            {files.map((file, index) => {
              const { isRead, isUnlocked, isActive } = getItemState(index);
              const isPractice = isPracticeSheet(file);
              const isLast = index === files.length - 1;

              return (
                <View key={file.id} style={styles.timelineRow}>
                  {/* Vertical connector line — always show (connects to quiz node at end) */}
                  <View style={[
                    styles.connectorLine,
                    isRead && { backgroundColor: colors.primary + '40' }
                  ]} />

                  {/* Node circle */}
                  <View style={[
                    styles.nodeCircle,
                    isRead && styles.nodeCompleted,
                    isActive && !isPractice && styles.nodeActive,
                    isPractice && isUnlocked && !isRead && styles.nodePractice,
                    !isUnlocked && styles.nodeLocked,
                  ]}>
                    {isRead ? (
                      <CheckCircle size={22} color={colors.primary} strokeWidth={2.5} />
                    ) : isActive && !isPractice ? (
                      <Clock size={20} color="#E8910A" strokeWidth={2.5} />
                    ) : isPractice && isUnlocked ? (
                      <FileText size={20} color={colors.primary} strokeWidth={2} />
                    ) : (
                      <Text style={styles.nodeNumber}>{index + 1}</Text>
                    )}
                  </View>

                  {/* Content + Mark as read */}
                  <TouchableOpacity
                    style={[styles.rowContent, !isUnlocked && { opacity: 0.4 }]}
                    activeOpacity={isUnlocked ? 0.6 : 1}
                    disabled={!isUnlocked}
                    onPress={() => {
                      if (isPractice) {
                        startQuiz();
                      } else {
                        handleOpenLink(file);
                      }
                    }}
                  >
                    <View style={styles.rowTextWrap}>
                      <Text style={[
                        styles.rowTitle,
                        isRead && { color: colors.primary },
                        isActive && !isPractice && { color: '#E8910A' },
                        !isUnlocked && { color: colors.subText },
                      ]}>
                        {file.title}
                      </Text>
                      <Text style={styles.rowDuration}>
                        {isPractice
                          ? (file.description || '8 MCQs')
                          : (file.description || '10m')
                        }
                      </Text>
                    </View>

                    {/* Mark as read button */}
                    {isUnlocked && !isPractice && (
                      <TouchableOpacity
                        style={[
                          styles.markReadBtn,
                          isRead && styles.markReadBtnDone,
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleReadStatus(file.id, isRead);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[
                          styles.markReadText,
                          isRead && { color: colors.primary },
                        ]}>
                          {isRead ? 'Completed' : 'Mark as read'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* ── QUIZ NODE at end ── */}
            {files.length > 0 && (
              <View style={styles.timelineRow}>
                {/* No connector after quiz node */}
                <View style={[
                  styles.nodeCircle,
                  styles.nodeQuiz,
                  // Only enable quiz if all files are read
                  files.every(f => progress[f.id]) && styles.nodeQuizReady,
                ]}>
                  <Play size={20} color={files.every(f => progress[f.id]) ? '#FFF' : colors.subText} strokeWidth={2.5} />
                </View>
                <TouchableOpacity
                  style={[
                    styles.rowContent,
                    !files.every(f => progress[f.id]) && { opacity: 0.4 },
                  ]}
                  activeOpacity={0.6}
                  disabled={!files.every(f => progress[f.id])}
                  onPress={startQuiz}
                >
                  <View style={styles.rowTextWrap}>
                    <Text style={[
                      styles.rowTitle,
                      files.every(f => progress[f.id]) && { color: colors.primary },
                    ]}>
                      Start Quiz
                    </Text>
                    <Text style={styles.rowDuration}>
                      {questionCount} MCQs · {subject?.name || 'Subject'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  // ── CONTAINER ──
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },

  // ── HEADER ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  subjectPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? '#1A1A22' : '#F0F0F5',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: isDark ? '#2A2A35' : '#E0E0E5',
    gap: 10,
  },
  subjectPillText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statsBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: isDark ? '#1A1A22' : '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? '#2A2A35' : '#E0E0E5',
  },

  // ── UNIT CARD ──
  unitCard: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 24,
    borderRadius: 18,
    backgroundColor: isDark ? '#151519' : '#FFFFFF',
    borderWidth: 1,
    borderColor: isDark ? '#252530' : '#E5E7EB',
    overflow: 'hidden',
  },
  unitCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  unitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: isDark ? '#2A2A35' : '#E5E7EB',
  },
  unitIconImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  unitCardInfo: {
    flex: 1,
    marginLeft: 14,
  },
  unitTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  unitSubtitle: {
    color: colors.subText,
    fontSize: 13,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── BLUE ACTION BAR ──
  unitActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2563EB', // Exact blue from the image
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  unitActionBarTargeted: {
    backgroundColor: '#DC2626', // Soft red when targeted
  },
  actionBarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── TIMELINE ──
  timelineWrap: {
    paddingLeft: 30,
    paddingRight: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    position: 'relative',
  },
  connectorLine: {
    position: 'absolute',
    left: 23,
    top: 36,
    bottom: -36,
    width: 2,
    backgroundColor: isDark ? '#252530' : '#E0E0E5',
    zIndex: 0,
  },

  // ── NODE CIRCLES ──
  nodeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: isDark ? '#1A1A22' : '#F0F0F5',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: 2,
    borderColor: isDark ? '#2A2A35' : '#E0E0E5',
  },
  nodeCompleted: {
    backgroundColor: isDark ? colors.primary + '18' : colors.primary + '10',
    borderColor: colors.primary,
    borderWidth: 2.5,
  },
  nodeActive: {
    backgroundColor: isDark ? 'rgba(232, 145, 10, 0.12)' : 'rgba(232, 145, 10, 0.1)',
    borderColor: '#E8910A',
    borderWidth: 2.5,
  },
  nodePractice: {
    backgroundColor: isDark ? 'rgba(37, 99, 235, 0.12)' : 'rgba(37, 99, 235, 0.08)',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  nodeLocked: {
    backgroundColor: isDark ? '#131318' : '#F5F5F8',
    borderColor: isDark ? '#1E1E26' : '#DDDDE3',
    borderWidth: 1.5,
  },
  nodeQuiz: {
    backgroundColor: isDark ? '#1A1A22' : '#F0F0F5',
    borderColor: isDark ? '#2A2A35' : '#E0E0E5',
  },
  nodeQuizReady: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nodeNumber: {
    color: colors.subText,
    fontSize: 16,
    fontWeight: '700',
  },

  // ── ROW TEXT ──
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    paddingVertical: 14,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  rowDuration: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: '400',
  },

  // ── MARK AS READ BUTTON ──
  markReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: isDark ? '#2A2A35' : '#E0E0E5',
    marginLeft: 8,
  },
  markReadBtnDone: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '10',
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.subText,
  },
});

function SpinnerAnimation({ color = '#8A2BE2' }: { color?: string }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  return (
    <Animated.View style={[{ width: 64, height: 64, marginBottom: 16 }, animatedStyle]}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Circle
          cx={32}
          cy={32}
          r={28}
          stroke={color}
          strokeWidth={6}
          strokeDasharray={"44 88"}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}