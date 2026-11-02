import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {makeSeed, queueExactMatches, synchronizeMock, confirmPaymentCoverage, createReminder} from '../dist/domain.js';
import {renderApp, renderDrawer} from '../dist/view.js';
import {parseCSV, EXAMPLE_CSV} from '../dist/import.js';

const ui = () => ({page: 'overview', filter: 'all', query: '', centre: 'all', importText: EXAMPLE_CSV, filename: 'exemple.csv', source: 'source-demo', account: 'COMPTE-DEMO', parsed: null, preview: null, drawer: null});
test('tous les écrans sont rendus avec les marqueurs de simulation et les contrôles attendus', async () => {
  const s = makeSeed(), u = ui(); const dir = new URL('./snapshots/', import.meta.url); await mkdir(dir, {recursive: true});
  for (const page of ['overview', 'import', 'clients', 'payments', 'reminders', 'boxes', 'connection', 'history']) {
    u.page = page; const html = renderApp(s, u); assert.ok(html.length > 2000, page); assert.match(html, /Prototype avec données fictives/, page); assert.match(html, /id="main"/, page); assert.doesNotMatch(html, /\b(?:undefined|NaN)\b/, page); await writeFile(new URL(page + '.html', dir), html);
  }
  u.page = 'connection'; assert.match(renderApp(s, u), /ne contacte aucun service Storable/);
});
test('le rendu protège les noms, références, fichiers et contenus importés contre les injections HTML', () => {
  const s = makeSeed(), u = ui(); s.payments[0].customer = '<img src=x onerror=alert(1)>'; u.filename = '<script>alert(1)</script>';
  let html = renderApp(s, u); assert.match(html, /&lt;img/); assert.doesNotMatch(html, /<img src=x/);
  u.page = 'import'; u.importText = '</textarea><script>alert(1)</script>'; html = renderApp(s, u); assert.doesNotMatch(html, /<script>alert/); assert.match(html, /&lt;\/textarea&gt;/);
});
test('les fiches de paiements et clients montrent les affectations et le reçu simulé', () => {
  const s = makeSeed(), u = ui(); queueExactMatches(s); synchronizeMock(s);
  u.drawer = {kind: 'payment', id: s.payments[0].id}; let h = renderDrawer(s, u); assert.match(h, /RECU-DEMO-/); assert.match(h, /aria-modal="true"/);
  u.drawer = {kind: 'client', id: 'client-0'}; h = renderDrawer(s, u); assert.match(h, /Soldée en simulation/); assert.match(h, /0.00/);
});
test('les filtres ne masquent pas la distinction entre opérations exclues et paiements rapprochés', () => {
  const s = makeSeed(), u = ui(); u.filter = 'excluded'; const h = renderApp(s, u);
  assert.match(h, /DEMO-1009/); assert.match(h, /DEMO-1010/); assert.doesNotMatch(h, /DEMO-1001/);
});
test('les brouillons sont présentés sans bouton d’envoi et avec le montant courant', () => {
  const s = makeSeed(), u = ui(); confirmPaymentCoverage(s); const d = createReminder(s, 'invoice-0');
  u.drawer = {kind: 'draft', id: d.id}; const h = renderDrawer(s, u); assert.match(h, /AUCUN EMAIL ENVOYÉ/); assert.match(h, /Copier le brouillon/); assert.doesNotMatch(h, /Envoyer le rappel/);
});
