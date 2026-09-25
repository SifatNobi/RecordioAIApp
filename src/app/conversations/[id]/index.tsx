import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TextInput, Linking, Share } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H2, H3, H4, Body, Caption, Overline, Mono } from '@/components/Typography';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Avatar } from '@/components/Avatar';
import { Separator } from '@/components/Separator';
import { EmptyState } from '@/components/EmptyState';
import { Modal } from '@/components/Modal';
import { useAppStore } from '@/store/appStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Conversation, Transcript, TranscriptSegment, SpeakerLabel, ProcessingStatus, Commitment } from '@/types';

export default function ConversationDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  const conversationId = Array.isArray(rawId) ? rawId[0] : String(rawId ?? '');
  const { conversations, updateConversation } = useAppStore();
  const router = useRouter();

  const conversation = conversations.find((c) => c.id === conversationId);
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript' | 'products' | 'commitments' | 'receipt' | 'evidence'>('overview');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappMessage, setWhatsAppMessage] = useState('');

  if (!conversation) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Conversation Not Found"
          description="This conversation may have been removed or the ID is invalid."
          action={{ label: 'Back to Conversations', onPress: () => router.back() }}
        />
      </View>
    );
  }

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

  const tabs: { id: 'overview' | 'transcript' | 'products' | 'commitments' | 'receipt' | 'evidence'; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'overview', label: 'Overview', icon: 'information-circle' },
    { id: 'transcript', label: 'Transcript', icon: 'document-text' },
    { id: 'products', label: 'Products & Prices', icon: 'pricetag' },
    { id: 'commitments', label: 'Commitments', icon: 'checkmark-circle' },
    { id: 'receipt', label: 'Receipt', icon: 'document-text' },
    { id: 'evidence', label: 'Evidence', icon: 'shield-checkmark' },
  ];

  const handleOpenWhatsApp = () => {
    const message = `Hi ${conversation.customer.displayName}, following up on our conversation from ${formatDate(conversation.startedAt)}. Here's a summary of what we discussed...`;
    setWhatsAppMessage(message);
    setShowWhatsAppModal(true);
  };

  const handleToggleCommitment = (commitmentId: string) => {
    if (!conversation.analysis) return;
    const commitments = conversation.analysis.commitments.map((c) =>
      c.id === commitmentId
        ? { ...c, status: (c.status === 'completed' ? 'pending' : 'completed') as Commitment['status'] }
        : c
    );
    updateConversation(conversation.id, {
      analysis: { ...conversation.analysis, commitments },
    });
  };

  const handleSendWhatsApp = () => {
    const trimmed = whatsappMessage.trim();
    if (!conversation?.customer.phoneNumber || !trimmed) return;
    const waUrl = `https://wa.me/${conversation.customer.phoneNumber.replace(/[^\d]/g, '')}?text=${encodeURIComponent(trimmed)}`;
    Linking.openURL(waUrl).catch(() => {});
    setShowWhatsAppModal(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            colors={[Theme.colors.primaryBlue]}
            onRefresh={() => {}}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <H1 weight="bold" color="textPrimary" style={styles.title}>
              {conversation.customer.displayName}
            </H1>
            <View style={styles.headerMeta}>
              <Badge
                variant={statusVariants[conversation.processingStatus]}
                size="sm"
              >
                {statusLabels[conversation.processingStatus]}
              </Badge>
              <Body color="textSecondary" style={styles.directionBadge}>
                {conversation.direction === 'inbound' ? 'Inbound' : 'Outbound'}
              </Body>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Button variant="ghost" size="sm" onPress={handleOpenWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} style={{ marginRight: 4 }} />
              Follow Up
            </Button>
          </View>
        </View>

        <Card variant="outlined" padding="md" style={styles.summaryCard}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Caption color="textMuted">Duration</Caption>
              <Body color="textPrimary" weight="semiBold">
                {formatDuration(conversation.duration)}
              </Body>
            </View>
            <View style={styles.summaryItem}>
              <Caption color="textMuted">Date</Caption>
              <Body color="textPrimary" weight="semiBold">
                {formatDate(conversation.startedAt)}
              </Body>
            </View>
            <View style={styles.summaryItem}>
              <Caption color="textMuted">Phone</Caption>
              <Body color="textPrimary" weight="semiBold">
                {conversation.customer.phoneNumber}
              </Body>
            </View>
            <View style={styles.summaryItem}>
              <Caption color="textMuted">Agent</Caption>
              <Body color="textPrimary" weight="semiBold" style={{ flex: 1 }}>
                {conversation.agentId}
              </Body>
            </View>
          </View>
        </Card>

        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'primary' : 'ghost'}
              size="sm"
              onPress={() => setActiveTab(tab.id as typeof activeTab)}
              style={styles.tabButton}
            >
              <Ionicons name={tab.icon} size={16} style={{ marginRight: 4 }} />
              {tab.label}
            </Button>
          ))}
        </View>

        {activeTab === 'overview' && <OverviewTab conversation={conversation} />}
        {activeTab === 'transcript' && <TranscriptTab conversation={conversation} />}
        {activeTab === 'products' && <ProductsTab conversation={conversation} />}
        {activeTab === 'commitments' && <CommitmentsTab conversation={conversation} onToggleCommitment={handleToggleCommitment} />}
        {activeTab === 'receipt' && <ReceiptTab conversation={conversation} />}
        {activeTab === 'evidence' && <EvidenceTab conversation={conversation} />}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        size="lg"
      >
        <View style={styles.whatsappModal}>
          <H3 weight="semiBold" color="textPrimary" style={styles.modalTitle}>
            Send WhatsApp Follow-up
          </H3>
          <Body color="textSecondary" style={styles.modalDesc}>
            Review and edit the message before sending. This will open WhatsApp externally.
          </Body>
          <View style={styles.modalInputWrapper}>
            <TextInput
              value={whatsappMessage}
              onChangeText={setWhatsAppMessage}
              style={styles.modalTextArea}
              placeholder="Type your message..."
              placeholderTextColor={Theme.colors.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.modalActions}>
            <Button variant="ghost" fullWidth onPress={() => setShowWhatsAppModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" fullWidth onPress={handleSendWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} style={{ marginRight: 4, color: 'white' }} />
              Open WhatsApp
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function OverviewTab({ conversation }: { conversation: Conversation }) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Customer Information
        </H3>
        <Card variant="outlined" padding="md" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Caption color="textMuted">Name</Caption>
            <Body color="textPrimary">{conversation.customer.displayName}</Body>
          </View>
          <View style={styles.infoRow}>
            <Caption color="textMuted">Phone</Caption>
            <Body color="textPrimary">{conversation.customer.phoneNumber}</Body>
          </View>
          {conversation.customer.email && (
            <View style={styles.infoRow}>
              <Caption color="textMuted">Email</Caption>
              <Body color="textPrimary">{conversation.customer.email}</Body>
            </View>
          )}
          <View style={styles.infoRow}>
            <Caption color="textMuted">Identified Via</Caption>
            <Body color="textPrimary">
              {conversation.customer.identificationSource || 'Unknown'}
            </Body>
          </View>
          {conversation.customer.identifiedAt && (
            <View style={styles.infoRow}>
              <Caption color="textMuted">Identified At</Caption>
              <Body color="textPrimary">
                {formatRelativeTime(conversation.customer.identifiedAt)}
              </Body>
            </View>
          )}
        </Card>
      </View>

      {conversation.analysis && (
        <View style={styles.section}>
          <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
            AI Analysis Summary
          </H3>
          <Card variant="outlined" padding="md" style={styles.infoCard}>
            <Body color="textSecondary" style={styles.analysisSummary}>
              {conversation.analysis.summary}
            </Body>
            {conversation.analysis.keyPoints.length > 0 && (
              <View style={styles.keyPoints}>
                <Caption color="textMuted" style={styles.keyPointsLabel}>
                  Key Points
                </Caption>
                {conversation.analysis.keyPoints.map((point, index) => (
                  <View key={index} style={styles.keyPoint}>
                    <Caption color="textSecondary">• {point}</Caption>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      )}

      {conversation.qualityMetrics && (
        <View style={styles.section}>
          <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
            Conversation Quality
          </H3>
          <Card variant="outlined" padding="md" style={styles.infoCard}>
            <View style={styles.qualityGrid}>
              <QualityMetric
                label="Audio Clarity"
                score={conversation.qualityMetrics.audioClarity.score}
                details={conversation.qualityMetrics.audioClarity.details}
              />
              <QualityMetric
                label="Transcript Confidence"
                score={conversation.qualityMetrics.transcriptConfidence.score}
                details={conversation.qualityMetrics.transcriptConfidence.details}
              />
              <QualityMetric
                label="Disclosure Compliance"
                score={conversation.qualityMetrics.disclosureCompliance.score}
                details={conversation.qualityMetrics.disclosureCompliance.details}
              />
              <QualityMetric
                label="Commitments Coverage"
                score={conversation.qualityMetrics.commitmentsCoverage.score}
                details={conversation.qualityMetrics.commitmentsCoverage.details}
              />
            </View>
            <View style={styles.qualityDetails}>
              <Caption color="textMuted" style={styles.qualityLabel}>
                Unresolved Commitments: {conversation.qualityMetrics.unresolvedCommitments}
              </Caption>
              <Caption color="textMuted" style={styles.qualityLabel}>
                Potential Discrepancies: {conversation.qualityMetrics.potentialDiscrepancies}
              </Caption>
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

function TranscriptTab({ conversation }: { conversation: Conversation }) {
  if (!conversation.transcript) {
    return (
      <EmptyState
        title="TRANSCRIPT UNAVAILABLE"
        description={
          conversation.processingStatus === 'processing'
            ? 'The transcript is currently being processed. Please check back shortly.'
            : conversation.processingStatus === 'failed'
            ? 'Transcript processing failed. Please try again or contact support.'
            : 'No transcript is available for this conversation.'
        }
        style={styles.emptyState}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      <Card variant="outlined" padding="md" style={styles.transcriptHeader}>
        <View style={styles.transcriptMeta}>
          <Caption color="textMuted">Language</Caption>
          <Body color="textPrimary">{conversation.transcript.language}</Body>
        </View>
        <View style={styles.transcriptMeta}>
          <Caption color="textMuted">Confidence</Caption>
          <Body color="textPrimary">
            {Math.round(conversation.transcript.confidence * 100)}%
          </Body>
        </View>
        <View style={styles.transcriptMeta}>
          <Caption color="textMuted">Status</Caption>
          <Badge
            variant={
              conversation.transcript.status === 'completed'
                ? 'success'
                : conversation.transcript.status === 'processing'
                ? 'processing'
                : 'warning'
            }
            size="sm"
          >
            {conversation.transcript.status.charAt(0).toUpperCase() + conversation.transcript.status.slice(1)}
          </Badge>
        </View>
      </Card>

      <View style={styles.transcriptSegments}>
        {conversation.transcript.segments.map((segment) => (
          <TranscriptSegmentComponent key={segment.id} segment={segment} />
        ))}
      </View>
    </View>
  );
}

function TranscriptSegmentComponent({ segment }: { segment: TranscriptSegment }) {
  const speakerColors: Record<SpeakerLabel, string> = {
    AI_AGENT: Theme.colors.primaryBlue,
    CUSTOMER: Theme.colors.success,
    UNKNOWN: Theme.colors.warning,
  };

  const speakerLabels: Record<SpeakerLabel, string> = {
    AI_AGENT: 'AI AGENT',
    CUSTOMER: 'CUSTOMER',
    UNKNOWN: 'UNKNOWN SPEAKER',
  };

  return (
    <Card variant="outlined" padding="md" style={styles.segmentCard}>
      <View style={styles.segmentHeader}>
        <View style={styles.speakerInfo}>
          <View
            style={[
              styles.speakerDot,
              { backgroundColor: speakerColors[segment.speaker] },
            ]}
          />
          <H4 weight="semiBold" color="textPrimary" style={styles.speakerName}>
            {speakerLabels[segment.speaker]}
          </H4>
          <Badge variant="default" size="sm" style={styles.confidenceBadge}>
            {Math.round(segment.confidence * 100)}%
          </Badge>
        </View>
        <Caption color="textMuted" style={styles.segmentTime}>
          {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
        </Caption>
      </View>
      <Body color="textSecondary" style={styles.segmentText}>
        {segment.text}
      </Body>
    </Card>
  );
}

function ProductsTab({ conversation }: { conversation: Conversation }) {
  if (!conversation.analysis) {
    return (
      <EmptyState
        title="ANALYSIS NOT AVAILABLE"
        description="Product and price extraction requires conversation analysis to be completed."
        style={styles.emptyState}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.section}>
        <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Products
        </H3>
        {conversation.analysis.products.length === 0 ? (
          <EmptyState
            title="NO PRODUCTS EXTRACTED"
            description="No products were identified in this conversation."
            style={styles.inlineEmptyState}
          />
        ) : (
          <View style={styles.productsList}>
            {conversation.analysis.products.map((product) => (
              <Card key={product.id} variant="outlined" padding="md" style={styles.productCard}>
                <View style={styles.productHeader}>
                  <H4 weight="semiBold" color="textPrimary">{product.name}</H4>
                  <Badge variant="info" size="sm">
                    {Math.round(product.confidence * 100)}% confidence
                  </Badge>
                </View>
                {product.description && (
                  <Body color="textSecondary" style={styles.productDesc}>
                    {product.description}
                  </Body>
                )}
                {product.category && (
                  <Caption color="textMuted" style={styles.productCategory}>
                    Category: {product.category}
                  </Caption>
                )}
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Prices
        </H3>
        {conversation.analysis.prices.length === 0 ? (
          <EmptyState
            title="NO PRICES EXTRACTED"
            description="No pricing information was identified in this conversation."
            style={styles.inlineEmptyState}
          />
        ) : (
          <View style={styles.pricesList}>
            {conversation.analysis.prices.map((price) => (
              <Card key={price.id} variant="outlined" padding="md" style={styles.priceCard}>
                <View style={styles.priceHeader}>
                  <Body color="textPrimary" weight="semiBold" style={styles.priceAmount}>
                    {formatCurrency(price.amount, price.currency)}
                    {price.billingPeriod && (
                      <Caption color="textMuted" style={styles.pricePeriod}>
                        / {price.billingPeriod.replace('_', ' ')}
                      </Caption>
                    )}
                  </Body>
                  <Badge variant="info" size="sm">
                    {Math.round(price.confidence * 100)}% confidence
                  </Badge>
                </View>
                {price.context && (
                  <Caption color="textMuted" style={styles.priceContext}>
                    {price.context}
                  </Caption>
                )}
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Fees
        </H3>
        {conversation.analysis.fees.length === 0 ? (
          <EmptyState
            title="NO FEES EXTRACTED"
            description="No fees were identified in this conversation."
            style={styles.inlineEmptyState}
          />
        ) : (
          <View style={styles.feesList}>
            {conversation.analysis.fees.map((fee) => (
              <Card key={fee.id} variant="outlined" padding="md" style={styles.feeCard}>
                <View style={styles.feeHeader}>
                  <View>
                    <H4 weight="semiBold" color="textPrimary">{fee.name}</H4>
                    <Caption color="textMuted">{fee.type.replace('_', ' ')}</Caption>
                  </View>
                  <View style={styles.feeAmount}>
                    <Body color="textPrimary" weight="semiBold">
                      {formatCurrency(fee.amount, fee.currency)}
                    </Body>
                    <Badge variant="info" size="sm">
                      {Math.round(fee.confidence * 100)}% confidence
                    </Badge>
                  </View>
                </View>
                {fee.context && (
                  <Caption color="textMuted" style={styles.feeContext}>
                    {fee.context}
                  </Caption>
                )}
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function CommitmentsTab({ conversation, onToggleCommitment }: { conversation: Conversation; onToggleCommitment: (commitmentId: string) => void }) {
  if (!conversation.analysis) {
    return (
      <EmptyState
        title="ANALYSIS NOT AVAILABLE"
        description="Commitment extraction requires conversation analysis to be completed."
        style={styles.emptyState}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      {conversation.analysis.commitments.length === 0 ? (
        <EmptyState
          title="NO COMMITMENTS EXTRACTED"
          description="No commitments or promises were identified in this conversation."
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.commitmentsList}>
          {conversation.analysis.commitments.map((commitment) => (
            <Card key={commitment.id} variant="outlined" padding="md" style={styles.commitmentCard}>
              <View style={styles.commitmentHeader}>
                <View style={[styles.commitmentInfo, { flex: 1 }]}>
                  <Body color="textSecondary" style={styles.commitmentDesc}>
                    {commitment.description}
                  </Body>
                  <View style={styles.commitmentMeta}>
                    <Caption color="textMuted">
                      Promised by: {commitment.promisedBy.replace('_', ' ')}
                    </Caption>
                    {commitment.dueDate && (
                      <Caption color="textMuted" style={{ marginLeft: Theme.spacing[3] }}>
                        Due: {formatDate(commitment.dueDate)}
                      </Caption>
                    )}
                  </View>
                </View>
                <Badge
                  variant={
                    commitment.status === 'completed'
                      ? 'success'
                      : commitment.status === 'needs_review'
                      ? 'warning'
                      : commitment.status === 'failed'
                      ? 'error'
                      : 'info'
                  }
                  size="sm"
                >
                  {commitment.status.replace('_', ' ')}
                </Badge>
              </View>

              <View style={styles.commitmentFooter}>
                <Caption color="textMuted">
                  Confidence: {Math.round(commitment.confidence * 100)}%
                </Caption>
                <Button
                  variant={commitment.status === 'completed' ? 'ghost' : 'primary'}
                  size="sm"
                  onPress={() => onToggleCommitment(commitment.id)}
                >
                  {commitment.status === 'completed' ? 'Completed' : 'Mark Complete'}
                </Button>
              </View>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

function ReceiptTab({ conversation }: { conversation: Conversation }) {
  if (!conversation.receipt) {
    return (
      <EmptyState
        title="NO RECEIPT GENERATED"
        description="Conversation receipts are generated after processing is complete."
        style={styles.emptyState}
      />
    );
  }

  const receipt = conversation.receipt;

  return (
    <View style={styles.tabContent}>
      <Card variant="outlined" padding="md" style={styles.receiptCard}>
        <View style={styles.receiptHeader}>
          <View style={styles.receiptStatus}>
            <Ionicons
              name={
                receipt.verificationStatus === 'verified'
                  ? 'shield-checkmark'
                  : receipt.verificationStatus === 'failed'
                  ? 'shield'
                  : 'shield-half'
              }
              size={32}
              color={
                receipt.verificationStatus === 'verified'
                  ? Theme.colors.success
                  : receipt.verificationStatus === 'failed'
                  ? Theme.colors.error
                  : Theme.colors.warning
              }
            />
          </View>
          <View style={styles.receiptStatusInfo}>
            <H3 weight="semiBold" color="textPrimary">
              {receipt.verificationStatus.charAt(0).toUpperCase() + receipt.verificationStatus.slice(1)}
            </H3>
            <Caption color="textMuted">
              Integrity Hash: {receipt.integrityHash.slice(0, 16)}...
            </Caption>
          </View>
        </View>

        <Separator style={styles.receiptSeparator} />

        <View style={styles.receiptFields}>
          <ReceiptField label="Conversation ID" value={receipt.conversationId} />
          <ReceiptField label="Agent" value={`${receipt.agentName} (${receipt.agentId})`} />
          {receipt.agentVersion && (
            <ReceiptField label="Agent Version" value={receipt.agentVersion} />
          )}
          {receipt.configVersion && (
            <ReceiptField label="Config Version" value={receipt.configVersion} />
          )}
          <ReceiptField label="Customer" value={receipt.customer.displayName} />
          <ReceiptField label="Phone" value={receipt.phoneNumber || 'N/A'} />
          <ReceiptField label="Direction" value={receipt.direction} />
          <ReceiptField label="Date" value={formatDate(receipt.createdAt)} />
          <ReceiptField label="Duration" value={formatDuration(conversation.duration)} />
        </View>
      </Card>

      {receipt.auditHistory.length > 0 && (
        <View style={styles.section}>
          <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
            Audit History
          </H3>
          <View style={styles.auditList}>
            {receipt.auditHistory.map((event) => (
              <Card key={event.id} variant="outlined" padding="sm" style={styles.auditCard}>
                <View style={styles.auditRow}>
                  <View style={styles.auditInfo}>
                    <Caption color="textPrimary" weight="semiBold">
                      {event.action.replace('_', ' ')}
                    </Caption>
                    <Caption color="textMuted">
                      {event.actor} • {formatRelativeTime(event.timestamp)}
                    </Caption>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function EvidenceTab({ conversation }: { conversation: Conversation }) {
  const [showPdfNote, setShowPdfNote] = useState(false);

  if (!conversation.receipt || !conversation.transcript || !conversation.analysis) {
    return (
      <EmptyState
        title="EVIDENCE PACKAGE NOT AVAILABLE"
        description="Evidence packages require a complete conversation with receipt, transcript, and analysis."
        style={styles.emptyState}
      />
    );
  }

  const handleExportJson = async () => {
    const payload = JSON.stringify(
      {
        conversation,
        transcript: conversation.transcript,
        analysis: conversation.analysis,
        receipt: conversation.receipt,
      },
      null,
      2
    );
    try {
      await Share.share({
        message: payload,
        title: 'Conversation Evidence Package',
      });
    } catch {
      // Share cancelled by the user.
    }
  };

  return (
    <View style={styles.tabContent}>
      <Card variant="outlined" padding="md" style={styles.evidenceCard}>
        <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Evidence Package Contents
        </H3>
        <View style={styles.evidenceItems}>
          <EvidenceItem
            icon="document-text"
            label="Conversation Record"
            detail="Full conversation metadata and timestamps"
          />
          <EvidenceItem
            icon="document-text"
            label="Transcript"
            detail={`${conversation.transcript.segments.length} segments • ${conversation.transcript.language}`}
          />
          <EvidenceItem
            icon="analytics"
            label="AI Analysis"
            detail={`${conversation.analysis.commitments.length} commitments • ${conversation.analysis.discrepancies.length} discrepancies`}
          />
          <EvidenceItem
            icon="shield-checkmark"
            label="Conversation Receipt"
            detail={`Verification: ${conversation.receipt.verificationStatus}`}
          />
          <EvidenceItem
            icon="list"
            label="Audit Trail"
            detail={`${conversation.receipt.auditHistory.length} events`}
          />
        </View>

        <Separator style={styles.evidenceSeparator} />

        <View style={styles.evidenceActions}>
          <Button variant="outline" fullWidth onPress={() => setShowPdfNote(true)}>
            <Ionicons name="document" size={18} style={{ marginRight: 4 }} />
            Export as PDF
          </Button>
          <Button variant="outline" fullWidth onPress={handleExportJson}>
            <Ionicons name="download" size={18} style={{ marginRight: 4 }} />
            Export as JSON
          </Button>
          {showPdfNote && (
            <Caption color="textMuted" style={styles.pdfNote}>
              PDF export is planned for the full release. You can export the
              complete evidence package as JSON right now.
            </Caption>
          )}
        </View>
      </Card>

      <View style={styles.section}>
        <H3 weight="semiBold" color="textPrimary" style={styles.sectionTitle}>
          Source Categories
        </H3>
        <Card variant="outlined" padding="md" style={styles.sourceCard}>
          <View style={styles.sourceGrid}>
            <SourceCategory
              label="RECORDED FACT"
              color={Theme.colors.cyanAccent}
              description="Directly captured from conversation data"
            />
            <SourceCategory
              label="AI ANALYSIS"
              color={Theme.colors.primaryBlue}
              description="Derived from AI processing and extraction"
            />
            <SourceCategory
              label="USER ENTERED"
              color={Theme.colors.success}
              description="Manually added or confirmed by user"
            />
            <SourceCategory
              label="AGENT STATEMENT"
              color={Theme.colors.warning}
              description="Generated by the AI agent during conversation"
            />
          </View>
        </Card>
      </View>
    </View>
  );
}

function QualityMetric({ label, score, details }: { label: string; score: number; details?: string }) {
  const getColor = (score: number): keyof typeof Theme.colors => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  return (
    <View style={styles.qualityItem}>
      <Caption color="textMuted">{label}</Caption>
      <View style={styles.qualityScore}>
        <Body color={getColor(score)} weight="bold" style={styles.scoreValue}>
          {Math.round(score)}%
        </Body>
        {details && <Caption color="textMuted" style={styles.scoreDetails}>{details}</Caption>}
      </View>
    </View>
  );
}

function ReceiptField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptField}>
      <Caption color="textMuted">{label}</Caption>
      <Body color="textPrimary" style={styles.receiptValue}>{value}</Body>
    </View>
  );
}

function EvidenceItem({ icon, label, detail }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; detail: string }) {
  return (
    <View style={styles.evidenceItem}>
      <Ionicons name={icon} size={20} color={Theme.colors.primaryBlue} style={styles.evidenceIcon} />
      <View style={styles.evidenceInfo}>
        <Body color="textPrimary" weight="semiBold">{label}</Body>
        <Caption color="textMuted">{detail}</Caption>
      </View>
    </View>
  );
}

function SourceCategory({ label, color, description }: { label: string; color: string; description: string }) {
  return (
    <View style={styles.sourceItem}>
      <View style={[styles.sourceColor, { backgroundColor: color }]} />
      <Body color="textPrimary" weight="semiBold" style={styles.sourceLabel}>
        {label}
      </Body>
      <Caption color="textMuted">{description}</Caption>
    </View>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
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
  title: {
    marginBottom: Theme.spacing[2],
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  directionBadge: {
    backgroundColor: Theme.colors.surfaceElevated,
    paddingHorizontal: Theme.spacing[2],
    paddingVertical: Theme.spacing[0.5],
    borderRadius: Theme.borderRadius.full,
  },
  headerActions: {},
  summaryCard: {
    marginBottom: Theme.spacing[4],
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[4],
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    gap: Theme.spacing[1],
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[2],
    marginBottom: Theme.spacing[4],
  },
  tabButton: {
    flex: 1,
    minWidth: '30%',
  },
  tabContent: {
    gap: Theme.spacing[4],
  },
  section: {
    gap: Theme.spacing[3],
  },
  sectionTitle: {
    marginBottom: Theme.spacing[2],
  },
  infoCard: {
    gap: Theme.spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  analysisSummary: {
    marginBottom: Theme.spacing[3],
    lineHeight: 22,
  },
  keyPoints: {
    gap: Theme.spacing[1],
  },
  keyPointsLabel: {
    marginBottom: Theme.spacing[1],
  },
  keyPoint: {},
  qualityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[4],
    marginBottom: Theme.spacing[4],
  },
  qualityItem: {
    flex: 1,
    minWidth: '45%',
    gap: Theme.spacing[1],
  },
  qualityScore: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Theme.spacing[2],
  },
  scoreValue: {},
  scoreDetails: {},
  qualityDetails: {
    flexDirection: 'row',
    gap: Theme.spacing[4],
    flexWrap: 'wrap',
  },
  qualityLabel: {},
  transcriptHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[4],
  },
  transcriptMeta: {
    flex: 1,
    minWidth: '30%',
    gap: Theme.spacing[1],
  },
  transcriptSegments: {
    gap: Theme.spacing[3],
  },
  segmentCard: {},
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[2],
  },
  speakerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[2],
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  speakerName: {},
  confidenceBadge: {},
  segmentTime: {},
  segmentText: {
    lineHeight: 22,
  },
  emptyState: {
    marginTop: Theme.spacing[6],
  },
  inlineEmptyState: {
    marginTop: Theme.spacing[2],
  },
  productsList: {
    gap: Theme.spacing[3],
  },
  productCard: {},
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[2],
  },
  productDesc: {
    marginBottom: Theme.spacing[1],
  },
  productCategory: {},
  pricesList: {
    gap: Theme.spacing[3],
  },
  priceCard: {},
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[1],
  },
  priceAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Theme.spacing[1],
  },
  pricePeriod: {},
  priceContext: {},
  feesList: {
    gap: Theme.spacing[3],
  },
  feeCard: {},
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[1],
  },
  feeAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Theme.spacing[2],
  },
  feeContext: {},
  commitmentsList: {
    gap: Theme.spacing[3],
  },
  commitmentCard: {},
  commitmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing[2],
  },
  commitmentInfo: {},
  commitmentDesc: {
    marginBottom: Theme.spacing[1],
  },
  commitmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commitmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptCard: {
    gap: Theme.spacing[3],
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[3],
  },
  receiptStatus: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Theme.colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptStatusInfo: {},
  receiptSeparator: {
    marginVertical: Theme.spacing[2],
  },
  receiptFields: {
    gap: Theme.spacing[3],
  },
  receiptField: {
    gap: Theme.spacing[1],
  },
  receiptValue: {
    fontFamily: Theme.typography.fontFamily.mono,
  },
  auditList: {
    gap: Theme.spacing[2],
  },
  auditCard: {},
  auditRow: {},
  auditInfo: {
    gap: Theme.spacing[1],
  },
  evidenceCard: {
    gap: Theme.spacing[3],
  },
  evidenceItems: {
    gap: Theme.spacing[3],
  },
  evidenceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing[3],
  },
  evidenceIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidenceInfo: {
    gap: Theme.spacing[0.5],
  },
  evidenceSeparator: {
    marginVertical: Theme.spacing[2],
  },
  evidenceActions: {
    flexDirection: 'row',
    gap: Theme.spacing[3],
    flexWrap: 'wrap',
  },
  pdfNote: {
    textAlign: 'center',
    lineHeight: 18,
    width: '100%',
  },
  sourceCard: {
    gap: Theme.spacing[3],
  },
  sourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing[3],
  },
  sourceItem: {
    flex: 1,
    minWidth: '45%',
    gap: Theme.spacing[1],
  },
  sourceColor: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  sourceLabel: {},
  whatsappModal: {
    gap: Theme.spacing[4],
  },
  modalTitle: {},
  modalDesc: {
    marginBottom: Theme.spacing[2],
    lineHeight: 22,
  },
  modalInputWrapper: {
    backgroundColor: Theme.colors.backgroundSecondary,
    borderRadius: Theme.borderRadius.base,
    borderWidth: 1,
    borderColor: Theme.colors.border,
  },
  modalTextArea: {
    padding: Theme.spacing[4],
    color: Theme.colors.textPrimary,
    fontSize: Theme.typography.fontSize.base,
    lineHeight: Theme.typography.fontSize.base * Theme.typography.lineHeight.normal,
    fontFamily: Theme.typography.fontFamily.regular,
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

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'processing';
  size?: 'sm' | 'md';
};