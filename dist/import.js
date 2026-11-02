// Format d'échange de travail. Les adaptateurs bancaires réels restent à définir.
export const MAX_BYTES = 1024 * 1024;
export const MAX_ROWS = 5000;
export const METHODS = ['Virement', 'QR-facture', 'Carte', 'TWINT', 'Espèces', 'Chèque', 'Prélèvement', 'Autre'];
const tidy = x => String(x ?? '').trim();
const key = x => tidy(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  transaction: ['transactionid', 'idtransaction', 'transaction', 'identifiant'],
  date: ['date', 'datepaiement', 'bookingdate'], amount: ['montant', 'amount'],
  currency: ['devise', 'currency'], method: ['moyen', 'methode', 'method', 'paymentmethod'],
  reference: ['reference', 'referencefacture', 'invoice'], customer: ['client', 'customer', 'name'],
  kind: ['typeoperation', 'kind', 'type'], description: ['description', 'libelle'],
};
export const cleanReference = x => tidy(x).toUpperCase().replace(/\s/g, '');
export function parseAmount(value) {
  let s = tidy(value).replace(/[\s\u00a0\u202f'’]/g, '');
  if (!s || !/^[+-]?[\d.,]+$/.test(s)) throw new Error('Montant invalide.');
  if (s.includes(',') && s.includes('.')) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    const [whole, cents, ...extra] = s.split(decimal);
    if (extra.length || !/^\d{1,2}$/.test(cents)) throw new Error('Décimales ambiguës.');
    if (!new RegExp('^[+-]?\\d{1,3}(\\' + grouping + '\\d{3})+$').test(whole)) throw new Error('Séparateurs de montant ambigus.');
    s = whole.replaceAll(grouping, '') + '.' + cents;
  } else s = s.replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s)) throw new Error('Montant attendu avec au maximum deux décimales.');
  const negative = s.startsWith('-');
  const [whole, cents = ''] = s.replace(/^[+-]/, '').split('.');
  const amount = Number(whole) * 100 + Number(cents.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 10000000000) throw new Error('Montant hors limite.');
  if (amount === 0) throw new Error('Un montant nul ne constitue pas un encaissement.');
  return negative ? -amount : amount;
}
export function parseDate(value) {
  let s = tidy(value);
  const french = s.match(/^(\d{2})[/.](\d{2})[/.](\d{4})$/);
  if (french) s = `${french[3]}-${french[2]}-${french[1]}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Date attendue : AAAA-MM-JJ ou JJ.MM.AAAA.');
  const d = new Date(s + 'T12:00:00Z');
  if (Number.isNaN(+d) || d.toISOString().slice(0, 10) !== s) throw new Error('Date inexistante.');
  return s;
}
export function normalizeMethod(value) {
  const map = {virement: 'Virement', banktransfer: 'Virement', qr: 'QR-facture', qrfacture: 'QR-facture', carte: 'Carte', card: 'Carte', cb: 'Carte', twint: 'TWINT', especes: 'Espèces', cash: 'Espèces', cheque: 'Chèque', check: 'Chèque', prelevement: 'Prélèvement', directdebit: 'Prélèvement', autre: 'Autre'};
  return map[key(value)] || 'Autre';
}
export function parseCSV(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Fichier limité à 1 Mo.');
  text = text.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('Le fichier est vide.');
  let first = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quoted = !quoted;
    if (!quoted && /[\r\n]/.test(text[i])) break;
    first += text[i];
  }
  const delimiter = [';', ',', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cell = '', mode = 'plain';
  const finishCell = () => {if (cell.length > 2000) throw new Error('Une cellule dépasse 2 000 caractères.'); row.push(cell); cell = ''; mode = 'plain';};
  const finishRow = () => {finishCell(); if (row.some(x => x.trim())) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new Error('Fichier limité à 5 000 opérations.');};
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (mode === 'quoted') {
      if (ch === '"') {if (text[i + 1] === '"') {cell += '"'; i++;} else mode = 'closed';} else cell += ch;
    } else if (ch === delimiter) finishCell();
    else if (ch === '\n' || ch === '\r') {finishRow(); if (ch === '\r' && text[i + 1] === '\n') i++;}
    else if (ch === '"' && !cell && mode === 'plain') mode = 'quoted';
    else if (mode === 'closed') {if (!/\s/.test(ch)) throw new Error('Caractère inattendu après un champ entre guillemets.');}
    else {if (ch === '"') throw new Error('Guillemet inattendu dans le CSV.'); cell += ch;}
  }
  if (mode === 'quoted') throw new Error('Champ entre guillemets non terminé.');
  if (cell || row.length || mode === 'closed') finishRow();
  if (rows.length < 2) throw new Error('Ajoutez un en-tête et au moins une opération.');
  const headers = rows.shift().map(key);
  if (new Set(headers).size !== headers.length) throw new Error('Des colonnes portent le même nom.');
  const indexes = Object.fromEntries(Object.entries(aliases).map(([name, names]) => [name, headers.findIndex(h => names.includes(h))]));
  for (const name of ['transaction', 'date', 'amount', 'currency', 'method', 'kind']) if (indexes[name] < 0) throw new Error(`Colonne manquante : ${name}. Téléchargez le modèle CSV.`);
  const records = [], errors = [];
  rows.forEach((values, i) => {
    try {
      if (values.length !== headers.length) throw new Error('Nombre de colonnes incohérent.');
      const raw = Object.fromEntries(Object.entries(indexes).map(([name, index]) => [name, index < 0 ? '' : tidy(values[index])]));
      if (!raw.transaction || raw.transaction.length > 120) throw new Error('Identifiant de transaction stable requis (120 caractères maximum).');
      const currency = raw.currency.toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Devise attendue sur trois lettres : CHF, EUR…');
      const amountCents = parseAmount(raw.amount);
      let kind = key(raw.kind);
      if (['versementglobal', 'settlement', 'payout'].includes(kind)) kind = 'settlement';
      else if (['remboursement', 'refund', 'debit'].includes(kind) || amountCents < 0) kind = 'refund';
      else if (!kind || ['paiement', 'payment', 'customerpayment'].includes(kind)) kind = 'payment';
      else throw new Error('Type inconnu : paiement, versement_global ou remboursement.');
      records.push({transactionId: raw.transaction, date: parseDate(raw.date), amountCents, currency, method: normalizeMethod(raw.method), reference: cleanReference(raw.reference), customer: raw.customer, description: raw.description, kind, row: i + 2});
    } catch (e) {errors.push({row: i + 2, message: e.message});}
  });
  return {records, errors, total: rows.length, delimiter};
}
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function exportCSV(rows) {return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');}

export const EXAMPLE_CSV = `transaction_id;date;montant;devise;moyen;reference;client;type_operation;description
DEMO-1001;2026-11-02;180.00;CHF;Virement;DEMO-FACT-1001;Emma Laurent;paiement;Loyer novembre
DEMO-1002;2026-11-02;100.00;CHF;Carte;DEMO-FACT-1002;Thomas Perrin;paiement;Carte - opération individuelle
DEMO-1003;2026-11-02;160.00;CHF;TWINT;DEMO-FACT-1003;Sarah Morel;paiement;Paiement individuel
DEMO-1004;2026-11-02;50.00;CHF;Espèces;DEMO-FACT-1004;Julien Favre;paiement;Acompte saisi au guichet fictif
DEMO-1005;2026-11-02;90.00;CHF;Chèque;DEMO-FACT-1005;Léa Robert;paiement;Chèque confirmé dans le scénario
DEMO-1006;2026-11-02;120.00;CHF;QR;DEMO-FACT-1006;Atelier du Lac;paiement;Référence de démonstration
DEMO-1007;2026-11-02;120.00;CHF;Prélèvement;;Camille Brun;paiement;Deux factures possibles - à vérifier
DEMO-1008;2026-11-02;180.00;EUR;Virement;DEMO-FACT-1001;Emma Laurent;paiement;Devise différente
DEMO-1009;2026-11-02;420.00;CHF;Carte;;;versement_global;Versement regroupé du prestataire - ne pas compter deux fois
DEMO-1010;2026-11-02;-20.00;CHF;Autre;;Nicolas Rey;remboursement;À traiter séparément
`;
