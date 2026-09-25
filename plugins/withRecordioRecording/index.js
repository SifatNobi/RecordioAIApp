const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
  withPlugins,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MODULE_PACKAGE = 'com.recordioai.app.module.RecordingServicePackage';

const RECORDING_PERMISSIONS = [
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];

const withRecordingPermissions = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const existing = new Set(
      manifest['uses-permission'].map((permission) => permission.$?.['android:name'])
    );

    for (const permission of RECORDING_PERMISSIONS) {
      if (!existing.has(permission)) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
      }
    }

    const application = manifest.application?.[0];
    if (application) {
      if (!application.service) {
        application.service = [];
      }

      const hasService = application.service.some(
        (service) => service.$?.['android:name'] === '.service.RecordingForegroundService'
      );

      if (!hasService) {
        application.service.push({
          $: {
            'android:name': '.service.RecordingForegroundService',
            'android:foregroundServiceType': 'microphone',
            'android:exported': 'false',
          },
        });
      }
    }

    return config;
  });

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

const withRecordingNativeSources = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const srcRoot = path.join(__dirname, 'android');
      const androidRoot = path.join(config.modRequest.projectRoot, 'android');

      copyDirectory(
        path.join(srcRoot, 'java'),
        path.join(androidRoot, 'app', 'src', 'main', 'java')
      );

      copyDirectory(
        path.join(srcRoot, 'res', 'drawable'),
        path.join(androidRoot, 'app', 'src', 'main', 'res', 'drawable')
      );

      return config;
    },
  ]);

const withMainApplicationPackage = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const mainApplicationPath = path.join(
        config.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'recordioai',
        'app',
        'MainApplication.kt'
      );

      if (!fs.existsSync(mainApplicationPath)) {
        return config;
      }

      const original = fs.readFileSync(mainApplicationPath, 'utf8');

      if (original.includes(MODULE_PACKAGE)) {
        return config;
      }

      const placeholder = '// add(MyReactNativePackage())';

      if (original.includes(placeholder)) {
        const injected = original.replace(placeholder, `add(${MODULE_PACKAGE}())`);

        fs.writeFileSync(mainApplicationPath, injected);
      }

      return config;
    },
  ]);

const withRecordioRecording = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, RECORDING_PERMISSIONS);
  config = withRecordingPermissions(config);
  config = withRecordingNativeSources(config);
  config = withMainApplicationPackage(config);
  return config;
};

module.exports = withRecordioRecording;