import React from 'react';
import { Stack } from 'expo-router';
import { Theme } from '@/constants/theme';

const { backgroundPrimary, textPrimary } = Theme.colors;

const NAV_HEADERS = {
  headerStyle: { backgroundColor: backgroundPrimary },
  headerTintColor: textPrimary,
  headerTitleStyle: {
    color: textPrimary,
    fontWeight: '600' as const,
  },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};

export default function CreateRecordLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: backgroundPrimary },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="record-conversation"
        options={{ headerShown: true, title: 'Record Conversation', ...NAV_HEADERS }}
      />
      <Stack.Screen
        name="phone-call"
        options={{ headerShown: true, title: 'Phone Call', ...NAV_HEADERS }}
      />
      <Stack.Screen
        name="paste-transcript"
        options={{ headerShown: true, title: 'Paste Transcript', ...NAV_HEADERS }}
      />
    </Stack>
  );
}