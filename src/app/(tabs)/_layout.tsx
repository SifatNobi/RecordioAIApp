import React from 'react';
import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/appStore';
import { Theme } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_BAR_CONTENT_HEIGHT = 46;

export default function TabLayout() {
  const onboarding = useAppStore((s) => s.onboarding);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const insets = useSafeAreaInsets();

  if (!hasHydrated || !onboarding.completed) {
    return null;
  }

  // Tab bar content height + system navigation bar inset + small buffer
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primaryBlue,
        tabBarInactiveTintColor: Theme.colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
        tabBarItemStyle: styles.item,
        tabBarStyle: [
          styles.bar,
          { height: tabBarHeight, paddingBottom: Math.max(insets.bottom, 8) },
        ],
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

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Theme.colors.backgroundPrimary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.border,
    paddingTop: 6,
  },
  item: {
    justifyContent: 'center',
    paddingVertical: 0,
  },
  icon: {
    marginTop: 2,
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});