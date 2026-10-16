import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLicense } from '../src/utils/licenseSecurity';

const licenseKey = 'hesabdar_sys_lic_v2';
const vaultKey = '_hesabdar_sec_sig_vault';

/** Real license verification against isolated in-memory storage; no bypasses or generated activation codes. */
const withStorage = async (check: (values: Map<string, string>, vaultWrites: () => number) => Promise<void>) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)); if (key === vaultKey) writes++; },
    removeItem: (key: string) => { values.delete(key); },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  try { await check(values, () => writes); }
  finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
};

test('concurrent first-mount checks create only one signed trial and never lock each other out', async () => withStorage(async (values, vaultWrites) => {
  const finance = '{"balance":123.123456}';
  values.set('unrelated-accounting-data', finance);
  const checks = await Promise.all([verifyLicense(), verifyLicense(), verifyLicense()]);
  assert.equal(vaultWrites(), 1, 'React StrictMode checks must share one initial creation');
  for (const result of checks) {
    assert.equal(result.isValid, true);
    assert.equal(result.isTampered, false);
    assert.equal(result.isUnlimited, false);
    assert.equal(result.license.mode, 'trial_1m');
    assert.equal(result.license.signature, values.get(vaultKey));
    assert.equal(result.license.id, checks[0].license.id);
  }
  const reload = await verifyLicense();
  assert.equal(reload.isValid, true);
  assert.equal(reload.license.id, checks[0].license.id);
  assert.equal(vaultWrites(), 1, 'Existing licenses must not be reset on reload');
  assert.equal(values.get('unrelated-accounting-data'), finance);
}));

test('a changed signed field remains rejected instead of being silently repaired or reissued', async () => withStorage(async (values, vaultWrites) => {
  await verifyLicense();
  const original = JSON.parse(values.get(licenseKey)!);
  values.set(licenseKey, JSON.stringify({ ...original, clientName: 'unsigned modification' }));
  const result = await verifyLicense();
  assert.equal(result.isValid, false);
  assert.equal(result.isTampered, true);
  assert.equal(vaultWrites(), 1);
  assert.equal(result.license.id, original.id);
}));

test('sharing initialization does not bypass clock-rollback checks', async () => withStorage(async (values, vaultWrites) => {
  await verifyLicense();
  const original = JSON.parse(values.get(licenseKey)!);
  values.set(licenseKey, JSON.stringify({ ...original, lastKnownTimestamp: Date.now() + 2 * 60 * 60 * 1000 }));
  const result = await verifyLicense();
  assert.equal(result.isValid, false);
  assert.equal(result.isClockRolledBack, true);
  assert.equal(result.isTampered, false);
  assert.equal(vaultWrites(), 1);
}));
