// ==========================================================
//  students.js — จัดการนักเรียนในหน้าแอดมิน (เพิ่ม / นำเข้า / แก้ไข / ลบ)
//  ตารางที่ใช้: settings  (student_id, name, role)
// ==========================================================

async function loadStudents() {
    const { data, error } = await _supabase.from('settings').select('*');
    if (error) {
        studentsList = [];
        showAlert('โหลดรายชื่อไม่สำเร็จ', dbErrorText(error), 'error');
    } else {
        studentsList = (data || []).slice().sort((a, b) =>
            String(a.student_id).localeCompare(String(b.student_id), 'th', { numeric: true }));
    }
    renderStudentList();
}

function renderStudentList() {
    const tbody = document.getElementById('stu-rows');
    if (!tbody) return;
    const q = (document.getElementById('stu-search').value || '').trim().toLowerCase();
    const list = studentsList.filter(s =>
        !q || String(s.student_id).toLowerCase().includes(q) || String(s.name || '').toLowerCase().includes(q));

    document.getElementById('stu-count').innerText = q
        ? `พบ ${list.length} / ${studentsList.length} คน`
        : `${studentsList.length} คน`;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty">${q ? 'ไม่พบรายชื่อที่ค้นหา' : 'ยังไม่มีนักเรียนในระบบ'}</div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td class="gold font-semibold">${esc(s.student_id)}</td>
            <td>${esc(s.name)}</td>
            <td>${s.role === 'admin' ? '<span class="chip chip-gold"><i class="fa-solid fa-crown"></i> แอดมิน</span>' : '<span class="chip">นักเรียน</span>'}</td>
            <td class="r">
                <button class="icon-btn" title="แก้ไข" onclick="openStudentEdit('${esc(s.student_id)}')"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn del" title="ลบ" onclick="deleteStudent('${esc(s.student_id)}')"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        </tr>`).join('');
}

async function addStudent() {
    const idEl = document.getElementById('stu-new-id');
    const nameEl = document.getElementById('stu-new-name');
    const role = document.getElementById('stu-new-role').value;
    const sid = idEl.value.trim();
    const name = nameEl.value.trim().replace(/\s+/g, ' ');

    if (!sid || !name) return showAlert('แจ้งเตือน', 'กรุณากรอกเลขประจำตัวและชื่อ-นามสกุลให้ครบ', 'warning');

    const { data: exists, error: e1 } = await _supabase.from('settings').select('student_id').eq('student_id', sid).maybeSingle();
    if (e1) return showAlert('ข้อผิดพลาด', dbErrorText(e1), 'error');
    if (exists) return showAlert('ซ้ำในระบบ', `เลขประจำตัว ${sid} มีอยู่ในระบบแล้ว`, 'error');

    const { error } = await _supabase.from('settings').insert([{ student_id: sid, name, role }]);
    if (error) return showAlert('เพิ่มไม่สำเร็จ', dbErrorText(error), 'error');

    idEl.value = ''; nameEl.value = ''; document.getElementById('stu-new-role').value = 'student';
    showAlert('สำเร็จ', `เพิ่ม ${name} (${sid}) เรียบร้อยแล้ว`, 'success');
    idEl.focus();
    await loadStudents();
}

async function bulkAddStudents() {
    const raw = document.getElementById('stu-bulk').value;
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return showAlert('แจ้งเตือน', 'กรุณาวางรายชื่ออย่างน้อย 1 บรรทัด', 'warning');
    if (lines.length > 500) return showAlert('มากเกินไป', 'นำเข้าได้ครั้งละไม่เกิน 500 รายการ', 'warning');

    const parsed = [], invalid = [], seen = new Set();
    lines.forEach(line => {
        const m = line.match(/^([^\s,;\t]+)[\s,;\t]+(.+)$/);
        if (!m) return invalid.push(line);
        const sid = m[1].trim(), name = m[2].replace(/[,;\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!sid || !name) return invalid.push(line);
        if (seen.has(sid)) return invalid.push(line + '  (ซ้ำในรายการ)');
        seen.add(sid);
        parsed.push({ student_id: sid, name, role: 'student' });
    });

    if (parsed.length === 0) return showAlert('รูปแบบไม่ถูกต้อง', 'ไม่พบบรรทัดที่อ่านได้ รูปแบบคือ "เลขประจำตัว ชื่อ-นามสกุล"', 'error');

    const { data: existing, error: e1 } = await _supabase.from('settings').select('student_id').in('student_id', parsed.map(p => p.student_id));
    if (e1) return showAlert('ข้อผิดพลาด', dbErrorText(e1), 'error');
    const existingIds = new Set((existing || []).map(x => String(x.student_id)));
    const toInsert = parsed.filter(p => !existingIds.has(p.student_id));

    if (toInsert.length > 0) {
        const { error } = await _supabase.from('settings').insert(toInsert);
        if (error) return showAlert('นำเข้าไม่สำเร็จ', dbErrorText(error), 'error');
    }

    document.getElementById('stu-bulk').value = '';
    let msg = `เพิ่มใหม่ ${toInsert.length} คน`;
    if (existingIds.size) msg += ` • ข้าม ${existingIds.size} คนที่มีอยู่แล้ว`;
    if (invalid.length) msg += ` • อ่านไม่ได้ ${invalid.length} บรรทัด`;
    showAlert(toInsert.length ? 'นำเข้าเสร็จสิ้น' : 'ไม่มีรายชื่อใหม่', msg, toInsert.length ? 'success' : 'warning');
    await loadStudents();
}

function openStudentEdit(sid) {
    const s = studentsList.find(x => String(x.student_id) === String(sid));
    if (!s) return;
    document.getElementById('stu-edit-orig').value = s.student_id;
    document.getElementById('stu-edit-id').value = s.student_id;
    document.getElementById('stu-edit-name').value = s.name || '';
    document.getElementById('stu-edit-role').value = s.role === 'admin' ? 'admin' : 'student';
    document.getElementById('student-modal').classList.remove('hidden');
}

function adminCount() { return studentsList.filter(s => s.role === 'admin').length; }

async function saveStudentEdit() {
    const sid = document.getElementById('stu-edit-orig').value;
    const name = document.getElementById('stu-edit-name').value.trim().replace(/\s+/g, ' ');
    const role = document.getElementById('stu-edit-role').value;
    if (!name) return showAlert('แจ้งเตือน', 'กรุณากรอกชื่อ-นามสกุล', 'warning');

    const target = studentsList.find(x => String(x.student_id) === String(sid));
    if (target && target.role === 'admin' && role !== 'admin' && adminCount() <= 1) {
        return showAlert('ทำไม่ได้', 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คนเสมอ', 'error');
    }

    const { error } = await _supabase.from('settings').update({ name, role }).eq('student_id', sid);
    if (error) return showAlert('บันทึกไม่สำเร็จ', dbErrorText(error), 'error');

    // ชื่อที่ซ้ำอยู่ในตารางอื่นเป็นแค่สำเนา อัปเดตให้ตรงกัน (ถ้าทำไม่ได้ก็ข้ามไป)
    await Promise.all([
        _supabase.from('bookings').update({ student_name: name }).eq('student_id', sid),
        _supabase.from('bus_bookings').update({ name }).eq('student_id', sid),
        _supabase.from('duty_registrations').update({ student_name: name }).eq('student_id', sid),
        _supabase.from('fund_payments').update({ student_name: name }).eq('student_id', sid)
    ].map(p => p.then(() => {}, () => {})));

    if (userData && String(userData.student_id) === String(sid)) {
        userData = { ...userData, name, role };
        localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        showNav();
    }
    document.getElementById('student-modal').classList.add('hidden');
    showAlert('สำเร็จ', 'บันทึกข้อมูลนักเรียนเรียบร้อยแล้ว', 'success');
    await loadStudents();
}

function deleteStudent(sid) {
    const s = studentsList.find(x => String(x.student_id) === String(sid));
    if (!s) return;
    if (userData && String(userData.student_id) === String(sid)) {
        return showAlert('ทำไม่ได้', 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้', 'error');
    }
    if (s.role === 'admin' && adminCount() <= 1) {
        return showAlert('ทำไม่ได้', 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คนเสมอ', 'error');
    }

    showAlert('ยืนยันการลบ',
        `ลบ ${s.name} (${sid}) ออกจากระบบ? ที่นั่ง เวร การบ้าน และคะแนนโหวตของคนนี้จะถูกลบด้วย (ประวัติการจ่ายเงินกองทุนยังเก็บไว้)`,
        'confirm', async () => {
            const cleanup = [
                _supabase.from('bookings').delete().eq('student_id', sid),
                _supabase.from('bus_bookings').delete().eq('student_id', sid),
                _supabase.from('duty_registrations').delete().eq('student_id', sid),
                _supabase.from('duty_checklist').delete().eq('student_id', sid),
                _supabase.from('homework_status').delete().eq('student_id', sid),
                _supabase.from('poll_votes').delete().eq('student_id', sid)
            ];
            await Promise.all(cleanup.map(p => p.then(() => {}, () => {})));

            const { error } = await _supabase.from('settings').delete().eq('student_id', sid);
            if (error) return showAlert('ลบไม่สำเร็จ', dbErrorText(error), 'error');
            showAlert('สำเร็จ', 'ลบนักเรียนเรียบร้อยแล้ว', 'success');
            await loadStudents();
            await loadAdminDashboardData();
            renderAdminMap();
        });
}
