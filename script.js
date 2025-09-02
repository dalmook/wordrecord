/**
 * 받아쓰기 (GitHub Pages)
 * - 언어/급수 문제 로드(data.json) · Web Speech API 재생 · localStorage 기록
 * - 두 모드: 입력형(standard) / 실전쓰기(drill: 노트에 받아 적고 수동 채점)
 */
(function(){
  var $ = function(sel, el){ return (el||document).querySelector(sel); };
  var $$ = function(sel, el){ return Array.prototype.slice.call((el||document).querySelectorAll(sel)); };
  var views = {
    home: $('#view-home'),
    setup: $('#view-setup'),
    play: $('#view-play'),
    practice: $('#view-practice'),
    records: $('#view-records')
  };

  var MODE_STANDARD = 'standard';
  var MODE_DRILL = 'drill';

  var state = {
    data: null,
    lang: 'ko',
    level: '1',
    count: 10,
    rate: 1.0,
    voiceURI: null,
    voices: [],
    session: null // {items, idx, answers[], childId, mode, lang, level}
  };

  // ---------- Routing ----------
  function show(route){
    Object.keys(views).forEach(function(k){ views[k].classList.remove('active'); });
    (views[route]||views.home).classList.add('active');
  }
  $$('.app-icon, .topbar [data-route]').forEach(function(b){ b.addEventListener('click', function(){ show(b.dataset.route); }); });

  // ---------- Children ----------
  var LS_CHILDREN = 'sb_children';
  var LS_RECORDS  = 'sb_records';
  function loadChildren(){ try { return JSON.parse(localStorage.getItem(LS_CHILDREN)) || []; } catch(e){ return []; } }
  function saveChildren(list){ localStorage.setItem(LS_CHILDREN, JSON.stringify(list)); }
  function ensureDefaultChild(){
    var list = loadChildren();
    if(list.length===0){ list = [{id: crypto.randomUUID(), name:'우리집'}]; saveChildren(list); }
    return list;
  }
  function renderChildSelects(){
    var list = ensureDefaultChild();
    var selects = [$('#childSelect'), $('#recChild')];
    selects.forEach(function(sel){ if(!sel) return; sel.innerHTML=''; list.forEach(function(c){ var o=document.createElement('option'); o.value=c.id; o.textContent=c.name; sel.appendChild(o); }); });
  }
  function activeChildId(){ return $('#childSelect') ? $('#childSelect').value : null; }
  $('#addChildBtn').addEventListener('click', function(){ $('#childModal').showModal(); });
  $('#childForm').addEventListener('submit', function(e){ e.preventDefault(); });
  $('#childForm').addEventListener('click', function(e){
    if(!(e.target instanceof HTMLButtonElement)) return;
    if(e.target.value==='ok'){
      var name = $('#childNameInput').value.trim(); if(!name) return;
      var list = loadChildren(); list.push({id: crypto.randomUUID(), name:name}); saveChildren(list);
      renderChildSelects();
    }
    $('#childModal').close(); $('#childNameInput').value='';
  });

  // ---------- Data ----------
  var SAMPLE = {
    ko: {"1":["학교","바다","사과","친구","가족","선생님","강아지","비행기","여름","겨울"],"2":["오늘 날씨가 좋아요.","나는 학교에 가요.","엄마와 시장에 갔어요.","친구와 같이 놀았어요.","저는 사과를 좋아해요."]},
    en: {"1":["apple","banana","school","family","teacher","dog","plane","summer","winter","friend"],"2":["I like apples.","She goes to school.","We play together.","It's a sunny day.","Please open the door."]}
  };
  function loadData(){
    return fetch('data.json', {cache:'no-store'})
      .then(function(res){ if(!res.ok) throw new Error(); return res.json(); })
      .then(function(json){ state.data=json; })
      .catch(function(){ console.warn('data.json 불러오기 실패 → 샘플 사용'); state.data=SAMPLE; })
      .then(refreshLevels);
  }
  function refreshLevels(){
    var levels = Object.keys(state.data && state.data[state.lang] || {}).sort(function(a,b){ return Number(a)-Number(b); });
    var sel = $('#levelSelect'); sel.innerHTML='';
    levels.forEach(function(l){ var o=document.createElement('option'); o.value=l; o.textContent=l+'급'; sel.appendChild(o); });
    state.level = levels[0]||'1'; sel.value = state.level;
  }

  // ---------- Voices ----------
  function loadVoicesIntoState(){ var vs = window.speechSynthesis ? speechSynthesis.getVoices() : []; state.voices = vs; renderVoiceSelect(); }
  function renderVoiceSelect(){
    var sel = $('#voiceSelect'); sel.innerHTML='';
    var vlist = state.voices.filter(function(v){ return state.lang==='ko' ? (v.lang||'').toLowerCase().indexOf('ko')===0 : (v.lang||'').toLowerCase().indexOf('en')===0; });
    var def = document.createElement('option'); def.value=''; def.textContent = vlist.length? '기본(권장)' : '기기 음성 미지원'; sel.appendChild(def);
    vlist.forEach(function(v){ var o=document.createElement('option'); o.value=v.voiceURI; o.textContent=v.name+' ('+v.lang+')'; sel.appendChild(o); });
    sel.disabled = vlist.length===0;
  }
  if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged = loadVoicesIntoState; }
  function speak(text){
    if(!('speechSynthesis' in window)) return;
    try{
      var ut=new SpeechSynthesisUtterance(String(text));
      ut.rate=state.rate; ut.lang= state.lang==='ko'?'ko-KR':'en-US';
      if(state.voiceURI){ var v=state.voices.find(function(v){return v.voiceURI===state.voiceURI;}); if(v) ut.voice=v; }
      speechSynthesis.cancel(); speechSynthesis.speak(ut);
    }catch(e){}
  }

  // ---------- Setup controls ----------
  $('#rate').addEventListener('input', function(e){ state.rate=Number(e.target.value); $('#rateVal').textContent=state.rate.toFixed(1)+'×'; $('#rateInPlay').value=state.rate; $('#rateVal2').textContent=state.rate.toFixed(1)+'×'; });
  $('#rateInPlay').addEventListener('input', function(e){ state.rate=Number(e.target.value); $('#rateVal2').textContent=state.rate.toFixed(1)+'×'; $('#rate').value=state.rate; $('#rateVal').textContent=state.rate.toFixed(1)+'×'; });
  $('#countSelect').addEventListener('change', function(e){ state.count = Number(e.target.value); });
  $('#levelSelect').addEventListener('change', function(e){ state.level = e.target.value; });
  $('#voiceSelect').addEventListener('change', function(e){ state.voiceURI = e.target.value || null; });
  $$('#langButtons .seg').forEach(function(b){
    b.addEventListener('click', function(){
      $$('#langButtons .seg').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active'); state.lang=b.dataset.lang; refreshLevels(); renderVoiceSelect();
    });
  });

  // ---------- 입력형(standard) ----------
  $('#startBtn').addEventListener('click', startSession);
  function startSession(){
    var items = (state.data && state.data[state.lang] && state.data[state.lang][state.level] || []).slice();
    if(items.length===0){ alert('선택한 급수의 문제가 없습니다. data.json을 확인하세요.'); return; }
    shuffle(items); var qs = items.slice(0, Math.min(state.count, items.length));
    state.session = { items: qs, idx: 0, answers: [], childId: activeChildId(), lang: state.lang, level: state.level, mode: MODE_STANDARD };
    $('#progNow').textContent='1'; $('#progTotal').textContent=String(qs.length); $('#qNum').textContent='1';
    $('#answerInput').value=''; $('#feedback').textContent=''; $('#feedback').className='feedback';
    show('play');
  }
  $('#replayBtn').addEventListener('click', function(){ var q=currentQuestionText(); if(q) speak(q); });
  function currentQuestionText(){ var s=state.session; if(!s) return ''; return String(s.items[s.idx]); }
  $('#checkBtn').addEventListener('click', function(){
    var s=state.session; if(!s) return;
    var q=currentQuestionText(); var a=$('#answerInput').value.trim(); var ok=normalize(a)===normalize(q);
    s.answers[s.idx]={q:q,a:a,ok:ok};
    var fb=$('#feedback');
    if(ok){ fb.textContent='정답! 잘했어요 👍'; fb.className='feedback ok'; }
    else { fb.innerHTML='오답이에요 😅\n정답: <strong>'+escapeHtml(q)+'</strong>'; fb.className='feedback no'; }
  });
  $('#nextBtn').addEventListener('click', function(){
    var s=state.session; if(!s) return;
    if(!s.answers[s.idx]){ var q=currentQuestionText(); var a=$('#answerInput').value.trim(); s.answers[s.idx]={q:q,a:a,ok:normalize(a)===normalize(q)}; }
    s.idx++; if(s.idx>=s.items.length){ finishSession(); return; }
    $('#progNow').textContent=String(s.idx+1); $('#qNum').textContent=String(s.idx+1);
    $('#answerInput').value=''; $('#feedback').textContent=''; $('#feedback').className='feedback'; $('#answerInput').focus();
  });

  // ---------- 실전쓰기(drill) ----------
  // 홈 아이콘/설정 버튼으로 진입
  var practiceIcon = document.querySelector('[data-route="practice"]');
  if(practiceIcon){ practiceIcon.addEventListener('click', startDrill); }
  var practiceBtn = document.getElementById('practiceBtn');
  if(practiceBtn){ practiceBtn.addEventListener('click', startDrill); }

  function startDrill(){
    var items = (state.data && state.data[state.lang] && state.data[state.lang][state.level] || []).slice();
    if(items.length===0){ alert('선택한 급수의 문제가 없습니다. data.json을 확인하세요.'); return; }
    shuffle(items); var qs = items.slice(0, Math.min(state.count, items.length));
    state.session = { items: qs, idx: 0, answers: Array(qs.length).fill(null), childId: activeChildId(), lang: state.lang, level: state.level, mode: MODE_DRILL };
    renderDrillList(); show('practice');
  }

  function renderDrillList(){
    var list = $('#drillList'); if(!list) return; list.innerHTML=''; var s=state.session; if(!s) return;
    s.items.forEach(function(q,i){
      var row=document.createElement('div'); row.className='drill-item'; row.dataset.idx=String(i);
      row.innerHTML =
        '<button class="btn round play" aria-label="재생" data-idx="'+i+'">▶</button>'+
        '<div class="qbody">'+
          '<div class="qmeta">문제 '+(i+1)+'</div>'+
          '<div class="answer hide">정답: <span>'+escapeHtml(String(q))+'</span></div>'+
          '<div class="mark segmented tiny" role="group">'+
            '<button class="seg" data-ok="1">정답</button>'+
            '<button class="seg" data-ok="0">오답</button>'+
            '<button class="seg ghost reveal" data-reveal="1">정답 보기</button>'+
          '</div>'+
        '</div>';
      list.appendChild(row);
    });
    list.onclick = function(e){
      var btn = e.target.closest('button'); if(!btn) return; var item = btn.closest('.drill-item'); var idx = Number(item && item.dataset && item.dataset.idx || 0); var q = state.session.items[idx];
      if(btn.classList.contains('play')){ speak(String(q)); }
      else if(btn.dataset.reveal){ var ans=item.querySelector('.answer'); ans.classList.toggle('hide'); btn.textContent = ans.classList.contains('hide')?'정답 보기':'가리기'; }
      else if(typeof btn.dataset.ok!== 'undefined'){ var ok = btn.dataset.ok==='1'; state.session.answers[idx] = { q:q, a:null, ok:ok }; item.querySelectorAll('[data-ok]').forEach(function(b){ b.classList.remove('active'); }); btn.classList.add('active'); }
    };
  }

  $('#drillGradeBtn').addEventListener('click', function(){
    var s=state.session; if(!s) return; var unmarked = s.answers.findIndex(function(a){return !a;});
    if(unmarked!==-1){ alert('채점하지 않은 문제가 있습니다: '+(unmarked+1)+'번'); }
    else { alert('채점 완료! 이제 "기록 저장"을 눌러주세요.'); }
  });
  $('#drillSaveBtn').addEventListener('click', function(){
    var s=state.session; if(!s) return;
    if(s.mode!==MODE_DRILL){ alert('실전쓰기 모드가 아닙니다.'); return; }
    var unmarked = s.answers.findIndex(function(a){return !a;});
    if(unmarked!==-1){ alert('채점하지 않은 문제가 있습니다: '+(unmarked+1)+'번'); return; }
    finishSession();
  });

  // ---------- 공용 & 기록 ----------
  function normalize(t){ return (t||'').toLowerCase().replace(/\\s+/g,' ').trim(); }
  function escapeHtml(s){ return (s||'').replace(/[&<>\"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#39;"}[c]; }); }
  function shuffle(arr){ for(var i=arr.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; } }
  function loadRecords(){ try { return JSON.parse(localStorage.getItem(LS_RECORDS)) || {}; } catch(e){ return {}; } }
  function saveRecords(obj){ localStorage.setItem(LS_RECORDS, JSON.stringify(obj)); }

  function finishSession(){
    var s=state.session; if(!s) return; var total=s.items.length; var correct=s.answers.filter(function(x){return x&&x.ok;}).length;
    var recs=loadRecords(); var cid=s.childId || ensureDefaultChild()[0].id;
    var entry={ ts:Date.now(), date:new Date().toISOString(), lang:s.lang, level:s.level, total:total, correct:correct, mode:s.mode||MODE_STANDARD, details:s.answers };
    if(!recs[cid]) recs[cid]=[]; recs[cid].push(entry); saveRecords(recs);
    alert('끝! 점수: '+correct+'/'+total); renderRecords(); show('records');
  }

  function renderRecords(){
    var listEl=$('#recordsList'); var cid=$('#recChild').value || activeChildId(); var lang=$('#recLang').value || 'all'; var range=$('#recRange').value || '30';
    var recs = loadRecords()[cid] || []; var now=Date.now(); var days = range==='all'?Infinity:Number(range);
    var filtered = recs.filter(function(r){ return (lang==='all'||r.lang===lang) && (days===Infinity || now - new Date(r.date).getTime() <= days*24*60*60*1000); }).sort(function(a,b){ return b.ts-a.ts; });
    listEl.innerHTML=''; if(filtered.length===0){ listEl.innerHTML='<div class="rec-item">기록이 없습니다.</div>'; return; }
    filtered.forEach(function(r){
      var wrap=document.createElement('div'); wrap.className='rec-item';
      var head=document.createElement('div'); head.className='rec-head';
      var date=new Date(r.date);
      var meta=document.createElement('div'); meta.className='meta'; meta.textContent = date.toLocaleString()+' · '+r.lang.toUpperCase()+' · '+r.level+'급 · '+(r.mode==='drill'?'실전':'입력');
      var score=document.createElement('div'); score.innerHTML = '<span class="badge"><strong>'+r.correct+'</strong> / '+r.total+'</span>';
      head.appendChild(meta); head.appendChild(score);
      var details=document.createElement('div'); details.className='rec-details';
      var text = r.details.map(function(d,i){ var mark=d.ok?'✔':'✘'; return (String(i+1).padStart(2,'0'))+'. ['+mark+'] '+(d.a?('입력: '+d.a+'\\n    '):'')+'정답: '+d.q; }).join('\\n');
      details.textContent = text;
      wrap.appendChild(head); wrap.appendChild(details); listEl.appendChild(wrap);
    });
  }
  $('#recChild').addEventListener('change', renderRecords);
  $('#recLang').addEventListener('change', renderRecords);
  $('#recRange').addEventListener('change', renderRecords);

  // ---------- Init ----------
  function init(){ renderChildSelects(); $('#recChild').value = activeChildId(); loadData(); loadVoicesIntoState(); renderRecords(); }
  document.addEventListener('DOMContentLoaded', init);
})();
