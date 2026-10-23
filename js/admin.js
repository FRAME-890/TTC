// ==========================================================
//  admin.js — แผงควบคุมผู้ดูแลระบบ
// ==========================================================
const ADMIN_TABS = ['students', 'room', 'bus', 'duty', 'fund', 'vote', 'homework'];

async function openAdmin() {
    if (!userData || userData.role !== 'admin') return;
    document.getElementById('admin-panel').classList.remove('hidden');
    history.pushState({ page: 'admin-panel' }, '', '#admin-panel');
    switchAdminMainTab('students');

    try {
        const { data: config } = await _supabase.from('room').select('*').eq('id', 1).maybeSingle();
        if (config) {
            roomConfig = {
                id: 1, rows: config.rows || 8, cols: config.cols || 6,
                wall_objects: config.wall_objects || [], blocked_seats: config.blocked_seats || [],
                custom_labels: config.custom_labels || {}
            };
        }
        document.getElementById('inp-rows').value = roomConfig.rows;
        document.getElementById('inp-cols').value = roomConfig.cols;

        const { data: fundConfig } = await _supabase.from('classroom_funds').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
        currentFundConfig = fundConfig;
        if (fundConfig) {
            document.getElementById('adm-fund-title').value = fundConfig.title;
            document.getElementById('adm-fund-amount').value = fundConfig.amount_per_person;
            document.getElementById('adm-fund-pp').value = fundConfig.promptpay_id;
        }
        renderAdminFundStatus();

        await Promise.all([loadStudents(), loadAdminDashboardData(), loadBusData()]);
        renderAdminMap();
        renderRoomObjList();
    } catch (err) {
        console.error('openAdmin error:', err);
        showAlert('ข้อผิดพลาด', 'โหลดข้อมูลแผงควบคุมไม่สมบูรณ์ กรุณาลองใหม่', 'error');
    }
}

function closeAdmin() {
    document.getElementById('admin-panel').classList.add('hidden');
    stopBusScanner();
    goToPage('landing-page');
}

function switchAdminMainTab(tab) {
    ADMIN_TABS.forEach(t => {
        document.getElementById(`admtab-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`admtab-btn-${t}`).className = t === tab ? 'tab on' : 'tab';
    });

    if (tab === 'bus') switchBusAdminTab('layout');
    else stopBusScanner(); // ปิดกล้องเมื่อออกจากแท็บรถบัส

    if (tab === 'vote') loadVoteData().then(renderAdminVoteList);
    if (tab === 'room') { renderAdminMap(); renderRoomObjList(); }
}

// ---------------- โหวต ----------------
function renderAdminVoteList() {
    const box = document.getElementById('admin-vote-list');
    if (!box) return;
    if (!activePolls || activePolls.length === 0) {
        box.innerHTML = '<div class="empty">ยังไม่มีหัวข้อโหวตในระบบ</div>';
        return;
    }
    box.innerHTML = activePolls.map(p => `
        <div class="row-item">
            <div class="min-w-0">
                <p class="font-semibold truncate">${esc(p.question)}</p>
                <p class="muted text-[10px] mt-1">${p.votesData ? p.votesData.length : 0} โหวต</p>
            </div>
            <button onclick="deletePoll(${Number(p.id)})" class="icon-btn del"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join('');
}

// ---------------- โหลดข้อมูลแดชบอร์ด ----------------
async function loadAdminDashboardData() {
    try {
        const { data: bookings } = await _supabase.from('bookings').select('*').order('seat_number');
        fullBookingsData = bookings || [];
        bookedSeats = fullBookingsData.map(b => b.seat_number);
        renderAdminBookingsTable();

        const [duties, regs, checks, hws] = await Promise.all([
            _supabase.from('duties').select('*').order('id'),
            _supabase.from('duty_registrations').select('*'),
            _supabase.from('duty_checklist').select('*'),
            _supabase.from('homework').select('*').order('deadline', { ascending: true })
        ]);
        dutiesConfig = duties.data || [];
        dutyRegistrations = regs.data || [];
        doneChecklistData = checks.data || [];
        homeworkList = hws.data || [];

        renderAdminDutyList();
        calculateWeeklyReportDashboard();
        renderAdminHomeworkList();
    } catch (err) { console.error('Admin dashboard load error:', err); }
}

function calculateWeeklyReportDashboard() {
    const stats = computeDutyStats();
    ['mon', 'tue', 'wed', 'thu', 'fri'].forEach(d => {
        const el = document.getElementById(`summary-${d}-count`);
        if (el) el.innerText = stats.perDay[d] + ' คน';
    });
    document.getElementById('summary-weekly-percent').innerText = stats.percent + '%';
}

// ---------------- ที่นั่งห้องเรียน ----------------
function renderAdminBookingsTable() {
    const tbody = document.getElementById('admin-bookings-rows');
    if (fullBookingsData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty">ยังไม่มีข้อมูลการจองที่นั่ง</div></td></tr>`;
        return;
    }
    tbody.innerHTML = fullBookingsData.map(b => `
        <tr>
            <td class="gold font-semibold">${esc(b.seat_number)}</td>
            <td class="muted">${esc(b.student_id)}</td>
            <td>${esc(b.student_name)}</td>
            <td class="r"><button onclick="removeBookingAdmin('${esc(b.student_id)}','${esc(b.seat_number)}')" class="btn btn-danger btn-sm"><i class="fa-solid fa-user-minus"></i> ลบสิทธิ์</button></td>
        </tr>`).join('');
}

function removeBookingAdmin(studentId, seatNum) {
    showAlert('ยืนยันการลบ', `ยกเลิกและคืนสิทธิ์ที่นั่ง ${seatNum} ใช่หรือไม่?`, 'confirm', async () => {
        const { error } = await _supabase.from('bookings').delete().eq('student_id', studentId);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'ยกเลิกการจองเรียบร้อยแล้ว', 'success');
        await loadAdminDashboardData();
        renderAdminMap();
    });
}

function renderAdminMap() { render('admin-seat-map', 'admin-wall-container', true); }

function toggleBlockSeatAdmin(defaultID) {
    if (roomConfig.blocked_seats.includes(defaultID)) {
        roomConfig.blocked_seats = roomConfig.blocked_seats.filter(id => id !== defaultID);
    } else {
        roomConfig.blocked_seats.push(defaultID);
    }
    renderAdminMap();
}

function resetLayout() {
    const r = Math.min(Math.max(parseInt(document.getElementById('inp-rows').value) || 8, 1), 26);
    const c = Math.min(Math.max(parseInt(document.getElementById('inp-cols').value) || 6, 1), 20);
    document.getElementById('inp-rows').value = r;
    document.getElementById('inp-cols').value = c;
    roomConfig.rows = r;
    roomConfig.cols = c;
    renderAdminMap();
}

async function saveAndCloseAdmin() {
    const btn = document.getElementById('admin-save-btn');
    btn.disabled = true;
    btn.innerText = 'กำลังบันทึก...';

    // upsert: ถ้ายังไม่มีแถว id=1 ในตาราง room จะสร้างให้เอง
    const { error } = await _supabase.from('room').upsert({
        id: 1,
        rows: roomConfig.rows,
        cols: roomConfig.cols,
        blocked_seats: roomConfig.blocked_seats,
        wall_objects: roomConfig.wall_objects,
        custom_labels: roomConfig.custom_labels
    });

    btn.disabled = false;
    btn.innerText = 'บันทึกโครงสร้างผังที่นั่ง';
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    showAlert('สำเร็จ', 'บันทึกผังห้องเรียนเรียบร้อยแล้ว', 'success');
}

// หน้าต่าง / ประตู ของห้องเรียน
let tempSide = 'left';
function updateSideUI() {
    document.getElementById('side-left').className = tempSide === 'left' ? 'on' : '';
    document.getElementById('side-right').className = tempSide === 'right' ? 'on' : '';
}
function openObjModal() {
    tempSide = 'left';
    updateSideUI();
    document.getElementById('obj-modal').classList.remove('hidden');
}
function confirmAddObj() {
    const type = document.getElementById('obj-type').value;
    const pos = parseInt(document.getElementById('obj-pos').value);
    if (!roomConfig.wall_objects) roomConfig.wall_objects = [];
    roomConfig.wall_objects.push({ type, side: tempSide, top: pos });
    document.getElementById('obj-modal').classList.add('hidden');
    renderAdminMap();
    renderRoomObjList();
}
function renderRoomObjList() {
    const box = document.getElementById('room-obj-list');
    if (!box) return;
    const objs = roomConfig.wall_objects || [];
    if (objs.length === 0) { box.innerHTML = '<p class="text-[10px] faint text-center">ยังไม่มีหน้าต่าง / ประตู</p>'; return; }
    box.innerHTML = objs.map((o, i) => `
        <div class="row-item" style="padding:7px 12px;margin-bottom:6px">
            <span class="text-[11px]">${o.type === 'door' ? 'ประตู' : 'หน้าต่าง'} · ${o.side === 'left' ? 'ซ้าย' : 'ขวา'} · ${Number(o.top)}%</span>
            <button onclick="deleteRoomObj(${i})" class="icon-btn del" style="width:24px;height:24px"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('');
}
function deleteRoomObj(i) {
    roomConfig.wall_objects.splice(i, 1);
    renderAdminMap();
    renderRoomObjList();
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.add('hidden');
    selectedSeat = null;
    document.getElementById('display-seat').innerText = '--';
    loadSeatData();
}

// ---------------- เวร ----------------
function renderAdminDutyList() {
    const box = document.getElementById('admin-duty-list');
    const latest = latestChecklistByStudent();
    if (dutiesConfig.length === 0) { box.innerHTML = '<div class="empty" style="grid-column:1/-1">ยังไม่มีข้อมูลวันเวรในตาราง duties</div>'; return; }

    box.innerHTML = dutiesConfig.map(day => {
        const workers = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === day.day_name_en.toLowerCase());
        const list = workers.length === 0 ? '<p class="faint text-[11px] italic mt-2">ยังไม่มีผู้ลงทะเบียน</p>' : workers.map(w => {
            const log = latest.get(String(w.student_id));
            const done = log && (log.is_done === 'ทำเวร' || log.is_done === true);
            return `
                <div class="member mt-2">
                    <span class="flex items-center gap-2">
                        ${done ? '<i class="fa-solid fa-circle-check ok" title="ทำเวรแล้ว"></i>' : '<i class="fa-solid fa-circle-minus faint" title="ยังไม่ได้ทำเวร"></i>'}
                        ${esc(w.student_name)}
                    </span>
                    <button onclick="removeDutyAdmin('${esc(w.student_id)}')" class="btn btn-danger btn-sm" style="padding:3px 9px">เอาออก</button>
                </div>`;
        }).join('');
        return `
            <div class="inset p-4">
                <div class="flex justify-between items-center pb-2" style="border-bottom:1px solid var(--line)">
                    <span class="day-chip">วัน${esc(day.day_name_th)}</span>
                    <span class="chip">${workers.length}/${Number(day.max_slots)}</span>
                </div>
                ${list}
            </div>`;
    }).join('');
}

function removeDutyAdmin(studentId) {
    showAlert('ยืนยัน', 'เอารายชื่อนักเรียนคนนี้ออกจากเวรใช่หรือไม่?', 'confirm', async () => {
        await _supabase.from('duty_checklist').delete().eq('student_id', studentId);
        const { error } = await _supabase.from('duty_registrations').delete().eq('student_id', studentId);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'ลบรายชื่อออกจากตารางเวรแล้ว', 'success');
        await loadAdminDashboardData();
    });
}

function resetAllDutiesAdmin() {
    showAlert('ล้างรายชื่อเวรทั้งหมด', 'ลบสมาชิกเวรประจำวันและผลเช็กทั้งหมดออกถาวร ใช่หรือไม่?', 'confirm', async () => {
        await _supabase.from('duty_checklist').delete().neq('student_id', '0');
        const { error } = await _supabase.from('duty_registrations').delete().neq('student_id', '0');
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        localChecklistState = {};
        showAlert('สำเร็จ', 'ล้างตารางเวรทั้งหมดเรียบร้อย', 'success');
        await loadAdminDashboardData();
    });
}

function resetDutyChecklistAdmin() {
    showAlert('เริ่มสัปดาห์ใหม่', 'ล้างเฉพาะผลการเช็กชื่อเวร (รายชื่อสมาชิกแต่ละวันยังอยู่) เพื่อเริ่มนับสัปดาห์ใหม่?', 'confirm', async () => {
        const { error } = await _supabase.from('duty_checklist').delete().neq('student_id', '0');
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        localChecklistState = {};
        showAlert('สำเร็จ', 'ล้างผลเช็กชื่อเรียบร้อย พร้อมเริ่มสัปดาห์ใหม่', 'success');
        await loadAdminDashboardData();
    });
}

// ---------------- การบ้าน ----------------
function renderAdminHomeworkList() {
    const box = document.getElementById('admin-homework-list');
    if (homeworkList.length === 0) { box.innerHTML = '<div class="empty">ไม่มีการบ้านในระบบ</div>'; return; }
    box.innerHTML = homeworkList.map(hw => `
        <div class="row-item">
            <div class="min-w-0">
                <p class="font-semibold truncate"><span class="gold">[${esc(hw.subject_name)}]</span> ${esc(hw.title)}</p>
                <p class="muted text-[10px] mt-1">กำหนดส่ง: ${new Date(hw.deadline).toLocaleDateString('th-TH')}</p>
            </div>
            <button onclick="deleteHomeworkAdmin(${Number(hw.id)})" class="icon-btn del"><i class="fa-solid fa-trash-can"></i></button>
        </div>`).join('');
}

function deleteHomeworkAdmin(id) {
    showAlert('ยืนยันการลบ', 'ลบรายการการบ้านนี้ออกจากระบบใช่หรือไม่?', 'confirm', async () => {
        await _supabase.from('homework_status').delete().eq('homework_id', id);
        const { error } = await _supabase.from('homework').delete().eq('id', id);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'ลบข้อมูลเรียบร้อยแล้ว', 'success');
        await loadAdminDashboardData();
    });
}
