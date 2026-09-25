import React, { useEffect } from 'react';

import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Theme } from '@/constants/theme';

export default function Index() {
  const { onboarding, hasHydrated } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;

    if (onboarding.completed) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [onboarding.completed, hasHydrated, router]);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: Theme.colors.backgroundPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Theme.colors.primaryBlue} />
      </View>
    );
  }

  return null;
}