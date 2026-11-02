import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAmount, parseDate, parseCSV, EXAMPLE_CSV, exportCSV} from '../dist/import.js';

const header = 'transaction_id;date;montant;devise;moyen;reference;client;type_operation;description\n';
test('les montants restent des centimes exacts, sans arrondi flottant ni séparateurs ambigus', () => {
  for (const [text, cents] of [['0.10', 10], ['0,20', 20], ["1’234.56", 123456], ['1 234,56', 123456], ['1.234,56', 123456], ['1,234.56', 123456], ['-20.00', -2000]]) assert.equal(parseAmount(text), cents, text);
  for (const text of ['', 'NaN', '1e3', '0', '1,234', '1.2.3', '1.000,123', '12,34.56', '9007199254740999']) assert.throws(() => parseAmount(text), undefined, text);
});
test('les dates impossibles sont refusées et les formats du modèle sont reconnus', () => {
  assert.equal(parseDate('02.11.2026'), '2026-11-02'); assert.equal(parseDate('02/11/2026'), '2026-11-02');
  for (const value of ['2026-02-29', '31.11.2026', '2026-13-01', '02/11/26']) assert.throws(() => parseDate(value));
});
test('le CSV multicanal distingue les règlements, le versement agrégé et le remboursement', () => {
  const parsed = parseCSV(EXAMPLE_CSV); assert.equal(parsed.records.length, 10); assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records.find(r => r.transactionId === 'DEMO-1009').kind, 'settlement');
  assert.equal(parsed.records.find(r => r.transactionId === 'DEMO-1010').kind, 'refund');
  assert.ok(new Set(parsed.records.map(r => r.method)).size >= 7);
});
test('guillemets, séparateurs et retours de ligne dans une cellule conservent le contenu', () => {
  const csv = '\uFEFF' + header + 'X;2026-11-02;18,50;CHF;Virement;REF;"Élodie; Martin";paiement;"Un mot ""important""\nPuis une seconde ligne"\r\n';
  const parsed = parseCSV(csv); assert.equal(parsed.errors.length, 0); assert.equal(parsed.records[0].amountCents, 1850);
  assert.equal(parsed.records[0].customer, 'Élodie; Martin'); assert.equal(parsed.records[0].description, 'Un mot "important"\nPuis une seconde ligne');
});
test('un identifiant absent et une ligne invalide ne deviennent pas des paiements', () => {
  const parsed = parseCSV(header + ';2026-11-02;10;CHF;Carte;REF;A;paiement;Sans identifiant\nY;2026-02-31;10;CHF;Carte;REF;A;paiement;Date impossible\nZ;2026-11-02;10;CHF;Carte;REF;A;paiement;Valide\n');
  assert.equal(parsed.records.length, 1); assert.equal(parsed.records[0].transactionId, 'Z'); assert.equal(parsed.errors.length, 2);
});
test('les CSV incomplets, trop volumineux ou aux colonnes ambiguës sont refusés', () => {
  assert.throws(() => parseCSV(''));
  assert.throws(() => parseCSV('date;date\n1;2'));
  assert.throws(() => parseCSV(header + 'X;2026-11-02;10;CHF;Carte;REF;A;paiement;"non terminé'));
  assert.throws(() => parseCSV('x'.repeat(1024 * 1024 + 1)));
  const noKind = 'transaction_id;date;montant;devise;moyen\nX;2026-11-02;10;CHF;Carte';
  assert.throws(() => parseCSV(noKind), /kind/);
});
test('les colonnes en anglais et le séparateur virgule sont reconnus', () => {
  const p = parseCSV('transaction_id,date,amount,currency,method,reference,customer,kind,description\nX,2026-11-02,10.20,CHF,card,R,A,payment,Test');
  assert.equal(p.records[0].method, 'Carte'); assert.equal(p.records[0].amountCents, 1020);
});
test('un export de suivi ne transforme pas un contenu en formule de tableur', () => {
  const result = exportCSV([['=HYPERLINK("x")', '+123', '@SUM(A1)', 'Élodie; exemple', 'a"b']]);
  assert.match(result, /'=HYPERLINK/); assert.match(result, /'\+123/); assert.match(result, /'@SUM/); assert.match(result, /a""b/);
});
