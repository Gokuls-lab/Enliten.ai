import { useAuth } from '@/contexts/AuthContext';
import { useExam } from '@/contexts/ExamContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ActivityIndicator } from 'react-native';
import { updateProgress } from '@/lib/progress';
import { useQuizModes } from '@/lib/QuizModes';
import { supabase } from '@/lib/supabase';
import { checkNetwork, getOfflineQuestions, queueOfflineSession } from '@/utils/offlineSync';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, BookOpen, CheckCircle, ChevronLeft, Clock, Crown, Edit, RefreshCcw, RotateCcw, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375; // iPhone 11 Pro width
const guidelineBaseHeight = 812; // iPhone 11 Pro height

export const hs = (size: number) => (width / guidelineBaseWidth) * size;
export const vs = (size: number) => (height / guidelineBaseHeight) * size;
export const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;

interface Subject {
  id: string;
  name: string;
  domain: string; // Added domain field for filtering
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  explanation: string;
  difficulty: string;
  domain: string;
  is_premium: boolean; // Add this line
  options: {
    id: string;
    option_text: string;
    option_letter: string;
    is_correct: boolean;
  }[];
}

export default function QuizScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  // Domain Dropdown
  const [domainOpen, setDomainOpen] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [domainItems, setDomainItems] = useState<{ label: string, value: string }[]>([]);
  // Subject Dropdown
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectItems, setSubjectItems] = useState<{ label: string, value: string }[]>([]);
  const { mode, subject_id } = useLocalSearchParams<{ mode: string, subject_id?: string }>();
  const { user } = useAuth();
  const { isPro: isPremium } = useRevenueCat(); // Renamed to match existing logic

  // Helper to filter query for free users
  const applyPremiumFilter = (query: any) => {
    if (!isPremium) {
      return query.eq('is_premium', false);
    }
    return query;
  };
  const { exam } = useExam();
  const {
    data: rawQuizModes = [],
    isLoading: isQuizModesLoading,
    isError: isQuizModesError,
    error: quizModesError
  } = useQuizModes() as any;
  // Build your own quiz modal state
  const [showBuildQuizModal, setShowBuildQuizModal] = useState(false);
  const [buildQuizStarted, setBuildQuizStarted] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [subjectSearchText, setSubjectSearchText] = useState<string>('');
  const [buildQuizNumQuestions, setBuildQuizNumQuestions] = useState<number>(10);
  const [buildQuizTime, setBuildQuizTime] = useState<number>(600); // default 10 min
  const [isTimedQuiz, setIsTimedQuiz] = useState<boolean>(true); // new: toggle for time limit
  const [buildQuizDifficulty, setBuildQuizDifficulty] = useState<string[]>([]);
  const [availableDomains, setAvailableDomains] = useState<string[]>([]);
  const [domainSearchText, setDomainSearchText] = useState<string>('');
  const [customTimeMode, setCustomTimeMode] = useState(false);

  // ...existing states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

  // Update dropdown items when availableDomains/Subjects change
  useEffect(() => {
    setDomainItems(availableDomains.map(d => ({ label: d, value: d })));
  }, [availableDomains]);
  useEffect(() => {
    setSubjectItems(availableSubjects.map(s => ({ label: s.name, value: s.id, domain: s.domain })));
  }, [availableSubjects]);
  // ...existing hooks
  const insets = useSafeAreaInsets();

  // Fetch available domains for build your own quiz
  useEffect(() => {
    if (mode === 'custom') {
      setShowBuildQuizModal(true);
      setBuildQuizStarted(false);
      setLoading(false);
      
      if (subject_id) {
        setSelectedSubjects([subject_id]);
      }

      const fetchDomains = async () => {
        if (!exam) return;

        // Fetch unique domains directly from questions linked to this exam
        // utilizing the 'exam' column on the questions table.
        const { data: qData, error } = await supabase
          .from('questions')
          .select('domain')
          .eq('exam', exam.id);

        if (error || !qData) {
          console.error('Error fetching domains:', error);
          setAvailableDomains([]);
          return;
        }

        // Extract distinct domains
        const unique = Array.from(new Set(qData.map((q: any) => q.domain)))
          .filter(d => d && typeof d === 'string' && d.trim().length > 0)
          .sort();

        setAvailableDomains(unique);
      };

      fetchDomains();
    }

    // notes_quiz mode: auto-start immediately with subject questions
    if (mode === 'notes_quiz' && subject_id && exam) {
      setShowBuildQuizModal(false);
      setBuildQuizStarted(true);
      setLoading(true);

      const autoStartNotesQuiz = async () => {
        try {
          let query = supabase
            .from('questions')
            .select(`
              id,
              question_text,
              question_type,
              explanation,
              difficulty,
              domain,
              subject_id,
              is_premium,
              question_options(*)
            `)
            .eq('subject_id', subject_id);

          if (exam?.id) {
            query = query.eq('exam', exam.id);
          }

          query = applyPremiumFilter(query).limit(300);

          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) {
            Alert.alert('No Questions', 'No questions available for this subject.');
            setQuestions([]);
            setLoading(false);
            return;
          }

          // Exclude previously correctly answered questions
          let excludeCorrectIds = new Set<string>();
          if (user?.id) {
            const { data: correctData } = await supabase
              .from('user_answers')
              .select('question_id')
              .eq('user_id', user.id)
              .eq('is_correct', true);
            if (correctData) {
              excludeCorrectIds = new Set(correctData.map((a: any) => a.question_id));
            }
          }

          const filtered = (data as any[]).filter(q => !excludeCorrectIds.has(q.id));

          // Shuffle
          for (let i = filtered.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
          }

          const selected = filtered.slice(0, 20); // 20 questions max
          const mappedQuestions = selected.map(q => ({
            ...q,
            question_type: q.question_type || 'multiple_choice',
            is_premium: q.is_premium,
            options: (q.question_options || []).sort((a: any, b: any) =>
              (a.option_letter || '').localeCompare(b.option_letter || '')
            ),
          }));

          setQuestions(mappedQuestions as Question[]);
          setTimeLeft(null); // No timer for notes quiz
        } catch (err) {
          console.error('Error fetching notes quiz questions:', err);
          Alert.alert('Error', 'Could not fetch questions for this subject.');
        }
        setLoading(false);
      };

      autoStartNotesQuiz();
    }
  }, [mode, exam, subject_id]);

  // Handler for starting custom quiz
  const handleStartBuildQuiz = async () => {
    setShowBuildQuizModal(false);
    setLoading(true);
    setBuildQuizStarted(true);

    try {
      let query = supabase
        .from('questions')
        .select(`
          id,
          question_text,
          question_type,
          explanation,
          difficulty,
          domain,
          subject_id,
          question_options(*)
        `); // Restored question_options join

      if (exam?.id) {
        query = query.eq('exam', exam.id);
      }

      if (buildQuizDifficulty && buildQuizDifficulty.length > 0) {
        query = query.in('difficulty', buildQuizDifficulty);
      }
      if (selectedDomains && selectedDomains.length > 0) {
        query = query.in('domain', selectedDomains);
      }
      if (selectedSubjects && selectedSubjects.length > 0) {
        query = query.in('subject_id', selectedSubjects);
      }

      // Fetch a large pool to ensure randomness after shuffling
      query = applyPremiumFilter(query).limit(300);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert('No questions found for your filters.');
        setQuestions([]);
        setTimeLeft(isTimedQuiz ? buildQuizTime : null);
        setLoading(false);
        return;
      }

      // --- Exclusion logic: same as RPC but applied client-side ---
      // 1. Get correctly answered question IDs (never repeat)
      let excludeCorrectIds = new Set<string>();
      if (user?.id) {
        const { data: correctData } = await supabase
          .from('user_answers')
          .select('question_id')
          .eq('user_id', user.id)
          .eq('is_correct', true);
        if (correctData) {
          excludeCorrectIds = new Set(correctData.map((a: any) => a.question_id));
        }
      }

      // 2. Get recently wrong question IDs (cool-down: last 2 sessions)
      let excludeRecentWrongIds = new Set<string>();
      if (user?.id && exam?.id) {
        const { data: recentSessions } = await supabase
          .from('quiz_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('exam_id', exam.id)
          .order('completed_at', { ascending: false })
          .limit(2);
        if (recentSessions && recentSessions.length > 0) {
          const sessionIds = recentSessions.map((s: any) => s.id);
          const { data: recentWrong } = await supabase
            .from('user_answers')
            .select('question_id')
            .in('quiz_session_id', sessionIds)
            .eq('is_correct', false);
          if (recentWrong) {
            excludeRecentWrongIds = new Set(recentWrong.map((a: any) => a.question_id));
          }
        }
      }

      // 3. Filter out excluded questions, then sort: unattempted first
      const attemptedIds = new Set([...excludeCorrectIds, ...excludeRecentWrongIds]);
      const filtered = (data as any[]).filter(q =>
        !excludeCorrectIds.has(q.id) && !excludeRecentWrongIds.has(q.id)
      );

      // Shuffle: unattempted first, then old wrong
      function shuffle(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
      }

      const mappedQuestions = filtered.map(q => ({
        ...q,
        question_type: q.question_type || 'multiple_choice',
        is_premium: q.is_premium,
        options: (q.question_options || []).sort((a: any, b: any) =>
          (a.option_letter || '').localeCompare(b.option_letter || '')
        ),
      }));
      const shuffled = shuffle(mappedQuestions);
      const selected = shuffled.slice(0, buildQuizNumQuestions);
      setQuestions(selected as Question[]);
      setTimeLeft(isTimedQuiz ? buildQuizTime : null);
    } catch (err) {
      Alert.alert('Error', 'Could not fetch questions for your quiz.');
    }
    setLoading(false);
  };





  const fetchQuestions = useCallback(async () => {
    if (mode === 'custom' || mode === 'notes_quiz') return; // handled separately
    if (!exam) return;
    setLoading(true);

    const isConnected = await checkNetwork();

    try {
      let questionCount = 10; // Default for quick_10
      if (mode === 'quick_10') {
        questionCount = rawQuizModes?.find((item: { id: string; title: string }) => item.id === mode)?.num_questions;
      }


      if (mode === 'timed') {
        questionCount = rawQuizModes?.find((item: { id: string; title: string }) => item.id === mode)?.num_questions;
      }
      if (mode === 'missed') {
        questionCount = rawQuizModes?.find((item: { id: string; title: string }) => item.id === mode)?.num_questions;
      }
      if (mode === 'weakest_subject') {
        questionCount = rawQuizModes?.find((item: { id: string; title: string }) => item.id === mode)?.num_questions;
      }

      questionCount = questionCount || 10;

      // Handle offline mode by loading cached questions (quick fallback)
      if (!isConnected) {
        if (mode === 'quick_10' || mode === 'timed') {
          const cachedQs = await getOfflineQuestions(questionCount);
          if (cachedQs.length > 0) {
            setQuestions(cachedQs as Question[]);
            setLoading(false);
            return;
          } else {
            Alert.alert('Offline', 'No offline questions available. Please connect to the internet.');
            router.back();
            setLoading(false);
            return;
          }
        } else {
          Alert.alert('Offline', `The mode '${mode}' requires an active internet connection.`);
          router.back();
          setLoading(false);
          return;
        }
      }

      if (mode === 'weakest_subject') {
        if (!user || !user.id) throw new Error('User not found');
        const sessions = await supabase
          .from('quiz_sessions')
          .select('id')
          .eq('user_id', user.id);
        console.log('sessions: ', sessions);
        if (!sessions.data || sessions.data.length === 0) {
          Alert.alert('No Weakest Subject', 'Could not determine your weakest subject. Have you answered any questions yet?');
          router.back();
          return;
        }

        const { data: weakestSubject, error: weakestSubjectError } = await supabase
          .rpc('get_weakest_domain', { user_id_param: user.id, exam_id_param: exam.id });

        if (weakestSubjectError) throw weakestSubjectError;
        if (!weakestSubject || weakestSubject.length === 0) {
          Alert.alert('No Weakest Domain', 'Could not determine your weakest domain. Have you answered any questions yet?');
          router.back();
          return;
        }

        const domain = weakestSubject[0].domain;

        // Use the same RPC as other modes (handles correct exclusion + cool-down)
        // Fetch a larger pool, then filter by domain client-side
        const { data, error } = await supabase
          .rpc('fetch_mode_questions', {
            p_exam_id: exam.id,
            p_limit_count: questionCount * 3, // fetch more to filter by domain
            p_user_id: user.id,
            p_quiz_mode: mode,
            p_is_premium: isPremium
          })
          .select(`
            id,
            question_text,
            question_type,
            explanation,
            difficulty,
            domain,
            question_options (
              id,
              option_text,
              option_letter,
              is_correct
            ),
            is_premium
          `);

        if (error) throw error;

        // Filter by weakest domain and limit to requested count
        const domainFiltered = (data as any[] || [])
          .filter((q: any) => q.domain === domain)
          .slice(0, questionCount);

        if (domainFiltered.length === 0) {
          Alert.alert('No Questions', `No unattempted questions available for domain: ${domain}`);
          router.back();
          return;
        }

        setQuestions(
          domainFiltered.map((q: any) => ({
            ...q,
            options: (q.question_options || []).sort((a: any, b: any) =>
              (a.option_letter || '').localeCompare(b.option_letter || '')
            ),
          })) as Question[]
        );
        setLoading(false);
        return;
      }

      if (mode === 'missed') {
        // Get user's missed (incorrect) questions for this exam
        // Use the SAME logic as the Review page to ensure counts match exactly
        if (!user || !user.id) throw new Error('User not found');

        // 1. Get quiz sessions for this user AND this exam (capped at 50, matching Review page)
        const { data: sessions, error: sessionError } = await supabase
          .from('quiz_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('exam_id', exam.id)
          .order('completed_at', { ascending: false })
          .limit(50);
        if (sessionError) throw sessionError;

        if (!sessions || sessions.length === 0) {
          Alert.alert('No Missed Questions', 'You have not completed any quizzes yet.');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }

        const sessionIds = sessions.map((s: any) => s.id);

        // 2. Get all answers from these exam-scoped sessions, ordered by most recent first
        const { data: allAnswers, error: allAnswersError } = await supabase
          .from('user_answers')
          .select('question_id, is_correct, answered_at')
          .in('quiz_session_id', sessionIds)
          .order('answered_at', { ascending: false });
        if (allAnswersError) throw allAnswersError;

        if (!allAnswers || allAnswers.length === 0) {
          Alert.alert('No Missed Questions', 'You have not answered any questions yet.');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }

        // 3. For each question_id, keep only the latest answer (already sorted desc)
        const latestByQuestion = new Map();
        for (const ans of allAnswers) {
          if (!latestByQuestion.has(ans.question_id)) {
            latestByQuestion.set(ans.question_id, ans);
          }
        }

        // 4. Only include questions where the LATEST answer is incorrect
        const missedQuestionIds = Array.from(latestByQuestion.values())
          .filter(ans => ans.is_correct === false)
          .map(ans => ans.question_id);

        if (missedQuestionIds.length === 0) {
          Alert.alert('No Missed Questions', 'You have no currently missed questions!');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }

        // 5. Fetch the missed questions by their IDs (capped at 50)
        //    NO .eq('exam', exam.id) filter needed here — the question IDs already
        //    came from sessions scoped to this exam. Adding that filter would drop
        //    questions where questions.exam is NULL, causing a count mismatch with
        //    the Review page which counts directly from user_answers.
        let missedQuery = supabase
          .from('questions')
          .select(`
            id,
            question_text,
            question_type,
            explanation,
            difficulty,
            domain,
            subject_id,
            question_options (
              id,
              option_text,
              option_letter,
              is_correct
            )
          `)
          .in('id', missedQuestionIds);

        if (!isPremium) {
          missedQuery = missedQuery.eq('is_premium', false);
        }

        const { data, error } = await missedQuery.limit(50);
        if (error) throw error;
        if (!data || data.length === 0) {
          Alert.alert('No Missed Questions', 'You have not answered any questions incorrectly yet.');
          router.back();
          setQuestions([]);
          setLoading(false);
          return;
        }
        const formattedQuestions = data.map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type || 'multiple_choice',
          explanation: q.explanation,
          difficulty: q.difficulty,
          domain: q.domain,
          is_premium: q.is_premium,
          options: q.question_options.sort((a: any, b: any) =>
            a.option_letter.localeCompare(b.option_letter)
          ),
        }));
        setQuestions(formattedQuestions);
        setLoading(false);
        return;
      }

      // Default: fetch questions for selected exam's subjects
      // Defensive check for exam and exam.id
      if (!exam || !exam.id) {
        throw new Error('Exam is not defined or missing id');
      }
      // Get ALL subject_ids for the selected exam
      const { data: subjectExams, error: subjectExamError } = await supabase
        .from('subject_exams')
        .select('subject_id')
        .eq('exam_id', exam.id);
      if (subjectExamError) throw subjectExamError;
      if (!subjectExams || subjectExams.length === 0) throw new Error('No subjects found for this exam');
      const subjectIds = subjectExams.map(se => se.subject_id);

      // Now, fetch questions for all those subjects
      // const { data, error } = await supabase
      //   .from('questions')
      //   .select(`
      //     id,
      //     question_text,
      //     explanation,
      //     difficulty,
      //     domain,
      //     question_options (
      //       id,
      //       option_text,
      //       option_letter,
      //       is_correct
      //     )
      //   `)
      //   .in('subject_id', subjectIds)
      //   .limit(questionCount);
      // if (error) throw error;

      //[START] => Manual random
      // const { data, error } = await supabase
      //   .from('questions')
      //   .select(`
      //     id,
      //     question_text,
      //     explanation,
      //     difficulty,
      //     domain,
      //     question_options (
      //       id,
      //       option_text,
      //       option_letter,
      //       is_correct
      //     )
      //   `)
      //   // .in('subject_id', subjectIds)
      //   .eq('exam',exam.id)
      //   .limit(questionCount);


      // if (error) throw error;

      // // Shuffle the data manually
      // const shuffled = data.sort(() => Math.random() - 0.5).slice(0, questionCount);

      // const formattedQuestions = shuffled.map((q: any) => ({
      //   id: q.id,
      //   question_text: q.question_text,
      //   explanation: q.explanation,
      //   difficulty: q.difficulty,
      //   domain: q.domain,
      //   options: q.question_options.sort((a: any, b: any) => 
      //     a.option_letter.localeCompare(b.option_letter)
      //   ),
      // }));
      //[END] => Manual random
      const { data, error } = await supabase
        .rpc('fetch_mode_questions', {
          p_exam_id: exam.id,
          p_limit_count: questionCount,
          p_user_id: user?.id,
          p_quiz_mode: mode,
          p_is_premium: isPremium
        })
        .select(`
            id,
            question_text,
            question_type,
            explanation,
            difficulty,
            domain,
            question_options (
              id,
              option_text,
              option_letter,
              is_correct
            ),
            is_premium
          `);

      if (error) throw error;

      let filteredData = (data as any[]) || [];
      // Filtering is now handled by the RPC, so no need for client-side filtering.

      const formattedQuestions = filteredData.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type || 'multiple_choice',
        explanation: q.explanation,
        difficulty: q.difficulty,
        domain: q.domain,
        is_premium: q.is_premium,
        options: q.question_options.sort((a: any, b: any) =>
          a.option_letter.localeCompare(b.option_letter)
        )
      }));

      setQuestions(formattedQuestions);
    } catch (err) {
      console.error('Error fetching questions:', err);
      Alert.alert('Error', 'Failed to load quiz questions');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [mode, user, exam]);

  // Fetch questions on component mount
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Set timer based on the number of fetched questions for timed quizzes
  useEffect(() => {
    if (mode === 'timed' && questions.length > 0 && rawQuizModes && rawQuizModes.length > 0) {
      const timePerQuestion = Number(rawQuizModes.find((item: { id: string; title: string }) => item.id === mode)?.time_per_question);
      if (timePerQuestion && !isNaN(timePerQuestion)) {
        setTimeLeft(questions.length * timePerQuestion);
      }
    }
  }, [questions, rawQuizModes, mode]);

  // Timer effect for timed quizzes
  useEffect(() => {
    if (timeLeft === null || quizCompleted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          handleQuizComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, quizCompleted]);

  const handleAnswerSelect = (optionId: string) => {
    setSelectedAnswer(optionId);
  };

  const handleNextQuestion = () => {
    if (!selectedAnswer) return;

    // Save the answer
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: selectedAnswer
    }));

    setShowResult(true);
  };

  const handleContinue = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      handleQuizComplete();
    }
  };

  const handleQuizComplete = async () => {
    if (quizCompleted || !user) {
      if (!user) {
        Alert.alert("Not Logged In", "You must be logged in to save quiz results.");
        router.back();
      }
      return;
    }
    setQuizCompleted(true);

    try {
      // Calculate score
      let correctAnswers = 0;
      const sessionAnswers = [];
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const userAnswerId = userAnswers[i];
        const correctOption = question.options.find(opt => opt.is_correct);
        const isCorrect = userAnswerId === correctOption?.id;
        if (isCorrect) correctAnswers++;
        sessionAnswers.push({
          question_id: question.id,
          selected_option_id: userAnswerId,
          is_correct: isCorrect,
        });
      }
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);

      const quizTypeMap: Record<string, string> = {
        weakest_subject: 'weakest',
        quick_10: 'quick_10',
        timed: 'timed',
        level_up: 'level_up',
        missed: 'missed',
        custom: 'custom',
        notes_quiz: 'notes_quiz',
        daily: 'daily',
        weakest: 'weakest',
      };
      const quizType = quizTypeMap[mode] || mode;

      const sessionObj = {
        user_id: user.id,
        quiz_type: quizType,
        score: correctAnswers,
        total_questions: questions.length,
        time_taken_seconds: timeTaken,
        completed_at: new Date().toISOString(),
        exam_id: exam?.id,
      };

      const isConnected = await checkNetwork();
      if (!isConnected) {
        // Offline queuing
        await queueOfflineSession(sessionObj, sessionAnswers.map(ans => ({ ...ans, user_id: user.id })));
        router.replace(`/results?session=offline-${Date.now()}`);
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('quiz_sessions')
        .insert(sessionObj)
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      if (!sessionData) throw new Error("Failed to create session and get ID.");

      const newSessionId = sessionData.id;

      // Save individual answers
      const answersToInsert = sessionAnswers.map(answer => ({
        ...answer,
        user_id: user.id,
        quiz_session_id: newSessionId,
      }));
      const { error: answersError } = await supabase
        .from('user_answers')
        .insert(answersToInsert);
      if (answersError) throw answersError;

      // Update user progress
      await updateProgress(user.id, {
        questionsAnswered: questions.length,
        correctAnswers,
        timeTaken,
      });

      // Navigate to results
      router.replace(`/results?session=${newSessionId}`);
    } catch (err) {
      console.error('Error completing quiz:', err);
      Alert.alert('Error', 'Failed to save quiz results');
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getQuizTitle = () => {
    const currentMode = rawQuizModes?.find((item: { id: string; title: string }) => item.id === mode);
    return currentMode?.title || 'Quiz';
  };

  const renderPremiumBanner = () => {
    if (isPremium) return null;
    return (
      <View style={styles.premiumBanner}>
        <Icon name="star" size={20} color="#FFD700" />
        <Text style={styles.premiumBannerText}>
          Free Plan: Access limited to free questions.
        </Text>
        <TouchableOpacity style={styles.upgradeButtonSmall} onPress={() => router.push('/subscription')}>
          <Text style={styles.upgradeButtonTextSmall}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleResetProgress = async () => {
    if (!user || (!exam && mode !== 'weakest_subject')) return; // Allow reset for weakest_subject if needed or handle general reset

    Alert.alert(
      "Reset Progress",
      "This will reset your question history for this exam, allowing you to see all questions again. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            // Handle modes that might not have exam.id appropriately, but mainly for exam modes
            if (!exam?.id) {
              // Fallback or specific logic for non-exam modes if any
              return;
            }

            setLoading(true);
            try {
              // Get all session IDs for this user and exam to delete relationships
              const { data: sessions, error: sessionError } = await supabase
                .from('quiz_sessions')
                .select('id')
                .eq('user_id', user.id)
                .eq('exam_id', exam.id);

              if (sessionError) throw sessionError;

              const sessionIds = (sessions || []).map(s => s.id);

              if (sessionIds.length > 0) {
                // Delete user_answers
                const { error: ansError } = await supabase
                  .from('user_answers')
                  .delete()
                  .in('quiz_session_id', sessionIds);
                if (ansError) throw ansError;

                // Delete quiz_sessions
                const { error: delError } = await supabase
                  .from('quiz_sessions')
                  .delete()
                  .in('id', sessionIds);
                if (delError) throw delError;
              }

              Alert.alert("Success", "Progress reset successfully.");
              fetchQuestions();
            } catch (err) {
              console.error("Error resetting progress:", err);
              Alert.alert("Error", "Failed to reset progress.");
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // --- Custom Quiz Modal ---
  if (mode === 'custom' && showBuildQuizModal && !buildQuizStarted) {
    // Filter domains based on search text
    const filteredAvailableDomains = availableDomains.filter(d =>
      d.toLowerCase().includes(domainSearchText.toLowerCase())
    );

    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.safeArea}>
          <View style={styles.buildQuizHeader}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.buildQuizTitle}>Custom Quiz</Text>
            <View style={{ width: 40 }} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              style={styles.buildQuizScroll}
              contentContainerStyle={styles.buildQuizContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Domain Selection */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Select Domains</Text>
                <Text style={styles.sectionSubLabel}>Choose domains to include in your quiz</Text>

                <View style={styles.searchContainer}>
                  <Icon name="search" size={20} color="#94A3B8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search domains..."
                    placeholderTextColor="#64748B"
                    value={domainSearchText}
                    onChangeText={setDomainSearchText}
                  />
                  {domainSearchText.length > 0 && (
                    <TouchableOpacity onPress={() => setDomainSearchText('')}>
                      <Icon name="close" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Scrollable Chip Container with fixed height for UX */}
                <View style={{ height: vs(240), backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                  <ScrollView
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{ padding: 12 }}
                    keyboardShouldPersistTaps="handled"
                    persistentScrollbar={true} // Android
                  >
                    <View style={styles.chipContainer}>
                      {filteredAvailableDomains.length > 0 ? (
                        filteredAvailableDomains.map(domain => {
                          const isSelected = selectedDomains.includes(domain);
                          return (
                            <TouchableOpacity
                              key={domain}
                              style={[
                                styles.domainChip,
                                isSelected && styles.domainChipSelected
                              ]}
                              onPress={() => {
                                setSelectedDomains(prev =>
                                  prev.includes(domain)
                                    ? prev.filter(d => d !== domain)
                                    : [...prev, domain]
                                );
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[
                                styles.domainChipText,
                                isSelected && styles.domainChipTextSelected
                              ]}>
                                {domain}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={styles.emptyText}>No topics found.</Text>
                      )}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* 2. Difficulty */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionLabel}>Difficulty Level</Text>
                <View style={styles.difficultyRow}>
                  {['easy', 'medium', 'hard'].map((diff) => {
                    const isSelected = Array.isArray(buildQuizDifficulty)
                      ? buildQuizDifficulty.includes(diff)
                      : buildQuizDifficulty === diff;

                    let diffColor = '#10B981'; // Easy
                    if (diff === 'medium') diffColor = '#8A2BE2';
                    if (diff === 'hard') diffColor = '#EF4444';

                    return (
                      <TouchableOpacity
                        key={diff}
                        style={[
                          styles.difficultyCard,
                          isSelected && { borderColor: diffColor, backgroundColor: `${diffColor}15` }
                        ]}
                        onPress={() => {
                          setBuildQuizDifficulty(prev => {
                            if (!Array.isArray(prev)) return [diff];
                            return prev.includes(diff)
                              ? prev.filter(d => d !== diff)
                              : [...prev, diff];
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.difficultyOptionText,
                          { color: isSelected ? diffColor : '#94A3B8' }
                        ]}>
                          {diff.charAt(0).toUpperCase() + diff.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 3. Question Count */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>Number of Questions</Text>
                  <Text style={styles.highlightValue}>{buildQuizNumQuestions}</Text>
                </View>

                <View style={styles.stepperContainer}>
                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setBuildQuizNumQuestions(Math.max(5, buildQuizNumQuestions - 5))}
                  >
                    <Icon name="remove" size={24} color={colors.text} />
                  </TouchableOpacity>

                  <View style={styles.stepperValueContainer}>
                    <Text style={styles.stepperValue}>{buildQuizNumQuestions}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperButton}
                    onPress={() => setBuildQuizNumQuestions(Math.min(50, buildQuizNumQuestions + 5))}
                  >
                    <Icon name="add" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.helperText}>Max 50 questions</Text>
              </View>

              {/* 4. Timer Settings */}
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>Timed Quiz</Text>
                  <Switch
                    trackColor={{ false: '#334155', true: '#8A2BE2' }}
                    thumbColor={'#F8FAFC'}
                    onValueChange={(val) => {
                      setIsTimedQuiz(val);
                      if (!val) setCustomTimeMode(false); // Reset custom mode if disabled
                    }}
                    value={isTimedQuiz}
                  />
                </View>

                {isTimedQuiz && (
                  <View>
                    <View style={styles.timePresetsContainer}>
                      {[10, 20, 30, 60].map(mins => {
                        const seconds = mins * 60;
                        const isSelected = !customTimeMode && buildQuizTime === seconds;
                        return (
                          <TouchableOpacity
                            key={mins}
                            style={[
                              styles.timePresetChip,
                              isSelected && styles.timePresetChipSelected
                            ]}
                            onPress={() => {
                              setCustomTimeMode(false);
                              setBuildQuizTime(seconds);
                            }}
                          >
                            <Clock size={14} color={isSelected ? '#0F172A' : '#94A3B8'} />
                            <Text style={[
                              styles.timePresetText,
                              isSelected && styles.timePresetTextSelected
                            ]}>
                              {mins}m
                            </Text>
                          </TouchableOpacity>
                        )
                      })}

                      {/* Custom Time Chip */}
                      <TouchableOpacity
                        style={[
                          styles.timePresetChip,
                          customTimeMode && styles.timePresetChipSelected
                        ]}
                        onPress={() => {
                          setCustomTimeMode(true);
                        }}
                      >
                        <Edit size={14} color={customTimeMode ? '#0F172A' : '#94A3B8'} />
                        <Text style={[
                          styles.timePresetText,
                          customTimeMode && styles.timePresetTextSelected
                        ]}>
                          Custom
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Custom Time Input */}
                    {customTimeMode && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#94A3B8', marginBottom: 6, fontSize: ms(12) }}>Enter time in minutes:</Text>
                        <TextInput
                          style={styles.inputBox}
                          keyboardType="numeric"
                          value={Math.floor(buildQuizTime / 60).toString()}
                          onChangeText={(val) => {
                            const v = parseInt(val.replace(/[^0-9]/g, ''), 10);
                            setBuildQuizTime(isNaN(v) ? 0 : v * 60);
                          }}
                          placeholder="e.g. 45"
                          placeholderTextColor="#64748B"
                          maxLength={3}
                          returnKeyType="done"
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={{ height: 100 }} />
            </ScrollView>

            {/* Sticky Start Button */}
            <View style={styles.footerAction}>
              <TouchableOpacity
                style={{ ...styles.startQuizButtonLarge, marginBottom: insets.bottom }}
                onPress={handleStartBuildQuiz}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8A2BE2', '#D97706']}
                  style={styles.startQuizGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.startQuizTextLarge}>Start Quiz</Text>
                  {/* <Icon name="arrow-forward" size={24} color="#0F172A" /> */}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.safeArea, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading quiz...</Text>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (questions.length === 0) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
        <View style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.headerTitle}>{getQuizTitle()}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: hs(24), paddingBottom: vs(40) }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ marginBottom: vs(24), position: 'relative', marginTop: vs(20) }}>
              <BookOpen size={ms(64)} color={colors.primary} strokeWidth={1.5} />
              <View style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: colors.background, borderRadius: 50, padding: 2 }}>
                <AlertCircle size={ms(24)} color="#EF4444" fill={colors.background} />
              </View>
            </View>

            <Text style={[styles.noQuestionsText, { color: colors.text, marginBottom: vs(8) }]}>No Questions Available</Text>
            <Text style={[styles.noQuestionsSubText, { color: colors.subText, marginBottom: vs(32) }]}>
              {mode === 'missed'
                ? "You haven't answered any questions incorrectly yet!"
                : "You've answered all available questions for this mode."}
            </Text>

            {/* Reset Option */}
            {mode !== 'missed' && (
              <TouchableOpacity
                style={{
                  width: '100%',
                  paddingVertical: vs(14),
                  paddingHorizontal: hs(20),
                  borderRadius: ms(12),
                  borderWidth: 1,
                  borderColor: colors.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: hs(8),
                  backgroundColor: 'transparent',
                  marginBottom: vs(24)
                }}
                onPress={handleResetProgress}
              >
                <RefreshCcw size={ms(20)} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: ms(16), fontWeight: '600' }}>Reset Exam Progress</Text>
              </TouchableOpacity>
            )}

            {!isPremium && (
              <View style={{
                width: '100%',
                backgroundColor: colors.card,
                borderRadius: ms(16),
                padding: hs(20),
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: vs(24),
                // Premium gold tint
                shadowColor: "#FFD700",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: vs(8), gap: hs(8) }}>
                  <Crown size={ms(20)} color="#FFD700" fill="#FFD700" />
                  <Text style={{ fontSize: ms(16), fontWeight: '700', color: colors.text }}>Go Premium</Text>
                </View>
                <Text style={{ fontSize: ms(14), color: colors.subText, textAlign: 'center', lineHeight: ms(20), marginBottom: vs(16) }}>
                  Upgrade to unlock unlimited questions and practice without limits.
                </Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#FFD700',
                    width: '100%',
                    paddingVertical: vs(12),
                    borderRadius: ms(10),
                    alignItems: 'center',
                  }}
                  onPress={() => router.push('/subscription')}
                >
                  <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: ms(14), textTransform: 'uppercase' }}>Unlock Now</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: hs(8), padding: hs(12) }}
              onPress={fetchQuestions}
            >
              <RotateCcw size={ms(18)} color={colors.subText} />
              <Text style={{ fontSize: ms(16), color: colors.subText, fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </LinearGradient>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.title}>{getQuizTitle()}</Text>
          {timeLeft !== null && (
            <View style={styles.timerContainer}>
              <Clock size={16} color="#8A2BE2" strokeWidth={2} />
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
            </View>
          )}
        </View>

        {renderPremiumBanner()}

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {currentQuestionIndex + 1} of {questions.length}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Question */}
          <View style={styles.questionContainer}>
            <View style={styles.questionHeader}>
              <View style={styles.questionMeta}>
                {/* Use !! to force a boolean check, or check for true explicitly */}
                {currentQuestion.is_premium === true && (
                  <View style={styles.premiumBadge}>
                    <Icon name="star" size={12} color="#0F172A" />
                    <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                  </View>
                )}
                {/* 
                <Text style={styles.difficultyText}>{currentQuestion.difficulty}</Text>
                <Text style={styles.domainText}>{currentQuestion.domain}</Text>
                */}
              </View>
            </View>
            <Text style={styles.questionText}>{currentQuestion.question_text}</Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  selectedAnswer === option.id && styles.selectedOption,
                  showResult && option.is_correct && styles.correctOption,
                  showResult && selectedAnswer === option.id && !option.is_correct && styles.incorrectOption,
                ]}
                onPress={() => handleAnswerSelect(option.id)}
                disabled={showResult}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionLetter}>{option.option_letter}.</Text>
                  <Text style={styles.optionText}>{option.option_text}</Text>
                </View>
                {showResult && option.is_correct && (
                  <CheckCircle size={20} color="#10B981" strokeWidth={2} />
                )}
                {showResult && selectedAnswer === option.id && !option.is_correct && (
                  <X size={20} color="#EF4444" strokeWidth={2} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Explanation */}
          {showResult && (
            <View style={styles.explanationContainer}>
              <Text style={styles.explanationTitle}>Explanation</Text>
              <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Button */}
        <View style={[styles.actionContainer, { height: 'auto', justifyContent: 'flex-end' }]}>
          {!showResult ? (
            <TouchableOpacity
              style={[styles.actionButton, !selectedAnswer && styles.actionButtonDisabled]}
              onPress={handleNextQuestion}
              disabled={!selectedAnswer}
            >
              <Text style={styles.actionButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={handleContinue}>
              <Text style={styles.actionButtonText}>
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Complete Quiz'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  centeredModalWrapper: {
    width: '96%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: hs(16),
    marginTop: vs(36),
    marginBottom: vs(10),
  },
  modalContainerCompact: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: ms(14),
    gap: hs(10),
    paddingVertical: vs(8),
    paddingHorizontal: hs(2),
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingBottom: vs(16),
  },
  modalTitleStrong: {
    fontSize: ms(20),
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: vs(16),
    textAlign: 'center',
  },
  modalContentContainer: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  subjectSearchBox: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    fontSize: ms(15),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: vs(8),
    paddingHorizontal: hs(12),
    borderRadius: ms(8),
    marginBottom: vs(4),
    backgroundColor: colors.inputBg,
  },
  subjectListItemSelected: {
    backgroundColor: colors.secondary, // was 0EA5E9
  },
  subjectListItemText: {
    color: colors.text,
    fontSize: ms(15),
    flex: 1,
  },
  subjectListItemCheck: {
    color: colors.secondary, // was 22D3EE
    fontWeight: 'bold',
    fontSize: ms(16),
    marginLeft: hs(8),
  },
  selectedCountText: {
    color: colors.secondary, // was 38BDF8
    fontSize: ms(13),
    marginTop: vs(4),
    textAlign: 'right',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(10),
  },
  inputLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: ms(14),
    marginRight: hs(8),
  },
  inputBox: {
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(12),
    fontSize: ms(15),
    minWidth: hs(60),
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12, // merged from second definition
  },
  modalContainer: {
    flex: 1,
    padding: hs(20),
    borderRadius: ms(16),
    gap: hs(15),
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  modalTitle: {
    color: colors.text,
    fontSize: ms(22),
    fontWeight: '700',
    marginBottom: vs(16),
    textAlign: 'center',
  },
  modalLabel: {
    color: colors.primary,
    fontSize: ms(15),
    fontWeight: '600',
    marginTop: vs(12),
    marginBottom: vs(6),
  },
  subjectList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: hs(8),
    marginBottom: vs(10),
  },
  subjectButton: {
    backgroundColor: colors.inputBg,
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(14),
    marginRight: hs(8),
    marginBottom: vs(8),
    borderWidth: 1,
    borderColor: colors.border,
  },
  subjectButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subjectButtonText: {
    color: '#FFF', // Always white on primary
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: hs(12),
    marginBottom: vs(10),
  },
  modalOptionButton: {
    backgroundColor: colors.inputBg,
    borderRadius: ms(8),
    paddingVertical: vs(6),
    paddingHorizontal: hs(16),
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: ms(15),
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingTop: vs(25),
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: hs(20),
  },
  noQuestionsText: {
    fontSize: ms(20),
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  noQuestionsSubText: {
    fontSize: ms(16),
    color: colors.subText,
    marginTop: vs(8),
    textAlign: 'center',
  },
  noContentCard: {
    backgroundColor: colors.card,
    borderRadius: ms(24),
    padding: hs(32),
    alignItems: 'center',
    width: '90%',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  noContentIconContainer: {
    width: ms(80),
    height: ms(80),
    backgroundColor: colors.inputBg,
    borderRadius: ms(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: vs(24),
    borderWidth: 1,
    borderColor: colors.border,
  },
  noContentIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: vs(16),
    paddingHorizontal: hs(24),
    borderRadius: ms(16),
    gap: hs(8),
    marginTop: vs(20),
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    fontWeight: '700',
  },
  inlinePremiumCard: {
    marginTop: vs(24),
    width: '100%',
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: ms(16),
    padding: hs(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hs(8),
    marginBottom: vs(8),
  },
  premiumHeaderText: {
    color: '#FFD700',
    fontWeight: '700',
    fontSize: ms(16),
  },
  premiumDescText: {
    color: colors.subText,
    fontSize: ms(13),
    textAlign: 'center',
    marginBottom: vs(16),
    lineHeight: ms(20),
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    paddingVertical: vs(12),
    borderRadius: ms(12),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: ms(14),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skipButtonSecondary: {
    backgroundColor: 'transparent',
    marginTop: vs(10),
    paddingVertical: vs(12),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: hs(26),
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    flex: 1,
    fontSize: ms(20),
    fontWeight: '700',
    color: colors.text,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: hs(12),
    paddingVertical: vs(6),
    borderRadius: ms(8),
    gap: hs(6),
  },
  timerText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: colors.primary,
  },
  progressContainer: {
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
  },
  progressBar: {
    height: vs(4),
    backgroundColor: colors.border,
    borderRadius: ms(2),
    marginBottom: vs(8),
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: ms(2),
  },
  progressText: {
    fontSize: ms(14),
    color: colors.subText,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: hs(20),
  },
  questionContainer: {
    marginBottom: vs(24),
  },
  questionHeader: {
    marginBottom: vs(16),
  },
  questionMeta: {
    flexDirection: 'row',
    gap: hs(12),
  },
  difficultyText: {
    fontSize: ms(12),
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: colors.card,
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  domainText: {
    fontSize: ms(12),
    color: colors.subText,
    backgroundColor: colors.inputBg,
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
  },
  questionText: {
    fontSize: ms(18),
    color: colors.text,
    lineHeight: ms(26),
  },
  optionsContainer: {
    gap: hs(12),
    marginBottom: vs(24),
  },
  optionButton: {
    backgroundColor: colors.inputBg,
    borderRadius: ms(12),
    padding: hs(16),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: {
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  correctOption: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)', // translucent green
  },
  incorrectOption: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // translucent red
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLetter: {
    fontSize: ms(16),
    fontWeight: '700',
    color: colors.primary,
    marginRight: hs(12),
    minWidth: hs(20),
  },
  optionText: {
    fontSize: ms(16),
    color: colors.text,
    flex: 1,
  },
  explanationContainer: {
    backgroundColor: colors.card,
    borderRadius: ms(12),
    padding: hs(16),
    marginBottom: vs(24),
  },
  explanationTitle: {
    fontSize: ms(16),
    fontWeight: '700',
    color: colors.text,
    marginBottom: vs(8),
  },
  explanationText: {
    textAlign: 'left',
    fontSize: ms(14),
    color: colors.subText,
    lineHeight: ms(20),
  },
  actionContainer: {
    padding: hs(20),
    paddingBottom: vs(20), // Adjusted for safe area if needed
    backgroundColor: colors.card, // Match card/background
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    backgroundColor: colors.primary,
    padding: hs(16),
    borderRadius: ms(12),
    alignItems: 'center',
    marginBottom: hs(10)
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: ms(16),
    fontWeight: '600',
    color: '#FFFFFF', // White text on primary
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingVertical: vs(8),
    paddingHorizontal: hs(12),
    marginHorizontal: hs(16),
    marginBottom: vs(8),
    marginTop: vs(8),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  premiumBannerText: {
    color: "#F59E0B",
    fontSize: ms(12),
    flex: 1,
    marginLeft: 8,
    fontWeight: '500',
  },
  upgradeButtonSmall: {
    backgroundColor: "#F59E0B",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  upgradeButtonTextSmall: {
    color: 'white',
    fontSize: ms(10),
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: ms(18),
    fontWeight: 'bold',
    color: colors.text,
  },
  buildQuizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hs(20),
    paddingVertical: vs(16),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  buildQuizTitle: {
    fontSize: ms(20),
    fontWeight: '700',
    color: colors.text,
  },
  buildQuizScroll: {
    flex: 1,
  },
  buildQuizContent: {
    padding: hs(20),
  },
  sectionContainer: {
    marginBottom: vs(24),
  },
  sectionLabel: {
    fontSize: ms(16),
    fontWeight: '600',
    color: colors.text,
    marginBottom: vs(4),
  },
  sectionSubLabel: {
    fontSize: ms(13),
    color: colors.subText,
    marginBottom: vs(12),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: vs(12),
  },
  highlightValue: {
    fontSize: ms(16),
    color: colors.primary,
    fontWeight: '700',
  },
  helperText: {
    fontSize: ms(12),
    color: colors.subText,
    marginTop: vs(8),
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: vs(16),
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: ms(14),
    padding: 0,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  domainChip: {
    backgroundColor: colors.inputBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  domainChipSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  domainChipText: {
    color: colors.subText,
    fontSize: ms(13),
  },
  domainChipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  difficultyCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  difficultyOptionText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: colors.subText,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 6,
  },
  stepperButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
  },
  stepperValueContainer: {
    flex: 1,
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: ms(20),
    fontWeight: '700',
    color: colors.text,
  },
  timePresetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  timePresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePresetChipSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  timePresetText: {
    color: colors.subText,
    fontSize: ms(13),
    fontWeight: '500',
  },
  timePresetTextSelected: {
    color: colors.primary,
  },
  footerAction: {
    justifyContent: 'flex-end',
    height: 'auto',
    padding: hs(20),
    paddingBottom: vs(30),
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startQuizButtonLarge: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  startQuizGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  startQuizTextLarge: {
    color: '#0F172A',
    fontSize: ms(18),
    fontWeight: '700',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: hs(8),
    paddingVertical: vs(4),
    borderRadius: ms(6),
    gap: hs(4),
  },
  premiumBadgeText: {
    fontSize: ms(10),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: ms(16),
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: hs(20),
  },
  emptyText: {
    fontSize: ms(18),
    color: colors.subText,
    marginBottom: vs(20),
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.text,
    fontWeight: '600',
  },
});