(()=>{
  if(window.__paibloUiFixV3)return;
  window.__paibloUiFixV3=true;

  const ANATOMY='https://upload.wikimedia.org/wikipedia/commons/e/ef/Muscles_front_and_back.svg';
  let profileCacheV3=null;
  let patchBusy=false;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid=()=>{try{return cloudSession?.user?.id||JSON.parse(localStorage.getItem('gym-auth-session')||'null')?.user?.id||null}catch{return null}};
  const currentMode=()=>{try{return typeof mode!=='undefined'?mode:null}catch{return null}};

  async function json(path,options={}){
    if(typeof api!=='function')throw new Error('api_unavailable');
    const r=await api(path,options);
    let data=null;try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data?.message||data?.error||`HTTP ${r.status}`);
    return data;
  }

  async function ownProfile(force=false){
    if(profileCacheV3&&!force)return profileCacheV3;
    const id=uid();if(!id)return null;
    const rows=await json(`/rest/v1/profiles?select=user_id,username,display_name,avatar_emoji,avatar_path&user_id=eq.${encodeURIComponent(id)}&limit=1`);
    profileCacheV3=rows?.[0]||null;
    return profileCacheV3;
  }

  function goDashboard(){
    const b=document.querySelector('#premiumDrawer [data-page="dashboard"]');
    if(b){b.click();window.scrollTo({top:0,behavior:'smooth'});return}
    try{mode='dashboard';render();window.scrollTo({top:0,behavior:'smooth'})}catch{}
  }

  function forceTopbar(){
    const top=document.querySelector('#premiumTopbar');
    if(!top)return;
    top.classList.add('v3AlwaysTop');
    const title=document.querySelector('#premiumPageTitle');
    if(title&&currentMode()==='profilepage')title.textContent='Profil';
  }

  function ensureProfileExit(){
    if(currentMode()!=='profilepage')return;
    const area=document.querySelector('#area');if(!area)return;
    if(!area.querySelector('#v3ProfileExit')){
      const b=document.createElement('button');
      b.id='v3ProfileExit';b.type='button';b.className='v3ProfileExit';
      b.innerHTML='<span>←</span><strong>Zurück zum Dashboard</strong>';
      b.onclick=goDashboard;
      area.prepend(b);
    }
  }

  function hideEmojiLeaf(leaf,emoji){
    if(!leaf||leaf.textContent.trim()!==emoji)return;
    let box=leaf;
    for(let i=0;i<4;i++){
      const p=box.parentElement;
      if(!p||p.id==='area')break;
      const t=p.textContent.trim();
      const hasUseful=p.querySelector('img,input,textarea,select,button');
      if(t===emoji&&!hasUseful)box=p;else break;
    }
    box.classList.add('v3LegacyEmojiHidden');
  }

  async function removeLegacyProfileEmoji(){
    const p=await ownProfile().catch(()=>null);
    if(!p?.avatar_path)return;
    const emoji=String(p.avatar_emoji||'').trim();
    const fallback=document.querySelector('#premiumProfileFallback');
    if(fallback)fallback.hidden=true;
    document.querySelectorAll('#editEmoji').forEach(x=>{
      x.classList.add('v3LegacyEmojiHidden');
      const parent=x.closest('.profileEdit,.field,.authField')||x.parentElement;
      if(parent&&parent.textContent.trim().length<20)parent.classList.add('v3LegacyEmojiHidden');
    });
    if(!emoji)return;
    const area=document.querySelector('#area');
    if(area&&currentMode()==='profilepage'){
      [...area.querySelectorAll('*')].filter(el=>el.children.length===0&&el.textContent.trim()===emoji).forEach(el=>hideEmojiLeaf(el,emoji));
    }
    document.querySelectorAll('.socialAvatar,.friendAvatar,[class*="avatar" i]').forEach(box=>{
      if(box.querySelector('img')){
        [...box.querySelectorAll('*')].filter(el=>el.children.length===0&&el.textContent.trim()===emoji).forEach(el=>el.classList.add('v3LegacyEmojiHidden'));
      }
    });
  }

  function removeEmptyDashboardCards(){
    if(currentMode()!=='dashboard')return;
    const area=document.querySelector('#area');if(!area)return;
    const nodes=[...area.querySelectorAll('section,article,div')];
    nodes.forEach(el=>{
      if(el.id==='upgradeDashboard'||el.id==='v3BodyHeatmap'||el.closest('#v3BodyHeatmap'))return;
      if(el.children.length>4)return;
      const txt=el.textContent.replace(/\s+/g,' ').trim();
      if(txt)return;
      if(el.querySelector('img,svg,canvas,button,input,textarea,select'))return;
      const r=el.getBoundingClientRect();
      if(r.width<180||r.height<130||r.height>420)return;
      const cs=getComputedStyle(el);
      const hasCard=cs.borderStyle!=='none'||parseFloat(cs.borderRadius)>10||cs.backgroundColor!=='rgba(0, 0, 0, 0)';
      if(!hasCard)return;
      el.classList.add('v3EmptyDashboardCard');
      const parent=el.parentElement;
      if(parent){
        const visible=[...parent.children].filter(x=>!x.classList.contains('v3EmptyDashboardCard'));
        if(visible.length===1)parent.classList.add('v3SingleDashboardChild');
      }
    });
  }

  async function events30(){
    const id=uid();if(!id)return[];
    const from=new Date(Date.now()-30*864e5).toISOString();
    try{return await json(`/rest/v1/workout_events?select=occurred_at,day_key,set_count,pr_count,volume&user_id=eq.${encodeURIComponent(id)}&occurred_at=gte.${encodeURIComponent(from)}&order=occurred_at.asc&limit=300`)}catch{return[]}
  }

  function focusParts(day){
    let p=null;try{p=PLAN?.[day]}catch{}
    if(!p)return[];
    const text=[p.split,...Object.keys(p.groups||{})].join(' · ').toLowerCase();
    const parts=[];
    if(/brust|chest/.test(text))parts.push('chest');
    if(/schulter|shoulder/.test(text))parts.push('shoulders');
    if(/\barm|arme|bizeps|trizeps|biceps|triceps/.test(text))parts.push('arms');
    if(/bein|leg|quad|hamstring|wade|calf/.test(text))parts.push('legs');
    if(/unterer\s*r[uü]cken|lower\s*back|lenden/.test(text))parts.push('lowerback');
    if((/r[uü]cken|back/.test(text))&&!(/unterer\s*r[uü]cken|lower\s*back/.test(text)&&!(/r[uü]cken\s*[·&/]\s*brust|back\s*[·&/]\s*chest/.test(text))))parts.push('back');
    if(/core|bauch|abs|abdom/.test(text))parts.push('core');
    return [...new Set(parts)];
  }

  function muscleLoad(events){
    const load={chest:0,back:0,shoulders:0,arms:0,legs:0,core:0,lowerback:0};
    for(const e of events){
      const parts=focusParts(e.day_key);
      const sets=Math.max(1,Number(e.set_count||0));
      if(!parts.length)continue;
      for(const part of parts)load[part]+=sets;
    }
    return load;
  }

  function heatColor(value,max){
    if(!value)return{fill:'#36404c',alpha:.18,label:'Keine Daten'};
    const p=max?value/max:0;
    if(p<.34)return{fill:'#38bdf8',alpha:.42,label:'Leicht'};
    if(p<.67)return{fill:'#ffb35f',alpha:.52,label:'Mittel'};
    return{fill:'#ff5f45',alpha:.62,label:'Stark'};
  }

  function zone(fill,alpha,d){return `<path d="${d}" fill="${fill}" fill-opacity="${alpha}" stroke="${fill}" stroke-opacity=".9" stroke-width=".55"/>`}

  function heatSvg(load){
    const max=Math.max(1,...Object.values(load));
    const c=k=>heatColor(load[k],max);
    return `<svg class="v3HeatOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${zone(c('shoulders').fill,c('shoulders').alpha,'M18 20 C20 16 25 16 27 20 L25 26 L19 26 Z M34 20 C32 16 28 16 26 20 L28 26 L34 26 Z')}
      ${zone(c('chest').fill,c('chest').alpha,'M20 26 C23 23 29 23 32 26 L31 37 C28 40 23 40 20 37 Z')}
      ${zone(c('arms').fill,c('arms').alpha,'M16 25 C18 24 20 26 20 30 L17 51 L13 50 Z M36 25 C34 24 32 26 32 30 L35 51 L39 50 Z')}
      ${zone(c('core').fill,c('core').alpha,'M22 38 L30 38 L30 56 C28 59 24 59 22 56 Z')}
      ${zone(c('legs').fill,c('legs').alpha,'M20 57 L25 57 L24 87 L18 88 Z M27 57 L32 57 L34 88 L28 87 Z')}
      ${zone(c('shoulders').fill,c('shoulders').alpha,'M68 20 C70 16 75 16 77 20 L75 26 L69 26 Z M84 20 C82 16 78 16 76 20 L78 26 L84 26 Z')}
      ${zone(c('back').fill,c('back').alpha,'M69 25 C72 22 80 22 83 25 L82 47 C79 51 73 51 70 47 Z')}
      ${zone(c('arms').fill,c('arms').alpha,'M66 25 C68 24 70 26 70 30 L67 51 L63 50 Z M86 25 C84 24 82 26 82 30 L85 51 L89 50 Z')}
      ${zone(c('lowerback').fill,c('lowerback').alpha,'M71 47 L81 47 L81 58 C78 60 74 60 71 58 Z')}
      ${zone(c('legs').fill,c('legs').alpha,'M70 58 L75 58 L74 88 L68 89 Z M77 58 L82 58 L84 89 L78 88 Z')}
    </svg>`;
  }

  function loadRows(load){
    const names={chest:'Brust',back:'Rücken',shoulders:'Schultern',arms:'Arme',legs:'Beine',core:'Core',lowerback:'Unterer Rücken'};
    const max=Math.max(1,...Object.values(load));
    return Object.entries(load).map(([k,v])=>{
      const c=heatColor(v,max),pct=v?Math.max(8,Math.round(v/max*100)):0;
      return `<div class="v3MuscleRow"><div class="v3MuscleName"><i style="background:${c.fill}"></i><span>${names[k]}</span></div><div class="v3MuscleBar"><em style="width:${pct}%;background:${c.fill}"></em></div><div class="v3MuscleValue"><b>${Math.round(v)}</b><small>${c.label}</small></div></div>`;
    }).join('');
  }

  function findStatusCard(area){
    const title=[...area.querySelectorAll('h1,h2,h3,h4,b,strong')].find(x=>/dein status|k[öo]rper.*status|muskel/i.test(x.textContent||''));
    if(!title)return null;
    let n=title;
    for(let i=0;i<6&&n?.parentElement;i++){
      n=n.parentElement;
      const cls=String(n.className||'');
      if(/card|panel|status/i.test(cls)&&n.getBoundingClientRect().height>180)return n;
    }
    return title.closest('section,article')||title.parentElement?.parentElement||null;
  }

  async function renderMuscleStatus(){
    if(currentMode()!=='dashboard')return;
    const area=document.querySelector('#area');if(!area)return;
    const card=findStatusCard(area);if(!card)return;
    card.querySelectorAll('.realAnatomy,.premiumAnatomy,.muscleSvg').forEach(x=>x.remove());
    let host=card.querySelector('#v3BodyHeatmap');
    if(!host){host=document.createElement('div');host.id='v3BodyHeatmap';card.appendChild(host)}
    host.innerHTML='<div class="v3HeatLoading">Muskelbelastung wird berechnet …</div>';
    const ev=await events30();
    const load=muscleLoad(ev),max=Math.max(...Object.values(load)),top=Object.entries(load).sort((a,b)=>b[1]-a[1])[0];
    const names={chest:'Brust',back:'Rücken',shoulders:'Schultern',arms:'Arme',legs:'Beine',core:'Core',lowerback:'Unterer Rücken'};
    host.innerHTML=`<div class="v3HeatHead"><div><b>Muskelbelastung</b><span>Letzte 30 Tage · aus deinen gespeicherten Trainings</span></div><strong>${max>0?`${names[top[0]]} am stärksten`:'Noch keine Trainingsdaten'}</strong></div>
      <div class="v3HeatFigure"><img src="${ANATOMY}" alt="Anatomische Muskelansicht vorne und hinten">${heatSvg(load)}</div>
      <div class="v3HeatLegend"><span><i class="cold"></i>leicht</span><span><i class="mid"></i>mittel</span><span><i class="hot"></i>stark</span><span><i class="none"></i>keine Daten</span></div>
      <div class="v3MuscleRows">${loadRows(load)}</div>
      <div class="v3HeatNote">Die Farben zeigen deine Trainingsbelastung relativ zu deinen anderen Muskelgruppen – keine medizinische Bewertung.</div>`;
  }

  async function patch(){
    if(patchBusy)return;patchBusy=true;
    try{
      forceTopbar();
      ensureProfileExit();
      removeEmptyDashboardCards();
      await removeLegacyProfileEmoji();
      if(currentMode()==='dashboard')await renderMuscleStatus();
    }finally{patchBusy=false}
  }

  function install(){
    if(typeof render!=='function'||!document.querySelector('#area')){setTimeout(install,160);return}
    if(!window.__paibloV3RenderWrap){
      window.__paibloV3RenderWrap=true;
      const old=render;
      render=function(){const out=old.apply(this,arguments);setTimeout(patch,60);return out};
    }
    const area=document.querySelector('#area');
    if(area)new MutationObserver(()=>setTimeout(patch,40)).observe(area,{childList:true,subtree:true});
    document.addEventListener('click',e=>{if(e.target.closest('#premiumProfileButton,[data-page="profilepage"]'))setTimeout(patch,80)});
    setInterval(()=>{if(document.visibilityState==='visible')patch()},2500);
    patch();
  }

  install();
})();