import {parseCSV, EXAMPLE_CSV, cleanReference, exportCSV} from './import.js';
import {MockConnector} from './mock-connector.js';

export const STORAGE_KEY = 'chantelio-payments-lab-ch-v1';
export const TODAY = '2026-11-02';
const clone = x => structuredClone(x);
const now = () => new Date().toISOString();
const comparableName = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nextId = (s, prefix) => prefix + '-' + s.sequence++;
export const money = (cents, currency = 'CHF') => new Intl.NumberFormat('fr-CH', {style: 'currency', currency, minimumFractionDigits: 2}).format(cents / 100);
export function event(s, type, message, target = '') {s.events.unshift({id: nextId(s, 'evt'), at: now(), type, message, target}); s.events = s.events.slice(0, 250);}
export function makeSeed() {
  const names = ['Emma Laurent', 'Thomas Perrin', 'Sarah Morel', 'Julien Favre', 'Léa Robert', 'Atelier du Lac', 'Camille Brun', 'Nicolas Rey'];
  const clients = names.map((name, i) => ({id: 'client-' + i, name, email: 'client.' + (i + 1) + '@exemple.invalid', centre: i < 4 ? 'Rivage · Lausanne' : 'Colline · Sion'}));
  const units = names.map((_, i) => ({id: 'box-' + i, clientId: clients[i].id, label: (i < 4 ? 'A-' : 'B-') + String(i + 1).padStart(2, '0'), area: [5, 3, 7, 10, 2, 5, 5, 7][i], status: 'Loué', centre: clients[i].centre}));
  units.push({id: 'box-free', clientId: '', label: 'B-09', area: 5, status: 'Libre', centre: 'Colline · Sion'});
  const amounts = [18000, 10000, 16000, 20000, 9000, 12000, 12000, 14000];
  const invoices = names.map((_, i) => ({id: 'invoice-' + i, reference: 'DEMO-FACT-' + (1001 + i), clientId: clients[i].id, unitId: units[i].id, currency: 'CHF', totalCents: amounts[i], balanceCents: amounts[i], due: i % 2 ? '2026-10-30' : '2026-11-01', period: 'Novembre 2026'}));
  invoices.push({...clone(invoices[6]), id: 'invoice-8', reference: 'DEMO-FACT-1009', due: '2026-11-01', period: 'Octobre 2026'});
  const s = {version: 1, mode: 'simulation', sequence: 1, clients, units, invoices: clone(invoices), payments: [], operations: [], batches: [], events: [], reminders: [], sourceRevision: 1, lastSyncAt: now(), checkedThrough: '', mockServer: {invoices: clone(invoices), receipts: [], revision: 1}};
  importBatch(s, parseCSV(EXAMPLE_CSV), {filename: 'Exemple multicanal.csv', account: 'COMPTE-DEMO', source: 'source-demo'});
  return s;
}
export function validateState(s) {
  if (!s || s.version !== 1 || s.mode !== 'simulation' || !Number.isSafeInteger(s.sequence) || !Array.isArray(s.payments) || !Array.isArray(s.operations) || !Array.isArray(s.invoices) || !Array.isArray(s.clients) || !Array.isArray(s.units) || !Array.isArray(s.batches) || !Array.isArray(s.events) || !Array.isArray(s.reminders) || !Array.isArray(s.mockServer?.invoices) || !Array.isArray(s.mockServer?.receipts) || !Number.isSafeInteger(s.mockServer.revision)) return false;
  if (s.clients.some(c => typeof c.id !== 'string' || typeof c.name !== 'string' || typeof c.centre !== 'string')) return false;
  if (s.invoices.some(i => !Number.isSafeInteger(i.balanceCents) || i.balanceCents < 0 || !Number.isSafeInteger(i.totalCents) || i.balanceCents > i.totalCents)) return false;
  if (s.payments.some(p => !Number.isSafeInteger(p.amountCents) || !p.bankKey) || new Set(s.payments.map(p => p.bankKey)).size !== s.payments.length) return false;
  if (s.operations.some(op => !Number.isSafeInteger(op.amountCents) || op.amountCents <= 0 || !['queued', 'uncertain', 'synced', 'failed'].includes(op.status) || !s.payments.some(p => p.id === op.paymentId) || !s.invoices.some(i => i.id === op.invoiceId))) return false;
  return true;
}
export function loadState(storage) {try {const s = JSON.parse(storage.getItem(STORAGE_KEY)); if (validateState(s)) return s;} catch {} return makeSeed();}
export function saveState(storage, state) {try {storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true;} catch {return false;}}
export function paymentKey(row, account, source) {return JSON.stringify([source, account, row.transactionId]);}
function signature(row) {return JSON.stringify([row.date, row.amountCents, row.currency, row.method, row.reference, row.kind]);}
export function previewBatch(s, parsed, context) {
  if (!context.account?.trim() || !context.source?.trim()) throw new Error('Indiquez le compte et la source de l’export.');
  const known = new Map(s.payments.map(p => [p.bankKey, p]));
  const signatures = new Map();
  for (const row of parsed.records) {
    const k = paymentKey(row, context.account.trim(), context.source.trim());
    if (!signatures.has(k)) signatures.set(k, new Set());
    signatures.get(k).add(signature(row));
  }
  return parsed.records.map(row => {
    const bankKey = paymentKey(row, context.account.trim(), context.source.trim());
    const previous = known.get(bankKey);
    const status = signatures.get(bankKey).size > 1 ? 'conflict' : previous ? signature(previous) === signature(row) ? 'duplicate' : 'conflict' : 'new';
    if (!previous) known.set(bankKey, row);
    return {...row, bankKey, importStatus: status};
  });
}
export function importBatch(s, parsed, context) {
  const rows = previewBatch(s, parsed, context);
  const fresh = rows.filter(r => r.importStatus === 'new');
  const batch = {id: nextId(s, 'lot'), at: now(), filename: context.filename || 'Import CSV', source: context.source, account: context.account, added: fresh.length, duplicates: rows.filter(r => r.importStatus === 'duplicate').length, conflicts: rows.filter(r => r.importStatus === 'conflict').length, errors: clone(parsed.errors), total: parsed.total};
  for (const row of fresh) s.payments.push({...row, id: nextId(s, 'paiement'), batchId: batch.id, importedAt: batch.at});
  s.batches.unshift(batch); s.checkedThrough = '';
  event(s, 'import', `${batch.added} nouvelle(s) opération(s), ${batch.duplicates} doublon(s), ${batch.conflicts} conflit(s).`, batch.id);
  return batch;
}
const effectiveOps = s => s.operations.filter(op => op.status !== 'failed');
export function allocatedCents(s, paymentId) {return effectiveOps(s).filter(op => op.paymentId === paymentId).reduce((sum, op) => sum + op.amountCents, 0);}
export function availablePayment(s, id) {const p = s.payments.find(p => p.id === id); return p ? Math.max(0, p.amountCents - allocatedCents(s, id)) : 0;}
export function pendingCents(s, invoiceId) {return s.operations.filter(op => op.invoiceId === invoiceId && ['queued', 'uncertain'].includes(op.status)).reduce((sum, op) => sum + op.amountCents, 0);}
export function availableDue(s, invoiceId) {const i = s.invoices.find(i => i.id === invoiceId); return i ? Math.max(0, i.balanceCents - pendingCents(s, invoiceId)) : 0;}
export function proposalFor(s, p) {
  if (p.kind === 'settlement') return {status: 'excluded', reason: 'Versement global du prestataire : ne constitue pas un nouveau paiement client.', candidates: []};
  if (p.kind === 'refund' || p.amountCents < 0) return {status: 'excluded', reason: 'Débit ou remboursement : traitement séparé à définir.', candidates: []};
  const ops = effectiveOps(s).filter(op => op.paymentId === p.id);
  if (availablePayment(s, p.id) === 0) return {status: ops.some(op => op.status === 'uncertain') ? 'uncertain' : ops.some(op => op.status === 'queued') ? 'queued' : 'synced', reason: 'Le montant est entièrement affecté.', candidates: []};
  const byRef = p.reference ? s.invoices.filter(i => cleanReference(i.reference) === cleanReference(p.reference)) : [];
  if (byRef.length === 1) {
    const i = byRef[0];
    if (i.currency !== p.currency) return {status: 'review', reason: 'La devise du paiement diffère de celle de la facture.', candidates: []};
    const balance = availableDue(s, i.id), amount = availablePayment(s, p.id);
    if (balance === 0) return {status: 'review', reason: 'La facture est soldée ou un règlement est déjà en préparation.', candidates: []};
    return {status: amount > balance ? 'overpayment' : amount < balance ? 'partial' : 'matched', reason: amount > balance ? 'Montant supérieur au solde : le surplus restera à traiter.' : amount < balance ? 'Référence exacte, règlement partiel.' : 'Référence unique, devise et montant concordants.', invoiceId: i.id, amountCents: Math.min(amount, balance), candidates: [i.id]};
  }
  if (byRef.length > 1) return {status: 'review', reason: 'Référence présente sur plusieurs factures : choix manuel requis.', candidates: byRef.filter(i => i.currency === p.currency && availableDue(s, i.id) > 0).map(i => i.id)};
  const clients = s.clients.filter(c => p.customer && comparableName(c.name) === comparableName(p.customer));
  const candidates = s.invoices.filter(i => clients.some(c => c.id === i.clientId) && i.currency === p.currency && availableDue(s, i.id) > 0).map(i => i.id);
  return {status: 'review', reason: candidates.length ? 'Le nom propose une piste ; la facture doit être confirmée.' : 'Aucune référence unique trouvée. Choisissez le dossier après vérification.', candidates};
}
export function queueAllocation(s, paymentId, invoiceId, amountCents, {manual = false} = {}) {
  const p = s.payments.find(p => p.id === paymentId), invoice = s.invoices.find(i => i.id === invoiceId);
  if (!p || !invoice || p.kind !== 'payment' || p.currency !== invoice.currency) throw new Error('Paiement et facture incompatibles.');
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > availablePayment(s, p.id) || amountCents > availableDue(s, invoice.id)) throw new Error('Le montant dépasse le paiement disponible ou le solde à affecter.');
  const proposal = proposalFor(s, p);
  if (!manual && (!['matched', 'partial'].includes(proposal.status) || proposal.invoiceId !== invoiceId)) throw new Error('Cette affectation doit être vérifiée manuellement.');
  const op = {id: nextId(s, 'operation'), paymentId, invoiceId, amountCents, currency: p.currency, status: 'queued', createdAt: now(), manual, receiptId: '', error: ''};
  s.operations.push(op); s.checkedThrough = '';
  event(s, 'allocation', `${manual ? 'Affectation confirmée' : 'Référence reconnue'} : ${money(amountCents, p.currency)} pour ${invoice.reference}.`, p.id);
  return op;
}
export function queueExactMatches(s, paymentIds = null) {
  let count = 0;
  for (const p of s.payments) {if (paymentIds && !paymentIds.includes(p.id)) continue; const match = proposalFor(s, p); if (['matched', 'partial'].includes(match.status)) {queueAllocation(s, p.id, match.invoiceId, match.amountCents); count++;}}
  return count;
}
export function cancelQueuedOperation(s, id) {
  const op = s.operations.find(op => op.id === id);
  if (!op || op.status !== 'queued') throw new Error('Seule une affectation encore en préparation peut être retirée.');
  op.status = 'failed'; op.error = 'Affectation retirée avant simulation.';
  event(s, 'allocation', 'Affectation retirée avant enregistrement.', op.paymentId);
}
export function refreshFromMock(s) {
  const adapter = new MockConnector(s.mockServer);
  for (const op of s.operations.filter(op => ['queued', 'uncertain'].includes(op.status))) {
    const receipt = adapter.findReceipt(op.id);
    if (receipt && receipt.invoiceId === op.invoiceId && receipt.amountCents === op.amountCents && receipt.currency === op.currency) {op.status = 'synced'; op.receiptId = receipt.receiptId; op.error = '';}
  }
  const snapshot = adapter.readSnapshot(); s.invoices = snapshot.invoices; s.sourceRevision = snapshot.revision; s.lastSyncAt = now();
  event(s, 'sync', 'Dossiers actualisés depuis le connecteur fictif. Aucun accès à SiteLink réel.');
}
export function synchronizeMock(s, {loseAcknowledgement = false} = {}) {
  if (s.mode !== 'simulation') throw new Error('Ce prototype ne dispose que du connecteur fictif.');
  const adapter = new MockConnector(s.mockServer); let confirmed = 0, failed = 0;
  for (const op of s.operations.filter(op => ['queued', 'uncertain'].includes(op.status))) {
    try {
      const p = s.payments.find(p => p.id === op.paymentId);
      const receipt = adapter.recordExternalPayment({operationId: op.id, invoiceId: op.invoiceId, amountCents: op.amountCents, currency: op.currency, date: p.date});
      if (loseAcknowledgement) {op.status = 'uncertain'; op.error = 'Accusé de réception fictif perdu : vérifier avant toute nouvelle tentative.'; continue;}
      op.status = 'synced'; op.receiptId = receipt.receiptId; op.error = ''; confirmed++;
      event(s, 'sync', `Enregistrement simulé confirmé : ${receipt.receiptId}.`, p.id);
    } catch (e) {op.status = 'failed'; op.error = e.message; failed++; event(s, 'error', e.message, op.paymentId);}
  }
  if (!loseAcknowledgement) refreshFromMock(s);
  return {confirmed, failed};
}
export function simulateExternalChange(s) {
  const invoice = s.mockServer.invoices.find(i => i.balanceCents > 1000);
  if (!invoice) throw new Error('Aucun dossier ouvert à modifier.');
  invoice.balanceCents -= 1000; s.mockServer.revision++;
  event(s, 'scenario', `Scénario : règlement de CHF 10.00 enregistré directement dans le système fictif pour ${invoice.reference}.`);
}
export function confirmPaymentCoverage(s) {s.checkedThrough = TODAY; event(s, 'review', 'Encaissements du scénario vérifiés jusqu’au ' + TODAY + '.');}
export function reminderBlocker(s, invoiceId) {
  const invoice = s.invoices.find(i => i.id === invoiceId);
  if (!invoice || invoice.balanceCents <= 0 || invoice.due >= TODAY) return 'Aucune échéance échue à relancer.';
  if (s.checkedThrough !== TODAY) return 'Vérifiez les encaissements de tous les moyens de paiement avant de préparer les rappels.';
  if (s.sourceRevision !== s.mockServer.revision) return 'Actualisez les dossiers avant de préparer les rappels.';
  if (pendingCents(s, invoiceId) > 0) return 'Un paiement est en préparation ou sa confirmation reste incertaine.';
  return '';
}
export function createReminder(s, invoiceId) {
  const blocker = reminderBlocker(s, invoiceId); if (blocker) throw new Error(blocker);
  const invoice = s.invoices.find(i => i.id === invoiceId), client = s.clients.find(c => c.id === invoice.clientId);
  const text = `Bonjour ${client.name},\n\nSauf erreur de notre part, un solde de ${money(invoice.balanceCents, invoice.currency)} reste à régler pour ${invoice.reference} (${invoice.period}).\n\nSi vous avez déjà effectué ce paiement, merci de nous préciser sa référence afin que nous puissions vérifier son affectation.\n\nBonne journée,\nL’équipe du centre\n\nBROUILLON DE DÉMONSTRATION - AUCUN EMAIL ENVOYÉ`;
  const draft = {id: nextId(s, 'rappel'), invoiceId, text, balanceCents: invoice.balanceCents, createdAt: now()};
  s.reminders.unshift(draft); event(s, 'draft', 'Brouillon préparé, sans envoi.', invoiceId); return draft;
}
export function exportPayments(s) {
  return exportCSV([['DÉMONSTRATION - AUCUN ENREGISTREMENT RÉEL'], ['Transaction', 'Date', 'Moyen', 'Devise', 'Montant reçu', 'Montant affecté', 'Référence', 'État'], ...s.payments.map(p => [p.transactionId, p.date, p.method, p.currency, (p.amountCents / 100).toFixed(2), (allocatedCents(s, p.id) / 100).toFixed(2), p.reference, proposalFor(s, p).status])]);
}
