import { NetworkBanner } from '@/components/NetworkBanner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ExamProvider } from '@/contexts/ExamContext';
import { RevenueCatProvider } from '@/contexts/RevenueCatContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as NavigationBar from 'expo-navigation-bar';
import { Redirect, Stack, router } from 'expo-router';
import * as NativeSplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
const queryClient = new QueryClient();
const app_current_version_code = 18;

NativeSplashScreen.preventAutoHideAsync();

function AppContent() {
  const [checking, setChecking] = useState(true);
  const [updateState, setUpdateState] = useState<'none' | 'force' | 'optional'>('none');
  const [optionalNavigated, setOptionalNavigated] = useState(false);
  const { loading, loginRequired } = useAuth();
  const { isDark, colors } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBackgroundColorAsync('#ffffff00');
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
    }
  }, [isDark]);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const { data, error } = await supabase
          .from('app_versions')
          .select('version_code, force_update')
          .eq('platform', platform)
          .order('version_code', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error checking for updates:', error);
        }

        if (data && data.version_code > app_current_version_code) {
          if (data.force_update) {
            setUpdateState('force');
          } else {
            setUpdateState('optional');
          }
        }
      } catch (err) {
        console.error('Unexpected error checking for updates:', err);
      } finally {
        setChecking(false);
      }
    };

    checkUpdate();
  }, []);

  useEffect(() => {
    if (!loading && !checking) {
      NativeSplashScreen.hideAsync();
    }
  }, [loading, checking]);

  useEffect(() => {
    if (updateState === 'optional' && !loading && !checking && !optionalNavigated) {
      setOptionalNavigated(true);
      setTimeout(() => {
        router.push('/update');
      }, 500);
    }
  }, [updateState, loading, checking, optionalNavigated]);

  // Global Session Manager: forcefully log out if required
  useEffect(() => {
    if (!loading && !checking && loginRequired) {
      console.log('[AppContent] Login required but user is elsewhere. Redirecting to auth.');
      // Delay slightly to avoid React state update collisions while rendering
      setTimeout(() => {
        // We only want to alert if they were actually in the app (not on initial boot)
        // If they had a session but now it's null, or if they just couldn't fetch the user
        router.replace('/auth');
      }, 100);
    }
  }, [loading, checking, loginRequired]);

  console.log('AppContent render:', { loading, checking, updateState });
  if (loading || checking) {
    return null; // Keep Native Splash visible
  }

  // Ensure the root navigator is always mounted
  // We can conditionally redirect, but we must return the Stack
  if (updateState === 'force') {
    // We intentionally don't return here, but let the render fall through to the Stack
    // and include a Redirect logic below or rely on the Redirect component in the JSX
  }

  return (
    <>
      {updateState === 'force' && <Redirect href="/update" />}
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background }
      }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="exam-selection" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="flashcards" options={{ headerShown: false }} />
        <Stack.Screen name="mock-interview" options={{ headerShown: true, title: 'Mock Interview', animation: 'slide_from_right', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '700' } }} />
        <Stack.Screen name="pdf-viewer" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="update" options={{ gestureEnabled: false }} />

      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor="transparent" translucent />
      <NetworkBanner />
    </>
  );
}


export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RevenueCatProvider>
            <ExamProvider>
              <AppContent />
            </ExamProvider>
          </RevenueCatProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
