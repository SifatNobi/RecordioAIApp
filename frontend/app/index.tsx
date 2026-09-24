import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";

import { useTheme } from "@/src/theme";

// Branded splash shown at "/" while the auth gate decides where to route.
export default function Index() {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logo}
        contentFit="contain"
      />
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 140, height: 140 },
});
