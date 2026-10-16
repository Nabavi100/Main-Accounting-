import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CloseButton } from '../src/components/CloseButton';

test('close controls always have a visible Persian label, accessible name and decorative X', () => {
  const html = renderToStaticMarkup(React.createElement(CloseButton));
  assert.match(html, /class="app-action app-close-button"/);
  assert.match(html, /data-close-variant="solid"/);
  assert.match(html, /<span>بستن<\/span>/);
  assert.match(html, /aria-label="بستن پنجره"/);
  assert.match(html, /aria-hidden="true"/);
  assert.ok(!html.includes('hidden sm:inline'));
});
test('closing cannot accidentally submit the surrounding financial form, even with a legacy submit type', () => {
  let called = false;
  const html = renderToStaticMarkup(React.createElement(CloseButton, { type: 'submit', onClick: () => { called = true; }, id: 'existing-form-close' }));
  assert.match(html, /type="button"/); assert.ok(!html.includes('type="submit"'));
  assert.match(html, /id="existing-form-close"/); assert.equal(called, false);
});
test('existing labels, IDs, disabled guards and styling hooks survive standardization', () => {
  const html = renderToStaticMarkup(React.createElement(CloseButton, { label: 'بستن فرم', 'aria-label': 'بستن فرم حواله خروج', disabled: true, className: 'legacy-hook', title: 'بستن (ESC)' }));
  assert.match(html, /<span>بستن فرم<\/span>/); assert.match(html, /aria-label="بستن فرم حواله خروج"/);
  assert.match(html, /disabled=""/); assert.match(html, /legacy-hook/); assert.match(html, /title="بستن \(ESC\)"/);
});

test('footer outline closes keep the same visible label and safe close contract', () => {
  const html = renderToStaticMarkup(React.createElement(CloseButton, { variant: 'outline', 'aria-label': 'بستن فرم حساب', type: 'submit' }));
  assert.match(html, /data-close-variant="outline"/);
  assert.match(html, /data-ui-action="close"/);
  assert.match(html, /aria-label="بستن فرم حساب"/);
  assert.match(html, /type="button"/);
  assert.match(html, /<span>بستن<\/span>/);
});
