import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, WarningCircle, Info } from "phosphor-react-native";

import { makeStyles, useTheme, fonts, spacing, radius } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

type ToastState = { show: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastState | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ show }), [show]);

  const Icon = toast?.kind === "success" ? CheckCircle : toast?.kind === "error" ? WarningCircle : Info;
  const iconColor =
    toast?.kind === "success" ? colors.success : toast?.kind === "error" ? colors.error : colors.info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.springify().damping(18)}
          exiting={FadeOutUp.duration(180)}
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.sm }]}
        >
          <View style={styles.toast} testID={`toast-${toast.kind}`}>
            <Icon color={iconColor} size={20} weight="fill" />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const useStyles = makeStyles((colors) => ({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 520,
  },
  text: {
    flex: 1,
    color: colors.onSurface,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
}));
