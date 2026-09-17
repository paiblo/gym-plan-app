(()=>{
  if(window.__paibloStableUI)return;
  window.__paibloStableUI=true;
  const ANATOMY='https://upload.wikimedia.org/wikipedia/commons/e/ef/Muscles_front_and_back.svg';
  let seq=0, observer=null, refreshTimer=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Number(n||0));
  const fmt1=n=>Number(n||0).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1});
  const uid=()=>{try{return cloudSession?.user?.id||JSON.parse(localStorage.getItem('gym-auth-session')||'null')?.user?.id||null}catch{return null}};
  const modeNow=()=>{try{return mode}catch{return null}};
  const dayKey=d=>new Date(d).toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});

  async function json(path,options={}){
    const r=await api(path,options);let data=null;try{data=await r.json()}catch{}
    if(!r.ok)throw new Error(data?.message||data?.error||`HTTP ${r.status}`);
    return data;
  }
  async function events(limit=500){
    const id=uid();if(!id)return[];
    return json(`/rest/v1/workout_events?select=occurred_at,day_key,set_count,pr_count,volume,payload&user_id=eq.${encodeURIComponent(id)}&order=occurred_at.asc&limit=${limit}`);
  }
  async function weights(limit=40){
    const id=uid();if(!id)return[];
    if(typeof getWeightEntries==='function')return getWeightEntries(id,limit);
    return json(`/rest/v1/weight_entries?select=weight_kg,measured_at&user_id=eq.${encodeURIComponent(id)}&order=measured_at.desc&limit=${limit}`);
  }
  async function stats(){
    if(typeof getOwnStats==='function')return getOwnStats();
    if(typeof getStats==='function')return getStats(uid());
    const r=await rpc('get_social_stats',{p_user_id:uid()});return Array.isArray(r)?r[0]:r;
  }

  function fixAvatar(){
    const img=document.querySelector('#pageAvatarImg'),fb=document.querySelector('#pageAvatarFallback');
    if(img&&!img.hidden&&img.getAttribute('src')){img.style.removeProperty('display');if(fb){fb.hidden=true;fb.style.setProperty('display','none','important')}}
    const ti=document.querySelector('#premiumProfileImg'),tf=document.querySelector('#premiumProfileFallback');
    if(ti&&!ti.hidden&&ti.getAttribute('src')){ti.style.removeProperty('display');if(tf){tf.hidden=true;tf.style.setProperty('display','none','important')}}
  }

  function fixRankCard(){
    const grid=document.querySelector('.dashboardGrid');if(!grid)return;
    const outer=grid.querySelector('#dashRank');
    if(outer){const inner=outer.querySelector(':scope > .premiumRankCard')||outer.querySelector('.premiumRankCard');if(inner){outer.replaceWith(inner);inner.id='dashRankStable'}}
    grid.querySelectorAll('.dashCard').forEach(c=>{if(!c.classList.contains('primary')&&!c.textContent.trim()&&!c.children.length)c.remove()});
  }

  function ensureBack(){
    if(modeNow()!=='profilepage')return;
    const area=document.querySelector('#area'),hero=area?.querySelector('.profileHero');if(!area||!hero||area.querySelector('.stableBack'))return;
    const b=document.createElement('button');b.className='stableBack';b.type='button';b.innerHTML='← <span>Zurück zum Dashboard</span>';
    b.onclick=()=>{if(typeof premiumGo==='function')premiumGo('dashboard');else{try{mode='dashboard';render()}catch{}}};
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
    if(s.includes('unterer r')||s.includes('lower back')||s.includes('lenden'))return'Unterer Rücken';
    if(s.includes('schulter')||s.includes('seitheben'))return'Schultern';
    if(s.includes('brust')||s.includes('chest')||s.includes('butterfl')||s.includes('schrägbank'))return'Brust';
    if(s.includes('rück')||s.includes('rudern')||s.includes('latzug')||s.includes('a-bar'))return'Rücken';
    if(s.includes('bein')||s.includes('kniebeug')||s.includes('leg '))return'Beine';
    if(s.includes('arm')||s.includes('bizeps')||s.includes('trizeps')||s.includes('curl')||s.includes('push down')||s.includes('kartana'))return'Arme';
    if(s.includes('core')||s.includes('bauch')||s.includes('abdominal'))return'Core';
    if(s.includes('kreuzheben'))return'Unterer Rücken';
    return null;
  }
  function muscleLoads(ev){
    const cutoff=Date.now()-30*864e5, load={'Brust':0,'Rücken':0,'Unterer Rücken':0,'Schultern':0,'Arme':0,'Core':0,'Beine':0}, days={};
    for(const e of ev){
      if(new Date(e.occurred_at).getTime()<cutoff)continue;
      const p=e.payload||{};let assigned=0;
      if(Array.isArray(p.exercises)&&p.exercises.length){
        for(const ex of p.exercises){const sets=Math.max(1,Array.isArray(ex.sets)?ex.sets.length:1),g=groupForExercise(ex.name,e.day_key),b=bucket(g,ex.name);if(b){load[b]+=sets;assigned+=sets;days[b]??=new Set();days[b].add(dayKey(e.occurred_at))}}
      }else if(p.exercise){const b=bucket(groupForExercise(p.exercise,e.day_key),p.exercise);if(b){const sets=Math.max(1,Number(e.set_count||1));load[b]+=sets;assigned+=sets;days[b]??=new Set();days[b].add(dayKey(e.occurred_at))}}
      if(!assigned&&e.day_key){
        const gs=Object.keys(PLAN?.[e.day_key]?.groups||{}).map(g=>bucket(g)).filter(Boolean),uniq=[...new Set(gs)],share=uniq.length?Number(e.set_count||1)/uniq.length:0;
        for(const b of uniq){load[b]+=share;days[b]??=new Set();days[b].add(dayKey(e.occurred_at))}
      }
    }
    return Object.fromEntries(Object.entries(load).map(([k,v])=>[k,{sets:Math.round(v*10)/10,days:days[k]?.size||0}]));
  }
  function level(v){const n=Number(v||0);return n<=0?'none':n<=8?'light':n<=20?'medium':'strong'}
  function levelText(v){return{none:'Keine Daten',light:'Leicht',medium:'Mittel',strong:'Stark'}[level(v)]}

  function markers(load){return Object.entries(load).map(([k,v])=>`<i class="muscleMarker ${level(v.sets)}" data-muscle="${esc(k)}" title="${esc(k)} · ${fmt(v.sets)} Sätze / 30 Tage"></i>`).join('')}
  function muscleRows(load){const mx=Math.max(1,...Object.values(load).map(x=>x.sets));return Object.entries(load).map(([k,v])=>`<div class="muscleRow"><span>${esc(k)}</span><div class="muscleTrack"><i style="width:${Math.round(v.sets/mx*100)}%"></i></div><b>${fmt(v.sets)} S. · ${levelText(v.sets)}</b></div>`).join('')}

  function bodyCard(load){return `<section id="stableBodyStatus" class="stableCard"><div class="stableHead"><div><span>KÖRPER & FOKUS</span><h3>Trainingsfokus · 30 Tage</h3></div><small>Aus deinen tatsächlich gespeicherten Sätzen</small></div><div class="stableBodyGrid"><div><div class="stableAnatomy"><img src="${ANATOMY}" alt="Anatomische Muskelansicht von vorne und hinten">${markers(load)}</div><div class="stableLegend"><span><i class="l0"></i>keine Daten</span><span><i class="l1"></i>leicht</span><span><i class="l2"></i>mittel</span><span><i class="l3"></i>stark</span></div></div><div class="muscleRows">${muscleRows(load)}</div></div></section>`}

  function sevenDays(ev){const out=[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=dayKey(d),same=ev.filter(x=>dayKey(x.occurred_at)===k);out.push({label:d.toLocaleDateString('de-DE',{weekday:'short'}).slice(0,2),sets:same.reduce((a,x)=>a+Number(x.set_count||0),0),volume:same.reduce((a,x)=>a+Number(x.volume||0),0)})}return out}
  function fourWeeks(ev){const out=[];for(let w=3;w>=0;w--){const end=new Date();end.setDate(end.getDate()-w*7);const start=new Date(end);start.setDate(start.getDate()-6);start.setHours(0,0,0,0);end.setHours(23,59,59,999);const same=ev.filter(x=>{const d=new Date(x.occurred_at);return d>=start&&d<=end});out.push({label:w===0?'Diese':`-${w}W`,volume:same.reduce((a,x)=>a+Number(x.volume||0),0),sets:same.reduce((a,x)=>a+Number(x.set_count||0),0)})}return out}
  function barSvg(items,key,color='#ff9450'){
    const vals=items.map(x=>Number(x[key]||0)),mx=Math.max(1,...vals),w=360,h=118,bw=32,gap=(w-30-bw*items.length)/Math.max(1,items.length-1);return `<svg viewBox="0 0 ${w} ${h}" aria-label="Balkendiagramm">${items.map((x,i)=>{const val=vals[i],bh=val?Math.max(5,72*val/mx):3,xx=15+i*(bw+gap),yy=88-bh;return `<rect x="${xx}" y="${yy}" width="${bw}" height="${bh}" rx="7" fill="${val?color:'#232c36'}"/><text x="${xx+bw/2}" y="107" text-anchor="middle" fill="#748191" font-size="9">${esc(x.label)}</text>`}).join('')}<line x1="10" y1="89" x2="350" y2="89" stroke="#222c36"/></svg>`}
  function lineSvg(vals,color='#38bdf8'){
    const n=vals.map(Number).filter(Number.isFinite);if(n.length<2)return`<div class="chartEmpty">Noch nicht genug Messpunkte für einen Verlauf.</div>`;
    const w=360,h=118,p=12,min=Math.min(...n),max=Math.max(...n),span=Math.max(.1,max-min),pts=n.map((v,i)=>`${p+(w-2*p)*i/(n.length-1)},${h-p-(h-2*p)*(v-min)/span}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" aria-label="Verlauf"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${pts.split(' ').map(pt=>{const[x,y]=pt.split(',');return`<circle cx="${x}" cy="${y}" r="3" fill="#0d1218" stroke="${color}" stroke-width="2"/>`}).join('')}</svg>`}
  function chartBlock(ev,w){
    const days=sevenDays(ev),weeks=fourWeeks(ev),weightSeries=[...(w||[])].reverse().slice(-12).map(x=>Number(x.weight_kg));
    const sets7=days.reduce((a,x)=>a+x.sets,0),vol4=weeks.reduce((a,x)=>a+x.volume,0),latest=w?.[0]?.weight_kg;
    return `<section id="stableAnalytics" class="stableCard"><div class="stableHead"><div><span>FORTSCHRITT</span><h3>Aktuelle Statistiken</h3></div><small>Wird bei jedem Öffnen neu geladen</small></div><div class="stableCharts"><div class="chartCard"><div class="chartTitle"><b>Sätze · 7 Tage</b><span>${fmt(sets7)} gesamt</span></div>${barSvg(days,'sets','#ff9450')}</div><div class="chartCard"><div class="chartTitle"><b>Volumen · 4 Wochen</b><span>${fmt(vol4)} kg</span></div>${barSvg(weeks,'volume','#ffb06d')}</div><div class="chartCard"><div class="chartTitle"><b>Gewicht</b><span>${latest?`${fmt1(latest)} kg`:'keine Messung'}</span></div>${lineSvg(weightSeries)}</div><div class="chartCard"><div class="chartTitle"><b>Datenbasis</b><span>live</span></div><div class="chartEmpty">Trainingsgrafiken verwenden gespeicherte Workout-Events. Der Muskelstatus nutzt die einzelnen Übungen und Sätze der letzten 30 Tage.</div></div></div></section>`}

  async function refreshDashboard(mySeq){
    if(modeNow()!=='dashboard')return;
    const area=document.querySelector('#area');if(!area)return;
    try{const [ev,w]=await Promise.all([events(),weights()]);if(mySeq!==seq||modeNow()!=='dashboard')return;const load=muscleLoads(ev);area.querySelector('.bodyOverview')?.remove();area.querySelector('#stableBodyStatus')?.remove();area.querySelector('#stableAnalytics')?.remove();const quick=area.querySelector('.quickSection');const statsEl=area.querySelector('.premiumStats');const anchor=quick||statsEl?.nextElementSibling;if(anchor)anchor.insertAdjacentHTML('beforebegin',bodyCard(load)+chartBlock(ev,w));else area.insertAdjacentHTML('beforeend',bodyCard(load)+chartBlock(ev,w));}
    catch(e){console.warn('stable dashboard refresh failed',e)}
  }

  function patchCompare(){
    const panel=document.querySelector('#friendCompare .comparePanel');if(!panel||panel.querySelector('.stableCompare'))return;
    const rows=[...panel.querySelectorAll('.compareRows>div')];if(!rows.length)return;
    const metrics=[];for(const r of rows){const parts=[...r.children];if(parts.length<4)continue;const label=parts[0].textContent.trim(),a=parseFloat(parts[1].textContent.replace(/[^0-9,.-]/g,'').replace(',','.'))||0,b=parseFloat(parts[3].textContent.replace(/[^0-9,.-]/g,'').replace(',','.'))||0;metrics.push({label,a,b})}
    if(!metrics.length)return;const html=metrics.map(m=>{const mx=Math.max(1,m.a,m.b);return`<div class="compareChartRow"><span>${esc(m.label)}</span><div><div class="compareTwin"><i class="me" style="width:${m.a/mx*100}%"></i><i class="friend" style="width:${m.b/mx*100}%"></i></div><div class="compareValues"><span>Du ${fmt(m.a)}</span><span>${fmt(m.b)} Freund</span></div></div></div>`}).join('');panel.insertAdjacentHTML('beforeend',`<div class="stableCompare"><div class="stableHead"><div><span>GRAFISCHER VERGLEICH</span><h3>Direktvergleich</h3></div><small>Orange = Du · Blau = Freund</small></div>${html}</div>`);
  }

  function patchDom(){
    fixAvatar();fixRankCard();ensureBack();patchCompare();
    document.querySelectorAll('.bodyHeatmap,.heatmapCard,.realAnatomyFocus').forEach(x=>x.remove());
    const title=document.querySelector('#premiumPageTitle');if(title&&modeNow()==='profilepage')title.textContent='Profil';
  }

  function schedule(){
    seq++;const s=seq;clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{patchDom();if(modeNow()==='dashboard')refreshDashboard(s)},220);
  }

  function boot(){
    if(typeof render!=='function'||!document.querySelector('#area')){setTimeout(boot,120);return}
    if(!render.__stableWrapped){const old=render;const wrapped=function(){const r=old.apply(this,arguments);schedule();return r};wrapped.__stableWrapped=true;render=wrapped}
    const area=document.querySelector('#area');observer=new MutationObserver(()=>schedule());observer.observe(area,{childList:true,subtree:true});
    window.addEventListener('focus',()=>{if(modeNow()==='dashboard')schedule()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&modeNow()==='dashboard')schedule()});
    setInterval(()=>{if(modeNow()==='dashboard')schedule()},30000);
    schedule();
  }
  boot();
})();
