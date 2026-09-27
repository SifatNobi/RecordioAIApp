const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SIGNING_MARKER = 'recordioaiInstallableSigning';

const SIGNING_BLOCK = `
// ${SIGNING_MARKER}
android {
    signingConfigs {
        release {
            enableV1SigningEnabled true
            enableV2SigningEnabled true
            enableV3SigningEnabled true
        }
    }
}
`;

function patchBuildGradle(modRequest) {
  const gradlePath = path.join(modRequest.projectRoot, 'android', 'app', 'build.gradle');

  if (!fs.existsSync(gradlePath)) {
    return;
  }

  let gradle = fs.readFileSync(gradlePath, 'utf8');

  if (gradle.includes(SIGNING_MARKER)) {
    return;
  }

  fs.writeFileSync(gradlePath, gradle.trimEnd() + '\n' + SIGNING_BLOCK);
}

function patchGradleProperties(modRequest) {
  const propertiesPath = path.join(
    modRequest.projectRoot,
    'android',
    'gradle.properties'
  );

  if (!fs.existsSync(propertiesPath)) {
    return;
  }

  let properties = fs.readFileSync(propertiesPath, 'utf8');

  if (/^expo\.useLegacyPackaging\s*=/m.test(properties)) {
    properties = properties.replace(
      /^expo\.useLegacyPackaging\s*=.*$/m,
      'expo.useLegacyPackaging=true'
    );
  } else {
    properties = properties.trimEnd() + '\nexpo.useLegacyPackaging=true\n';
  }

  fs.writeFileSync(propertiesPath, properties);
}

const withRecordioInstallableApk = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      patchBuildGradle(config.modRequest);
      patchGradleProperties(config.modRequest);
      return config;
    },
  ]);

module.exports = withRecordioInstallableApk;
