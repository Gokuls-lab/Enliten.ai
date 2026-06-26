import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Flag, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');
const hs = (n: number) => (width / 375) * n;
const vs = (n: number) => (height / 812) * n;

const SUPABASE_URL = 'https://nufmkzmukwplugqvtiie.supabase.co';
const API_BASE = 'http://10.232.75.71:8080'; // Local testing IP

// ─── Types ────────────────────────────────────────────────────────────────────
interface MCQOption {
  letter: string;
  text: string;
}

interface MCQ {
  id: string;
  question: string;
  options: MCQOption[];
  correct_letter: string;
  explanation: string;
  tags: string[];
  source_title: string;
  difficulty: string;
}

// Raw shape from news_mcqs table
interface RawMCQ {
  question: string;
  options: string[];        // ["A. ...", "B. ...", "C. ...", "D. ..."]
  correct_index: number;
  explanation: string;
  gs_tags?: string[];
  exam_relevance?: string;
  topic?: string;
}

const LETTERS = ['A', 'B', 'C', 'D'];

function rawToMCQ(raw: RawMCQ, idx: number): MCQ {
  return {
    id: String(idx),
    question: raw.question,
    options: (raw.options || []).map((text, i) => ({
      letter: LETTERS[i] || String(i),
      text: text.replace(/^[A-D][\.\)\s]+/, '').trim(),
    })),
    correct_letter: LETTERS[raw.correct_index] || 'A',
    explanation: raw.explanation || '',
    tags: [
      ...(raw.gs_tags || []),
      ...(raw.topic ? [raw.topic] : []),
      ...(raw.exam_relevance ? [raw.exam_relevance] : []),
    ],
    source_title: '',
    difficulty: 'medium',
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BRAND = '#9B2335';
const GREEN = '#10B981';
const RED = '#EF4444';
const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const TAG_COLORS: Record<string, string> = {
  GS1: '#3B82F6',
  GS2: '#8B5CF6',
  GS3: '#F97316',
  GS4: '#10B981',
  International_Relations: '#06B6D4',
  Politics: '#3B82F6',
  Economy: '#10B981',
  Environment: '#22C55E',
  Science_Technology: '#8B5CF6',
  Default: '#6B7280',
};

function getTagColor(tag: string): string {
  for (const key of Object.keys(TAG_COLORS)) {
    if (tag.includes(key) || key.includes(tag)) return TAG_COLORS[key];
  }
  return TAG_COLORS.Default;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ visible, correct }: { visible: boolean; correct: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1400),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, correct]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: correct ? '#DEF7EC' : '#FEE2E2' }]}>
      <Text style={[styles.toastText, { color: correct ? '#065F46' : '#991B1B' }]}>
        {correct ? '✓  That\'s correct!' : '✗  That\'s wrong'}
      </Text>
    </Animated.View>
  );
}

// ─── Question Tabs ────────────────────────────────────────────────────────────
function QuestionTabs({
  total, current, answers, colors,
}: { total: number; current: number; answers: Record<number, { correct: boolean; skipped?: boolean }>; colors: any }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const answered = answers[i];
        const isActive = i === current;
        let bg = colors.card;
        let border = colors.border;
        let textColor = colors.subText;
        if (isActive) { bg = BRAND; border = BRAND; textColor = '#fff'; }
        else if (answered?.correct) { bg = GREEN; border = GREEN; textColor = '#fff'; }
        else if (answered && !answered.correct) { bg = RED; border = RED; textColor = '#fff'; }
        return (
          <View key={i} style={[styles.tab, { backgroundColor: bg, borderColor: border }]}>
            <Text style={[styles.tabText, { color: textColor }]}>{i + 1}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NewsMCQScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();

  const date = params.date || toDateKey(new Date());

  const [loading, setLoading] = useState(true);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, { letter: string; correct: boolean; skipped?: boolean }>>({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastCorrect, setToastCorrect] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  // Fetch MCQs: check Supabase cache first, then trigger API generation if missing
  const fetchMCQs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Try Supabase cache
      const { data, error: dbErr } = await supabase
        .from('news_mcqs' as any)
        .select('mcqs')
        .eq('date', date)
        .single();

      if (!dbErr && data && Array.isArray((data as any)?.mcqs) && (data as any).mcqs.length > 0) {
        const rawList: RawMCQ[] = (data as any).mcqs;
        setMcqs(rawList.map(rawToMCQ));
        return;
      }

      // 2. Not cached — call the backend API to generate & cache
      console.log('[NewsMCQ] No cache found, calling generation API...');
      const res = await fetch(
        `${API_BASE}/api/generate-news-mcq?date=${date}`
      );
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to generate MCQs');
      }

      const rawList: RawMCQ[] = Array.isArray(json.mcqs) ? json.mcqs : [];
      if (rawList.length === 0) throw new Error('No MCQs could be generated for this date');
      setMcqs(rawList.map(rawToMCQ));
    } catch (e: any) {
      console.error('[NewsMCQ] fetch error', e);
      setError(e.message || 'Could not load MCQs');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchMCQs(); }, [fetchMCQs]);

  const currentMCQ = mcqs[currentIdx];

  const handleSelect = (letter: string) => {
    if (revealed) return;
    setSelectedLetter(letter);
  };

  const handleReveal = (skipped = false) => {
    if (revealed) return;
    const letter = skipped ? null : selectedLetter;
    const isCorrect = !skipped && letter === currentMCQ.correct_letter;

    setRevealed(true);
    setAnswers(prev => ({ ...prev, [currentIdx]: { letter: letter || '', correct: isCorrect, skipped } }));

    if (!skipped) {
      setToastCorrect(isCorrect);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2000);
    }
  };

  const handleNext = async () => {
    if (!revealed) {
      handleReveal(false);
      return;
    }
    if (currentIdx < mcqs.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedLetter(null);
      setRevealed(false);
    } else {
      // Complete
      setCompleted(true);
      await saveSession();
    }
  };

  const handleSkip = () => handleReveal(true);

  const toggleFlag = () => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(currentIdx)) next.delete(currentIdx);
      else next.add(currentIdx);
      return next;
    });
  };

  const saveSession = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const correct = Object.values(answers).filter(a => a.correct).length;
      const total = mcqs.length;

      const { data: session, error: se } = await supabase
        .from('quiz_sessions')
        .insert({
          user_id: user.id,
          quiz_type: 'news_mcq',
          score: correct,
          total_questions: total,
          time_taken_seconds: 0,
          completed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (se || !session) { console.error('[MCQ] session error', se); return; }

      const answerRows = Object.entries(answers).map(([idx, ans]) => ({
        user_id: user.id,
        question_id: mcqs[parseInt(idx)]?.id,
        selected_option_id: ans.letter,
        is_correct: ans.correct,
        answered_at: new Date().toISOString(),
        quiz_session_id: session.id,
      }));

      await supabase.from('user_answers').insert(answerRows);
    } catch (e) {
      console.error('[MCQ] save error', e);
    } finally {
      setSaving(false);
    }
  };

  const correctCount = Object.values(answers).filter(a => a.correct).length;

  // ── Completion Screen ──────────────────────────────────────────────────────
  if (completed) {
    const pct = Math.round((correctCount / mcqs.length) * 100);
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BlurView intensity={Platform.OS === 'ios' ? 60 : 90} tint={isDark ? 'dark' : 'light'}
          style={[styles.header, { paddingTop: insets.top + 4 }]}>
          <View style={{ width: 36 }} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Practice</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </BlurView>

        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: insets.top + 80, paddingBottom: 60, paddingHorizontal: 24 }}>
          <LinearGradient colors={isDark ? ['#1a2332', '#0f1623'] : ['#FFF7F7', '#FFF']}
            style={styles.resultCard}>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreNumber}>{pct}%</Text>
            </View>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              {pct >= 70 ? '🎉 Great job!' : pct >= 40 ? '👍 Good effort!' : '📖 Keep practicing!'}
            </Text>
            <Text style={[styles.resultSubtitle, { color: colors.subText }]}>
              You got {correctCount} out of {mcqs.length} questions correct
            </Text>

            <View style={styles.resultRow}>
              {[{ label: 'Correct', val: correctCount, color: GREEN },
                { label: 'Wrong', val: Object.values(answers).filter(a => !a.correct && !a.skipped).length, color: RED },
                { label: 'Skipped', val: Object.values(answers).filter(a => a.skipped).length, color: '#6B7280' },
              ].map(stat => (
                <View key={stat.label} style={styles.statBox}>
                  <Text style={[styles.statNum, { color: stat.color }]}>{stat.val}</Text>
                  <Text style={[styles.statLabel, { color: colors.subText }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: BRAND }]} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <View style={styles.loadingIcon}>
          <BookOpen size={40} color={BRAND} />
        </View>
        <Text style={[styles.loadingTitle, { color: colors.text }]}>Loading MCQs</Text>
        <Text style={[styles.loadingSubtitle, { color: colors.subText }]}>
          Hold on while we get the questions
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { backgroundColor: BRAND }]} />
        </View>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || mcqs.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingTitle, { color: colors.text }]}>No MCQs Available</Text>
        <Text style={[styles.loadingSubtitle, { color: colors.subText }]}>
          {error || 'No news available for this date to generate MCQs.'}
        </Text>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: BRAND, marginTop: 24 }]} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentMCQ) return null;

  const isCorrect = revealed && selectedLetter === currentMCQ.correct_letter;
  const isWrong = revealed && selectedLetter && selectedLetter !== currentMCQ.correct_letter;
  const nextDisabled = !revealed && !selectedLetter;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <BlurView intensity={Platform.OS === 'ios' ? 60 : 90} tint={isDark ? 'dark' : 'light'}
        style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Practice</Text>
        <View style={{ width: 36 }} />
      </BlurView>

      {/* Question Tabs */}
      <View style={[styles.tabsRow, { marginTop: insets.top + 52 }]}>
        <QuestionTabs total={mcqs.length} current={currentIdx} answers={answers} colors={colors} />
        <View style={[styles.tabUnderline, { left: 16 + currentIdx * 44, backgroundColor: BRAND }]} />
      </View>

      {/* Question Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 120 }}
      >
        {/* Tags */}
        <View style={styles.tagsRow}>
          {(currentMCQ.tags || []).map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: getTagColor(tag) + '22', borderColor: getTagColor(tag) + '55' }]}>
              <Text style={[styles.tagText, { color: getTagColor(tag) }]}>{tag.replace(/_/g, ' ')}</Text>
            </View>
          ))}
        </View>

        {/* Question label */}
        <Text style={[styles.questionLabel, { color: BRAND }]}>Question {currentIdx + 1}</Text>

        {/* Question text */}
        <Text style={[styles.questionText, { color: colors.text }]}>{currentMCQ.question}</Text>

        {/* Options */}
        <View style={{ gap: 10, marginTop: 8 }}>
          {currentMCQ.options.map(opt => {
            const isThis = selectedLetter === opt.letter;
            const isCorrectOpt = revealed && opt.letter === currentMCQ.correct_letter;
            const isWrongOpt = revealed && isThis && !isCorrectOpt;

            let bg = colors.card;
            let border = colors.border;
            let letterBg = isDark ? '#2a3444' : '#F3F4F6';
            let letterColor = colors.text;
            let textColor = colors.text;

            if (isCorrectOpt) {
              bg = 'rgba(16,185,129,0.08)'; border = GREEN; letterBg = GREEN; letterColor = '#fff'; textColor = '#065F46';
            } else if (isWrongOpt) {
              bg = 'rgba(239,68,68,0.08)'; border = RED; letterBg = RED; letterColor = '#fff'; textColor = '#991B1B';
            } else if (isThis && !revealed) {
              border = colors.primary || BRAND;
            }

            return (
              <TouchableOpacity
                key={opt.letter}
                onPress={() => handleSelect(opt.letter)}
                disabled={revealed}
                activeOpacity={0.8}
                style={[styles.option, { backgroundColor: bg, borderColor: border }]}
              >
                <View style={[styles.optionLetter, { backgroundColor: letterBg }]}>
                  <Text style={[styles.optionLetterText, { color: letterColor }]}>{opt.letter}</Text>
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>{opt.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Explanation */}
        {revealed && (
          <View style={[styles.explanation, { backgroundColor: isDark ? '#1a2332' : '#F8FAFF', borderColor: colors.border }]}>
            <Text style={[styles.explanationLabel, { color: BRAND }]}>Explanation</Text>
            <Text style={[styles.explanationText, { color: colors.text }]}>{currentMCQ.explanation}</Text>
            {currentMCQ.source_title ? (
              <Text style={[styles.sourceText, { color: colors.subText }]}>Source: {currentMCQ.source_title}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Toast */}
      <Toast visible={toastVisible} correct={toastCorrect} />

      {/* Bottom Bar */}
      <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint={isDark ? 'dark' : 'light'}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.bottomRow}>
          {/* Left: Back / Skip */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => { if (currentIdx > 0) { setCurrentIdx(i => i - 1); setSelectedLetter(null); setRevealed(false); } else { router.back(); } }}
              style={[styles.iconBtn, { borderColor: colors.border }]}
            >
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>

            {!revealed && (
              <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip & Reveal</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Right: Flag + Next */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={toggleFlag}
              style={[styles.flagBtn, { backgroundColor: flagged.has(currentIdx) ? '#FECDD3' : '#FEE2E2' }]}>
              <Flag size={18} color={flagged.has(currentIdx) ? RED : '#FDA4AF'} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              disabled={nextDisabled}
              style={[styles.nextBtn, {
                backgroundColor: nextDisabled ? colors.border : (revealed ? BRAND : colors.primary || '#93C5FD'),
                opacity: nextDisabled ? 0.5 : 1,
              }]}
            >
              <Text style={[styles.nextBtnText, { color: nextDisabled ? colors.subText : '#fff' }]}>
                {revealed ? (currentIdx < mcqs.length - 1 ? 'Next' : 'Finish') : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  tabsRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tab: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabUnderline: { position: 'absolute', bottom: 0, width: 36, height: 2.5, borderRadius: 2 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, marginBottom: 8 },
  tag: {
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText: { fontSize: 11, fontWeight: '700' },
  questionLabel: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  questionText: { fontSize: 15, lineHeight: 24, fontWeight: '400', marginBottom: 16 },
  option: {
    borderRadius: 14, borderWidth: 1.5, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  optionLetter: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
  },
  optionLetterText: { fontSize: 13, fontWeight: '700' },
  optionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  explanation: {
    marginTop: 16, borderRadius: 12, borderWidth: 1, padding: 14,
  },
  explanationLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  explanationText: { fontSize: 13, lineHeight: 20 },
  sourceText: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 10, paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.1)',
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  skipText: { color: '#F59E0B', fontWeight: '700', fontSize: 14 },
  flagBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nextBtn: { borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12 },
  nextBtnText: { fontWeight: '700', fontSize: 15 },
  // Loading
  loadingIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(155,35,53,0.1)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  loadingTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  loadingSubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, marginBottom: 24 },
  progressBar: {
    width: width * 0.5, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden',
  },
  progressFill: { width: '75%', height: '100%', borderRadius: 3 },
  // Toast
  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  toastText: { fontWeight: '700', fontSize: 14 },
  // Result
  resultCard: {
    width: '100%', borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24,
  },
  scoreBadge: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  scoreNumber: { color: '#fff', fontSize: 28, fontWeight: '900' },
  resultTitle: { fontSize: 22, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  resultSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  resultRow: { flexDirection: 'row', gap: 16, width: '100%', justifyContent: 'center' },
  statBox: { alignItems: 'center', minWidth: 60 },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  doneBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 60, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
