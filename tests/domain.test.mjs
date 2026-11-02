import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed, validateState, previewBatch, importBatch, proposalFor, queueAllocation, queueExactMatches, synchronizeMock, refreshFromMock, simulateExternalChange, availableDue, availablePayment, allocatedCents, confirmPaymentCoverage, createReminder, reminderBlocker, loadState, saveState} from '../dist/domain.js';
import {parseCSV, EXAMPLE_CSV} from '../dist/import.js';

const context = {filename: 'exemple.csv', account: 'COMPTE-DEMO', source: 'source-demo'};
const byTx = (s, tx) => s.payments.find(p => p.transactionId === 'DEMO-' + tx);

test('le scénario est cohérent, en CHF, et n’utilise qu’un connecteur fictif', () => {
  const s = makeSeed(); assert.equal(validateState(s), true); assert.equal(s.mode, 'simulation'); assert.equal(s.payments.length, 10);
  assert.ok(s.invoices.every(i => i.currency === 'CHF')); assert.ok(s.clients.every(c => c.email.endsWith('@exemple.invalid')));
});
test('réimporter le même fichier ne crée ni nouveau paiement ni nouveau solde', () => {
  const s = makeSeed(), before = structuredClone(s.invoices);
  const batch = importBatch(s, parseCSV(EXAMPLE_CSV), context);
  assert.equal(batch.added, 0); assert.equal(batch.duplicates, 10); assert.equal(s.payments.length, 10); assert.deepEqual(s.invoices, before);
});
test('un identifiant réutilisé avec un montant différent est exclu comme conflit', () => {
  const s = makeSeed(), parsed = parseCSV(EXAMPLE_CSV.replace('180.00;CHF;Virement', '181.00;CHF;Virement'));
  const preview = previewBatch(s, parsed, context); assert.equal(preview[0].importStatus, 'conflict');
  const batch = importBatch(s, parsed, context); assert.equal(batch.conflicts, 1); assert.equal(batch.added, 0); assert.equal(byTx(s, 1001).amountCents, 18000);
});
test('deux versions contradictoires dans un nouvel export sont toutes deux mises à l’écart', () => {
  const s = makeSeed(); const parsed = parseCSV(EXAMPLE_CSV);
  const fresh = {...parsed.records[0], transactionId: 'NEW-1'};
  const batch = importBatch(s, {records: [fresh, {...fresh, amountCents: 19000}], errors: [], total: 2}, context);
  assert.equal(batch.conflicts, 2); assert.equal(batch.added, 0);
});
test('des comptes distincts peuvent posséder le même identifiant de transaction', () => {
  const s = makeSeed(); const batch = importBatch(s, parseCSV(EXAMPLE_CSV), {...context, account: 'AUTRE-COMPTE-DEMO'});
  assert.equal(batch.added, 10); assert.equal(s.payments.length, 20);
});
test('la référence et la devise priment ; un nom ou un montant seul ne suffit pas', () => {
  const s = makeSeed(); assert.equal(proposalFor(s, byTx(s, 1001)).status, 'matched');
  assert.equal(proposalFor(s, byTx(s, 1007)).status, 'review'); assert.equal(proposalFor(s, byTx(s, 1007)).candidates.length, 2);
  assert.equal(proposalFor(s, byTx(s, 1008)).status, 'review');
  assert.throws(() => queueAllocation(s, byTx(s, 1008).id, 'invoice-0', 18000, {manual: true}), /incompatibles/);
});
test('les versements globaux et remboursements ne sont jamais affectés à une facture', () => {
  const s = makeSeed(); for (const tx of [1009, 1010]) {const p = byTx(s, tx); assert.equal(proposalFor(s, p).status, 'excluded'); assert.throws(() => queueAllocation(s, p.id, 'invoice-0', 100, {manual: true}));}
  assert.equal(queueExactMatches(s), 6);
});
test('la préparation réserve le montant, puis le règlement partiel laisse un solde exact', () => {
  const s = makeSeed(), p = byTx(s, 1004); const proposal = proposalFor(s, p);
  assert.equal(proposal.status, 'partial'); queueAllocation(s, p.id, proposal.invoiceId, proposal.amountCents);
  assert.equal(availablePayment(s, p.id), 0); assert.equal(availableDue(s, 'invoice-3'), 15000);
  assert.equal(s.invoices.find(i => i.id === 'invoice-3').balanceCents, 20000);
  synchronizeMock(s); assert.equal(s.invoices.find(i => i.id === 'invoice-3').balanceCents, 15000);
  assert.equal(availableDue(s, 'invoice-3'), 15000); assert.equal(allocatedCents(s, p.id), 5000);
});
test('un surplus reste disponible et ne provoque pas de solde négatif', () => {
  const s = makeSeed(), p = byTx(s, 1001); p.amountCents = 20000;
  assert.equal(proposalFor(s, p).status, 'overpayment'); assert.throws(() => queueAllocation(s, p.id, 'invoice-0', 18000), /manuellement/);
  queueAllocation(s, p.id, 'invoice-0', 18000, {manual: true}); synchronizeMock(s);
  assert.equal(availablePayment(s, p.id), 2000); assert.equal(availableDue(s, 'invoice-0'), 0);
  assert.throws(() => queueAllocation(s, p.id, 'invoice-0', 2000, {manual: true}));
});
test('un deuxième enregistrement et une actualisation ne débitent pas une deuxième fois le solde', () => {
  const s = makeSeed(); queueExactMatches(s); synchronizeMock(s);
  const invoices = structuredClone(s.invoices), receipts = s.mockServer.receipts.length;
  synchronizeMock(s); refreshFromMock(s); assert.deepEqual(s.invoices, invoices); assert.equal(s.mockServer.receipts.length, receipts);
});
test('un accusé de réception perdu se récupère sans produire de doublon', () => {
  const s = makeSeed(), p = byTx(s, 1001); queueAllocation(s, p.id, 'invoice-0', 18000);
  synchronizeMock(s, {loseAcknowledgement: true}); assert.equal(s.operations[0].status, 'uncertain'); assert.equal(s.mockServer.receipts.length, 1);
  assert.equal(s.invoices[0].balanceCents, 18000); refreshFromMock(s);
  assert.equal(s.operations[0].status, 'synced'); assert.equal(s.invoices[0].balanceCents, 0); synchronizeMock(s); assert.equal(s.mockServer.receipts.length, 1);
});
test('un solde modifié ailleurs est vérifié avant l’enregistrement', () => {
  const s = makeSeed(), p = byTx(s, 1001); queueAllocation(s, p.id, 'invoice-0', 18000); simulateExternalChange(s);
  const result = synchronizeMock(s); assert.equal(result.failed, 1); assert.equal(s.mockServer.receipts.length, 0);
  assert.equal(s.invoices[0].balanceCents, 17000); assert.equal(availablePayment(s, p.id), 18000);
});
test('les relances sont bloquées avant vérification, pendant une préparation et après un solde réglé', () => {
  const s = makeSeed(); assert.match(reminderBlocker(s, 'invoice-0'), /Vérifiez/);
  confirmPaymentCoverage(s); const draft = createReminder(s, 'invoice-0'); assert.match(draft.text, /180.00/); assert.match(draft.text, /AUCUN EMAIL ENVOYÉ/);
  const p = byTx(s, 1001); queueAllocation(s, p.id, 'invoice-0', 18000); confirmPaymentCoverage(s); assert.match(reminderBlocker(s, 'invoice-0'), /préparation/);
  synchronizeMock(s); assert.match(reminderBlocker(s, 'invoice-0'), /Aucune échéance/);
});
test('les modifications directes dans la source simulée imposent une actualisation avant un rappel', () => {
  const s = makeSeed(); confirmPaymentCoverage(s); simulateExternalChange(s); assert.match(reminderBlocker(s, 'invoice-0'), /Actualisez/);
});
test('un stockage absent ou corrompu ne casse pas le scénario ; les erreurs de sauvegarde sont signalables', () => {
  const storage = new Map(), port = {getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v)};
  const s = makeSeed(); assert.equal(saveState(port, s), true); assert.equal(loadState(port).payments.length, 10);
  assert.equal(loadState({getItem: () => '{broken'}).payments.length, 10);
  const broken = makeSeed(); broken.mockServer = {}; assert.equal(validateState(broken), false);
  assert.equal(saveState({setItem: () => {throw new Error('quota');}}, s), false);
});
