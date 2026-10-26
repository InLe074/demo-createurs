import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Tests de rendu et des actions publiques, sans navigateur. Ce harnais ne remplace pas une QA visuelle.
const elements=new Map();
function element(){return {innerHTML:'',inert:false,style:{},focus(){},replaceChildren(){this.innerHTML='';},append(){},remove(){},click(){},querySelectorAll(){return [];}};}
for(const id of ['#app','#overlay-root','#toast-root'])elements.set(id,element());
const storage=new Map();
const listeners={};
globalThis.window={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},addEventListener(){},scrollTo(){}};
globalThis.location={hash:'#/apercu'};
globalThis.HTMLInputElement=class {};
globalThis.document={title:'',activeElement:null,body:{style:{},classList:{toggle(){},add(){},remove(){}},append(){}},querySelector:s=>elements.get(s)||null,getElementById:()=>null,addEventListener:(e,fn)=>listeners[e]=fn,createElement:()=>element()};
const modelURL=new URL('../model.js',import.meta.url).href;
let source=await readFile(new URL('../app.js',import.meta.url),'utf8');
source=source.replace(/'\.\/model\.js(?:\?[^']*)?'/,JSON.stringify(modelURL));
source+='\nexport {render,actionHandler,openOverlay,closeOverlay}; export const testState=()=>state; export const testUi=()=>ui;\n//# sourceURL=chantelio-box-ui-test.mjs';
const app=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const html=()=>elements.get('#app').innerHTML;
const overlayHtml=()=>elements.get('#overlay-root').innerHTML;

test('les 14 écrans se rendent avec leurs données et leurs liens',async()=>{
  const pages=['apercu','reservations','box','clients','documents','contrats','paiements','automatisations','analyses','parametres','guide','presentation','client','reserver'];
  const snapshots=new URL('./snapshots/',import.meta.url);await mkdir(snapshots,{recursive:true});
  for(const page of pages){location.hash='#/'+page;app.render();const h=html();assert.ok(h.length>1000,page);assert.match(h,/main-content/,page);assert.doesNotMatch(h,/\b(?:undefined|NaN)\b/,page);assert.match(h,/démo|démonstration|Démo|Démonstration/,page);await writeFile(new URL(page+'.html',snapshots),h);}
});
test('les principales fiches, formulaires et fenêtres sont accessibles',()=>{
  const state=app.testState();const ready=state.leads.find(l=>l.id==='ch-lead-3');
  for(const [kind,id] of [['lead','ch-lead-0'],['unit','ch-A-01'],['client','ch-client-0'],['reservation',''],['unit-form',''],['payment','ch-invoice-1'],['first-payment','ch-lead-2'],['contract','ch-lead-1'],['draft','ch-lead-0'],['search',''],['notifications',''],['profile',''],['reset',''],['cancel','ch-lead-0'],['end-lease','ch-lease-0'],['plan-exit','ch-lease-0'],['tour','']]){
    app.openOverlay(kind,id);assert.match(overlayHtml(),/role="dialog"/,kind);assert.match(overlayHtml(),/aria-modal="true"/,kind);assert.doesNotMatch(overlayHtml(),/\b(?:undefined|NaN)\b/,kind);app.closeOverlay();
  }
  assert.equal(ready.activated,false);
});
test('les actions gérant font réellement avancer le dossier et les indicateurs',()=>{
  location.hash='#/reservations';app.render();app.openOverlay('lead','ch-lead-0');
  app.actionHandler('submit-doc','ch-lead-0|insurance');app.actionHandler('verify-doc','ch-lead-0|insurance');app.actionHandler('verify-doc','ch-lead-0|identity');
  assert.match(overlayHtml(),/Contrat à signer/);
  const state=app.testState(),before=state.units.filter(u=>u.status==='occupied').length;
  app.actionHandler('activate','ch-lead-3');assert.equal(state.units.filter(u=>u.status==='occupied').length,before+1);assert.equal(state.leads.find(l=>l.id==='ch-lead-3').activated,true);
  app.openOverlay('unit','ch-B-10');assert.match(overlayHtml(),/Disponible|disponible|Loué|Réservé|Maintenance/);app.closeOverlay();
});
test('les vues et les filtres restent reliés à des données réelles du scénario',()=>{
  location.hash='#/box';app.actionHandler('unit-filter','free');assert.match(html(),/class="unit-box free"/);assert.doesNotMatch(html(),/class="unit-box occupied"/);
  app.actionHandler('unit-view','cards');assert.match(html(),/unit-card/);
  location.hash='#/reservations';app.actionHandler('reservation-view','list');assert.match(html(),/data-table/);
  location.hash='#/paiements';app.actionHandler('payment-filter','late');assert.match(html(),/En retard/);
});
test('les données saisies sont échappées dans le rendu des clients et des notes',()=>{
  const s=app.testState(),c=s.clients.find(c=>c.centre==='ch');const original=c.name;c.name='<img src=x onerror=alert(1)>';location.hash='#/clients';app.testUi().clientFilter='all';app.render();assert.match(html(),/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html(),/<img src=x/);c.name=original;
});
