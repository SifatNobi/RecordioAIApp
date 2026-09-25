import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Badge } from '@/components/Badge';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AIProvider } from '@/types';

const PROVIDERS: AIProvider[] = [
  {
    id: 'retell',
    name: 'Retell AI',
    description: 'Voice AI agents for phone calls',
    logo: 'retell',
    supportedFeatures: ['transcription', 'analysis', 'recording', 'phone_numbers', 'webhooks'],
    configSchema: {
      fields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Retell API key' },
        { key: 'agentId', label: 'Agent ID', type: 'text', required: true, placeholder: 'Enter your Agent ID' },
      ],
    },
  },
  {
    id: 'vapi',
    name: 'Vapi',
    description: 'Voice AI platform for developers',
    logo: 'vapi',
    supportedFeatures: ['transcription', 'analysis', 'recording', 'phone_numbers', 'webhooks', 'real_time'],
    configSchema: {
      fields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Vapi API key' },
        { key: 'assistantId', label: 'Assistant ID', type: 'text', required: true, placeholder: 'Enter your Assistant ID' },
      ],
    },
  },
  {
    id: 'bland',
    name: 'Bland AI',
    description: 'AI phone agents for enterprise',
    logo: 'bland',
    supportedFeatures: ['transcription', 'analysis', 'recording', 'phone_numbers', 'webhooks'],
    configSchema: {
      fields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Enter your Bland API key' },
        { key: 'pathwayId', label: 'Pathway ID', type: 'text', required: true, placeholder: 'Enter your Pathway ID' },
      ],
    },
  },
  {
    id: 'custom',
    name: 'Custom Integration',
    description: 'Generic webhook-based integration',
    logo: 'custom',
    supportedFeatures: ['transcription', 'analysis', 'webhooks'],
    configSchema: {
      fields: [
        { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://your-domain.com/webhook' },
        { key: 'secret', label: 'Webhook Secret', type: 'password', required: true, placeholder: 'Enter webhook secret' },
      ],
    },
  },
];

export default function ConnectAgentScreen() {
  const { addAgent } = useAppStore();
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [step, setStep] = useState<'select' | 'configure' | 'review'>('select');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setStep('configure');
    setConfig({});
    setErrors({});
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: '' }));
    }
  };

  const validateConfig = (): boolean => {
    if (!selectedProvider) return false;
    const newErrors: Record<string, string> = {};
    selectedProvider.configSchema.fields.forEach((field) => {
      if (field.required && !config[field.key]) {
        newErrors[field.key] = `${field.label} is required`;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateConfig()) {
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('select');
      setSelectedProvider(null);
    } else if (step === 'review') {
      setStep('configure');
    }
  };

  const handleConnect = () => {
    if (!selectedProvider) return;

    const newAgent = {
      id: `agent_${Date.now()}`,
      providerId: selectedProvider.id,
      name: config.name || selectedProvider.name,
      description: config.description,
      status: 'connecting' as const,
      configuration: config,
      phoneNumbers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addAgent(newAgent);
    router.replace(`/agents/${newAgent.id}`);
  };

  if (step === 'select') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <H1 weight="bold" color="textPrimary">Connect AI Agent</H1>
            <Body color="textSecondary" style={styles.tagline}>
              Select your AI voice agent provider to begin integration
            </Body>
          </View>

          <View style={styles.providersList}>
            {PROVIDERS.map((provider) => (
              <Card
                key={provider.id}
                variant="outlined"
                padding="md"
                style={styles.providerCard}
                onPress={() => handleProviderSelect(provider)}
              >
                <View style={styles.providerCardContent}>
                  <View style={styles.providerIcon}>
                    <Ionicons name="hardware-chip" size={28} color={Theme.colors.primaryBlue} />
                  </View>
                  <View style={[styles.providerInfo, { flex: 1 }]}>
                    <H3 weight="semiBold" color="textPrimary">{provider.name}</H3>
                    <Body color="textSecondary">{provider.description}</Body>
                    <View style={styles.providerFeatures}>
                      {provider.supportedFeatures.map((feature) => (
                        <Badge key={feature} variant="info" size="sm" style={styles.featureBadge}>
                          {feature.replace('_', ' ')}
                        </Badge>
                      ))}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={Theme.colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>

          <Card variant="outlined" padding="md" style={styles.customCard}>
            <View style={styles.customCardContent}>
              <View style={styles.customIcon}>
                <Ionicons name="construct" size={28} color={Theme.colors.textMuted} />
              </View>
              <View style={[styles.customInfo, { flex: 1 }]}>
                <H3 weight="semiBold" color="textPrimary">Custom Integration</H3>
                <Body color="textSecondary">Generic webhook-based integration for unsupported providers</Body>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Theme.colors.textMuted} />
            </View>
          </Card>
        </ScrollView>
      </View>
    );
  }

  if (step === 'configure') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Button variant="ghost" size="sm" onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={20} />
            </Button>
          </View>

          <View style={styles.providerHeader}>
            <View style={styles.providerIcon}>
              <Ionicons name="hardware-chip" size={28} color={Theme.colors.primaryBlue} />
            </View>
            <View style={styles.providerInfo}>
              <H2 weight="semiBold" color="textPrimary">{selectedProvider?.name}</H2>
              <Body color="textSecondary">Configure your integration credentials</Body>
            </View>
          </View>

          <Card variant="outlined" padding="lg" style={styles.configCard}>
            {selectedProvider?.configSchema.fields.map((field) => (
              <Input
                key={field.key}
                label={field.label}
                placeholder={field.placeholder}
                value={config[field.key] || ''}
                onChangeText={(value) => handleConfigChange(field.key, value)}
                error={errors[field.key]}
                secureTextEntry={field.type === 'password'}
                style={styles.configInput}
              />
            ))}
          </Card>

          <View style={styles.actions}>
            <Button variant="outline" fullWidth onPress={handleBack} style={styles.backAction}>
              Back
            </Button>
            <Button variant="primary" fullWidth onPress={handleNext} style={styles.nextAction}>
              Continue
              <Ionicons name="chevron-forward" size={20} style={{ marginLeft: 8 }} />
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Button variant="ghost" size="sm" onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} />
          </Button>
        </View>

        <View style={styles.reviewHeader}>
          <H1 weight="bold" color="textPrimary">Review Connection</H1>
          <Body color="textSecondary">Verify your configuration before connecting</Body>
        </View>

        <Card variant="outlined" padding="lg" style={styles.reviewCard}>
          <View style={styles.reviewItem}>
            <Caption color="textMuted">Provider</Caption>
            <Body color="textPrimary">{selectedProvider?.name}</Body>
          </View>
          {Object.entries(config).map(([key, value]) => (
            <View key={key} style={styles.reviewItem}>
              <Caption color="textMuted">{key}</Caption>
              <Body color="textPrimary" style={styles.reviewValue}>
                {value}
              </Body>
            </View>
          ))}
        </Card>

        <View style={styles.actions}>
          <Button variant="outline" fullWidth onPress={handleBack} style={styles.backAction}>
            Back
          </Button>
          <Button variant="primary" fullWidth onPress={handleConnect} style={styles.nextAction}>
            Connect Agent
            <Ionicons name="link" size={20} style={{ marginLeft: 8 }} />
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
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
  backButton: {
    padding: Theme.spacing[1],
  },
  providersList: {
    gap: Theme.spacing[3],
  },
  providerCard: {},
  providerCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {},
  providerFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[1],
    marginTop: Theme.spacing[2],
  },
  featureBadge: {},
  customCard: {
    marginTop: Theme.spacing[4],
  },
  customCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  customIcon: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customInfo: {},
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
    marginBottom: Theme.spacing[6],
  },
  configCard: {
    gap: Theme.spacing[4],
  },
  configInput: {},
  reviewHeader: {
    marginBottom: Theme.spacing[6],
  },
  reviewCard: {
    gap: Theme.spacing[4],
  },
  reviewItem: {
    gap: Theme.spacing[1],
  },
  reviewValue: {
    fontFamily: Theme.typography.fontFamily.mono,
  },
  actions: {
    flexDirection: 'row',
    gap: Theme.spacing[3],
    marginTop: Theme.spacing[4],
  },
  backAction: {
    flex: 1,
  },
  nextAction: {
    flex: 1,
  },
});