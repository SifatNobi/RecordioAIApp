import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { BaseModal, ModalContent } from '@/components/Modal';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DisputeStatus, DisputeDetails } from '@/types';

export default function ResolveScreen() {
  const { conversations } = useAppStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showCreateDispute, setShowCreateDispute] = useState(false);

  // Disputes will come from the backend API in a real integration.
  const disputes: DisputeDetails[] = [];

  const handleCreateDispute = () => {
    setShowCreateDispute(true);
  };

  const statusVariants: Record<DisputeStatus, BadgeProps['variant']> = {
    open: 'info',
    investigating: 'processing',
    waiting_customer: 'warning',
    waiting_business: 'warning',
    resolved: 'success',
    closed: 'default',
  };

  const statusLabels: Record<DisputeStatus, string> = {
    open: 'Open',
    investigating: 'Investigating',
    waiting_customer: 'Waiting for Customer',
    waiting_business: 'Waiting for Business',
    resolved: 'Resolved',
    closed: 'Closed',
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
        <H1 weight="bold" color="textPrimary">Resolve Centre</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Manage disputes and disagreements with evidence
        </Body>
      </View>

      <Card variant="outlined" padding="md" style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Caption color="textMuted">Open</Caption>
            <H2 weight="bold" color="textPrimary">0</H2>
          </View>
          <Separator orientation="vertical" variant="subtle" style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Caption color="textMuted">Investigating</Caption>
            <H2 weight="bold" color="textPrimary">0</H2>
          </View>
          <Separator orientation="vertical" variant="subtle" style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Caption color="textMuted">Resolved</Caption>
            <H2 weight="bold" color="textPrimary">0</H2>
          </View>
        </View>
      </Card>

      {disputes.length === 0 ? (
        <EmptyState
          title="NO DISPUTES"
          description="Disputes will appear here when you flag discrepancies or customers raise issues with conversations."
          action={{ label: 'Create Dispute', onPress: handleCreateDispute }}
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.disputesList}>
          {disputes.map((dispute) => (
            <Card key={dispute.id} variant="outlined" padding="md" style={styles.disputeCard}>
              <View style={styles.disputeHeader}>
                <View style={styles.disputeTitle}>
                  <H3 weight="semiBold" color="textPrimary">{dispute.title}</H3>
                  <Caption color="textMuted">{dispute.id}</Caption>
                </View>
                <Badge variant={statusVariants[dispute.status]} size="sm">
                  {statusLabels[dispute.status]}
                </Badge>
              </View>
              <Body color="textSecondary" style={styles.disputeDesc}>
                {dispute.description}
              </Body>
              <View style={styles.disputeMeta}>
                <Caption color="textMuted">
                  {dispute.conversations.length} conversation{dispute.conversations.length !== 1 ? 's' : ''}
                </Caption>
                <Caption color="textMuted" style={{ marginLeft: Theme.spacing[3] }}>
                  {formatRelativeTime(dispute.createdAt)}
                </Caption>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />

      <BaseModal visible={showCreateDispute} onClose={() => setShowCreateDispute(false)}>
        <ModalContent title="Create Dispute" onClose={() => setShowCreateDispute(false)}>
          <Body color="textSecondary" style={styles.modalBody}>
            Dispute creation is not available yet in this build. In the full
            release you can flag discrepancies from any conversation as the
            starting point of a dispute, and attached verified receipts as
            evidence.
          </Body>
          <Button variant="primary" fullWidth onPress={() => setShowCreateDispute(false)}>
            Got it
          </Button>
        </ModalContent>
      </BaseModal>
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
  statsCard: {
    marginBottom: Theme.spacing[6],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Theme.spacing[3],
  },
  statSeparator: {
    height: 24,
  },
  emptyState: {
    marginTop: Theme.spacing[4],
  },
  disputesList: {
    gap: Theme.spacing[3],
  },
  disputeCard: {},
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[2],
  },
  disputeTitle: {},
  disputeDesc: {
    marginBottom: Theme.spacing[2],
  },
  disputeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalBody: {
    marginBottom: Theme.spacing[4],
  },
  bottomSpacer: {
    height: 100,
  },
});

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'processing';
  size?: 'sm' | 'md';
};