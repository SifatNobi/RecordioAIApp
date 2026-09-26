import React from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '@/components/Providers';
import { useAppStore } from '@/store/appStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { useRevenueCatStore } from '@/store/revenuecatStore';
import { Theme } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Keep the app usable if the splash API is unavailable.
});

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

const CONTENT_STYLE = { backgroundColor: backgroundPrimary };

const useIoniconsFont = () =>
  Font.useFonts({
    Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
  });

export default function RootLayout() {
  const initializeStores = useAppStore((s) => s.initializeStores);
  const initializeEntitlements = useEntitlementStore((s) => s.initializeEntitlements);
  const [fontsLoaded] = useIoniconsFont();

  React.useEffect(() => {
    let active = true;

    // Optional store initialization is deferred off the critical path and
    // isolated so a failure can never block first paint. RevenueCat is
    // configured exactly once here (idempotent across reloads).
    Promise.resolve()
      .then(() => {
        if (!active) return;
        initializeStores();
        initializeEntitlements();
        useRevenueCatStore.getState().initialize();
      })
      .catch(() => {});

    // Dismiss the splash once the first frame and the icon font are ready so
    // icons never flash as missing glyphs. The timer is a safety net so a
    // slow task can never leave the splash up.
    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignore hide failures.
      }
    };
    const frame = requestAnimationFrame(() => {
      if (fontsLoaded) hide();
    });
    const timeout = setTimeout(hide, 1500);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [initializeStores, initializeEntitlements, fontsLoaded]);

  return (
    <SafeAreaProvider>
      <Providers>
        <Stack screenOptions={{ headerShown: false, contentStyle: CONTENT_STYLE }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen
            name="agents/connect"
            options={{ headerShown: true, title: 'Connect Agent', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="agents/[id]"
            options={{ headerShown: true, title: 'Agent Details', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="conversations/[id]"
            options={{ headerShown: true, title: 'Conversation', ...NAV_HEADERS }}
          />
          <Stack.Screen
            name="settings/subscription"
            options={{ headerShown: true, title: 'Subscription', ...NAV_HEADERS }}
          />
        </Stack>
      </Providers>
    </SafeAreaProvider>
  );
}