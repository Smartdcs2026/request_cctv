// ================================
// CCTV Request - Frontend (GitHub Pages)
// ================================

// ✅ Apps Script Web App URL (ต้องลงท้ายด้วย /exec)
const SCRIPT_API = "https://script.google.com/macros/s/AKfycbzwB_64GAHsFLpdzQVMoqhdAGr3OX-0fEJku0KoW8bATlFzcIRhGRRBc98CvfjuGFSV/exec";

// ✅ Cloudflare Worker Proxy (แก้ CORS)
const WORKER_PROXY = "https://rough-paper-094d.somchaibutphon.workers.dev/";

// ✅ ใช้งานจริง: แนะนำให้ใช้ Worker
const API_BASE = WORKER_PROXY; // หรือเปลี่ยนเป็น SCRIPT_API ถ้าไม่ติด CORS

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

// -----------------------------
// UI helpers
// -----------------------------
function setStatus(type, msg){
  statusBox.classList.remove('ok','err','warn');
  if(type === 'ok') statusBox.classList.add('ok');
  if(type === 'err') statusBox.classList.add('err');
  if(type === 'warn') statusBox.classList.add('warn');
  statusBox.textContent = msg;
}
function setPill(text){
  if(pillText) pillText.textContent = text;
}
function setFormDisabled(disabled){
  const els = document.querySelectorAll('#cctvForm input, #cctvForm select, #cctvForm textarea, #cctvForm button');
  els.forEach(el => {
    if(el.id === 'btnReload') return;
    el.disabled = disabled;
  });
}
function normalizeText(v){ return String(v ?? '').trim(); }
function escapeHtml(s){
  const str = String(s ?? '');
  return str.replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

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

function getCaseValue(){
  const selected = normalizeText(caseSelect.value);
  if(selected === '__OTHER__') return normalizeText(caseOtherInput.value);
  return selected;
}
function getDepartmentValue(){
  const selected = normalizeText(departSelect.value);
  if(selected === '__OTHER__') return normalizeText(departOtherInput.value);
  return selected;
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
function focusField(id){
  const el = $(id);
  if(el){
    el.focus();
    if(el.select) el.select();
  }
}

// -----------------------------
// Validate
// -----------------------------
function validate(){
  const cse = getCaseValue();
  const name = normalizeText($('requesterName').value);
  const dept = getDepartmentValue();
  const reason = normalizeText($('reason').value);
  const result = normalizeText($('result').value);
  const approver = normalizeText(approverSelect.value);

  if(!normalizeText(caseSelect.value)) { focusField('caseSelect'); return 'กรุณาเลือกหัวข้อหลัก'; }
  if(normalizeText(caseSelect.value)==='__OTHER__' && !cse) { focusField('caseOther'); return 'กรุณากรอกหัวข้อหลัก (อื่นๆ)'; }

  if(!name) { focusField('requesterName'); return 'กรุณากรอกชื่อผู้ขอตรวจสอบ'; }

  if(!normalizeText(departSelect.value)) { focusField('departmentSelect'); return 'กรุณาเลือกแผนก'; }
  if(normalizeText(departSelect.value)==='__OTHER__' && !dept) { focusField('departmentOther'); return 'กรุณากรอกชื่อแผนก (อื่นๆ)'; }

  if(!reason) { focusField('reason'); return 'กรุณากรอกสาเหตุที่ขอตรวจสอบ'; }

  if(!result) { focusField('result'); return 'กรุณากรอกผลการตรวจสอบ'; }
  if(result.length < 12) { focusField('result'); return `ผลการตรวจสอบต้องมีอย่างน้อย 12 ตัวอักษร (ตอนนี้ ${result.length})`; }

  if(!approver) { focusField('approverSelect'); return 'กรุณาเลือกผู้ที่อนุมัติการตรวจ'; }

  return '';
}

// -----------------------------
// Counter
// -----------------------------
function updateResultHint(){
  const len = normalizeText(resultEl.value).length;
  if(resultHint){
    resultHint.textContent = `ขั้นต่ำ 12 ตัวอักษร (ตอนนี้ ${len})`;
    resultHint.style.color = (len >= 12) ? '#16a34a' : '#b45309';
  }
}

// -----------------------------
// API helpers (GET/POST)
// -----------------------------
function buildUrl(base, pathOrQuery){
  // รองรับ base มี / หรือไม่มี /
  if(base.endsWith('/')) return base + pathOrQuery.replace(/^\//,'');
  return base + '/' + pathOrQuery.replace(/^\//,'');
}

async function apiGet(action){
  const url = buildUrl(API_BASE, `?action=${encodeURIComponent(action)}`);
  const r = await fetch(url, { method:'GET', redirect:'follow' });

  const text = await r.text();
  let j;
  try{ j = JSON.parse(text); }
  catch(e){ throw new Error("API ไม่ได้ส่ง JSON: " + text.slice(0,120)); }

  if(!j.ok) throw new Error(j.message || 'โหลดข้อมูลไม่สำเร็จ');
  return j.data || [];
}

async function apiPostSave(payload){
  const url = buildUrl(API_BASE, '');
  const r = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await r.json();
  return j;
}

// -----------------------------
// Loading dropdowns
// -----------------------------
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
    setStatus('err', 'สถานะ: โหลดรายการไม่สำเร็จ\nกรุณากด “โหลดรายการใหม่”');
  }
}

async function loadDropdowns(){
  if(isLoadingLists) return;

  startLoading();
  try{
    const [cases, departs, approvers] = await Promise.all([
      apiGet('cases'),
      apiGet('departments'),
      apiGet('approvers')
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
  }
}

// -----------------------------
// SweetAlert
// -----------------------------
function showSavedAlertCenter(data){
  const html = `
    <div class="swal-kv">
      <div class="swal-k">วันที่เวลา</div><div class="swal-v">${escapeHtml(data.timestamp || '-')}</div>
      <div class="swal-k">หัวข้อหลัก</div><div class="swal-v">${escapeHtml(data.caseTitle || '-')}</div>
      <div class="swal-k">ชื่อผู้ขอตรวจ</div><div class="swal-v">${escapeHtml(data.requesterName || '-')}</div>
      <div class="swal-k">แผนก</div><div class="swal-v">${escapeHtml(data.department || '-')}</div>
      <div class="swal-k">ผู้อนุมัติ</div><div class="swal-v">${escapeHtml(data.approver || '-')}</div>
    </div>
    <div class="swal-note"><b>สาเหตุ</b><br>${escapeHtml(data.reason || '-')}</div>
    <div class="swal-note"><b>ผลการตรวจสอบ</b><br>${escapeHtml(data.result || '-')}</div>
  `;
  return Swal.fire({
    icon: undefined,
    iconHtml: '',
    title: 'บันทึกสำเร็จ',
    html,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: '#2563eb',
    width: 720,
    scrollbarPadding: false,
    customClass: { popup: 'swal-noicon-popup' }
  });
}

// -----------------------------
// Clear after save/reset
// -----------------------------
function clearAfterSave(){
  $('cctvForm').reset();

  caseOtherWrap.classList.add('hidden');
  caseOtherInput.required = false;
  caseOtherInput.value = '';

  departOtherWrap.classList.add('hidden');
  departOtherInput.required = false;
  departOtherInput.value = '';

  caseSelect.value = '';
  departSelect.value = '';
  approverSelect.value = '';

  setStatus('', 'สถานะ: พร้อมกรอกข้อมูล');
  setPill('พร้อมใช้งาน');

  updateResultHint();
  setTimeout(()=> $('requesterName').focus(), 0);
}

function resetForm(){ clearAfterSave(); }

// -----------------------------
// Submit save
// -----------------------------
async function submitForm(){
  if(isLoadingLists || isSaving){
    setStatus('warn', 'สถานะ: ระบบกำลังทำงาน กรุณารอสักครู่');
    return;
  }

  const msg = validate();
  if(msg){
    setStatus('err', msg);
    return;
  }

  const payload = {
    caseTitle: getCaseValue(),
    requesterName: normalizeText($('requesterName').value),
    department: getDepartmentValue(),
    reason: normalizeText($('reason').value),
    result: normalizeText($('result').value),
    approver: normalizeText(approverSelect.value)
  };

  isSaving = true;
  btnSave.disabled = true;

  btnSave.textContent = 'กำลังบันทึก…';
  setFormDisabled(true);
  setStatus('', 'สถานะ: กำลังบันทึกข้อมูล…');

  try{
    const res = await apiPostSave(payload);

    if(res && res.ok){
      setStatus('ok', `บันทึกสำเร็จ\nเวลา: ${res.timestamp}`);

      try{ await showSavedAlertCenter({ ...payload, timestamp: res.timestamp }); }
      catch(e){ console.warn('SweetAlert error:', e); }

      clearAfterSave();
    }else{
      setStatus('err', (res && res.message) ? res.message : 'บันทึกไม่สำเร็จ');
    }
  }catch(err){
    setStatus('err', 'เกิดข้อผิดพลาด: ' + (err?.message || err));
  }finally{
    isSaving = false;
    btnSave.disabled = false;
    btnSave.textContent = 'บันทึกข้อมูล';
    setFormDisabled(false);
  }
}

// -----------------------------
// Events + Init
// -----------------------------
function reloadLists(){ loadDropdowns(); }

caseSelect.addEventListener('change', ()=> toggleOther(caseSelect, caseOtherWrap, caseOtherInput));
departSelect.addEventListener('change', ()=> toggleOther(departSelect, departOtherWrap, departOtherInput));

resultEl.addEventListener('input', updateResultHint);

btnSave.addEventListener('click', submitForm);
btnReset.addEventListener('click', resetForm);
btnReload.addEventListener('click', reloadLists);

document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if(tag === 'textarea') return;
    e.preventDefault();
  }
});

// Init placeholders + load
fillSelect(caseSelect, [], 'กำลังโหลดหัวข้อ…');
fillSelect(departSelect, [], 'กำลังโหลดแผนก…');
approverSelect.innerHTML = '<option value="">กำลังโหลดผู้อนุมัติ…</option>';

updateResultHint();
loadDropdowns();

