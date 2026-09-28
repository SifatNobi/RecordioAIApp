import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { H1, H3, Body } from '@/components/Typography';
import { Card } from '@/components/Card';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface RecordOption {
  id: string;
  title: string;
  description: string;
  icon: IoniconName;
  color: string;
  onPress: () => void;
}

export default function CreateRecordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleRecordConversation = () => {
    router.push('/create-record/record-conversation');
  };

  const handlePhoneCall = () => {
    router.push('/create-record/phone-call');
  };

  const handlePasteTranscript = () => {
    router.push('/create-record/paste-transcript');
  };

  const options: RecordOption[] = [
    {
      id: 'record-conversation',
      title: 'Record Conversation',
      description: 'Use the device microphone to capture a live conversation.',
      icon: 'mic',
      color: Theme.colors.primaryBlue,
      onPress: handleRecordConversation,
    },
    {
      id: 'phone-call',
      title: 'Phone Call',
      description: 'Capture a call through the device microphone. Android cannot record both call sides directly — see the on-screen notes.',
      icon: 'call',
      color: Theme.colors.cyanAccent,
      onPress: handlePhoneCall,
    },
    {
      id: 'paste-transcript',
      title: 'Paste Transcript',
      description: 'Paste an existing transcript for AI analysis and verification.',
      icon: 'document-text',
      color: Theme.colors.success,
      onPress: handlePasteTranscript,
    },
  ];

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.content, { paddingTop: Theme.spacing[4] + insets.top }]}
    >
      <View style={styles.header}>
        <H1 weight="bold" color="textPrimary">Create Record</H1>
        <Body color="textSecondary" style={styles.tagline}>
          Choose how you want to create a new conversation record
        </Body>
      </View>

      <View style={styles.optionsGrid}>
        {options.map((option) => (
          <Card
            key={option.id}
            variant="outlined"
            padding="lg"
            style={styles.optionCard}
            onPress={option.onPress}
          >
            <View style={styles.optionIcon}>
              <Ionicons name={option.icon} size={32} color={option.color} />
            </View>
            <View style={styles.optionText}>
              <H3 weight="semiBold" color="textPrimary" style={styles.optionTitle}>
                {option.title}
              </H3>
              <Body color="textSecondary" style={styles.optionDescription}>
                {option.description}
              </Body>
            </View>
            <View style={styles.optionArrow}>
              <Ionicons name="chevron-forward" size={24} color={Theme.colors.textMuted} />
            </View>
          </Card>
        ))}
      </View>

      <View style={[styles.bottomSpacer, { height: 24 + insets.bottom }]} />
    </ScrollView>
  );
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
  optionsGrid: {
    gap: Theme.spacing[3],
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing[4],
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 102, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // The title/description share a flexible column so neither can push the
  // other (or the chevron) outside the card on narrow screens. Previously the
  // title was a direct row child with no shrink, so on a 360dp-wide device the
  // 28px title plus icon, gaps and chevron exceeded the card's content width
  // and the text was clipped out of view by the scroll viewport.
  optionText: {
    flex: 1,
    flexShrink: 1,
  },
  optionTitle: {
    marginBottom: Theme.spacing[1],
  },
  optionDescription: {
    lineHeight: 22,
  },
  optionArrow: {
    marginLeft: Theme.spacing[2],
  },
  bottomSpacer: {
    height: 24,
  },
});
