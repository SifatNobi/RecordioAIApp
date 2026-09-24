const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BUNDLE_LINE = 'debuggableVariants = []';
const MARKER = 'bundleCommand = "export:embed"';

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

const withRecordioTestBundle = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      ensureDebugBundle(config.modRequest);
      return config;
    },
  ]);

module.exports = withRecordioTestBundle;