import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const PRIMARY = '#1B6B3A';
const INACTIVE = '#aaa';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          borderTopColor: '#e0e0e0',
          backgroundColor: '#fff',
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#fff',
          borderBottomColor: '#e0e0e0',
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: '#111',
          fontSize: 17,
        },
        headerTintColor: PRIMARY,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="compete"
        options={{
          title: 'Compete',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏆" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
