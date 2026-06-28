import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  BackHandler,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import {
  ArrowLeft,
  FileText,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  Award,
  Target,
  BookOpen,
  TrendingUp,
  ClipboardList,
  MessageSquare,
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import MathMarkdown from '@/components/MathMarkdown';

const { width, height } = Dimensions.get('window');

interface Evaluation {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  question_text: string | null;
  file_name: string;
  file_url: string;
  model_question: string | null;
  evaluation: any;
  total_marks: number | null;
  awarded_marks: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export default function EvaluateHistoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ evaluation_id?: string }>();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isResultLoading, setIsResultLoading] = useState(false);
  const skeletonAnim = useRef(new Animated.Value(0)).current;

  const loadEvaluations = useCallback(async (showLoader = false) => {
    if (!user) return;
    if (showLoader) setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('main_evaluations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const list = data || [];
      setEvaluations(list);

      // Update selected eval if it's in the list
      if (selectedEval) {
        const updated = list.find(e => e.id === selectedEval.id);
        if (updated) setSelectedEval(updated);
      }

      return list;
    } catch (err) {
      console.error('Load evaluations error:', err);
      return null;
    } finally {
      if (showLoader) setIsLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedEval]);

  // Initial load + auto-open evaluation_id if passed
  useEffect(() => {
    const init = async () => {
      const list = await loadEvaluations(true);
      if (params.evaluation_id && list) {
        const target = list.find(e => e.id === params.evaluation_id);
        if (target) setSelectedEval(target);
      }
    };
    init();
  }, []);

  // Poll for processing items every 5 seconds
  useEffect(() => {
    const hasProcessing = evaluations.some(e => e.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      loadEvaluations(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [evaluations, loadEvaluations]);

  // Handle hardware back button: pop out of result detail first, then exit screen
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedEval) {
        setSelectedEval(null);
        setIsResultLoading(false);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [selectedEval]);

  // Skeleton shimmer animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isResultLoading) {
      const shimmer = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation = shimmer;
      shimmer.start();
    } else {
      skeletonAnim.setValue(0);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isResultLoading, skeletonAnim]);

  const onRefresh = () => {
    setRefreshing(true);
    loadEvaluations(false);
  };

  const handleSelectEval = (eval_: Evaluation) => {
    setIsResultLoading(true);
    setSelectedEval(eval_);
    // Clear skeleton after a frame to let the heavy result view mount
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsResultLoading(false);
      });
    });
  };

  const handleBack = () => {
    if (selectedEval) {
      setSelectedEval(null);
      setIsResultLoading(false);
    } else {
      router.back();
    }
  };

  const renderHistoryList = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >


      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subText }]}>Loading evaluations...</Text>
        </View>
      ) : evaluations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FileText size={56} color={colors.subText} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>No evaluations yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.subText }]}>
            Upload an answer sheet from the Evaluate Mains tool
          </Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {evaluations.map((eval_) => (
            <TouchableOpacity
              key={eval_.id}
              style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleSelectEval(eval_)}
              activeOpacity={0.7}
            >
              <View style={styles.historyCardHeader}>
                <View style={styles.historyCardLeft}>
                  <FileText size={20} color={colors.primary} />
                  <View style={styles.historyCardInfo}>
                    <Text style={[styles.historyCardTitle, { color: colors.text }]} numberOfLines={1}>
                      {eval_.file_name}
                    </Text>
                    <Text style={[styles.historyCardDate, { color: colors.subText }]}>
                      {new Date(eval_.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <View style={styles.historyCardRight}>
                  {eval_.status === 'completed' && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.success + '20' }]}>
                      <CheckCircle size={14} color={colors.success} />
                      <Text style={[styles.statusText, { color: colors.success }]}>
                        {eval_.awarded_marks !== null ? `${eval_.awarded_marks}/${eval_.total_marks}` : 'Done'}
                      </Text>
                    </View>
                  )}
                  {eval_.status === 'processing' && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.warning + '20' }]}>
                      <ActivityIndicator size={12} color={colors.warning} />
                      <Text style={[styles.statusText, { color: colors.warning }]}>Analysing...</Text>
                    </View>
                  )}
                  {eval_.status === 'failed' && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.error + '20' }]}>
                      <AlertCircle size={14} color={colors.error} />
                      <Text style={[styles.statusText, { color: colors.error }]}>Failed</Text>
                    </View>
                  )}
                  <ChevronRight size={18} color={colors.subText} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderResultDetail = () => {
    if (!selectedEval) return null;

    if (isResultLoading) {
      return <ResultSkeleton />;
    }

    if (selectedEval.status === 'processing') {
      return (
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 100 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text, fontSize: 18, fontWeight: '600' }]}>
            Analysing your answer sheet...
          </Text>
          <Text style={[styles.loadingText, { color: colors.subText }]}>
            This usually takes 30-60 seconds. You can leave this screen — it will complete in the background.
          </Text>
        </View>
      );
    }

    if (selectedEval.status === 'failed') {
      return (
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 100 }]}>
          <AlertCircle size={48} color={colors.error} />
          <Text style={[styles.loadingText, { color: colors.text, fontSize: 18, fontWeight: '600' }]}>
            Evaluation Failed
          </Text>
          <Text style={[styles.loadingText, { color: colors.subText }]}>
            {selectedEval.error_message || 'An error occurred during evaluation'}
          </Text>
        </View>
      );
    }

    const result = selectedEval.evaluation;
    if (!result) return null;

    const questions = result.questions || [];

    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 24, paddingHorizontal: 20 }}
        >
          <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.resultHeader}>
              <Award size={28} color={colors.primary} />
              <View style={styles.resultHeaderInfo}>
                <Text style={[styles.resultTitle, { color: colors.text }]}>Overall Score</Text>
                <Text style={[styles.resultScore, { color: colors.primary }]}>
                  {result.awarded_marks}/{result.total_marks}
                </Text>
              </View>
            </View>
            <MathMarkdown text={result.overall_summary || ''} color={colors.text} fontSize={15} style={styles.resultSummary} />
          </View>

          {result.strengths && result.strengths.length > 0 && (
            <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.resultSectionHeader}>
                <Target size={20} color={colors.success} />
                <Text style={[styles.resultSectionTitle, { color: colors.text }]}>Strengths</Text>
              </View>
              {result.strengths.map((s: string, i: number) => (
                <MathMarkdown key={i} text={`• ${s}`} color={colors.text} fontSize={14} style={styles.resultBullet} />
              ))}
            </View>
          )}

          {result.weaknesses && result.weaknesses.length > 0 && (
            <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.resultSectionHeader}>
                <AlertCircle size={20} color={colors.error} />
                <Text style={[styles.resultSectionTitle, { color: colors.text }]}>Areas to Improve</Text>
              </View>
              {result.weaknesses.map((w: string, i: number) => (
                <MathMarkdown key={i} text={`• ${w}`} color={colors.text} fontSize={14} style={styles.resultBullet} />
              ))}
            </View>
          )}

          {questions.map((q: any, idx: number) => (
            <View key={idx} style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.resultSectionHeader}>
                <BookOpen size={20} color={colors.primary} />
                <Text style={[styles.resultSectionTitle, { color: colors.text }]}>
                  Question {q.question_number}
                </Text>
                <Text style={[styles.questionMarks, { color: colors.primary }]}>
                  {q.awarded_marks}/{q.max_marks}
                </Text>
              </View>
              <MathMarkdown text={q.question_text || ''} color={colors.text} fontSize={15} style={styles.questionText} />

              <Text style={[styles.subsectionTitle, { color: colors.subText }]}>What You Wrote:</Text>
              <MathMarkdown text={q.what_candidate_wrote || ''} color={colors.text} fontSize={14} style={styles.resultText} />

              <Text style={[styles.subsectionTitle, { color: colors.subText }]}>Analysis:</Text>
              <MathMarkdown text={q.analysis || ''} color={colors.text} fontSize={14} style={styles.resultText} />

              {q.mistakes && q.mistakes.length > 0 && (
                <>
                  <Text style={[styles.subsectionTitle, { color: colors.subText }]}>Mistakes:</Text>
                  {q.mistakes.map((m: any, mi: number) => (
                    <View key={mi} style={styles.mistakeItem}>
                      <Text style={[styles.mistakeType, { color: colors.error }]}>{m.type}:</Text>
                      <MathMarkdown text={m.description || ''} color={colors.text} fontSize={14} style={styles.mistakeDesc} />
                      <Text style={[styles.mistakeCorrection, { color: colors.success }]}>Correction: </Text>
                      <MathMarkdown text={m.correction || ''} color={colors.success} fontSize={13} style={styles.mistakeCorrection} />
                    </View>
                  ))}
                </>
              )}

              {q.topic_wise_analysis && q.topic_wise_analysis.length > 0 && (
                <>
                  <Text style={[styles.subsectionTitle, { color: colors.subText }]}>Topic Coverage:</Text>
                  {q.topic_wise_analysis.map((t: any, ti: number) => (
                    <View key={ti} style={styles.topicItem}>
                      <Text style={[styles.topicName, { color: colors.text }]}>{t.topic}</Text>
                      <Text style={[styles.topicStatus, { color: t.addressed ? colors.success : colors.error }]}>
                        {t.addressed ? '✓ Addressed' : '✗ Missing'}
                      </Text>
                      <MathMarkdown text={t.comment || ''} color={colors.subText} fontSize={13} style={styles.topicComment} />
                    </View>
                  ))}
                </>
              )}

              <Text style={[styles.subsectionTitle, { color: colors.subText }]}>Model Answer:</Text>
              <MathMarkdown text={q.model_answer || ''} color={colors.text} fontSize={14} style={styles.resultText} />

              {q.marks_breakdown && (
                <>
                  <Text style={[styles.subsectionTitle, { color: colors.subText }]}>Marks Breakdown:</Text>
                  {Object.entries(q.marks_breakdown).map(([key, val]: [string, any], bi: number) => (
                    <View key={bi} style={styles.marksBreakdownItem}>
                      <Text style={[styles.marksLabel, { color: colors.text }]}>{key.replace(/_/g, ' ')}:</Text>
                      <Text style={[styles.marksValue, { color: colors.primary }]}>
                        {val.awarded}/{val.max}
                      </Text>
                      <MathMarkdown text={val.comment || ''} color={colors.subText} fontSize={13} style={styles.marksComment} />
                    </View>
                  ))}
                </>
              )}
            </View>
          ))}

          {result.study_recommendations && result.study_recommendations.length > 0 && (
            <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.resultSectionHeader}>
                <TrendingUp size={20} color={colors.primary} />
                <Text style={[styles.resultSectionTitle, { color: colors.text }]}>Study Recommendations</Text>
              </View>
              {result.study_recommendations.map((rec: any, i: number) => (
                <View key={i} style={styles.recommendationItem}>
                  <MathMarkdown text={rec.topic || ''} color={colors.text} fontSize={15} style={styles.recTopic} />
                  <MathMarkdown text={rec.action || ''} color={colors.subText} fontSize={14} style={styles.recAction} />
                  <View style={[styles.priorityBadge, { backgroundColor: rec.priority === 'High' ? colors.error + '20' : rec.priority === 'Medium' ? colors.warning + '20' : colors.success + '20' }]}>
                    <Text style={[styles.priorityText, { color: rec.priority === 'High' ? colors.error : rec.priority === 'Medium' ? colors.warning : colors.success }]}>
                      {rec.priority}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Floating Action Buttons */}
        <View style={[styles.actionButtonsContainer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.border }]}
            onPress={() => router.push({
              pathname: '/ai-mentor',
              params: { evaluation_id: selectedEval.id, mode: 'mcq' },
            })}
            activeOpacity={0.7}
          >
            <ClipboardList size={20} color={colors.text} />
            <Text style={[styles.actionBtnTextOutline, { color: colors.text }]}>Take MCQ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary, { backgroundColor: colors.primary }]}
            onPress={() => router.push({
              pathname: '/ai-mentor',
              params: { evaluation_id: selectedEval.id, mode: 'mentor' },
            })}
            activeOpacity={0.7}
          >
            <MessageSquare size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnTextPrimary}>Ask AI Mentor</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const ResultSkeleton = () => {
    const opacity = skeletonAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    });

    const SkeletonBlock = ({ width: w, height: h = 16, style: extraStyle = {} }: { width: number | string; height?: number; style?: any }) => (
      <Animated.View
        style={[
          styles.skeletonBlock,
          {
            width: w as any,
            height: h,
            backgroundColor: colors.border,
            opacity,
          },
          extraStyle,
        ]}
      />
    );

    return (
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}
      >
        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.resultHeader}>
            <SkeletonBlock width={28} height={28} style={{ borderRadius: 14 }} />
            <View style={styles.resultHeaderInfo}>
              <SkeletonBlock width={100} height={14} style={{ marginBottom: 6 }} />
              <SkeletonBlock width={60} height={28} />
            </View>
          </View>
          <SkeletonBlock width="100%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonBlock width="90%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonBlock width="60%" height={14} />
        </View>

        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonBlock width={120} height={18} style={{ marginBottom: 14 }} />
          <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="85%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="70%" height={14} />
        </View>

        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonBlock width={140} height={18} style={{ marginBottom: 14 }} />
          <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="80%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="60%" height={14} />
        </View>

        <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SkeletonBlock width={100} height={18} style={{ marginBottom: 14 }} />
          <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="95%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="75%" height={14} style={{ marginBottom: 8 }} />
          <SkeletonBlock width="50%" height={14} />
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {selectedEval ? 'Evaluation Result' : 'Evaluation History'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {selectedEval ? renderResultDetail() : renderHistoryList()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  historyList: {
    paddingBottom: 20,
  },
  historyCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyCardInfo: {
    marginLeft: 12,
    flex: 1,
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  historyCardDate: {
    fontSize: 13,
    marginTop: 2,
  },
  historyCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultHeaderInfo: {
    marginLeft: 12,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultScore: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  resultSummary: {
    fontSize: 15,
    lineHeight: 22,
  },
  resultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  resultSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  questionMarks: {
    fontSize: 18,
    fontWeight: '700',
  },
  resultBullet: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    lineHeight: 22,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase' as any,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 21,
  },
  mistakeItem: {
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#EF4444',
  },
  mistakeType: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  mistakeDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  mistakeCorrection: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  topicItem: {
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  topicName: {
    fontSize: 14,
    fontWeight: '600',
  },
  topicStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  topicComment: {
    fontSize: 13,
    width: '100%',
    lineHeight: 18,
  },
  marksBreakdownItem: {
    marginBottom: 8,
  },
  marksLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  marksValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  marksComment: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  recommendationItem: {
    marginBottom: 12,
  },
  recTopic: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  recAction: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  skeletonBlock: {
    borderRadius: 6,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 0,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  actionBtnPrimary: {
    borderWidth: 0,
  },
  actionBtnTextOutline: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionBtnTextPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});