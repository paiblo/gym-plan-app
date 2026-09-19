(()=>{
if(window.__tpCustomV2)return;window.__tpCustomV2=true;
const KEY='gym:theme:v1',META_KEY='gym:meta:theme',BRAND='Trainingsplaner by Paiblo';
const DEF={primary:'#ff8a3d',secondary:'#ffb06d',info:'#38bdf8',success:'#53d28a',warning:'#d39a3a',danger:'#ff5f70',background:'#07090c',surface:'#11171e',surface2:'#0b1016',border:'#202a35',text:'#f6f8fb',muted:'#7e8997',self:'#ff9450',friend:'#38bdf8',chartSets:'#ff9450',chartVolume:'#ffb06d',chartWeight:'#38bdf8',muscleNone:'#35404d',muscleLight:'#38bdf8',muscleMedium:'#ff9b55',muscleStrong:'#ff4d5f'};
const F=[['primary','Primärfarbe'],['secondary','Sekundärfarbe'],['info','Info / Links'],['success','Erfolg'],['warning','Warnung'],['danger','Fehler / Gefahr'],['background','App-Hintergrund'],['surface','Karten'],['surface2','Felder / Unterflächen'],['border','Rahmen'],['text','Haupttext'],['muted','Sekundärtext'],['self','Vergleich · Du'],['friend','Vergleich · Freund'],['chartSets','Diagramm · Sätze'],['chartVolume','Diagramm · Volumen'],['chartWeight','Diagramm · Gewicht'],['muscleNone','Muskel · keine Daten'],['muscleLight','Muskel · leicht'],['muscleMedium','Muskel · mittel'],['muscleStrong','Muskel · stark']];
let theme=load(),timer=null,patching=false,themeCloudBusy=false,themeCloudTimer=null;
const avatarCache=new Map();
function cleanTheme(value){const out={};for(const[k]of F){const v=value?.[k];if(/^#[0-9a-f]{6}$/i.test(v||''))out[k]=v.toLowerCase()}return out}
function load(){try{return {...DEF,...cleanTheme(JSON.parse(localStorage.getItem(KEY)||'null')||{})}}catch{return {...DEF}}}
function localThemeTime(){const n=Number(localStorage.getItem(META_KEY)||0);return Number.isFinite(n)?n:0}
function storeLocalTheme(value,ts=Date.now()){const clean={...DEF,...cleanTheme(value)};try{if(typeof rawSetItem==='function'){rawSetItem.call(localStorage,KEY,JSON.stringify(clean));rawSetItem.call(localStorage,META_KEY,String(ts))}else{localStorage.setItem(KEY,JSON.stringify(clean));localStorage.setItem(META_KEY,String(ts))}}catch{localStorage.setItem(KEY,JSON.stringify(clean));localStorage.setItem(META_KEY,String(ts))}theme=clean;return clean}
function hex(x){return /^#[0-9a-f]{6}$/i.test(x||'')}
function onColor(x){if(!hex(x))return'#fff';const n=parseInt(x.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return(.299*r+.587*g+.114*b)/255>.62?'#090b0f':'#fff'}
function varName(k){return '--tp-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}
function uid(){try{return cloudSession?.user?.id||JSON.parse(localStorage.getItem('gym-auth-session')||'null')?.user?.id||null}catch{return null}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function initial(s){return(String(s||'P').trim()[0]||'P').toUpperCase()}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
function setAttr(el,name,value){if(el&&el.getAttribute(name)!==value)el.setAttribute(name,value)}
function apply(save=false){
  for(const[k]of F)if(hex(theme[k]))document.documentElement.style.setProperty(varName(k),theme[k]);
  document.documentElement.style.setProperty('--tp-on-primary',onColor(theme.primary));
  document.documentElement.style.setProperty('--tp-on-secondary',onColor(theme.secondary));
  setAttr(document.querySelector('meta[name="theme-color"]'),'content',theme.background);
  if(save)storeLocalTheme(theme,Date.now());
  recolor();syncInputs();
}
async function saveCloudTheme(value=theme,ts=localThemeTime()||Date.now()){
  const id=uid();if(!id||typeof api!=='function'||!navigator.onLine)return false;
  const body={user_id:id,ui_theme:cleanTheme(value),ui_theme_updated_at:new Date(ts).toISOString(),updated_at:new Date().toISOString()};
  try{const r=await api('/rest/v1/profile_details?on_conflict=user_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});return r.ok}catch{return false}
}
async function syncThemeCloud(){
  if(themeCloudBusy)return false;const id=uid();if(!id||typeof api!=='function'||!navigator.onLine)return false;themeCloudBusy=true;
  try{
    const r=await api(`/rest/v1/profile_details?select=ui_theme,ui_theme_updated_at&user_id=eq.${encodeURIComponent(id)}&limit=1`);if(!r.ok)return false;
    const rows=await r.json(),row=rows[0]||{},remote=cleanTheme(row.ui_theme||{}),remoteKeys=Object.keys(remote).length,remoteTs=row.ui_theme_updated_at?Date.parse(row.ui_theme_updated_at):0,localTs=localThemeTime(),hasLocal=!!localStorage.getItem(KEY);
    if(remoteKeys&&(!hasLocal||remoteTs>localTs+1000)){storeLocalTheme(remote,remoteTs||Date.now());apply(false);schedule();return true}
    if(hasLocal&&localTs>remoteTs+1000){await saveCloudTheme(theme,localTs);return true}
    if(!remoteKeys&&hasLocal){await saveCloudTheme(theme,localTs||Date.now());return true}
    return true;
  }catch{return false}finally{themeCloudBusy=false}
}
function scheduleThemeCloud(delay=450){clearTimeout(themeCloudTimer);themeCloudTimer=setTimeout(()=>syncThemeCloud(),delay)}
async function avatarUrl(id){
  if(!id)return null;
  if(avatarCache.has(id))return avatarCache.get(id);
  const promise=(async()=>{
    try{
      const r=await api(`/rest/v1/profiles?select=user_id,avatar_path&user_id=eq.${encodeURIComponent(id)}&limit=1`);
      if(!r.ok)return null;const rows=await r.json(),path=rows[0]?.avatar_path;if(!path)return null;
      const safe=String(path).split('/').map(encodeURIComponent).join('/');
      const a=await api('/storage/v1/object/authenticated/profile-avatars/'+safe);if(!a.ok)return null;
      return URL.createObjectURL(await a.blob());
    }catch{return null}
  })();
  avatarCache.set(id,promise);promise.then(u=>{if(!u&&avatarCache.get(id)===promise)avatarCache.delete(id)});return promise;
}
function invalidateOwnAvatar(){const id=uid();if(!id)return;const old=avatarCache.get(id);avatarCache.delete(id);document.querySelectorAll(`[data-tp-avatar-id="${id}"]`).forEach(e=>e.dataset.tpAvatarResolved='0');Promise.resolve(old).then(u=>{if(u)try{URL.revokeObjectURL(u)}catch{}})}
async function setAvatar(box,id,name){
  if(!box)return;
  const fallback=initial(name);
  if(!box.querySelector('img')&&box.textContent!==fallback)setText(box,fallback);
  if(!id){box.dataset.tpAvatarResolved='1';return}
  if(box.dataset.tpAvatarId===id&&box.dataset.tpAvatarResolved==='1')return;
  box.dataset.tpAvatarId=id;
  const u=await avatarUrl(id);
  if(!box.isConnected||box.dataset.tpAvatarId!==id)return;
  if(u){
    const current=box.querySelector('img');
    if(!current||current.src!==u)box.innerHTML=`<img src="${u}" alt="Profilbild von ${esc(name)}">`;
  }else if(box.querySelector('img'))setText(box,fallback);
  box.dataset.tpAvatarResolved='1';
}
function rowId(row){return row?.dataset?.userId||row?.querySelector('[data-compare]')?.dataset.compare||row?.querySelector('[data-uid]')?.dataset.uid||row?.querySelector('[data-add]')?.dataset.add||null}
function rowName(row){return row?.querySelector('b,.socialName')?.textContent?.trim()||'P'}
async function avatars(){
  const own=uid(),ownName=document.querySelector('.profileIdentity h2,.socialName')?.textContent?.trim()||'P';
  const ee=document.querySelector('#editEmoji');if(ee){ee.value='P';ee.hidden=true;ee.classList.add('avatarEmojiGhost')}
  const pf=document.querySelector('#pageAvatarFallback');if(pf)setText(pf,initial(ownName));
  const tf=document.querySelector('#premiumProfileFallback');if(tf)setText(tf,initial(ownName));
  const so=document.querySelector('.socialIdentity .socialAvatar');if(so)await setAvatar(so,own,ownName);
  for(const row of document.querySelectorAll('.premiumFriendRow,.friendRow'))await setAvatar(row.querySelector('.friendPic,.friendAvatar'),rowId(row),rowName(row));
}
function branding(){
  if(document.title!==BRAND)document.title=BRAND;
  setAttr(document.querySelector('meta[name="apple-mobile-web-app-title"]'),'content','Trainingsplaner');
  const items=[['.premiumBrand small','TRAININGSPLANER BY PAIBLO'],['.drawerBrand b','Trainingsplaner'],['.drawerBrand small','by Paiblo · Train. Track. Progress.'],['.welcomeBrand b','TRAININGSPLANER'],['.welcomeBrand small','by Paiblo'],['.authBrand h1','Trainingsplaner'],['.authBrand p','by Paiblo · Deine Trainingsdaten auf jedem Gerät.']];
  for(const[s,t]of items)document.querySelectorAll(s).forEach(e=>setText(e,t));
  document.querySelectorAll('.eyebrow').forEach(e=>setText(e,'TRAININGSPLANER · BY PAIBLO'));
}
function recolor(){
  const s=getComputedStyle(document.documentElement),c=k=>s.getPropertyValue('--tp-'+k).trim();
  document.querySelectorAll('#stableAnalytics .chartCard:nth-child(1) svg rect').forEach(e=>{if(e.getAttribute('fill')!=='#222b35')setAttr(e,'fill',c('chart-sets'))});
  document.querySelectorAll('#stableAnalytics .chartCard:nth-child(2) svg rect').forEach(e=>{if(e.getAttribute('fill')!=='#222b35')setAttr(e,'fill',c('chart-volume'))});
  document.querySelectorAll('#stableAnalytics .chartCard:nth-child(3) svg polyline,#stableAnalytics .chartCard:nth-child(3) svg circle').forEach(e=>setAttr(e,'stroke',c('chart-weight')));
  document.querySelectorAll('.stableCompare .stableHead small').forEach(e=>{if(!e.querySelector('.tpLegend'))e.innerHTML='<span class="tpLegend"><i class="self"></i>Du <i class="friend"></i>Freund</span>'});
}
function panel(){return `<section id="themeSettings" class="premiumPanel tpThemePanel"><div class="sectionHead"><div><span>DESIGN</span><h3>Farben individuell anpassen</h3></div></div><p class="panelText">Alle wichtigen UI-Farben lassen sich einzeln ändern. Legenden verwenden Farbpunkte statt Farbnamen, damit die Beschriftung immer stimmt.</p><div class="tpColorGrid">${F.map(([k,l])=>`<label class="tpColorField"><span>${esc(l)}</span><div><input type="color" data-theme="${k}" value="${theme[k]}"><code data-code="${k}">${theme[k].toUpperCase()}</code></div></label>`).join('')}</div><div class="tpThemeActions"><button class="premiumPrimary" id="themeSave">Farben speichern</button><button class="premiumSecondary" id="themeReset">Standardfarben</button></div><div class="inlineMsg" id="themeMsg"></div></section>`}
function settings(){
  const a=document.querySelector('#area');if(!a||document.body.dataset.page!=='settings'||a.querySelector('#themeSettings'))return;
  const intro=a.querySelector('.pageIntro');if(intro)intro.insertAdjacentHTML('afterend',panel());else a.insertAdjacentHTML('afterbegin',panel());
  a.querySelectorAll('[data-theme]').forEach(i=>i.oninput=()=>{theme[i.dataset.theme]=i.value;apply();setText(a.querySelector(`[data-code="${i.dataset.theme}"]`),i.value.toUpperCase())});
  a.querySelector('#themeSave').onclick=async()=>{const msg=a.querySelector('#themeMsg');apply(true);setText(msg,'Farben lokal gespeichert · Cloud wird bestätigt …');const ok=await saveCloudTheme(theme,localThemeTime());setText(msg,ok?'Farben sicher in deiner Cloud gespeichert.':'Farben lokal gespeichert · Cloud-Sync folgt automatisch.');if(!ok)scheduleThemeCloud(1400)};
  a.querySelector('#themeReset').onclick=async()=>{const msg=a.querySelector('#themeMsg');theme={...DEF};apply(true);setText(msg,'Standardfarben gespeichert · Cloud wird bestätigt …');const ok=await saveCloudTheme(theme,localThemeTime());setText(msg,ok?'Standardfarben sicher in deiner Cloud gespeichert.':'Standardfarben lokal gespeichert · Cloud-Sync folgt automatisch.');if(!ok)scheduleThemeCloud(1400)};
}
function syncInputs(){document.querySelectorAll('[data-theme]').forEach(i=>{if(i.value!==theme[i.dataset.theme])i.value=theme[i.dataset.theme];setText(document.querySelector(`[data-code="${i.dataset.theme}"]`),theme[i.dataset.theme].toUpperCase())})}
async function patch(){
  if(patching)return;patching=true;
  try{branding();settings();recolor();await avatars()}finally{patching=false}
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>patch(),60)}
apply();
const start=()=>{patch();scheduleThemeCloud(900);setTimeout(()=>syncThemeCloud(),3200);new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length||m.removedNodes.length))schedule()}).observe(document.body,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('storage',e=>{if(e.key===KEY){theme=load();apply();schedule();scheduleThemeCloud(700)}});window.addEventListener('gym:snapshot-applied',()=>{theme=load();apply();schedule();scheduleThemeCloud(600)});window.addEventListener('gym:avatar-updated',()=>{invalidateOwnAvatar();schedule()});window.addEventListener('online',()=>scheduleThemeCloud(250));window.addEventListener('focus',()=>scheduleThemeCloud(450));
document.addEventListener('change',e=>{if(e.target?.id==='profileAvatarFile'||e.target?.id==='obAvatar'){setTimeout(()=>{invalidateOwnAvatar();schedule()},1200)}});
window.TrainingsplanerTheme={get:()=>({...theme}),reset:async()=>{theme={...DEF};apply(true);return saveCloudTheme(theme,localThemeTime())},apply:async x=>{theme={...theme,...cleanTheme(x)};apply(true);return saveCloudTheme(theme,localThemeTime())},sync:syncThemeCloud,refreshAvatars:()=>{avatarCache.clear();schedule()}};
})();