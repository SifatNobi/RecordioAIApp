import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from 'expo-router';
import { Theme } from '@/constants/theme';

interface ProvidersProps {
  children: React.ReactNode;
}

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Theme.colors.primaryBlue,
    background: Theme.colors.backgroundPrimary,
    card: Theme.colors.backgroundPrimary,
    text: Theme.colors.textPrimary,
    border: Theme.colors.border,
    notification: Theme.colors.primaryBlue,
  },
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider value={navigationTheme}>
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.container}>{children}</View>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
});