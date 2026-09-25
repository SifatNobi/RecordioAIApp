import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';
import { Button } from './Button';
import { Ionicons } from '@expo/vector-icons';

interface ErrorStateProps extends ViewProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  showDismiss?: boolean;
}

export const ErrorState = React.forwardRef<View, ErrorStateProps>(({ title = 'Something went wrong', message, code, onRetry, onDismiss, showRetry = true, showDismiss = false, style, ...props }, ref) => (
  <View ref={ref} style={[styles.container, style]} {...props}>
    <View style={styles.iconWrapper}><Ionicons name="warning" size={32} color={Theme.colors.error} /></View>
    <Typography variant="h3" weight="semiBold" color="textPrimary" style={styles.title}>{title}</Typography>
    {message && <Typography variant="body" color="textSecondary" style={styles.message}>{message}</Typography>}
    {code && <Typography variant="mono" color="textMuted" style={styles.code}>{code}</Typography>}
    {(showRetry && onRetry) || (showDismiss && onDismiss) ? (
      <View style={styles.actions}>
        {showRetry && onRetry && <Button variant="primary" size="md" onPress={onRetry} style={styles.retryButton}>Try Again</Button>}
        {showDismiss && onDismiss && <Button variant="ghost" size="md" onPress={onDismiss} style={styles.dismissButton}>Dismiss</Button>}
      </View>
    ) : null}
  </View>
));
ErrorState.displayName = 'ErrorState';

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Theme.spacing[6], gap: Theme.spacing[4] },
  iconWrapper: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 77, 90, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: Theme.spacing[2] },
  errorIcon: { fontSize: 32 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 280 },
  code: { textAlign: 'center', marginTop: Theme.spacing[2], paddingHorizontal: Theme.spacing[3], paddingVertical: Theme.spacing[1], backgroundColor: Theme.colors.surfaceElevated, borderRadius: Theme.borderRadius.base },
  actions: { flexDirection: 'row', gap: Theme.spacing[3], marginTop: Theme.spacing[2], flexWrap: 'wrap', justifyContent: 'center' },
  retryButton: { minWidth: 140 },
  dismissButton: { minWidth: 140 },
});