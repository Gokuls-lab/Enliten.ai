
import { useExam } from '@/contexts/ExamContext';
import { useTheme } from '@/contexts/ThemeContext';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import {
  ChartBar as BarChart3,
  BookOpen,
  History,
  Home,
  Newspaper,
  NotepadText,
  User
} from 'lucide-react-native';
import React from 'react';
import {
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


// Responsive utility functions
const { width, height } = Dimensions.get('window');
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;
const hs = (size: number) => (width / guidelineBaseWidth) * size;
const vs = (size: number) => (height / guidelineBaseHeight) * size;
const ms = (size: number, factor = 0.5) => size + (hs(size) - size) * factor;


export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const { exam, loading } = useExam();
  const insets = useSafeAreaInsets();

  if (!loading && !exam) {
    return <Redirect href="/exam-selection" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary, // Dynamic active color
        tabBarInactiveTintColor: colors.subText, // Dynamic inactive color
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: insets.bottom + 10,
          height: 70,
          borderRadius: 30, // Full pill shape
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 10,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={95}
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 30,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(30, 30, 35, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }
            ]}
            tint={isDark ? 'dark' : 'light'}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: 5,
        },
        tabBarIconStyle: {
          marginTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ size, color }) => (
            <History
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ size, color }) => (
            <BarChart3
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />




      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ size, color }) => (
            <BookOpen
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ size, color }) => (
            <NotepadText
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
            <User
              size={size}
              color={color}
              strokeWidth={2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
