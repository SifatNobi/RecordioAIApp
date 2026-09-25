import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/appStore';
import { Theme } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function TabLayout() {
  const onboarding = useAppStore((s) => s.onboarding);
  const insets = useSafeAreaInsets();

  if (!onboarding.completed) {
    return null;
  }

  const tabBarHeight = 56 + insets.bottom + 8;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primaryBlue,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: Theme.colors.backgroundPrimary,
          borderTopWidth: 1,
          borderTopColor: Theme.colors.border,
          paddingBottom: insets.bottom + 8,
          paddingTop: 4,
          height: tabBarHeight,
        },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
            index: { focused: 'home', unfocused: 'home-outline' },
            agents: { focused: 'construct', unfocused: 'construct-outline' },
            conversations: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
            resolve: { focused: 'shield-checkmark', unfocused: 'shield-checkmark-outline' },
            receipts: { focused: 'document-text', unfocused: 'document-text-outline' },
            'create-record': { focused: 'mic', unfocused: 'mic-outline' },
            settings: { focused: 'settings', unfocused: 'settings-outline' },
          };
          const icon = icons[route.name] || { focused: 'help', unfocused: 'help-outline' };
          return <Ionicons name={focused ? icon.focused : icon.unfocused} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="agents" options={{ title: 'Agents' }} />
      <Tabs.Screen name="create-record" options={{ title: 'Record' }} />
      <Tabs.Screen name="conversations" options={{ title: 'Conversations' }} />
      <Tabs.Screen name="resolve" options={{ title: 'Resolve' }} />
      <Tabs.Screen name="receipts" options={{ title: 'Receipts' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}