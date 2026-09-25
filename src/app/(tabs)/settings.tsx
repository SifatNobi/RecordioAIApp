import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, AppState } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, H4, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Separator } from '@/components/Separator';
import { Badge } from '@/components/Badge';
import { useAppStore } from '@/store/appStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONFIG } from '@/constants/env';
import { getMicStatus, requestRecordingPermissions, MicPermissionState } from '@/services/permissions';

export default function SettingsScreen() {
  const { settings, updateSettings, resetOnboarding } = useAppStore();
  const { currentPlanId, plans } = useEntitlementStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permissionState, setPermissionState] = useState<MicPermissionState | null>(null);

  const refreshPermissions = React.useCallback(async () => {
    const state = await getMicStatus();
    setPermissionState(state);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshPermissions();
    }, 0);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPermissions();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [refreshPermissions]);

  const handleRequestPermissions = async () => {
    const state = await requestRecordingPermissions();
    setPermissionState(state);
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const currentPlan = plans.find((p) => p.id === currentPlanId);

  const handleSubscriptionPress = () => {
    router.push('/settings/subscription');
  };

  const handleResetOnboarding = () => {
    resetOnboarding();
    router.replace('/onboarding');
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">Settings</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Manage your account and preferences
        </Body>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Subscription
        </H2>
        <Card variant="outlined" padding="md" style={styles.planCard}>
          <View style={styles.planHeader}>
            <View style={styles.planInfo}>
              <H3 weight="semiBold" color="textPrimary">
                {currentPlan?.name || 'Free Tier'}
              </H3>
              <Body color="textSecondary">
                {currentPlan
                  ? `${currentPlan.price === 0 ? 'Free' : `$${currentPlan.price}/${currentPlan.billingPeriod}`}`
                  : 'No active subscription'}
              </Body>
            </View>
            {currentPlan?.isPopular && (
              <View style={styles.popularBadge}>
                <Caption color="warning" weight="semiBold">POPULAR</Caption>
              </View>
            )}
          </View>
          {currentPlan && (
            <View style={styles.planFeatures}>
              {currentPlan.features.slice(0, 3).map((feature, index) => (
                <View key={index} style={styles.planFeature}>
                  <Ionicons name="checkmark" size={14} color={Theme.colors.success} style={styles.featureCheck} />
                  <Caption color="textSecondary">{feature}</Caption>
                </View>
              ))}
              {currentPlan.features.length > 3 && (
                <Caption color="textMuted" style={styles.moreFeatures}>
                  +{currentPlan.features.length - 3} more features
                </Caption>
              )}
            </View>
          )}
          <Separator style={styles.planSeparator} />
          <Button variant="outline" fullWidth onPress={handleSubscriptionPress}>
            {currentPlan ? 'Manage Subscription' : 'View Plans'}
          </Button>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Appearance
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <H4 weight="semiBold" color="textPrimary">Theme</H4>
              <Caption color="textMuted">Choose your preferred color scheme</Caption>
            </View>
            <View style={styles.themeSelector}>
              {(['dark', 'light', 'system'] as const).map((theme) => (
                <Button
                  key={theme}
                  variant={settings.theme === theme ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => updateSettings({ theme })}
                  style={styles.themeButton}
                >
                  <Caption weight="semiBold" color={settings.theme === theme ? 'textOnPrimary' : 'textPrimary'}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Caption>
                </Button>
              ))}
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Data & Privacy
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <H4 weight="semiBold" color="textPrimary">Data Retention</H4>
              <Caption color="textMuted">How long to keep conversation data</Caption>
            </View>
            <View style={styles.retentionSelector}>
              {[30, 90, 180, 365, 730].map((days) => (
                <Button
                  key={days}
                  variant={settings.dataRetentionDays === days ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() => updateSettings({ dataRetentionDays: days })}
                  style={styles.retentionButton}
                >
                  <Caption weight="semiBold" color={settings.dataRetentionDays === days ? 'textOnPrimary' : 'textPrimary'}>
                    {days === 365 ? '1 Year' : days === 730 ? '2 Years' : `${days} Days`}
                  </Caption>
                </Button>
              ))}
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Permissions
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <H4 weight="semiBold" color="textPrimary">Microphone</H4>
              <Caption color="textMuted">Required for recording conversations</Caption>
            </View>
            {permissionState?.microphone === 'granted' ? (
              <Button variant="outline" size="sm" onPress={handleOpenSettings} style={styles.permissionButton}>
                <Caption weight="semiBold" color="success">Granted</Caption>
              </Button>
            ) : (
              <Button
                variant={permissionState?.canAskAgain === false ? 'outline' : 'primary'}
                size="sm"
                onPress={permissionState?.canAskAgain === false ? handleOpenSettings : handleRequestPermissions}
                style={styles.permissionButton}
              >
                <Caption
                  weight="semiBold"
                  color={permissionState?.canAskAgain === false ? 'warning' : 'textOnPrimary'}
                >
                  {permissionState?.canAskAgain === false ? 'Open Settings' : 'Request'}
                </Caption>
              </Button>
            )}
          </View>
          <Separator style={styles.settingSeparator} />
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <H4 weight="semiBold" color="textPrimary">Notifications</H4>
              <Caption color="textMuted">
                Shown while a recording is in progress
              </Caption>
            </View>
            <Badge
              variant={permissionState?.notifications === 'granted' ? 'success' : 'warning'}
              size="sm"
            >
              {permissionState?.notifications === 'granted' ? 'Granted' : 'Disabled'}
            </Badge>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Notifications
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <H4 weight="semiBold" color="textPrimary">Push Notifications</H4>
              <Caption color="textMuted">Receive notifications for new conversations and updates</Caption>
            </View>
            <Button
              variant={settings.notifications ? 'primary' : 'outline'}
              size="sm"
              onPress={() => updateSettings({ notifications: !settings.notifications })}
              style={styles.toggleButton}
            >
              <Caption weight="semiBold" color={settings.notifications ? 'textOnPrimary' : 'textPrimary'}>
                {settings.notifications ? 'On' : 'Off'}
              </Caption>
            </Button>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Advanced
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <H4 weight="semiBold" color="textPrimary">Auto Sync</H4>
              <Caption color="textMuted">Automatically sync data in the background</Caption>
            </View>
            <Button
              variant={settings.autoSync ? 'primary' : 'outline'}
              size="sm"
              onPress={() => updateSettings({ autoSync: !settings.autoSync })}
              style={styles.toggleButton}
            >
              <Caption weight="semiBold" color={settings.autoSync ? 'textOnPrimary' : 'textPrimary'}>
                {settings.autoSync ? 'On' : 'Off'}
              </Caption>
            </Button>
          </View>
          <Separator style={styles.settingSeparator} />
          <Button variant="ghost" fullWidth onPress={handleResetOnboarding} style={styles.dangerButton}>
            <Ionicons name="refresh" size={18} style={{ marginRight: 8 }} />
            Reset Onboarding
          </Button>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          About
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <View style={styles.aboutItem}>
            <Caption color="textMuted">Version</Caption>
            <Body color="textPrimary">{APP_CONFIG.version}</Body>
          </View>
          <View style={styles.aboutItem}>
            <Caption color="textMuted">Bundle ID</Caption>
            <Body color="textPrimary" style={styles.monoText}>{APP_CONFIG.bundleId}</Body>
          </View>
          <View style={styles.aboutItem}>
            <Caption color="textMuted">Support</Caption>
            <Body color="textPrimary">{APP_CONFIG.supportEmail}</Body>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Legal
        </H2>
        <Card variant="outlined" padding="md" style={styles.settingsCard}>
          <Button variant="ghost" fullWidth style={styles.legalButton} onPress={() => Linking.openURL(APP_CONFIG.privacyUrl).catch(() => {})}>
            <Ionicons name="document-text" size={18} style={{ marginRight: 8 }} />
            Privacy Policy
          </Button>
          <Button variant="ghost" fullWidth style={styles.legalButton} onPress={() => Linking.openURL(APP_CONFIG.termsUrl).catch(() => {})}>
            <Ionicons name="document-text" size={18} style={{ marginRight: 8 }} />
            Terms of Service
          </Button>
        </Card>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing[5],
    paddingTop: Theme.spacing[4],
    paddingBottom: Theme.spacing[10],
  },
  header: {
    marginBottom: Theme.spacing[6],
  },
  tagline: {
    marginTop: Theme.spacing[1],
  },
  section: {
    marginBottom: Theme.spacing[6],
  },
  sectionTitle: {
    marginBottom: Theme.spacing[3],
  },
  planCard: {
    gap: Theme.spacing[3],
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planInfo: {},
  popularBadge: {
    paddingHorizontal: Theme.spacing[2],
    paddingVertical: Theme.spacing[0.5],
    borderRadius: Theme.borderRadius.full,
    backgroundColor: 'rgba(245, 183, 0, 0.15)',
  },
  planFeatures: {
    gap: Theme.spacing[2],
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  featureCheck: {},
  moreFeatures: {
    marginTop: Theme.spacing[1],
  },
  planSeparator: {
    marginVertical: Theme.spacing[2],
  },
  settingsCard: {
    gap: Theme.spacing[3],
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
  },
  themeSelector: {
    flexDirection: 'row',
    gap: Theme.spacing[2],
    marginTop: Theme.spacing[2],
  },
  themeButton: {
    flex: 1,
  },
  retentionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[2],
    marginTop: Theme.spacing[2],
  },
  retentionButton: {
    minWidth: 80,
  },
  toggleButton: {
    minWidth: 60,
  },
  permissionButton: {
    minWidth: 100,
  },
  settingSeparator: {
    marginVertical: Theme.spacing[2],
  },
  dangerButton: {},
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing[2],
  },
  monoText: {
    fontFamily: Theme.typography.fontFamily.mono,
  },
  legalButton: {
    paddingVertical: Theme.spacing[2],
  },
  bottomSpacer: {
    height: 40,
  },
});