import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, H4, Body, Caption, Overline } from '@/components/Typography';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Avatar } from '@/components/Avatar';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { useAppStore } from '@/store/appStore';
import { useEntitlementStore } from '@/store/entitlementStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Conversation } from '@/types';

export default function HomeScreen() {
  const { agents, conversations, activeAgentId } = useAppStore();
  const { hasEntitlement } = useEntitlementStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const connectedAgents = agents.filter((a) => a.status === 'connected');
  const recentConversations = conversations.slice(0, 5);

  const handleConnectAgent = () => {
    router.push('/agents/connect');
  };

  const handleViewAllConversations = () => {
    router.push('/conversations');
  };

  const handleViewAgent = (agentId: string) => {
    router.push(`/agents/${agentId}`);
  };

  const handleViewConversation = (conversationId: string) => {
    router.push(`/conversations/${conversationId}`);
  };

  if (!connectedAgents.length && !conversations.length) {
    return (
      <View style={[styles.container, { paddingTop: Theme.spacing[4] + insets.top }]}>
        <View style={styles.header}>
          <H1 weight="bold" color="textPrimary">RecordioAI</H1>
          <Body color="textSecondary" style={styles.tagline}>
            Prove What Your AI Promised.
          </Body>
        </View>

        <EmptyState
          title="NO AI AGENTS CONNECTED"
          description="Connect an AI voice agent to start creating verified conversation records."
          action={{ label: 'Connect AI Agent', onPress: handleConnectAgent }}
          style={styles.emptyState}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          colors={[Theme.colors.primaryBlue]}
          onRefresh={() => {}}
        />
      }
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">RecordioAI</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Prove What Your AI Promised.
        </Body>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <H2 weight="semiBold" color="textPrimary">Connected Agents</H2>
          {connectedAgents.length < 5 && (
            <Button variant="outline" size="sm" onPress={handleConnectAgent}>
              <Ionicons name="add" size={16} style={{ marginRight: 4 }} />
              Add Agent
            </Button>
          )}
        </View>

        {connectedAgents.length > 0 ? (
          <View style={styles.agentsList}>
            {connectedAgents.map((agent) => (
              <Card
                key={agent.id}
                variant="outlined"
                padding="md"
                style={styles.agentCard}
                onPress={() => handleViewAgent(agent.id)}
              >
                <View style={styles.agentCardContent}>
                  <View style={styles.agentIcon}>
                    <Ionicons name="hardware-chip" size={24} color={Theme.colors.primaryBlue} />
                  </View>
                  <View style={[styles.agentInfo, { flex: 1 }]}>
                    <View style={styles.agentHeader}>
                      <H4 weight="semiBold" color="textPrimary" style={styles.agentName}>
                        {agent.name}
                      </H4>
                      <Badge variant="success" size="sm">Connected</Badge>
                    </View>
                    <Body color="textSecondary" style={styles.agentMeta}>
                      {agent.phoneNumbers.length} number{agent.phoneNumbers.length !== 1 ? 's' : ''} configured
                    </Body>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card variant="outlined" padding="lg" style={styles.emptyAgentCard}>
            <View style={styles.emptyAgentContent}>
              <View style={styles.emptyAgentIcon}>
                <Ionicons name="hardware-chip-outline" size={32} color={Theme.colors.textMuted} />
              </View>
              <H3 weight="semiBold" color="textPrimary" style={styles.emptyAgentTitle}>
                No Agents Connected
              </H3>
              <Body color="textSecondary" style={styles.emptyAgentDesc}>
                Connect an AI voice agent to start recording and verifying conversations.
              </Body>
              <Button variant="primary" onPress={handleConnectAgent} style={styles.emptyAgentButton}>
                Connect AI Agent
              </Button>
            </View>
          </Card>
        )}
      </View>

      <Separator style={styles.sectionSeparator} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <H2 weight="semiBold" color="textPrimary">Recent Conversations</H2>
          {conversations.length > 5 && (
            <Button variant="ghost" size="sm" onPress={handleViewAllConversations}>
              View All
              <Ionicons name="chevron-forward" size={16} style={{ marginLeft: 4 }} />
            </Button>
          )}
        </View>

        {recentConversations.length > 0 ? (
          <View style={styles.conversationsList}>
            {recentConversations.map((conversation) => (
              <Card
                key={conversation.id}
                variant="outlined"
                padding="md"
                style={styles.conversationCard}
                onPress={() => handleViewConversation(conversation.id)}
              >
                <View style={styles.conversationCardContent}>
                  <View style={styles.conversationDirection}>
                    <Ionicons
                      name={conversation.direction === 'inbound' ? 'call' : 'call-outline'}
                      size={20}
                      color={
                        conversation.direction === 'inbound'
                          ? Theme.colors.success
                          : Theme.colors.primaryBlue
                      }
                    />
                  </View>
                  <View style={[styles.conversationInfo, { flex: 1 }]}>
                    <View style={styles.conversationHeader}>
                      <H4 weight="semiBold" color="textPrimary">
                        {conversation.customer.displayName}
                      </H4>
                      <Caption color="textMuted">
                        {formatRelativeTime(conversation.startedAt)}
                      </Caption>
                    </View>
                    <View style={styles.conversationMeta}>
                      <Badge
                        variant={getStatusVariant(conversation.processingStatus)}
                        size="sm"
                      >
                        {formatProcessingStatus(conversation.processingStatus)}
                      </Badge>
                      <Body color="textSecondary" style={styles.conversationDuration}>
                        {formatDuration(conversation.duration)}
                      </Body>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card variant="outlined" padding="lg" style={styles.emptyConversationCard}>
            <View style={styles.emptyConversationContent}>
              <View style={styles.emptyConversationIcon}>
                <Ionicons name="chatbubbles-outline" size={32} color={Theme.colors.textMuted} />
              </View>
              <H3 weight="semiBold" color="textPrimary" style={styles.emptyConversationTitle}>
                No Conversations Yet
              </H3>
              <Body color="textSecondary" style={styles.emptyConversationDesc}>
                Conversations will appear here once your AI agent starts handling calls.
              </Body>
            </View>
          </Card>
        )}
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

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getStatusVariant(
  status: Conversation['processingStatus']
): 'default' | 'success' | 'warning' | 'error' | 'info' | 'processing' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'processing';
    case 'pending':
      return 'info';
    case 'failed':
      return 'error';
    case 'partial':
      return 'warning';
    default:
      return 'default';
  }
}

function formatProcessingStatus(
  status: Conversation['processingStatus']
): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'processing':
      return 'Processing';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    case 'partial':
      return 'Partial';
    default:
      return 'Unknown';
  }
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
    marginBottom: Theme.spacing[6],
  },
  tagline: {
    marginTop: Theme.spacing[1],
  },
  section: {
    marginBottom: Theme.spacing[6],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[4],
  },
  sectionSeparator: {
    marginVertical: Theme.spacing[4],
  },
  agentsList: {
    gap: Theme.spacing[3],
  },
  agentCard: {},
  agentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  agentIcon: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
  agentMeta: {},
  emptyAgentCard: {},
  emptyAgentContent: {
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  emptyAgentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyAgentTitle: {
    textAlign: 'center',
  },
  emptyAgentDesc: {
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyAgentButton: {
    minWidth: 200,
  },
  conversationsList: {
    gap: Theme.spacing[3],
  },
  conversationCard: {},
  conversationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  conversationDirection: {
    width: 40,
    height: 40,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInfo: {},
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[1],
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  conversationDuration: {},
  emptyConversationCard: {},
  emptyConversationContent: {
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  emptyConversationIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyConversationTitle: {
    textAlign: 'center',
  },
  emptyConversationDesc: {
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyState: {
    marginTop: Theme.spacing[4],
  },
  bottomSpacer: {
    height: 100,
  },
});