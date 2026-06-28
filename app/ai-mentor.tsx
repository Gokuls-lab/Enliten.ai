import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Modal,
  Image,
  Linking,
  Animated as RNAnimated,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
  Rect,
  Text as SvgText,
  G,
  Line
} from 'react-native-svg';
import {
  Menu,
  ChevronDown,
  SquarePen,
  Plus,
  Mic,
  Send,
  X,
  Sparkles,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Trash2,
  CornerDownRight,
  BarChart2,
  LineChart as LucideLineChart,
  PieChart as LucidePieChart,
  TrendingUp,
  Camera,
  ImageIcon,
  FileUp,
  FileText,
  Loader2,
  Globe
} from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  FadeIn,
  FadeOut,
  Easing
} from 'react-native-reanimated';
import { useTheme, ThemeColors } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { supabase } from '@/lib/supabase';
import { updateProgress } from '@/lib/progress';
import Markdown from 'react-native-markdown-display';
import { API_BASE_URL } from '@/lib/api';

const { width, height } = Dimensions.get('window');

// Custom Futuristic Enliten AI Core Icon Component
const EnlitenCoreIcon = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <Defs>
      <SvgLinearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#38BDF8" />
        <Stop offset="50%" stopColor="#818CF8" />
        <Stop offset="100%" stopColor="#EC4899" />
      </SvgLinearGradient>
      <SvgLinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#818CF8" stopOpacity={0.8} />
        <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0.2} />
      </SvgLinearGradient>
    </Defs>
    <Path
      d="M32 8C45.2548 8 56 18.7452 56 32C56 45.2548 45.2548 56 32 56C18.7452 56 8 45.2548 8 32C8 18.7452 18.7452 8 32 8Z"
      stroke="url(#ringGrad)"
      strokeWidth={1.5}
      strokeDasharray="4 4"
      opacity={0.5}
    />
    <Path
      d="M32 14C41.9411 14 50 22.0589 50 32C50 41.9411 41.9411 50 32 50C22.0589 50 14 41.9411 14 32C14 22.0589 22.0589 14 32 14Z"
      stroke="url(#coreGrad)"
      strokeWidth={2}
      transform="rotate(45 32 32)"
      opacity={0.85}
    />
    <Path
      d="M32 14C41.9411 14 50 22.0589 50 32C50 41.9411 41.9411 50 32 50C22.0589 50 14 41.9411 14 32C14 22.0589 22.0589 14 32 14Z"
      stroke="url(#coreGrad)"
      strokeWidth={2}
      transform="rotate(-45 32 32)"
      opacity={0.85}
    />
    <Path
      d="M32 23C36.9706 23 41 27.0294 41 32C41 36.9706 36.9706 41 32 41C27.0294 41 23 36.9706 23 32C23 27.0294 27.0294 23 32 23Z"
      fill="url(#coreGrad)"
    />
    <Path
      d="M32 27C32 29.7614 34.2386 32 37 32C34.2386 32 32 34.2386 32 37C32 34.2386 29.7614 32 27 32C29.7614 32 32 29.7614 32 27Z"
      fill="#FFFFFF"
    />
  </Svg>
);

// ────────────────────────────────────────────────────────────────────────────
// CLAUDE-LIKE LOADING WAVE (8-point asterisk spinner)
// ────────────────────────────────────────────────────────────────────────────
const STREAMING_PHRASES = [
  // --- Quick / One-Word Vibe ---
  'Thinking...',
  'Reviewing...',
  'Analyzing...',
  'Solving...',
  'Simplifying...',
  'Preparing...',
  'Drafting...',
  'Brainstorming...',
  'Synthesizing...',
  'Decoding...',

  // --- Deep Learning & Tutoring Action ---
  'Analyzing the question...',
  'Reviewing the lesson...',
  'Breaking it down...',
  'Connecting the dots...',
  'Formulating the explanation...',
  'Simplifying the concept...',
  'Checking the study guide...',
  'Finding perfect examples...',
  'Structuring the steps...',
  'Mapping the concepts...',

  // --- Creator & Studio Mindset ---
  'Planning the breakdown...',
  'Building the response...',
  'Orchestrating the details...',
  'Refining the logic...',
  'Crafting the answer...',
  'Polishing the takeaway...'
];

export const ClaudeLoadingWave = ({ size = 24, color = '#8B5CF6' }: { size?: number; color?: string }) => {
  const rotation = useSharedValue(0);
  const scaleVal = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1500, easing: Easing.linear }), -1, false);
    scaleVal.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 750, easing: Easing.ease }),
        withTiming(1, { duration: 750, easing: Easing.ease }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scaleVal.value },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2v4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 18v4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M4.93 4.93l2.83 2.83" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16.24 16.24l2.83 2.83" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M2 12h4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 12h4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M4.93 19.07l2.83-2.83" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M16.24 7.76l2.83-2.83" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
};

export function AnimatedStreamingText({ color = '#8B5CF6' }: { color?: string }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const wordInterval = setInterval(() => {
      RNAnimated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => {
          let next;
          do {
            next = Math.floor(Math.random() * STREAMING_PHRASES.length);
          } while (next === prev);
          return next;
        });
        RNAnimated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => clearInterval(wordInterval);
  }, []);

  return (
    <RNAnimated.Text
      style={[
        { color, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
        { opacity: fadeAnim },
      ]}
    >
      {STREAMING_PHRASES[index]}
    </RNAnimated.Text>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SOURCE FAVICON COMPONENT (Claude-style)
// ────────────────────────────────────────────────────────────────────────────
const SourceFavicon = ({ uri, title, size = 24 }: { uri: string; title?: string; size?: number }) => {
  const [failed, setFailed] = React.useState(false);
  let faviconUrl = '';
  let fallbackLetter = '?';
  try {
    const hostname = new URL(uri).hostname.replace('www.', '');
    faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    fallbackLetter = (title || hostname).charAt(0).toUpperCase();
  } catch (e) {
    fallbackLetter = (title || '?').charAt(0).toUpperCase();
  }

  if (failed || !faviconUrl) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#38383D',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#CCC', fontSize: size * 0.5, fontWeight: '700' }}>{fallbackLetter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: faviconUrl }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#38383D' }}
      onError={() => setFailed(true)}
    />
  );
};

// Custom Markdown Image component to render images correctly and allow fullscreen preview
const MarkdownImage = ({ src, alt }: { src: string; alt?: string }) => {
  const { colors, isDark } = useTheme();
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // Attempt to dynamically fetch original image dimensions
    Image.getSize(
      src,
      (w, h) => {
        if (w && h) {
          setAspectRatio(w / h);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Failed to get size for markdown image:', src, err);
        setLoading(false);
      }
    );
  }, [src]);

  return (
    <View style={{ marginVertical: 8, width: '100%' }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (!error) {
            setModalVisible(true);
          }
        }}
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: isDark ? '#1E2022' : '#F3F4F6',
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: loading ? 160 : undefined,
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {loading && (
          <View style={{ position: 'absolute', zIndex: 1 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {src ? (
          <Image
            source={{ uri: src }}
            style={{
              width: '100%',
              aspectRatio: aspectRatio || 16 / 9,
            }}
            resizeMode="cover"
            onError={() => {
              setError(true);
              setLoading(false);
            }}
            onLoadEnd={() => setLoading(false)}
          />
        ) : null}

        {error && (
          <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.subText, fontSize: 13 }}>Failed to load image</Text>
          </View>
        )}

        {alt && !error && !loading && (
          <View style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            paddingVertical: 6,
            paddingHorizontal: 12,
          }}>
            <Text style={{ color: '#FFF', fontSize: 11, textAlign: 'center' }} numberOfLines={1}>
              {alt}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Full screen modal for viewing the image */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 10,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setModalVisible(false)}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>

          {Platform.OS === 'ios' ? (
            <ScrollView
              maximumZoomScale={3}
              minimumZoomScale={1}
              contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: width }}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri: src }}
                style={{
                  width: width,
                  height: height * 0.8,
                }}
                resizeMode="contain"
              />
            </ScrollView>
          ) : (
            <Image
              source={{ uri: src }}
              style={{
                width: width,
                height: height * 0.8,
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

// Markdown rules to override default image renderer with custom MarkdownImage component
const markdownRules = {
  image: (node: any) => {
    const src = node.attributes?.src;
    const alt = node.attributes?.alt;
    return <MarkdownImage key={node.key} src={src} alt={alt} />;
  },
};

// MOCK_HISTORY removed, using dynamic database threads now

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizData {
  title: string;
  questions: QuizQuestion[];
}

interface ChartItem {
  label: string;
  value: number;
  color?: string;
}

interface ChartData {
  title: string;
  type?: 'bar' | 'line' | 'pie' | 'donut' | 'progress' | 'radial';
  yAxisSuffix?: string;
  data: ChartItem[];
}

// ────────────────────────────────────────────────────────────────────────────
// GENERATIVE INTERACTIVE QUIZ CARD
// ────────────────────────────────────────────────────────────────────────────
interface GenerativeQuizCardProps {
  data: QuizData;
  messageIndex: number;
  colors: ThemeColors;
  isDark: boolean;
  styles: any;
  quizSubmissions: Record<number, { selectedAnswers: Record<number, number>; submitted: boolean }>;
  setQuizSubmissions: React.Dispatch<React.SetStateAction<Record<number, { selectedAnswers: Record<number, number>; submitted: boolean }>>>;
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<Array<{ sender: 'user' | 'ai'; text: string }>>>;
  user?: any;
  convoId?: string | null;
  examId?: string | null;
}

const GenerativeQuizCard = ({
  data,
  messageIndex,
  colors,
  isDark,
  styles,
  quizSubmissions,
  setQuizSubmissions,
  setIsTyping,
  setMessages,
  user,
  convoId,
  examId
}: GenerativeQuizCardProps) => {
  const submission = quizSubmissions[messageIndex] || { selectedAnswers: {}, submitted: false };
  const { selectedAnswers, submitted } = submission;

  const handleSelectOption = (questionIdx: number, optionIdx: number) => {
    if (submitted) return;
    const updatedAnswers = { ...selectedAnswers, [questionIdx]: optionIdx };
    setQuizSubmissions(prev => ({
      ...prev,
      [messageIndex]: { ...submission, selectedAnswers: updatedAnswers }
    }));
  };

  const saveQuizToDB = async (score: number) => {
    if (!user) return;
    try {
      const aiQuestions = data.questions.map(q => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      }));
      const aiAnswers = Object.entries(selectedAnswers).map(([qIdx, optIdx]) => ({
        questionIndex: parseInt(qIdx),
        selectedOptionIndex: optIdx as number,
        isCorrect: (optIdx as number) === data.questions[parseInt(qIdx)].correctIndex,
      }));

      // Compute quiz_order: count existing AI quiz sessions for this thread
      let quizOrder = 0;
      if (convoId) {
        const { data: existingSessions } = await supabase
          .from('quiz_sessions')
          .select('id')
          .eq('chat_session_id', convoId)
          .eq('quiz_type', 'ai-mentor');
        quizOrder = existingSessions?.length || 0;
      }

      const { error: insertError } = await supabase.from('quiz_sessions').insert({
        user_id: user.id,
        quiz_type: 'ai-mentor',
        score,
        total_questions: data.questions.length,
        time_taken_seconds: null,
        completed_at: new Date().toISOString(),
        ai_questions: aiQuestions,
        ai_answers: aiAnswers,
        chat_session_id: convoId || null,
        quiz_order: quizOrder,
        exam_id: examId || null,
      });

      if (insertError) {
        console.error('Error saving AI quiz to DB:', insertError);
        return;
      }

      // Update user progress like regular quiz modes
      await updateProgress(user.id, {
        questionsAnswered: data.questions.length,
        correctAnswers: score,
        timeTaken: 0,
      });
    } catch (err) {
      console.error('Error saving AI quiz to DB:', err);
    }
  };

  const handleSubmit = () => {
    if (submitted) return;

    const unanswered = data.questions.some((_, idx) => selectedAnswers[idx] === undefined);
    if (unanswered) {
      Alert.alert('Quiz Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    setQuizSubmissions(prev => ({
      ...prev,
      [messageIndex]: { ...submission, submitted: true }
    }));

    // Calculate score and save to DB
    let correctCount = 0;
    data.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correctCount++;
      }
    });
    saveQuizToDB(correctCount);

    setIsTyping(true);
    setTimeout(() => {
      const percent = Math.round((correctCount / data.questions.length) * 100);

      let feedback = '';
      if (percent === 100) {
        feedback = `### 🎉 Outstanding performance!\n\nYou achieved a perfect score of **${correctCount}/${data.questions.length}** (100%) on the **${data.title}**. Excellent understanding of the principles!`;
      } else {
        feedback = `### 📚 Evaluated Score: ${correctCount}/${data.questions.length} (${percent}%)\n\nHere is your learning summary feedback based on the quiz performance:\n\n` +
          data.questions.map((q, idx) => {
            const isCorrect = selectedAnswers[idx] === q.correctIndex;
            return `- **Question ${idx + 1}**: ${isCorrect ? '✅ Correct' : '❌ Incorrect'} - *${q.explanation}*`;
          }).join('\n');
      }

      setMessages(prev => [...prev, { sender: 'ai', text: feedback }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <View style={styles.quizCard}>
      <View style={styles.quizHeader}>
        <Sparkles size={18} color={colors.primary} style={{ marginRight: 8 }} />
        <Text style={styles.quizTitle}>{data.title}</Text>
      </View>

      {data.questions.map((q, qIdx) => {
        const selectedOpt = selectedAnswers[qIdx];
        return (
          <View key={q.id} style={styles.quizQuestionBlock}>
            <Text style={styles.quizQuestionText}>
              {qIdx + 1}. {q.question}
            </Text>

            {q.options.map((opt, oIdx) => {
              const isSelected = selectedOpt === oIdx;
              const isCorrect = q.correctIndex === oIdx;

              let optionStyle = [styles.quizOptionRow];
              let textStyle = [styles.quizOptionText];
              let checkIconColor = colors.subText;

              if (submitted) {
                if (isCorrect) {
                  optionStyle.push(styles.quizOptionCorrect);
                  textStyle.push({ color: isDark ? '#34D399' : '#059669' });
                  checkIconColor = isDark ? '#34D399' : '#059669';
                } else if (isSelected) {
                  optionStyle.push(styles.quizOptionIncorrect);
                  textStyle.push({ color: isDark ? '#F87171' : '#DC2626' });
                  checkIconColor = isDark ? '#F87171' : '#DC2626';
                }
              } else if (isSelected) {
                optionStyle.push(styles.quizOptionSelected);
                textStyle.push({ color: colors.primary });
                checkIconColor = colors.primary;
              }

              return (
                <TouchableOpacity
                  key={oIdx}
                  style={optionStyle}
                  onPress={() => handleSelectOption(qIdx, oIdx)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.quizRadioCircle, { borderColor: checkIconColor }]}>
                    {isSelected && <View style={[styles.quizRadioCircleInner, { backgroundColor: checkIconColor }]} />}
                  </View>
                  <Text style={textStyle}>{opt}</Text>
                </TouchableOpacity>
              );
            })}

            {submitted && (
              <View style={styles.quizExplanationCard}>
                <Text style={styles.quizExplanationTitle}>Key Explanation:</Text>
                <Text style={styles.quizExplanationText}>{q.explanation}</Text>
              </View>
            )}
          </View>
        );
      })}

      {!submitted ? (
        <TouchableOpacity style={styles.quizSubmitBtn} onPress={handleSubmit} activeOpacity={0.8}>
          <Text style={styles.quizSubmitBtnText}>Submit Quiz</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.quizResultHeader}>
          <Text style={styles.quizResultScore}>
            Score: {data.questions.reduce((acc, q, idx) => acc + (selectedAnswers[idx] === q.correctIndex ? 1 : 0), 0)}/{data.questions.length}
          </Text>
          <Text style={styles.quizResultSub}>Evaluation Complete</Text>
        </View>
      )}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// GENERATIVE CHART/GRAPH CARD (Real Component)
// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// HELPERS FOR CUSTOM SVG CHART RENDERING
// ────────────────────────────────────────────────────────────────────────────
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ");
};

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

const CHART_GRADIENTS = [
  { start: '#38BDF8', end: '#818CF8' }, // Sky to Violet
  { start: '#EC4899', end: '#F43F5E' }, // Pink to Rose
  { start: '#34D399', end: '#059669' }, // Emerald to Teal
  { start: '#F59E0B', end: '#EF4444' }, // Amber to Red
  { start: '#A78BFA', end: '#7C3AED' }, // Purple to Indigo
];

const PIE_COLORS = [
  '#38BDF8', // Sky Blue
  '#F43F5E', // Rose/Pink
  '#10B981', // Emerald Green
  '#F59E0B', // Amber Yellow
  '#8B5CF6', // Purple
  '#EC4899', // Dark Pink
  '#3B82F6', // Blue
];

interface GenerativeChartCardProps {
  data: ChartData;
  colors: ThemeColors;
  isDark: boolean;
  styles: any;
}

const GenerativeChartCard = ({ data, colors, isDark, styles }: GenerativeChartCardProps) => {
  if (!data || !data.data || data.data.length === 0) {
    return (
      <View style={[styles.chartCard, {
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      }]}>
        <Text style={styles.chartTitle}>{data?.title || 'Chart'}</Text>
        <Text style={{ color: colors.subText, fontSize: 13, textAlign: 'center', marginVertical: 20 }}>
          No data available
        </Text>
      </View>
    );
  }

  const chartType = data.type || 'bar';
  const containerWidth = (width * 0.85) - 64; // Rigorous width calculation: Bubble 85% width - bubble padding (32) - card padding (32)
  const chartHeight = 220;

  // Header Icon based on Chart Type
  const renderHeaderIcon = () => {
    const iconSize = 18;
    const iconColor = colors.primary;
    const iconStyle = { marginRight: 8, marginTop: 1 };
    switch (chartType) {
      case 'line':
        return <LucideLineChart size={iconSize} color={iconColor} style={iconStyle} />;
      case 'pie':
      case 'donut':
        return <LucidePieChart size={iconSize} color={iconColor} style={iconStyle} />;
      case 'progress':
      case 'radial':
        return <TrendingUp size={iconSize} color={iconColor} style={iconStyle} />;
      default:
        return <BarChart2 size={iconSize} color={iconColor} style={iconStyle} />;
    }
  };

  // 1. BAR CHART RENDERER
  const renderBarChart = () => {
    const paddingLeft = 55;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 40;

    const graphWidth = containerWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;

    const maxValue = Math.max(...data.data.map(item => item.value), 10);
    const gridLines = [0, 0.25, 0.5, 0.75, 1];

    const barCount = data.data.length;
    const totalBarSpacingRatio = 0.4;
    const unitWidth = graphWidth / barCount;
    const barWidth = unitWidth * (1 - totalBarSpacingRatio);
    const barSpacing = unitWidth * totalBarSpacingRatio;

    return (
      <Svg width={containerWidth} height={chartHeight}>
        <Defs>
          {data.data.map((_, idx) => {
            const grad = CHART_GRADIENTS[idx % CHART_GRADIENTS.length];
            return (
              <SvgLinearGradient key={idx} id={`barGrad-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor={grad.start} />
                <Stop offset="100%" stopColor={grad.end} />
              </SvgLinearGradient>
            );
          })}
        </Defs>

        {/* Grid lines */}
        {gridLines.map((val, idx) => {
          const yGrid = paddingTop + graphHeight - (val * graphHeight);
          const gridVal = Math.round(val * maxValue);
          return (
            <G key={idx}>
              <Line
                x1={paddingLeft}
                y1={yGrid}
                x2={paddingLeft + graphWidth}
                y2={yGrid}
                stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                strokeWidth={1}
                strokeDasharray={val === 0 ? undefined : "4 4"}
              />
              <SvgText
                x={paddingLeft - 8}
                y={yGrid + 4}
                fill={colors.subText}
                fontSize={10}
                fontWeight="600"
                textAnchor="end"
              >
                {`${gridVal}${data.yAxisSuffix || ''}`}
              </SvgText>
            </G>
          );
        })}

        {/* Bars */}
        {data.data.map((item, idx) => {
          const x = paddingLeft + (idx * unitWidth) + (barSpacing / 2);
          const yVal = (item.value / maxValue) * graphHeight;
          const y = paddingTop + graphHeight - yVal;
          const cleanLabel = item.label.length > 10 ? item.label.slice(0, 8) + '..' : item.label;

          return (
            <G key={idx}>
              {/* Rounded Bar Capsule */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(yVal, 4)}
                rx={Math.min(barWidth / 2, 8)}
                fill={item.color || `url(#barGrad-${idx})`}
              />
              {/* Value Indicator */}
              <SvgText
                x={x + barWidth / 2}
                y={y - 6}
                fill={colors.text}
                fontSize={10}
                fontWeight="700"
                textAnchor="middle"
              >
                {item.value}
              </SvgText>
              {/* Label */}
              <SvgText
                x={x + barWidth / 2}
                y={paddingTop + graphHeight + 18}
                fill={colors.subText}
                fontSize={10}
                fontWeight="600"
                textAnchor="middle"
              >
                {cleanLabel}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    );
  };

  // 2. LINE CHART RENDERER
  const renderLineChart = () => {
    const paddingLeft = 55;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 40;

    const graphWidth = containerWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;

    const maxValue = Math.max(...data.data.map(item => item.value), 10);
    const gridLines = [0, 0.25, 0.5, 0.75, 1];

    const unitWidth = graphWidth / (data.data.length - 1 || 1);
    const points = data.data.map((item, idx) => {
      const x = paddingLeft + (idx * unitWidth);
      const yVal = (item.value / maxValue) * graphHeight;
      const y = paddingTop + graphHeight - yVal;
      return { x, y, value: item.value, label: item.label };
    });

    const linePath = getBezierPath(points);
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + graphHeight} L ${points[0].x} ${paddingTop + graphHeight} Z`
      : '';

    return (
      <Svg width={containerWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="lineAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
          </SvgLinearGradient>
          <SvgLinearGradient id="lineStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#38BDF8" />
            <Stop offset="50%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#EC4899" />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {gridLines.map((val, idx) => {
          const yGrid = paddingTop + graphHeight - (val * graphHeight);
          const gridVal = Math.round(val * maxValue);
          return (
            <G key={idx}>
              <Line
                x1={paddingLeft}
                y1={yGrid}
                x2={paddingLeft + graphWidth}
                y2={yGrid}
                stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                strokeWidth={1}
                strokeDasharray={val === 0 ? undefined : "4 4"}
              />
              <SvgText
                x={paddingLeft - 8}
                y={yGrid + 4}
                fill={colors.subText}
                fontSize={10}
                fontWeight="600"
                textAnchor="end"
              >
                {`${gridVal}${data.yAxisSuffix || ''}`}
              </SvgText>
            </G>
          );
        })}

        {/* Area fill */}
        {areaPath ? <Path d={areaPath} fill="url(#lineAreaGrad)" /> : null}

        {/* Line stroke */}
        {linePath ? (
          <Path
            d={linePath}
            fill="none"
            stroke="url(#lineStrokeGrad)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}

        {/* Data points */}
        {points.map((point, idx) => (
          <G key={idx}>
            <Circle cx={point.x} cy={point.y} r={6} fill={colors.primary} opacity={0.25} />
            <Circle
              cx={point.x}
              cy={point.y}
              r={3.5}
              fill={isDark ? '#111115' : '#FFFFFF'}
              stroke={colors.primary}
              strokeWidth={2}
            />
            {/* Value Indicator */}
            <SvgText
              x={point.x}
              y={point.y - 10}
              fill={colors.text}
              fontSize={10}
              fontWeight="700"
              textAnchor="middle"
            >
              {point.value}
            </SvgText>
            {/* Label */}
            <SvgText
              x={point.x}
              y={paddingTop + graphHeight + 18}
              fill={colors.subText}
              fontSize={10}
              fontWeight="600"
              textAnchor="middle"
            >
              {point.label.length > 8 ? point.label.slice(0, 6) + '..' : point.label}
            </SvgText>
          </G>
        ))}
      </Svg>
    );
  };

  // 3. PIE/DONUT CHART RENDERER
  const renderDonutChart = () => {
    const chartSvgWidth = containerWidth * 0.45;
    const chartHeightVal = 160;
    const centerX = chartSvgWidth / 2;
    const centerY = chartHeightVal / 2;
    const radius = 45;
    const strokeWidth = 12;

    const total = data.data.reduce((acc, d) => acc + d.value, 0) || 1;

    let currentAngle = 0;
    const segments = data.data.map((item, idx) => {
      const angle = (item.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      return {
        ...item,
        startAngle,
        endAngle,
        percent: Math.round((item.value / total) * 100),
        color: item.color || PIE_COLORS[idx % PIE_COLORS.length],
      };
    });

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Svg width={chartSvgWidth} height={chartHeightVal}>
          {segments.map((segment, idx) => {
            const angle = segment.endAngle - segment.startAngle;
            if (angle >= 360) {
              return (
                <Circle
                  key={idx}
                  cx={centerX}
                  cy={centerY}
                  r={radius}
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
              );
            }
            const gap = angle > 4 ? 2.5 : 0;
            const d = describeArc(centerX, centerY, radius, segment.startAngle, segment.endAngle - gap);
            return (
              <Path
                key={idx}
                d={d}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            );
          })}

          <SvgText
            x={centerX}
            y={centerY - 4}
            fill={colors.subText}
            fontSize={10}
            fontWeight="600"
            textAnchor="middle"
          >
            Total
          </SvgText>
          <SvgText
            x={centerX}
            y={centerY + 12}
            fill={colors.text}
            fontSize={15}
            fontWeight="800"
            textAnchor="middle"
          >
            {total}
          </SvgText>
        </Svg>

        {/* Legend */}
        <View style={{ flex: 1, paddingLeft: 8 }}>
          {segments.slice(0, 5).map((segment, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 3.5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: segment.color, marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                  {segment.label}
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.subText, marginLeft: 4 }}>
                {segment.value} ({segment.percent}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // 4. PROGRESS/RADIAL RINGS RENDERER
  const renderProgressRingChart = () => {
    const chartHeightVal = 160;

    if (data.data.length === 1) {
      // Single Ring
      const chartSvgWidth = containerWidth;
      const centerX = chartSvgWidth / 2;
      const centerY = chartHeightVal / 2;
      const radius = 50;
      const strokeWidth = 10;
      const val = data.data[0].value;
      const percent = Math.min(Math.max(val, 0), 100);
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (percent / 100) * circumference;

      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={chartSvgWidth} height={chartHeightVal}>
            <Defs>
              <SvgLinearGradient id="singleProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={data.data[0].color || '#38BDF8'} />
                <Stop offset="100%" stopColor={colors.primary} />
              </SvgLinearGradient>
            </Defs>
            <Circle
              cx={centerX}
              cy={centerY}
              r={radius}
              stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={centerX}
              cy={centerY}
              r={radius}
              stroke="url(#singleProgressGrad)"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(-90 ${centerX} ${centerY})`}
            />
            <SvgText
              x={centerX}
              y={centerY + 6}
              fill={colors.text}
              fontSize={20}
              fontWeight="800"
              textAnchor="middle"
            >
              {percent}%
            </SvgText>
          </Svg>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: -15, textAlign: 'center' }}>
            {data.data[0].label}
          </Text>
        </View>
      );
    } else {
      // Concentric Rings
      const chartSvgWidth = containerWidth * 0.45;
      const centerX = chartSvgWidth / 2;
      const centerY = chartHeightVal / 2;
      const strokeWidth = 8;
      const rings = data.data.slice(0, 3).map((item, idx) => {
        const radius = 50 - (idx * 13);
        const percent = Math.min(Math.max(item.value, 0), 100);
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percent / 100) * circumference;
        const grad = CHART_GRADIENTS[idx % CHART_GRADIENTS.length];
        return {
          ...item,
          radius,
          percent,
          circumference,
          strokeDashoffset,
          color: item.color || grad.start,
          endColor: grad.end,
        };
      });

      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Svg width={chartSvgWidth} height={chartHeightVal}>
            <Defs>
              {rings.map((ring, idx) => (
                <SvgLinearGradient key={idx} id={`ringGrad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={ring.color} />
                  <Stop offset="100%" stopColor={ring.endColor} />
                </SvgLinearGradient>
              ))}
            </Defs>
            {rings.map((ring, idx) => (
              <G key={idx}>
                <Circle
                  cx={centerX}
                  cy={centerY}
                  r={ring.radius}
                  stroke={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                <Circle
                  cx={centerX}
                  cy={centerY}
                  r={ring.radius}
                  stroke={`url(#ringGrad-${idx})`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${ring.circumference} ${ring.circumference}`}
                  strokeDashoffset={ring.strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                  transform={`rotate(-90 ${centerX} ${centerY})`}
                />
              </G>
            ))}
          </Svg>

          {/* Legend */}
          <View style={{ flex: 1, paddingLeft: 8 }}>
            {rings.map((ring, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ring.color, marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {ring.label}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: '600', color: colors.subText, marginLeft: 4 }}>
                  {ring.percent}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
    }
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return renderLineChart();
      case 'pie':
      case 'donut':
        return renderDonutChart();
      case 'progress':
      case 'radial':
        return renderProgressRingChart();
      default:
        return renderBarChart();
    }
  };

  return (
    <View style={[
      styles.chartCard,
      {
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.35 : 0.05,
        shadowRadius: 12,
        elevation: 2,
      }
    ]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        {renderHeaderIcon()}
        <View style={{ flex: 1 }}>
          <Text style={[styles.chartTitle, { marginBottom: 0, flexWrap: 'wrap' }]}>
            {data.title}
          </Text>
        </View>
      </View>
      {renderChart()}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// GENERATIVE TIMELINE CARD
// ────────────────────────────────────────────────────────────────────────────
interface TimelineStep {
  id: number;
  title: string;
  description: string;
}

interface TimelineData {
  title: string;
  steps: TimelineStep[];
}

interface GenerativeTimelineCardProps {
  data: TimelineData;
  colors: ThemeColors;
  isDark: boolean;
  styles: any;
}

const GenerativeTimelineCard = ({ data, colors, isDark, styles }: GenerativeTimelineCardProps) => {
  return (
    <View style={styles.timelineCard}>
      {data.title && <Text style={styles.timelineTitle}>{data.title}</Text>}
      {data.steps.map((step, index) => {
        const isLast = index === data.steps.length - 1;
        return (
          <View key={step.id} style={styles.timelineRow}>
            <View style={styles.timelineLeft}>
              <View style={styles.timelineCircle}>
                <Text style={styles.timelineCircleText}>{index + 1}</Text>
              </View>
              {!isLast && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineRight}>
              <Text style={styles.timelineStepTitle}>{step.title}</Text>
              <Text style={styles.timelineStepDesc}>{step.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// MEMOIZED INPUT BAR — only re-renders when its own props change
// ────────────────────────────────────────────────────────────────────────────
const getFileIconLocal = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'ppt';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xls';
  return 'file';
};

const getFileIconColorLocal = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return '#38BDF8';
  if (mimeType === 'application/pdf') return '#EF4444';
  if (mimeType.includes('word') || mimeType.includes('document')) return '#3B82F6';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#F59E0B';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#10B981';
  return '#818CF8';
};

const formatFileSizeLocal = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

interface ChatInputBarProps {
  inputText: string;
  setInputText: (t: string) => void;
  handleSend: (msg?: string) => void;
  setShowAttachModal: (v: boolean) => void;
  hasAttachments: boolean;
  pendingAttachments: any[];
  handleRemoveAttachment: (i: number) => void;
  allUploaded: boolean;
  isUploading: boolean;
  colors: ThemeColors;
  isDark: boolean;
  insets: { bottom: number };
  androidInputRef?: React.RefObject<TextInput | null>;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (v: boolean) => void;
}

const ChatInputBar = React.memo(({
  inputText,
  setInputText,
  handleSend,
  setShowAttachModal,
  hasAttachments,
  pendingAttachments,
  handleRemoveAttachment,
  allUploaded,
  isUploading,
  colors,
  isDark,
  insets,
  androidInputRef,
  webSearchEnabled,
  setWebSearchEnabled,
}: ChatInputBarProps) => {
  return (
    <>
      {hasAttachments && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10, paddingHorizontal: 4 }} contentContainerStyle={{ gap: 10 }}>
          {pendingAttachments.map((att: any, idx: number) => (
            <View key={idx} style={{ position: 'relative' }}>
              {att.type.startsWith('image/') ? (
                <View style={{ width: 100, height: 100, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: isDark ? '#333' : '#DDD' }}>
                  <Image source={{ uri: att.uri }} style={{ width: 100, height: 100 }} resizeMode="cover" />
                  {att.status === 'uploading' && (
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
                      <ActivityIndicator size="small" color="#818CF8" />
                    </View>
                  )}
                  {att.status === 'done' && (
                    <View style={{ position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>✓</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1A1A2E' : '#F0F0FF', borderRadius: 14, padding: 10, gap: 8, borderWidth: 1, borderColor: isDark ? '#2A2A3E' : '#E0E0F0', minWidth: 160 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: getFileIconColorLocal(att.type), alignItems: 'center', justifyContent: 'center' }}>
                    {att.status === 'uploading' ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <FileText size={20} color="#FFF" />
                    )}
                  </View>
                  <View style={{ flex: 1, maxWidth: 120 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{att.name}</Text>
                    <Text style={{ color: colors.subText, fontSize: 11, marginTop: 1 }}>
                      {formatFileSizeLocal(att.size)}{att.status === 'uploading' ? ' Uploading...' : att.status === 'done' ? '' : att.status === 'error' ? ' Failed' : ''}
                    </Text>
                  </View>
                </View>
              )}
              <TouchableOpacity
                onPress={() => handleRemoveAttachment(idx)}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: isDark ? '#333' : '#999', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
              >
                <X size={12} color="#FFF" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: colors.inputBg,
        width: '100%',
        borderRadius: 28,
        paddingHorizontal: 16,
        minHeight: 56,
        maxHeight: 140,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.08,
        shadowRadius: 8,
        elevation: 5,
      }}>
        <TouchableOpacity style={{ marginRight: 12, marginBottom: 10 }} onPress={() => setShowAttachModal(true)}>
          <Plus size={22} color={colors.subText} strokeWidth={2} />
        </TouchableOpacity>
        <TextInput ref={androidInputRef} style={{ flex: 1, color: colors.text, fontSize: 16, maxHeight: 110, paddingVertical: 8, textAlignVertical: 'center' }} placeholder="Ask AI Mentor" placeholderTextColor={colors.subText} value={inputText} onChangeText={setInputText} multiline scrollEnabled />
        {(inputText.trim().length > 0 || allUploaded) ? (
          <TouchableOpacity
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: isUploading ? 0.4 : 1, marginBottom: 10 }}
            onPress={() => handleSend()}
            disabled={isUploading}
          >
            <Send size={20} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setWebSearchEnabled(!webSearchEnabled)}>
              <Globe size={20} color={webSearchEnabled ? colors.primary : colors.subText} strokeWidth={webSearchEnabled ? 2.5 : 2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Voice Input', 'Voice mode is coming soon in the next update!')}><Mic size={20} color={colors.subText} strokeWidth={2} /></TouchableOpacity>
            <TouchableOpacity style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: isDark ? '#1E2B4B' : '#EEF2FF',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
            }} onPress={() => Alert.alert('Sound Wave', 'Voice interactive session starting soon!')}>
              <View style={{ width: 2.2, height: 10, backgroundColor: isDark ? '#60A5FA' : colors.primary, borderRadius: 1 }} />
              <View style={{ width: 2.2, height: 18, backgroundColor: isDark ? '#60A5FA' : colors.primary, borderRadius: 1 }} />
              <View style={{ width: 2.2, height: 14, backgroundColor: isDark ? '#60A5FA' : colors.primary, borderRadius: 1 }} />
              <View style={{ width: 2.2, height: 8, backgroundColor: isDark ? '#60A5FA' : colors.primary, borderRadius: 1 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
});

// ────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────
// Helper function to parse multiple Gen UI blocks seamlessly inline
const parseMessageBlocks = (text: string) => {
  const blocks: Array<{ type: string; content?: string; data?: any }> = [];
  if (!text || typeof text !== 'string') return blocks;
  const regex = /<(QUIZ_UI|CHART_UI|TIMELINE_UI)>([\s\S]*?)<\/\1>/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const txt = text.substring(lastIdx, match.index).trim();
      if (txt) blocks.push({ type: 'text', content: txt });
    }
    try {
      const jsonStr = match[2];
      const first = jsonStr.indexOf('{');
      const last = jsonStr.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
        const data = JSON.parse(jsonStr.substring(first, last + 1));
        blocks.push({ type: match[1], data });
      }
    } catch (e) { }
    lastIdx = regex.lastIndex;
  }

  const remainingText = text.substring(lastIdx);
  const partialQuiz = remainingText.indexOf('<QUIZ_UI>');
  const partialChart = remainingText.indexOf('<CHART_UI>');
  const partialTimeline = remainingText.indexOf('<TIMELINE_UI>');

  let earliestPartial = -1;
  let partialType = '';

  if (partialQuiz !== -1) { earliestPartial = partialQuiz; partialType = 'QUIZ_UI'; }
  if (partialChart !== -1 && (earliestPartial === -1 || partialChart < earliestPartial)) { earliestPartial = partialChart; partialType = 'CHART_UI'; }
  if (partialTimeline !== -1 && (earliestPartial === -1 || partialTimeline < earliestPartial)) { earliestPartial = partialTimeline; partialType = 'TIMELINE_UI'; }

  if (earliestPartial !== -1) {
    const txt = remainingText.substring(0, earliestPartial).trim();
    if (txt) blocks.push({ type: 'text', content: txt });
    blocks.push({ type: 'partial_' + partialType });
  } else {
    const txt = remainingText.trim();
    if (txt) blocks.push({ type: 'text', content: txt });
  }

  return blocks;
};
export default function AiMentorScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { exam } = useExam();
  const scrollViewRef = useRef<ScrollView>(null);
  const androidInputRef = useRef<TextInput>(null);

  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Core State
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; sources?: any; followUpQuestions?: string[]; isStreaming?: boolean; attachments?: any[] }>>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeModel, setActiveModel] = useState('AI Mentor Pro');
  const [sourcesModalData, setSourcesModalData] = useState<any[] | null>(null);

  // Generative UI quiz submissions tracker
  const [quizSubmissions, setQuizSubmissions] = useState<Record<number, { selectedAnswers: Record<number, number>; submitted: boolean }>>({});

  const [threads, setThreads] = useState<Array<{ id: string; title: string; created_at: string }>>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingConvo, setIsLoadingConvo] = useState(false);

  // File attachment state
  interface AttachmentItem {
    uri: string;           // local file URI
    name: string;
    type: string;          // MIME type
    size: number;
    uploadedUrl?: string;  // Supabase public URL after upload
    storagePath?: string;
    status: 'pending' | 'uploading' | 'done' | 'error';
    progress: number;      // 0-100
    base64?: string;
  }
  const [pendingAttachments, setPendingAttachments] = useState<AttachmentItem[]>([]);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const isUploading = pendingAttachments.some(a => a.status === 'uploading');
  const allUploaded = pendingAttachments.length > 0 && pendingAttachments.every(a => a.status === 'done');
  const hasAttachments = pendingAttachments.length > 0;

  // ── Evaluation-to-Mentor bridge (navigated from evaluate-history) ──
  const params = useLocalSearchParams<{ evaluation_id?: string; mode?: string }>();
  const evaluationContextRef = useRef<any>(null);
  const autoSendDoneRef = useRef(false);
  const handleSendRef = useRef<any>(null);
  useEffect(() => { handleSendRef.current = handleSend; });

  const [showAutoSendOverlay, setShowAutoSendOverlay] = useState(false);
  const [cyclingTextIndex, setCyclingTextIndex] = useState(0);
  const textOpacity = useRef(new RNAnimated.Value(1)).current;
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const mcqTexts = [
    'Generating Quiz...',
    'Analyzing answer paper...',
    'Hold tight...',
    'Preparing questions...',
    'Almost there...',
  ];

  const mentorTexts = [
    'Analyzing Results...',
    'Preparing Mentor...',
    'Hold tight...',
    'Reviewing evaluation...',
    'Almost there...',
  ];

  const currentTexts = params.mode === 'mcq' ? mcqTexts : mentorTexts;

  // Cycle through loading texts with fade animation
  useEffect(() => {
    if (!showAutoSendOverlay) return;

    const interval = setInterval(() => {
      RNAnimated.timing(textOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setCyclingTextIndex((prev) => (prev + 1) % currentTexts.length);
        RNAnimated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [showAutoSendOverlay, currentTexts.length, textOpacity]);

  // Load threads on mount
  useEffect(() => {
    if (!user) return;
    setIsLoadingThreads(true);
    const fetchThreads = async () => {
      const { data } = await supabase
        .from('ai_chat_threads')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (data) setThreads(data);
      setIsLoadingThreads(false);
    };
    fetchThreads();
  }, [user, convoId]);

  // Single consolidated effect: fetch evaluation → set context → auto-send
  // This avoids race conditions between separate effects and stale closures
  useEffect(() => {
    if (!params.evaluation_id || !user || autoSendDoneRef.current) return;
    autoSendDoneRef.current = true;
    setShowAutoSendOverlay(true);

    (async () => {
      try {
        const { data } = await supabase
          .from('main_evaluations')
          .select('*')
          .eq('id', params.evaluation_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!data) {
          setShowAutoSendOverlay(false);
          return;
        }

        // Build the pre-loaded attachment (already uploaded, status = done)
        const att: AttachmentItem = {
          uri: data.file_url,
          name: data.file_name,
          type: 'application/pdf',
          size: 0,
          uploadedUrl: data.file_url,
          status: 'done' as const,
          progress: 100,
        };

        // Set attachments for UI display
        setPendingAttachments([att]);

        // Set evaluation context for BOTH mentor and mcq modes
        if (data.evaluation) {
          evaluationContextRef.current = {
            file_name: data.file_name,
            overall_score: data.awarded_marks !== null && data.total_marks !== null
              ? `${data.awarded_marks}/${data.total_marks}`
              : 'N/A',
            evaluation: data.evaluation,
          };
        }

        const autoMessage = params.mode === 'mcq'
          ? 'Generate a quiz based on the topics covered in this answer paper.'
          : "Just take a look at this evaluation result, let's continue our conversation on this.";

        // Build attachments payload directly — don't rely on state which may be stale
        const directAttachments = [{
          url: data.file_url,
          name: data.file_name,
          type: 'application/pdf',
          size: 0,
          storage_path: undefined as string | undefined,
        }];

        // Wait for next frame to ensure component is fully mounted
        setTimeout(() => {
          handleSendRef.current?.(autoMessage, directAttachments);
        }, 500);
      } catch (err) {
        console.error('[EVAL_BRIDGE] Failed to load evaluation:', err);
        autoSendDoneRef.current = false;
        setShowAutoSendOverlay(false);
      }
    })();
  }, [params.evaluation_id, user]);

  // Shared Animation Values
  const sidebarOffset = useSharedValue(-280);
  const starScale = useSharedValue(1);

  // Keyboard height tracking for Android — hybrid: React state forces native layout recalc (fixes first-open),
  // Reanimated shared value provides smooth 60fps animation on UI thread.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const keyboardHeightAnim = useSharedValue(0);
  const animatedKeyboardStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightAnim.value > 0 ? 8 : Math.max(insets.bottom, 12),
  }));
  const animatedKeyboardContainerStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeightAnim.value,
  }));
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height ?? 0;
      if (h > 0) {
        setAndroidKeyboardHeight(h);
        keyboardHeightAnim.value = h;
      }
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
      keyboardHeightAnim.value = withTiming(0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Dynamic Background Gradient based on Theme
  const bgGlowColors = isDark
    ? (['#000000', '#000000', '#892be208', '#892be215'] as const)
    : (['#FFFFFF', '#F5F7FF', '#892be210', '#892be23b'] as const);

  // Trigger Sidebar Slide
  useEffect(() => {
    sidebarOffset.value = withTiming(isSidebarOpen ? 0 : -280, { duration: 250 });
  }, [isSidebarOpen]);

  // Center Star Pulse Effect
  useEffect(() => {
    starScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500 }),
        withTiming(0.96, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  // Sidebar Style
  const animatedSidebarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: sidebarOffset.value }],
    };
  });

  // Pulse Star Style
  const animatedStarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: starScale.value }],
    };
  });

  // Actions
  // Helper: strip <think> tags from streamed text for display
  const stripThinkTags = (text: string) => {
    let clean = text.replace(/<think>[\s\S]*?<\/think>/g, '');
    // If there's an unclosed <think> tag (still thinking), hide from that point
    const openThink = clean.indexOf('<think>');
    if (openThink !== -1) clean = clean.substring(0, openThink);
    return clean.trim();
  };

  // ── FILE ATTACHMENT HANDLERS ──────────────────────────────────
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'ppt';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xls';
    return 'file';
  };

  const getFileIconColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '#38BDF8';
    if (mimeType === 'application/pdf') return '#EF4444';
    if (mimeType.includes('word') || mimeType.includes('document')) return '#3B82F6';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#F59E0B';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#10B981';
    return '#818CF8';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const uploadFileToSupabase = async (attachment: AttachmentItem, index: number) => {
    try {
      // Update status to uploading
      setPendingAttachments(prev => prev.map((a, i) => i === index ? { ...a, status: 'uploading' as const, progress: 10 } : a));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      setPendingAttachments(prev => prev.map((a, i) => i === index ? { ...a, progress: 30 } : a));

      // Read file data directly from local URI
      const response = await fetch(attachment.uri);
      const fileData = await response.arrayBuffer();

      setPendingAttachments(prev => prev.map((a, i) => i === index ? { ...a, progress: 50 } : a));

      const timestamp = Date.now();
      const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${user.id}/${timestamp}_${safeName}`;

      // Upload directly to Supabase Storage bypassing Vercel API limits
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(storagePath, fileData, {
          contentType: attachment.type,
          upsert: false,
        });

      if (error) {
        throw new Error(`Storage error: ${error.message}`);
      }

      setPendingAttachments(prev => prev.map((a, i) => i === index ? { ...a, progress: 80 } : a));

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(storagePath);

      // Update with uploaded URL
      setPendingAttachments(prev => prev.map((a, i) => i === index ? {
        ...a,
        status: 'done' as const,
        progress: 100,
        uploadedUrl: urlData.publicUrl,
        storagePath: storagePath,
      } : a));

    } catch (err: any) {
      console.error('[UPLOAD] Failed:', err);
      setPendingAttachments(prev => prev.map((a, i) => i === index ? { ...a, status: 'error' as const, progress: 0 } : a));
      Alert.alert('Upload Failed', err.message || 'Could not upload file. Please check your connection and try again.');
    }
  };

  const handlePickCamera = async () => {
    setShowAttachModal(false);
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const newAttachment: AttachmentItem = {
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize || 0,
          status: 'pending',
          progress: 0,
          base64: asset.base64 || undefined,
        };
        const idx = pendingAttachments.length;
        setPendingAttachments(prev => [...prev, newAttachment]);
        // Auto-upload
        setTimeout(() => uploadFileToSupabase(newAttachment, idx), 100);
      }
    } catch (e: any) {
      console.error('Camera error:', e);
      Alert.alert('Error', 'Failed to open camera.');
    }
  };

  const handlePickPhotos = async () => {
    setShowAttachModal(false);
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.8,
        base64: true,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets) {
        const startIdx = pendingAttachments.length;
        const newAttachments: AttachmentItem[] = result.assets.map((asset: any) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize || 0,
          status: 'pending' as const,
          progress: 0,
          base64: asset.base64 || undefined,
        }));
        setPendingAttachments(prev => [...prev, ...newAttachments]);
        // Auto-upload all
        newAttachments.forEach((att, i) => {
          setTimeout(() => uploadFileToSupabase(att, startIdx + i), 100 * (i + 1));
        });
      }
    } catch (e: any) {
      console.error('Photo picker error:', e);
      Alert.alert('Error', 'Failed to open photo library.');
    }
  };

  const handlePickFiles = async () => {
    setShowAttachModal(false);
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
          'text/csv',
          'image/*',
        ],
        multiple: true,
      });
      if (!result.canceled && result.assets) {
        const startIdx = pendingAttachments.length;
        const newAttachments: AttachmentItem[] = result.assets.map((asset: any) => ({
          uri: asset.uri,
          name: asset.name || `file_${Date.now()}`,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
          status: 'pending' as const,
          progress: 0,
        }));
        setPendingAttachments(prev => [...prev, ...newAttachments]);
        // Auto-upload all
        newAttachments.forEach((att, i) => {
          setTimeout(() => uploadFileToSupabase(att, startIdx + i), 100 * (i + 1));
        });
      }
    } catch (e: any) {
      console.error('Document picker error:', e);
      Alert.alert('Error', 'Failed to open file picker.');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (customMessage?: string, prebuiltAttachments?: Array<{ url: string; name: string; type: string; size: number; storage_path?: string }>) => {
    const userMsg = (typeof customMessage === 'string' ? customMessage : inputText.trim());
    // Use pre-built attachments if provided (from auto-send), otherwise derive from state
    const sentAttachments = prebuiltAttachments || pendingAttachments
      .filter(a => a.status === 'done' && a.uploadedUrl)
      .map(a => ({ url: a.uploadedUrl!, name: a.name, type: a.type, size: a.size, storage_path: a.storagePath }));
    const hasAnyAttachments = sentAttachments.length > 0 || hasAttachments;

    if (userMsg === '' && !hasAnyAttachments) return;
    if (!prebuiltAttachments && isUploading) return;

    const newMsgs = [...messages, { sender: 'user' as const, text: userMsg, attachments: sentAttachments.length > 0 ? sentAttachments : undefined }];
    setMessages(newMsgs);
    setInputText('');
    setPendingAttachments([]);
    setIsTyping(true);

    try {
      let { data: { session } } = await supabase.auth.getSession();
      let token = session?.access_token;
      // const API_URL = 'https://enliten-admin.vercel.app/api/chat-ollama'
      const API_URL = `${API_BASE_URL}/api/chat-ollama`;

      // Construct request payload. If there is no active convoId, send user profile info as the session's first message.
      const payload: any = {
        message: userMsg,
        thread_id: convoId,
        attachments: sentAttachments.length > 0 ? sentAttachments : undefined,
        webSearchEnabled,
      };

      if (!convoId && user) {
        payload.user_info = {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
        };
      }

      // Inject evaluation context for mentor mode (hidden from UI)
      if (evaluationContextRef.current) {
        payload.evaluation_context = evaluationContextRef.current;
        evaluationContextRef.current = null;
      }

      // Use XMLHttpRequest for SSE streaming support in React Native
      const xhr = new XMLHttpRequest();
      xhr.timeout = 60000; // 60s timeout to prevent infinite loading on unreachable server
      xhr.open('POST', API_URL);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      let processedLength = 0;
      let streamedRaw = '';
      let streamBuffer = ''; // Buffer for incomplete stream chunks
      let firstTokenReceived = false; // Mutable flag — NOT React state, avoids stale closure
      const streamMsgIdx = newMsgs.length; // index where the AI message will be

      // NO placeholder message — only typing dots show until first real token

      xhr.onprogress = () => {
        const newData = xhr.responseText.substring(processedLength);
        processedLength = xhr.responseText.length;

        streamBuffer += newData;
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || ''; // Keep the incomplete last line in the buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(trimmed.slice(6));

            if (event.type === 'thread_id' && !convoId) {
              setConvoId(event.thread_id);
            }

            if (event.type === 'text') {
              streamedRaw += event.content;
              const displayText = stripThinkTags(streamedRaw);
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                setIsTyping(false); // Kill the typing dots
                setShowAutoSendOverlay(false); // Hide loading overlay
                // Insert the AI message for the first time WITH real text
                setMessages(prev => [...prev, { sender: 'ai' as const, text: displayText, isStreaming: true }]);
              } else {
                // Update the existing AI message in-place
                setMessages(prev => {
                  const updated = [...prev];
                  updated[streamMsgIdx] = { sender: 'ai' as const, text: displayText, isStreaming: true };
                  return updated;
                });
              }
            }

            if (event.type === 'text_correction') {
              // Server validated image URLs and sent corrected text
              streamedRaw = event.content;
              const displayText = stripThinkTags(streamedRaw);
              setMessages(prev => {
                const updated = [...prev];
                if (updated[streamMsgIdx]) {
                  updated[streamMsgIdx] = { ...updated[streamMsgIdx], text: displayText };
                }
                return updated;
              });
            }

            if (event.type === 'done') {
              let fq = event.message?.follow_up_questions;
              if (typeof fq === 'string') { try { fq = JSON.parse(fq); } catch (e) { } }
              setMessages(prev => {
                const updated = [...prev];
                updated[streamMsgIdx] = {
                  sender: 'ai' as const,
                  text: event.message?.text || stripThinkTags(streamedRaw),
                  sources: event.message?.sources,
                  followUpQuestions: Array.isArray(fq) ? fq : [],
                };
                return updated;
              });
              setIsTyping(false);
            }

            if (event.type === 'error') {
              setMessages(prev => {
                const updated = [...prev];
                updated[streamMsgIdx] = { sender: 'ai' as const, text: 'Sorry, an error occurred.' };
                return updated;
              });
              setIsTyping(false);
              setShowAutoSendOverlay(false);
            }
          } catch (e) { /* skip malformed lines */ }
        }
      };

      xhr.onload = () => {
        // Ensure isTyping is cleared even if 'done' event was missed
        setIsTyping(false);
        if (xhr.status === 429) {
          try {
            const errRes = JSON.parse(xhr.responseText);
            Alert.alert('Usage Limit Reached', errRes.error || 'Rate limit exceeded.');
            setMessages(prev => {
              const updated = [...prev];
              updated[streamMsgIdx] = { sender: 'ai' as const, text: 'You have reached your usage limit. Please check your settings.' };
              return updated;
            });
          } catch (e) { }
        }
      };

      xhr.onerror = async () => {
        // Try silent token refresh on network error
        try {
          const { data: { session: newSession } } = await supabase.auth.refreshSession();
          if (newSession?.access_token && newSession.access_token !== token) {
            // Retry once with refreshed token
            const retryXhr = new XMLHttpRequest();
            retryXhr.open('POST', API_URL);
            retryXhr.setRequestHeader('Content-Type', 'application/json');
            retryXhr.setRequestHeader('Authorization', `Bearer ${newSession.access_token}`);
            processedLength = 0;
            streamedRaw = '';
            retryXhr.onprogress = xhr.onprogress;
            retryXhr.onload = xhr.onload;
            retryXhr.onerror = () => {
              setMessages(prev => {
                const updated = [...prev];
                updated[streamMsgIdx] = { sender: 'ai' as const, text: 'Sorry, connection failed.' };
                return updated;
              });
              setIsTyping(false);
              setShowAutoSendOverlay(false);
            };
            retryXhr.send(JSON.stringify(payload));
            return;
          }
        } catch (e) { }
        setMessages(prev => {
          const updated = [...prev];
          updated[streamMsgIdx] = { sender: 'ai' as const, text: 'Sorry, connection failed.' };
          return updated;
        });
        setIsTyping(false);
        setShowAutoSendOverlay(false);
      };

      xhr.ontimeout = () => {
        console.error('[CHAT] XHR timeout — server unreachable at', API_URL);
        setMessages(prev => {
          const updated = [...prev];
          updated[streamMsgIdx] = { sender: 'ai' as const, text: 'Sorry, the request timed out. Please check your connection and try again.' };
          return updated;
        });
        setIsTyping(false);
      };

      xhr.send(JSON.stringify(payload));
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev.slice(0, -1), { sender: 'ai' as const, text: 'Sorry, I encountered an error.' }]);
      setIsTyping(false);
    }
  };

  const handleLoadConvo = async (id: string) => {
    setConvoId(id);
    setIsSidebarOpen(false);
    setIsLoadingConvo(true);

    const { data } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('thread_id', id)
      .order('created_at', { ascending: true });

    if (data) {
      const parsedMessages = data.map((msg: any) => {
        let fq = msg.follow_up_questions;
        if (typeof fq === 'string') {
          try { fq = JSON.parse(fq); } catch (e) { }
        }
        return {
          sender: msg.sender as 'user' | 'ai',
          text: msg.text,
          sources: msg.sources,
          followUpQuestions: Array.isArray(fq) ? fq : [],
          attachments: Array.isArray(msg.attachments) ? msg.attachments : undefined,
        };
      });
      setMessages(parsedMessages);

      // Restore quiz submission state from DB
      const { data: quizSessions } = await supabase
        .from('quiz_sessions')
        .select('id, quiz_order, ai_questions, ai_answers, score')
        .eq('chat_session_id', id)
        .eq('quiz_type', 'ai-mentor')
        .order('quiz_order', { ascending: true });

      if (quizSessions && quizSessions.length > 0) {
        const restoredSubmissions: Record<number, { selectedAnswers: Record<number, number>; submitted: boolean }> = {};
        let quizIdx = 0;

        parsedMessages.forEach((msg, msgIdx) => {
          if (msg.sender !== 'ai') return;
          const blocks = parseMessageBlocks(msg.text || '');
          for (const blk of blocks) {
            if (blk.type === 'QUIZ_UI' && blk.data && quizIdx < quizSessions.length) {
              const session = quizSessions[quizIdx];
              const answers: Record<number, number> = {};
              if (session.ai_answers) {
                for (const ans of session.ai_answers as any[]) {
                  answers[ans.questionIndex] = ans.selectedOptionIndex;
                }
              }
              restoredSubmissions[msgIdx] = {
                selectedAnswers: answers,
                submitted: true,
              };
              quizIdx++;
            }
          }
        });

        if (Object.keys(restoredSubmissions).length > 0) {
          setQuizSubmissions(restoredSubmissions);
        }
      }
    }
    setIsLoadingConvo(false);
  };

  const handleDeleteThread = async (id: string) => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('ai_chat_threads').delete().eq('id', id);
          setThreads(threads.filter(t => t.id !== id));
          if (convoId === id) {
            handleNewChat();
          }
        }
      }
    ]);
  };

  const handleNewChat = () => {
    setConvoId(null);
    setMessages([]);
    setQuizSubmissions({});
    setPendingAttachments([]);
    setIsSidebarOpen(false);
  };

  const toggleModel = () => {
    const nextModel = activeModel === 'AI Mentor Pro' ? 'AI Mentor Lite' : 'AI Mentor Pro';
    setActiveModel(nextModel);
  };

  const currentUserName = user?.full_name ? user.full_name.split(' ')[0] : 'Learner';

  // Extract Markdown Style Mapping Configuration
  const markdownStyles = {
    body: { color: colors.text, fontSize: 16, lineHeight: 25 },
    blockquote: {
      backgroundColor: isDark ? '#1C1D24' : '#F3F4F6',
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginVertical: 8,
      borderRadius: 4,
    },
    heading1: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 16, marginBottom: 8 },
    heading2: { color: colors.text, fontSize: 19, fontWeight: '700', marginTop: 14, marginBottom: 8 },
    heading3: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 12, marginBottom: 6 },
    heading4: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 10, marginBottom: 6 },
    paragraph: { color: colors.text, fontSize: 16, lineHeight: 25, marginTop: 4, marginBottom: 10 },
    code_inline: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: colors.inputBg,
      color: colors.primary,
      borderRadius: 4,
    },
    code_block: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: isDark ? '#161618' : '#F3F4F6',
      color: colors.text,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden'
    },
    fence: {
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: isDark ? '#161618' : '#F3F4F6',
      color: colors.text,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden'
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
    },
    th: {
      backgroundColor: isDark ? '#202023' : '#E5E7EB',
      padding: 10,
      fontWeight: '700',
      color: colors.text,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    td: {
      padding: 10,
      color: colors.text,
    },
    list_item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    bullet_list_icon: {
      color: colors.primary,
      fontSize: 20,
      marginLeft: 0,
    }
  } as const;

  const SkeletonBubble = ({ isUser, widthPercent }: { isUser?: boolean; widthPercent: number }) => {
    const bubbleWidth = (width - 64) * (widthPercent / 100);
    return (
      <View style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        paddingHorizontal: 16,
      }}>
        <View style={{
          width: bubbleWidth,
          height: 48,
          borderRadius: 18,
          backgroundColor: isUser
            ? (isDark ? '#1E2022' : '#E5E7EB')
            : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
        }} />
      </View>
    );
  };

  const ChatSkeleton = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
      <SkeletonBubble widthPercent={75} />
      <SkeletonBubble isUser widthPercent={50} />
      <SkeletonBubble widthPercent={85} />
      <SkeletonBubble widthPercent={65} />
      <SkeletonBubble isUser widthPercent={40} />
      <SkeletonBubble widthPercent={70} />
      <SkeletonBubble isUser widthPercent={55} />
      <SkeletonBubble widthPercent={60} />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Smooth Background radial glow effect */}
      {messages.length === 0 && (
        <LinearGradient
          colors={bgGlowColors}
          style={styles.bottomGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      )}

      {/* Top Header Bar */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerIconBtn} onPress={() => setIsSidebarOpen(true)}>
          <Menu size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>

        {/* <View style={styles.modelSelector}>
          <Text style={[styles.modelText, { fontSize: 16, fontWeight: '700' }]}>AI Mentor</Text>
        </View> */}

        <TouchableOpacity style={styles.headerIconBtn} onPress={handleNewChat}>
          <SquarePen size={22} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Scrollable Conversation Content Area - iOS uses KAV, Android uses Keyboard API */}
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={
              (isLoadingConvo || messages.length === 0)
                ? styles.chatAreaEmptyContent
                : [styles.chatAreaContent, { paddingBottom: 16 }]
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isLoadingConvo ? (
              <ChatSkeleton />
            ) : messages.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Animated.View style={[styles.sparkContainer, animatedStarStyle]}>
                  <EnlitenCoreIcon size={64} />
                </Animated.View>
                <Text style={styles.greetingTitle}>
                  Good Morning, {currentUserName}!
                </Text>
              </View>
            ) : (
              messages.map((msg, index) => {
                const blocks = parseMessageBlocks(msg.text || '');

                return (
                  <View key={index} style={[styles.messageRow, msg.sender === 'user' ? styles.userRow : styles.aiRow]}>
                    {/* {msg.sender === 'ai' && (
                      <View style={styles.aiAvatarWrapper}><EnlitenCoreIcon size={20} /></View>
                    )} */}
                    <View style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                      {msg.sender === 'user' ? (
                        <>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: msg.text && msg.text !== 'Attached file(s)' ? 8 : 0 }}>
                              {msg.attachments.map((att: any, attIdx: number) => (
                                att.type?.startsWith('image/') ? (
                                  <Image key={attIdx} source={{ uri: att.url }} style={{ width: 120, height: 120, borderRadius: 12 }} resizeMode="cover" />
                                ) : (
                                  <View key={attIdx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1A1A2E' : '#F0F0FF', borderRadius: 12, padding: 10, gap: 8 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: getFileIconColor(att.type) + '20', alignItems: 'center', justifyContent: 'center' }}>
                                      <FileText size={18} color={getFileIconColor(att.type)} />
                                    </View>
                                    <View style={{ maxWidth: 140 }}>
                                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{att.name}</Text>
                                      <Text style={{ color: colors.subText, fontSize: 10 }}>{formatFileSize(att.size || 0)}</Text>
                                    </View>
                                  </View>
                                )
                              ))}
                            </View>
                          )}
                          {msg.text && msg.text !== 'Attached file(s)' && <Text style={styles.userText}>{msg.text}</Text>}
                        </>
                      ) : (
                        <>
                          {/* Render blocks seamlessly */}
                          {blocks.map((blk, bIdx) => {
                            if (blk.type === 'text') {
                              return (
                                <Markdown
                                  key={bIdx}
                                  style={markdownStyles as any}
                                  rules={markdownRules}
                                >
                                  {blk.content || ''}
                                </Markdown>
                              );
                            } else if (blk.type === 'QUIZ_UI' && blk.data) {
                              return <GenerativeQuizCard key={bIdx} data={blk.data} messageIndex={index} colors={colors} isDark={isDark} styles={styles} quizSubmissions={quizSubmissions} setQuizSubmissions={setQuizSubmissions} setIsTyping={setIsTyping} setMessages={setMessages} user={user} convoId={convoId} examId={exam?.id} />;
                            } else if (blk.type === 'CHART_UI' && blk.data) {
                              return <GenerativeChartCard key={bIdx} data={blk.data} colors={colors} isDark={isDark} styles={styles} />;
                            } else if (blk.type === 'TIMELINE_UI' && blk.data) {
                              return <GenerativeTimelineCard key={bIdx} data={blk.data} colors={colors} isDark={isDark} styles={styles} />;
                            } else if (blk.type === 'partial_QUIZ_UI') {
                              return <View key={bIdx} style={styles.genUiSpinner}><ActivityIndicator size="small" color="#818CF8" /><Text style={styles.genUiSpinnerText}>Generating Quiz...</Text></View>;
                            } else if (blk.type === 'partial_CHART_UI') {
                              return <View key={bIdx} style={styles.genUiSpinner}><ActivityIndicator size="small" color="#38BDF8" /><Text style={styles.genUiSpinnerText}>Generating Chart...</Text></View>;
                            } else if (blk.type === 'partial_TIMELINE_UI') {
                              return <View key={bIdx} style={styles.genUiSpinner}><ActivityIndicator size="small" color="#EC4899" /><Text style={styles.genUiSpinnerText}>Generating Timeline...</Text></View>;
                            }
                            return null;
                          })}

                          {/* Sources — Claude style */}
                          {msg.sources && msg.sources.groundingChunks && msg.sources.groundingChunks.length > 0 && (
                            <TouchableOpacity
                              style={styles.sourcesWrapper}
                              onPress={() => setSourcesModalData(msg.sources.groundingChunks)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.sourcesLabel}>Sources</Text>
                              <View style={styles.sourcesRow}>
                                {msg.sources.groundingChunks.slice(0, 5).map((chunk: any, chunkIdx: number) => (
                                  <View key={chunkIdx} style={[styles.sourceFaviconBtn, { marginLeft: chunkIdx === 0 ? 0 : -8, zIndex: 10 - chunkIdx }]}>
                                    <SourceFavicon uri={chunk.web?.uri || ''} title={chunk.web?.title} size={22} />
                                  </View>
                                ))}
                                {msg.sources.groundingChunks.length > 5 && (
                                  <View style={[styles.sourceFaviconBtn, { marginLeft: -8, zIndex: 0 }]}>
                                    <Text style={{ color: '#AAA', fontSize: 10, fontWeight: '700' }}>+{msg.sources.groundingChunks.length - 5}</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          )}

                          {msg.followUpQuestions && Array.isArray(msg.followUpQuestions) && msg.followUpQuestions.length > 0 && (
                            <View style={styles.followUpWrapper}>
                              {msg.followUpQuestions.map((fq, fqIdx) => (
                                <TouchableOpacity key={fqIdx} style={styles.followUpBtn} onPress={() => handleSend(fq)}>
                                  <CornerDownRight size={16} color={colors.subText} style={{ marginRight: 10, marginTop: 2 }} />
                                  <Text style={styles.followUpText}>{fq}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            {isTyping && (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 5, paddingRight: 16 }}>
                <ClaudeLoadingWave size={20} color={colors.primary} />
                <View style={{ width: 12 }} />
                <AnimatedStreamingText color={colors.primary} />
              </View>
            )}
          </ScrollView>


          <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 12), paddingTop: 8 }]}>
            <ChatInputBar
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              setShowAttachModal={setShowAttachModal}
              hasAttachments={hasAttachments}
              pendingAttachments={pendingAttachments}
              handleRemoveAttachment={handleRemoveAttachment}
              allUploaded={allUploaded}
              isUploading={isUploading}
              colors={colors}
              isDark={isDark}
              insets={insets}
              webSearchEnabled={webSearchEnabled}
              setWebSearchEnabled={setWebSearchEnabled}
            />
          </View>
        </KeyboardAvoidingView>
      ) : (
        <Animated.View style={[{ flex: 1 }, animatedKeyboardContainerStyle]}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={
              (isLoadingConvo || messages.length === 0)
                ? styles.chatAreaEmptyContent
                : [styles.chatAreaContent, { paddingBottom: 16 }]
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isLoadingConvo ? (
              <ChatSkeleton />
            ) : messages.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Animated.View style={[styles.sparkContainer, animatedStarStyle]}>
                  <EnlitenCoreIcon size={64} />
                </Animated.View>
                <Text style={styles.greetingTitle}>
                  What's the vibe, {currentUserName}?
                </Text>
              </View>
            ) : (
              messages.map((msg, index) => {
                const blocks = parseMessageBlocks(msg.text || '');

                return (
                  <View key={index} style={[styles.messageRow, msg.sender === 'user' ? styles.userRow : styles.aiRow]}>
                    {/* {msg.sender === 'ai' && (
                      <View style={styles.aiAvatarWrapper}><EnlitenCoreIcon size={20} /></View>
                    )} */}
                    <View style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.aiBubble]}>
                      {msg.sender === 'user' ? (
                        <>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: msg.text && msg.text !== 'Attached file(s)' ? 8 : 0 }}>
                              {msg.attachments.map((att: any, attIdx: number) => (
                                att.type?.startsWith('image/') ? (
                                  <Image key={attIdx} source={{ uri: att.url }} style={{ width: 120, height: 120, borderRadius: 12 }} resizeMode="cover" />
                                ) : (
                                  <View key={attIdx} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1A1A2E' : '#F0F0FF', borderRadius: 12, padding: 10, gap: 8 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: getFileIconColor(att.type) + '20', alignItems: 'center', justifyContent: 'center' }}>
                                      <FileText size={18} color={getFileIconColor(att.type)} />
                                    </View>
                                    <View style={{ maxWidth: 140 }}>
                                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{att.name}</Text>
                                      <Text style={{ color: colors.subText, fontSize: 10 }}>{formatFileSize(att.size || 0)}</Text>
                                    </View>
                                  </View>
                                )
                              ))}
                            </View>
                          )}
                          {msg.text && msg.text !== 'Attached file(s)' && <Text style={styles.userText}>{msg.text}</Text>}
                        </>
                      ) : (
                        <>
                          {/* Render blocks seamlessly */}
                          {blocks.map((blk, bIdx) => {
                            if (blk.type === 'text') {
                              return (
                                <Markdown
                                  key={bIdx}
                                  style={markdownStyles as any}
                                  rules={markdownRules}
                                >
                                  {blk.content || ''}
                                </Markdown>
                              );
                            } else if (blk.type === 'QUIZ_UI' && blk.data) {
                              return <GenerativeQuizCard key={bIdx} data={blk.data} messageIndex={index} colors={colors} isDark={isDark} styles={styles} quizSubmissions={quizSubmissions} setQuizSubmissions={setQuizSubmissions} setIsTyping={setIsTyping} setMessages={setMessages} user={user} convoId={convoId} examId={exam?.id} />;
                            } else if (blk.type === 'CHART_UI' && blk.data) {
                              return <GenerativeChartCard key={bIdx} data={blk.data} colors={colors} isDark={isDark} styles={styles} />;
                            } else if (blk.type === 'TIMELINE_UI' && blk.data) {
                              return <GenerativeTimelineCard key={bIdx} data={blk.data} colors={colors} isDark={isDark} styles={styles} />;
                            } else if (blk.type === 'partial_QUIZ_UI') {
                              return <View key={bIdx} style={styles.genUiSpinner}><ActivityIndicator size="small" color="#818CF8" /><Text style={styles.genUiSpinnerText}>Generating Quiz...</Text></View>;
                            } else if (blk.type === 'partial_CHART_UI') {
                              return <View key={bIdx} style={styles.genUiSpinner}><ActivityIndicator size="small" color="#38BDF8" /><Text style={styles.genUiSpinnerText}>Generating Chart...</Text></View>;
                            } else if (blk.type === 'partial_TIMELINE_UI') {
                              return <View key={bIdx} style={styles.genUiSpinner}><ActivityIndicator size="small" color="#EC4899" /><Text style={styles.genUiSpinnerText}>Generating Timeline...</Text></View>;
                            }
                            return null;
                          })}

                          {/* Sources — Claude style */}
                          {msg.sources && msg.sources.groundingChunks && msg.sources.groundingChunks.length > 0 && (
                            <TouchableOpacity
                              style={styles.sourcesWrapper}
                              onPress={() => setSourcesModalData(msg.sources.groundingChunks)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.sourcesLabel}>Sources</Text>
                              <View style={styles.sourcesRow}>
                                {msg.sources.groundingChunks.slice(0, 5).map((chunk: any, chunkIdx: number) => (
                                  <View key={chunkIdx} style={[styles.sourceFaviconBtn, { marginLeft: chunkIdx === 0 ? 0 : -8, zIndex: 10 - chunkIdx }]}>
                                    <SourceFavicon uri={chunk.web?.uri || ''} title={chunk.web?.title} size={22} />
                                  </View>
                                ))}
                                {msg.sources.groundingChunks.length > 5 && (
                                  <View style={[styles.sourceFaviconBtn, { marginLeft: -8, zIndex: 0 }]}>
                                    <Text style={{ color: '#AAA', fontSize: 10, fontWeight: '700' }}>+{msg.sources.groundingChunks.length - 5}</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          )}

                          {msg.followUpQuestions && Array.isArray(msg.followUpQuestions) && msg.followUpQuestions.length > 0 && (
                            <View style={styles.followUpWrapper}>
                              {msg.followUpQuestions.map((fq, fqIdx) => (
                                <TouchableOpacity key={fqIdx} style={styles.followUpBtn} onPress={() => handleSend(fq)}>
                                  <CornerDownRight size={16} color={colors.subText} style={{ marginRight: 10, marginTop: 2 }} />
                                  <Text style={styles.followUpText}>{fq}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
            )}
            {isTyping && (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 5, paddingRight: 16 }}>
                <ClaudeLoadingWave size={20} color={colors.primary} />
                <View style={{ width: 12 }} />
                <AnimatedStreamingText color={colors.primary} />
              </View>
            )}
          </ScrollView>
          <Animated.View style={[styles.inputWrapper, { paddingTop: 8 }, animatedKeyboardStyle]}>
            <ChatInputBar
              inputText={inputText}
              setInputText={setInputText}
              handleSend={handleSend}
              setShowAttachModal={setShowAttachModal}
              hasAttachments={hasAttachments}
              pendingAttachments={pendingAttachments}
              handleRemoveAttachment={handleRemoveAttachment}
              allUploaded={allUploaded}
              isUploading={isUploading}
              colors={colors}
              isDark={isDark}
              insets={insets}
              androidInputRef={androidInputRef}
              webSearchEnabled={webSearchEnabled}
              setWebSearchEnabled={setWebSearchEnabled}
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Sources Bottom Sheet Modal ── */}
      <Modal
        visible={sourcesModalData !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSourcesModalData(null)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' }}
            activeOpacity={1}
            onPress={() => setSourcesModalData(null)}
          />
          <View style={{
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: Math.max(insets.bottom, 20),
            maxHeight: height * 0.55,
          }}>
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#555' : '#CCC' }} />
            </View>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#333' : '#E5E5E5' }}>
              <TouchableOpacity onPress={() => setSourcesModalData(null)} style={{ padding: 4 }}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text }}>Sources</Text>
              <View style={{ width: 28 }} />
            </View>
            {/* Citations label */}
            <Text style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, fontSize: 13, fontWeight: '600', color: isDark ? '#888' : '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Citations</Text>
            {/* Source list */}
            <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
              {(sourcesModalData || []).map((chunk: any, idx: number) => {
                let hostname = '';
                try { hostname = new URL(chunk.web?.uri || '').hostname.replace('www.', ''); } catch (e) { }
                return (
                  <TouchableOpacity
                    key={idx}
                    style={{
                      paddingVertical: 14,
                      borderBottomWidth: idx < (sourcesModalData || []).length - 1 ? StyleSheet.hairlineWidth : 0,
                      borderBottomColor: isDark ? '#333' : '#E5E5E5',
                    }}
                    onPress={() => {
                      setSourcesModalData(null);
                      if (chunk.web?.uri) Linking.openURL(chunk.web.uri);
                    }}
                    activeOpacity={0.6}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 }} numberOfLines={2}>
                      {chunk.web?.title || hostname || 'Source'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <SourceFavicon uri={chunk.web?.uri || ''} title={chunk.web?.title} size={18} />
                      <Text style={{ fontSize: 13, color: isDark ? '#888' : '#999', marginLeft: 6 }} numberOfLines={1}>
                        {hostname}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ATTACHMENT BOTTOM SHEET MODAL ── */}
      <Modal
        visible={showAttachModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAttachModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          activeOpacity={1}
          onPress={() => setShowAttachModal(false)}
        >
          <View style={{ flex: 1 }} />
        </TouchableOpacity>
        <View style={{
          backgroundColor: isDark ? '#111115' : '#FFFFFF',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: Math.max(insets.bottom, 20),
          paddingTop: 12,
          paddingHorizontal: 20,
        }}>
          {/* Drag Handle */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#333' : '#CCC' }} />
          </View>

          {/* Header Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <TouchableOpacity onPress={() => setShowAttachModal(false)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? '#1E2022' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Add to chat</Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Options Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', gap: 16, marginBottom: 8 }}>
            {/* Camera */}
            <TouchableOpacity
              onPress={handlePickCamera}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxHeight: 110,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: isDark ? '#2A2A2E' : '#E5E7EB',
                backgroundColor: isDark ? '#0D0D10' : '#FAFAFA',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Camera size={28} color={colors.text} strokeWidth={1.5} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Camera</Text>
            </TouchableOpacity>

            {/* Photos */}
            <TouchableOpacity
              onPress={handlePickPhotos}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxHeight: 110,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: isDark ? '#2A2A2E' : '#E5E7EB',
                backgroundColor: isDark ? '#0D0D10' : '#FAFAFA',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <ImageIcon size={28} color={colors.text} strokeWidth={1.5} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Photos</Text>
            </TouchableOpacity>

            {/* Files */}
            <TouchableOpacity
              onPress={handlePickFiles}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxHeight: 110,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: isDark ? '#2A2A2E' : '#E5E7EB',
                backgroundColor: isDark ? '#0D0D10' : '#FAFAFA',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <FileUp size={28} color={colors.text} strokeWidth={1.5} />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Files</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Slide-out Sidebar Overlay (Drawer Menu) */}
      {isSidebarOpen && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.sidebarBackdrop}
          onTouchStart={() => setIsSidebarOpen(false)}
        />
      )}

      <Animated.View style={[styles.sidebarContainer, animatedSidebarStyle, { paddingTop: insets.top }]}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Recent chats</Text>
          <TouchableOpacity style={styles.sidebarCloseBtn} onPress={() => setIsSidebarOpen(false)}>
            <X size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.sidebarNewChatBtn} onPress={handleNewChat}>
          <Plus size={18} color={colors.text} strokeWidth={2.5} style={{ marginRight: 10 }} />
          <Text style={styles.sidebarNewChatText}>New chat</Text>
        </TouchableOpacity>

        <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
          {isLoadingThreads ? (
            Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={styles.historyItem}>
                <View style={{ marginRight: 12, width: 38, height: 38, borderRadius: 10, backgroundColor: colors.border }} />
                <View style={{ flex: 1 }}>
                  <View style={{ width: i % 2 === 0 ? '70%' : '85%', height: 14, borderRadius: 7, backgroundColor: colors.border, marginBottom: 6 }} />
                  <View style={{ width: '40%', height: 10, borderRadius: 5, backgroundColor: colors.border }} />
                </View>
              </View>
            ))
          ) : (
            threads.map((item) => {
              const isActive = convoId === item.id;
              const dateStr = new Date(item.created_at).toLocaleDateString();
              return (
                <View key={item.id} style={[styles.historyItem, isActive && styles.historyItemActive]}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                    onPress={() => handleLoadConvo(item.id)}
                  >
                    <ClipboardList size={16} color={isActive ? colors.primary : colors.subText} strokeWidth={2} style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyItemTitle, isActive && styles.historyItemTitleActive]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyItemDate}>{dateStr}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteThread(item.id)} style={{ padding: 8 }}>
                    <Trash2 size={16} color={colors.subText} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.sidebarFooter}>
          <Text style={styles.sidebarFooterText}>Enliten.ai AI Mentor</Text>
        </View>
      </Animated.View>

      {/* Auto-send Loading Overlay */}
      <Modal
        visible={showAutoSendOverlay}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.autoSendOverlay}>
          <View style={[styles.autoSendCard, { backgroundColor: colors.card }]}>
            <LottieView
              source={require('@/assets/animations/ai.json')}
              autoPlay
              loop
              style={{ width: 120, height: 120 }}
            />
            <RNAnimated.Text
              style={[
                styles.autoSendText,
                { color: colors.text, opacity: textOpacity },
              ]}
            >
              {currentTexts[cyclingTextIndex]}
            </RNAnimated.Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 90,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.inputBg,
  },
  modelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
  },
  chatAreaContent: {
    paddingHorizontal: 0,
    paddingTop: 10,
    marginLeft: 20,
  },
  chatAreaEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginBottom: 60,
  },
  sparkContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  greetingTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 38,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 12,
    width: '100%',
  },
  userRow: {
    justifyContent: 'flex-end',
    paddingRight: 16,
    width: '80%',
    alignSelf: 'flex-end',

  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  aiAvatarWrapper: {
    marginRight: 12,
    marginTop: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: isDark ? '#1E2022' : '#E5E7EB',
    alignSelf: 'flex-end',
  },
  aiBubble: {
    backgroundColor: 'transparent',
    alignSelf: 'flex-start',
    paddingLeft: 0,
    flex: 1,
  },
  userText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.subText,
    opacity: 0.6,
  },
  inputWrapper: {
    width: '100%',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    width: '100%',
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  inputPlusBtn: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    height: '100%',
    paddingVertical: 0,
  },
  sendIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: isDark ? '#1E2B4B' : '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  waveformBar: {
    width: 2.2,
    backgroundColor: isDark ? '#60A5FA' : colors.primary,
    borderRadius: 1,
  },
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    zIndex: 99,
  },
  sidebarContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    zIndex: 100,
    paddingHorizontal: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    marginBottom: 10,
  },
  sidebarTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sidebarCloseBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarNewChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sidebarNewChatText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  historyItemActive: {
    backgroundColor: colors.primarySoft,
  },
  historyItemTitle: {
    color: colors.subText,
    fontSize: 14,
    fontWeight: '500',
  },
  historyItemTitleActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  historyItemDate: {
    color: colors.subText,
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
  sidebarFooter: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarFooterText: {
    color: colors.subText,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
  },
  sidebarVersionText: {
    color: colors.subText,
    fontSize: 12,
    opacity: 0.8,
  },
  // Generative UI Quiz Styles
  quizCard: {
    backgroundColor: isDark ? '#111115' : '#FFFFFF',
    // borderWidth: 1,
    // borderColor: isDark ? '#27272F' : '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: isDark ? 0.3 : 0.05,
    // shadowRadius: 6,
    // elevation: 3,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  quizTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  quizQuestionBlock: {
    marginBottom: 20,
  },
  quizQuestionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  quizOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 5,
  },
  quizOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  quizOptionCorrect: {
    borderColor: '#10B981',
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
  },
  quizOptionIncorrect: {
    borderColor: '#EF4444',
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
  },
  quizRadioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quizRadioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  quizOptionText: {
    fontSize: 14.5,
    color: colors.text,
    flex: 1,
  },
  quizExplanationCard: {
    marginTop: 10,
    backgroundColor: isDark ? '#161618' : '#F3F4F6',
    padding: 12,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: 'gray',
  },
  quizExplanationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  quizExplanationText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  quizSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  quizSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  quizResultHeader: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  quizResultScore: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },
  quizResultSub: {
    fontSize: 12,
    marginTop: 4,
    color: colors.subText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Generative UI Chart Styles
  chartCard: {
    backgroundColor: isDark ? '#111115' : '#FFFFFF',
    // borderWidth: 1,
    // borderColor: isDark ? '#27272F' : '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: isDark ? 0.3 : 0.05,
    // shadowRadius: 6,
    // elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  // Generative UI Timeline Styles
  timelineCard: {
    // backgroundColor: isDark ? '#111115' : '#FFFFFF',
    // borderWidth: 1,
    // borderColor: isDark ? '#27272F' : '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 4 },
    // shadowOpacity: isDark ? 0.3 : 0.05,
    // shadowRadius: 6,
    // elevation: 3,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? '#111115' : '#FFFFFF',
    zIndex: 2,
  },
  timelineCircleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  timelineLine: {
    flex: 1,
    width: 0,
    borderLeftWidth: 1.5,
    borderLeftColor: colors.border,
    borderStyle: 'dashed',
    marginTop: 4,
    marginBottom: 4,
  },
  timelineRight: {
    flex: 1,
    paddingBottom: 20,
  },
  timelineStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  timelineStepDesc: {
    fontSize: 14,
    color: colors.subText,
    lineHeight: 20,
  },
  sourcesWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
  },
  sourcesLabel: {
    color: isDark ? '#AAA' : '#666',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  sourcesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceFaviconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: isDark ? '#1A1A1E' : '#FFFFFF',
    backgroundColor: isDark ? '#2A2A2E' : '#F0F0F0',
    overflow: 'hidden',
  },
  followUpWrapper: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: isDark ? '#27272F' : '#E5E7EB',
    paddingTop: 4,
  },
  followUpBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? '#27272F' : '#E5E7EB',
  },
  followUpText: {
    color: colors.text,
    fontSize: 14.5,
    flex: 1,
    lineHeight: 22,
  },
  genUiSpinner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: isDark ? '#1A1A2E' : '#F0F0FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? '#2A2A3E' : '#E0E0F0',
  },
  genUiSpinnerText: {
    color: colors.subText,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
    fontStyle: 'italic',
  },
  autoSendOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoSendCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  autoSendText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
});
