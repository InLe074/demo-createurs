import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXAMPLE_CSV} from '../dist/import.js';

// Harnais d'événements sans navigateur : il vérifie les formulaires et les actions,
// mais ne permet pas de revendiquer une validation visuelle ou mobile.
const nodes = new Map();
const element = () => ({innerHTML: '', inert: false, style: {}, focus() {}, replaceChildren(...items) {this.items = items;}, textContent: ''});
for (const id of ['#app', '#overlay', '#toast']) nodes.set(id, element());
const handlers = {}, windowHandlers = {}, contents = new Map();
globalThis.document = {querySelector: key => nodes.get(key) || null, querySelectorAll: () => [], activeElement: null, body: {style: {}, classList: {toggle() {}, remove() {}}}, createElement: element, addEventListener: (name, fn) => {handlers[name] = fn;}};
globalThis.window = {localStorage: {getItem: k => contents.get(k), setItem: (k, v) => contents.set(k, v)}, addEventListener: (name, fn) => {windowHandlers[name] = fn;}, scrollTo() {}};
globalThis.location = {hash: '#/overview'};
globalThis.FormData = class {constructor(form) {this.values = Object.entries(form.values);} [Symbol.iterator]() {return this.values[Symbol.iterator]();}};

let source = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
for (const file of ['domain.js', 'import.js', 'view.js']) source = source.replaceAll(`'./${file}'`, JSON.stringify(new URL('../dist/' + file, import.meta.url).href));
source += '\nexport const inspectState=()=>state; export const inspectUi=()=>ui; export const stopTimers=()=>clearTimeout(timer);\n';
const app = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
after(() => app.stopTimers());
const click = (action, id = '') => handlers.click({target: {closest: () => ({dataset: {action, id}})}});
const submit = (kind, values, id = '') => {const form = {dataset: {form: kind, id}, values}; return handlers.submit({preventDefault() {}, target: {closest: () => form}});};

test('l’application démarre puis le parcours de préparation et de simulation met à jour les fiches', async () => {
  assert.match(nodes.get('#app').innerHTML, /Les bons paiements/);
  await click('payment', app.inspectState().payments[0].id); assert.match(nodes.get('#overlay').innerHTML, /Confirmer l’affectation/);
  submit('allocate', {invoice: 'invoice-0', amount: '180.00'}, app.inspectState().payments[0].id);
  assert.equal(app.inspectState().operations.length, 1); assert.equal(app.inspectState().invoices[0].balanceCents, 18000);
  await click('sync'); assert.equal(app.inspectState().invoices[0].balanceCents, 0); assert.match(nodes.get('#overlay').innerHTML, /RECU-DEMO/);
});
test('le formulaire analyse puis importe seulement les nouvelles opérations du CSV', async () => {
  location.hash = '#/import'; windowHandlers.hashchange();
  submit('analyze', {csv: EXAMPLE_CSV.replace('DEMO-1001;', 'AUTRE-TRANSACTION;'), account: 'COMPTE-DEMO', source: 'source-demo'});
  assert.match(nodes.get('#app').innerHTML, /Importer 1 ligne/);
  await click('commit-import'); assert.equal(app.inspectState().payments.length, 11); assert.equal(location.hash, '#/overview');
  submit('analyze', {csv: 'fichier incorrect', account: 'COMPTE-DEMO', source: 'source-demo'}); assert.equal(app.inspectUi().preview, null);
});
test('une préparation depuis une vue de centre ne prépare pas les règlements des autres centres', async () => {
  await click('reset-confirm'); app.inspectUi().centre = 'Colline · Sion';
  await click('prepare-matches'); assert.equal(app.inspectState().operations.length, 2);
  assert.ok(app.inspectState().operations.every(op => ['invoice-4', 'invoice-5'].includes(op.invoiceId)));
});
