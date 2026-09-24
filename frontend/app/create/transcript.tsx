import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, fontSize, radius } from "@/src/theme";
import { AppHeader, Button } from "@/src/components/ui";
import { useDraft } from "@/src/draft";
import { CAPTURE_METHODS } from "@/src/constants";

export default function PasteTranscript() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setDraft } = useDraft();
  const [text, setText] = useState("");

  const canContinue = text.trim().length >= 10;

  const onContinue = () => {
    setDraft({ transcript: text.trim(), capture_method: CAPTURE_METHODS.transcript, audio_sha256: "" });
    router.push("/create/finalize");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      <AppHeader title="Paste Transcript" subtitle="The most reliable capture method" />
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing["3xl"] }}
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Conversation Transcript</Text>
        <Text style={styles.hint}>
          Paste the full conversation, including who said what. This exact text becomes the canonical
          record used for extraction and hashing.
        </Text>
        <TextInput
          testID="transcript-input"
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          placeholder={"Customer: I was told there would be no cancellation fee.\nRepresentative: Yes, if you cancel before the renewal date, there is no fee."}
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.count}>{text.trim().length} characters</Text>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            label="Continue"
            testID="transcript-continue"
            onPress={onContinue}
            disabled={!canContinue}
            icon={<ArrowRight color={colors.onBrandPrimary} size={18} weight="bold" />}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  label: { color: colors.onSurface, fontFamily: fonts.semibold, fontSize: fontSize.lg, marginBottom: spacing.xs },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: fontSize.base, lineHeight: 20, marginBottom: spacing.md },
  input: {
    minHeight: 260,
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  count: { color: colors.muted, fontFamily: fonts.mono, fontSize: fontSize.sm, marginTop: spacing.sm },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
}));
