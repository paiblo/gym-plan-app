(()=>{
if(window.__tpCustom)return;window.__tpCustom=true;
const KEY='gym:theme:v1',BRAND='Trainingsplaner by Paiblo';
const DEF={primary:'#ff8a3d',secondary:'#ffb06d',info:'#38bdf8',success:'#53d28a',warning:'#d39a3a',danger:'#ff5f70',background:'#07090c',surface:'#11171e',surface2:'#0b1016',border:'#202a35',text:'#f6f8fb',muted:'#7e8997',self:'#ff9450',friend:'#38bdf8',chartSets:'#ff9450',chartVolume:'#ffb06d',chartWeight:'#38bdf8',muscleNone:'#35404d',muscleLight:'#38bdf8',muscleMedium:'#ff9b55',muscleStrong:'#ff4d5f'};
const F=[['primary','Primärfarbe'],['secondary','Sekundärfarbe'],['info','Info / Links'],['success','Erfolg'],['warning','Warnung'],['danger','Fehler / Gefahr'],['background','App-Hintergrund'],['surface','Karten'],['surface2','Felder / Unterflächen'],['border','Rahmen'],['text','Haupttext'],['muted','Sekundärtext'],['self','Vergleich · Du'],['friend','Vergleich · Freund'],['chartSets','Diagramm · Sätze'],['chartVolume','Diagramm · Volumen'],['chartWeight','Diagramm · Gewicht'],['muscleNone','Muskel · keine Daten'],['muscleLight','Muskel · leicht'],['muscleMedium','Muskel · mittel'],['muscleStrong','Muskel · stark']];
let theme=load(),timer=null;const cache=new Map();
function load(){try{return {...DEF,...(JSON.parse(localStorage.getItem(KEY)||'null')||{})}}catch{return {...DEF}}}
function hex(x){return /^#[0-9a-f]{6}$/i.test(x||'')}
function onColor(x){if(!hex(x))return'#fff';const n=parseInt(x.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;return(.299*r+.587*g+.114*b)/255>.62?'#090b0f':'#fff'}
function varName(k){return '--tp-'+k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())}
function apply(save=false){for(const[k]of F)if(hex(theme[k]))document.documentElement.style.setProperty(varName(k),theme[k]);document.documentElement.style.setProperty('--tp-on-primary',onColor(theme.primary));document.documentElement.style.setProperty('--tp-on-secondary',onColor(theme.secondary));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.background);if(save)localStorage.setItem(KEY,JSON.stringify(theme));recolor();syncInputs()}
function uid(){try{return cloudSession?.user?.id||JSON.parse(localStorage.getItem('gym-auth-session')||'null')?.user?.id||null}catch{return null}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function initial(s){return(String(s||'P').trim()[0]||'P').toUpperCase()}
async function profile(id){const r=await api(`/rest/v1/profiles?select=user_id,display_name,username,avatar_path&user_id=eq.${encodeURIComponent(id)}&limit=1`);if(!r.ok)return null;const a=await r.json();return a[0]||null}
async function avatar(id){if(!id)return null;if(cache.has(id))return cache.get(id);let p;try{p=await profile(id)}catch{return null}if(!p?.avatar_path)return null;const path=p.avatar_path.split('/').map(encodeURIComponent).join('/');const r=await api('/storage/v1/object/authenticated/profile-avatars/'+path);if(!r.ok)return null;const u=URL.createObjectURL(await r.blob());cache.set(id,u);return u}
function rowId(row){return row?.dataset?.userId||row?.querySelector('[data-compare]')?.dataset.compare||row?.querySelector('[data-uid]')?.dataset.uid||row?.querySelector('[data-add]')?.dataset.add||null}
function rowName(row){return row?.querySelector('b,.socialName')?.textContent?.trim()||'P'}
async function box(box,id,name){if(!box)return;box.textContent=initial(name);const u=await avatar(id);if(u&&box.isConnected)box.innerHTML=`<img src="${u}" alt="Profilbild von ${esc(name)}">`}
async function avatars(){
 const own=uid(),ownName=document.querySelector('.profileIdentity h2,.socialName')?.textContent?.trim()||'P';
 const ee=document.querySelector('#editEmoji');if(ee){ee.value='P';ee.hidden=true}
 const pf=document.querySelector('#pageAvatarFallback');if(pf)pf.textContent=initial(ownName);
 const tf=document.querySelector('#premiumProfileFallback');if(tf)tf.textContent=initial(ownName);
 const so=document.querySelector('.socialIdentity .socialAvatar');if(so&&!so.querySelector('img'))box(so,own,ownName);
 for(const row of document.querySelectorAll('.premiumFriendRow,.friendRow')){const b=row.querySelector('.friendPic,.friendAvatar');if(b&&!b.querySelector('img'))box(b,rowId(row),rowName(row))}
}
function branding(){
 document.title=BRAND;document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content','Trainingsplaner');
 const p=[['.premiumBrand small','TRAININGSPLANER BY PAIBLO'],['.drawerBrand b','Trainingsplaner'],['.drawerBrand small','by Paiblo · Train. Track. Progress.'],['.welcomeBrand b','TRAININGSPLANER'],['.welcomeBrand small','by Paiblo'],['.authBrand h1','Trainingsplaner'],['.authBrand p','by Paiblo · Deine Trainingsdaten auf jedem Gerät.']];
 for(const[s,t]of p)document.querySelectorAll(s).forEach(e=>e.textContent=t);
 document.querySelectorAll('.eyebrow').forEach(e=>e.textContent='TRAININGSPLANER · BY PAIBLO');
}
function recolor(){
 const s=getComputedStyle(document.documentElement),c=k=>s.getPropertyValue('--tp-'+k).trim();
 document.querySelectorAll('#stableAnalytics .chartCard:nth-child(1) svg rect').forEach(e=>{if(e.getAttribute('fill')!=='#222b35')e.setAttribute('fill',c('chart-sets'))});
 document.querySelectorAll('#stableAnalytics .chartCard:nth-child(2) svg rect').forEach(e=>{if(e.getAttribute('fill')!=='#222b35')e.setAttribute('fill',c('chart-volume'))});
 document.querySelectorAll('#stableAnalytics .chartCard:nth-child(3) svg polyline,#stableAnalytics .chartCard:nth-child(3) svg circle').forEach(e=>e.setAttribute('stroke',c('chart-weight')));
 document.querySelectorAll('.stableCompare .stableHead small').forEach(e=>e.innerHTML='<span class="tpLegend"><i class="self"></i>Du <i class="friend"></i>Freund</span>');
}
function panel(){return `<section id="themeSettings" class="premiumPanel tpThemePanel"><div class="sectionHead"><div><span>DESIGN</span><h3>Farben individuell anpassen</h3></div></div><p class="panelText">Alle wichtigen UI-Farben lassen sich einzeln ändern. Legenden verwenden Farbpunkte statt Farbnamen, damit die Beschriftung immer stimmt.</p><div class="tpColorGrid">${F.map(([k,l])=>`<label class="tpColorField"><span>${esc(l)}</span><div><input type="color" data-theme="${k}" value="${theme[k]}"><code data-code="${k}">${theme[k].toUpperCase()}</code></div></label>`).join('')}</div><div class="tpThemeActions"><button class="premiumPrimary" id="themeSave">Farben speichern</button><button class="premiumSecondary" id="themeReset">Standardfarben</button></div><div class="inlineMsg" id="themeMsg"></div></section>`}
function settings(){
 const a=document.querySelector('#area');if(!a||document.body.dataset.page!=='settings'||a.querySelector('#themeSettings'))return;
 (a.querySelector('.pageIntro')||a).insertAdjacentHTML(a.querySelector('.pageIntro')?'afterend':'afterbegin',panel());
 a.querySelectorAll('[data-theme]').forEach(i=>i.oninput=()=>{theme[i.dataset.theme]=i.value;apply();a.querySelector(`[data-code="${i.dataset.theme}"]`).textContent=i.value.toUpperCase()});
 a.querySelector('#themeSave').onclick=()=>{apply(true);a.querySelector('#themeMsg').textContent='Farben gespeichert und mit deinem Account synchronisiert.'};
 a.querySelector('#themeReset').onclick=()=>{theme={...DEF};apply(true);a.querySelector('#themeMsg').textContent='Standardfarben wiederhergestellt.'};
}
function syncInputs(){document.querySelectorAll('[data-theme]').forEach(i=>{i.value=theme[i.dataset.theme];document.querySelector(`[data-code="${i.dataset.theme}"]`)?.replaceChildren(theme[i.dataset.theme].toUpperCase())})}
function patch(){branding();avatars();settings();recolor();document.querySelectorAll('.friendPic,.friendAvatar,.socialAvatar').forEach(e=>{if(!e.querySelector('img'))e.textContent=initial(e.closest('.premiumFriendRow,.friendRow,.socialIdentity')?.querySelector('b,.socialName')?.textContent||'P')})}
function schedule(){clearTimeout(timer);timer=setTimeout(patch,40)}
apply();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{patch();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})},{once:true});else{patch();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})}
window.addEventListener('storage',e=>{if(e.key===KEY){theme=load();apply();schedule()}});
window.TrainingsplanerTheme={get:()=>({...theme}),reset:()=>{theme={...DEF};apply(true)},apply:x=>{theme={...theme,...x};apply(true)}};
})();