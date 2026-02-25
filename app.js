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

// ================================
// IMAGE UPLOAD (2 slots + add up to 6)
// ================================
const uploadSlotsEl = $('uploadSlots');
const previewGridEl = $('previewGrid');
const btnAddImage = $('btnAddImage');
const uploadErrorEl = $('uploadError');

let imageIds = [];          // เก็บ fileId ที่อัปแล้ว
let slotCount = 0;
const MAX_IMAGES = 6;

function setUploadError(show, msg){
  if(!uploadErrorEl) return;
  if(show){
    uploadErrorEl.textContent = msg || 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป';
    uploadErrorEl.classList.remove('hidden');
  }else{
    uploadErrorEl.classList.add('hidden');
  }
}

function guessExt(mime){
  if(mime === 'image/png') return 'png';
  if(mime === 'image/webp') return 'webp';
  return 'jpg';
}

// ✅ compress รูปด้วย canvas ลดขนาด/น้ำหนัก (เสถียรกว่า)
async function compressImage(file, maxW = 1280, quality = 0.82){
  const mimeIn = file.type || 'image/jpeg';
  const img = await new Promise((resolve, reject)=>{
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = ()=>{ URL.revokeObjectURL(url); resolve(i); };
    i.onerror = reject;
    i.src = url;
  });

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const scale = Math.min(1, maxW / w);
  const outW = Math.round(w * scale);
  const outH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, outW, outH);

  // บังคับออกเป็น jpeg จะคุมขนาดง่าย
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1];

  return {
    name: (file.name || `cctv_${Date.now()}.${guessExt(mimeIn)}`),
    mimeType: 'image/jpeg',
    dataBase64: base64
  };
}

// --- API helpers ---
function buildUrl(base, qs){
  const b = String(base || '').replace(/\/+$/, '');
  return b + qs;
}

async function apiPost(action, payload){
  const url = buildUrl(API_BASE, `/?action=${encodeURIComponent(action)}`);
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  let j;
  try{ j = JSON.parse(text); }
  catch(e){ throw new Error('API ไม่ได้ส่ง JSON: ' + text.slice(0,120)); }

  if(!j.ok) throw new Error(j.message || 'ทำรายการไม่สำเร็จ');
  return j;
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

// ================================
// Preview UI
// ================================
function renderPreview(){
  if(!previewGridEl) return;

  previewGridEl.innerHTML = '';
  imageIds.forEach((id, idx)=>{
    const url = `https://lh5.googleusercontent.com/d/${id}`;
    const div = document.createElement('div');
    div.className = 'previewItem';
    div.innerHTML = `
      <button class="btnRemove" type="button" title="ลบรูป" data-idx="${idx}">×</button>
      <img src="${url}" alt="preview">
      <div class="previewMeta">รูปที่ ${idx+1} • ${id}</div>
    `;
    previewGridEl.appendChild(div);
  });

  // remove
  previewGridEl.querySelectorAll('.btnRemove').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = parseInt(btn.getAttribute('data-idx'), 10);
      imageIds.splice(i, 1);
      renderPreview();
      setUploadError(imageIds.length < 1, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
    });
  });
}

function makeSlot(title){
  if(!uploadSlotsEl) return;

  slotCount++;
  const slotIndex = slotCount;

  const slot = document.createElement('div');
  slot.className = 'slot';
  slot.innerHTML = `
    <div class="slotLeft">
      <div class="slotTitle">${title}</div>
      <div class="slotSub" id="slotSub_${slotIndex}">ยังไม่ได้เลือกไฟล์</div>
    </div>
    <input id="file_${slotIndex}" type="file" accept="image/*">
  `;

  const fileInput = slot.querySelector(`#file_${slotIndex}`);
  const sub = slot.querySelector(`#slotSub_${slotIndex}`);

  fileInput.addEventListener('change', async ()=>{
    const file = fileInput.files && fileInput.files[0];
    if(!file) return;

    if(imageIds.length >= MAX_IMAGES){
      fileInput.value = '';
      Swal.fire({ icon:'warning', title:'เกินจำนวนที่กำหนด', text:`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูป` });
      return;
    }

    sub.textContent = `กำลังอัปโหลด: ${file.name}`;
    setUploadError(false);

    try{
      setFormDisabled(true);
      setStatus('', 'สถานะ: กำลังอัปโหลดรูปภาพ…');

      const packed = await compressImage(file);
      const up = await apiPost('upload', { files:[packed] });
      const newId = (up.ids && up.ids[0]) ? up.ids[0] : '';

      if(!newId) throw new Error('อัปโหลดสำเร็จแต่ไม่ได้รับ ID กลับมา');

      imageIds.push(newId);
      renderPreview();
      sub.textContent = `อัปโหลดแล้ว ✓ ${file.name}`;

      setStatus('', 'สถานะ: พร้อมกรอกข้อมูล');
    }catch(err){
      console.error(err);
      sub.textContent = 'อัปโหลดไม่สำเร็จ';
      Swal.fire({ icon:'error', title:'อัปโหลดไม่สำเร็จ', text: err?.message || String(err) });
      setStatus('err', 'อัปโหลดรูปภาพไม่สำเร็จ: ' + (err?.message || err));
    }finally{
      setFormDisabled(false);
    }
  });

  uploadSlotsEl.appendChild(slot);
}

function initUploadUI(){
  if(!uploadSlotsEl || !previewGridEl || !btnAddImage) return;

  uploadSlotsEl.innerHTML = '';
  previewGridEl.innerHTML = '';
  imageIds = [];
  slotCount = 0;

  // ✅ 2 ช่องเริ่มต้น
  makeSlot('รูปภาพ #1 (จำเป็นอย่างน้อย 1)');
  makeSlot('รูปภาพ #2');

  // ✅ กัน addEventListener ซ้ำ
  btnAddImage.onclick = () => {
    if(slotCount >= MAX_IMAGES){
      Swal.fire({ icon:'warning', title:'เพิ่มไม่ได้แล้ว', text:`เพิ่มได้สูงสุด ${MAX_IMAGES} ช่อง` });
      return;
    }
    makeSlot(`รูปภาพ #${slotCount + 1}`);
  };

  setUploadError(true, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
}

// ================================
// Form state + UI helpers
// ================================
let isLoadingLists = false;
let isSaving = false;

function setStatus(type, msg){
  if(!statusBox) return;
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

function focusField(id){
  const el = $(id);
  if(el){
    el.focus();
    if(el.select) el.select();
  }
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

// ================================
// Validation
// ================================
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
  if(result.length < 12) {
    focusField('result');
    return `ผลการตรวจสอบต้องมีอย่างน้อย 12 ตัวอักษร (ตอนนี้ ${result.length})`;
  }

  if(!approver) { focusField('approverSelect'); return 'กรุณาเลือกผู้ที่อนุมัติการตรวจ'; }

  // ✅ ต้องมีอย่างน้อย 1 รูป
  if(imageIds.length < 1){
    setUploadError(true, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป');
    return 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป';
  }

  return '';
}

// ================================
// Loading dropdowns
// ================================
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
  }
}

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

// ================================
// Result hint counter
// ================================
function updateResultHint(){
  const len = normalizeText(resultEl.value).length;
  if(resultHint){
    resultHint.textContent = `ขั้นต่ำ 12 ตัวอักษร (ตอนนี้ ${len})`;
    resultHint.classList.toggle('hintOk', len >= 12);
    resultHint.classList.toggle('hintWarn', len < 12);
  }
}
if(resultEl) resultEl.addEventListener('input', updateResultHint);

// ================================
// Save / Reset
// ================================
function clearAfterSave(){
  const form = $('cctvForm');
  if(form) form.reset();

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

  // ✅ reset upload UI กลับเป็น 2 ช่อง
  initUploadUI();

  setTimeout(()=> $('requesterName')?.focus(), 0);
}

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
    approver: normalizeText(approverSelect.value),
    imageIds: imageIds.join('|') // ✅ บันทึกเป็น ID คั่นด้วย |
  };

  isSaving = true;
  btnSave.disabled = true;
  btnSave.textContent = 'กำลังบันทึก…';
  setFormDisabled(true);
  setStatus('', 'สถานะ: กำลังบันทึกข้อมูล…');

  try{
    const res = await apiPost('save', payload);

    setStatus('ok', `บันทึกสำเร็จ\nเวลา: ${res.timestamp || '-'}`);

    // popup สรุป
    try{
      await Swal.fire({
        title: 'บันทึกสำเร็จ',
        icon: 'success',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#2563eb',
        html: `
          <div style="text-align:left;font-weight:800">
            <div><b>วันที่เวลา:</b> ${res.timestamp || '-'}</div>
            <div><b>หัวข้อหลัก:</b> ${payload.caseTitle || '-'}</div>
            <div><b>ชื่อผู้ขอตรวจ:</b> ${payload.requesterName || '-'}</div>
            <div><b>แผนก:</b> ${payload.department || '-'}</div>
            <div><b>ผู้อนุมัติ:</b> ${payload.approver || '-'}</div>
            <div style="margin-top:8px"><b>จำนวนรูป:</b> ${imageIds.length}</div>
          </div>
        `
      });
    }catch(e){ /* ignore */ }

    clearAfterSave();
  }catch(err){
    console.error(err);
    setStatus('err', (err?.message || String(err) || 'บันทึกไม่สำเร็จ'));
  }finally{
    isSaving = false;
    btnSave.disabled = false;
    btnSave.textContent = 'บันทึกข้อมูล';
    setFormDisabled(false);
  }
}

function resetForm(){
  clearAfterSave();
}

// ================================
// Events + init
// ================================
caseSelect.addEventListener('change', ()=> toggleOther(caseSelect, caseOtherWrap, caseOtherInput));
departSelect.addEventListener('change', ()=> toggleOther(departSelect, departOtherWrap, departOtherInput));
btnReload.addEventListener('click', reloadLists);

if(btnSave) btnSave.addEventListener('click', submitForm);
if(btnReset) btnReset.addEventListener('click', resetForm);

// กันกด Enter แล้ว submit ใน input (ยกเว้น textarea)
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter'){
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if(tag === 'textarea') return;
    e.preventDefault();
  }
});

// init placeholders + load
fillSelect(caseSelect, [], 'กำลังโหลดหัวข้อ…');
fillSelect(departSelect, [], 'กำลังโหลดแผนก…');
approverSelect.innerHTML = '<option value="">กำลังโหลดผู้อนุมัติ…</option>';

updateResultHint();
loadDropdowns();
initUploadUI();
