(()=>{
  if(window.__paibloStableUIV2)return;
  window.__paibloStableUIV2=true;

  const ANATOMY='https://upload.wikimedia.org/wikipedia/commons/e/ef/Muscles_front_and_back.svg';
  let renderToken=0;
  let refreshTimer=null;
  let refreshInFlight=false;
  let pendingRefresh=false;

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n||0));
  const fmt1=n=>Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
  const uid=()=>{try{return cloudSession?.user?.id||JSON.parse(localStorage.getItem('gym-auth-session')||'null')?.user?.id||null}catch{return null}};
  const currentMode=()=>{try{return typeof mode!=='undefined'?mode:null}catch{return null}};
  const localDay=d=>new Date(d).toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});

  async function json(path,options={}){
    if(typeof api!=='function')throw new Error('api_unavailable');
    const r=await api(path,options);let data=null;try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data?.message||data?.error||`HTTP ${r.status}`);
    return data;
  }
  async function getEvents(limit=500){
    const id=uid();if(!id)return[];
    let remote=[];try{remote=await json(`/rest/v1/workout_events?select=client_event_id,occurred_at,day_key,set_count,pr_count,volume,payload&user_id=eq.${encodeURIComponent(id)}&order=occurred_at.desc&limit=${limit}`)}catch{}
    const pending=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith('gym:outbox:workout:'))continue;try{const row=JSON.parse(localStorage.getItem(k)||'null');if(row?.user_id===id)pending.push(row)}catch{}}
    const map=new Map();for(const e of [...pending,...remote]){const k=e.client_event_id||['fallback',e.occurred_at,e.day_key,e.volume].join('|');map.set(k,e)}
    return [...map.values()].sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at)).slice(0,limit);
  }
  async function getWeights(limit=60){
    const id=uid();if(!id)return[];
    if(typeof getWeightEntries==='function')return getWeightEntries(id,limit);
    return json(`/rest/v1/weight_entries?select=weight_kg,measured_at&user_id=eq.${encodeURIComponent(id)}&order=measured_at.desc&limit=${limit}`);
  }

  function fixProfileAvatar(){
    const img=document.querySelector('#pageAvatarImg');
    const fb=document.querySelector('#pageAvatarFallback');
    if(fb){fb.textContent='P';fb.classList.add('noEmojiFallback')}
    if(img&&img.getAttribute('src')&&!img.hidden){
      img.style.setProperty('display','block','important');
      if(fb){fb.hidden=true;fb.style.setProperty('display','none','important')}
    }
    const top=document.querySelector('#premiumProfileImg');
    const topFb=document.querySelector('#premiumProfileFallback');
    if(top&&top.getAttribute('src')&&!top.hidden&&topFb){topFb.hidden=true;topFb.style.setProperty('display','none','important')}
  }

  function normalizeDashboardGrid(){
    if(currentMode()!=='dashboard')return;
    const area=document.querySelector('#area');
    const grid=area?.querySelector('.dashboardGrid');if(!grid)return;
    let rank=area.querySelector('.premiumRankCard');
    grid.querySelectorAll(':scope > .dashCard:not(.primary)').forEach(card=>{
      const nested=card.querySelector('.premiumRankCard');
      if(nested)rank=nested;
      if(!card.textContent.trim()||nested)card.remove();
    });
    if(rank){
      rank.id='dashRankStable';
      rank.classList.add('stableRankTile');
      if(rank.parentElement!==grid)grid.appendChild(rank);
    }
  }

  function ensureProfileBack(){
    if(currentMode()!=='profilepage')return;
    const area=document.querySelector('#area');
    const hero=area?.querySelector('.profileHero');
    if(!area||!hero||area.querySelector('.stableBack'))return;
    const b=document.createElement('button');
    b.type='button';b.className='stableBack';b.innerHTML='← <span>Zurück zum Dashboard</span>';
    b.onclick=()=>typeof premiumGo==='function'?premiumGo('dashboard'):null;
    hero.insertAdjacentElement('afterend',b);
  }

  function groupForExercise(name,day){
    try{
      if(day&&PLAN?.[day]?.groups){for(const [g,list] of Object.entries(PLAN[day].groups))if(list.some(x=>String(x[0]).toLowerCase()===String(name).toLowerCase()))return g}
      for(const p of Object.values(PLAN||{}))for(const [g,list] of Object.entries(p.groups||{}))if(list.some(x=>String(x[0]).toLowerCase()===String(name).toLowerCase()))return g;
    }catch{}
    return '';
  }
  function bucket(group,name=''){
    const s=(String(group)+' '+String(name)).toLowerCase();
    if(s.includes('unterer r')||s.includes('lower back')||s.includes('lenden')||s.includes('kreuzheben'))return'Unterer Rücken';
    if(s.includes('schulter')||s.includes('seitheben')||s.includes('shoulder'))return'Schultern';
    if(s.includes('brust')||s.includes('chest')||s.includes('butterfl')||s.includes('schrägbank')||s.includes('bench'))return'Brust';
    if(s.includes('rück')||s.includes('rudern')||s.includes('latzug')||s.includes('a-bar')||s.includes('t-bar')||s.includes('row'))return'Rücken';
    if(s.includes('bein')||s.includes('kniebeug')||s.includes('squat')||s.includes('leg '))return'Beine';
    if(s.includes('arm')||s.includes('bizeps')||s.includes('trizeps')||s.includes('curl')||s.includes('push down')||s.includes('kartana'))return'Arme';
    if(s.includes('core')||s.includes('bauch')||s.includes('abdominal'))return'Core';
    return null;
  }

  function muscleLoads(ev){
    const cutoff=Date.now()-30*864e5;
    const names=['Brust','Rücken','Unterer Rücken','Schultern','Arme','Core','Beine'];
    const load=Object.fromEntries(names.map(k=>[k,{sets:0,days:new Set()}]));
    for(const e of ev){
      const t=new Date(e.occurred_at).getTime();if(!Number.isFinite(t)||t<cutoff)continue;
      const p=e.payload||{};let assigned=0;
      if(Array.isArray(p.exercises)&&p.exercises.length){
        for(const ex of p.exercises){
          const setN=Math.max(1,Array.isArray(ex.sets)?ex.sets.length:1);
          const b=bucket(groupForExercise(ex.name,e.day_key),ex.name);
          if(b&&load[b]){load[b].sets+=setN;load[b].days.add(localDay(e.occurred_at));assigned+=setN}
        }
      }else if(p.exercise){
        const b=bucket(groupForExercise(p.exercise,e.day_key),p.exercise);
        if(b&&load[b]){const setN=Math.max(1,Number(e.set_count||1));load[b].sets+=setN;load[b].days.add(localDay(e.occurred_at));assigned+=setN}
      }
      if(!assigned&&e.day_key){
        const groups=Object.keys(PLAN?.[e.day_key]?.groups||{}).map(g=>bucket(g)).filter(Boolean);
        const uniq=[...new Set(groups)],share=uniq.length?Math.max(1,Number(e.set_count||1))/uniq.length:0;
        for(const b of uniq){if(load[b]){load[b].sets+=share;load[b].days.add(localDay(e.occurred_at))}}
      }
    }
    return Object.fromEntries(Object.entries(load).map(([k,v])=>[k,{sets:Math.round(v.sets*10)/10,days:v.days.size}]));
  }
  function intensity(v){const n=Number(v||0);return n<=0?'none':n<=5?'light':n<=12?'medium':'strong'}
  function intensityText(v){return{none:'Keine Daten',light:'Leicht',medium:'Mittel',strong:'Stark'}[intensity(v)]}

  function heatZones(load){
    const zones=[
      ['Brust','chestL'],['Brust','chestR'],['Schultern','shoulderL'],['Schultern','shoulderR'],['Arme','armL'],['Arme','armR'],['Core','core'],['Beine','legL'],['Beine','legR'],
      ['Rücken','backUpper'],['Unterer Rücken','backLower'],['Beine','backLegL'],['Beine','backLegR']
    ];
    return zones.map(([m,c])=>`<i class="heatZone ${c} ${intensity(load[m]?.sets)}" title="${esc(m)}: ${fmt(load[m]?.sets||0)} Sätze in 30 Tagen"></i>`).join('');
  }
  function muscleRows(load){
    const mx=Math.max(1,...Object.values(load).map(v=>v.sets));
    return Object.entries(load).map(([name,v])=>`<div class="muscleRow"><div><span>${esc(name)}</span><small>${v.days} ${v.days===1?'Trainingstag':'Trainingstage'}</small></div><div class="muscleTrack"><i class="${intensity(v.sets)}" style="width:${v.sets?Math.max(7,Math.round(v.sets/mx*100)):0}%"></i></div><b>${fmt(v.sets)} S. · ${intensityText(v.sets)}</b></div>`).join('');
  }

  function bodyCard(load){
    return `<section class="stableCard stableBody" id="stableBodyStatus"><div class="stableHead"><div><span>KÖRPER & FOKUS</span><h3>Trainingsfokus · 30 Tage</h3></div><small>Trainingsmenge, nicht Muskelstärke</small></div><div class="stableBodyGrid"><div><div class="stableAnatomy"><img src="${ANATOMY}" alt="Anatomische Muskelansicht vorne und hinten">${heatZones(load)}</div><div class="stableLegend"><span><i class="l0"></i>keine Daten</span><span><i class="l1"></i>leicht</span><span><i class="l2"></i>mittel</span><span><i class="l3"></i>stark</span></div></div><div class="muscleRows">${muscleRows(load)}</div></div></section>`;
  }

  function lastDays(ev,count=7){
    const out=[];
    for(let i=count-1;i>=0;i--){
      const d=new Date();d.setDate(d.getDate()-i);const key=localDay(d);
      const same=ev.filter(e=>localDay(e.occurred_at)===key);
      out.push({label:d.toLocaleDateString('de-DE',{weekday:'short'}).slice(0,2),sets:same.reduce((a,e)=>a+Number(e.set_count||0),0),volume:same.reduce((a,e)=>a+Number(e.volume||0),0),prs:same.reduce((a,e)=>a+Number(e.pr_count||0),0)});
    }
    return out;
  }
  function lastWeeks(ev,count=4){
    const out=[];const now=new Date();
    for(let offset=count-1;offset>=0;offset--){
      const end=new Date(now);end.setDate(end.getDate()-offset*7);end.setHours(23,59,59,999);
      const start=new Date(end);start.setDate(start.getDate()-6);start.setHours(0,0,0,0);
      const same=ev.filter(e=>{const d=new Date(e.occurred_at);return d>=start&&d<=end});
      out.push({label:offset===0?'Jetzt':`-${offset}W`,volume:same.reduce((a,e)=>a+Number(e.volume||0),0),sets:same.reduce((a,e)=>a+Number(e.set_count||0),0)});
    }
    return out;
  }
  function barSvg(items,key,color='#ff9450'){
    const values=items.map(x=>Number(x[key]||0)),max=Math.max(1,...values),w=360,h=118,bw=32,gap=(w-30-bw*items.length)/Math.max(1,items.length-1);
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Balkendiagramm">${items.map((x,i)=>{const val=values[i],bh=val?Math.max(5,72*val/max):3,xx=15+i*(bw+gap),yy=88-bh;return `<rect x="${xx}" y="${yy}" width="${bw}" height="${bh}" rx="7" fill="${val?color:'#222b35'}"/><text x="${xx+bw/2}" y="107" text-anchor="middle" fill="#748191" font-size="9">${esc(x.label)}</text>`}).join('')}<line x1="10" y1="89" x2="350" y2="89" stroke="#222c36"/></svg>`;
  }
  function lineSvg(values,color='#38bdf8'){
    const n=values.map(Number).filter(Number.isFinite);
    if(n.length<2)return `<div class="chartEmpty"><b>${n.length?fmt1(n[0])+' kg':'Noch kein Gewicht'}</b><span>${n.length?'Ein zweiter Messpunkt erzeugt den Verlauf.':'Speichere dein Gewicht im Profil.'}</span></div>`;
    const w=360,h=118,p=12,min=Math.min(...n),max=Math.max(...n),span=Math.max(.1,max-min);
    const pts=n.map((v,i)=>`${p+(w-2*p)*i/(n.length-1)},${h-p-(h-2*p)*(v-min)/span}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gewichtsverlauf"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.split(' ').map(pt=>{const[x,y]=pt.split(',');return `<circle cx="${x}" cy="${y}" r="3" fill="#0d1218" stroke="${color}" stroke-width="2"/>`}).join('')}</svg>`;
  }
  function analyticsCard(ev,w){
    const days=lastDays(ev),weeks=lastWeeks(ev),weights=[...(w||[])].reverse().slice(-12).map(x=>Number(x.weight_kg));
    const sets7=days.reduce((a,x)=>a+x.sets,0),vol4=weeks.reduce((a,x)=>a+x.volume,0),latest=w?.[0]?.weight_kg;
    const activeDays=new Set(ev.filter(e=>new Date(e.occurred_at)>=new Date(Date.now()-30*864e5)).map(e=>localDay(e.occurred_at))).size;
    return `<section class="stableCard" id="stableAnalytics"><div class="stableHead"><div><span>FORTSCHRITT</span><h3>Aktuelle Statistiken</h3></div><small>${activeDays} aktive ${activeDays===1?'Tag':'Tage'} · letzte 30 Tage</small></div><div class="stableCharts"><div class="chartCard"><div class="chartTitle"><b>Sätze · 7 Tage</b><span>${fmt(sets7)} gesamt</span></div>${barSvg(days,'sets','#ff9450')}</div><div class="chartCard"><div class="chartTitle"><b>Volumen · 4 Wochen</b><span>${fmt(vol4)} kg</span></div>${barSvg(weeks,'volume','#ffb06d')}</div><div class="chartCard"><div class="chartTitle"><b>Gewicht</b><span>${latest?fmt1(latest)+' kg':'keine Messung'}</span></div>${lineSvg(weights)}</div><div class="chartCard dataCard"><div class="chartTitle"><b>Datenbasis</b><span>live</span></div><p>Die Grafiken werden direkt aus deinen gespeicherten Trainingsevents und Gewichtsmessungen berechnet. Beim erneuten Öffnen des Dashboards werden sie frisch geladen.</p></div></div></section>`;
  }

  async function refreshDashboard(token=renderToken){
    if(currentMode()!=='dashboard')return;
    if(refreshInFlight){pendingRefresh=true;return}
    refreshInFlight=true;
    try{
      const [ev,w]=await Promise.all([getEvents(),getWeights()]);
      if(token!==renderToken||currentMode()!=='dashboard')return;
      const area=document.querySelector('#area');if(!area)return;
      normalizeDashboardGrid();
      area.querySelector('.bodyOverview')?.remove();
      let host=area.querySelector('#stableDashboardData');
      if(!host){host=document.createElement('div');host.id='stableDashboardData';const quick=area.querySelector('.quickSection');quick?quick.insertAdjacentElement('beforebegin',host):area.appendChild(host)}
      host.innerHTML=bodyCard(muscleLoads(ev))+analyticsCard(ev,w);
      host.dataset.updated=new Date().toISOString();
    }catch(e){
      console.warn('Paiblo dashboard refresh failed',e);
      const host=document.querySelector('#stableDashboardData');if(host&&!host.children.length)host.innerHTML='<section class="stableCard"><div class="chartEmpty"><b>Statistiken gerade nicht erreichbar</b><span>Deine gespeicherten Trainingsdaten bleiben erhalten.</span></div></section>';
    }finally{
      refreshInFlight=false;
      if(pendingRefresh){pendingRefresh=false;scheduleDashboard(350)}
    }
  }
  function scheduleDashboard(delay=180){
    clearTimeout(refreshTimer);
    const token=renderToken;
    refreshTimer=setTimeout(()=>refreshDashboard(token),delay);
  }

  function patchCompareGraphics(){
    if(currentMode()!=='friends')return;
    const panel=document.querySelector('#friendCompare .comparePanel');if(!panel)return;
    panel.querySelector('.stableCompare')?.remove();
    const rows=[...panel.querySelectorAll('.compareRows>div')];
    const metrics=[];
    for(const row of rows){
      const p=[...row.children];if(p.length<4)continue;
      const label=p[0].textContent.trim();
      const parseMetric=t=>Number(String(t||'').replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(',','.'))||0;
      const a=parseMetric(p[1].textContent);
      const b=parseMetric(p[3].textContent);
      if(/gewicht/i.test(label))continue;
      metrics.push({label,a,b});
    }
    if(!metrics.length)return;
    panel.insertAdjacentHTML('beforeend',`<div class="stableCompare"><div class="stableHead"><div><span>GRAFISCHER VERGLEICH</span><h3>Du vs. Freund</h3></div><small>Du · Freund</small></div>${metrics.map(m=>{const mx=Math.max(1,m.a,m.b);return `<div class="compareChartRow"><span>${esc(m.label)}</span><div><div class="compareTwin"><i class="me" style="width:${Math.max(2,m.a/mx*100)}%"></i><i class="friend" style="width:${Math.max(2,m.b/mx*100)}%"></i></div><div class="compareValues"><span>${fmt(m.a)}</span><span>${fmt(m.b)}</span></div></div></div>`}).join('')}</div>`);
  }

  function afterRender(){
    renderToken++;
    fixProfileAvatar();
    normalizeDashboardGrid();
    ensureProfileBack();
    if(currentMode()==='dashboard')scheduleDashboard(80);
    if(currentMode()==='friends')setTimeout(patchCompareGraphics,400);
  }

  function installRenderWrapper(){
    if(typeof render!=='function'||render.__paibloStableV2)return false;
    const original=render;
    const wrapped=function(){const result=original.apply(this,arguments);queueMicrotask(afterRender);return result};
    wrapped.__paibloStableV2=true;
    render=wrapped;
    return true;
  }

  function installAccurateWorkoutLogger(){
    if(typeof window.logWorkoutEvent!=='function'||window.logWorkoutEvent.__paibloAccurate)return false;
    const accurate=async function(evt,before){
      if(!evt||!before||typeof PLAN==='undefined'||typeof selected==='undefined')return;
      const changed=[],seen=new Set();let setCount=0,volume=0,prCount=0;
      try{
        const p=PLAN[selected];
        for(const list of Object.values(p?.groups||{}))for(const [name] of list){
          if(seen.has(name))continue;seen.add(name);
          const state=JSON.parse(localStorage.getItem(WKEY(name))||'null');
          if(!state)continue;
          const h=state.history?.[0];if(!h)continue;const prev=before?.[name],key=[h.date??'',h.w??'',h.r??'',JSON.stringify(h.sets??[])].join('|');if(key===prev?.key)continue;
          const sets=Array.isArray(h.sets)&&h.sets.length?h.sets:[[h.w,h.r]];
          const cleanSets=[];
          for(const pair of sets){
            const w=pair?.[0]==null?Number(h.w):Number(pair[0]),r=pair?.[1]==null?Number(h.r):Number(pair[1]);
            if(!Number.isFinite(w)||!Number.isFinite(r))continue;
            cleanSets.push({w,r});setCount++;volume+=w*r;
          }
          if(h.pr)prCount++;
          changed.push({name,sets:cleanSets,pr:!!h.pr});
        }
      }catch(e){console.warn('Workout validation failed',e);return}
      if(!changed.length||!setCount)return;
      const row={
        user_id:uid(),
        client_event_id:evt.client_event_id||(crypto.randomUUID?crypto.randomUUID():`${Date.now()}_${Math.random()}`),
        occurred_at:evt.occurred_at||new Date().toISOString(),
        day_key:selected,
        set_count:setCount,
        pr_count:prCount,
        volume:Math.round(volume*100)/100,
        payload:{source:'training_save',exercises:changed}
      };
      try{
        if(typeof window.queueWorkoutRow==='function')window.queueWorkoutRow(row);
        if(typeof window.sendWorkoutRow==='function')await window.sendWorkoutRow(row);
        else{const r=await api('/rest/v1/workout_events?on_conflict=user_id,client_event_id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row)});if(!r.ok)throw new Error(`workout_event_${r.status}`)}
        try{if(typeof refreshOwnStats==='function')await refreshOwnStats()}catch{}
      }catch{}
      if(currentMode()==='dashboard')scheduleDashboard(250);
    };
    accurate.__paibloAccurate=true;
    window.logWorkoutEvent=accurate;
    try{logWorkoutEvent=accurate}catch{}
    return true;
  }

  async function runSelfCheck(){
    const checks={render:typeof render==='function',navigation:typeof premiumGo==='function',api:typeof api==='function',session:!!uid(),saveButton:!!document.querySelector('#saveBtn'),menu:!!document.querySelector('#menuButton'),profileButton:!!document.querySelector('#premiumProfileButton')};
    try{
      const [ev,w]=await Promise.all([getEvents(5),getWeights(5)]);
      checks.events=Array.isArray(ev);checks.weights=Array.isArray(w);
    }catch{checks.dataRead=false}
    const ok=Object.values(checks).every(v=>v!==false);
    window.__paibloLastSelfCheck={ok,checks,at:new Date().toISOString()};
    document.body.dataset.appHealth=ok?'ok':'warning';
    return window.__paibloLastSelfCheck;
  }
  window.paibloSelfCheck=runSelfCheck;

  function boot(){
    if(typeof render!=='function'||!document.querySelector('#area')||typeof api!=='function'){setTimeout(boot,120);return}
    installRenderWrapper();
    const waitLogger=setInterval(()=>{if(installAccurateWorkoutLogger())clearInterval(waitLogger)},200);
    setTimeout(()=>clearInterval(waitLogger),10000);
    document.addEventListener('click',e=>{
      const t=e.target.closest?.('[data-compare],#saveBtn,#saveBody,#saveBasicProfile');
      if(!t)return;
      if(t.matches('[data-compare]')){setTimeout(patchCompareGraphics,450);setTimeout(patchCompareGraphics,1100)}
      if(t.id==='saveBtn')setTimeout(()=>{if(currentMode()==='dashboard')scheduleDashboard(100)},1600);
    });
    window.addEventListener('focus',()=>{fixProfileAvatar();if(currentMode()==='dashboard')scheduleDashboard(100)});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){fixProfileAvatar();if(currentMode()==='dashboard')scheduleDashboard(100)}});
    window.addEventListener('online',()=>{if(currentMode()==='dashboard')scheduleDashboard(200)});
    setInterval(()=>{if(document.visibilityState==='visible'&&currentMode()==='dashboard')scheduleDashboard(0)},60000);
    queueMicrotask(afterRender);
    setTimeout(runSelfCheck,1800);
  }
  boot();
})();
