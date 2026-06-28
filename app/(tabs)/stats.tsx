import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getRankForLevel, isMaxLevel } from '@/lib/adaptiveRanks';
import { getExamQuestionCount, getUserAdaptiveProgress, resetAdaptiveProgress } from '@/lib/flashcards'; // Added imports
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChartBar as BarChart, Calendar, ChevronDown, ChevronUp, Clock, Crown, Target, Trash2, Zap } from 'lucide-react-native'; // Added icons
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, interpolate } from 'react-native-reanimated';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Text as SvgText,
  G,
  Rect,
  Line
} from 'react-native-svg';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

const SUBJECT_COLORS: Record<string, string> = {
  'SASE': '#10B981',
  'Penetration Testing': '#3B82F6',
  'Access Control Models': '#8B5CF6',
  'Virtual TPM (vTPM)': '#EF4444',
  'Incident Response': '#8A2BE2',
};
function subjectColor(score: number) {
  if (score >= 80) return '#10B981';
  if (score > 49) return '#8A2BE2';
  return '#EF4444';
}

const getBezierPath = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cpX1 = curr.x + (next.x - curr.x) / 2;
    const cpY1 = curr.y;
    const cpX2 = curr.x + (next.x - curr.x) / 2;
    const cpY2 = next.y;
    d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }
  return d;
};

interface LineChartProps {
  data: number[];
  labels: string[];
  fullDates: string[];
  colors: any;
}

const InteractiveLineChart = ({ data, labels, fullDates, colors }: LineChartProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(6);
  const [chartWidth, setChartWidth] = useState(width - 40);

  const onLayout = (event: any) => {
    const { width: layoutWidth } = event.nativeEvent.layout;
    if (layoutWidth > 0) {
      setChartWidth(layoutWidth);
    }
  };

  const chartHeight = 200;
  const paddingLeft = 30;
  const paddingRight = 15;
  const paddingTop = 35;
  const paddingBottom = 35;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const maxValue = Math.max(...data, 5);

  const getX = (index: number) => {
    return paddingLeft + (index / (data.length - 1 || 1)) * graphWidth;
  };

  const getY = (value: number) => {
    return chartHeight - paddingBottom - (value / maxValue) * graphHeight;
  };

  const points = data.map((val, idx) => ({
    x: getX(idx),
    y: getY(val),
    value: val,
    label: labels[idx],
    date: fullDates[idx]
  }));

  const linePath = getBezierPath(points);
  const areaPath = points.length > 0 && linePath
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`
    : '';

  const gridLines = [0, Math.round(maxValue / 2), maxValue];
  const columnWidth = graphWidth / (data.length - 1 || 1);

  return (
    <View style={{ width: '100%' }} onLayout={onLayout}>
      {/* Selected Value Display Header */}
      {selectedIndex !== null && points[selectedIndex] && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 }}>
          <View>
            <Text style={{ color: colors.subText, fontSize: 12, fontWeight: '600' }}>
              {points[selectedIndex].date}
            </Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
              {points[selectedIndex].value} <Text style={{ fontSize: 13, fontWeight: '500', color: colors.subText }}>questions solved</Text>
            </Text>
          </View>
          {selectedIndex === 6 && (
            <View style={{ backgroundColor: colors.primaryMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: colors.primary + '30' }}>
              <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>TODAY</Text>
            </View>
          )}
        </View>
      )}

      {/* SVG Container */}
      <View style={{ height: chartHeight, overflow: 'hidden' }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            {/* Gradient under the line */}
            <SvgLinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
            </SvgLinearGradient>

            {/* Gradient for the line stroke */}
            <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={colors.secondary} />
              <Stop offset="50%" stopColor={colors.primary} />
              <Stop offset="100%" stopColor={colors.tint || colors.primary} />
            </SvgLinearGradient>
          </Defs>

          {/* Grid lines & Y-Axis Labels */}
          {gridLines.map((val, idx) => {
            const y = getY(val);
            return (
              <G key={idx}>
                {/* Horizontal Grid Line */}
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray={val === 0 ? undefined : "4 4"}
                  opacity={val === 0 ? 0.8 : 0.4}
                />
                {/* Y-Axis Label */}
                <SvgText
                  x={paddingLeft - 8}
                  y={y + 4}
                  fill={colors.subText}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor="end"
                  opacity={0.7}
                >
                  {val}
                </SvgText>
              </G>
            );
          })}

          {/* Faint vertical grid lines for weekdays */}
          {points.map((pt, idx) => (
            <Line
              key={`vert-${idx}`}
              x1={pt.x}
              y1={paddingTop}
              x2={pt.x}
              y2={chartHeight - paddingBottom}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.15}
            />
          ))}

          {/* Gradient Fill under Bezier Path */}
          {areaPath ? (
            <Path
              d={areaPath}
              fill="url(#areaGrad)"
            />
          ) : null}

          {/* Bezier Curved Line Stroke */}
          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Selected indicator vertical line */}
          {selectedIndex !== null && points[selectedIndex] && (
            <Line
              x1={points[selectedIndex].x}
              y1={paddingTop - 5}
              x2={points[selectedIndex].x}
              y2={chartHeight - paddingBottom}
              stroke={colors.primary}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          )}

          {/* Data Dots */}
          {points.map((pt, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <G key={idx}>
                {/* Glow ring under selected dot */}
                {isSelected && (
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={9}
                    fill={colors.primary}
                    opacity={0.25}
                  />
                )}

                {/* Inner dot */}
                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 5 : 4}
                  fill={isSelected ? colors.primary : colors.card}
                  stroke={colors.primary}
                  strokeWidth={2.5}
                />
              </G>
            );
          })}

          {/* X-Axis labels inside Svg */}
          {points.map((pt, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <G key={`label-${idx}`}>
                <SvgText
                  x={pt.x}
                  y={chartHeight - 12}
                  fill={isSelected ? colors.primary : colors.subText}
                  fontSize={11}
                  fontWeight={isSelected ? "700" : "600"}
                  textAnchor="middle"
                >
                  {pt.label}
                </SvgText>
                {isSelected && (
                  <Circle
                    cx={pt.x}
                    cy={chartHeight - 4}
                    r={2}
                    fill={colors.primary}
                  />
                )}
              </G>
            );
          })}

          {/* Tooltip directly on SVG */}
          {selectedIndex !== null && points[selectedIndex] && (
            <G transform={`translate(${points[selectedIndex].x}, ${points[selectedIndex].y - 26 < 12 ? points[selectedIndex].y + 18 : points[selectedIndex].y - 26})`}>
              {/* Tooltip Background */}
              <Rect
                x={-18}
                y={-8}
                width={36}
                height={17}
                rx={5}
                fill={colors.text}
              />
              {/* Tooltip Value */}
              <SvgText
                x={0}
                y={4}
                fill={colors.card}
                fontSize={10}
                fontWeight="800"
                textAnchor="middle"
              >
                {points[selectedIndex].value}
              </SvgText>
            </G>
          )}

          {/* Transparent hit area columns covering full chart height for optimal touch response */}
          {points.map((pt, idx) => {
            const rectWidth = columnWidth;
            const rectX = pt.x - rectWidth / 2;
            return (
              <Rect
                key={`hit-${idx}`}
                x={rectX}
                y={0}
                width={rectWidth}
                height={chartHeight}
                fill="transparent"
                onPress={() => setSelectedIndex(idx)}
              />
            );
          })}
        </Svg>
      </View>
    </View>
  );
};



// ─── SHIMMER EFFECT COMPONENT ──────────────────────────────────────────────────
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

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [achievements, setAchievements] = useState<any[]>([]);
  const { user } = useAuth();
  const { exam, subject, loading: examLoading } = useExam();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const router = useRouter();

  // UX Improvement: Topic filtering state
  const [topicFilter, setTopicFilter] = useState<'weakest' | 'strongest' | 'all'>('weakest');
  const [showAllTopics, setShowAllTopics] = useState(false);

  const fetchStats = async () => {
    if (!user || !exam) return;
    if (!refreshing) setLoading(true);
    try {
      setSubjects([]);

      // 1. Fetch Adaptive Progress
      const adaptiveProgress = await getUserAdaptiveProgress(user.id, exam.id);

      // 1.5 Fetch total adaptive questions count
      const totalAdaptiveQuestions = await getExamQuestionCount(exam.id);


      // 2. Fetch all quiz sessions for the current exam
      const { data: sessions, error: sessionError } = await supabase
        .from('quiz_sessions')
        .select('id, completed_at, time_taken_seconds')
        .eq('user_id', user.id)
        .eq('exam_id', exam.id);
      if (sessionError) throw sessionError;

      // 3. Fetch all question IDs and Domains for the current exam
      const { data: examQuestions, error: questionsError } = await supabase
        .from('questions')
        .select('id, domain')
        .eq('exam', exam.id);
      if (questionsError) throw questionsError;

      const questionIdsForExam = (examQuestions || []).map(q => q.id);

      // Get unique domains from the questions
      const allDomains = [...new Set((examQuestions || []).map(q => q.domain).filter(d => d && d.trim() !== ''))].sort();

      // If there are no questions for this exam, there's nothing to show.
      if (questionIdsForExam.length === 0) {
        const fallbackLabels = [];
        const fallbackFullDates = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayVal = new Date();
        for (let i = 0; i < 7; i++) {
          const d = new Date(todayVal);
          d.setDate(todayVal.getDate() - (6 - i));
          fallbackLabels.push(dayNames[d.getDay()]);
          fallbackFullDates.push(`${monthNames[d.getMonth()]} ${d.getDate()}`);
        }
        setStats({
          streak: 0,
          totalQuestions: 0,
          accuracy: 0,
          studyTime: '0m',
          weeklyProgress: Array(7).fill(0),
          weeklyLabels: fallbackLabels,
          weeklyFullDates: fallbackFullDates,
          subjectScores: [],
          adaptive: adaptiveProgress,
          totalAdaptiveQuestions
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 4. Fetch all user answers that belong to this exam's questions
      let answersQuery = supabase
        .from('user_answers')
        .select('id, is_correct, answered_at, question_id, quiz_session_id, questions:question_id (domain, subject_id)')
        .eq('user_id', user.id)
        .in('question_id', questionIdsForExam);

      if (subject) {
        answersQuery = answersQuery.eq('questions.subject_id', subject.id);
      }

      const { data: answers, error: answerError } = await answersQuery.order('answered_at', { ascending: false });
      if (answerError) throw answerError;

      // Calculate Streak (from exam-specific sessions)
      const daysSet = new Set((sessions || []).map((s: any) => (s.completed_at || '').slice(0, 10)));
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (daysSet.has(ds)) {
          streak++;
        } else {
          break;
        }
      }

      // Calculate Core Stats (from exam-specific answers)
      const totalQuestions = answers.length;
      const correctAnswers = answers.filter((a: any) => a.is_correct).length;
      const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

      // Calculate Study Time
      const quizTimeSeconds = (sessions || []).reduce((sum: number, s: any) => sum + (s.time_taken_seconds || 0), 0);
      let reviewTimeSeconds = 0;
      const nonQuizAnswers = answers.filter(a => !a.quiz_session_id);
      if (nonQuizAnswers.length > 0) {
        const answersByDate: Record<string, any[]> = {};
        nonQuizAnswers.forEach(a => {
          const date = a.answered_at.split('T')[0];
          if (!answersByDate[date]) answersByDate[date] = [];
          answersByDate[date].push(a);
        });

        Object.values(answersByDate).forEach(dateAnswers => {
          const sortedAnswers = dateAnswers.sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime());
          sortedAnswers.forEach((answer, index) => {
            if (index === 0) return;
            const timeDiff = (new Date(answer.answered_at).getTime() - new Date(sortedAnswers[index - 1].answered_at).getTime()) / 1000;
            if (timeDiff <= 300) { // Only count if answers are within 5 minutes
              reviewTimeSeconds += timeDiff;
            }
          });
        });
      }
      const totalSeconds = quizTimeSeconds + reviewTimeSeconds;
      const totalMinutes = Math.round(totalSeconds / 60);
      const totalHours = totalMinutes / 60;
      const studyTime = totalMinutes < 60 ? `${totalMinutes}m` : `${totalHours.toFixed(1)}h`;

      // Calculate Weekly Progress
      const weeklyProgress = Array(7).fill(0);
      const weeklyLabels = [];
      const weeklyFullDates = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const ds = d.toISOString().slice(0, 10);
        weeklyProgress[i] = answers.filter((a: any) => (a.answered_at || '').slice(0, 10) === ds).length;
        weeklyLabels.push(dayNames[d.getDay()]);
        weeklyFullDates.push(`${monthNames[d.getMonth()]} ${d.getDate()}`);
      }

      // Calculate Domain Performance
      const latestByQuestion: Record<string, any> = {};
      for (const a of answers) {
        if (!latestByQuestion[a.question_id] || new Date(a.answered_at).getTime() > new Date(latestByQuestion[a.question_id].answered_at).getTime()) {
          latestByQuestion[a.question_id] = a;
        }
      }

      const domainMap: Record<string, { correct: number; total: number }> = {};
      for (const qid in latestByQuestion) {
        const a = latestByQuestion[qid];
        const domainName = a.questions?.domain || 'Other';

        if (!domainMap[domainName]) domainMap[domainName] = { correct: 0, total: 0 };
        domainMap[domainName].total++;
        if (a.is_correct) domainMap[domainName].correct++;
      }

      const DOMAIN_PALETTE = [
        '#3B82F6', '#10B981', '#8B5CF6', '#8A2BE2', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
      ];

      const getDomainColor = (index: number) => DOMAIN_PALETTE[index % DOMAIN_PALETTE.length];

      const subjectScores = allDomains.map((domainName: string, index: number) => ({
        name: domainName,
        score: domainMap[domainName] ? Math.round((domainMap[domainName].correct / domainMap[domainName].total) * 100) : 0,
        color: getDomainColor(index),
      }));

      setStats({
        streak,
        totalQuestions,
        correctAnswers,
        accuracy,
        studyTime,
        weeklyProgress,
        weeklyLabels,
        weeklyFullDates,
        subjectScores,
        adaptive: adaptiveProgress, // Add adaptive progress to stats
        totalAdaptiveQuestions,
      });

    } catch (err) {
      setStats(null);
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [user, exam]);

  const handleReset = async () => {
    Alert.alert(
      "Reset All Data",
      "Warning:- This will permanently erase data for the current exam:\n\n• Your quiz history and results\n• All performance statistics\n• Study time tracking\n• Achievement records\n• Level Up Progress\n• Flashcard Progress\n\nThis action cannot be undone. Do you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // Delete quiz sessions for the current exam
              await supabase
                .from('quiz_sessions')
                .delete()
                .eq('user_id', user?.id)
                .eq('exam_id', exam.id);

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

              // Delete user_progress
              console.log('[StatsScreen] Resetting level for:', { uid: user?.id, examId: exam?.id });

              const { error: rpcError } = await supabase.rpc('update_exam_stage', {
                uid: user?.id,
                exam_id: exam?.id,
                new_stage: 0,
              });

              if (rpcError) {
                console.error('[StatsScreen] RPC Error:', rpcError);
                Alert.alert('Error', 'Failed to reset level progress: ' + rpcError.message);
              } else {
                console.log('[StatsScreen] Level reset RPC successful');
              }

              // Reset Adaptive Flashcard Progress using library function
              if (user?.id) {
                await resetAdaptiveProgress(user.id, exam.id);
              }

              setStats(null);
              setAchievements([]);

              ToastAndroid.show('All data has been reset successfully', ToastAndroid.SHORT);

              fetchStats();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to reset data. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleAdaptiveReset = async () => {
    Alert.alert(
      "Reset Adaptive Progress",
      "Are you sure you want to reset ONLY your Adaptive Learning progress? This will reset your Level and Rank back to the beginning.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              if (user?.id) {
                await resetAdaptiveProgress(user.id, exam.id);
                ToastAndroid.show('Adaptive progress reset successfully', ToastAndroid.SHORT);
                fetchStats(); // Refresh stats
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to reset adaptive progress.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (!examLoading && user && exam) {
      fetchStats();
    }
  }, [user, exam, examLoading]);

  const adaptiveLevel = stats?.adaptive?.current_level || 1;
  const adaptiveRank = getRankForLevel(adaptiveLevel);
  const adaptiveSwiped = stats?.adaptive?.total_cards_swiped || 0;
  const totalAdaptiveForCalc = stats?.totalAdaptiveQuestions || 1;
  const adaptiveProgress = Math.min(100, (adaptiveSwiped / totalAdaptiveForCalc) * 100);

  if (examLoading) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: '#CBD5E1', fontSize: 18, marginTop: 16 }}>Loading Stats...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (!user || !exam) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.safeArea}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#F8FAFC', fontSize: 18, textAlign: 'center', marginBottom: 24 }}>
              Please select an exam to view your stats.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 }}
              onPress={() => router.push('/exam-selection')}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Select Exam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={{ flex: 1, paddingBottom: insets.bottom + 90 }}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Your Statistics</Text>
              <Text style={styles.subtitle}>Track your certification journey</Text>
            </View>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={handleReset}
                style={[styles.iconButton, styles.resetButton]}
                disabled={loading}
              >
                <Trash2
                  size={20}
                  color="#EF4444"
                  style={loading ? { opacity: 0.5 } : undefined}
                />
              </TouchableOpacity>
            </View>
          </View>

          {loading && !refreshing ? (
            <View style={styles.contentContainer}>
              {/* Skeleton Metric Cards */}
              <View style={styles.metricsGrid}>
                {[1, 2, 3, 4].map((i) => (
                  <View key={i} style={styles.metricCard}>
                    <View style={[styles.metricIcon, { backgroundColor: colors.card }]}>
                      <ShimmerEffect width={44} height={44} borderRadius={14} />
                    </View>
                    <ShimmerEffect width={60} height={22} borderRadius={4} />
                    <ShimmerEffect width={80} height={13} borderRadius={4} />
                  </View>
                ))}
              </View>

              {/* Skeleton Adaptive Flashcards Card */}
              <View style={styles.chartCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <ShimmerEffect width={20} height={20} borderRadius={10} />
                  <View style={{ marginLeft: 10 }}>
                    <ShimmerEffect width={120} height={16} borderRadius={4} />
                  </View>
                </View>
                <View style={styles.adaptiveContainer}>
                  <ShimmerEffect width={80} height={80} borderRadius={40} />
                  <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 16 }}>
                    <ShimmerEffect width={100} height={24} borderRadius={4} />
                    <ShimmerEffect width={80} height={14} borderRadius={4} />
                  </View>
                  <View style={styles.adaptiveStatsRow}>
                    <View style={styles.adaptiveStat}>
                      <ShimmerEffect width={80} height={20} borderRadius={4} />
                      <ShimmerEffect width={60} height={12} borderRadius={4} />
                    </View>
                    <View style={styles.adaptiveDivider} />
                    <View style={styles.adaptiveStat}>
                      <ShimmerEffect width={60} height={20} borderRadius={4} />
                      <ShimmerEffect width={60} height={12} borderRadius={4} />
                    </View>
                  </View>
                  <View style={styles.rankTrack}>
                    <ShimmerEffect width={width - 80} height={6} borderRadius={3} />
                  </View>
                </View>
              </View>

              {/* Skeleton Weekly Activity Card */}
              <View style={styles.chartCard}>
                <ShimmerEffect width={120} height={16} borderRadius={4} />
                <View style={{ marginTop: 20, minHeight: 220 }}>
                  <ShimmerEffect width={width - 80} height={200} borderRadius={8} />
                </View>
              </View>

              {/* Skeleton Domain Performance Card */}
              <View style={styles.chartCard}>
                <ShimmerEffect width={150} height={16} borderRadius={4} />
                <View style={{ marginTop: 20 }}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={{ marginBottom: 16 }}>
                      <ShimmerEffect width={width - 100} height={14} borderRadius={4} />
                      <View style={{ marginTop: 8 }}>
                        <ShimmerEffect width={width - 80} height={8} borderRadius={4} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.contentContainer}>
              <View style={styles.metricsGrid}>
                {/* Metric Cards - Same as before */}
                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: colors.primaryMuted }]}>
                    <Calendar size={24} color={colors.primary} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.streak || 0}</Text>
                  <Text style={styles.metricLabel}>Day Streak</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Target size={24} color="#10B981" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.accuracy ?? 0}%</Text>
                  <Text style={styles.metricLabel}>Accuracy</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <BarChart size={24} color={colors.secondary} strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.totalQuestions || 0}</Text>
                  <Text style={styles.metricLabel}>Questions</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <Clock size={24} color="#8B5CF6" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.metricValue}>{stats?.studyTime || '0m'}</Text>
                  <Text style={styles.metricLabel}>Study Time</Text>
                </View>
              </View>
              {/* === NEW: Adaptive Flashcards Stats === */}
              <View style={styles.chartCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Zap size={20} color="#F59E0B" style={{ marginRight: 10 }} />
                    <Text style={styles.cardTitleNoMargin}>Adaptive Flashcards</Text>
                  </View>
                  <TouchableOpacity onPress={handleAdaptiveReset} style={{ padding: 4 }}>
                    <Trash2 size={16} color="#EF4444" opacity={0.7} />
                  </TouchableOpacity>
                </View>

                <View style={styles.adaptiveContainer}>
                  {/* Rank Badge */}
                  <View style={styles.rankBadge}>
                    <Crown size={32} color="#F59E0B" fill="#F59E0B" />
                  </View>

                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.rankTitle}>{adaptiveRank}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.rankSubtitle}>Level {adaptiveLevel}</Text>
                      {isMaxLevel(adaptiveLevel) && (
                        <View style={{ backgroundColor: colors.primaryMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: colors.primary }}>
                          <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>MAX</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Stats Row */}
                  <View style={styles.adaptiveStatsRow}>
                    <View style={styles.adaptiveStat}>
                      <Text style={styles.adaptiveStatEffect}>{adaptiveSwiped} <Text style={{ fontSize: 16, color: colors.subText }}>/ {stats?.totalAdaptiveQuestions || '?'}</Text></Text>
                      <Text style={styles.adaptiveStatLabel}>Cards Reviewed</Text>
                    </View>
                    <View style={styles.adaptiveDivider} />
                    <View style={styles.adaptiveStat}>
                      <Text style={styles.adaptiveStatEffect}>{adaptiveProgress.toFixed(1)}%</Text>
                      <Text style={styles.adaptiveStatLabel}>Rank Progress</Text>
                    </View>
                  </View>

                  {/* Visual Progress Bar to Next Level */}
                  <View style={styles.rankTrack}>
                    <View style={[styles.rankFill, { width: `${adaptiveProgress}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
              </View>

              {/* Weekly Chart - Modern Line Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Weekly Activity</Text>
                <View style={{ minHeight: 220, justifyContent: 'center' }}>
                  {stats?.weeklyProgress ? (
                    <InteractiveLineChart
                      data={stats.weeklyProgress}
                      labels={stats.weeklyLabels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                      fullDates={stats.weeklyFullDates || ['', '', '', '', '', '', '']}
                      colors={colors}
                    />
                  ) : (
                    <Text style={{ color: colors.subText, textAlign: 'center' }}>No activity data available.</Text>
                  )}
                </View>
              </View>



              {/* Domain Performance - Same as before */}
              <View style={styles.chartCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitleNoMargin}>Domain Performance</Text>
                  <View style={styles.filterContainer}>
                    {(['weakest', 'strongest', 'all'] as const).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        onPress={() => {
                          setTopicFilter(filter);
                          setShowAllTopics(false);
                        }}
                        style={[
                          styles.filterTab,
                          topicFilter === filter && styles.filterTabActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterTabText,
                            topicFilter === filter && styles.filterTabTextActive,
                          ]}
                        >
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.subjectsContainer}>
                  {(() => {
                    const allTopics = [...(stats?.subjectScores || [])];
                    if (topicFilter === 'weakest') {
                      allTopics.sort((a: any, b: any) => a.score - b.score);
                    } else if (topicFilter === 'strongest') {
                      allTopics.sort((a: any, b: any) => b.score - a.score);
                    } else {
                      allTopics.sort((a: any, b: any) => a.name.localeCompare(b.name));
                    }

                    const displayedTopics = showAllTopics ? allTopics : allTopics.slice(0, 3);

                    if (allTopics.length === 0) {
                      return <Text style={{ color: '#94A3B8', textAlign: 'center', padding: 20 }}>No topics available.</Text>;
                    }

                    return (
                      <>
                        {displayedTopics.map((subject: any, index: number) => (
                          <View key={index} style={styles.subjectRow}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={styles.subjectName}>{subject.name}</Text>
                              <Text style={[styles.subjectScore, { color: subjectColor(subject.score) }]}>{subject.score}%</Text>
                            </View>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  {
                                    width: `${subject.score}%`,
                                    backgroundColor: subjectColor(subject.score),
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        ))}

                        {allTopics.length > 3 && (
                          <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => setShowAllTopics(!showAllTopics)}
                          >
                            <Text style={styles.showMoreText}>
                              {showAllTopics ? 'Show Less' : `Show All (${allTopics.length})`}
                            </Text>
                            {showAllTopics ? (
                              <ChevronUp size={16} color="#64748B" />
                            ) : (
                              <ChevronDown size={16} color="#64748B" />
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.subText,
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitleNoMargin: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 4,
    gap: 0,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: colors.inputBg,
  },
  filterTabText: {
    fontSize: 12,
    color: colors.subText,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  showMoreText: {
    fontSize: 13,
    color: colors.subText,
    fontWeight: '600',
  },
  chartContainer: {
    height: 180,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
  },
  chartColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    gap: 8,
  },
  chartBarWrapper: {
    flex: 1,
    width: 12,
    justifyContent: 'flex-end',
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: 6,
  },
  chartLabel: {
    fontSize: 11,
    color: colors.subText,
    textAlign: 'center',
    width: '100%',
  },
  subjectsContainer: {
    gap: 16,
  },
  subjectRow: {
    gap: 4,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 12,
    flexWrap: 'wrap',
    lineHeight: 20,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  subjectScore: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  // Adaptive Styles
  adaptiveContainer: {
    alignItems: 'center',
    paddingTop: 10
  },
  rankBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)'
  },
  rankTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F59E0B',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  rankSubtitle: {
    fontSize: 14,
    color: colors.subText,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  adaptiveStatsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 20
  },
  adaptiveStat: {
    alignItems: 'center'
  },
  adaptiveStatEffect: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4
  },
  adaptiveStatLabel: {
    fontSize: 12,
    color: colors.subText
  },
  adaptiveDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border
  },
  rankTrack: {
    width: '100%',
    height: 6,
    backgroundColor: colors.background, // Contrast against card
    borderRadius: 3,
    overflow: 'hidden'
  },
  rankFill: {
    height: '100%',
  }
});