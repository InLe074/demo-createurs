import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSeed,metrics,stageOf,createReservation,updateLead,activateReservation,cancelReservation,endLease,recordPayment,remaining,invoiceStatus,validateState,loadState,saveState,STORAGE_KEY,money,csv,ruleCandidates,validDate} from '../model.js';

test('le scénario est cohérent, les devises et les centres restent séparés',()=>{
  const s=makeSeed();assert.equal(validateState(s),true);assert.equal(s.units.length,84);
  assert.equal(metrics(s,'ch').total,48);assert.equal(metrics(s,'fr').total,36);
  assert.equal(metrics(s,'ch').occupied,30);assert.equal(metrics(s,'fr').occupied,24);
  assert.equal(metrics(s,'ch').occupancy,67);assert.equal(metrics(s,'fr').occupancy,71);
  assert.match(money(99,'ch'),/CHF/);assert.match(money(99,'fr'),/€/);
  assert.ok(s.leads.every(l=>s.units.find(u=>u.id===l.unitId).centre===l.centre));
  assert.equal(new Set(s.leads.map(l=>l.unitId)).size,s.leads.length);
});
test('la création réserve un seul box, une deuxième demande concurrente est refusée',()=>{
  const s=makeSeed(),u=s.units.find(u=>u.centre==='ch'&&u.status==='free');
  const input={centre:'ch',unitId:u.id,name:'Alex Exemple',email:'alex@exemple.invalid',start:'2026-11-03'};
  const l=createReservation(s,input);assert.equal(u.status,'reserved');assert.equal(stageOf(l),'new');
  assert.throws(()=>createReservation(s,input),/plus disponible/);
  assert.equal(s.leads.filter(x=>x.unitId===u.id).length,1);
});
test('un box d’un autre centre, une date invalide et des coordonnées vides sont refusés',()=>{
  const s=makeSeed(),u=s.units.find(u=>u.centre==='fr'&&u.status==='free');
  const base={centre:'fr',unitId:u.id,name:'Alex',email:'a@exemple.invalid',start:'2026-11-03'};
  assert.throws(()=>createReservation(s,{...base,centre:'ch'}),/disponible/);
  for(const start of ['2026-10-25','2026-02-31','2026-13-01','not-a-date'])assert.throws(()=>createReservation(s,{...base,start}));
  assert.throws(()=>createReservation(s,{...base,name:' '}));assert.throws(()=>createReservation(s,{...base,email:'invalid'}));
  assert.equal(validDate('2028-02-29'),true);assert.equal(validDate('2026-02-29'),false);
});
test('les documents reçus ne sont pas automatiquement vérifiés',()=>{
  const s=makeSeed(),l=s.leads.find(l=>l.id==='ch-lead-0');
  assert.equal(stageOf(l),'documents');assert.throws(()=>updateLead(s,l.id,'verifyDoc','insurance'),/reçu/);
  updateLead(s,l.id,'submitDoc','insurance');assert.equal(l.docs.insurance,'received');assert.equal(stageOf(l),'documents');
  updateLead(s,l.id,'verifyDoc','identity');updateLead(s,l.id,'verifyDoc','insurance');assert.equal(stageOf(l),'contract');
  assert.throws(()=>updateLead(s,l.id,'submitDoc','unknown'),/inconnu/);
});
test('le parcours complet garde la confirmation sous le contrôle du gérant',()=>{
  const s=makeSeed(),l=s.leads.find(l=>l.id==='ch-lead-0');
  assert.throws(()=>activateReservation(s,l.id),/complet/);assert.throws(()=>updateLead(s,l.id,'pay'),/signé/);
  updateLead(s,l.id,'submitDoc','insurance');updateLead(s,l.id,'verifyDoc','insurance');updateLead(s,l.id,'verifyDoc','identity');
  updateLead(s,l.id,'sign');assert.equal(stageOf(l),'payment');updateLead(s,l.id,'pay');assert.equal(stageOf(l),'ready');
  assert.equal(s.units.find(u=>u.id===l.unitId).status,'reserved');
  const before=metrics(s,'ch');const lease=activateReservation(s,l.id);const after=metrics(s,'ch');
  assert.equal(lease.deposit,l.deposit);assert.equal(after.occupied,before.occupied+1);assert.equal(after.reserved,before.reserved-1);
  assert.equal(after.collected-before.collected,l.monthly);assert.equal(after.monthly-before.monthly,l.monthly);
  assert.equal(stageOf(l),'active');assert.throws(()=>activateReservation(s,l.id),/déjà active/);
});
test('les gardes empêchent une signature avant validation et une activation en double',()=>{
  const s=makeSeed(),l=s.leads.find(l=>l.id==='ch-lead-4');assert.throws(()=>updateLead(s,l.id,'sign'),/Validez/);
  const ready=s.leads.find(l=>stageOf(l)==='ready');s.units.find(u=>u.id===ready.unitId).status='occupied';
  assert.throws(()=>activateReservation(s,ready.id),/indisponible/);
});
test('archiver une demande libère le box et conserve le dossier',()=>{
  const s=makeSeed(),l=s.leads[0],count=s.leads.length;cancelReservation(s,l.id);
  assert.equal(stageOf(l),'cancelled');assert.equal(s.units.find(u=>u.id===l.unitId).status,'free');assert.equal(s.leads.length,count);
  assert.throws(()=>updateLead(s,l.id,'accept'),/disponible/);
});
test('un paiement partiel conserve un solde exact puis peut être soldé',()=>{
  const s=makeSeed(),i=s.invoices.find(i=>i.centre==='ch'&&i.paid===0),full=i.amount;
  recordPayment(s,i.id,10.23);assert.equal(remaining(i),Math.round((full-10.23)*100)/100);assert.equal(invoiceStatus(i),'late');
  for(const bad of [-1,0,Infinity,NaN,full+1])assert.throws(()=>recordPayment(s,i.id,bad));
  recordPayment(s,i.id,remaining(i));assert.equal(remaining(i),0);assert.equal(invoiceStatus(i),'paid');
  assert.throws(()=>recordPayment(s,i.id,1));
});
test('clôturer une location préserve les factures, y compris leurs soldes',()=>{
  const s=makeSeed(),i=s.invoices.find(i=>i.paid===0),lease=s.leases.find(l=>l.id===i.leaseId),count=s.invoices.length,amount=remaining(i);
  endLease(s,lease.id);assert.equal(lease.status,'ended');assert.equal(s.units.find(u=>u.id===lease.unitId).status,'free');
  assert.equal(s.invoices.length,count);assert.equal(remaining(i),amount);assert.throws(()=>endLease(s,lease.id),/active/);
});
test('le stockage corrompu ou indisponible ne casse pas le chargement',()=>{
  const mock={getItem:()=>'{broken',setItem:()=>{throw new Error('quota');}};
  assert.equal(loadState(mock).units.length,84);assert.equal(saveState(mock,makeSeed()),false);
  assert.equal(loadState({getItem:()=>JSON.stringify({version:1})}).units.length,84);
  const contents=new Map(),store={getItem:k=>contents.get(k),setItem:(k,v)=>contents.set(k,v)};const s=makeSeed();s.settings.contact='Test';
  assert.equal(saveState(store,s),true);assert.equal(loadState(store).settings.contact,'Test');assert.ok(contents.has(STORAGE_KEY));
});
test('les exports neutralisent les formules et conservent les accents et les guillemets',()=>{
  const result=csv([['Nom','Valeur'],['=HYPERLINK("evil")','Élodie; exemple'],['+41','a"b']]);
  assert.ok(result.startsWith('\uFEFF'));assert.match(result,/'=HYPERLINK/);assert.match(result,/'\+41/);assert.match(result,/a""b/);assert.match(result,/Élodie; exemple/);
});
test('les règles désactivées ne produisent pas de candidats et restent dans leur centre',()=>{
  const s=makeSeed();assert.equal(ruleCandidates(s,'ch','payment').length,0);
  const docs=ruleCandidates(s,'ch','documents');assert.ok(docs.every(x=>s.leads.find(l=>l.id===x.id).centre==='ch'));
  s.rules.find(r=>r.id==='documents').enabled=false;assert.equal(ruleCandidates(s,'ch','documents').length,0);
});
