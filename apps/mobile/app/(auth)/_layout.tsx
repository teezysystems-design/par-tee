import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{ title: 'Welcome to Teezy', headerBackVisible: false }}
      />
    </Stack>
  );
}
