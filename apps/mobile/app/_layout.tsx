import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:4000';

function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const profileChecked = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      profileChecked.current = null;
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Avoid re-checking profile on every segment change for the same session
    if (profileChecked.current === session.user.id) return;

    const checkProfile = async () => {
      try {
        const res = await fetch(`${API_URL}/v1/users/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        profileChecked.current = session.user.id;

        if (res.status === 404) {
          router.replace('/(auth)/onboarding');
        } else if (inAuthGroup) {
          router.replace('/(tabs)');
        }
      } catch {
        // Network error — let them through if already past auth
        profileChecked.current = session.user.id;
        if (inAuthGroup) {
          router.replace('/(tabs)');
        }
      }
    };

    checkProfile();
  }, [session, loading, segments]);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile/edit" options={{ title: 'Edit Profile', headerBackTitle: 'Back' }} />
      <Stack.Screen name="party/create" options={{ title: 'Create Party', headerBackTitle: 'Back' }} />
      <Stack.Screen name="party/[partyId]/index" options={{ title: 'Party Lobby', headerBackTitle: 'Back' }} />
      <Stack.Screen name="party/[partyId]/score" options={{ title: 'Score Entry', headerBackTitle: 'Lobby' }} />
      <Stack.Screen name="party/[partyId]/summary" options={{ title: 'Round Summary', headerBackTitle: 'Lobby' }} />
      <Stack.Screen name="party/[partyId]/invite" options={{ title: 'Invite Friends', headerBackTitle: 'Lobby' }} />
      <Stack.Screen name="rankup/index" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}
