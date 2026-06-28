import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  ThumbsDown,
  ThumbsUp,
  Download,
  Share2,
  CheckCircle,
  ArrowLeft,
  BookOpen,
} from 'lucide-react-native';

// ─── Responsive ─────────────────────────────────────────────────────────────
const { width, height } = Dimensions.get('window');
const hs = (n: number) => (width / 375) * n;
const vs = (n: number) => (height / 812) * n;

const API_BASE_PRODUCTION = 'https://enliten-admin-web.vercel.app';
const API_BASE_DEV = 'http://10.107.103.1:8080/';
const BRAND = '#9B2335';

// ─── MCQ Banner ──────────────────────────────────────────────────────────────
function MCQBanner({ date, colors, isDark }: { date: string; colors: any; isDark: boolean }) {
  const [mcqTotal, setMcqTotal] = useState<number | null>(null);
  const [loadingMCQ, setLoadingMCQ] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingMCQ(true);
    // Check Supabase cache first (fast path)
    supabase
      .from('news_mcqs' as any)
      .select('total')
      .eq('date', date)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setMcqTotal((data as any).total ?? 0);
        } else {
          setMcqTotal(null); // not yet generated
        }
        setLoadingMCQ(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  const handlePractice = () => {
    router.push({ pathname: '/news-mcq', params: { date } });
  };

  return (
    <View style={[
      bannerStyles.card,
      { backgroundColor: isDark ? '#1a2332' : '#fff', borderColor: isDark ? 'rgba(155,35,53,0.3)' : '#F1D0D4' },
    ]}>
      <View style={{ flex: 1 }}>
        <Text style={[bannerStyles.title, { color: BRAND }]}>MCQs of the day</Text>
        {loadingMCQ ? (
          <Text style={[bannerStyles.sub, { color: colors.subText }]}>Loading…</Text>
        ) : mcqTotal !== null ? (
          <Text style={[bannerStyles.sub, { color: colors.subText }]}>{mcqTotal} questions from today's news</Text>
        ) : (
          <Text style={[bannerStyles.sub, { color: colors.subText }]}>No practice done on this day</Text>
        )}
      </View>
      <TouchableOpacity onPress={handlePractice} style={bannerStyles.btn} activeOpacity={0.85}>
        <Text style={bannerStyles.btnText}>Practice Now</Text>
      </TouchableOpacity>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1.5,
    padding: 16, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    overflow: 'hidden',
  },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 3 },
  sub: { fontSize: 12, lineHeight: 17 },
  btn: {
    backgroundColor: BRAND, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

// ─── Types ───────────────────────────────────────────────────────────────────
interface MCQItem {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  gs_tags?: string[];
  exam_relevance?: string;
  topic?: string;
}

interface NewsItem {
  date: string;
  title: string;
  content: string;
  source?: string;
  gs_tags?: string[];
  exam_relevance?: string;
  category?: string;
  emoji?: string;
}

interface NewsRecord {
  id: string;
  fetched_at: string;
  region: string;
  categories: Record<string, { news_items: NewsItem[]; total_items: number; emoji?: string }>;
  total_items: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const GS_COLORS: Record<string, { bg: string; text: string }> = {
  GS1: { bg: '#3B82F6', text: '#fff' },
  GS2: { bg: '#10B981', text: '#fff' },
  GS3: { bg: '#F97316', text: '#fff' },
  GS4: { bg: '#8B5CF6', text: '#fff' },
};

const CATEGORY_COLORS: Record<string, string> = {
  Politics: '#3B82F6',
  Economy: '#10B981',
  Sports: '#F97316',
  Science_Technology: '#8B5CF6',
  Environment: '#22C55E',
  Education: '#EAB308',
  Culture: '#EC4899',
  Health: '#EF4444',
  Infrastructure: '#64748B',
  International_Relations: '#06B6D4',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(date: Date) {
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function flattenNews(record: NewsRecord): NewsItem[] {
  const items: NewsItem[] = [];
  if (!record?.categories) return items;
  for (const [catKey, catData] of Object.entries(record.categories)) {
    for (const item of catData.news_items || []) {
      items.push({ ...item, category: catKey, emoji: catData.emoji || '📰' });
    }
  }
  return items;
}

// ─── Mini Calendar Component ──────────────────────────────────────────────────
function MiniCalendar({
  selectedDate, onSelect, availableDates, colors, isDark,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  availableDates: Set<string>;
  colors: any;
  isDark: boolean;
}) {
  const [viewMonth, setViewMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
      {/* Month navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      {/* Day headers */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.subText, fontSize: 11, fontWeight: '600' }}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Calendar grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
          const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
          const key = toDateKey(d);
          const isSelected = toDateKey(selectedDate) === key;
          const hasNews = availableDates.has(key);
          const isToday = toDateKey(new Date()) === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => onSelect(d)}
              style={{
                width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <View style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? colors.primary : isToday ? colors.primaryMuted : 'transparent',
                borderWidth: isToday && !isSelected ? 1 : 0,
                borderColor: colors.primary,
              }}>
                <Text style={{
                  color: isSelected ? '#fff' : colors.text,
                  fontSize: 13, fontWeight: isSelected ? '700' : '400',
                }}>{day}</Text>
                {hasNews && !isSelected && (
                  <View style={{
                    position: 'absolute', bottom: 2, width: 4, height: 4,
                    borderRadius: 2, backgroundColor: colors.primary,
                  }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── GS Tags Row ─────────────────────────────────────────────────────────────
function GSTags({ tags, relevance, category }: { tags?: string[]; relevance?: string; category?: string }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {category && (
        <View style={{ backgroundColor: CATEGORY_COLORS[category] || '#6B7280', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{category.replace(/_/g, ' ')}</Text>
        </View>
      )}
      {(tags || []).map(tag => {
        const c = GS_COLORS[tag] || { bg: '#6B7280', text: '#fff' };
        return (
          <View key={tag} style={{ backgroundColor: c.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ color: c.text, fontSize: 10, fontWeight: '700' }}>{tag}</Text>
          </View>
        );
      })}
      {relevance && (
        <View style={{ borderWidth: 1, borderColor: '#EAB308', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
          <Text style={{ color: '#EAB308', fontSize: 10, fontWeight: '600' }}>{relevance}</Text>
        </View>
      )}
    </View>
  );
}

// ─── News Card ────────────────────────────────────────────────────────────────
function NewsCard({ item, index, total, onPress, colors, isDark, isRead }: {
  item: NewsItem; index: number; total: number;
  onPress: () => void; colors: any; isDark: boolean; isRead: boolean;
}) {
  const catColor = CATEGORY_COLORS[item.category || ''] || '#6B7280';
  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <GSTags tags={item.gs_tags} relevance={item.exam_relevance} category={item.category} />
          {isRead && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <CheckCircle size={14} color={colors.success} />
            </View>
          )}
        </View>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 6 }}
          numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={{ color: colors.subText, fontSize: 12, lineHeight: 18 }} numberOfLines={2}>
          {item.content}
        </Text>
        {item.source && (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: catColor, marginRight: 5 }} />
            <Text style={{ color: colors.subText, fontSize: 11 }}>{item.source}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Article Detail View ──────────────────────────────────────────────────────
function ArticleDetail({ item, nextItem, index, total, onBack, onNext, colors, isDark, insets, isRead, isLiked, isDisliked, onToggleRead, onToggleLike, onToggleDislike }: {
  item: NewsItem; nextItem?: NewsItem; index: number; total: number;
  onBack: () => void; onNext: () => void;
  colors: any; isDark: boolean; insets: any;
  isRead: boolean; isLiked: boolean; isDisliked: boolean;
  onToggleRead: () => void; onToggleLike: () => void; onToggleDislike: () => void;
}) {
  const catColor = CATEGORY_COLORS[item.category || ''] || '#6B7280';

  const handleShare = async () => {
    try {
      await Share.share({ message: `${item.title}\n\n${item.content}` });
    } catch { }
  };

  // Parse content into highlight + detail sentences
  const sentences = item.content.split(/(?<=[.!?])\s+/);
  const highlights = sentences.slice(0, Math.min(2, sentences.length));
  const details = sentences.slice(Math.min(2, sentences.length));

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={{ flex: 1 }}>
      {/* Header */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.articleHeader, { paddingTop: insets.top + 4 }]}
      >
        <TouchableOpacity onPress={onBack} style={{ padding: 8 }}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Article</Text>
        <Text style={{ color: colors.subText, fontSize: 13 }}>#{index + 1}/{total}</Text>
      </BlurView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 100 }}
      >
        {/* Top card */}
        <Animated.View entering={FadeIn.duration(400)} style={{ margin: 16 }}>
          <LinearGradient
            colors={isDark ? ['#1a2332', '#131c28'] : ['#EEF2FF', '#F8FAFF']}
            style={[styles.articleTopCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} color={colors.subText} />
                <Text style={{ color: colors.subText, fontSize: 12 }}>
                  {item.date ? new Date(item.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Today'}
                </Text>
              </View>
              {item.source && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={14} color={colors.subText} />
                  <Text style={{ color: colors.subText, fontSize: 12 }}>{item.source}</Text>
                </View>
              )}
            </View>
            <Text style={{ color: catColor, fontWeight: '700', fontSize: 17, lineHeight: 24, marginBottom: 10 }}>
              {item.title}
            </Text>
            <Text style={{ color: colors.subText, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
              {item.content}
            </Text>
            <GSTags tags={item.gs_tags} relevance={item.exam_relevance} category={item.category} />
          </LinearGradient>
        </Animated.View>

        {/* Key Highlights */}
        {highlights.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.articleSection}>
            <Text style={[styles.articleSectionTitle, { color: colors.text }]}>Key Highlights:</Text>
            {highlights.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: catColor }]} />
                <Text style={[styles.bulletText, { color: colors.text }]}>{s}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Detailed Insights */}
        {details.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.articleSection}>
            <Text style={[styles.articleSectionTitle, { color: colors.text }]}>Detailed Insights:</Text>
            {details.map((s, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: colors.subText }]} />
                <Text style={[styles.bulletText, { color: colors.text }]}>{s}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Next Article */}
        {index < total - 1 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ margin: 16 }}>
            <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 8 }}>Next Article</Text>
            <TouchableOpacity
              onPress={onNext}
              style={[styles.nextArticleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 4 }} numberOfLines={2}>
                  {nextItem?.title || 'Next article'}
                </Text>
                {nextItem?.source && (
                  <Text style={{ color: colors.subText, fontSize: 11 }}>{nextItem.source}</Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNext}
              style={[styles.readNextBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Read Next</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.articleActionBar, { paddingBottom: insets.bottom + 8 }]}
      >
        <TouchableOpacity style={styles.actionIconBtn} onPress={onToggleLike}>
          <ThumbsUp size={20} color={isLiked ? colors.success : colors.subText} fill={isLiked ? colors.success : 'transparent'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIconBtn} onPress={onToggleDislike}>
          <ThumbsDown size={20} color={isDisliked ? '#EF4444' : colors.subText} fill={isDisliked ? '#EF4444' : 'transparent'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIconBtn}>
          <Download size={20} color={colors.subText} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.actionIconBtn}>
          <Share2 size={20} color={colors.subText} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onToggleRead}
          style={[styles.markReadBtn, { borderColor: isRead ? colors.success : colors.primary }]}
        >
          <CheckCircle size={14} color={isRead ? colors.success : colors.primary} fill={isRead ? colors.success : 'transparent'} />
          <Text style={{ color: isRead ? colors.success : colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 5 }}>
            {isRead ? 'READ' : 'MARK AS READ'}
          </Text>
        </TouchableOpacity>
      </BlurView>
    </LinearGradient>
  );
}

// ─── Main News Screen ─────────────────────────────────────────────────────────
export default function NewsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newsRecords, setNewsRecords] = useState<NewsRecord[]>([]);
  const [availableDateKeys, setAvailableDateKeys] = useState<Set<string>>(new Set());
  const [articleIndex, setArticleIndex] = useState<number | null>(null);

  // MCQ state
  const [mcqs, setMcqs] = useState<MCQItem[]>([]);
  const [mcqLoading, setMcqLoading] = useState(false);
  const [showMCQModal, setShowMCQModal] = useState(false);
  const [mcqIndex, setMcqIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});

  // Persistent state for read/liked/disliked articles
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const [dislikedArticles, setDislikedArticles] = useState<Set<string>>(new Set());

  // Load persistent states from AsyncStorage
  useEffect(() => {
    const loadPersistentStates = async () => {
      try {
        const [readStr, likedStr, dislikedStr] = await Promise.all([
          AsyncStorage.getItem('news_read_articles'),
          AsyncStorage.getItem('news_liked_articles'),
          AsyncStorage.getItem('news_disliked_articles'),
        ]);
        if (readStr) setReadArticles(new Set(JSON.parse(readStr)));
        if (likedStr) setLikedArticles(new Set(JSON.parse(likedStr)));
        if (dislikedStr) setDislikedArticles(new Set(JSON.parse(dislikedStr)));
      } catch (e) {
        console.error('[News] Error loading persistent states:', e);
      }
    };
    loadPersistentStates();
  }, []);

  // Save read articles to AsyncStorage
  const saveReadArticles = async (articles: Set<string>) => {
    try {
      await AsyncStorage.setItem('news_read_articles', JSON.stringify(Array.from(articles)));
    } catch (e) {
      console.error('[News] Error saving read articles:', e);
    }
  };

  // Save liked articles to AsyncStorage
  const saveLikedArticles = async (articles: Set<string>) => {
    try {
      await AsyncStorage.setItem('news_liked_articles', JSON.stringify(Array.from(articles)));
    } catch (e) {
      console.error('[News] Error saving liked articles:', e);
    }
  };

  // Save disliked articles to AsyncStorage
  const saveDislikedArticles = async (articles: Set<string>) => {
    try {
      await AsyncStorage.setItem('news_disliked_articles', JSON.stringify(Array.from(articles)));
    } catch (e) {
      console.error('[News] Error saving disliked articles:', e);
    }
  };

  // Toggle read status
  const toggleReadArticle = (articleKey: string) => {
    const newRead = new Set(readArticles);
    if (newRead.has(articleKey)) {
      newRead.delete(articleKey);
    } else {
      newRead.add(articleKey);
    }
    setReadArticles(newRead);
    saveReadArticles(newRead);
  };

  // Toggle like status
  const toggleLikeArticle = (articleKey: string) => {
    const newLiked = new Set(likedArticles);
    const newDisliked = new Set(dislikedArticles);
    
    if (newLiked.has(articleKey)) {
      newLiked.delete(articleKey);
    } else {
      newLiked.add(articleKey);
      newDisliked.delete(articleKey);
    }
    
    setLikedArticles(newLiked);
    setDislikedArticles(newDisliked);
    saveLikedArticles(newLiked);
    saveDislikedArticles(newDisliked);
  };

  // Toggle dislike status
  const toggleDislikeArticle = (articleKey: string) => {
    const newLiked = new Set(likedArticles);
    const newDisliked = new Set(dislikedArticles);
    
    if (newDisliked.has(articleKey)) {
      newDisliked.delete(articleKey);
    } else {
      newDisliked.add(articleKey);
      newLiked.delete(articleKey);
    }
    
    setLikedArticles(newLiked);
    setDislikedArticles(newDisliked);
    saveLikedArticles(newLiked);
    saveDislikedArticles(newDisliked);
  };

  // Handle back button when viewing an article
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (articleIndex !== null) {
        setArticleIndex(null);
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [articleIndex]);

  // Fetch all records (limited) to know which dates have news
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('current_affairs_news' as any)
        .select('id, fetched_at, region, categories, total_items')
        .order('fetched_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const records = (data || []) as unknown as NewsRecord[];
      setNewsRecords(records);
      const keys = new Set<string>();
      for (const r of records) {
        keys.add(toDateKey(new Date(r.fetched_at)));
      }
      setAvailableDateKeys(keys);
    } catch (e) {
      console.error('[News] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Fetch MCQs for selected date
  const fetchMCQs = useCallback(async (date: Date) => {
    setMcqLoading(true);
    try {
      const key = toDateKey(date);
      const { data, error } = await supabase
        .from('news_mcqs' as any)
        .select('mcqs, total')
        .eq('date', key)
        .single();
      if (!error && data) {
        setMcqs((data as any).mcqs || []);
      } else {
        setMcqs([]);
      }
    } catch {
      setMcqs([]);
    } finally {
      setMcqLoading(false);
    }
  }, []);

  useEffect(() => { fetchMCQs(selectedDate); }, [selectedDate, fetchMCQs]);

  // Filter records for selected date
  const recordsForDate = useMemo(() => {
    const key = toDateKey(selectedDate);
    return newsRecords.filter(r => toDateKey(new Date(r.fetched_at)) === key);
  }, [newsRecords, selectedDate]);

  // Flatten all news items for selected date
  const newsItems = useMemo(() => {
    const items: NewsItem[] = [];
    for (const r of recordsForDate) items.push(...flattenNews(r));
    return items;
  }, [recordsForDate]);

  const handleDateSelect = (d: Date) => {
    setSelectedDate(d);
    setShowCalendar(false);
    setArticleIndex(null);
  };

  const openMCQPractice = () => {
    if (mcqs.length === 0) return;
    setMcqIndex(0);
    setSelectedOption(null);
    setRevealed(false);
    setMcqAnswers({});
    setShowMCQModal(true);
  };

  const handleMCQNext = () => {
    if (selectedOption !== null) {
      setMcqAnswers(prev => ({ ...prev, [mcqIndex]: selectedOption }));
    }
    if (mcqIndex < mcqs.length - 1) {
      setMcqIndex(i => i + 1);
      setSelectedOption(null);
      setRevealed(false);
    } else {
      setShowMCQModal(false);
    }
  };

  // ── Build a formatted text string for sharing ──────────────────────────
  const buildNewsText = useCallback((items: NewsItem[], dateStr: string) => {
    let text = `ENLITEN AI · CURRENT AFFAIRS\nDate: ${dateStr}\n\n`;

    const byCategory: Record<string, NewsItem[]> = {};
    for (const item of items) {
      const cat = item.category || 'General';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }

    for (const [cat, catItems] of Object.entries(byCategory)) {
      text += `=== ${cat.replace(/_/g, ' ').toUpperCase()} ===\n\n`;
      catItems.forEach((item, i) => {
        text += `${i + 1}. ${item.title}\n`;
        if (item.source) text += `Source: ${item.source}\n`;
        if (item.gs_tags && item.gs_tags.length > 0) text += `Tags: ${item.gs_tags.join(', ')}\n`;
        text += `${item.content}\n\n`;
      });
    }

    text += `Generated by Enliten AI · enliten.in`;
    return text;
  }, []);

  const handleMenuShare = async () => {
    setShowMenu(false);
    if (newsItems.length === 0) {
      Alert.alert('No News', 'There is no news available to share for this date.');
      return;
    }
    try {
      const dateStr = selectedDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
      const text = buildNewsText(newsItems, dateStr);
      await Share.share({
        message: text,
        title: `Current Affairs — ${dateStr}`,
      });
    } catch (e) {
      console.error('[News] share text error', e);
      Alert.alert('Error', 'Failed to share news.');
    }
  };

  // Helper to generate unique key for article
  const getArticleKey = (item: NewsItem) => `${item.date}_${item.title}`;

  // Article detail view
  if (articleIndex !== null && newsItems[articleIndex]) {
    const currentItem = newsItems[articleIndex];
    const currentKey = getArticleKey(currentItem);
    return (
      <ArticleDetail
        item={currentItem}
        nextItem={newsItems[articleIndex + 1]}
        index={articleIndex}
        total={newsItems.length}
        onBack={() => setArticleIndex(null)}
        onNext={() => setArticleIndex(i => Math.min((i ?? 0) + 1, newsItems.length - 1))}
        colors={colors}
        isDark={isDark}
        insets={insets}
        isRead={readArticles.has(currentKey)}
        isLiked={likedArticles.has(currentKey)}
        isDisliked={dislikedArticles.has(currentKey)}
        onToggleRead={() => toggleReadArticle(currentKey)}
        onToggleLike={() => toggleLikeArticle(currentKey)}
        onToggleDislike={() => toggleDislikeArticle(currentKey)}
      />
    );
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      {/* Header */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 90}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.header, { paddingTop: insets.top + 4 }]}
      >
        <TouchableOpacity
          onPress={() => setShowCalendar(v => !v)}
          style={styles.datePicker}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
            Today, {formatDate(selectedDate)}
          </Text>
          <ChevronDown size={18} color={colors.subText} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowMenu(true)}
          style={{ padding: 6 }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MoreHorizontal size={22} color={colors.text} />
        </TouchableOpacity>
      </BlurView>

      {/* Three-dot menu bottom sheet */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={[styles.menuOverlay]}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <Animated.View
            entering={FadeInDown.duration(250)}
            style={[styles.menuSheet, { backgroundColor: colors.card }]}
          >
            {/* Date title */}
            <Text style={[styles.menuTitle, { color: colors.text }]}>
              {selectedDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Text>

            {/* Divider */}
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            {/* Share */}
            <TouchableOpacity
              onPress={handleMenuShare}
              style={styles.menuItem}
              activeOpacity={0.7}
            >
              <Share2 size={22} color={colors.text} strokeWidth={1.8} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar dropdown */}
      {showCalendar && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={[styles.calendarDropdown, {
            backgroundColor: colors.card,
            borderColor: colors.border,
            top: insets.top + 60,
          }]}
        >
          <MiniCalendar
            selectedDate={selectedDate}
            onSelect={handleDateSelect}
            availableDates={availableDateKeys}
            colors={colors}
            isDark={isDark}
          />
        </Animated.View>
      )}

      {/* News list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.subText, marginTop: 12, fontSize: 14 }}>Loading news…</Text>
        </View>
      ) : newsItems.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.center}>
          <MoreHorizontal size={48} color={colors.border} />
          <Text style={{ color: colors.subText, fontSize: 15, marginTop: 16, fontWeight: '600' }}>
            No news for {formatDate(selectedDate)}
          </Text>
          <Text style={{ color: colors.subText, fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 40 }}>
            News is fetched every 4 hours. Try another date or check back later.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={newsItems}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <NewsCard
              item={item}
              index={index}
              total={newsItems.length}
              onPress={() => setArticleIndex(index)}
              colors={colors}
              isDark={isDark}
              isRead={readArticles.has(getArticleKey(item))}
            />
          )}
          contentContainerStyle={{
            paddingTop: insets.top + 70,
            paddingBottom: insets.bottom + 100,
            paddingHorizontal: 16,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.duration(400)}>
              <MCQBanner date={toDateKey(selectedDate)} colors={colors} isDark={isDark} />
              <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 12 }}>
                {newsItems.length} articles · {recordsForDate.length} batch{recordsForDate.length !== 1 ? 'es' : ''}
              </Text>
            </Animated.View>
          }
        />
      )}

      {/* Tap-outside to close calendar */}
      {showCalendar && (
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={() => setShowCalendar(false)}
          activeOpacity={1}
        />
      )}
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  datePicker: { flexDirection: 'row', alignItems: 'center' },
  calendarDropdown: {
    position: 'absolute', left: 16, right: 16, zIndex: 100,
    borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
    paddingTop: 16,
  },
  newsCard: {
    borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 12,
    overflow: 'hidden',
  },
  articleHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  articleTopCard: {
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  articleSection: { marginHorizontal: 16, marginBottom: 16 },
  articleSectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, marginRight: 10, flexShrink: 0 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22 },
  nextArticleCard: {
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12,
  },
  readNextBtn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  articleActionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 12, gap: 8,
  },
  actionIconBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  markReadBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderRadius: 20, height: 36,
  },
  // ─── Three-dot menu sheet ───────────────────────────────────────────────────
  menuOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  menuSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingBottom: 40, paddingHorizontal: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 20,
  },
  menuTitle: {
    fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20,
  },
  menuDivider: { height: 1, marginVertical: 4 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16,
  },
  menuItemText: { fontSize: 17, fontWeight: '500' },
});
