const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BUNDLE_LINE = 'debuggableVariants = []';
const MARKER = 'bundleCommand = "export:embed"';
const MAIN_APP_PATH =
  'android/app/src/main/java/com/recordioai/app/MainApplication.kt';
const HOST_CALL_MARKER = 'context = applicationContext,';
const USE_DEV_SUPPORT_LINE = 'useDevSupport = false,';

function ensureDebugBundle(modRequest) {
  const gradlePath = path.join(
    modRequest.projectRoot,
    'android',
    'app',
    'build.gradle'
  );

  if (!fs.existsSync(gradlePath)) {
    return;
  }

  let gradle = fs.readFileSync(gradlePath, 'utf8');

  if (gradle.includes(BUNDLE_LINE)) {
    return;
  }

  if (!gradle.includes(MARKER)) {
    console.warn(
      '[withRecordioTestBundle] Marker not found in android/app/build.gradle; skipping.'
    );
    return;
  }

  // RN only packages the JS bundle for non-debuggable variants (default:
  // debug is skipped and would otherwise load from Metro). Empties the list so
  // the debug/test APK embeds assets/index.android.bundle and is self-contained.
  gradle = gradle.replace(MARKER, MARKER + '\n    ' + BUNDLE_LINE);

  fs.writeFileSync(gradlePath, gradle);
}

function ensureStandaloneMainApplication(modRequest) {
  const mainApplicationPath = path.join(modRequest.projectRoot, MAIN_APP_PATH);

  if (!fs.existsSync(mainApplicationPath)) {
    return;
  }

  let file = fs.readFileSync(mainApplicationPath, 'utf8');

  if (file.includes(USE_DEV_SUPPORT_LINE)) {
    return;
  }

  if (!file.includes(HOST_CALL_MARKER)) {
    console.warn(
      '[withRecordioTestBundle] getDefaultReactHost marker not found in MainApplication.kt; skipping.'
    );
    return;
  }

  // The debug variant is debuggable but must load its bundled JS from the APK
  // instead of connecting to Metro. force the React host to disable developer
  // support so the standalone debug/test APK never requires a dev server.
  file = file.replace(
    HOST_CALL_MARKER,
    HOST_CALL_MARKER + '\n      ' + USE_DEV_SUPPORT_LINE
  );

  fs.writeFileSync(mainApplicationPath, file);
}

const withRecordioTestBundle = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      ensureDebugBundle(config.modRequest);
      ensureStandaloneMainApplication(config.modRequest);
      return config;
    },
  ]);

module.exports = withRecordioTestBundle;