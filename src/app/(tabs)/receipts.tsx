import React from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, H4, Body, Caption, Overline } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReceiptsScreen() {
  const { conversations } = useAppStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Filter conversations that have receipts
  const conversationsWithReceipts = conversations.filter((c) => c.receipt);

  const handleViewReceipt = (conversationId: string) => {
    router.push(`/conversations/${conversationId}`);
  };

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
        <H1 weight="bold" color="textPrimary">Conversation Receipts</H1>
        <Body color="textSecondary" style={styles.tagline}>
          {conversationsWithReceipts.length} receipt{conversationsWithReceipts.length !== 1 ? 's' : ''}
        </Body>
      </View>

      {conversationsWithReceipts.length === 0 ? (
        <EmptyState
          title="NO RECEIPTS YET"
          description="Conversation receipts are generated automatically after a conversation is processed and analyzed. Connect an AI agent to start creating receipts."
          action={{ label: 'Connect AI Agent', onPress: () => router.push('/agents/connect') }}
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.receiptsList}>
          {conversationsWithReceipts.map((conversation) => {
            const receipt = conversation.receipt!;
            return (
              <Card
                key={conversation.id}
                variant="outlined"
                padding="md"
                style={styles.receiptCard}
                onPress={() => handleViewReceipt(conversation.id)}
              >
                <View style={styles.receiptCardContent}>
                  <View style={styles.receiptIcon}>
                    <Ionicons
                      name={
                        receipt.verificationStatus === 'verified'
                          ? 'shield-checkmark'
                          : receipt.verificationStatus === 'failed'
                          ? 'shield'
                          : 'shield-half'
                      }
                      size={24}
                      color={
                        receipt.verificationStatus === 'verified'
                          ? Theme.colors.success
                          : receipt.verificationStatus === 'failed'
                          ? Theme.colors.error
                          : Theme.colors.warning
                      }
                    />
                  </View>
                  <View style={[styles.receiptInfo, { flex: 1 }]}>
                    <View style={styles.receiptHeader}>
                      <H3 weight="semiBold" color="textPrimary">
                        {conversation.customer.displayName}
                      </H3>
                      <Caption color="textMuted">
                        {formatRelativeTime(conversation.startedAt)}
                      </Caption>
                    </View>
                    <View style={styles.receiptMeta}>
                      <Badge
                        variant={
                          receipt.verificationStatus === 'verified'
                            ? 'success'
                            : receipt.verificationStatus === 'failed'
                            ? 'error'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {receipt.verificationStatus.charAt(0).toUpperCase() + receipt.verificationStatus.slice(1)}
                      </Badge>
                      <Body color="textSecondary" style={styles.receiptDuration}>
                        {formatDuration(conversation.duration)}
                      </Body>
                    </View>
                    <Caption color="textMuted" style={styles.receiptId}>
                      Receipt ID: {receipt.id.slice(0, 12)}...
                    </Caption>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Theme.colors.textMuted} />
                </View>
              </Card>
            );
          })}
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
  emptyState: {
    marginTop: Theme.spacing[4],
  },
  receiptsList: {
    gap: Theme.spacing[3],
  },
  receiptCard: {},
  receiptCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  receiptIcon: {
    width: 44,
    height: 44,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInfo: {},
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[1],
  },
  receiptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
    marginBottom: Theme.spacing[1],
  },
  receiptDuration: {},
  receiptId: {},
  bottomSpacer: {
    height: 100,
  },
});