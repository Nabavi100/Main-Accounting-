'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

// Edit the Windows PE resources on Linux or Windows without Wine or admin access.
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { NtExecutable, NtExecutableResource, Resource, Data } = await import('resedit');
  const exeFile = path.join(context.appOutDir, 'Nabavi Accounting.exe');
  const exe = NtExecutable.from(await fs.readFile(exeFile), { ignoreCert: true });
  const resources = NtExecutableResource.from(exe);
  const icon = Data.IconFile.from(await fs.readFile(path.join(__dirname, 'assets', 'icon.ico')));
  Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 1, 1033, icon.icons.map(entry => entry.data));
  const info = Resource.VersionInfo.createEmpty();
  const numeric = context.packager.appInfo.version.split('-')[0].split('.').map(Number);
  info.setFileVersion(numeric[0], numeric[1], numeric[2], 0);
  info.setProductVersion(numeric[0], numeric[1], numeric[2], 0);
  info.setStringValues({ lang: 1033, codepage: 1200 }, {
    CompanyName: 'شرکت تجارتی برادران نبوی',
    FileDescription: 'Nabavi Accounting — حسابداری برادران نبوی',
    ProductName: 'Nabavi Accounting',
    ProductVersion: context.packager.appInfo.version,
    FileVersion: context.packager.appInfo.version,
    InternalName: 'Nabavi Accounting',
    OriginalFilename: 'Nabavi Accounting.exe',
    LegalCopyright: 'شرکت تجارتی برادران نبوی',
  });
  // Replace the old version resource, preserving all other Electron resources.
  resources.entries = resources.entries.filter(entry => entry.type !== 16);
  info.outputToResourceEntries(resources.entries);
  resources.outputResource(exe);
  await fs.writeFile(exeFile, Buffer.from(exe.generate()));
};
