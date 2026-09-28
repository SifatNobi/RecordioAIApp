import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, ScrollView as SV } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, Body, Caption } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge, BadgeVariant } from '@/components/Badge';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { BaseModal, ModalContent } from '@/components/Modal';
import { Input } from '@/components/Input';
import { useAppStore } from '@/store/appStore';
import { createManualDispute } from '@/services/disputes/createDispute';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DisputeStatus, DisputeDetails } from '@/types';

const STATUS_VARIANTS: Record<DisputeStatus, BadgeVariant> = {
  open: 'info',
  investigating: 'processing',
  waiting_customer: 'warning',
  waiting_business: 'warning',
  resolved: 'success',
  closed: 'default',
};

const STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  waiting_customer: 'Waiting for Customer',
  waiting_business: 'Waiting for Business',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_VARIANTS: Record<DisputeDetails['priority'], BadgeVariant> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const PRIORITIES: DisputeDetails['priority'][] = ['low', 'medium', 'high', 'critical'];

/** Status transitions a dispute can be advanced through from the detail sheet. */
const NEXT_STATUS: Partial<Record<DisputeStatus, DisputeStatus>> = {
  open: 'investigating',
  investigating: 'resolved',
  waiting_customer: 'investigating',
  waiting_business: 'investigating',
  resolved: 'closed',
};

export default function ResolveScreen() {
  const { disputes, conversations, addDispute, updateDispute } = useAppStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      open: disputes.filter((d) => d.status === 'open').length,
      investigating: disputes.filter((d) => d.status === 'investigating').length,
      resolved: disputes.filter(
        (d) => d.status === 'resolved' || d.status === 'closed'
      ).length,
    }),
    [disputes]
  );

  const selected = disputes.find((d) => d.id === selectedId) ?? null;

  const handleAdvance = (dispute: DisputeDetails) => {
    const next = NEXT_STATUS[dispute.status];
    if (!next) return;

    const patch: Partial<DisputeDetails> = { status: next };
    if (next === 'resolved') {
      patch.resolvedAt = new Date().toISOString();
    }
    updateDispute(dispute.id, patch);
  };

  const handleReopen = (dispute: DisputeDetails) => {
    updateDispute(dispute.id, { status: 'open', resolvedAt: undefined });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
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
            <H2 weight="bold" color="textPrimary">{stats.open}</H2>
          </View>
          <Separator orientation="vertical" variant="subtle" style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Caption color="textMuted">Investigating</Caption>
            <H2 weight="bold" color="textPrimary">{stats.investigating}</H2>
          </View>
          <Separator orientation="vertical" variant="subtle" style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Caption color="textMuted">Resolved</Caption>
            <H2 weight="bold" color="textPrimary">{stats.resolved}</H2>
          </View>
        </View>
      </Card>

      {disputes.length === 0 ? (
        <EmptyState
          title="NO DISPUTES"
          description={
            conversations.length === 0
              ? 'Disputes appear here when a conversation analysis detects a high-severity discrepancy, or when you raise one yourself.'
              : 'No discrepancies have been flagged in your conversations. You can still raise a dispute manually against a conversation.'
          }
          action={{
            label: conversations.length > 0 ? 'Raise Dispute' : 'View Conversations',
            onPress: () =>
              conversations.length > 0
                ? setShowCreate(true)
                : router.push('/conversations'),
          }}
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.disputesList}>
          {disputes.map((dispute) => (
            <Card
              key={dispute.id}
              variant="outlined"
              padding="md"
              style={styles.disputeCard}
              onPress={() => setSelectedId(dispute.id)}
            >
              <View style={styles.disputeHeader}>
                <View style={styles.disputeTitle}>
                  <H3 weight="semiBold" color="textPrimary">{dispute.title}</H3>
                  <Caption color="textMuted">{dispute.id}</Caption>
                </View>
                <View style={styles.disputeBadges}>
                  <Badge variant={PRIORITY_VARIANTS[dispute.priority]} size="sm">
                    {dispute.priority}
                  </Badge>
                  <Badge variant={STATUS_VARIANTS[dispute.status]} size="sm">
                    {STATUS_LABELS[dispute.status]}
                  </Badge>
                </View>
              </View>
              <Body color="textSecondary" style={styles.disputeDesc}>
                {dispute.description}
              </Body>
              <View style={styles.disputeMeta}>
                <Caption color="textMuted">
                  {dispute.conversations.length} conversation{dispute.conversations.length !== 1 ? 's' : ''}
                </Caption>
                <Caption color="textMuted" style={styles.disputeMetaSpacing}>
                  {formatRelativeTime(dispute.createdAt)}
                </Caption>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />

      <CreateDisputeModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={addDispute}
      />

      <BaseModal visible={selected !== null} onClose={() => setSelectedId(null)}>
        {selected && (
          <ModalContent title={selected.title} onClose={() => setSelectedId(null)}>
            <View style={styles.detailBadges}>
              <Badge variant={PRIORITY_VARIANTS[selected.priority]} size="sm">
                {selected.priority}
              </Badge>
              <Badge variant={STATUS_VARIANTS[selected.status]} size="sm">
                {STATUS_LABELS[selected.status]}
              </Badge>
            </View>

            <Body color="textSecondary" style={styles.modalBody}>
              {selected.description}
            </Body>

            <Separator style={styles.modalSeparator} />

            <Caption color="textMuted">Linked conversations</Caption>
            <View style={styles.linkList}>
              {selected.conversations.length === 0 ? (
                <Caption color="textMuted">None linked.</Caption>
              ) : (
                selected.conversations.map((conversationId) => {
                  const conversation = conversations.find((c) => c.id === conversationId);
                  return (
                    <Button
                      key={conversationId}
                      variant="outline"
                      fullWidth
                      style={styles.linkButton}
                      onPress={() => {
                        setSelectedId(null);
                        router.push(`/conversations/${conversationId}`);
                      }}
                    >
                      <Ionicons
                        name="document-text"
                        size={16}
                        style={{ marginRight: 6, color: Theme.colors.textPrimary }}
                      />
                      {conversation?.customer.displayName ?? conversationId}
                    </Button>
                  );
                })
              )}
            </View>

            {selected.evidence.length > 0 && (
              <>
                <Separator style={styles.modalSeparator} />
                <Caption color="textMuted">
                  Evidence attached: {selected.evidence.length} verified receipt
                  {selected.evidence.length !== 1 ? 's' : ''}
                </Caption>
              </>
            )}

            <View style={styles.modalActions}>
              {(selected.status === 'resolved' || selected.status === 'closed') && (
                <Button variant="outline" fullWidth onPress={() => handleReopen(selected)}>
                  Reopen
                </Button>
              )}
              {NEXT_STATUS[selected.status] && (
                <Button
                  variant="primary"
                  fullWidth
                  onPress={() => handleAdvance(selected)}
                >
                  Move to {STATUS_LABELS[NEXT_STATUS[selected.status]!]}
                </Button>
              )}
            </View>
          </ModalContent>
        )}
      </BaseModal>
    </ScrollView>
  );
}

function CreateDisputeModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (dispute: DisputeDetails) => void;
}) {
  const conversations = useAppStore((state) => state.conversations);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<DisputeDetails['priority']>('medium');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setConversationId(null);
    setTitle('');
    setDescription('');
    setPriority('medium');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!conversationId) {
      setError('Select the conversation this dispute relates to.');
      return;
    }
    if (title.trim().length < 3) {
      setError('Give the dispute a short title (at least 3 characters).');
      return;
    }

    const conversation = conversations.find((c) => c.id === conversationId);
    onCreate(
      createManualDispute({
        conversationId,
        title,
        description,
        priority,
        evidence: conversation?.receipt ? [conversation.receipt.id] : [],
      })
    );
    handleClose();
  };

  return (
    <BaseModal visible={visible} onClose={handleClose}>
      <ModalContent title="Raise Dispute" onClose={handleClose}>
        {conversations.length === 0 ? (
          <Body color="textSecondary" style={styles.modalBody}>
            There are no processed conversations to dispute yet. Record or paste a
            conversation first.
          </Body>
        ) : (
          <>
            <Caption color="textSecondary" style={styles.fieldLabel}>
              Conversation
            </Caption>
            <SV style={styles.conversationPicker} nestedScrollEnabled>
              {conversations.map((conversation) => {
                const active = conversation.id === conversationId;
                return (
                  <Pressable
                    key={conversation.id}
                    onPress={() => {
                      setConversationId(conversation.id);
                      setError(null);
                    }}
                    style={[styles.conversationOption, active && styles.conversationOptionActive]}
                  >
                    <Ionicons
                      name={active ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={active ? Theme.colors.primaryBlue : Theme.colors.textMuted}
                    />
                    <Body
                      color="textPrimary"
                      style={styles.conversationOptionText}
                      numberOfLines={1}
                    >
                      {conversation.customer.displayName}
                    </Body>
                  </Pressable>
                );
              })}
            </SV>

            <Input
              label="Title"
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                setError(null);
              }}
              placeholder="e.g. Refund was not processed"
              containerStyle={styles.field}
              autoCapitalize="sentences"
            />

            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What went wrong?"
              containerStyle={styles.field}
              multiline
              numberOfLines={4}
              style={styles.textarea}
              autoCapitalize="sentences"
            />

            <Caption color="textSecondary" style={styles.fieldLabel}>
              Priority
            </Caption>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((option) => (
                <Button
                  key={option}
                  variant={priority === option ? 'primary' : 'outline'}
                  size="sm"
                  style={styles.priorityButton}
                  onPress={() => setPriority(option)}
                >
                  {option}
                </Button>
              ))}
            </View>

            {error && <Caption color="error" style={styles.errorText}>{error}</Caption>}

            <View style={styles.modalActions}>
              <Button variant="ghost" fullWidth onPress={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" fullWidth onPress={handleSubmit}>
                Raise Dispute
              </Button>
            </View>
          </>
        )}
      </ModalContent>
    </BaseModal>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[2],
    gap: Theme.spacing[2],
  },
  disputeTitle: {
    flex: 1,
  },
  disputeBadges: {
    alignItems: 'flex-end',
    gap: Theme.spacing[1],
  },
  disputeDesc: {
    marginBottom: Theme.spacing[2],
  },
  disputeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disputeMetaSpacing: {
    marginLeft: Theme.spacing[3],
  },
  detailBadges: {
    flexDirection: 'row',
    gap: Theme.spacing[2],
    marginBottom: Theme.spacing[3],
  },
  modalBody: {
    marginBottom: Theme.spacing[4],
  },
  modalSeparator: {
    marginVertical: Theme.spacing[3],
  },
  linkList: {
    gap: Theme.spacing[2],
    marginTop: Theme.spacing[2],
  },
  linkButton: {
    justifyContent: 'flex-start',
  },
  fieldLabel: {
    marginBottom: Theme.spacing[2],
  },
  conversationPicker: {
    maxHeight: 180,
    marginBottom: Theme.spacing[4],
  },
  conversationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
    paddingVertical: Theme.spacing[3],
    paddingHorizontal: Theme.spacing[3],
    borderRadius: Theme.borderRadius.base,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    marginBottom: Theme.spacing[2],
  },
  conversationOptionActive: {
    borderColor: Theme.colors.primaryBlue,
    backgroundColor: 'rgba(0, 102, 255, 0.08)',
  },
  conversationOptionText: {
    flex: 1,
  },
  field: {
    marginBottom: Theme.spacing[4],
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: Theme.spacing[2],
    marginBottom: Theme.spacing[3],
  },
  priorityButton: {
    flex: 1,
  },
  errorText: {
    marginBottom: Theme.spacing[3],
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
