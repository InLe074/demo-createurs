import {makeSeed, loadState, saveState, validateState, importBatch, previewBatch, queueAllocation, queueExactMatches, cancelQueuedOperation, synchronizeMock, refreshFromMock, simulateExternalChange, confirmPaymentCoverage, createReminder, reminderBlocker, exportPayments, availableDue, availablePayment} from './domain.js';
import {parseCSV, parseAmount, EXAMPLE_CSV, MAX_BYTES} from './import.js';
import {renderApp, renderDrawer, filterPayments} from './view.js';

let storage; try {storage = window.localStorage;} catch {storage = {getItem: () => null, setItem: () => {throw new Error('indisponible');}};}
let state = loadState(storage);
const ui = {page: 'overview', filter: 'all', query: '', centre: 'all', importText: EXAMPLE_CSV, filename: 'encaissements-multicanal.csv', source: 'source-demo', account: 'COMPTE-DEMO', parsed: null, preview: null, drawer: null};
let timer, previousFocus;
const $ = q => document.querySelector(q);
function toast(text, error = false) {clearTimeout(timer); const div = document.createElement('div'); div.className = 'toast' + (error ? ' error' : ''); div.textContent = text; $('#toast').replaceChildren(div); timer = setTimeout(() => $('#toast').replaceChildren(), 4500);}
function persist() {if (!saveState(storage, state)) toast('Stockage indisponible : les changements restent dans cette session.', true);}
function render() {
  ui.page = location.hash.replace(/^#\/?/, '') || 'overview';
  $('#app').innerHTML = renderApp(state, ui); $('#overlay').innerHTML = renderDrawer(state, ui);
  $('#app').inert = !!ui.drawer; document.body.style.overflow = ui.drawer ? 'hidden' : '';
  document.title = 'Atelier paiements · Chantelio';
}
function transact(fn, message = '') {
  try {const next = structuredClone(state); const result = fn(next); if (!validateState(next)) throw new Error('Le contrôle de cohérence a refusé cette opération.'); state = next; persist(); render(); if (message) toast(message); return result;} catch (e) {toast(e.message || 'Opération impossible.', true); return null;}
}
function open(kind, id) {previousFocus = document.activeElement; ui.drawer = {kind, id}; render(); $('#overlay button')?.focus();}
function close() {ui.drawer = null; render(); previousFocus?.isConnected && previousFocus.focus();}
function download(text, filename, type = 'text/csv;charset=utf-8') {const url = URL.createObjectURL(new Blob([text], {type})); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) {if (event.target.matches('[data-backdrop]')) close(); return;}
  const action = button.dataset.action, id = button.dataset.id || '';
  if (['payment', 'client', 'draft', 'reset'].includes(action)) return open(action, id);
  if (action === 'close') return close();
  if (action === 'menu') return document.body.classList.toggle('menu-open');
  if (action === 'filter') {ui.filter = id; render(); return;}
  if (action === 'prepare-matches') {let count = 0; transact(s => {count = queueExactMatches(s, filterPayments(s, {...ui, filter: 'matched'}).map(p => p.id));}, ''); toast(count + ' affectation(s) préparée(s). Aucun règlement réel enregistré.'); return;}
  if (action === 'commit-import') {
    if (!ui.parsed || !ui.preview) return;
    const batch = transact(s => importBatch(s, ui.parsed, {filename: ui.filename, account: ui.account, source: ui.source}));
    if (batch) {ui.parsed = null; ui.preview = null; ui.filter = 'all'; location.hash = '#/overview'; render(); toast(batch.added + ' opération(s) importée(s), ' + batch.duplicates + ' doublon(s) ignoré(s).');}
    return;
  }
  if (action === 'cancel-operation') return transact(s => cancelQueuedOperation(s, id), 'Affectation retirée.');
  if (action === 'sync') {const result = transact(s => synchronizeMock(s)); if (result) toast(result.confirmed + ' enregistrement(s) simulé(s), ' + result.failed + ' opération(s) à vérifier.'); return;}
  if (action === 'refresh') return transact(s => refreshFromMock(s), 'Dossiers actualisés depuis le faux connecteur.');
  if (action === 'external-change') return transact(s => simulateExternalChange(s), 'Un solde a changé dans le système fictif. Vous pouvez actualiser les dossiers.');
  if (action === 'lost-ack') return transact(s => synchronizeMock(s, {loseAcknowledgement: true}), 'Réponse perdue simulée : actualisez les dossiers pour retrouver les reçus.');
  if (action === 'confirm-coverage') return transact(s => confirmPaymentCoverage(s), 'Vérification du scénario enregistrée. Aucun message envoyé.');
  if (action === 'reminder') {const draft = transact(s => createReminder(s, id)); if (draft) open('draft', draft.id); return;}
  if (action === 'copy-draft') {
    try {
      const draft = state.reminders.find(d => d.id === id), invoice = state.invoices.find(i => i.id === draft?.invoiceId);
      if (!draft || !invoice) throw new Error('Brouillon introuvable.');
      const reason = reminderBlocker(state, invoice.id); if (reason) throw new Error(reason);
      if (invoice.balanceCents !== draft.balanceCents) throw new Error('Le solde a changé. Préparez un nouveau brouillon.');
      await navigator.clipboard.writeText(draft.text); toast('Brouillon copié. Aucun message envoyé.');
    } catch (e) {toast(e.message || 'La copie est indisponible dans ce navigateur.', true);} return;
  }
  if (action === 'export') return download(exportPayments(state), 'suivi-paiements-DEMONSTRATION.csv');
  if (action === 'reset-confirm') {state = makeSeed(); ui.drawer = null; ui.filter = 'all'; ui.query = ''; ui.centre = 'all'; ui.preview = null; ui.parsed = null; persist(); location.hash = '#/overview'; render(); toast('Scénario fictif restauré.');}
});

document.addEventListener('input', event => {
  const key = event.target.dataset.input;
  if (key && ['importText', 'account', 'source'].includes(key)) {
    ui[key] = event.target.value;
    if (ui.preview) {ui.preview = null; ui.parsed = null; const preview = document.querySelector('[data-action="commit-import"]'); if (preview) {preview.disabled = true; preview.textContent = 'Analyser à nouveau le fichier';}}
  }
});
document.addEventListener('change', async event => {
  const change = event.target.dataset.change;
  if (change === 'query' || change === 'centre') {ui[change] = event.target.value; render(); return;}
  if (event.target.matches('[data-allocation-invoice]') && ui.drawer?.kind === 'payment') {
    const max = Math.min(availableDue(state, event.target.value), availablePayment(state, ui.drawer.id));
    $('#allocation-amount').value = (max / 100).toFixed(2); return;
  }
  if (event.target.id === 'csv-file') {
    const file = event.target.files?.[0]; if (!file) return;
    try {if (file.size > MAX_BYTES) throw new Error('Fichier limité à 1 Mo.'); ui.importText = await file.text(); ui.filename = file.name; ui.parsed = null; ui.preview = null; render(); toast('Fichier chargé localement. Lancez son analyse.');} catch (e) {toast(e.message, true);}
  }
});
document.addEventListener('submit', event => {
  const form = event.target.closest('[data-form]'); if (!form) return;
  event.preventDefault(); const data = Object.fromEntries(new FormData(form));
  if (form.dataset.form === 'analyze') {
    try {ui.importText = data.csv; ui.account = data.account; ui.source = data.source; ui.parsed = parseCSV(ui.importText); ui.preview = previewBatch(state, ui.parsed, ui); render(); toast('Analyse terminée. Vérifiez les lignes avant leur import.');} catch (e) {ui.parsed = null; ui.preview = null; render(); toast(e.message, true);} return;
  }
  if (form.dataset.form === 'allocate') {
    try {const amount = parseAmount(data.amount); transact(s => queueAllocation(s, form.dataset.id, data.invoice, amount, {manual: true}), 'Affectation préparée. L’enregistrement reste à simuler.');} catch (e) {toast(e.message, true);}
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {if (ui.drawer) close(); document.body.classList.remove('menu-open');}
  if (event.key === 'Enter' && event.target.id === 'global-query') {event.preventDefault(); ui.query = event.target.value; render();}
  if (event.key === 'Tab' && ui.drawer) {
    const focusable = [...document.querySelectorAll('#overlay button:not([disabled]), #overlay input, #overlay select, #overlay a[href]')];
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) {event.preventDefault(); focusable.at(-1).focus();}
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {event.preventDefault(); focusable[0].focus();}
  }
});
window.addEventListener('hashchange', () => {ui.drawer = null; document.body.classList.remove('menu-open'); render(); window.scrollTo(0, 0);});
render();
