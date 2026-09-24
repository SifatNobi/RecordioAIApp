import { Text, View } from "react-native";
import { Image } from "expo-image";

import { makeStyles, fonts, fontSize, spacing } from "@/src/theme";

export function Logo({ size = 40, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={{ width: size, height: size, borderRadius: 8 }}
        contentFit="contain"
      />
      {showWordmark && <Text style={styles.wordmark}>RecordioAI</Text>}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  wordmark: { color: colors.onSurface, fontFamily: fonts.bold, fontSize: fontSize.xl },
}));
