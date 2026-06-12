const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

// pnpm monorepo safety net so Metro resolves the workspace-source packages
// (proto-renderer / proto-manifest / proto-components) across symlinked node_modules.
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = config;
