import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, H4, Body, Caption, Overline } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Avatar } from '@/components/Avatar';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Conversation, ConversationStatus, ProcessingStatus } from '@/types';

export default function ConversationsScreen() {
  const { conversations } = useAppStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<ConversationStatus | ProcessingStatus | 'all'>('all');

  const handleViewConversation = (conversationId: string) => {
    router.push(`/conversations/${conversationId}`);
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.customer.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.customer.phoneNumber.includes(searchQuery);

    const matchesStatus =
      filterStatus === 'all' ||
      conv.status === filterStatus ||
      conv.processingStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const statusVariants: Record<ProcessingStatus, BadgeProps['variant']> = {
    pending: 'info',
    processing: 'processing',
    completed: 'success',
    failed: 'error',
    partial: 'warning',
  };

  const statusLabels: Record<ProcessingStatus, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    partial: 'Partial',
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={false}
          colors={[Theme.colors.primaryBlue]}
          onRefresh={() => {}}
        />
      }
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">Conversations</H1>
        <Body color="textSecondary" style={styles.tagline}>
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
        </Body>
      </View>

      <Card variant="outlined" padding="md" style={styles.searchCard}>
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Ionicons name="search" size={20} color={Theme.colors.textMuted} />}
          style={styles.searchInput}
        />
      </Card>

      <View style={styles.filters}>
        {(['all', 'pending', 'processing', 'completed', 'failed', 'partial'] as const).map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'primary' : 'outline'}
            size="sm"
            onPress={() => setFilterStatus(status)}
            style={styles.filterButton}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Button>
        ))}
      </View>

      {filteredConversations.length === 0 ? (
        <EmptyState
          title={searchQuery || filterStatus !== 'all' ? 'No Matches Found' : 'NO CONVERSATIONS YET'}
          description={
            searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Conversations will appear here once your AI agent starts handling calls.'
          }
          action={
            !searchQuery && filterStatus === 'all'
              ? { label: 'Connect AI Agent', onPress: () => router.push('/agents/connect') }
              : undefined
          }
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.conversationsList}>
          {filteredConversations.map((conversation) => (
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
                      variant={statusVariants[conversation.processingStatus]}
                      size="sm"
                    >
                      {statusLabels[conversation.processingStatus]}
                    </Badge>
                    <Body color="textSecondary" style={styles.conversationDuration}>
                      {formatDuration(conversation.duration)}
                    </Body>
                    <Caption color="textMuted" style={{ marginLeft: Theme.spacing[2] }}>
                      {conversation.customer.phoneNumber}
                    </Caption>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
              </View>
            </Card>
          ))}
        </View>
      )}

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
    marginBottom: Theme.spacing[4],
  },
  tagline: {
    marginTop: Theme.spacing[1],
  },
  searchCard: {
    marginBottom: Theme.spacing[4],
  },
  searchInput: {},
  filters: {
    flexDirection: 'row',
    gap: Theme.spacing[2],
    marginBottom: Theme.spacing[4],
    flexWrap: 'wrap',
  },
  filterButton: {},
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
    flexWrap: 'wrap',
  },
  conversationDuration: {},
  emptyState: {
    marginTop: Theme.spacing[6],
  },
  bottomSpacer: {
    height: 100,
  },
});

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'processing';
  size?: 'sm' | 'md';
};