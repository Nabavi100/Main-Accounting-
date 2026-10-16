import test from "node:test";
import assert from "node:assert/strict";
import { initialCompanySettings } from "../src/data/initialData";
import {
  DEFAULT_COMPANY_NAME,
  normalizeCompanyBranding,
} from "../src/utils/companyBranding";

test("the default company everywhere starts as Nabawi, without a reference-company logo", () => {
  assert.equal(initialCompanySettings.name, DEFAULT_COMPANY_NAME);
  assert.equal(initialCompanySettings.logoIconText, "ن");
  assert.equal(initialCompanySettings.logoUrl, "");
});
test("only the exact old reference default is migrated; other company data is preserved", () => {
  const input = {
    name: "شرکت تجارتی اسحاق هارون واسعی",
    logoIconText: "ه",
    phone: "unchanged",
    logoUrl: "data:image/png;base64,example",
  };
  const next = normalizeCompanyBranding(input, initialCompanySettings);
  assert.equal(next.name, DEFAULT_COMPANY_NAME);
  assert.equal(next.logoIconText, "ن");
  assert.equal(next.phone, "unchanged");
  assert.equal(next.logoUrl, input.logoUrl);
  assert.equal(input.name, "شرکت تجارتی اسحاق هارون واسعی");
});
test("a user-defined name and logo are not overwritten by a default-name migration", () => {
  const next = normalizeCompanyBranding(
    { name: "  شرکت نمونهٔ کاربر  ", logoUrl: "logo.png", logoIconText: "م" },
    initialCompanySettings,
  );
  assert.equal(next.name, "شرکت نمونهٔ کاربر");
  assert.equal(next.logoUrl, "logo.png");
  assert.equal(next.logoIconText, "م");
});
test("empty or missing name uses the new default, leaving optional details intact", () => {
  assert.equal(
    normalizeCompanyBranding(undefined, initialCompanySettings).name,
    DEFAULT_COMPANY_NAME,
  );
  const next = normalizeCompanyBranding(
    { name: " ", address: "address" },
    initialCompanySettings,
  );
  assert.equal(next.name, DEFAULT_COMPANY_NAME);
  assert.equal(next.address, "address");
});
