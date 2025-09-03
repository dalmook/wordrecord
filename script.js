// script.js — Firebase Modular SDK + 앱 로직 (완성본)

// ===== Firebase 모듈 import =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

// ===== Firebase 초기화 =====
const firebaseConfig = {
  apiKey: "AIzaSyA4z4XncM_fVtLW_z1lNdyep8oxXUv25TQ",
  authDomain: "wordrecord-ff462.firebaseapp.com",
  projectId: "wordrecord-ff462",
  appId: "1:347551014179:web:43597188598e25e7e6c096"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
let uid = null;

// ===== 디버그 배지 & 로그 (태블릿 친화) =====
const appLog = (() => {
  let box, badge;
  function ensure(){
    if(badge) return;
    badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;background:#0f1830;padding:6px 10px;border:1px solid #22314a;border-radius:10px;font:12px/1.2 system-ui;color:#cfe0ff;opacity:0.85';
    badge.textContent = '클라우드: 확인중';
    document.body.appendChild(badge);

    box = document.createElement('div');
    box.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;max-height:40vh;overflow:auto;z-index:9999;background:#0b1220e6;border:1px solid #22314a;border-radius:10px;padding:8px;font:12px/1.4 ui-monospace;color:#cfe0ff;display:none;white-space:pre-wrap';
    document.body.appendChild(box);

    badge.addEventListener('click', () => { box.style.display = (box.style.display==='none'?'block':'none'); });
  }
  function setBadge(t){ ensure(); badge.textContent = t; }
  function log(...args){
    ensure();
    const msg = args.map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{ return String(v)}}).join(' ');
    const t = new Date().toLocaleTimeString();
    box.textContent = `[${t}] ${msg}\n` + box.textContent;
  }
  return { setBadge, log };
})();

// ===== Firebase Auth =====
onAuthStateChanged(auth, (user)=>{
  uid = user ? user.uid : null;
  appLog.setBadge(uid ? '클라우드: 로그인됨' : '클라우드: 로그인 안 됨');
  appLog.log('[Auth]', uid ? `로그인 uid=${uid}` : '로그아웃');
});

(async function ensureAnon(){
  try{
    await signInAnonymously(auth);
    appLog.log('[Auth] 익명 로그인 시도 완료');
  }catch(e){ appLog.log('[Auth] 익명 로그인 실패', e?.message); }
})();

// ===== Helper =====
const $  = (sel, el)=> (el||document).querySelector(sel);
const $$ = (sel, el)=> Array.from((el||document).querySelectorAll(sel));
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }
function normalize(t){ return (t||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function escapeHtml(s){ return (s||'').replace(/[&<>\"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]) ); }

// ===== 상태/뷰 =====
const views = { home: $('#view-home'), setup: $('#view-setup'), play: $('#view-play'), practice: $('#view-practice'), records: $('#view-records') };
function show(route){ Object.keys(views).forEach(k=>views[k].classList.remove('active')); (views[route]||views.home).classList.add('active'); }
$$('.app-icon, .topbar [data-route]').forEach(b=> b.addEventListener('click', ()=> show(b.dataset.route)) );

const MODE_STANDARD = 'standard';
const MODE_DRILL   = 'drill';
const state = {
  data: null,
  session: null,
  // standard
  lang:'ko', level:'1', count:10, rate:1.0, voices:[], voiceURI:null,
  // drill
  prLang:'ko', prLevel:'1', prCount:10, prRate:1.0
};

// ===== 아이/로컬 저장 =====
const LS_CHILDREN='sb_children', LS_RECORDS='sb_records';
function loadChildren(){ try{return JSON.parse(localStorage.getItem(LS_CHILDREN))||[]}catch{ return [] } }
function saveChildren(list){ localStorage.setItem(LS_CHILDREN, JSON.stringify(list)); }
function ensureDefaultChild(){ let l=loadChildren(); if(l.length===0){ l=[{id:crypto.randomUUID(),name:'우리집'}]; saveChildren(l);} return l; }
function renderChildSelects(){ const list=ensureDefaultChild(); ['childSelect','recChild'].forEach(id=>{ const sel=$('#'+id); if(!sel) return; sel.innerHTML=''; list.forEach(c=> sel.appendChild(new Option(c.name, c.id))); }); }
function activeChildId(){ const el=$('#childSelect'); return el?el.value:null; }
$('#addChildBtn').addEventListener('click', ()=> $('#childModal').showModal());
$('#childForm').addEventListener('submit', e=> e.preventDefault());
$('#childForm').addEventListener('click', e=>{
  if(!(e.target instanceof HTMLButtonElement)) return;
  if(e.target.value==='ok'){
    const name=$('#childNameInput').value.trim(); if(!name) return;
    const list=loadChildren(); list.push({id:crypto.randomUUID(), name}); saveChildren(list); renderChildSelects();
  }
  $('#childModal').close(); $('#childNameInput').value='';
});

// ===== 데이터 로딩 (data.json) =====
const SAMPLE={
  ko:{"1":["학교","바다","사과","친구","가족","선생님","강아지","비행기","여름","겨울"],
      "2":["오늘 날씨가 좋아요.","나는 학교에 가요.","엄마와 시장에 갔어요.","친구와 같이 놀았어요.","저는 사과를 좋아해요."]},
  en:{"1":["apple","banana","school","family","teacher","dog","plane","summer","winter","friend"],
      "2":["I like apples.","She goes to school.","We play together.","It's a sunny day.","Please open the door."]}
};
async function loadData(){
  try{
    const r=await fetch('data.json',{cache:'no-store'});
    if(!r.ok) throw 0;
    state.data = await r.json();
  }catch{ state.data=SAMPLE; }
  refreshLevels(); refreshPrLevels();
}

// ===== 음성 (Web Speech) =====
function loadVoicesIntoState(){ const vs = window.speechSynthesis ? speechSynthesis.getVoices() : []; state.voices=vs; renderVoiceSelect(); }
if('speechSynthesis' in window){ speechSynthesis.onvoiceschanged = loadVoicesIntoState; }
function renderVoiceSelect(){
  const sel=$('#voiceSelect'); if(!sel) return; sel.innerHTML='';
  const vlist=state.voices.filter(v=> state.lang==='ko' ? (v.lang||'').toLowerCase().startsWith('ko') : (v.lang||'').toLowerCase().startsWith('en'));
  sel.appendChild(new Option(vlist.length?'기본(권장)':'기기 음성 미지원',''));
  vlist.forEach(v=> sel.appendChild(new Option(`${v.name} (${v.lang})`, v.voiceURI)));
  sel.disabled = vlist.length===0;
}
function speak(text, rate, lang){
  if(!('speechSynthesis' in window)) return;
  try{
    const ut=new SpeechSynthesisUtterance(String(text));
    ut.rate=rate; ut.lang=lang;
    if(state.voiceURI){ const v=state.voices.find(v=>v.voiceURI===state.voiceURI); if(v) ut.voice=v; }
    speechSynthesis.cancel(); speechSynthesis.speak(ut);
  }catch(e){}
}

// ===== Standard(입력형) 설정/진행 =====
function refreshLevels(){
  const lv=Object.keys(state.data&&state.data[state.lang]||{}).sort((a,b)=>a-b);
  const sel=$('#levelSelect'); if(!sel) return; sel.innerHTML='';
  lv.forEach(l=> sel.appendChild(new Option(l+'급', l)));
  state.level = lv[0]||'1'; sel.value=state.level;
}
$('#rate').addEventListener('input', e=>{
  state.rate=Number(e.target.value);
  $('#rateVal').textContent=state.rate.toFixed(1)+'×';
  $('#rateInPlay').value=state.rate; $('#rateVal2').textContent=state.rate.toFixed(1)+'×';
});
$('#rateInPlay').addEventListener('input', e=>{
  state.rate=Number(e.target.value);
  $('#rateVal2').textContent=state.rate.toFixed(1)+'×';
  $('#rate').value=state.rate; $('#rateVal').textContent=state.rate.toFixed(1)+'×';
});
$('#countSelect').addEventListener('change', e=> state.count=Number(e.target.value));
$('#levelSelect').addEventListener('change', e=> state.level=e.target.value);
$('#voiceSelect').addEventListener('change', e=> state.voiceURI=e.target.value||null);
$$('#langButtons .seg').forEach(b=> b.addEventListener('click', ()=>{
  $$('#langButtons .seg').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); state.lang=b.dataset.lang; refreshLevels(); renderVoiceSelect();
}));
$('#startBtn').addEventListener('click', startSession);

function startSession(){
  const items=(state.data&&state.data[state.lang]&&state.data[state.lang][state.level]||[]).slice();
  if(items.length===0){ alert('선택한 급수의 문제가 없습니다.'); return; }
  shuffle(items); const qs=items.slice(0,Math.min(state.count,items.length));
  state.session={items:qs, idx:0, answers:[], childId:activeChildId(), lang:state.lang, level:state.level, mode:MODE_STANDARD};
  $('#progNow').textContent='1'; $('#progTotal').textContent=String(qs.length); $('#qNum').textContent='1';
  $('#answerInput').value=''; setFeedback('', ''); show('play');
}
$('#replayBtn').addEventListener('click', ()=>{
  const s=state.session; if(!s) return; const q=s.items[s.idx];
  speak(q, state.rate, s.lang==='ko'?'ko-KR':'en-US');
});
$('#checkBtn').addEventListener('click', ()=>{
  const s=state.session; if(!s) return; const q=s.items[s.idx];
  const a=$('#answerInput').value.trim(); const ok=normalize(a)===normalize(q);
  s.answers[s.idx]={q,a,ok};
  setFeedback(ok? '정답! 잘했어요 👍':`오답이에요 😅\n정답: ${q}`, ok?'ok':'no');
});
$('#nextBtn').addEventListener('click', ()=>{
  const s=state.session; if(!s) return;
  if(!s.answers[s.idx]){ const q=s.items[s.idx]; const a=$('#answerInput').value.trim(); s.answers[s.idx]={q,a,ok:normalize(a)===normalize(q)}; }
  s.idx++;
  if(s.idx>=s.items.length){ finishSession(); return; }
  $('#progNow').textContent=String(s.idx+1); $('#qNum').textContent=String(s.idx+1);
  $('#answerInput').value=''; setFeedback('', ''); $('#answerInput').focus();
});

// ===== Practice(실전쓰기) =====
function refreshPrLevels(){
  const lv=Object.keys(state.data&&state.data[state.prLang]||{}).sort((a,b)=>a-b);
  const sel=$('#prLevelSelect'); if(!sel) return; sel.innerHTML='';
  lv.forEach(l=> sel.appendChild(new Option(l+'급', l)));
  state.prLevel = lv[0]||'1'; sel.value=state.prLevel;
}
$$('#prLangButtons .seg').forEach(b=> b.addEventListener('click', ()=>{
  $$('#prLangButtons .seg').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); state.prLang=b.dataset.lang; refreshPrLevels();
}));
$('#prCountSelect').addEventListener('change', e=> state.prCount=Number(e.target.value));
$('#prRate').addEventListener('input', e=>{ state.prRate=Number(e.target.value); $('#prRateVal').textContent=state.prRate.toFixed(1)+'×'; });
$('#prStartBtn').addEventListener('click', startDrill);

function startDrill(){
  const items=(state.data&&state.data[state.prLang]&&state.data[state.prLang][state.prLevel]||[]).slice();
  if(items.length===0){ alert('선택한 급수의 문제가 없습니다.'); return; }
  shuffle(items); const qs=items.slice(0,Math.min(state.prCount,items.length));
  state.session={items:qs, idx:0, answers:Array(qs.length).fill(null), childId:activeChildId(), lang:state.prLang, level:state.prLevel, mode:MODE_DRILL};
  renderDrillList(); show('practice');
}

function renderDrillList(){
  const list=$('#drillList'); if(!list) return; list.innerHTML='';
  const s=state.session; if(!s) return;
  s.items.forEach((q,i)=>{
    const row=document.createElement('div'); row.className='drill-item'; row.dataset.idx=String(i);
    row.innerHTML = `
      <button class="btn round play" aria-label="재생" data-idx="${i}">▶</button>
      <div class="qbody">
        <div class="qmeta">문제 ${i+1}</div>
        <div class="answer">정답: <span>${escapeHtml(String(q))}</span></div>
        <div class="mark segmented tiny" role="group">
          <button class="seg" data-ok="1">정답</button>
          <button class="seg" data-ok="0">오답</button>
        </div>
      </div>`;
    list.appendChild(row);
  });
  list.onclick=(e)=>{
    const btn=e.target.closest('button'); if(!btn) return;
    const item=btn.closest('.drill-item'); const idx=Number(item?.dataset?.idx||0); const q=state.session.items[idx];
    if(btn.classList.contains('play')){
      speak(String(q), state.prRate, state.prLang==='ko'?'ko-KR':'en-US');
    } else if(typeof btn.dataset.ok!=='undefined'){
      const ok = btn.dataset.ok==='1'; state.session.answers[idx]={q, a:null, ok};
      item.querySelectorAll('[data-ok]').forEach(b=> b.classList.remove('active'));
      btn.classList.add('active');
    }
  };
}

// 채점/저장 버튼
function gradeDrill(autoFill){
  const s=state.session; if(!s || s.mode!==MODE_DRILL){ alert('실전쓰기 세션이 없습니다.'); return null; }
  const total=s.items.length; let correct=0, unmarked=0;
  for(let i=0;i<total;i++){
    const cur=s.answers[i];
    if(!cur){ if(autoFill){ s.answers[i]={q:s.items[i], a:null, ok:false}; } else { unmarked++; continue; } }
    if(s.answers[i] && s.answers[i].ok) correct++;
  }
  return { total, correct, unmarked };
}
$('#drillGradeBtn').addEventListener('click', ()=>{
  const r=gradeDrill(false); if(!r) return;
  alert(`실전쓰기 채점: ${r.correct} / ${r.total}` + (r.unmarked?` (미표시 ${r.unmarked}개)`:'') );
});
$('#drillSaveBtn').addEventListener('click', ()=>{
  const r=gradeDrill(true); if(!r) return;
  finishSession();
});

// ===== 기록 (local + Firestore) =====
function loadRecords(){ try { return JSON.parse(localStorage.getItem(LS_RECORDS)) || {}; } catch{ return {}; } }
function saveRecords(obj){ localStorage.setItem(LS_RECORDS, JSON.stringify(obj)); }

async function finishSession(){
  const s=state.session; if(!s) return;
  if(s.mode===MODE_DRILL){ gradeDrill(true); } // 미표시 자동 오답 처리
  const total=s.items.length; const correct=(s.answers||[]).filter(x=>x&&x.ok).length;
  const cid=s.childId||ensureDefaultChild()[0].id;
  const entry={ ts:Date.now(), date:new Date().toISOString(), lang:s.lang, level:s.level, total, correct, mode:s.mode||MODE_STANDARD, details:s.answers, childId:cid };

  // local
  const recs=loadRecords(); if(!recs[cid]) recs[cid]=[]; recs[cid].push(entry); saveRecords(recs);

  // cloud
  if(uid){
    try{
      await addDoc(collection(db,'records'), Object.assign({uid}, entry));
      appLog.log('[Firestore] 저장 성공', {score: `${entry.correct}/${entry.total}`, mode: entry.mode});
    }catch(e){ appLog.log('[Firestore] 저장 실패', e?.message); }
  } else {
    appLog.log('[Firestore] 저장 생략 (uid 없음)');
  }

  alert(`끝! 점수: ${correct}/${total}`);
  renderRecords();
  show('records');
}

async function fetchCloudRecords(cid, cb){
  if(!uid){ cb(null); return; }
  try{
    const q = query(
      collection(db,'records'),
      where('uid','==',uid),
      where('childId','==',cid),
      orderBy('ts','desc'),
      limit(200)
    );
    const snap = await getDocs(q);
    const arr=[]; snap.forEach(doc=> arr.push(doc.data()));
    cb(arr);
  }catch(e){ appLog.log('[Firestore] 조회 실패', e?.message); cb(null); }
}

function renderRecords(){
  const listEl=$('#recordsList');
  const cid=$('#recChild').value||activeChildId();
  const lang=$('#recLang').value||'all';
  const range=$('#recRange').value||'30';
  const now=Date.now();
  const days = range==='all'?Infinity:Number(range);
  const local = (loadRecords()[cid]||[]);

  function paint(items){
    const filtered = items
      .filter(r => (lang==='all'||r.lang===lang) && (days===Infinity || now - new Date(r.date).getTime() <= days*24*60*60*1000))
      .sort((a,b)=> b.ts-a.ts);
    listEl.innerHTML='';
    if(filtered.length===0){ listEl.innerHTML='<div class="rec-item">기록이 없습니다.</div>'; return; }
    filtered.forEach(r=>{
      const wrap=document.createElement('div'); wrap.className='rec-item';
      const head=document.createElement('div'); head.className='rec-head';
      const date=new Date(r.date);
      const meta=document.createElement('div'); meta.className='meta';
      meta.textContent = `${date.toLocaleString()} · ${r.lang.toUpperCase()} · ${r.level}급 · ${r.mode==='drill'?'실전':'입력'}`;
      const score=document.createElement('div'); score.innerHTML=`<span class="badge"><strong>${r.correct}</strong> / ${r.total}</span>`;
      head.appendChild(meta); head.appendChild(score);
      const details=document.createElement('div'); details.className='rec-details';
      const text = (r.details||[]).map((d,i)=>{
        const mark=d&&d.ok?'✔':'✘';
        return `${String(i+1).padStart(2,'0')}. [${mark}] ${d&&d.a?`입력: ${d.a}\n    `:''}정답: ${d&&d.q||''}`;
      }).join('\n');
      details.textContent=text;
      wrap.appendChild(head); wrap.appendChild(details);
      listEl.appendChild(wrap);
    });
  }

  if(uid){ fetchCloudRecords(cid, cloud => { if(Array.isArray(cloud)) paint(cloud); else paint(local); }); }
  else { paint(local); }
}
$('#recChild').addEventListener('change', renderRecords);
$('#recLang').addEventListener('change', renderRecords);
$('#recRange').addEventListener('change', renderRecords);

// ===== UI utils =====
function setFeedback(text, kind){
  const fb=$('#feedback'); if(!fb) return;
  if(!text){ fb.textContent=''; fb.className='feedback'; return; }
  if(kind==='ok'){ fb.textContent=text; fb.className='feedback ok'; }
  else if(kind==='no'){
    fb.innerHTML=`오답이에요 😅<br>정답: <strong>${escapeHtml(text.replace(/^오답.+정답:\s*/,'').trim())}</strong>`;
    fb.className='feedback no';
  } else { fb.textContent=text; fb.className='feedback'; }
}

// ===== Init =====
function init(){
  renderChildSelects();
  const rc=$('#recChild'); if(rc) rc.value=activeChildId();
  loadData();
  loadVoicesIntoState();
  renderRecords();
}
document.addEventListener('DOMContentLoaded', init);
