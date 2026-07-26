async function loadDutyData() {
    const { data: duties } = await _supabase.from('duties').select('*').order('id');
    dutiesConfig = duties || [];
    const { data: regs } = await _supabase.from('duty_registrations').select('*');
    dutyRegistrations = regs || [];
    const { data: checks } = await _supabase.from('duty_checklist').select('*');
    doneChecklistData = checks || [];

    renderDutyInterface();
    renderDutySummaryForStudents();
}

function getDayColorStyle(dayNameEn) {
    const lowerDay = dayNameEn.toLowerCase();
    if (lowerDay.includes('mon')) return 'bg-yellow-100 text-yellow-700';
    if (lowerDay.includes('tue')) return 'bg-pink-100 text-pink-700';
    if (lowerDay.includes('wed')) return 'bg-green-100 text-green-700';
    if (lowerDay.includes('thu')) return 'bg-orange-100 text-orange-700';
    if (lowerDay.includes('fri')) return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-700';
}

// ---- สรุปเวรรายสัปดาห์ (ฝั่งนักเรียนทุกคนเห็นได้ ไม่ใช่แค่แอดมิน) ----
function renderDutySummaryForStudents() {
    const percentEl = document.getElementById('duty-summary-weekly-percent');
    if (!percentEl) return; // ยังไม่ได้เพิ่ม HTML การ์ดสรุปเข้าไปในหน้า ข้ามไปเงียบๆ

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const totalRegisteredTeammates = dutyRegistrations.length;
    const totalDoneCount = doneChecklistData.filter(c => c.is_done === 'ทำเวร' || c.is_done === true).length;

    days.forEach(day => {
        const count = doneChecklistData.filter(c => c.day_name_en.toLowerCase() === day && (c.is_done === 'ทำเวร' || c.is_done === true)).length;
        const shortDay = day.substring(0, 3);
        const el = document.getElementById(`duty-summary-${shortDay}-count`);
        if (el) el.innerText = count + ' คน';
    });

    if (totalRegisteredTeammates > 0) {
        percentEl.innerText = ((totalDoneCount / totalRegisteredTeammates) * 100).toFixed(0) + '%';
    } else {
        percentEl.innerText = '0%';
    }
}

function renderDutyInterface() {
    const grid = document.getElementById('duty-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const myReg = dutyRegistrations.find(r => String(r.student_id) === String(userData.student_id));
    const mySelectedDay = myReg ? myReg.day_name_en.toLowerCase() : null;

    const checklistBox = document.getElementById('duty-checklist-box');
    const gridSection = document.getElementById('duty-grid-section');

    // ---- ช่องเช็กเวรโชว์เสมอ ไม่ซ่อนทั้งกล่องอีกต่อไป ----
    checklistBox.classList.remove('hidden');

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayIndex = new Date().getDay();
    const currentDayNameEn = daysOfWeek[todayIndex];

    if (myReg && myReg.day_name_en.toLowerCase() === currentDayNameEn) {
        // ถึงวันเวรของเราแล้ว -> โชว์รายชื่อให้เช็กได้ตามปกติ
        document.getElementById('current-day-badge').innerText = `วัน${myReg.day_name_th || myReg.day_name_en}`;
        setDutyChecklistLocked(false);
        renderDutyChecklist(myReg.day_name_en, myReg.day_name_th);
    } else if (myReg) {
        // ลงทะเบียนเวรไว้แล้ว แต่ยังไม่ถึงวัน -> โชว์กล่องแต่ล็อกไว้
        document.getElementById('current-day-badge').innerText = `วัน${myReg.day_name_th || myReg.day_name_en}`;
        setDutyChecklistLocked(true, `ยังไม่ถึงวัน${myReg.day_name_th || myReg.day_name_en} ไม่สามารถเช็กได้`);
    } else {
        // ยังไม่ได้ลงทะเบียนเวรเลย -> โชว์กล่องพร้อมชวนให้ไปเลือกวัน
        document.getElementById('current-day-badge').innerText = '---';
        setDutyChecklistLocked(true, 'คุณยังไม่ได้ลงทะเบียนเวร กรุณาเลือกวันเวรของคุณด้านล่างก่อน');
    }

    gridSection.classList.remove('hidden');

    dutiesConfig.forEach(day => {
        const currentDayEn = day.day_name_en.toLowerCase();
        const workers = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === currentDayEn);
        const isMyDay = mySelectedDay === currentDayEn;

        const card = document.createElement('div');
        card.className = `glass p-5 rounded-2xl border text-center flex flex-col justify-between min-h-[280px] transition-all duration-300 ${
            isMyDay ? 'ring-4 ring-green-500 bg-green-50/30 shadow-lg scale-102' : 'hover:shadow-md'
        }`;

        const dayColorClass = getDayColorStyle(day.day_name_en);

        let btnHTML = `<button onclick="selectDuty('${day.day_name_en}')" class="w-full py-2.5 bg-[#00b272] hover:bg-[#009661] text-white rounded-xl text-xs font-bold shadow-sm transition">เลือกเวรวันนี้</button>`;
        if (isMyDay) {
            btnHTML = `<button onclick="cancelDuty()" class="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold shadow-sm transition"><i class="fa-solid fa-trash-can mr-1"></i> ยกเลิกเวร</button>`;
        } else if (mySelectedDay || workers.length >= day.max_slots) {
            btnHTML = `<button disabled class="w-full py-2.5 bg-gray-100 text-gray-300 rounded-xl text-xs font-bold cursor-not-allowed">เต็ม / เลือกวันอื่นแล้ว</button>`;
        }

        let workersListHTML = '<p class="text-gray-300 italic py-2 text-[11px]">ยังไม่มีสมาชิก</p>';
        if (workers.length > 0) {
            workersListHTML = workers.map(w => {
                const isItMe = String(w.student_id) === String(userData.student_id);
                return `
                    <div class="flex items-center justify-between py-1.5 px-3 border rounded-xl text-xs mb-1.5 font-medium ${
                        isItMe
                        ? 'bg-green-600 text-white font-bold border-green-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-100'
                    }">
                        <span class="truncate"><i class="fa-solid fa-user text-[10px] mr-1 opacity-70"></i> ${w.student_name}</span>
                        ${isItMe ? '<span class="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-md">คุณ</span>' : ''}
                    </div>
                `;
            }).join('');
        }

        card.innerHTML = `
            <div>
                <div class="px-4 py-1.5 rounded-full text-xs font-bold mx-auto w-fit shadow-sm ${dayColorClass}">
                    วัน${day.day_name_th}
                </div>
                <div class="text-[10px] text-gray-400 mb-4 mt-2 font-bold tracking-wider">
                    สมาชิกประจำวัน (${workers.length}/${day.max_slots})
                </div>
                <div class="custom-scrollbar max-h-40 overflow-y-auto pr-0.5">
                    ${workersListHTML}
                </div>
            </div>
            <div class="mt-5">${btnHTML}</div>
        `;
        grid.appendChild(card);
    });
}

// ---- แสดงสถานะ "ล็อก" ของช่องเช็กเวร (ยังไม่ถึงวัน / ยังไม่ได้ลงทะเบียน) ----
function setDutyChecklistLocked(isLocked, message) {
    const itemsContainer = document.getElementById('my-day-checklist-items');
    const submitBtn = document.getElementById('duty-submit-btn');

    if (isLocked) {
        itemsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center py-8 gap-3">
                <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-lock"></i>
                </div>
                <p class="text-xs font-bold text-slate-400 max-w-[240px]">${message}</p>
            </div>
        `;
        if (submitBtn) submitBtn.classList.add('hidden');
    } else {
        if (submitBtn) submitBtn.classList.remove('hidden');
        // renderDutyChecklist() ที่เรียกต่อจากนี้จะเติมรายชื่อลงใน itemsContainer เอง
    }
}

// ---- สวิตช์ 3 ตัวเลือก: ทำแล้ว / ไม่ทำ / ลา ----
function buildDutyPillGroupHTML(uid, state) {
    const pill = (val, label, activeClass) => {
        const isActive = state === val;
        const valAttr = typeof val === 'boolean' ? val : `'${val}'`;
        return `<button type="button" onclick="setDutyState('${uid}', ${valAttr})"
            class="flex-1 py-2 rounded-lg text-[10px] font-bold transition-all duration-200 ${
                isActive ? activeClass + ' shadow-sm' : 'text-slate-400 hover:bg-white/70'
            }">${label}</button>`;
    };
    return `
        ${pill(true, 'ทำแล้ว', 'bg-green-500 text-white')}
        ${pill(false, 'ไม่ทำ', 'bg-red-500 text-white')}
        ${pill('leave', 'ลา', 'bg-amber-500 text-white')}
    `;
}

function renderDutyChecklist(targetDayEn, targetDayTh) {
    const container = document.getElementById('my-day-checklist-items');
    container.innerHTML = '';

    const teammates = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === targetDayEn.toLowerCase());

    teammates.forEach(tm => {
        if (localChecklistState[tm.student_id] === undefined) {
            localChecklistState[tm.student_id] = true;
        }

        const state = localChecklistState[tm.student_id];

        const item = document.createElement('div');
        item.className = "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border rounded-xl hover:bg-white transition shadow-sm";

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs shrink-0">
                    ${tm.student_name.charAt(0)}
                </div>
                <div>
                    <p class="text-xs font-bold text-slate-800">${tm.student_name}</p>
                    <p class="text-[10px] text-gray-400">ID: ${tm.student_id}</p>
                </div>
            </div>
            <div id="pill-group-${tm.student_id}" class="flex gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-52">
                ${buildDutyPillGroupHTML(tm.student_id, state)}
            </div>
        `;
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

    let textOutputArray = [];
    let insertRows = [];
    const currentTimeIso = new Date().toISOString();

    teammates.forEach((tm, idx) => {
        const state = localChecklistState[tm.student_id];
        let statusText = "ทำเวร";

        if (state === true) {
            statusText = "ทำเวร";
        } else if (state === false) {
            statusText = "ไม่ทำเวร";
        } else if (state === 'leave') {
            statusText = "ลา";
        }

        textOutputArray.push(`${idx + 1}.${tm.student_name} ${statusText}`);

        insertRows.push({
            student_id: tm.student_id,
            student_name: tm.student_name,
            day_name_en: myReg.day_name_en,
            is_done: statusText,
            created_at: currentTimeIso
        });
    });

    const { error } = await _supabase.from('duty_checklist').insert(insertRows);

    if (error) {
        console.error("Database append log error: ", error);
        return showAlert("ข้อผิดพลาด", "ไม่สามารถบันทึกรายงานได้ เนื่องจากระบบสัปดาห์นี้ถูกบันทึกไปแล้ว หรือเกิดข้อผิดพลาดภายในระบบฐานข้อมูล", "error");
    }

    const reportString = textOutputArray.join('\n');
    document.getElementById('report-text-output').value = reportString;
    document.getElementById('copy-report-modal').classList.remove('hidden');

    await loadDutyData();
}

function executeCopyText() {
    const copyText = document.getElementById('report-text-output');
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);

    showAlert("คัดลอกสำเร็จ", "บันทึกและคัดลอกรายงานรายชื่อไปยังคลิปบอร์ดของคุณเรียบร้อยแล้ว!", "success");
    document.getElementById('copy-report-modal').classList.add('hidden');
}

async function selectDuty(dayNameEn) {
    await _supabase.from('duty_registrations').insert([{ student_id: userData.student_id, student_name: userData.name, day_name_en: dayNameEn }]);
    showAlert("สำเร็จ", "คุณลงทะเบียนเวรประจำวันเรียบร้อยแล้ว", "success");
    loadDutyData();
}

async function cancelDuty() {
    await _supabase.from('duty_registrations').delete().eq('student_id', userData.student_id);
    showAlert("สำเร็จ", "ยกเลิกข้อมูลการลงทะเบียนเวรเรียบร้อยแล้ว", "success");
    localChecklistState = {};
    loadDutyData();
}
