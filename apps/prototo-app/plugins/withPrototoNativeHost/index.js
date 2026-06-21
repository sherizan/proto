const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const NATIVE_FILES = ['AppDelegate.swift', 'PrototoDevLauncher-Bridging.h'];
const BRIDGE_IMPORT = '#import "PrototoDevLauncher-Bridging.h"';

// Copy our native host files into the generated iOS project + wire the bridging header.
const withNativeFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const iosAppDir = path.join(cfg.modRequest.platformProjectRoot, 'Prototo');
      const nativeDir = path.join(__dirname, 'native');
      for (const file of NATIVE_FILES) {
        fs.copyFileSync(path.join(nativeDir, file), path.join(iosAppDir, file));
      }
      const bridgePath = path.join(iosAppDir, 'Prototo-Bridging-Header.h');
      let bridge = fs.readFileSync(bridgePath, 'utf8');
      if (!bridge.includes(BRIDGE_IMPORT)) {
        bridge += `\n${BRIDGE_IMPORT}\n`;
        fs.writeFileSync(bridgePath, bridge);
      }
      return cfg;
    },
  ]);

// Force-link expo-dev-launcher into the app's Release build (it is not linked otherwise,
// so EXDevLauncherController is an undefined symbol in a plain Release build).
const withForceLinkDevLauncher = (config) =>
  withXcodeProject(config, (cfg) => {
    const proj = cfg.modResults;
    const targets = proj.pbxNativeTargetSection();
    let appTargetKey = null;
    for (const key of Object.keys(targets)) {
      const t = targets[key];
      if (t && typeof t === 'object' && (t.name === 'Prototo' || t.name === '"Prototo"')) {
        appTargetKey = key;
        break;
      }
    }
    if (!appTargetKey) return cfg;

    const listKey = targets[appTargetKey].buildConfigurationList;
    const lists = proj.pbxXCConfigurationList();
    const refs = lists[listKey].buildConfigurations.map((c) => c.value);
    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const ref of refs) {
      const bc = buildConfigs[ref];
      if (!bc || bc.name !== 'Release' || !bc.buildSettings) continue;
      const existing = bc.buildSettings.OTHER_LDFLAGS;
      const flags = Array.isArray(existing) ? existing : existing ? [existing] : ['"$(inherited)"'];
      if (!flags.includes('"-ObjC"')) flags.push('"-ObjC"');
      bc.buildSettings.OTHER_LDFLAGS = flags;
    }
    return cfg;
  });

module.exports = (config) => withForceLinkDevLauncher(withNativeFiles(config));
