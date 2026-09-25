import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Theme } from '@/constants/theme';
import { H1, Body, Caption } from '@/components/Typography';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useOnboarding } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getMicStatus, requestRecordingPermissions, MicPermissionState } from '@/services/permissions';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: IoniconName;
  primaryColor: string;
  isPermissions?: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 0,
    title: 'Prove What Your AI Promised.',
    description:
      'RecordioAI creates cryptographically verified receipts for every AI agent conversation. Never wonder what was said or agreed upon again.',
    icon: 'shield-checkmark',
    primaryColor: Theme.colors.primaryBlue,
  },
  {
    id: 1,
    title: 'Connect Your AI Agent.',
    description:
      'Integrate with your AI voice agent platform. RecordioAI receives conversation data directly from supported providers — no manual recording required.',
    icon: 'hardware-chip',
    primaryColor: Theme.colors.brightBlue,
  },
  {
    id: 2,
    title: 'Every Conversation Gets a Receipt.',
    description:
      'Each conversation generates a Conversation Receipt with transcript, extracted products, prices, fees, promises, and commitments — all signed and verifiable.',
    icon: 'document-text',
    primaryColor: Theme.colors.cyanAccent,
  },
  {
    id: 3,
    title: 'Resolve Disagreements with Evidence.',
    description:
      'When discrepancies arise, the Resolve Centre lets you create evidence packages with full audit trails. Export verified records for compliance or dispute resolution.',
    icon: 'shield-checkmark',
    primaryColor: Theme.colors.success,
  },
  {
    id: 4,
    title: 'Allow Recording on This Device.',
    description:
      'To record live conversations from this screen, RecordioAI needs microphone access. You can grant it now or continue without — you can always enable it later in Settings.',
    icon: 'mic',
    primaryColor: Theme.colors.warning,
    isPermissions: true,
  },
  {
    id: 5,
    title: 'You Are Ready.',
    description:
      'Connect your agent, record live conversations, and get verified receipts for everything said. Your protected-first experience starts now.',
    icon: 'checkmark-circle',
    primaryColor: Theme.colors.success,
  },
];

export default function OnboardingScreen() {
  const { currentStep, nextStep, prevStep, complete } = useOnboarding();
  const router = useRouter();
  const [permState, setPermState] = useState<MicPermissionState | null>(null);
  const [requesting, setRequesting] = useState(false);

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    if (step.isPermissions) {
      getMicStatus().then(setPermState);
    }
  }, [step.isPermissions]);

  const handleContinue = () => {
    if (isLastStep) {
      complete();
      router.replace('/(tabs)');
      return;
    }
    nextStep();
  };

  const handleSkip = () => {
    complete();
    router.replace('/(tabs)');
  };

  const handleBack = () => {
    if (currentStep > 0) {
      prevStep();
    }
  };

  const handleRequestMic = async () => {
    setRequesting(true);
    try {
      const state = await requestRecordingPermissions();
      setPermState(state);
    } finally {
      setRequesting(false);
    }
  };

  const continueLabel = isLastStep
    ? 'Get Started'
    : step.isPermissions
      ? permState?.microphoneGranted
        ? 'Continue'
        : 'Continue Without Permission'
      : 'Continue';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.navRow}>
          {currentStep > 0 ? (
            <Pressable onPress={handleBack} style={styles.navButton} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={Theme.colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.navButton} />
          )}
          <Button variant="ghost" size="sm" onPress={handleSkip}>
            Skip
          </Button>
        </View>

        <View style={styles.progressContainer}>
          {ONBOARDING_STEPS.map((s, index) => (
            <View key={s.id} style={styles.progressStep}>
              <View
                style={[
                  styles.progressDot,
                  index <= currentStep && styles.progressDotActive,
                ]}
              />
              {index < ONBOARDING_STEPS.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    index < currentStep && styles.progressLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.stepContainer}>
          <View style={[styles.iconWrapper, { backgroundColor: `${step.primaryColor}1A` }]}>
            <Ionicons name={step.icon} size={64} color={step.primaryColor} />
          </View>

          <H1 weight="bold" color="textPrimary" style={styles.title}>
            {step.title}
          </H1>

          <Body color="textSecondary" style={styles.description}>
            {step.description}
          </Body>

          {step.isPermissions && (
            <Card variant="outlined" padding="md" style={styles.permissionCard}>
              <View style={styles.permissionRow}>
                <Ionicons name="mic" size={20} color={Theme.colors.primaryBlue} />
                <View style={styles.permissionInfo}>
                  <Caption color="textPrimary" weight="semiBold">Microphone access</Caption>
                  <Caption color="textMuted">
                    {permState?.microphone === 'granted'
                      ? 'Granted — live recording is available.'
                      : permState?.microphone === 'never_ask_again'
                      ? 'Blocked in system Settings. Enable it there to record live calls.'
                      : 'Not granted yet.'}
                  </Caption>
                </View>
              </View>
              {permState?.microphone === 'granted' ? (
                <Button variant="outline" fullWidth size="sm">
                  <Ionicons name="checkmark-circle" size={16} color={Theme.colors.success} style={{ marginRight: 6 }} />
                  Granted
                </Button>
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  size="sm"
                  onPress={handleRequestMic}
                  loading={requesting}
                >
                  Request Microphone Access
                </Button>
              )}
            </Card>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            variant="primary"
            fullWidth
            size="lg"
            onPress={handleContinue}
            style={styles.primaryAction}
          >
            {continueLabel}
            <Ionicons
              name={isLastStep ? 'checkmark' : 'chevron-forward'}
              size={20}
              style={{ marginLeft: 8 }}
            />
          </Button>

          {!isLastStep && (
            <Button
              variant="ghost"
              fullWidth
              size="md"
              onPress={handleSkip}
              style={styles.skipAction}
            >
              Skip
            </Button>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing[6],
    paddingTop: Theme.spacing[2],
    paddingBottom: Theme.spacing[8],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[2],
    minHeight: 40,
  },
  navButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing[6],
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
  progressDotActive: {
    backgroundColor: Theme.colors.primaryBlue,
    borderColor: Theme.colors.primaryBlue,
  },
  progressLine: {
    position: 'absolute',
    top: 5,
    left: '50%',
    right: '50%',
    height: 2,
    backgroundColor: Theme.colors.border,
  },
  progressLineActive: {
    backgroundColor: Theme.colors.primaryBlue,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Theme.spacing[6],
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing[6],
  },
  title: {
    textAlign: 'center',
    marginBottom: Theme.spacing[4],
    maxWidth: 340,
  },
  description: {
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 24,
  },
  permissionCard: {
    width: '100%',
    marginTop: Theme.spacing[6],
    gap: Theme.spacing[3],
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  permissionInfo: {
    flex: 1,
  },
  actions: {
    paddingTop: Theme.spacing[4],
    gap: Theme.spacing[3],
    width: '100%',
  },
  primaryAction: {},
  skipAction: {},
});