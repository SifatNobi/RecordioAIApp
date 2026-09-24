import { Stack } from "expo-router";
import { useTheme } from "@/src/theme";

export default function CreateLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
