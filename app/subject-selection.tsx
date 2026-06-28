import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, CheckCircle, ChevronRight, Search, BookOpen } from 'lucide-react-native';

// Soft background colors for subject initials
const SOFT_COLORS = [
  '#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF3E0', '#FCE4EC',
  '#E0F7FA', '#F1F8E9', '#FFF8E1', '#FBE9E7', '#EDE7F6',
];

const getSubjectColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SOFT_COLORS[Math.abs(hash) % SOFT_COLORS.length];
};

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

interface SubjectProgress {
  total: number;
  completed: number;
}

export default function SubjectSelectionScreen() {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const { exam, setSubject } = useExam();
  const [progressMap, setProgressMap] = useState<Record<string, SubjectProgress>>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user));
  }, []);

  // Fetch subjects
  const { data: subjectsData, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!isLoading) {
      setSubjects(subjectsData || []);
    }
  }, [isLoading, subjectsData]);

  // Fetch note progress for each subject
  useEffect(() => {
    const fetchProgress = async () => {
      if (!exam || !subjectsData || subjectsData.length === 0) return;

      // Get all file resources for the exam
      const { data: fileExams } = await supabase
        .from('file_resource_exams')
        .select('*, file_resources(*)')
        .eq('exam_id', exam.id);

      if (!fileExams) return;

      const allFiles = fileExams
        .map((d: any) => d.file_resources)
        .filter((f: any) => f != null);

      // Get user's read progress
      let readIds = new Set<string>();
      if (user) {
        const { data: progData } = await supabase
          .from('user_note_progress')
          .select('file_resource_id')
          .eq('user_id', user.id);
        if (progData) {
          readIds = new Set(progData.map((p: any) => p.file_resource_id));
        }
      }

      // Build per-subject progress
      const map: Record<string, SubjectProgress> = {};
      for (const sub of subjectsData) {
        const subFiles = allFiles.filter(
          (f: any) => !f.subject_id || f.subject_id === sub.id
        );
        // Only count files that explicitly belong to this subject
        const subjectFiles = allFiles.filter(
          (f: any) => f.subject_id === sub.id
        );
        const total = subjectFiles.length;
        const completed = subjectFiles.filter((f: any) => readIds.has(f.id)).length;
        map[sub.id] = { total, completed };
      }
      setProgressMap(map);
    };

    fetchProgress();
  }, [exam, subjectsData, user]);

  const filteredSubjects = subjects.filter(sub =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubjectSelect = (sub: any) => {
    setSubject(sub);
    router.replace('/(tabs)/notes');
  };


  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 20 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>Choose Subject</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#94A3B8" strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search subjects..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Subjects List */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.examsList}>
            <Text style={styles.subtitle}>What subject do you want to learn?</Text>
            {filteredSubjects.map((sub) => {
              const prog = progressMap[sub.id];
              const total = prog?.total || 0;
              const completed = prog?.completed || 0;
              const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isComplete = total > 0 && completed === total;

              return (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.examCard}
                  onPress={() => handleSubjectSelect(sub)}
                >
                  <View style={styles.subjectIconWrap}>
                    {sub.image_url ? (
                      <Image source={{ uri: sub.image_url }} style={styles.subjectIconImage} />
                    ) : (
                      <SubjectInitial name={sub.name} size={48} />
                    )}
                  </View>
                  <View style={styles.examInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.examName}>{sub.name}</Text>
                      {isComplete && (
                        <CheckCircle size={16} color={colors.success} strokeWidth={2.5} />
                      )}
                    </View>
                    {sub.description ? (
                      <Text style={styles.examCode} numberOfLines={1}>{sub.description}</Text>
                    ) : null}

                    {/* Progress section */}
                    {total > 0 && (
                      <View style={styles.progressSection}>
                        <View style={styles.progressBarBg}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${percentage}%`,
                                backgroundColor: isComplete ? colors.success : colors.primary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[
                          styles.progressText,
                          isComplete && { color: colors.success },
                        ]}>
                          {completed}/{total}
                        </Text>
                      </View>
                    )}

                    {total === 0 && (
                      <Text style={styles.noNotesText}>No notes yet</Text>
                    )}
                  </View>
                  <ChevronRight size={20} color={colors.subText} strokeWidth={2} />
                </TouchableOpacity>
              );
            })}
            {filteredSubjects.length === 0 && searchQuery && (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>No subjects found</Text>
                <Text style={styles.noResultsSubtext}>
                  Try adjusting your search terms
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  examsList: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  subtitle: {
    fontSize: 16,
    color: colors.subText,
    marginBottom: 24,
  },
  examCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: colors.inputBg,
  },
  subjectIconImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  examInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  examName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  examCode: {
    fontSize: 13,
    color: colors.subText,
    marginBottom: 10,
  },

  // Progress
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: isDark ? '#252530' : '#E5E7EB',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.subText,
    minWidth: 32,
    textAlign: 'right',
  },
  noNotesText: {
    fontSize: 12,
    color: colors.subText,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Meta
  examMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  examMetaText: {
    fontSize: 12,
    color: colors.subText,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.subText,
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: colors.subText,
    textAlign: 'center',
  },
});