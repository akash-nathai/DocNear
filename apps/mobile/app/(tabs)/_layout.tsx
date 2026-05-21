import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function Icon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <QueryClientProvider client={qc}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0EA5E9',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: { borderTopColor: '#F3F4F6', backgroundColor: '#fff', paddingTop: 4 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen name="index"    options={{ title: 'Find Doctors', tabBarIcon: () => <Icon emoji="🔍" /> }} />
        <Tabs.Screen name="bookings" options={{ title: 'Bookings',     tabBarIcon: () => <Icon emoji="📅" /> }} />
        <Tabs.Screen name="profile"  options={{ title: 'Profile',      tabBarIcon: () => <Icon emoji="👤" /> }} />
      </Tabs>
    </QueryClientProvider>
  );
}
