import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge, BadgeProps } from '@/components/Badge';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIAgent, AgentStatus } from '@/types';

export default function AgentsScreen() {
  const { agents, removeAgent } = useAppStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleConnectAgent = () => {
    router.push('/agents/connect');
  };

  const handleViewAgent = (agentId: string) => {
    router.push(`/agents/${agentId}`);
  };

  const handleDisconnectAgent = (agentId: string) => {
    // Would show confirmation modal
    removeAgent(agentId);
  };

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

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">AI Agents</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Manage your connected AI voice agents
        </Body>
      </View>

      {agents.length === 0 ? (
        <EmptyState
          title="NO AI AGENTS CONNECTED"
          description="Connect an AI voice agent to start creating verified conversation records."
          action={{ label: 'Connect AI Agent', onPress: handleConnectAgent }}
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.agentsList}>
          {agents.map((agent) => (
            <Card
              key={agent.id}
              variant="outlined"
              padding="md"
              style={styles.agentCard}
            >
              <View style={styles.agentCardContent}>
                <View style={styles.agentIcon}>
                  <Ionicons name="hardware-chip" size={24} color={Theme.colors.primaryBlue} />
                </View>
                <View style={[styles.agentInfo, { flex: 1 }]}>
                  <View style={styles.agentHeader}>
                    <H3 weight="semiBold" color="textPrimary" style={styles.agentName}>
                      {agent.name}
                    </H3>
                    <Badge
                      variant={statusVariants[agent.status]}
                      size="sm"
                    >
                      {statusLabels[agent.status]}
                    </Badge>
                  </View>
                  {agent.description && (
                    <Body color="textSecondary" style={styles.agentDesc}>
                      {agent.description}
                    </Body>
                  )}
                  <View style={styles.agentMeta}>
                    <Caption color="textMuted">
                      {agent.phoneNumbers.length} phone number{agent.phoneNumbers.length !== 1 ? 's' : ''}
                    </Caption>
                    <Caption color="textMuted" style={{ marginLeft: Theme.spacing[3] }}>
                      Last sync: {agent.lastSyncAt ? formatRelativeTime(agent.lastSyncAt) : 'Never'}
                    </Caption>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
              </View>

              <View style={styles.agentActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => handleViewAgent(agent.id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="eye" size={16} style={{ marginRight: 4 }} />
                  View Details
                </Button>
                {agent.status === 'connected' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => handleDisconnectAgent(agent.id)}
                    style={styles.actionButton}
                  >
                    <Ionicons name="link" size={16} style={{ marginRight: 4 }} />
                    Disconnect
                  </Button>
                )}
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.fabContainer}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={handleConnectAgent}
          style={styles.fab}
        >
          <Ionicons name="add" size={20} style={{ marginRight: 8 }} />
          Connect AI Agent
        </Button>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
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
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  scrollView: {
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
  agentsList: {
    gap: Theme.spacing[3],
  },
  agentCard: {},
  agentCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing[3],
  },
  agentIcon: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Theme.spacing[1],
  },
  agentInfo: {},
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[1],
  },
  agentName: {
    flex: 1,
  },
  agentDesc: {
    marginBottom: Theme.spacing[2],
  },
  agentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  agentActions: {
    flexDirection: 'row',
    gap: Theme.spacing[2],
    marginTop: Theme.spacing[3],
    paddingTop: Theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  actionButton: {
    flex: 1,
  },
  emptyState: {
    marginTop: Theme.spacing[4],
  },
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: Theme.spacing[5],
    right: Theme.spacing[5],
    paddingBottom: Theme.spacing[4],
  },
  fab: {},
  bottomSpacer: {
    height: 100,
  },
});
