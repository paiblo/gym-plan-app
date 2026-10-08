(()=>{
if(window.__friendPlanSync)return;window.__friendPlanSync=true;

const DAY_KEYS=['Mo','Di','Mi','Do','Fr','Sa','So'];
const PLAN_KEY='gym:plan:v1';
let compareTarget=null,observer=null;

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function norm(s){return String(s||'').trim().toLocaleLowerCase('de-DE')}
function parsePlan(raw){try{return JSON.parse(raw||'null')}catch{return null}}
function clone(x){return JSON.parse(JSON.stringify(x))}

function ownExerciseDefaults(){
  const plan=parsePlan(localStorage.getItem(PLAN_KEY))||{};
  const map=new Map();
  for(const day of Object.values(plan))for(const list of Object.values(day?.groups||{}))for(const item of Array.isArray(list)?list:[]){
    const name=String(item?.[0]||'').trim();if(!name)continue;
    const key=norm(name);if(!map.has(key))map.set(key,[item?.[1]??null,item?.[2]??null]);
  }
  return map;
}

function sanitizeFriendPlan(raw){
  const out={},defaults=ownExerciseDefaults();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  for(const dayKey of DAY_KEYS){
    const src=raw[dayKey]&&typeof raw[dayKey]==='object'?raw[dayKey]:{};
    const groups={};
    const entries=src.groups&&typeof src.groups==='object'&&!Array.isArray(src.groups)?Object.entries(src.groups).slice(0,50):[];
    for(const [groupName,value] of entries){
      const g=String(groupName||'').trim().slice(0,60);if(!g)continue;
      const list=[];
      for(const item of (Array.isArray(value)?value:[]).slice(0,100)){
        const name=String(item?.[0]??'').trim().slice(0,120);if(!name)continue;
        const own=defaults.get(norm(name))||[null,null];
        list.push([name,own[0]??null,own[1]??null]);
      }
      groups[g]=list;
    }
    out[dayKey]={title:String(src.title||dayKey).trim().slice(0,60)||dayKey,split:String(src.split||'Training').trim().slice(0,120),groups};
  }
  try{if(typeof normalizePlanSplits==='function')normalizePlanSplits(out)}catch{}
  return out;
}

function countPlan(plan){let groups=0,exercises=0,trainingDays=0;for(const d of DAY_KEYS){let dayHas=false;for(const list of Object.values(plan?.[d]?.groups||{})){groups++;if(Array.isArray(list)&&list.length){dayHas=true;exercises+=list.length}}if(dayHas)trainingDays++}return{groups,exercises,trainingDays}}

async function fetchFriendPlan(uid){
  if(typeof rpc!=='function')throw new Error('Cloud-Verbindung noch nicht bereit.');
  const raw=await rpc('get_friend_training_plan',{p_user_id:uid});
  const value=Array.isArray(raw)?(raw[0]?.get_friend_training_plan??raw[0]??null):raw;
  const plan=sanitizeFriendPlan(value);
  if(!plan)throw new Error('Der Trainingsplan des Freundes konnte nicht geladen werden.');
  return plan;
}

async function applyPlan(plan){
  const stamp=String(Date.now());
  try{if(typeof saveLocalSafetyBackup==='function')saveLocalSafetyBackup('before_friend_plan_sync')}catch{}
  localStorage.setItem(PLAN_KEY,JSON.stringify(plan));
  for(const d of DAY_KEYS)localStorage.setItem(`gym:meta:plan:${d}`,stamp);
  try{PLAN=clone(plan)}catch{}
  try{window.dispatchEvent(new CustomEvent('gym:plan-changed',{detail:{day:null,source:'friend-sync'}}))}catch{}
  try{if(typeof render==='function')render()}catch{}
  let cloud=false;
  try{if(typeof pushRemoteState==='function'){await pushRemoteState();cloud=true}}catch{}
  return cloud;
}

function setMsg(panel,text,state=''){
  const el=panel?.querySelector('[data-plan-sync-msg]');if(!el)return;el.textContent=text;el.dataset.state=state;
}

async function syncFromFriend(panel){
  const uid=panel.dataset.friendId,name=panel.dataset.friendName||'diesem Freund',button=panel.querySelector('[data-sync-friend-plan]');
  if(!uid||!button)return;
  button.disabled=true;setMsg(panel,'Trainingsplan wird sicher geladen …','loading');
  try{
    const plan=await fetchFriendPlan(uid),info=countPlan(plan);
    const ok=confirm(`Trainingswochenplan von ${name} synchronisieren?\n\nÜbernommen werden ${info.trainingDays} Trainingstage mit ${info.exercises} Übungen.\n\nDeine eigenen Gewichte, Wiederholungen, PRs, Trainingshistorie, Aufgaben und Körperdaten bleiben erhalten. Dein bisheriger Wochenplan wird ersetzt.`);
    if(!ok){setMsg(panel,'Synchronisierung abgebrochen.','');return}
    setMsg(panel,'Plan wird übernommen …','loading');
    const cloud=await applyPlan(plan);
    setMsg(panel,cloud?'Trainingswochenplan übernommen und in deiner Cloud gespeichert.':'Trainingswochenplan übernommen. Cloud-Sync folgt automatisch.','ok');
    button.textContent='Erneut synchronisieren';
    const open=panel.querySelector('[data-open-synced-plan]');if(open)open.hidden=false;
  }catch(e){setMsg(panel,e?.message||'Synchronisierung fehlgeschlagen.','error')}
  finally{button.disabled=false}
}

function syncPanelMarkup(uid,name){return `<section class="friendPlanSync" data-friend-id="${esc(uid)}" data-friend-name="${esc(name)}"><div class="friendPlanSyncHead"><div><span>TRAININGSPLAN</span><h3>Wochenplan synchronisieren</h3></div><i>↔</i></div><p>Übernimmt einmalig nur die Aufteilung der sieben Tage, Kategorien und Übungen von <b>${esc(name)}</b>. Deine persönlichen Trainingswerte und deine Historie werden nicht übernommen oder überschrieben.</p><div class="friendPlanSyncSafety"><span>Bleibt bei dir</span><b>Gewichte · Wiederholungen · PRs · Verlauf · Aufgaben · Körperdaten</b></div><div class="friendPlanSyncActions"><button type="button" class="premiumPrimary" data-sync-friend-plan>Trainingswochenplan synchronisieren</button><button type="button" class="ghost" data-open-synced-plan hidden>Wochenplan ansehen</button></div><div class="friendPlanSyncMsg" data-plan-sync-msg></div></section>`}

function installPanel(){
  const compare=document.querySelector('#friendCompare .comparePanel');if(!compare||!compareTarget?.uid)return;
  let panel=compare.querySelector('.friendPlanSync');
  if(panel&&panel.dataset.friendId===compareTarget.uid)return;
  panel?.remove();
  compare.insertAdjacentHTML('beforeend',syncPanelMarkup(compareTarget.uid,compareTarget.name));
  panel=compare.querySelector('.friendPlanSync');
  panel.querySelector('[data-sync-friend-plan]').onclick=()=>syncFromFriend(panel);
  panel.querySelector('[data-open-synced-plan]').onclick=()=>{try{if(typeof go==='function')go('overview');else{mode='overview';render()}}catch{}};
}

function captureCompare(e){
  const b=e.target?.closest?.('[data-compare]');if(!b)return;
  compareTarget={uid:b.dataset.compare,name:b.dataset.name||b.closest('.premiumFriendRow')?.querySelector('b')?.textContent?.trim()||'Freund'};
  setTimeout(installPanel,80);setTimeout(installPanel,350);
}

document.addEventListener('click',captureCompare,true);
const start=()=>{observer=new MutationObserver(()=>installPanel());observer.observe(document.body,{childList:true,subtree:true});installPanel()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
