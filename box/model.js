// Règles métier et données fictives de la démonstration.
export const VERSION = 1;
export const STORAGE_KEY = 'chantelio-box-demo-ch-v1';
export const TODAY = '2026-10-26';
export const CENTRES = [
  {id:'ch', name:'Rivage · Lausanne', city:'Lausanne', country:'Suisse', code:'CH', currency:'CHF', locale:'fr-CH', address:'Centre de démonstration · Lausanne', depositMonths:2}
];
export const STAGES = [
  {id:'new', label:'Nouvelle demande', short:'Demande', color:'blue'},
  {id:'documents', label:'Dossier à compléter', short:'Dossier', color:'amber'},
  {id:'contract', label:'Contrat à signer', short:'Contrat', color:'purple'},
  {id:'payment', label:'Premier règlement', short:'Paiement', color:'orange'},
  {id:'ready', label:'Prêt à louer', short:'Prêt', color:'green'}
];
export const DOC_LABELS = {identity:'Justificatif d’identité', insurance:'Attestation d’assurance'};
export const UNIT_STATUS = {free:'Libre', occupied:'Loué', reserved:'Réservé', maintenance:'Maintenance'};
export const DEMO_NAMES = ['Emma Laurent','Thomas Perrin','Sarah Morel','Julien Favre','Léa Robert','Atelier du Lac','Camille Brun','Nicolas Rey','Élodie Simon','Hugo Bernard','Claire Martin','Louis Dubois','Manon Petit','Alexandre Mercier','Chloé Girard','Paul Lambert','Alice Blanc','Maxime Roche','Louise Chevalier','Antoine Vidal','Lucie Fournier','Gabriel Roux','Sophie Meyer','Matériel & Co','David Marchand','Julie Denis','Romain Clerc','Marine Aubert','Lucas Fontaine','Anna Renard','Mathieu Gros','Cécile André','Pierre Clément','Émilie Rivière','Léo Bertrand','Nora Fleury'];
export const clone = value => JSON.parse(JSON.stringify(value));
export function centre(id){ return CENTRES.find(c=>c.id===id) || CENTRES[0]; }
export function money(value, id='ch', decimals=0){ const c=centre(id); return new Intl.NumberFormat(c.locale,{style:'currency',currency:c.currency,minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(Number(value)||0); }
export function dateLabel(value, options={day:'numeric',month:'short'}){ return value ? new Intl.DateTimeFormat('fr-CH',options).format(new Date(value+'T12:00:00')) : '—'; }
export function plusDays(value,days){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===value;}
export function daysBetween(a,b){return Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000);}
export function stageOf(lead){if(lead.cancelled)return 'cancelled';if(lead.activated)return 'active';if(!lead.accepted)return 'new';if(Object.values(lead.docs).some(d=>d!=='verified'))return 'documents';if(!lead.signed)return 'contract';if(!lead.paid)return 'payment';return 'ready';}
export function progressOf(lead){ const steps=[lead.accepted,lead.docs.identity==='verified',lead.docs.insurance==='verified',lead.signed,lead.paid]; return Math.round(steps.filter(Boolean).length/steps.length*100); }
export function nextAction(lead){ return {new:'Valider la demande',documents:Object.values(lead.docs).includes('received')?'Vérifier les documents':'Demander les pièces',contract:'Préparer la signature',payment:'Suivre le règlement',ready:'Confirmer l’entrée',active:'Voir la location',cancelled:'Demande archivée'}[stageOf(lead)]; }
export function leadBlockers(lead){const r=[];if(!lead.accepted)r.push('Demande à valider');for(const [k,v] of Object.entries(lead.docs))if(v!=='verified')r.push(DOC_LABELS[k]+(v==='received'?' à vérifier':' manquant'));if(!lead.signed)r.push('Contrat non signé');if(!lead.paid)r.push('Premier règlement attendu');return r;}
export function remaining(invoice){return Math.max(0,Math.round((invoice.amount-invoice.paid)*100)/100);}
export function invoiceStatus(invoice){if(remaining(invoice)===0)return 'paid';if(invoice.due<TODAY)return 'late';if(invoice.paid>0)return 'partial';return 'pending';}
export function uid(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}
export function metrics(state, id){const units=state.units.filter(u=>u.centre===id);const sellable=units.filter(u=>u.status!=='maintenance');const occupied=units.filter(u=>u.status==='occupied');const invoices=state.invoices.filter(i=>i.centre===id);const leads=state.leads.filter(l=>l.centre===id&&!l.cancelled&&!l.activated);return {total:units.length,sellable:sellable.length,occupied:occupied.length,free:units.filter(u=>u.status==='free').length,reserved:units.filter(u=>u.status==='reserved').length,maintenance:units.filter(u=>u.status==='maintenance').length,occupancy:sellable.length?Math.round(occupied.length/sellable.length*100):0,leads:leads.length,ready:leads.filter(l=>stageOf(l)==='ready').length,blocked:leads.filter(l=>stageOf(l)!=='ready').length,monthly:occupied.reduce((s,u)=>s+u.price,0),collected:invoices.reduce((s,i)=>s+i.paid,0),outstanding:invoices.reduce((s,i)=>s+remaining(i),0),late:invoices.filter(i=>invoiceStatus(i)==='late').reduce((s,i)=>s+remaining(i),0),lateCount:invoices.filter(i=>invoiceStatus(i)==='late').length,potential:units.filter(u=>u.status==='free').reduce((s,u)=>s+u.price,0)};}
export function activeLeads(state,id){return state.leads.filter(l=>l.centre===id&&!l.cancelled&&!l.activated);}
export function logEvent(state,type,text,target){state.events.unshift({id:uid('evt'),type,text,target,date:new Date().toISOString()});state.events=state.events.slice(0,150);}
export function makeSeed(){
  const state={version:VERSION,centre:'ch',units:[],clients:[],leases:[],leads:[],invoices:[],events:[],rules:[{id:'documents',title:'Un dossier qui avance',description:'Pièces manquantes, 2 jours après la demande.',enabled:true,delay:2},{id:'signature',title:'Une signature sans oubli',description:'Contrat en attente de signature depuis 2 jours.',enabled:true,delay:2},{id:'payment',title:'Le bon rappel au bon moment',description:'Premier règlement attendu avant l’entrée.',enabled:false,delay:1},{id:'late',title:'Des loyers bien suivis',description:'Échéance dépassée depuis 3 jours.',enabled:true,delay:3}],settings:{company:'Rivage Stockage',contact:'Inès',notification:true,compact:false},lastRuleRun:null};
  const sizes=[2,3,5,5,7,10,14,18];
  for(const c of CENTRES){
    const count=48, occupied=30, reserved=7;
    for(let n=0;n<count;n++){
      const area=sizes[n%sizes.length], price=Math.round(32*area+48);
      const label=(n<24?'A':'B')+'-'+String(n%24+1).padStart(2,'0');
      const unit={id:c.id+'-'+label,label,centre:c.id,area,volume:Math.round(area*2.6),price,status:n<occupied?'occupied':n<occupied+reserved?'reserved':n>=count-3?'maintenance':'free',floor:'Rez-de-chaussée',building:n<24?'Bâtiment A':'Bâtiment B',features:area>=10?['Accès direct','Plain-pied','Sec et ventilé']:['Intérieur','Plain-pied','Sec et ventilé']};
      state.units.push(unit);
      if(n<occupied){
        const name=DEMO_NAMES[(n+8)%DEMO_NAMES.length],clientId=c.id+'-client-'+n;
        const client={id:clientId,centre:c.id,name,email:'client.'+(n+1)+'@exemple.invalid',phone:'+41 · numéro fictif',type:name.includes('Atelier')||name.includes('Co')?'Professionnel':'Particulier',note:n===2?'Préfère les échanges par email.':''};state.clients.push(client);
        const leaseId=c.id+'-lease-'+n;
        state.leases.push({id:leaseId,centre:c.id,clientId,unitId:unit.id,monthly:price,start:'2026-'+String(3+n%6).padStart(2,'0')+'-01',end:n===3||n===12?plusDays(TODAY,n===3?3:8):'',deposit:price*c.depositMonths,status:'active',docs:{identity:'verified',insurance:'verified'},signed:true});
        state.invoices.push({id:c.id+'-invoice-'+n,number:c.code+'-2026-'+String(1001+n),centre:c.id,clientId,leaseId,unitId:unit.id,amount:price,paid:n===1||n===7?0:n===14?Math.round(price/2):price,issued:'2026-10-01',due:n===1||n===7?'2026-10-05':n===14?'2026-10-28':'2026-10-10',method:'Virement',period:'Octobre 2026'});
      }
    }
    for(let i=0;i<reserved;i++){
      const u=state.units.filter(u=>u.centre===c.id&&u.status==='reserved')[i];const name=DEMO_NAMES[i];const clientId=c.id+'-prospect-'+i;state.clients.push({id:clientId,centre:c.id,name,email:'reservation.'+(i+1)+'@exemple.invalid',phone:'+41 · numéro fictif',type:i===5?'Professionnel':'Particulier',note:''});
      const patterns=[{accepted:true,docs:{identity:'received',insurance:'missing'},signed:false,paid:false},{accepted:true,docs:{identity:'verified',insurance:'verified'},signed:false,paid:false},{accepted:true,docs:{identity:'verified',insurance:'verified'},signed:true,paid:false},{accepted:true,docs:{identity:'verified',insurance:'verified'},signed:true,paid:true},{accepted:false,docs:{identity:'missing',insurance:'missing'},signed:false,paid:false},{accepted:true,docs:{identity:'missing',insurance:'received'},signed:false,paid:false},{accepted:true,docs:{identity:'verified',insurance:'verified'},signed:false,paid:false}];
      state.leads.push({id:c.id+'-lead-'+i,centre:c.id,clientId,unitId:u.id,start:plusDays(TODAY,i<4?i+1:i+3),created:plusDays(TODAY,-(i%3+1)),source:i%3===0?'Site internet':i%3===1?'Téléphone':'Email',monthly:u.price,deposit:u.price*c.depositMonths,note:i===0?'Déménagement prévu cette semaine. Souhaite finaliser son dossier à distance.':i===3?'Tous les éléments sont validés. Vous pouvez confirmer son arrivée.':'',cancelled:false,activated:false,...clone(patterns[i])});
    }
  }
  state.events=[{id:'seed-1',type:'document',text:'Emma Laurent a ajouté son justificatif d’identité.',target:'ch-lead-0',date:'2026-10-26T08:42:00Z'},{id:'seed-2',type:'payment',text:'Julien Favre a réglé son premier loyer et son dépôt.',target:'ch-lead-3',date:'2026-10-26T08:18:00Z'},{id:'seed-3',type:'contract',text:'Le contrat de Sarah Morel a été signé.',target:'ch-lead-2',date:'2026-10-26T07:56:00Z'},{id:'seed-4',type:'new',text:'Nouvelle demande de Léa Robert depuis le site.',target:'ch-lead-4',date:'2026-10-25T16:20:00Z'}];return state;
}
export function validateState(value){
  if(!value||value.version!==VERSION||!Array.isArray(value.units)||!Array.isArray(value.leads)||!Array.isArray(value.clients)||!Array.isArray(value.leases)||!Array.isArray(value.invoices)||!Array.isArray(value.events)||!Array.isArray(value.rules)||!value.settings)return false;
  const unitIds=new Set(value.units.map(u=>u.id)),clientIds=new Set(value.clients.map(c=>c.id));
  if(value.units.some(u=>!CENTRES.some(c=>c.id===u.centre)||!Number.isFinite(u.price)||u.price<0||!Object.hasOwn(UNIT_STATUS,u.status)))return false;
  if(value.leads.some(l=>!unitIds.has(l.unitId)||!clientIds.has(l.clientId)||!l.docs||!Number.isFinite(l.monthly)||!Number.isFinite(l.deposit)))return false;
  if(value.invoices.some(i=>!Number.isFinite(i.amount)||!Number.isFinite(i.paid)||i.amount<0||i.paid<0||i.paid>i.amount))return false;
  return true;
}
export function loadState(storage){try{const raw=storage.getItem(STORAGE_KEY);if(raw){const v=JSON.parse(raw);if(validateState(v))return v;}}catch{}return makeSeed();}
export function saveState(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{return false;}}
export function createReservation(state,input){
  const u=state.units.find(u=>u.id===input.unitId&&u.centre===input.centre);if(!u||u.status!=='free')throw new Error('Ce box n’est plus disponible. Choisissez un autre box libre.');
  if(!input.name?.trim())throw new Error('Indiquez le nom du client.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email||''))throw new Error('Indiquez une adresse email valide.');
  if(!validDate(input.start)||input.start<TODAY)throw new Error('Choisissez une date d’entrée à partir du 26 octobre 2026.');
  const c=centre(input.centre),clientId=uid('client');const client={id:clientId,centre:c.id,name:input.name.trim().slice(0,100),email:input.email.trim().slice(0,160),phone:(input.phone||'').trim().slice(0,50),type:input.type==='Professionnel'?'Professionnel':'Particulier',note:''};
  const lead={id:uid('lead'),centre:c.id,clientId,unitId:u.id,start:input.start,created:TODAY,source:input.source||'Saisie manuelle',monthly:u.price,deposit:u.price*c.depositMonths,note:(input.note||'').slice(0,2000),accepted:!!input.accepted,docs:{identity:'missing',insurance:'missing'},signed:false,paid:false,cancelled:false,activated:false};
  state.clients.push(client);state.leads.unshift(lead);u.status='reserved';logEvent(state,'new','Nouvelle demande de '+client.name+'.',lead.id);return lead;
}
export function getLead(state,id){const lead=state.leads.find(l=>l.id===id);if(!lead||lead.cancelled)throw new Error('Cette demande n’est plus disponible.');return lead;}
export function updateLead(state,id,action,doc){const l=getLead(state,id);if(l.activated)throw new Error('Cette demande est déjà devenue une location.');const client=state.clients.find(c=>c.id===l.clientId);const name=client?.name||'Client';
  if(action==='accept'){l.accepted=true;logEvent(state,'new','La demande de '+name+' est validée.',id);}
  else if(action==='submitDoc'){if(!Object.hasOwn(DOC_LABELS,doc))throw new Error('Document inconnu.');l.docs[doc]='received';logEvent(state,'document',DOC_LABELS[doc]+' reçu pour '+name+' (simulation).',id);}
  else if(action==='verifyDoc'){if(!Object.hasOwn(DOC_LABELS,doc))throw new Error('Document inconnu.');if(l.docs[doc]!=='received')throw new Error('Le document doit être reçu avant sa validation.');l.docs[doc]='verified';logEvent(state,'document',DOC_LABELS[doc]+' vérifié pour '+name+'.',id);}
  else if(action==='sign'){if(!l.accepted)throw new Error('Validez la demande avant la signature.');l.signed=true;logEvent(state,'contract','Signature simulée du contrat de '+name+'.',id);}
  else if(action==='pay'){if(!l.signed)throw new Error('Le contrat doit être signé avant le premier règlement.');l.paid=true;logEvent(state,'payment','Premier règlement simulé de '+name+'.',id);}
  else throw new Error('Action inconnue.');return l;
}
export function activateReservation(state,id){const l=getLead(state,id);if(l.activated)throw new Error('La location est déjà active.');if(stageOf(l)!=='ready')throw new Error('Le dossier doit être complet, le contrat signé et le premier règlement reçu.');const u=state.units.find(u=>u.id===l.unitId);if(!u||u.status!=='reserved'||state.leases.some(x=>x.unitId===u.id&&x.status==='active'))throw new Error('Ce box est déjà loué ou indisponible.');
  const lease={id:uid('lease'),centre:l.centre,clientId:l.clientId,unitId:l.unitId,monthly:l.monthly,deposit:l.deposit,start:l.start,end:'',status:'active',docs:clone(l.docs),signed:true};state.leases.push(lease);u.status='occupied';l.activated=true;
  state.invoices.unshift({id:uid('invoice'),number:centre(l.centre).code+'-2026-N'+state.invoices.length,centre:l.centre,clientId:l.clientId,leaseId:lease.id,unitId:u.id,amount:l.monthly,paid:l.monthly,issued:TODAY,due:l.start,method:'Premier règlement simulé',period:'Premier mois — dépôt suivi séparément'});logEvent(state,'active','Location confirmée : box '+u.label+'.',id);return lease;
}
export function cancelReservation(state,id){const l=getLead(state,id);if(l.activated)throw new Error('Une location active se clôture depuis sa fiche.');l.cancelled=true;const u=state.units.find(u=>u.id===l.unitId);if(u?.status==='reserved')u.status='free';logEvent(state,'archive','La demande a été archivée et le box libéré.',id);}
export function endLease(state,id){const lease=state.leases.find(l=>l.id===id);if(!lease||lease.status!=='active')throw new Error('Cette location n’est plus active.');lease.status='ended';lease.end=TODAY;const u=state.units.find(u=>u.id===lease.unitId);if(u)u.status='free';logEvent(state,'archive','Location du box '+(u?.label||'')+' clôturée. Factures conservées.',id);}
export function recordPayment(state,id,amount,method='Virement'){const invoice=state.invoices.find(i=>i.id===id);if(!invoice)throw new Error('Facture introuvable.');const value=Number(amount);if(!Number.isFinite(value)||value<=0||Math.round(value*100)>Math.round(remaining(invoice)*100))throw new Error('Le montant doit être positif et ne pas dépasser le solde restant.');invoice.paid=Math.round((invoice.paid+value)*100)/100;invoice.method=method;logEvent(state,'payment','Règlement de '+money(value,invoice.centre,2)+' enregistré (simulation).',invoice.id);return invoice;}
export function csvCell(v){const s=String(v??'');const safe=/^[=+@\-\t\r]/.test(s)?"'"+s:s;return '"'+safe.replaceAll('"','""')+'"';}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');}
export function ruleCandidates(state,id,ruleId){
  const rule=state.rules.find(r=>r.id===ruleId);if(!rule?.enabled)return [];
  if(ruleId==='late')return state.invoices.filter(i=>i.centre===id&&invoiceStatus(i)==='late'&&daysBetween(i.due,TODAY)>=rule.delay).map(i=>({id:i.id,clientId:i.clientId,kind:'invoice'}));
  return activeLeads(state,id).filter(l=>{const stage=stageOf(l);return ruleId==='documents'?stage==='documents'&&Object.values(l.docs).includes('missing')&&daysBetween(l.created,TODAY)>=rule.delay:ruleId==='signature'?stage==='contract'&&daysBetween(l.created,TODAY)>=rule.delay:ruleId==='payment'?stage==='payment'&&daysBetween(TODAY,l.start)<=rule.delay:false;}).map(l=>({id:l.id,clientId:l.clientId,kind:'lead'}));
}
