import { Platform } from "react-native";

// "unstable" is only the import path — NativeTabs is production-ready.
// Older iOS renders it transparent with content underlapping, so only iOS 26+
// uses native tabs; Android and web fall back to the classic JS <Tabs>.
export const usesNativeTabs =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
