// ==========================================================
//  duty.js — เวรประจำวัน
// ==========================================================
const isDoneStatus = v => v === 'ทำเวร' || v === true;

async function loadDutyData() {
    const [duties, regs, checks] = await Promise.all([
        _supabase.from('duties').select('*').order('id'),
        _supabase.from('duty_registrations').select('*'),
        _supabase.from('duty_checklist').select('*')
    ]);
    dutiesConfig = duties.data || [];
    dutyRegistrations = regs.data || [];
    doneChecklistData = checks.data || [];

    renderDutyInterface();
    renderDutySummaryForStudents();
}

// ผลเช็กล่าสุดของแต่ละคน (กันข้อมูลซ้ำที่สะสมจากเวอร์ชันเก่า)
function latestChecklistByStudent() {
    const map = new Map();
    doneChecklistData.forEach(c => {
        const key = String(c.student_id);
        const prev = map.get(key);
        if (!prev || new Date(c.created_at) >= new Date(prev.created_at)) map.set(key, c);
    });
    return map;
}

function computeDutyStats() {
    const latest = [...latestChecklistByStudent().values()];
    const done = latest.filter(c => isDoneStatus(c.is_done));
    const perDay = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };
    done.forEach(c => {
        const k = String(c.day_name_en || '').toLowerCase().substring(0, 3);
        if (k in perDay) perDay[k]++;
    });
    const registered = dutyRegistrations.length;
    const percent = registered > 0 ? Math.min(100, Math.round((done.length / registered) * 100)) : 0;
    return { perDay, percent };
}

function renderDutySummaryForStudents() {
    const percentEl = document.getElementById('duty-summary-weekly-percent');
    if (!percentEl) return;
    const stats = computeDutyStats();
    ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(d => {
        const el = document.getElementById(`duty-summary-${d}-count`);
        if (el) el.innerText = stats.perDay[d] + ' คน';
    });
    percentEl.innerText = stats.percent + '%';
}

function renderDutyInterface() {
    const grid = document.getElementById('duty-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const myReg = dutyRegistrations.find(r => String(r.student_id) === String(userData.student_id));
    const mySelectedDay = myReg ? myReg.day_name_en.toLowerCase() : null;

    document.getElementById('duty-checklist-box').classList.remove('hidden');

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = daysOfWeek[new Date().getDay()];

    if (myReg && myReg.day_name_en.toLowerCase() === today) {
        document.getElementById('current-day-badge').innerText = `วัน${myReg.day_name_th || myReg.day_name_en}`;
        setDutyChecklistLocked(false);
        renderDutyChecklist(myReg.day_name_en);
    } else if (myReg) {
        const dn = myReg.day_name_th || myReg.day_name_en;
        document.getElementById('current-day-badge').innerText = `วัน${dn}`;
        setDutyChecklistLocked(true, `ยังไม่ถึงวัน${dn} จึงยังเช็กชื่อไม่ได้`);
    } else {
        document.getElementById('current-day-badge').innerText = '---';
        setDutyChecklistLocked(true, 'คุณยังไม่ได้ลงทะเบียนเวร กรุณาเลือกวันเวรของคุณด้านล่างก่อน');
    }

    dutiesConfig.forEach(day => {
        const dayEn = day.day_name_en.toLowerCase();
        const workers = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === dayEn);
        const isMyDay = mySelectedDay === dayEn;

        let btn = `<button onclick="selectDuty('${esc(day.day_name_en)}')" class="btn btn-gold btn-block btn-sm">เลือกเวรวันนี้</button>`;
        if (isMyDay) {
            btn = `<button onclick="cancelDuty()" class="btn btn-danger btn-block btn-sm"><i class="fa-solid fa-trash-can"></i> ยกเลิกเวร</button>`;
        } else if (mySelectedDay || workers.length >= day.max_slots) {
            btn = `<button disabled class="btn btn-ghost btn-block btn-sm">เต็ม / เลือกวันอื่นแล้ว</button>`;
        }

        const list = workers.length === 0
            ? '<p class="faint italic py-2 text-[11px]">ยังไม่มีสมาชิก</p>'
            : workers.map(w => {
                const me = String(w.student_id) === String(userData.student_id);
                return `<div class="member ${me ? 'me' : ''}">
                    <span class="truncate"><i class="fa-solid fa-user text-[10px] mr-1" style="opacity:.6"></i> ${esc(w.student_name)}</span>
                    ${me ? '<span class="text-[9px]">คุณ</span>' : ''}
                </div>`;
            }).join('');

        const card = document.createElement('div');
        card.className = `card duty-card ${isMyDay ? 'mine' : ''}`;
        card.innerHTML = `
            <div>
                <span class="day-chip">วัน${esc(day.day_name_th)}</span>
                <div class="text-[10px] muted mb-4 mt-3 tracking-widest">สมาชิก (${workers.length}/${Number(day.max_slots)})</div>
                <div class="custom-scrollbar" style="max-height:160px">${list}</div>
            </div>
            <div class="mt-5">${btn}</div>`;
        grid.appendChild(card);
    });
}

function setDutyChecklistLocked(isLocked, message) {
    const box = document.getElementById('my-day-checklist-items');
    const submit = document.getElementById('duty-submit-btn');
    if (isLocked) {
        box.innerHTML = `
            <div class="flex flex-col items-center text-center py-8 gap-3">
                <div class="ring"><i class="fa-solid fa-lock"></i></div>
                <p class="text-xs muted" style="max-width:260px">${esc(message)}</p>
            </div>`;
        submit.classList.add('hidden');
    } else {
        submit.classList.remove('hidden');
    }
}

function buildDutyPillGroupHTML(uid, state) {
    const pill = (val, label, cls) => {
        const valAttr = typeof val === 'boolean' ? val : `'${val}'`;
        return `<button type="button" onclick="setDutyState('${esc(uid)}', ${valAttr})" class="${state === val ? cls : ''}">${label}</button>`;
    };
    return pill(true, 'ทำแล้ว', 'p-ok') + pill(false, 'ไม่ทำ', 'p-no') + pill('leave', 'ลา', 'p-leave');
}

function renderDutyChecklist(targetDayEn) {
    const container = document.getElementById('my-day-checklist-items');
    container.innerHTML = '';
    const teammates = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === targetDayEn.toLowerCase());

    teammates.forEach(tm => {
        if (localChecklistState[tm.student_id] === undefined) localChecklistState[tm.student_id] = true;
        const item = document.createElement('div');
        item.className = 'inset p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3';
        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="avatar">${esc((tm.student_name || '?').charAt(0))}</div>
                <div>
                    <p class="text-xs font-semibold">${esc(tm.student_name)}</p>
                    <p class="text-[10px] muted">ID: ${esc(tm.student_id)}</p>
                </div>
            </div>
            <div id="pill-group-${esc(tm.student_id)}" class="pill3 w-full sm:w-52">${buildDutyPillGroupHTML(tm.student_id, localChecklistState[tm.student_id])}</div>`;
        container.appendChild(item);
    });
}

function setDutyState(uid, val) {
    localChecklistState[uid] = val;
    const wrap = document.getElementById(`pill-group-${uid}`);
    if (wrap) wrap.innerHTML = buildDutyPillGroupHTML(uid, val);
}

async function submitDutyReport() {
    const myReg = dutyRegistrations.find(r => String(r.student_id) === String(userData.student_id));
    if (!myReg) return;

    const teammates = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === myReg.day_name_en.toLowerCase());
    const now = new Date().toISOString();
    const lines = [], rows = [];

    teammates.forEach((tm, idx) => {
        const s = localChecklistState[tm.student_id];
        const status = s === false ? 'ไม่ทำเวร' : (s === 'leave' ? 'ลา' : 'ทำเวร');
        lines.push(`${idx + 1}.${tm.student_name} ${status}`);
        rows.push({ student_id: tm.student_id, student_name: tm.student_name, day_name_en: myReg.day_name_en, is_done: status, created_at: now });
    });

    // ลบผลเก่าของคนกลุ่มนี้ก่อน เพื่อให้กดบันทึกซ้ำได้โดยตัวเลขไม่เบิ้ล
    await _supabase.from('duty_checklist').delete().in('student_id', teammates.map(t => t.student_id));
    const { error } = await _supabase.from('duty_checklist').insert(rows);
    if (error) {
        console.error('duty_checklist insert error:', error);
        return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    }

    document.getElementById('report-text-output').value = lines.join('\n');
    document.getElementById('copy-report-modal').classList.remove('hidden');
    await loadDutyData();
}

function executeCopyText() {
    const ta = document.getElementById('report-text-output');
    const done = () => {
        showAlert('คัดลอกสำเร็จ', 'คัดลอกรายงานไปยังคลิปบอร์ดเรียบร้อยแล้ว', 'success');
        document.getElementById('copy-report-modal').classList.add('hidden');
    };
    ta.select(); ta.setSelectionRange(0, 99999);
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(done, () => { document.execCommand('copy'); done(); });
    } else { document.execCommand('copy'); done(); }
}

async function selectDuty(dayNameEn) {
    // ตรวจที่ว่างจริงจากฐานข้อมูลอีกรอบ กันสองคนกดพร้อมกันจนเกินจำนวน
    const { data: regs } = await _supabase.from('duty_registrations').select('*');
    dutyRegistrations = regs || [];
    if (dutyRegistrations.some(r => String(r.student_id) === String(userData.student_id))) {
        await loadDutyData();
        return showAlert('แจ้งเตือน', 'คุณลงทะเบียนเวรไว้แล้ว', 'warning');
    }
    const cfg = dutiesConfig.find(d => d.day_name_en.toLowerCase() === dayNameEn.toLowerCase());
    const taken = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === dayNameEn.toLowerCase()).length;
    if (cfg && taken >= cfg.max_slots) {
        await loadDutyData();
        return showAlert('เต็มแล้ว', 'วันนี้มีคนลงทะเบียนเต็มแล้ว กรุณาเลือกวันอื่น', 'error');
    }

    const { error } = await _supabase.from('duty_registrations').insert([{ student_id: userData.student_id, student_name: userData.name, day_name_en: dayNameEn }]);
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    showAlert('สำเร็จ', 'ลงทะเบียนเวรประจำวันเรียบร้อยแล้ว', 'success');
    loadDutyData();
}

async function cancelDuty() {
    const { error } = await _supabase.from('duty_registrations').delete().eq('student_id', userData.student_id);
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    showAlert('สำเร็จ', 'ยกเลิกการลงทะเบียนเวรเรียบร้อยแล้ว', 'success');
    localChecklistState = {};
    loadDutyData();
}
