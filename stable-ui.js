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
  function isLegacyEvent(e){return String(e?.payload?.source||'')==='legacy_history'}
  function dedupeWorkoutEvents(rows,limit=500){
    const sorted=[...(rows||[])].sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));
    const modern=sorted.filter(e=>!isLegacyEvent(e));
    const modernTimes=modern.map(e=>new Date(e.occurred_at).getTime()).filter(Number.isFinite);
    const clean=sorted.filter(e=>{
      if(!isLegacyEvent(e))return true;
      const t=new Date(e.occurred_at).getTime();if(!Number.isFinite(t))return false;
      return !modernTimes.some(mt=>Math.abs(mt-t)<=300000);
    });
    return clean.slice(0,limit);
  }
  async function getEvents(limit=500){
    const id=uid();if(!id)return[];
    let remote=[];try{remote=await json(`/rest/v1/workout_events?select=client_event_id,occurred_at,day_key,set_count,pr_count,volume,payload&user_id=eq.${encodeURIComponent(id)}&order=occurred_at.desc&limit=${Math.max(limit,800)}`)}catch{}
    const pending=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith('gym:outbox:workout:'))continue;try{const row=JSON.parse(localStorage.getItem(k)||'null');if(row?.user_id===id)pending.push(row)}catch{}}
    const map=new Map();for(const e of [...pending,...remote]){const k=e.client_event_id||['fallback',e.occurred_at,e.day_key,e.volume].join('|');map.set(k,e)}
    return dedupeWorkoutEvents([...map.values()],limit);
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

  function zone(muscle,cls,d,load){
    const level=intensity(load[muscle]?.sets);
    const title=`${muscle}: ${fmt(load[muscle]?.sets||0)} Sätze in 30 Tagen`;
    return `<path class="anatomyZone ${level} ${cls}" data-muscle="${esc(muscle)}" d="${d}" role="button" tabindex="0" aria-label="${esc(title)}"><title>${esc(title)}</title></path>`;
  }
  function anatomyFigure(load){
    return `<svg class="anatomyFigure anatomyUnified" viewBox="0 0 1442 1256" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Muskelansicht vorne und hinten">
      <image class="anatomyBase" href="${ANATOMY}" x="0" y="0" width="1442" height="1256" preserveAspectRatio="xMidYMid meet"/>
      ${zone('Schultern','frontShoulderL','M244 214 C261 182 299 174 326 194 C337 213 330 250 304 267 C276 268 250 251 244 214 Z',load)}
      ${zone('Schultern','frontShoulderR','M456 194 C483 174 521 182 538 214 C532 251 506 268 478 267 C452 250 445 213 456 194 Z',load)}
      ${zone('Brust','frontChestL','M315 244 C334 222 373 216 392 235 L393 357 C358 365 325 347 306 319 C298 290 301 262 315 244 Z',load)}
      ${zone('Brust','frontChestR','M394 235 C413 216 452 222 471 244 C485 262 488 290 480 319 C461 347 428 365 393 357 L393 235 Z',load)}
      ${zone('Arme','frontArmL','M229 270 C250 265 269 279 275 304 L267 447 C263 501 245 566 219 613 C201 608 190 585 194 552 L208 373 C211 322 214 286 229 270 Z',load)}
      ${zone('Arme','frontArmR','M557 270 C572 286 575 322 578 373 L592 552 C596 585 585 608 567 613 C541 566 523 501 519 447 L511 304 C517 279 536 265 557 270 Z',load)}
      ${zone('Core','frontCore','M336 367 C355 350 431 350 450 367 C462 416 456 513 441 592 C423 615 363 615 345 592 C330 513 324 416 336 367 Z',load)}
      ${zone('Beine','frontLegL','M326 608 C349 594 376 597 392 617 L383 857 L360 1128 C341 1145 319 1135 312 1107 L313 875 C303 773 305 665 326 608 Z',load)}
      ${zone('Beine','frontLegR','M394 617 C410 597 437 594 460 608 C481 665 483 773 473 875 L474 1107 C467 1135 445 1145 426 1128 L403 857 Z',load)}
      ${zone('Schultern','backShoulderL','M925 205 C947 181 981 178 1005 198 C1019 220 1010 254 985 270 C957 271 932 252 925 205 Z',load)}
      ${zone('Schultern','backShoulderR','M1179 198 C1203 178 1237 181 1259 205 C1252 252 1227 271 1199 270 C1174 254 1165 220 1179 198 Z',load)}
      ${zone('Rücken','backUpper','M986 254 C1024 220 1158 220 1196 254 C1216 314 1195 431 1147 505 C1111 530 1071 530 1035 505 C987 431 966 314 986 254 Z',load)}
      ${zone('Unterer Rücken','backLower','M1043 494 C1066 475 1116 475 1139 494 C1154 537 1146 601 1122 639 C1105 653 1080 653 1063 639 C1039 601 1031 537 1043 494 Z',load)}
      ${zone('Arme','backArmL','M908 268 C926 260 948 276 956 302 L947 446 C940 507 919 568 894 615 C876 606 866 581 870 548 L885 368 C888 320 893 284 908 268 Z',load)}
      ${zone('Arme','backArmR','M1276 268 C1291 284 1296 320 1299 368 L1314 548 C1318 581 1308 606 1290 615 C1265 568 1244 507 1237 446 L1228 302 C1236 276 1258 260 1276 268 Z',load)}
      ${zone('Beine','backLegL','M1028 622 C1050 600 1081 599 1098 620 L1088 858 L1064 1129 C1047 1145 1025 1135 1018 1106 L1018 884 C1006 779 1007 672 1028 622 Z',load)}
      ${zone('Beine','backLegR','M1100 620 C1117 599 1148 600 1170 622 C1191 672 1192 779 1180 884 L1180 1106 C1173 1135 1151 1145 1134 1129 L1110 858 Z',load)}
    </svg>`;
  }
  function muscleRows(load){
    const mx=Math.max(1,...Object.values(load).map(v=>v.sets));
    return Object.entries(load).map(([name,v])=>`<button type="button" class="muscleRow" data-muscle="${esc(name)}" aria-pressed="false"><div><span>${esc(name)}</span><small>${v.days} ${v.days===1?'Trainingstag':'Trainingstage'}</small></div><div class="muscleTrack"><i class="${intensity(v.sets)}" style="width:${v.sets?Math.max(7,Math.round(v.sets/mx*100)):0}%"></i></div><b>${fmt(v.sets)} S. · ${intensityText(v.sets)}</b></button>`).join('');
  }
  function bindMuscleInteractions(){
    const root=document.querySelector('#stableBodyStatus');if(!root)return;
    const setSelected=name=>{
      const active=root.dataset.selected===name?'':name;
      root.dataset.selected=active;
      root.querySelectorAll('.muscleRow').forEach(row=>{const on=!!active&&row.dataset.muscle===active;row.classList.toggle('is-selected',on);row.setAttribute('aria-pressed',on?'true':'false')});
      root.querySelectorAll('.anatomyZone').forEach(z=>z.classList.toggle('is-selected',!!active&&z.dataset.muscle===active));
    };
    root.querySelectorAll('.muscleRow').forEach(row=>row.addEventListener('click',()=>setSelected(row.dataset.muscle)));
    root.querySelectorAll('.anatomyZone').forEach(z=>{
      z.addEventListener('click',()=>setSelected(z.dataset.muscle));
      z.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(z.dataset.muscle)}});
    });
  }

  function bodyCard(load){
    return `<section class="stableCard stableBody" id="stableBodyStatus"><div class="stableHead"><div><span>KÖRPER & FOKUS</span><h3>Trainingsfokus · 30 Tage</h3></div><small>Trainingsmenge, nicht Muskelstärke</small></div><div class="stableBodyGrid"><div><div class="stableAnatomy">${anatomyFigure(load)}</div><div class="stableLegend"><span><i class="l0"></i>keine Daten</span><span><i class="l1"></i>leicht</span><span><i class="l2"></i>mittel</span><span><i class="l3"></i>stark</span></div><a class="anatomyCredit" href="https://commons.wikimedia.org/wiki/File:Muscles_front_and_back.svg" target="_blank" rel="noopener">Anatomie: OpenStax & Tomáš Kebert · CC BY-SA 4.0</a></div><div class="muscleRows">${muscleRows(load)}</div></div></section>`;
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
      const active=new Set(same.map(e=>localDay(e.occurred_at)));
      out.push({label:offset===0?'Jetzt':`-${offset}W`,volume:same.reduce((a,e)=>a+Number(e.volume||0),0),sets:same.reduce((a,e)=>a+Number(e.set_count||0),0),prs:same.reduce((a,e)=>a+Number(e.pr_count||0),0),days:active.size});
    }
    return out;
  }
  function barSvg(items,key,color='var(--tp-chart-sets)'){
    const values=items.map(x=>Number(x[key]||0)),max=Math.max(1,...values),w=360,h=118,bw=32,gap=(w-30-bw*items.length)/Math.max(1,items.length-1);
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Balkendiagramm">${items.map((x,i)=>{const val=values[i],bh=val?Math.max(5,72*val/max):3,xx=15+i*(bw+gap),yy=88-bh;return `<rect x="${xx}" y="${yy}" width="${bw}" height="${bh}" rx="7" style="fill:${val?color:'var(--tp-border)'}"/><text x="${xx+bw/2}" y="107" text-anchor="middle" style="fill:var(--tp-muted)" font-size="9">${esc(x.label)}</text>`}).join('')}<line x1="10" y1="89" x2="350" y2="89" style="stroke:var(--tp-border)"/></svg>`;
  }
  function lineSvg(values,color='var(--tp-chart-weight)'){
    const n=values.map(Number).filter(Number.isFinite);
    if(n.length<2)return `<div class="chartEmpty"><b>${n.length?fmt1(n[0])+' kg':'Noch kein Gewicht'}</b><span>${n.length?'Ein zweiter Messpunkt erzeugt den Verlauf.':'Speichere dein Gewicht im Profil.'}</span></div>`;
    const w=360,h=118,p=12,min=Math.min(...n),max=Math.max(...n),span=Math.max(.1,max-min);
    const pts=n.map((v,i)=>`${p+(w-2*p)*i/(n.length-1)},${h-p-(h-2*p)*(v-min)/span}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gewichtsverlauf"><polyline points="${pts}" fill="none" style="stroke:${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.split(' ').map(pt=>{const[x,y]=pt.split(',');return `<circle cx="${x}" cy="${y}" r="3" style="fill:var(--tp-surface-2);stroke:${color}" stroke-width="2"/>`}).join('')}</svg>`;
  }
  function muscleDistributionSvg(load){
    const labels={Brust:'Br',Rücken:'Rü','Unterer Rücken':'UR',Schultern:'Sch',Arme:'Ar',Core:'Co',Beine:'Be'};
    const items=Object.entries(load||{}).map(([label,v])=>({label:labels[label]||label.slice(0,2),sets:Number(v?.sets||0)}));
    return barSvg(items,'sets','var(--tp-muscle-medium)');
  }
  function analyticsCard(ev,w,load){
    const days=lastDays(ev),weeks=lastWeeks(ev),weights=[...(w||[])].reverse().slice(-12).map(x=>Number(x.weight_kg));
    const sets7=days.reduce((a,x)=>a+x.sets,0),vol4=weeks.reduce((a,x)=>a+x.volume,0),prs4=weeks.reduce((a,x)=>a+x.prs,0),days4=weeks.reduce((a,x)=>a+x.days,0),latest=w?.[0]?.weight_kg;
    const activeDays=new Set(ev.filter(e=>new Date(e.occurred_at)>=new Date(Date.now()-30*864e5)).map(e=>localDay(e.occurred_at))).size;
    return `<section class="stableCard dashboardOverviewCard" id="stableAnalytics"><div class="stableHead"><div><span>DASHBOARD</span><h3>Deine Entwicklung</h3></div><small>Live aus deinen gespeicherten Daten · letzte 30 Tage</small></div><div class="dashboardMiniKpis"><div><span>Aktive Tage</span><b>${activeDays}</b></div><div><span>Sätze · 7 T.</span><b>${fmt(sets7)}</b></div><div><span>PRs · 4 W.</span><b>${fmt(prs4)}</b></div><div><span>Volumen · 4 W.</span><b>${fmt(vol4)} kg</b></div></div><div class="stableCharts"><div class="chartCard"><div class="chartTitle"><b>Sätze · 7 Tage</b><span>${fmt(sets7)} gesamt</span></div>${barSvg(days,'sets','var(--tp-chart-sets)')}</div><div class="chartCard"><div class="chartTitle"><b>Trainingshäufigkeit · 4 Wochen</b><span>${fmt(days4)} Trainingstage</span></div>${barSvg(weeks,'days','var(--tp-primary)')}</div><div class="chartCard"><div class="chartTitle"><b>Volumen · 4 Wochen</b><span>${fmt(vol4)} kg</span></div>${barSvg(weeks,'volume','var(--tp-chart-volume)')}</div><div class="chartCard"><div class="chartTitle"><b>PRs · 4 Wochen</b><span>${fmt(prs4)} gesamt</span></div>${barSvg(weeks,'prs','var(--tp-success)')}</div><div class="chartCard"><div class="chartTitle"><b>Gewichtsverlauf</b><span>${latest?fmt1(latest)+' kg':'keine Messung'}</span></div>${lineSvg(weights,'var(--tp-chart-weight)')}</div><div class="chartCard"><div class="chartTitle"><b>Muskelverteilung · 30 Tage</b><span>nach Sätzen</span></div>${muscleDistributionSvg(load)}</div></div></section>`;
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
      const load=muscleLoads(ev);
      host.innerHTML=analyticsCard(ev,w,load)+bodyCard(load);
      bindMuscleInteractions();
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
  window.paibloRefreshDashboard=()=>refreshDashboard(renderToken);

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
