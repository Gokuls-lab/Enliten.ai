import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp, Search, Trash2, X } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const QUIZ_FILTER_OPTIONS = ['All', 'Incorrect', 'Correct', 'Recent'];
const FLASHCARD_FILTER_OPTIONS = ['All', 'Unknown', 'Known', 'Recent'];

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const { user } = useAuth();
  const { exam } = useExam();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [reviewedQuestions, setReviewedQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // New state for review mode
  const [reviewMode, setReviewMode] = useState<'quiz' | 'flashcard'>('quiz');

  // Reset filter when mode changes
  useEffect(() => {
    setSelectedFilter('All');
  }, [reviewMode]);

  const currentFilterOptions = reviewMode === 'flashcard' ? FLASHCARD_FILTER_OPTIONS : QUIZ_FILTER_OPTIONS;

  // Animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (!loading) {
      opacity.value = withTiming(1, { duration: 600 });
      translateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.exp) });
    }
  }, [loading]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const fetchReviewedQuestions = useCallback(async () => {
    if (!user) return;
    if (!refreshing) setLoading(true); // Don't block UI on refresh
    try {
      if (reviewMode === 'quiz') {
        // --- QUIZ MODE Logic ---
        // Get regular quiz_sessions for user for this exam (capped at 50 most recent)
        const { data: regularSessions, error: sessionError } = await supabase
          .from('quiz_sessions')
          .select('id, completed_at')
          .eq('user_id', user.id)
          .eq('exam_id', exam?.id)
          .order('completed_at', { ascending: false })
          .limit(50);
        if (sessionError) throw sessionError;

        // Get AI quiz sessions (quiz_type = 'ai-mentor', no exam_id filter)
        const { data: aiSessions, error: aiSessionError } = await supabase
          .from('quiz_sessions')
          .select('id, completed_at, ai_questions, ai_answers, score, total_questions')
          .eq('user_id', user.id)
          .eq('quiz_type', 'ai-mentor')
          .order('completed_at', { ascending: false })
          .limit(20);
        if (aiSessionError) throw aiSessionError;

        const regularSessionIds = (regularSessions || []).map((s: any) => s.id);
        const aiSessionList = aiSessions || [];

        if (regularSessionIds.length === 0 && aiSessionList.length === 0) {
          setReviewedQuestions([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        // Process regular quiz answers
        let reviewed: any[] = [];
        if (regularSessionIds.length > 0) {
          let answersQuery = supabase
            .from('user_answers')
            .select('id, question_id, selected_option_id, is_correct, answered_at, quiz_session_id, questions:question_id (question_text, explanation, difficulty, domain, subject_id), selected_option:selected_option_id (option_text), quiz_sessions:quiz_session_id (completed_at)')
            .in('quiz_session_id', regularSessionIds)
            .order('answered_at', { ascending: false });

          const { data: answers, error: answerError } = await answersQuery;
          if (answerError) throw answerError;

          // For each answer, get the correct option
          const questionIds = [...new Set((answers || []).map((a: any) => a.question_id))];
          let correctOptionsMap: Record<string, string> = {};
          if (questionIds.length > 0) {
            const { data: correctOptions, error: correctOptErr } = await supabase
              .from('question_options')
              .select('question_id, option_text')
              .eq('is_correct', true)
              .in('question_id', questionIds);
            if (!correctOptErr && correctOptions) {
              correctOptionsMap = correctOptions.reduce((acc: any, cur: any) => {
                acc[cur.question_id] = cur.option_text;
                return acc;
              }, {});
            }
          }

          // Deduplicate: keep only the most recent answer per question_id
          const latestByQuestion = new Map();
          for (const a of (answers || [])) {
            if (!latestByQuestion.has(a.question_id)) {
              latestByQuestion.set(a.question_id, a);
            }
          }

          // Map to UI format
          const regularReviewed = Array.from(latestByQuestion.values())
            .filter((a: any) => a.questions && a.questions.question_text && a.questions.question_text.trim() !== '')
            .map((a: any) => ({
              id: a.id,
              question: a.questions.question_text,
              userAnswer: a.selected_option?.option_text || '',
              correctAnswer: correctOptionsMap[a.question_id] || '',
              isCorrect: a.is_correct,
              subject: a.questions.domain || 'General',
              difficulty: a.questions.difficulty || 'Easy',
              date: a.quiz_sessions?.completed_at?.slice(0, 10) || '',
              explanation: a.questions.explanation || '',
              type: 'regular' as const,
            }));
          reviewed = [...reviewed, ...regularReviewed];
        }

        // Process AI quiz sessions
        if (aiSessionList.length > 0) {
          const aiReviewed = aiSessionList.flatMap((session: any) => {
            const questions = session.ai_questions || [];
            const answers = session.ai_answers || [];
            return answers.map((ans: any, idx: number) => {
              const q = questions[ans.questionIndex];
              if (!q) return null;
              return {
                id: `${session.id}-${idx}`,
                question: q.question,
                userAnswer: q.options[ans.selectedOptionIndex] || '',
                correctAnswer: q.options[q.correctIndex] || '',
                isCorrect: ans.isCorrect,
                subject: 'AI Mentor',
                difficulty: 'Mixed',
                date: session.completed_at?.slice(0, 10) || '',
                explanation: q.explanation || '',
                type: 'ai-mentor' as const,
              };
            }).filter(Boolean);
          });
          reviewed = [...reviewed, ...aiReviewed];
        }

        // Sort by date descending
        reviewed.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setReviewedQuestions(reviewed);

      } else {
        // --- FLASHCARD MODE Logic ---
        // Fetch from user_study_logs
        // We need to join with adaptive_questions to get question details
        // Note: logs has question_id -> adaptive_questions(id)

        // 1. Get logs for this user and exam. Ideally we filter by exam via the question relation, 
        //    but supabase join filtering can be tricky.
        //    Let's first get adaptive_questions IDs for this exam to filter logs efficiently if possible,
        //    or just fetch logs and filter by joined question exam_id.
        //    Given the schema, user_study_logs links to adaptive_questions.

        // Approach: Fetch logs, join adaptive_questions. Order by created_at desc.
        const { data: logs, error: logsError } = await supabase
          .from('user_study_logs')
          .select(`
            id,
            question_id,
            is_correct,
            created_at,
            question:question_id (
              id,
              question_text,
              answer_text,
              exam_id,
              domain,
              difficulty_tier
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(200); // Limit to recent 200 flashcards for performance

        if (logsError) throw logsError;

        // Filter for current exam and deduplicate
        const relevantLogs = (logs || []).filter((log: any) => log.question?.exam_id === exam.id);

        const latestByQuestionFlashcard = new Map();
        for (const log of relevantLogs) {
          // We want to show individual attempts or unique questions? 
          // Usually "Review" implies seeing unique questions. User might have seen same card multiple times.
          // Let's show unique questions, keeping the LATEST attempt status.
          if (!latestByQuestionFlashcard.has(log.question_id)) {
            latestByQuestionFlashcard.set(log.question_id, log);
          }
        }

        const reviewedFlashcards = Array.from(latestByQuestionFlashcard.values())
          .map((log: any) => ({
            id: log.id, // log id
            question: log.question?.question_text || 'Unknown Question',
            userAnswer: log.is_correct ? 'Marked as Known' : 'Marked as Unknown', // Flashcards don't have selected options usually
            correctAnswer: log.question?.answer_text || '', // The "Back" of the card
            isCorrect: log.is_correct,
            subject: '', // Hide domain for flashcards
            difficulty: `Tier ${log.question?.difficulty_tier || '?'}`,
            date: log.created_at?.slice(0, 10) || '',
            explanation: '', // Hide explanation for flashcards
          }));

        setReviewedQuestions(reviewedFlashcards);
      }

    } catch (err) {
      console.error(err);
      // Fail silently on refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, exam, reviewMode]);

  useEffect(() => {
    fetchReviewedQuestions();
  }, [fetchReviewedQuestions]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchReviewedQuestions();
  }, [fetchReviewedQuestions]);

  const handleClearHistory = async () => {
    Alert.alert(
      "Clear Review History",
      `Are you sure you want to delete all your ${reviewMode === 'flashcard' ? 'flashcard' : 'quiz'} history for this exam? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              console.log('[ReviewScreen] Clearing history for:', { uid: user?.id, examId: exam?.id, mode: reviewMode });

              if (reviewMode === 'quiz') {
                // Delete sessions
                await supabase
                  .from('quiz_sessions')
                  .delete()
                  .eq('user_id', user?.id)
                  .eq('exam_id', exam?.id);

                // Delete answers fallback
                const { data: examQuestions } = await supabase
                  .from('questions')
                  .select('id')
                  .eq('exam', exam?.id);
                if (examQuestions && examQuestions.length > 0) {
                  const qIds = examQuestions.map(q => q.id);
                  await supabase.from('user_answers').delete().eq('user_id', user?.id).in('question_id', qIds);
                }

                // Reset Level Up progression
                await supabase.rpc('update_exam_stage', {
                  uid: user?.id,
                  exam_id: exam?.id,
                  new_stage: 0,
                });
              } else {
                // --- Flashcard Clear ---
                // We need to delete from user_study_logs where question_id belongs to this exam
                const { data: questions } = await supabase
                  .from('adaptive_questions')
                  .select('id')
                  .eq('exam_id', exam?.id);

                if (questions && questions.length > 0) {
                  const qIds = questions.map(q => q.id);
                  await supabase.from('user_study_logs')
                    .delete()
                    .eq('user_id', user?.id)
                    .in('question_id', qIds);

                  // Reset adaptive progress
                  await supabase.rpc('reset_adaptive_progress_v2', {
                    p_user_id: user?.id,
                    p_exam_id: exam?.id,
                    p_level: 1,
                    p_swiped: 0
                  });
                }
              }

              setReviewedQuestions([]);
              ToastAndroid.show('History cleared', ToastAndroid.SHORT);
              // Refresh to ensure clean state
              fetchReviewedQuestions();
            } catch (err) {
              Alert.alert('Error', 'Failed to clear history');
              console.error(err);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getFilteredQuestions = () => {
    let filtered = reviewedQuestions;

    // 1. Text Search
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
        q.question.toLowerCase().includes(lowerQuery) ||
        q.explanation.toLowerCase().includes(lowerQuery) ||
        q.subject.toLowerCase().includes(lowerQuery)
      );
    }

    // 2. Category Filter
    switch (selectedFilter) {
      case 'Incorrect':
      case 'Unknown':
        return filtered.filter(q => !q.isCorrect);
      case 'Correct':
      case 'Known':
        return filtered.filter(q => q.isCorrect);
      case 'Recent':
        if (filtered.length === 0) return [];
        const mostRecentDate = filtered[0].date;
        return filtered.filter(q => q.date === mostRecentDate);
      default:
        return filtered;
    }
  };

  const getStatsData = () => {
    const total = reviewedQuestions.length;
    const correct = reviewedQuestions.filter(q => q.isCorrect).length;
    const incorrect = total - correct;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, incorrect, accuracy };
  };

  const stats = getStatsData();
  const filteredQuestions = getFilteredQuestions();

  const handleClearSearch = () => {
    setSearchQuery('');
    // Keyboard.dismiss(); // Optional: if imported
  };

  if (loading && !refreshing) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <SpinnerAnimation />
            <Text style={{ color: '#94A3B8', marginTop: 16 }}>Loading review data...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 90 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Review Questions</Text>
            <Text style={styles.subtitle}>
              {reviewMode === 'quiz' ? 'Learn from your mistakes' : 'Review your flashcard mastery'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClearHistory}
            style={styles.deleteButton}
          >
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Mode Toggle Capsule */}
        <View style={styles.modeToggleContainer}>
          <View style={styles.modeToggleBg}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, reviewMode === 'quiz' && styles.modeToggleBtnActive]}
              onPress={() => setReviewMode('quiz')}
            >
              <Text style={[styles.modeToggleText, reviewMode === 'quiz' && styles.modeToggleTextActive]}>Quiz Results</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, reviewMode === 'flashcard' && styles.modeToggleBtnActive]}
              onPress={() => setReviewMode('flashcard')}
            >
              <Text style={[styles.modeToggleText, reviewMode === 'flashcard' && styles.modeToggleTextActive]}>Flashcards</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar - Fixed at top */}
        <View style={styles.searchContainer}>
          <Search size={20} color="#94A3B8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions or domains..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Tabs - Fixed below search */}
        <View style={styles.filterTabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsContent}>
            {currentFilterOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.filterTab,
                  selectedFilter === option && styles.filterTabActive
                ]}
                onPress={() => setSelectedFilter(option)}
              >
                <Text style={[
                  styles.filterTabText,
                  selectedFilter === option && styles.filterTabTextActive
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Stats Overview */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Reviewed</Text>
              <View style={[styles.statAccent, { backgroundColor: colors.primary }]} />
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.correct}</Text>
              <Text style={styles.statLabel}>{reviewMode === 'flashcard' ? 'Known' : 'Correct'}</Text>
              <View style={[styles.statAccent, { backgroundColor: '#10B981' }]} />
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.incorrect}</Text>
              <Text style={styles.statLabel}>{reviewMode === 'flashcard' ? 'Unknown' : 'Incorrect'}</Text>
              <View style={[styles.statAccent, { backgroundColor: '#EF4444' }]} />
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
              <View style={[styles.statAccent, { backgroundColor: colors.primary }]} />
            </View>
          </View>

          {/* Results Count */}
          <Text style={styles.resultsCount}>
            Showing {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
          </Text>

          {/* Questions List */}
          <Animated.View style={[styles.questionsContainer, animatedStyle]}>
            {filteredQuestions.map((question) => {
              const isExpanded = expandedQuestion === question.id;
              return (
                <View key={question.id} style={[styles.questionCard, isExpanded && styles.questionCardExpanded]}>
                  <TouchableOpacity
                    style={styles.questionHeader}
                    activeOpacity={0.7}
                    onPress={() => setExpandedQuestion(isExpanded ? null : question.id)}
                  >
                    <View style={styles.questionInfo}>
                      <View style={styles.questionMeta}>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: question.isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: question.isCorrect ? '#10B981' : '#EF4444' }
                          ]}>
                            {reviewMode === 'flashcard' ? (question.isCorrect ? 'Known' : 'Unknown') : (question.isCorrect ? 'Correct' : 'Incorrect')}
                          </Text>
                        </View>
                        {question.subject ? <Text style={styles.subjectText}>{question.subject}</Text> : null}
                      </View>
                      <Text style={styles.questionText}>
                        {question.question}
                      </Text>
                    </View>
                    <View style={styles.expandIconContainer}>
                      {isExpanded ? (
                        <ChevronUp size={20} color="#94A3B8" />
                      ) : (
                        <ChevronDown size={20} color="#94A3B8" />
                      )}
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.questionDetails}>
                      <View style={styles.detailRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.answerLabel}>{reviewMode === 'flashcard' ? 'Your Response' : 'Your Answer'}</Text>
                          <Text style={[
                            styles.answerText,
                            { color: question.isCorrect ? '#10B981' : '#EF4444' }
                          ]}>
                            {question.userAnswer}
                          </Text>
                        </View>

                        {!question.isCorrect && (
                          <View style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: '#334155' }}>
                            <Text style={styles.answerLabel}>{reviewMode === 'flashcard' ? 'Answer' : 'Correct Answer'}</Text>
                            <Text style={[styles.answerText, { color: '#10B981' }]}>
                              {question.correctAnswer}
                            </Text>
                          </View>
                        )}
                      </View>

                      {question.explanation ? (
                        <View style={styles.explanationSection}>
                          <Text style={styles.explanationLabel}>Explanation</Text>
                          <Text style={styles.explanationText}>{question.explanation}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              )
            })}
          </Animated.View>

          {filteredQuestions.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Search size={32} color="#475569" />
              </View>
              <Text style={styles.emptyStateText}>No questions found</Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your filters or search</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </LinearGradient >
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    // paddingTop: 30, // Removed hardcoded padding
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subText,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  filterTabsContainer: {
    marginBottom: 16,
    paddingLeft: 20,
  },
  filterTabsContent: {
    paddingRight: 20,
    gap: 10,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.subText,
  },
  statAccent: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.1,
  },
  resultsCount: {
    fontSize: 13,
    color: colors.subText,
    marginBottom: 12,
    marginLeft: 4,
  },
  questionsContainer: {
    gap: 12,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  questionCardExpanded: {
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  questionHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  questionInfo: {
    flex: 1,
    marginRight: 12,
  },
  questionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectText: {
    fontSize: 12,
    color: colors.subText,
    backgroundColor: colors.inputBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  questionText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    fontWeight: '500',
  },
  expandIconContainer: {
    marginTop: 2,
  },
  questionDetails: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.inputBg,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  answerLabel: {
    fontSize: 11,
    color: colors.subText,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  answerText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  explanationSection: {
    backgroundColor: colors.inputBg,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  explanationLabel: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 14,
    color: colors.subText,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    backgroundColor: colors.card,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.subText,
  },
  // Mode Toggle Styles
  modeToggleContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modeToggleBg: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 25,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 22,
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primary,
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.subText,
  },
  modeToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

function SpinnerAnimation() {
  const rotation = useSharedValue(0);
  React.useEffect(() => {
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
          stroke="#8A2BE2"
          strokeWidth={6}
          strokeDasharray={"44 88"}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}