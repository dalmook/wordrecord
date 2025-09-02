/**
 * 받아쓰기 (GitHub Pages)
 * - 언어별/급수별 문제 로드 (data.json)
 * - Web Speech API로 음성 재생 (지원 기기에서만)
 * - 아이별 일자 기록 localStorage 저장
 */
(function(){
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
  const views = {
    home: $('#view-home'),
    setup: $('#view-setup'),
    play: $('#view-play'),
    records: $('#view-records'),
  };

  const state = {
    data: null,
    lang: 'ko',
    level: '1',
    count: 10,
    rate: 1.0,
    voiceURI: null,
    voices: [],
    session: null, // {items, idx, answers[], childId}
  };

  // ---------- Routing ----------
  function show(route){
    Object.values(views).forEach(v=>v.classList.remove('active'));
    (views[route]||views.home).classList.add('active');
  }
  $$('.app-icon, .topbar [data-route]').forEach(b=>{
    b.addEventListener('click', ()=> show(b.dataset.route));
  });

  // ---------- Children (localStorage) ----------
  const LS_CHILDREN = 'sb_children';
  const LS_RECORDS  = 'sb_records';

  function loadChildren(){
    try { return JSON.parse(localStorage.getItem(LS_CHILDREN)) || []; } catch(e){ return []; }
  }
  function saveChildren(list){ localStorage.setItem(LS_CHILDREN, JSON.stringify(list)); }
  function ensureDefaultChild(){
    let list = loadChildren();
    if(list.length===0){
      const id = crypto.randomUUID();
      list.push({id, name:'우리집'});
      saveChildren(list);
    }
    return list;
  }
  function renderChildSelects(){
    const list = ensureDefaultChild();
    const selects = [$('#childSelect'), $('#recChild')];
    selects.forEach(sel=>{
      if(!sel) return;
      sel.innerHTML = '';
      list.forEach(c=>{
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt);
      });
    });
  }
  function activeChildId(){ return $('#childSelect')?.value; }

  // Add child modal
  $('#addChildBtn').addEventListener('click', ()=> $('#childModal').showModal());
  $('#childForm').addEventListener('close', (e)=>{
    // dialog returns empty; use button value via submit handler
  });
  $('#childForm').addEventListener('submit', (e)=> e.preventDefault());
  $('#childForm').addEventListener('click', (e)=>{
    if(!(e.target instanceof HTMLButtonElement)) return;
    if(e.target.value==='ok'){
      const name = $('#childNameInput').value.trim();
      if(!name) return;
      const list = loadChildren();
      list.push({id: crypto.randomUUID(), name});
      saveChildren(list);
      renderChildSelects();
    }
    $('#childModal').close();
    $('#childNameInput').value='';
  });

  // ---------- Data (data.json) ----------
  const SAMPLE = {
    ko: {
      "1": ["학교", "바다", "사과", "친구", "가족", "선생님", "강아지", "비행기", "여름", "겨울"],
      "2": ["오늘 날씨가 좋아요.", "나는 학교에 가요.", "엄마와 시장에 갔어요.", "친구와 같이 놀았어요.", "저는 사과를 좋아해요."]
    },
    en: {
      "1": ["apple", "banana", "school", "family", "teacher", "dog", "plane", "summer", "winter", "friend"],
      "2": ["I like apples.", "She goes to school.", "We play together.", "It's a sunny day.", "Please open the door."]
    }
  };

  async function loadData(){
    try {
      const res = await fetch('data.json', {cache:'no-store'});
      if(!res.ok) throw new Error('no data.json');
      const json = await res.json();
      state.data = json;
    } catch(e){
      console.warn('data.json을 불러오지 못해 샘플 데이터를 사용합니다.', e);
      state.data = SAMPLE;
    }
    refreshLevels();
  }

  function refreshLevels(){
    const levels = Object.keys(state.data?.[state.lang]||{}).sort((a,b)=>Number(a)-Number(b));
    const sel = $('#levelSelect');
    sel.innerHTML = '';
    levels.forEach(l=>{
      const opt = document.createElement('option');
      opt.value=l; opt.textContent = `${l}급`; sel.appendChild(opt);
    });
    state.level = levels[0] || '1';
    sel.value = state.level;
  }

  // ---------- Voices (Web Speech) ----------
  function loadVoicesIntoState(){
    const voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    state.voices = voices;
    renderVoiceSelect();
  }
  function renderVoiceSelect(){
    const sel = $('#voiceSelect');
    sel.innerHTML = '';
    const vlist = state.voices.filter(v => state.lang==='ko' ? v.lang?.toLowerCase().startsWith('ko') : v.lang?.toLowerCase().startsWith('en'));
    const def = document.createElement('option');
    def.value = ''; def.textContent = vlist.length? '기본(권장)' : '기기 음성 미지원';
    sel.appendChild(def);
    vlist.forEach(v=>{
      const opt = document.createElement('option');
      opt.value = v.voiceURI; opt.textContent = `${v.name} (${v.lang})`;
      sel.appendChild(opt);
    });
    sel.disabled = vlist.length===0;
  }
  if('speechSynthesis' in window){
    speechSynthesis.onvoiceschanged = loadVoicesIntoState;
  }

  function speak(text){
    if(!('speechSynthesis' in window)) return;
    try{
      const ut = new SpeechSynthesisUtterance(text);
      ut.rate = state.rate;
      ut.lang = state.lang==='ko' ? 'ko-KR' : 'en-US';
      if(state.voiceURI){
        const v = state.voices.find(v=>v.voiceURI===state.voiceURI);
        if(v) ut.voice = v;
      }
      speechSynthesis.cancel(); // stop pending
      speechSynthesis.speak(ut);
    }catch(e){ console.warn(e); }
  }

  // ---------- Setup controls ----------
  $('#rate').addEventListener('input', e=>{
    state.rate = Number(e.target.value);
    $('#rateVal').textContent = state.rate.toFixed(1)+"×";
    $('#rateInPlay').value = state.rate;
    $('#rateVal2').textContent = state.rate.toFixed(1)+"×";
  });
  $('#rateInPlay').addEventListener('input', e=>{
    state.rate = Number(e.target.value);
    $('#rateVal2').textContent = state.rate.toFixed(1)+"×";
    $('#rate').value = state.rate;
    $('#rateVal').textContent = state.rate.toFixed(1)+"×";
  });

  $('#countSelect').addEventListener('change', e=> state.count = Number(e.target.value));
  $('#levelSelect').addEventListener('change', e=> state.level = e.target.value);
  $('#voiceSelect').addEventListener('change', e=> state.voiceURI = e.target.value || null);

  $$('#langButtons .seg').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('#langButtons .seg').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      state.lang = b.dataset.lang;
      refreshLevels();
      renderVoiceSelect();
    });
  });

  $('#startBtn').addEventListener('click', startSession);

  function startSession(){
    const items = (state.data?.[state.lang]?.[state.level] || []).slice();
    if(items.length===0){
      alert('선택한 급수의 문제가 없습니다. data.json을 확인하세요.');
      return;
    }
    // 섞어서 필요한 개수만 선택
    shuffle(items);
    const qs = items.slice(0, Math.min(state.count, items.length));
    state.session = { items: qs, idx: 0, answers: [], childId: activeChildId(), lang: state.lang, level: state.level };

    $('#progNow').textContent = '1';
    $('#progTotal').textContent = String(qs.length);
    $('#qNum').textContent = '1';
    $('#answerInput').value = '';
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';

    show('play');
    // 첫 문제 재생은 사용자가 재생 버튼을 누르게 (모바일 자동재생 제한)
  }

  $('#replayBtn').addEventListener('click', ()=>{
    const q = currentQuestionText();
    if(q) speak(q);
  });

  function currentQuestionText(){
    const s = state.session; if(!s) return '';
    return String(s.items[s.idx]);
  }

  $('#checkBtn').addEventListener('click', ()=>{
    const s = state.session; if(!s) return;
    const q = currentQuestionText();
    const a = $('#answerInput').value.trim();
    const correct = normalize(a) === normalize(q);
    s.answers[s.idx] = { q, a, ok: correct };

    const fb = $('#feedback');
    if(correct){ fb.textContent = '정답! 잘했어요 👍'; fb.className = 'feedback ok'; }
    else { fb.innerHTML = `오답이에요 😅\n정답: <strong>${escapeHtml(q)}</strong>`; fb.className = 'feedback no'; }
  });

  $('#nextBtn').addEventListener('click', ()=>{
    const s = state.session; if(!s) return;
    // 자동으로 미체크시 오답 처리
    if(!s.answers[s.idx]){
      const q = currentQuestionText();
      const a = $('#answerInput').value.trim();
      s.answers[s.idx] = { q, a, ok: normalize(a)===normalize(q) };
    }

    s.idx++;
    if(s.idx >= s.items.length){
      finishSession();
      return;
    }

    $('#progNow').textContent = String(s.idx+1);
    $('#qNum').textContent = String(s.idx+1);
    $('#answerInput').value = '';
    $('#feedback').textContent = '';
    $('#feedback').className = 'feedback';
    $('#answerInput').focus();
  });

  function finishSession(){
    const s = state.session; if(!s) return;
    const total = s.items.length;
    const correct = s.answers.filter(x=>x?.ok).length;

    // 기록 저장
    const recs = loadRecords();
    const cid = s.childId || ensureDefaultChild()[0].id;
    const entry = {
      ts: Date.now(),
      date: new Date().toISOString(),
      lang: s.lang, level: s.level, total, correct, details: s.answers
    };
    if(!recs[cid]) recs[cid] = [];
    recs[cid].push(entry);
    saveRecords(recs);

    alert(`끝! 점수: ${correct}/${total}`);
    renderRecords();
    show('records');
  }

  function normalize(t){
    return (t||'').toLowerCase().replace(/\s+/g,' ').trim();
  }
  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }

  // ---------- Records ----------
  function loadRecords(){ try { return JSON.parse(localStorage.getItem(LS_RECORDS)) || {}; } catch(e){ return {}; } }
  function saveRecords(obj){ localStorage.setItem(LS_RECORDS, JSON.stringify(obj)); }

  function renderRecords(){
    const listEl = $('#recordsList');
    const cid = $('#recChild').value || activeChildId();
    const lang = $('#recLang').value || 'all';
    const range = $('#recRange').value || '30';

    const recs = loadRecords()[cid] || [];
    const now = Date.now();
    const days = range==='all' ? Infinity : Number(range);

    const filtered = recs.filter(r =>
      (lang==='all' || r.lang===lang) &&
      (days===Infinity || now - new Date(r.date).getTime() <= days*24*60*60*1000)
    ).sort((a,b)=> b.ts - a.ts);

    listEl.innerHTML = '';
    if(filtered.length===0){ listEl.innerHTML = '<div class="rec-item">기록이 없습니다.</div>'; return; }

    filtered.forEach(r=>{
      const wrap = document.createElement('div'); wrap.className='rec-item';
      const head = document.createElement('div'); head.className='rec-head';
      const date = new Date(r.date);
      const meta = document.createElement('div'); meta.className='meta';
      meta.textContent = `${date.toLocaleString()} · ${r.lang.toUpperCase()} · ${r.level}급`;
      const score = document.createElement('div');
      score.innerHTML = `<span class="badge"><strong>${r.correct}</strong> / ${r.total}</span>`;
      head.append(meta, score);

      const details = document.createElement('div'); details.className='rec-details';
      const text = r.details.map((d,i)=>{
        const mark = d.ok ? '✔' : '✘';
        return `${String(i+1).padStart(2,'0')}. [${mark}] 입력: ${d.a||''}\n    정답: ${d.q}`;
      }).join('\n');
      details.textContent = text;

      wrap.append(head, details);
      listEl.appendChild(wrap);
    });
  }

  $('#recChild').addEventListener('change', renderRecords);
  $('#recLang').addEventListener('change', renderRecords);
  $('#recRange').addEventListener('change', renderRecords);

  // ---------- Init ----------
  function init(){
    renderChildSelects();
    $('#recChild').value = activeChildId();
    loadData();
    loadVoicesIntoState();
    renderRecords();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
