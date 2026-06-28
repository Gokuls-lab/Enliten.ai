import { apiFetch } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Phone,
  PhoneCall,
  Sparkles,
  Upload,
  UserRound,
  X,
  Zap,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-native-markdown-display';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type InterviewProfile = {
  user_id: string;
  resume_storage_path?: string | null;
  resume_file_name?: string | null;
  resume_source_mime_type?: string | null;
  resume_markdown_char_count?: number | null;
  updated_at?: string | null;
};

type InterviewSession = {
  id: string;
  phone_number: string;
  candidate_name?: string | null;
  status: string;
  resume_used?: boolean;
  created_at: string;
  call_summary_title?: string | null;
  transcript_summary?: string | null;
  duration_secs?: number | null;
  elevenlabs_conversation_id?: string | null;
  performance_summary?: {
    performance?: Array<{
      id: string;
      label: string;
      score: number | null;
      feedback?: string;
    }>;
    transcript?: Array<{
      role: 'agent' | 'user';
      persona: string;
      message: string;
      time_in_call_secs?: number | null;
    }>;
    transcript_summary?: string | null;
    call_summary_title?: string | null;
    status?: string | null;
    call_duration_secs?: number | null;
  } | null;
};

function formatRelativeDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDuration(seconds?: number | null) {
  if (!seconds) return '0m';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

function stripEmotionTags(text: string): string {
  return text
    .replace(/\[[a-zA-Z\s]+\]/g, '')   // Remove [emotion] tags
    .replace(/<[A-Za-z][A-Za-z\s]*>/g, '') // Remove <Persona> tags
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMessageTime(createdAt: string, timeInCallSecs?: number | null): string {
  if (timeInCallSecs === null || timeInCallSecs === undefined) return '';
  const baseTime = new Date(createdAt).getTime();
  const messageTime = new Date(baseTime + timeInCallSecs * 1000);
  return messageTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getPersonaStyle(persona: string, colors: any) {
  const name = persona.trim().toLowerCase().replace(/[<>]/g, '');
  if (name.includes('inya') || name.includes('iniya')) {
    return {
      bubbleBg: colors.card,
      bubbleText: colors.text,
      nameText: colors.primary,
      label: 'Iniya',
    };
  }
  if (name.includes('ezhil')) {
    return {
      bubbleBg: colors.inputBg,
      bubbleText: colors.text,
      nameText: colors.primary,
      label: 'Ezhil',
    };
  }
  return {
    bubbleBg: colors.inputBg,
    bubbleText: colors.subText,
    nameText: colors.primary,
    label: 'Ezhil',
  };
}

/**
 * Splits a single transcript message that contains inline persona tags
 * (e.g. "<Inya>Hello...<Ezhil>Hi there...") into separate message entries.
 */
function splitInlinePersonas(
  entry: { role: 'agent' | 'user'; persona: string; message: string; time_in_call_secs?: number | null }
): Array<{ role: 'agent' | 'user'; persona: string; message: string; time_in_call_secs?: number | null }> {
  if (entry.role !== 'agent') return [entry];

  // Match persona tags like <Inya>, <Ezhil>, <Iniya>, etc.
  const tagPattern = /<([A-Za-z][A-Za-z\s]*)>/g;
  const matches: Array<{ tag: string; persona: string; index: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(entry.message)) !== null) {
    matches.push({ tag: match[0], persona: match[1].trim(), index: match.index });
  }

  // No inline tags, return as-is
  if (matches.length === 0) return [entry];

  const results: Array<{ role: 'agent' | 'user'; persona: string; message: string; time_in_call_secs?: number | null }> = [];

  // Text before the first tag belongs to the original persona
  const textBefore = entry.message.slice(0, matches[0].index).trim();
  if (textBefore.length > 0) {
    results.push({ ...entry, message: textBefore });
  }

  // Each tag starts a new persona segment
  for (let i = 0; i < matches.length; i++) {
    const startIdx = matches[i].index + matches[i].tag.length;
    const endIdx = i + 1 < matches.length ? matches[i].index + matches[i].tag.length + (matches[i + 1].index - startIdx) : entry.message.length;
    const segmentText = entry.message.slice(startIdx, endIdx).trim();
    if (segmentText.length > 0) {
      results.push({
        role: 'agent',
        persona: matches[i].persona,
        message: segmentText,
        time_in_call_secs: entry.time_in_call_secs,
      });
    }
  }

  return results.length > 0 ? results : [entry];
}

function getStatusMeta(status: string, isDark: boolean) {
  switch (status) {
    case 'done':
      return {
        bg: isDark ? 'rgba(16,185,129,0.10)' : '#D1FAE5',
        text: isDark ? '#34D399' : '#059669',
        border: isDark ? 'rgba(16,185,129,0.22)' : '#A7F3D0',
        label: 'Completed',
      };
    case 'failed':
      return {
        bg: isDark ? 'rgba(239,68,68,0.10)' : '#FEE2E2',
        text: isDark ? '#F87171' : '#DC2626',
        border: isDark ? 'rgba(239,68,68,0.22)' : '#FECACA',
        label: 'Failed',
      };
    case 'initiated':
    case 'queued':
      return {
        bg: isDark ? 'rgba(59,130,246,0.10)' : '#DBEAFE',
        text: isDark ? '#60A5FA' : '#2563EB',
        border: isDark ? 'rgba(59,130,246,0.22)' : '#BFDBFE',
        label: 'Scheduled',
      };
    default:
      return {
        bg: isDark ? 'rgba(148,163,184,0.10)' : '#E2E8F0',
        text: isDark ? '#9CA3AF' : '#475569',
        border: isDark ? 'rgba(148,163,184,0.20)' : '#CBD5E1',
        label: status || 'Unknown',
      };
  }
}

function personaColor(persona: string) {
  const colors = ['#6366F1', '#0EA5E9', '#8B5CF6', '#059669', '#D97706'];
  const sum = persona.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
}

function scoreColor(score: number | null) {
  if (score === null) return '#9CA3AF';
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F59E0B';
  if (score >= 4) return '#F97316';
  return '#EF4444';
}

function scoreLabel(score: number | null) {
  if (score === null) return 'Awaiting';
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Needs Work';
  return 'Below Average';
}

const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const hapticMedium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// ─── Skeleton block ──────────────────────────────────────────
function Skeleton({ width, height, radius = 8, color }: { width: number | string; height: number; radius?: number; color: string }) {
  return <View style={{ width: width as any, height, borderRadius: radius, backgroundColor: color }} />;
}

// Radial score ring component
function ScoreRing({ score, size = 52 }: { score: number | null; size?: number }) {
  const { colors } = useTheme();
  const stroke = 5;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const val = score ?? 0;
  const pct = Math.min(Math.max(val / 10, 0), 1);
  const dashoffset = circumference - pct * circumference;
  const color = scoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id={`ring-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.border} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-${color})`}
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.24, fontWeight: '800', color }}>
          {score !== null ? score.toFixed(1) : '--'}
        </Text>
        {score !== null && (
          <Text style={{ fontSize: size * 0.12, fontWeight: '700', color: colors.subText, marginTop: -2 }}>
            /10
          </Text>
        )}
      </View>
    </View>
  );
}

// Overall average score ring (bigger)
function OverallScoreRing({ score }: { score: number }) {
  const { colors } = useTheme();
  const size = 84;
  const stroke = 7;
  const radius = (size - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const dashoffset = circumference - pct * circumference;
  const color = scoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="overallRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </SvgLinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.border} strokeWidth={stroke} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#overallRing)"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color }}>{score.toFixed(1)}</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.subText, marginTop: -3, letterSpacing: 1 }}>
          OUT OF 10
        </Text>
      </View>
    </View>
  );
}

const CACHE_KEY_LIST = 'mock_interview_list_cache';
const CACHE_KEY_DETAIL_PREFIX = 'mock_interview_detail_';
const INTRO_MODAL_SEEN_KEY = 'mock_interview_intro_seen';

export default function MockInterviewScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const hasSoftLoaded = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeProgress, setResumeProgress] = useState(0);
  const [startingCall, setStartingCall] = useState(false);
  const [profile, setProfile] = useState<InterviewProfile | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'feedback' | 'transcript'>('feedback');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showIntroModal, setShowIntroModal] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!hasSoftLoaded.current) {
      setLoading(true);
    }

    // Soft cache read on initial load
    if (!isRefresh && !hasSoftLoaded.current) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY_LIST);
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile(parsed.profile || null);
          setSessions(parsed.sessions || []);
          hasSoftLoaded.current = true;
          setLoading(false);
        }
      } catch {
        // ignore cache read errors
      }
    }

    try {
      const response = await apiFetch<{ profile: InterviewProfile | null; sessions: InterviewSession[] }>('/api/mock-interviews');
      setProfile(response.profile || null);
      setSessions(response.sessions || []);
      hasSoftLoaded.current = true;
      await AsyncStorage.setItem(CACHE_KEY_LIST, JSON.stringify(response));
    } catch (error: any) {
      if (!hasSoftLoaded.current) {
        Alert.alert('Unable to load interviews', error.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_MODAL_SEEN_KEY).then(seen => {
      if (!seen) setShowIntroModal(true);
    });
  }, []);

  const hasResume = Boolean(profile?.resume_storage_path);
  const userFirstName = useMemo(() => {
    if (!user?.full_name) return 'Candidate';
    return user.full_name.split(' ')[0];
  }, [user?.full_name]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [sessions]);

  const completedCount = useMemo(() => sessions.filter(s => s.status === 'done').length, [sessions]);
  const avgScore = useMemo(() => {
    const scores: number[] = [];
    sessions.forEach(s => {
      s.performance_summary?.performance?.forEach(p => {
        if (p.score !== null) scores.push(p.score);
      });
    });
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [sessions]);

  const handleUploadResume = async () => {
    hapticLight();
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'application/octet-stream';
      if (
        ![
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(mimeType)
      ) {
        Alert.alert('Unsupported file', 'Please upload only PDF, DOC, or DOCX files.');
        return;
      }

      setResumeUploading(true);
      setResumeProgress(15);
      hapticMedium();

      setTimeout(() => setResumeProgress(45), 200);

      const fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setResumeProgress(75);

      const response = await apiFetch<{
        resume: {
          file_name: string;
          markdown_char_count: number;
        };
      }>('/api/mock-interview-resume', {
        method: 'POST',
        body: JSON.stringify({
          file_base64: fileBase64,
          file_name: asset.name || `resume-${Date.now()}`,
          file_type: mimeType,
          file_size: asset.size || 0,
        }),
      });

      setResumeProgress(100);
      hapticSuccess();
      setTimeout(() => {
        Alert.alert(
          'Resume ready',
          `${response.resume.file_name} was converted to markdown and will be used to personalize the interview.`
        );
      }, 300);
      await loadData();
    } catch (error: any) {
      Alert.alert('Upload failed', error.message || 'Could not upload resume.');
    } finally {
      setResumeUploading(false);
      setResumeProgress(0);
    }
  };

  const dismissIntroModal = useCallback(async () => {
    hapticLight();
    setShowIntroModal(false);
    await AsyncStorage.setItem(INTRO_MODAL_SEEN_KEY, 'true');
  }, []);

  const handleStartInterview = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Phone number required', 'Enter the number where you want to receive the TNPSC mock interview call.');
      return;
    }

    try {
      setStartingCall(true);
      hapticMedium();
      const response = await apiFetch<{ session: InterviewSession }>('/api/mock-interviews', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: phoneNumber,
          candidate_name: user?.full_name || user?.email || 'Candidate',
        }),
      });

      setPhoneNumber('');
      await loadData();
      hapticSuccess();
      setTimeout(() => {
        Alert.alert(
          'Interview scheduled',
          `Your call has been started for ${response.session.phone_number}. You should receive it shortly.`
        );
      }, 200);
    } catch (error: any) {
      Alert.alert('Could not start interview', error.message || 'Please try again.');
    } finally {
      setStartingCall(false);
    }
  };

  // Open modal INSTANTLY with soft cache or preview data, then load full detail in background
  const openSessionDetail = async (session: InterviewSession) => {
    hapticLight();
    setActiveTab('feedback');

    let hasRichCache = false;

    // Try soft cache first for smoother modal open
    try {
      const cachedStr = await AsyncStorage.getItem(`${CACHE_KEY_DETAIL_PREFIX}${session.id}`);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr) as InterviewSession;
        setSelectedSession(cached);
        // If cache already has performance data, don't show skeletons
        hasRichCache = !!(cached.performance_summary?.performance?.length || cached.transcript_summary);
      } else {
        setSelectedSession(session);
      }
    } catch {
      setSelectedSession(session);
    }

    if (!hasRichCache) setDetailLoading(true);
    try {
      const response = await apiFetch<{ session: InterviewSession }>(
        `/api/mock-interview-detail?id=${encodeURIComponent(session.id)}`
      );
      setSelectedSession(response.session);
      await AsyncStorage.setItem(`${CACHE_KEY_DETAIL_PREFIX}${session.id}`, JSON.stringify(response.session));
      await loadData(true);
    } catch (error: any) {
      if (!hasRichCache) {
        Alert.alert('Unable to open result', error.message || 'Please try again.');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const selectedOverallScore = useMemo(() => {
    if (!selectedSession?.performance_summary?.performance) return null;
    const scores = selectedSession.performance_summary.performance
      .map(p => p.score)
      .filter((s): s is number => s !== null);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [selectedSession]);

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#0F1117' : '#F8F9FC' }]}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.heroWrap}>
          <View
            style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
          >
            <View style={styles.heroTop}>
              <View style={[styles.heroIconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Sparkles size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                {loading ? (
                  <Skeleton width={140} height={24} radius={8} color={colors.inputBg} />
                ) : (
                  <Text style={[styles.heroTitle, { color: colors.text }]}>Hi, {userFirstName}</Text>
                )}
                {loading ? (
                  <Skeleton width={210} height={14} radius={7} color={colors.inputBg} />
                ) : (
                  <Text style={[styles.heroSub, { color: colors.subText }]}>
                    Practice TNPSC interviews over a real phone call
                  </Text>
                )}
              </View>
            </View>

            {/* Quick stats */}
            <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
              {(['Completed', 'Avg Score', 'Total'] as const).map((label, i) => (
                <View key={label} style={styles.statItemWrap}>
                  <View style={styles.statItem}>
                    {loading ? (
                      <Skeleton width={36} height={22} radius={6} color={colors.inputBg} />
                    ) : (
                      <Text style={[styles.statNum, { color: colors.text }]}>
                        {label === 'Completed' ? completedCount : label === 'Avg Score' ? (avgScore !== null ? avgScore.toFixed(1) : '--') : sessions.length}
                      </Text>
                    )}
                    {loading ? (
                      <Skeleton width={52} height={11} radius={6} color={colors.inputBg} />
                    ) : (
                      <Text style={[styles.statLbl, { color: colors.subText }]}>{label}</Text>
                    )}
                  </View>
                  {i < 2 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Resume Card */}
        <View style={styles.cardWrap}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: hasResume ? (isDark ? 'rgba(16,185,129,0.12)' : '#D1FAE5') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') }]}>
                {loading ? (
                  <Skeleton width={20} height={20} radius={10} color={colors.inputBg} />
                ) : hasResume ? (
                  <CheckCircle2 size={20} color={isDark ? '#34D399' : '#059669'} />
                ) : (
                  <FileText size={20} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                {loading ? (
                  <Skeleton width={90} height={15} radius={7} color={colors.inputBg} />
                ) : (
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Resume</Text>
                )}
                {loading ? (
                  <Skeleton width={170} height={12} radius={6} color={colors.inputBg} />
                ) : (
                  <Text style={[styles.cardSub, { color: colors.subText }]} numberOfLines={1}>
                    {hasResume ? profile?.resume_file_name || 'Uploaded' : 'Upload to personalize your interview'}
                  </Text>
                )}
              </View>
              {!loading && hasResume && profile?.resume_markdown_char_count ? (
                <View style={[styles.charBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                  <Text style={[styles.charBadgeText, { color: colors.subText }]}>
                    {profile.resume_markdown_char_count > 1000
                      ? `${(profile.resume_markdown_char_count / 1000).toFixed(1)}k`
                      : profile.resume_markdown_char_count} chars
                  </Text>
                </View>
              ) : null}
            </View>

            {resumeUploading && (
              <View style={styles.progressWrap}>
                <View style={[styles.progressTrack, { backgroundColor: colors.inputBg }]}>
                  <View style={[styles.progressFill, { width: `${resumeProgress}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.progressText, { color: colors.subText }]}>
                  Processing... {resumeProgress}%
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleUploadResume}
              disabled={resumeUploading || loading}
              activeOpacity={0.85}
              style={[
                styles.outlineBtn,
                {
                  borderColor: hasResume ? colors.border : colors.primary,
                  backgroundColor: hasResume ? 'transparent' : colors.primary,
                  opacity: resumeUploading || loading ? 0.5 : 1,
                },
              ]}
            >
              {resumeUploading ? (
                <ActivityIndicator color={hasResume ? colors.primary : '#FFF'} size="small" />
              ) : (
                <Upload size={16} color={hasResume ? colors.primary : '#FFF'} />
              )}
              <Text style={[styles.outlineBtnText, { color: hasResume ? colors.primary : '#FFF' }]}>
                {hasResume ? 'Replace Resume' : 'Upload Resume'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Start Interview Card */}
        <View style={styles.cardWrap}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <PhoneCall size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Start Interview</Text>
                <Text style={[styles.cardSub, { color: colors.subText }]}>
                  We'll call this number for your mock interview
                </Text>
              </View>
            </View>

            <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
              <Phone size={18} color={colors.subText} />
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="+91 9876543210"
                placeholderTextColor={colors.subText}
                keyboardType="phone-pad"
                autoCapitalize="none"
                style={[styles.input, { color: colors.text }]}
              />
            </View>

            <TouchableOpacity
              onPress={handleStartInterview}
              disabled={startingCall}
              activeOpacity={0.9}
              style={[styles.callBtn, { opacity: startingCall ? 0.7 : 1, backgroundColor: colors.primary }]}
            >
              <View style={styles.callBtnInner}>
                {startingCall ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <PhoneCall size={18} color="#FFF" />
                )}
                <Text style={styles.callBtnText}>{startingCall ? 'Starting...' : 'Start Interview'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* History Section */}
        <View style={styles.sectionHead}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Interview History</Text>
            {!loading && sessions.length > 0 && (
              <View style={[styles.countPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Text style={[styles.countPillText, { color: colors.subText }]}>{sessions.length}</Text>
              </View>
            )}
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={[styles.skeletonList, { paddingHorizontal: 20, marginTop: 4 }]}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.skeletonCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.skeletonRow}>
                  <Skeleton width={40} height={40} radius={12} color={colors.inputBg} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton width="55%" height={14} radius={7} color={colors.inputBg} />
                    <Skeleton width="40%" height={11} radius={6} color={colors.inputBg} />
                  </View>
                  <Skeleton width={64} height={22} radius={8} color={colors.inputBg} />
                </View>
              </View>
            ))}
          </View>
        ) : sortedSessions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
              <PhoneCall size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No interviews yet</Text>
            <Text style={[styles.emptySub, { color: colors.subText }]}>
              Upload your resume and enter a phone number to start your first mock interview.
            </Text>
          </View>
        ) : (
          sortedSessions.map((session) => {
            const sm = getStatusMeta(session.status, isDark);
            const duration = session.duration_secs || session.performance_summary?.call_duration_secs;
            const sessionScores = session.performance_summary?.performance
              ?.map(p => p.score)
              .filter((s): s is number => s !== null) || [];
            const sessionAvg = sessionScores.length > 0
              ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
              : null;

            return (
              <View key={session.id} style={styles.cardWrap}>
                <Pressable
                  onPress={() => openSessionDetail(session)}
                  style={({ pressed }) => [
                    styles.historyItem,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={styles.historyMain}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
                        {session.call_summary_title || session.candidate_name || 'Mock Interview'}
                      </Text>
                      <View style={styles.historyMetaRow}>
                        <View style={[styles.metaChip, { backgroundColor: colors.inputBg }]}>
                          <Clock size={11} color={colors.subText} />
                          <Text style={[styles.metaText, { color: colors.subText }]}>
                            {formatRelativeDate(session.created_at)}
                          </Text>
                        </View>
                        {duration ? (
                          <View style={[styles.metaChip, { backgroundColor: colors.inputBg }]}>
                            <Calendar size={11} color={colors.subText} />
                            <Text style={[styles.metaText, { color: colors.subText }]}>
                              {formatDuration(duration)}
                            </Text>
                          </View>
                        ) : null}
                        {sessionAvg !== null && (
                          <View style={[styles.metaChip, { backgroundColor: scoreColor(sessionAvg) + '18' }]}>
                            <Zap size={11} color={scoreColor(sessionAvg)} />
                            <Text style={[styles.metaText, { color: scoreColor(sessionAvg) }]}>
                              {sessionAvg.toFixed(1)}/10
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.historySide}>
                    <View style={[styles.badge, { backgroundColor: sm.bg, borderColor: sm.border }]}>
                      <View style={[styles.badgeDot, { backgroundColor: sm.text }]} />
                      <Text style={[styles.badgeText, { color: sm.text }]}>{sm.label}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.subText} />
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={Boolean(selectedSession)} animationType="slide" onRequestClose={() => setSelectedSession(null)}>
        <View style={{ flex: 1, backgroundColor: isDark ? '#0F1117' : '#F8F9FC' }}>
          <View
            style={[styles.modalHeader, { backgroundColor: isDark ? '#181A20' : '#FFFFFF', borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            <View style={[styles.modalHeadRow, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setSelectedSession(null); }}
                style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeadTitle, { color: colors.text }]} numberOfLines={1}>Interview Result</Text>
              <View style={{ width: 42 }} />
            </View>
          </View>

          {selectedSession ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
              {/* Summary Hero with overall score — rendered instantly from preview */}
              <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                <View style={[styles.summaryHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.summaryHeroContent}>
                    <View style={{ flex: 1, marginRight: 16 }}>
                      <Text style={[styles.summaryTitle, { color: colors.text }]} numberOfLines={2}>
                        {selectedSession.performance_summary?.call_summary_title || selectedSession.call_summary_title || selectedSession.candidate_name || 'Mock Interview'}
                      </Text>
                      <View style={styles.summaryMetaRow}>
                        <View style={[styles.metaChip, { backgroundColor: colors.inputBg }]}>
                          <Calendar size={11} color={colors.subText} />
                          <Text style={[styles.metaText, { color: colors.subText }]}>
                            {formatRelativeDate(selectedSession.created_at)}
                          </Text>
                        </View>
                        <View style={[styles.metaChip, { backgroundColor: colors.inputBg }]}>
                          <Phone size={11} color={colors.subText} />
                          <Text style={[styles.metaText, { color: colors.subText }]}>
                            {selectedSession.phone_number}
                          </Text>
                        </View>
                      </View>
                      {(selectedSession.performance_summary?.transcript_summary || selectedSession.transcript_summary) && (
                        <Text style={[styles.summaryBody, { color: colors.subText }]} numberOfLines={3}>
                          {selectedSession.performance_summary?.transcript_summary || selectedSession.transcript_summary}
                        </Text>
                      )}
                    </View>
                    {selectedOverallScore !== null ? (
                      <OverallScoreRing score={selectedOverallScore} />
                    ) : detailLoading ? (
                      <View style={styles.noScoreWrap}>
                        <Skeleton width={84} height={84} radius={42} color={colors.inputBg} />
                      </View>
                    ) : (
                      <View style={styles.noScoreWrap}>
                        <Sparkles size={26} color={colors.subText} />
                        <Text style={[styles.noScoreText, { color: colors.subText }]}>Pending</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Tab Switcher */}
              <View style={[styles.tabWrap, { borderColor: colors.border }]}>
                <Pressable
                  onPress={() => { hapticLight(); setActiveTab('feedback'); }}
                  style={[styles.tabBtn, activeTab === 'feedback' && { backgroundColor: colors.primary }]}
                >
                  <Sparkles size={15} color={activeTab === 'feedback' ? '#FFF' : colors.subText} />
                  <Text style={[styles.tabText, { color: activeTab === 'feedback' ? '#FFF' : colors.subText }]}>
                    Performance
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { hapticLight(); setActiveTab('transcript'); }}
                  style={[styles.tabBtn, activeTab === 'transcript' && { backgroundColor: colors.primary }]}
                >
                  <UserRound size={15} color={activeTab === 'transcript' ? '#FFF' : colors.subText} />
                  <Text style={[styles.tabText, { color: activeTab === 'transcript' ? '#FFF' : colors.subText }]}>
                    Transcript
                  </Text>
                </Pressable>
              </View>

              {/* Tab Content — skeleton while detail loads */}
              {detailLoading ? (
                <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                  <Skeleton width={180} height={18} radius={9} color={colors.inputBg} />
                  <View style={{ marginTop: 14, gap: 12 }}>
                    {[1, 2, 3].map(i => (
                      <View key={i} style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.scoreCardTop}>
                          <Skeleton width={52} height={52} radius={26} color={colors.inputBg} />
                          <View style={{ flex: 1, marginLeft: 14, gap: 8 }}>
                            <Skeleton width="50%" height={15} radius={7} color={colors.inputBg} />
                            <Skeleton width={70} height={20} radius={8} color={colors.inputBg} />
                          </View>
                        </View>
                        <View style={{ marginTop: 14, gap: 6 }}>
                          <Skeleton width="100%" height={11} radius={6} color={colors.inputBg} />
                          <Skeleton width="90%" height={11} radius={6} color={colors.inputBg} />
                          <Skeleton width="70%" height={11} radius={6} color={colors.inputBg} />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : activeTab === 'feedback' ? (
                <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                  <Text style={[styles.detailTitle, { color: colors.text }]}>Performance Breakdown</Text>
                  {(selectedSession.performance_summary?.performance || []).length > 0 ? (
                    (selectedSession.performance_summary?.performance || []).map((item) => (
                      <View key={item.id} style={styles.cardWrap}>
                        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={styles.scoreCardTop}>
                            <ScoreRing score={item.score} size={52} />
                            <View style={{ flex: 1, marginLeft: 14 }}>
                              <Text style={[styles.scoreLabel, { color: colors.text }]}>{item.label}</Text>
                              <View style={[styles.scoreBadge, { backgroundColor: scoreColor(item.score) + '18' }]}>
                                <Text style={[styles.scoreBadgeText, { color: scoreColor(item.score) }]}>
                                  {scoreLabel(item.score)}
                                </Text>
                              </View>
                            </View>
                          </View>
                          {item.feedback ? (
                            <Text style={[styles.scoreFeedback, { color: colors.subText, borderTopColor: colors.border }]}>{item.feedback}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                        <Sparkles size={24} color={colors.primary} />
                      </View>
                      <Text style={[styles.emptySub, { color: colors.subText }]}>
                        Performance insights will appear after analysis is ready.
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                  {(() => {
                    const rawMessages = selectedSession.performance_summary?.transcript || [];
                    // Split messages that contain inline persona tags (e.g. "<Inya>...<Ezhil>...")
                    const expandedMessages = rawMessages.flatMap(m => splitInlinePersonas(m));
                    const processed = expandedMessages.map((m, i) => ({
                      ...m,
                      originalIndex: i,
                      cleanMessage: stripEmotionTags(m.message || ''),
                    })).filter(m => m.cleanMessage.length > 0);

                    const groups: typeof processed[] = [];
                    let currentGroup: typeof processed = [];
                    processed.forEach((m, i) => {
                      const prev = processed[i - 1];
                      const sameSender = prev && prev.role === m.role &&
                        (m.role === 'user' || prev.persona === m.persona);
                      if (!sameSender) {
                        if (currentGroup.length > 0) groups.push(currentGroup);
                        currentGroup = [m];
                      } else {
                        currentGroup.push(m);
                      }
                    });
                    if (currentGroup.length > 0) groups.push(currentGroup);

                    if (groups.length === 0) {
                      return (
                        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
                          <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                            <UserRound size={24} color={colors.primary} />
                          </View>
                          <Text style={[styles.emptySub, { color: colors.subText }]}>
                            Transcript is not available for this interview.
                          </Text>
                        </View>
                      );
                    }

                    return groups.map((group, groupIndex) => {
                      const firstMsg = group[0];
                      const isAgent = firstMsg.role === 'agent';
                      const personaStyle = isAgent
                        ? getPersonaStyle(firstMsg.persona, colors)
                        : {
                          bubbleBg: colors.primary,
                          bubbleText: '#FFFFFF',
                          nameText: colors.primary,
                          label: 'You',
                        };

                      return (
                        <View key={`group-${groupIndex}`} style={{ marginBottom: 12 }}>
                          <View style={[
                            styles.senderNameRow,
                            { justifyContent: isAgent ? 'flex-start' : 'flex-end' }
                          ]}>
                            <Text style={[styles.senderName, { color: personaStyle.nameText }]}>
                              {personaStyle.label}
                            </Text>
                          </View>
                          {group.map((message, msgIndex) => {
                            const isFirst = msgIndex === 0;
                            const isLast = msgIndex === group.length - 1;
                            const timeStr = formatMessageTime(selectedSession.created_at, message.time_in_call_secs);

                            return (
                              <View
                                key={`msg-${message.originalIndex}`}
                                style={[
                                  styles.msgRow,
                                  { justifyContent: isAgent ? 'flex-start' : 'flex-end' }
                                ]}
                              >
                                <View
                                  style={[
                                    styles.msgBubble,
                                    {
                                      backgroundColor: personaStyle.bubbleBg,
                                      alignSelf: isAgent ? 'flex-start' : 'flex-end',
                                      borderTopLeftRadius: isAgent ? (isFirst ? 4 : 16) : 16,
                                      borderTopRightRadius: isAgent ? 16 : (isFirst ? 4 : 16),
                                      borderBottomLeftRadius: isAgent ? (isLast ? 16 : 4) : 16,
                                      borderBottomRightRadius: isAgent ? 16 : (isLast ? 16 : 4),
                                    },
                                  ]}
                                >
                                  <Markdown style={markdownStylesForBubble(isDark, personaStyle.bubbleText)}>
                                    {message.cleanMessage}
                                  </Markdown>
                                  {timeStr ? (
                                    <Text style={[styles.msgTime, { color: isAgent ? (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)') : 'rgba(255,255,255,0.7)' }]}>
                                      {timeStr}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    });
                  })()}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      {/* Intro Modal */}
      <Modal
        visible={showIntroModal}
        animationType="fade"
        transparent
        onRequestClose={dismissIntroModal}
      >
        <View style={[styles.introOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.introCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Illustration */}
              <View style={styles.introIllustrationWrap}>
                <View style={[styles.introIllustrationBg, { backgroundColor: colors.primaryMuted }]}>
                  <Svg width="120" height="120" viewBox="0 0 120 120">
                    <Circle cx="60" cy="60" r="48" fill={colors.primary} opacity="0.12" />
                    <Circle cx="60" cy="55" r="18" fill={colors.primary} opacity="0.2" />
                    <Circle cx="60" cy="50" r="10" fill={colors.primary} opacity="0.35" />
                    <Circle cx="45" cy="78" r="6" fill={colors.primary} opacity="0.25" />
                    <Circle cx="75" cy="78" r="6" fill={colors.primary} opacity="0.25" />
                    <Circle cx="35" cy="65" r="4" fill={colors.primary} opacity="0.15" />
                    <Circle cx="85" cy="65" r="4" fill={colors.primary} opacity="0.15" />
                  </Svg>
                </View>
              </View>

              <Text style={[styles.introTitle, { color: colors.text }]}>
                Mock Interview
              </Text>
              <Text style={[styles.introSub, { color: colors.subText }]}>
                Practice TNPSC interviews with AI-powered phone calls
              </Text>

              {/* Feature Steps */}
              <View style={styles.introSteps}>
                {[
                  {
                    icon: <Upload size={20} color={colors.primary} />,
                    title: 'Upload Your Resume',
                    desc: 'Personalize the interview questions based on your background',
                  },
                  {
                    icon: <PhoneCall size={20} color={colors.primary} />,
                    title: 'Receive a Call',
                    desc: 'Enter your phone number and get a real mock interview call',
                  },
                  {
                    icon: <Sparkles size={20} color={colors.primary} />,
                    title: 'Get AI Feedback',
                    desc: 'Review detailed performance scores and conversation transcript',
                  },
                ].map((step, i) => (
                  <View key={i} style={styles.introStepRow}>
                    <View style={[styles.introStepIcon, { backgroundColor: colors.primaryMuted }]}>
                      {step.icon}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.introStepTitle, { color: colors.text }]}>{step.title}</Text>
                      <Text style={[styles.introStepDesc, { color: colors.subText }]}>{step.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={dismissIntroModal}
              activeOpacity={0.85}
              style={[styles.introBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.introBtnText}>Let&apos;s Go</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function markdownStyles(isDark: boolean) {
  return {
    body: { color: isDark ? '#E5E7EB' : '#374151', fontSize: 14, lineHeight: 21 },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { color: isDark ? '#FFFFFF' : '#111118', marginTop: 0, marginBottom: 8 },
    heading2: { color: isDark ? '#FFFFFF' : '#111118', marginTop: 4, marginBottom: 8 },
    bullet_list: { marginBottom: 6 },
    ordered_list: { marginBottom: 6 },
    code_inline: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
      color: isDark ? '#F8FAFC' : '#1F2937',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
  };
}

function markdownStylesForBubble(isDark: boolean, textColor: string) {
  return {
    body: { color: textColor, fontSize: 15, lineHeight: 22 },
    paragraph: { marginTop: 0, marginBottom: 0 },
    heading1: { color: textColor, marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: '700' },
    heading2: { color: textColor, marginTop: 4, marginBottom: 8, fontSize: 15, fontWeight: '700' },
    bullet_list: { marginBottom: 4 },
    ordered_list: { marginBottom: 4 },
    code_inline: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
      color: textColor,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroWrap: { marginHorizontal: 20, marginBottom: 16 },
  heroCard: { borderRadius: 20, overflow: 'hidden', paddingTop: 18, paddingBottom: 4 },
  heroTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 14 },
  heroIconWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  heroTitle: { fontSize: 25, fontWeight: '800', marginBottom: 2 },
  heroSub: { fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 14, paddingBottom: 14 },
  statItemWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 21, fontWeight: '800', marginBottom: 2 },
  statLbl: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28 },
  cardWrap: { marginBottom: 14, marginHorizontal: 20 },
  card: { borderRadius: 18, borderWidth: 1, padding: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 14 },
  cardIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardSub: { fontSize: 13, lineHeight: 18 },
  charBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  charBadgeText: { fontSize: 11, fontWeight: '700' },
  progressWrap: { marginBottom: 14 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '600' },
  outlineBtn: { height: 46, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outlineBtnText: { fontSize: 14, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, gap: 12, marginBottom: 14 },
  input: { flex: 1, fontSize: 16, fontWeight: '500', paddingVertical: 0 },
  callBtn: { height: 54, borderRadius: 14, overflow: 'hidden' },
  callBtnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  callBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '800' },
  countPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  countPillText: { fontSize: 12, fontWeight: '800' },
  skeletonList: { gap: 10 },
  skeletonCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyState: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', marginHorizontal: 20 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  historyItem: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center' },
  historyMain: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  historyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 7 },
  historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText: { fontSize: 11, fontWeight: '600' },
  historySide: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  modalHeader: { borderBottomWidth: 0 },
  modalHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
  modalHeadTitle: { fontSize: 17, fontWeight: '800' },
  closeBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summaryHero: { borderRadius: 20, borderWidth: 1, padding: 20, overflow: 'hidden', marginBottom: 16 },
  summaryHeroContent: { flexDirection: 'row', alignItems: 'center' },
  summaryTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  summaryMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  summaryBody: { fontSize: 13, lineHeight: 19 },
  noScoreWrap: { alignItems: 'center', justifyContent: 'center', gap: 4, width: 84, height: 84 },
  noScoreText: { fontSize: 11, fontWeight: '700' },
  tabWrap: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 10 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: 10 },
  tabText: { fontSize: 14, fontWeight: '700' },
  detailTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
  scoreCard: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 12 },
  scoreCardTop: { flexDirection: 'row', alignItems: 'center' },
  scoreLabel: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  scoreBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  scoreBadgeText: { fontSize: 11, fontWeight: '800' },
  scoreFeedback: { fontSize: 13, lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  msgRow: { width: '100%', flexDirection: 'row', marginBottom: 2 },
  msgBubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10 },
  senderNameRow: { flexDirection: 'row', marginBottom: 2, paddingHorizontal: 4 },
  senderName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  msgTime: { fontSize: 10, fontWeight: '500', marginTop: 4, alignSelf: 'flex-end' },
  // Intro Modal
  introOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  introCard: { width: '100%', maxHeight: '85%', borderRadius: 24, borderWidth: 1, padding: 24, overflow: 'hidden' },
  introIllustrationWrap: { alignItems: 'center', marginBottom: 20 },
  introIllustrationBg: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  introSub: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  introSteps: { gap: 16, marginBottom: 24 },
  introStepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  introStepIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  introStepTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  introStepDesc: { fontSize: 13, lineHeight: 19 },
  introBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  introBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});