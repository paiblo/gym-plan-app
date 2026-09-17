(()=>{
  if(window.__paibloWelcome)return;
  window.__paibloWelcome=true;
  const hasSession=()=>{try{const s=JSON.parse(localStorage.getItem('gym-auth-session')||'null');return !!s?.access_token}catch{return false}};
  if(hasSession())return;
  const slides=[
    {icon:'P',kicker:'PAIBLO TRAINING',title:'Dein Training.\nDein Fortschritt.',text:'Plane deine Woche, tracke jedes Set und sieh, wie du wirklich stärker wirst.',chips:['Training','PRs','Fortschritt']},
    {icon:'↗',kicker:'SMART TRACKING',title:'Weniger tippen.\nMehr trainieren.',text:'Ränge, Körperwerte und Trainingsstatistiken werden übersichtlich an einem Ort zusammengeführt.',chips:['Rangsystem','Gewicht','Statistiken']},
    {icon:'◎',kicker:'TRAIN TOGETHER',title:'Vergleichen.\nMotivieren. Wachsen.',text:'Füge Freunde hinzu, vergleicht euren Fortschritt und baut später gemeinsame Battles auf.',chips:['Freunde','Vergleich','Challenges']}
  ];
  let i=0;
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function create(){
    if(document.querySelector('#welcomeScreen'))return;
    const el=document.createElement('section');
    el.id='welcomeScreen';
    el.innerHTML='<div class="welcomeNoise"></div><div class="welcomeInner"><div class="welcomeBrand"><span class="welcomeMark">P</span><div><b>PAIBLO TRAINING</b><small>Eine App von Paiblo</small></div></div><div id="welcomeSlide"></div><div class="welcomeBottom"><div id="welcomeDots" class="welcomeDots"></div><button id="welcomeNext" class="welcomePrimary"></button><button id="welcomeSkip" class="welcomeSkip">Direkt anmelden</button></div></div>';
    document.body.appendChild(el);
    el.querySelector('#welcomeNext').onclick=()=>{if(i<slides.length-1){i++;render()}else finish()};
    el.querySelector('#welcomeSkip').onclick=finish;
    let sx=0;
    el.addEventListener('touchstart',e=>sx=e.touches[0]?.clientX||0,{passive:true});
    el.addEventListener('touchend',e=>{const dx=(e.changedTouches[0]?.clientX||0)-sx;if(Math.abs(dx)>55){i=Math.max(0,Math.min(slides.length-1,i+(dx<0?1:-1)));render()}},{passive:true});
    render();
  }
  function render(){
    const el=document.querySelector('#welcomeScreen');if(!el)return;const s=slides[i];
    el.querySelector('#welcomeSlide').innerHTML=`<div class="welcomeVisual"><div class="welcomeHalo"></div><div class="welcomeHeroIcon">${esc(s.icon)}</div><div class="welcomeMetric m1"><b>+12%</b><span>Progress</span></div><div class="welcomeMetric m2"><b>4×</b><span>Diese Woche</span></div></div><div class="welcomeCopy"><span>${esc(s.kicker)}</span><h1>${esc(s.title).replace(/\n/g,'<br>')}</h1><p>${esc(s.text)}</p><div class="welcomeChips">${s.chips.map(x=>`<i>${esc(x)}</i>`).join('')}</div></div>`;
    el.querySelector('#welcomeDots').innerHTML=slides.map((_,n)=>`<button aria-label="Seite ${n+1}" class="${n===i?'on':''}" data-i="${n}"></button>`).join('');
    el.querySelectorAll('#welcomeDots button').forEach(b=>b.onclick=()=>{i=+b.dataset.i;render()});
    el.querySelector('#welcomeNext').textContent=i===slides.length-1?'Loslegen':'Weiter';
  }
  function finish(){const el=document.querySelector('#welcomeScreen');if(!el)return;el.classList.add('leaving');setTimeout(()=>el.remove(),260)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',create,{once:true});else create();
})();
