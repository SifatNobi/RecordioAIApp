import React from 'react';
import { View, ViewProps, ViewStyle, StyleSheet } from 'react-native';
import { Theme } from '@/constants/theme';
import { Typography } from './Typography';

export interface BadgeProps extends ViewProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'processing';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
}

export type BadgeVariant = NonNullable<BadgeProps['variant']>;
export type BadgeSize = NonNullable<BadgeProps['size']>;

const variantStyles: Record<BadgeVariant, ViewStyle> = {
  default: { backgroundColor: Theme.colors.surfaceElevated },
  success: { backgroundColor: 'rgba(0, 210, 106, 0.15)' },
  warning: { backgroundColor: 'rgba(245, 183, 0, 0.15)' },
  error: { backgroundColor: 'rgba(255, 77, 90, 0.15)' },
  info: { backgroundColor: 'rgba(0, 102, 255, 0.15)' },
  processing: { backgroundColor: 'rgba(63, 231, 255, 0.15)' },
};

const variantTextColors: Record<BadgeVariant, keyof typeof Theme.colors> = { default: 'textSecondary', success: 'success', warning: 'warning', error: 'error', info: 'primaryBlue', processing: 'cyanAccent' };

const sizeStyles: Record<BadgeSize, ViewStyle> = {
  sm: { paddingHorizontal: Theme.spacing[2], paddingVertical: Theme.spacing[0.5], borderRadius: Theme.borderRadius.full },
  md: { paddingHorizontal: Theme.spacing[3], paddingVertical: Theme.spacing[1], borderRadius: Theme.borderRadius.full },
};

const sizeTextStyles: Record<BadgeSize, { fontSize: number }> = { sm: { fontSize: Theme.typography.fontSize.xs }, md: { fontSize: Theme.typography.fontSize.sm } };

export const Badge = React.forwardRef<View, BadgeProps>(
  ({ variant = 'default', size = 'md', dot = false, children, style, ...props }, ref) => {
    const textColor = variantTextColors[variant];
    return (
      <View ref={ref} style={[styles.container, variantStyles[variant], sizeStyles[size], style]} {...props}>
        {dot && <View style={[styles.dot, { backgroundColor: Theme.colors[variantTextColors[variant]] }]} />}
        <Typography variant="caption" weight="medium" color={textColor} style={[sizeTextStyles[size], { marginLeft: dot ? Theme.spacing[1.5] : 0 }]}>{children}</Typography>
      </View>
    );
  }
);
Badge.displayName = 'Badge';

const styles = StyleSheet.create({ container: { flexDirection: 'row', alignItems: 'center' }, dot: { width: 6, height: 6, borderRadius: 3 } });