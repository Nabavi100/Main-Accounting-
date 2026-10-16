'use strict';
const path = require('node:path');
const root = path.join(__dirname, '..');
const assets = path.join(__dirname, 'assets');

module.exports = {
  appId: 'af.nabavi.accounting',
  productName: 'Nabavi Accounting',
  electronVersion: '44.8.0',
  ...(process.platform === 'win32' ? { electronDist: path.join(__dirname, '..', 'node_modules', 'electron', 'dist') } : {}),
  directories: { app: path.join(root, 'out', 'desktop-app'), output: path.join(root, 'out', 'desktop-build'), buildResources: assets },
  files: ['package.json', 'dist/**/*', 'desktop/**/*', '!**/*.map'],
  asar: true,
  npmRebuild: false,
  compression: 'maximum',
  forceCodeSigning: false,
  publish: null,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    onlyLoadAppFromAsar: true,
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: path.join(assets, 'icon.ico'),
    // Cross-platform resource editing is performed with resedit in afterPack.
    signAndEditExecutable: false,
    requestedExecutionLevel: 'asInvoker',
    executableName: 'Nabavi Accounting',
  },
  nsis: {
    artifactName: 'Nabavi-Accounting-${version}-Setup-x64.${ext}',
    oneClick: false,
    perMachine: false,
    selectPerMachineByDefault: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    shortcutName: 'حسابداری برادران نبوی',
    uninstallDisplayName: 'حسابداری برادران نبوی — ${version}',
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    differentialPackage: false,
    displayLanguageSelector: true,
    installerLanguages: ['fa_IR', 'en_US'],
    installerIcon: path.join(assets, 'icon.ico'),
    uninstallerIcon: path.join(assets, 'icon.ico'),
    installerSidebar: path.join(assets, 'installer-sidebar.bmp'),
    uninstallerSidebar: path.join(assets, 'installer-sidebar.bmp'),
  },
  afterPack: path.join(__dirname, 'after-pack.cjs'),
};
