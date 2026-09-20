(()=>{
  if(window.__paibloStableUIV2)return;
  window.__paibloStableUIV2=true;

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

  function bodyZone(muscle,cls,d,load){
    const level=intensity(load[muscle]?.sets);
    const title=`${muscle}: ${fmt(load[muscle]?.sets||0)} Sätze in 30 Tagen`;
    return `<path class="bodyMuscleZone ${level} ${cls}" data-muscle="${esc(muscle)}" d="${d}" role="button" tabindex="0" aria-label="${esc(title)}"><title>${esc(title)}</title></path>`;
  }
  function frontBodySvg(load){
    return `<svg class="bodyFocusFigure front" viewBox="0 0 220 520" role="img" aria-label="Körperansicht vorne">
      <g class="bodyBase">
        <ellipse cx="110" cy="42" rx="27" ry="33"/>
        <path d="M97 70 L123 70 L127 95 L93 95 Z"/>
        <path d="M82 89 C66 95 55 110 52 139 L57 244 C61 276 78 304 110 320 C142 304 159 276 163 244 L168 139 C165 110 154 95 138 89 C130 86 122 83 118 81 L102 81 C98 83 90 86 82 89 Z"/>
        <path d="M57 118 C41 124 31 143 27 171 L18 294 C16 317 26 333 41 329 C49 323 53 313 56 302 L63 210 L66 145 Z"/>
        <path d="M163 118 C179 124 189 143 193 171 L202 294 C204 317 194 333 179 329 C171 323 167 313 164 302 L157 210 L154 145 Z"/>
        <path d="M82 304 C70 326 66 359 68 404 L72 492 C79 509 92 509 98 488 L106 386 L108 320 Z"/>
        <path d="M138 304 C150 326 154 359 152 404 L148 492 C141 509 128 509 122 488 L114 386 L112 320 Z"/>
      </g>

      ${bodyZone('Schultern','frontShoulderL','M57 121 C60 103 74 91 91 94 L94 128 C79 134 66 130 57 121 Z',load)}
      ${bodyZone('Schultern','frontShoulderR','M163 121 C160 103 146 91 129 94 L126 128 C141 134 154 130 163 121 Z',load)}
      ${bodyZone('Brust','frontChestL','M76 130 C84 117 101 113 109 122 L109 189 C94 192 80 185 72 171 C70 151 71 140 76 130 Z',load)}
      ${bodyZone('Brust','frontChestR','M144 130 C136 117 119 113 111 122 L111 189 C126 192 140 185 148 171 C150 151 149 140 144 130 Z',load)}
      ${bodyZone('Arme','frontArmL','M43 145 C52 136 61 142 64 158 L57 246 C53 271 48 298 36 316 C26 309 24 292 28 273 L35 187 C37 164 39 151 43 145 Z',load)}
      ${bodyZone('Arme','frontArmR','M177 145 C168 136 159 142 156 158 L163 246 C167 271 172 298 184 316 C194 309 196 292 192 273 L185 187 C183 164 181 151 177 145 Z',load)}
      ${bodyZone('Core','frontCore','M87 193 C98 187 122 187 133 193 L136 276 C130 299 121 311 110 316 C99 311 90 299 84 276 Z',load)}
      ${bodyZone('Beine','frontLegL','M82 319 C94 312 104 319 106 339 L100 405 L93 487 C88 501 79 501 73 488 L70 406 C68 370 71 338 82 319 Z',load)}
      ${bodyZone('Beine','frontLegR','M138 319 C126 312 116 319 114 339 L120 405 L127 487 C132 501 141 501 147 488 L150 406 C152 370 149 338 138 319 Z',load)}

      <g class="bodyContours" aria-hidden="true">
        <path d="M110 95 L110 315"/>
        <path d="M83 132 C93 140 102 142 110 140 C118 142 127 140 137 132"/>
        <path d="M89 210 H131 M88 232 H132 M87 255 H133"/>
        <path d="M78 319 C87 334 99 340 110 340 C121 340 133 334 142 319"/>
        <path d="M85 337 L78 477 M135 337 L142 477"/>
      </g>
      <text class="bodyViewLabel" x="110" y="515" text-anchor="middle">VORNE</text>
    </svg>`;
  }
  function backBodySvg(load){
    return `<svg class="bodyFocusFigure back" viewBox="0 0 220 520" role="img" aria-label="Körperansicht hinten">
      <g class="bodyBase">
        <ellipse cx="110" cy="42" rx="27" ry="33"/>
        <path d="M97 70 L123 70 L127 95 L93 95 Z"/>
        <path d="M82 89 C66 95 55 110 52 139 L57 244 C61 276 78 304 110 320 C142 304 159 276 163 244 L168 139 C165 110 154 95 138 89 C130 86 122 83 118 81 L102 81 C98 83 90 86 82 89 Z"/>
        <path d="M57 118 C41 124 31 143 27 171 L18 294 C16 317 26 333 41 329 C49 323 53 313 56 302 L63 210 L66 145 Z"/>
        <path d="M163 118 C179 124 189 143 193 171 L202 294 C204 317 194 333 179 329 C171 323 167 313 164 302 L157 210 L154 145 Z"/>
        <path d="M82 304 C70 326 66 359 68 404 L72 492 C79 509 92 509 98 488 L106 386 L108 320 Z"/>
        <path d="M138 304 C150 326 154 359 152 404 L148 492 C141 509 128 509 122 488 L114 386 L112 320 Z"/>
      </g>

      ${bodyZone('Schultern','backShoulderL','M57 121 C60 103 74 91 91 94 L95 128 C80 134 66 130 57 121 Z',load)}
      ${bodyZone('Schultern','backShoulderR','M163 121 C160 103 146 91 129 94 L125 128 C140 134 154 130 163 121 Z',load)}
      ${bodyZone('Rücken','backUpper','M77 126 C87 111 98 106 110 108 C122 106 133 111 143 126 L149 207 C139 237 126 249 110 252 C94 249 81 237 71 207 Z',load)}
      ${bodyZone('Unterer Rücken','backLower','M87 220 C98 212 122 212 133 220 L137 281 C130 301 121 312 110 316 C99 312 90 301 83 281 Z',load)}
      ${bodyZone('Arme','backArmL','M43 145 C52 136 61 142 64 158 L57 246 C53 271 48 298 36 316 C26 309 24 292 28 273 L35 187 C37 164 39 151 43 145 Z',load)}
      ${bodyZone('Arme','backArmR','M177 145 C168 136 159 142 156 158 L163 246 C167 271 172 298 184 316 C194 309 196 292 192 273 L185 187 C183 164 181 151 177 145 Z',load)}
      ${bodyZone('Beine','backLegL','M82 319 C94 312 104 319 106 339 L100 405 L93 487 C88 501 79 501 73 488 L70 406 C68 370 71 338 82 319 Z',load)}
      ${bodyZone('Beine','backLegR','M138 319 C126 312 116 319 114 339 L120 405 L127 487 C132 501 141 501 147 488 L150 406 C152 370 149 338 138 319 Z',load)}

      <g class="bodyContours" aria-hidden="true">
        <path d="M110 94 L110 316"/>
        <path d="M78 140 C91 156 100 164 110 165 C120 164 129 156 142 140"/>
        <path d="M80 208 C93 218 102 222 110 222 C118 222 127 218 140 208"/>
        <path d="M86 289 C96 298 103 302 110 302 C117 302 124 298 134 289"/>
        <path d="M78 319 C87 334 99 340 110 340 C121 340 133 334 142 319"/>
        <path d="M85 337 L78 477 M135 337 L142 477"/>
      </g>
      <text class="bodyViewLabel" x="110" y="515" text-anchor="middle">HINTEN</text>
    </svg>`;
  }
  function anatomyFigure(load){
    return `<div class="bodyFocusMap" aria-label="Trainingsfokus nach Muskelgruppen">${frontBodySvg(load)}${backBodySvg(load)}</div>`;
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
      root.querySelectorAll('.bodyMuscleZone').forEach(z=>z.classList.toggle('is-selected',!!active&&z.dataset.muscle===active));
    };
    root.querySelectorAll('.muscleRow').forEach(row=>row.addEventListener('click',()=>setSelected(row.dataset.muscle)));
    root.querySelectorAll('.bodyMuscleZone').forEach(z=>{
      z.addEventListener('click',()=>setSelected(z.dataset.muscle));
      z.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(z.dataset.muscle)}});
    });
  }

  function bodyCard(load){
    return `<section class="stableCard stableBody bodyFocusV2" id="stableBodyStatus"><div class="stableHead"><div><span>KÖRPER & FOKUS</span><h3>Muskelkarte · 30 Tage</h3></div><small>Aus deinen gespeicherten Sätzen berechnet</small></div><div class="bodyFocusIntro">Tippe auf eine Muskelgruppe oder direkt auf die Figur, um den Bereich hervorzuheben.</div><div class="stableAnatomy">${anatomyFigure(load)}</div><div class="stableLegend"><span><i class="l0"></i>keine Daten</span><span><i class="l1"></i>leicht</span><span><i class="l2"></i>mittel</span><span><i class="l3"></i>stark</span></div><div class="muscleRows bodyFocusRows">${muscleRows(load)}</div></section>`;
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
  window.addEventListener('gym:friend-compare-rendered',()=>setTimeout(patchCompareGraphics,60));
})();
