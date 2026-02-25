// ================================
// CONFIG
// ================================
const API_BASE = "https://rough-paper-094d.somchaibutphon.workers.dev";

const $ = (id) => document.getElementById(id);

const caseSelect = $('caseSelect');
const caseOtherWrap = $('caseOtherWrap');
const caseOtherInput = $('caseOther');

const departSelect = $('departmentSelect');
const departOtherWrap = $('departmentOtherWrap');
const departOtherInput = $('departmentOther');

const approverSelect = $('approverSelect');

const btnSave = $('btnSave');
const btnReset = $('btnReset');
const btnReload = $('btnReload');

const statusBox = $('statusBox');
const pillText = $('pillText');

const resultEl = $('result');
const resultHint = $('resultHint');

let isLoadingLists = false;
let isSaving = false;

function setStatus(type, msg){
  statusBox.classList.remove('ok','err','warn');
  if(type === 'ok') statusBox.classList.add('ok');
  if(type === 'err') statusBox.classList.add('err');
  if(type === 'warn') statusBox.classList.add('warn');
  statusBox.textContent = msg;
}
function setPill(text){ if(pillText) pillText.textContent = text; }

function setFormDisabled(disabled){
  const els = document.querySelectorAll('#cctvForm input, #cctvForm select, #cctvForm textarea, #cctvForm button');
  els.forEach(el => {
    if(el.id === 'btnReload') return;
    el.disabled = disabled;
  });
}

function normalizeText(v){ return String(v ?? '').trim(); }

function fillSelect(selectEl, items, placeholder){
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  (items || []).forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    selectEl.appendChild(opt);
  });

  const other = document.createElement('option');
  other.value = '__OTHER__';
  other.textContent = 'อื่นๆ (กรอกเอง)';
  selectEl.appendChild(other);
}

function toggleOther(selectEl, wrapEl, inputEl){
  const v = normalizeText(selectEl.value);
  if(v === '__OTHER__'){
    wrapEl.classList.remove('hidden');
    inputEl.required = true;
    setTimeout(()=> inputEl.focus(), 0);
  }else{
    wrapEl.classList.add('hidden');
    inputEl.required = false;
    inputEl.value = '';
  }
}

function startLoading(){
  isLoadingLists = true;
  btnReload.style.display = 'none';
  setPill('กำลังโหลด…');
  setFormDisabled(true);
  setStatus('warn', 'สถานะ: กำลังโหลดรายการ…');
}
function finishLoading(ok){
  isLoadingLists = false;
  setFormDisabled(false);
  if(ok){
    setPill('พร้อมใช้งาน');
    setStatus('', 'สถานะ: พร้อมกรอกข้อมูล');
  }else{
    setPill('ต้องโหลดใหม่');
    btnReload.style.display = '';
    // status จะถูก set ใน catch เพื่อให้เห็นเหตุผลชัด ๆ
  }
}

// --- API helpers ---
function buildUrl(base, qs){
  const b = String(base || '').replace(/\/+$/, '');
  return b + qs;
}

async function apiGet(action){
  const url = buildUrl(API_BASE, `/?action=${encodeURIComponent(action)}`);
  const r = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    redirect: 'follow'
  });

  const text = await r.text();
  let j;
  try{ j = JSON.parse(text); }
  catch(e){ throw new Error('API ไม่ได้ส่ง JSON: ' + text.slice(0,120)); }

  if(!j.ok) throw new Error(j.message || 'โหลดข้อมูลไม่สำเร็จ');
  return j.data || [];
}

// --- Load dropdowns ---
async function loadDropdowns(){
  if(isLoadingLists) return;

  if(!API_BASE || API_BASE.includes('PUT_YOUR_API_BASE_URL_HERE')){
    finishLoading(false);
    setStatus('err', 'ยังไม่ได้ตั้งค่า API_BASE ใน app.js');
    return;
  }

  startLoading();
  try{
    const [cases, departs, approvers] = await Promise.all([
      apiGet('cases'),
      apiGet('departments'),
      apiGet('approvers'),
    ]);

    fillSelect(caseSelect, cases, '-- เลือกหัวข้อหลัก --');
    fillSelect(departSelect, departs, '-- เลือกแผนก --');

    approverSelect.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = '-- เลือกผู้อนุมัติ --';
    approverSelect.appendChild(o0);

    (approvers || []).forEach(n=>{
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      approverSelect.appendChild(opt);
    });

    // reset “อื่นๆ”
    caseOtherWrap.classList.add('hidden');
    caseOtherInput.required = false;
    caseOtherInput.value = '';

    departOtherWrap.classList.add('hidden');
    departOtherInput.required = false;
    departOtherInput.value = '';

    finishLoading(true);
  }catch(err){
    console.error(err);
    finishLoading(false);
    setStatus('err', 'โหลดรายการไม่สำเร็จ: ' + (err?.message || err));
  }
}

function reloadLists(){ loadDropdowns(); }

// --- Events + init ---
caseSelect.addEventListener('change', ()=> toggleOther(caseSelect, caseOtherWrap, caseOtherInput));
departSelect.addEventListener('change', ()=> toggleOther(departSelect, departOtherWrap, departOtherInput));
btnReload.addEventListener('click', reloadLists);

// init placeholders + load
fillSelect(caseSelect, [], 'กำลังโหลดหัวข้อ…');
fillSelect(departSelect, [], 'กำลังโหลดแผนก…');
approverSelect.innerHTML = '<option value="">กำลังโหลดผู้อนุมัติ…</option>';

loadDropdowns();
