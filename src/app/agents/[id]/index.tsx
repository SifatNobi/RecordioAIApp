import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, Body, Caption, Mono } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge, BadgeProps } from '@/components/Badge';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { BaseModal, ModalContent } from '@/components/Modal';
import { Input } from '@/components/Input';
import { useAppStore } from '@/store/appStore';
import {
  deleteAgentSecrets,
  isSensitiveConfigKey,
  maskSecret,
} from '@/services/credentials/secureCredentials';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AgentStatus, PhoneNumber } from '@/types';

let phoneCounter = 0;
function createPhoneNumberId(): string {
  phoneCounter += 1;
  return `ph_${Date.now()}_${phoneCounter}`;
}

export default function AgentDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const agentId = Array.isArray(rawId) ? rawId[0] : String(rawId ?? '');
  const { agents, removeAgent, updateAgent } = useAppStore();
  const router = useRouter();

  const agent = agents.find((a) => a.id === agentId);

  const [showDisconnectModal, setShowDisconnectModal] = React.useState(false);
  const [showAddPhoneModal, setShowAddPhoneModal] = React.useState(false);
  const [phoneNumberInput, setPhoneNumberInput] = React.useState('');

  if (!agent) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Agent Not Found"
          description="This agent may have been removed or the ID is invalid."
          action={{ label: 'Back to Agents', onPress: () => router.back() }}
        />
      </View>
    );
  }

  const statusVariants: Record<AgentStatus, BadgeProps['variant']> = {
    connecting: 'processing',
    connected: 'success',
    disconnected: 'default',
    error: 'error',
    syncing: 'processing',
    paused: 'warning',
  };

  const statusLabels: Record<AgentStatus, string> = {
    connecting: 'Connecting',
    connected: 'Connected',
    disconnected: 'Disconnected',
    error: 'Error',
    syncing: 'Syncing',
    paused: 'Paused',
  };

  const handleDisconnect = async () => {
    setShowDisconnectModal(false);
    // Remove the agent and wipe its keystore-held credentials.
    await deleteAgentSecrets(agent.id);
    removeAgent(agent.id);
    router.back();
  };

  const handleAddPhoneNumber = () => {
    setShowAddPhoneModal(true);
  };

  const handleSavePhoneNumber = () => {
    const parsed = phoneNumberInput.trim();
    if (!parsed) return;
    const newNumber: PhoneNumber = {
      id: createPhoneNumberId(),
      agentId: agent.id,
      number: parsed,
      direction: 'both',
      isActive: true,
      recordingConsent: {
        requireDisclosure: true,
        consentMethod: 'explicit',
      },
      processingConfig: {
        transcribe: true,
        analyze: true,
        extractProducts: true,
        extractPrices: true,
        extractFees: true,
        extractCommitments: true,
        detectDiscrepancies: true,
        generateReceipt: true,
      },
      createdAt: new Date().toISOString(),
    };
    updateAgent(agent.id, {
      phoneNumbers: [...agent.phoneNumbers, newNumber],
    });
    setPhoneNumberInput('');
    setShowAddPhoneModal(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <H1 weight="bold" color="textPrimary">{agent.name}</H1>
            <Badge variant={statusVariants[agent.status]} size="md">
              {statusLabels[agent.status]}
            </Badge>
          </View>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setShowDisconnectModal(true)}
            style={styles.disconnectButton}
          >
            <Ionicons name="link" size={16} style={{ marginRight: 4 }} />
            Disconnect
          </Button>
        </View>

        {agent.description && (
          <Body color="textSecondary" style={styles.description}>{agent.description}</Body>
        )}

        {agent.status === 'connecting' && (
          <Card variant="outlined" padding="md" style={styles.unverifiedCard}>
            <View style={styles.unverifiedHeader}>
              <Ionicons name="information-circle" size={18} color={Theme.colors.warning} />
              <Body color="textPrimary" weight="semiBold" style={styles.unverifiedTitle}>
                Connection not verified
              </Body>
            </View>
            <Caption color="textSecondary" style={styles.unverifiedBody}>
              Your configuration is saved securely on this device, but this build does
              not yet call {agent.providerId} to confirm the credentials work. The agent
              will stay in &quot;Connecting&quot; until live provider verification is
              implemented.
            </Caption>
          </Card>
        )}

        <Separator style={styles.sectionSeparator} />

        <View style={styles.section}>
          <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
            Configuration
          </H2>
          <Card variant="outlined" padding="md" style={styles.configCard}>
            <View style={styles.configRow}>
              <Caption color="textMuted">Provider</Caption>
              <Body color="textPrimary">{agent.providerId}</Body>
            </View>
            {agent.version && (
              <View style={styles.configRow}>
                <Caption color="textMuted">Agent Version</Caption>
                <Mono color="textSecondary">{agent.version}</Mono>
              </View>
            )}
            {agent.configVersion && (
              <View style={styles.configRow}>
                <Caption color="textMuted">Config Version</Caption>
                <Mono color="textSecondary">{agent.configVersion}</Mono>
              </View>
            )}
            <View style={styles.configRow}>
              <Caption color="textMuted">Created</Caption>
              <Body color="textSecondary">{formatDate(agent.createdAt)}</Body>
            </View>
            <View style={styles.configRow}>
              <Caption color="textMuted">Last Sync</Caption>
              <Body color="textSecondary">
                {agent.lastSyncAt ? formatRelativeTime(agent.lastSyncAt) : 'Never'}
              </Body>
            </View>
          </Card>
        </View>

        <Separator style={styles.sectionSeparator} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <H2 weight="semiBold" color="textPrimary">Phone Numbers</H2>
            <Button
              variant="outline"
              size="sm"
              onPress={handleAddPhoneNumber}
              style={styles.addButton}
            >
              <Ionicons name="add" size={16} style={{ marginRight: 4 }} />
              Add Number
            </Button>
          </View>

          {agent.phoneNumbers.length === 0 ? (
            <Card variant="outlined" padding="lg" style={styles.emptyPhoneCard}>
              <View style={styles.emptyPhoneContent}>
                <View style={styles.emptyPhoneIcon}>
                  <Ionicons name="call-outline" size={32} color={Theme.colors.textMuted} />
                </View>
                <H3 weight="semiBold" color="textPrimary" style={styles.emptyPhoneTitle}>
                  No Phone Numbers
                </H3>
                <Body color="textSecondary" style={styles.emptyPhoneDesc}>
                  Add a phone number to start receiving and making calls through this agent.
                </Body>
                <Button variant="primary" onPress={handleAddPhoneNumber} style={styles.emptyPhoneButton}>
                  Add Phone Number
                </Button>
              </View>
            </Card>
          ) : (
            <View style={styles.phoneNumbersList}>
              {agent.phoneNumbers.map((phone) => (
                <Card key={phone.id} variant="outlined" padding="md" style={styles.phoneCard}>
                  <View style={styles.phoneCardContent}>
                    <View style={[styles.phoneInfo, { flex: 1 }]}>
                      <View style={styles.phoneHeader}>
                        <H3 weight="semiBold" color="textPrimary">{phone.number}</H3>
                        <Badge
                          variant={phone.isActive ? 'success' : 'default'}
                          size="sm"
                        >
                          {phone.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </View>
                      <View style={styles.phoneMeta}>
                        <Caption color="textMuted">
                          {phone.direction === 'inbound'
                            ? 'Inbound only'
                            : phone.direction === 'outbound'
                            ? 'Outbound only'
                            : 'Inbound & Outbound'}
                        </Caption>
                        <Caption color="textMuted" style={{ marginLeft: Theme.spacing[3] }}>
                          Consent: {phone.recordingConsent.requireDisclosure ? 'Required' : 'Not required'}
                        </Caption>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>

        <Separator style={styles.sectionSeparator} />

        <View style={styles.section}>
          <H2 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
            Processing Configuration
          </H2>
          <Card variant="outlined" padding="md" style={styles.configCard}>
            {Object.entries(agent.configuration).map(([key, value]) => (
              <View key={key} style={styles.configRow}>
                <Caption color="textMuted">{formatKey(key)}</Caption>
                <Body color="textSecondary">
                  {isSensitiveConfigKey(key) ? maskSecret(value) : String(value)}
                </Body>
              </View>
            ))}
          </Card>
          <Caption color="textMuted" style={styles.credentialsNote}>
            Credentials are held in this device&apos;s secure keystore and are never
            written to app storage.
          </Caption>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <BaseModal visible={showDisconnectModal} onClose={() => setShowDisconnectModal(false)} size="sm">
        <ModalContent title="Disconnect Agent" onClose={() => setShowDisconnectModal(false)}>
          <View style={styles.modalContent}>
            <Body color="textSecondary" style={styles.modalText}>
              {`Are you sure you want to disconnect "${agent.name}"? This will remove the agent and all its configuration. Conversation history will be preserved.`}
            </Body>
            <View style={styles.modalActions}>
              <Button variant="ghost" fullWidth onPress={() => setShowDisconnectModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" fullWidth onPress={handleDisconnect}>
                Disconnect
              </Button>
            </View>
          </View>
        </ModalContent>
      </BaseModal>

      <BaseModal visible={showAddPhoneModal} onClose={() => setShowAddPhoneModal(false)} size="sm">
        <ModalContent title="Add Phone Number" onClose={() => setShowAddPhoneModal(false)}>
          <View style={styles.modalContent}>
            <Body color="textSecondary" style={styles.modalText}>
              Number that this agent uses to make and receive calls.
            </Body>
            <Input
              placeholder="+1 555 000 0000"
              value={phoneNumberInput}
              onChangeText={setPhoneNumberInput}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" fullWidth onPress={() => setShowAddPhoneModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" fullWidth onPress={handleSavePhoneNumber}>
                Save Number
              </Button>
            </View>
          </View>
        </ModalContent>
      </BaseModal>
    </View>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundPrimary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Theme.spacing[5],
    paddingTop: Theme.spacing[4],
    paddingBottom: Theme.spacing[10],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[4],
    gap: Theme.spacing[3],
  },
  headerLeft: {
    flex: 1,
  },
  disconnectButton: {
    marginTop: Theme.spacing[2],
  },
  description: {
    marginBottom: Theme.spacing[3],
    lineHeight: 20,
  },
  unverifiedCard: {
    marginBottom: Theme.spacing[4],
    gap: Theme.spacing[2],
  },
  unverifiedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  unverifiedTitle: {
    flex: 1,
  },
  unverifiedBody: {
    lineHeight: 18,
  },
  credentialsNote: {
    marginTop: Theme.spacing[3],
    lineHeight: 17,
  },
  sectionSeparator: {
    marginVertical: Theme.spacing[4],
  },
  section: {
    marginBottom: Theme.spacing[6],
  },
  sectionTitle: {
    marginBottom: Theme.spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[3],
  },
  addButton: {},
  configCard: {
    gap: Theme.spacing[3],
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing[2],
  },
  emptyPhoneCard: {},
  emptyPhoneContent: {
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  emptyPhoneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPhoneTitle: {
    textAlign: 'center',
  },
  emptyPhoneDesc: {
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyPhoneButton: {
    minWidth: 200,
  },
  phoneNumbersList: {
    gap: Theme.spacing[3],
  },
  phoneCard: {},
  phoneCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  phoneInfo: {},
  phoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[1],
  },
  phoneMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalContent: {
    gap: Theme.spacing[3],
  },
  modalText: {
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Theme.spacing[3],
    marginTop: Theme.spacing[2],
  },
  bottomSpacer: {
    height: 100,
  },
});
