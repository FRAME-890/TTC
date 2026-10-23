// ==========================================================
//  homework.js — การบ้าน
// ==========================================================
async function loadHomeworkData() {
    try {
        const { data: hws } = await _supabase.from('homework').select('*').order('deadline', { ascending: true });
        homeworkList = hws || [];
        const { data: doneList } = await _supabase.from('homework_status').select('homework_id').eq('student_id', userData.student_id);
        completedHomeworkIds = doneList ? doneList.map(item => item.homework_id) : [];
        renderHomeworkList();
    } catch (err) { console.error(err); }
}

function renderHomeworkList() {
    const container = document.getElementById('homework-list');
    const active = homeworkList.filter(hw => !completedHomeworkIds.includes(hw.id));

    if (active.length === 0) {
        container.innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fa-regular fa-face-smile gold"></i> ไม่มีการบ้านค้างส่ง</div>`;
        return;
    }

    container.innerHTML = active.map(hw => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dl = new Date(hw.deadline); dl.setHours(0, 0, 0, 0);
        const diff = Math.round((dl - today) / 86400000);

        let chip = 'chip', text = `เหลืออีก ${diff} วัน`;
        if (diff < 0) { chip = 'chip chip-danger'; text = `เลยกำหนด ${Math.abs(diff)} วัน`; }
        else if (diff === 0) { chip = 'chip chip-danger pulse'; text = 'กำหนดส่งวันนี้'; }
        else if (diff === 1) { chip = 'chip chip-warn'; text = 'กำหนดส่งพรุ่งนี้'; }

        return `
        <div class="card card-pad flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-start gap-2 mb-3">
                    <span class="chip chip-gold truncate">${esc(hw.subject_name)}</span>
                    <span class="${chip} shrink-0">${text}</span>
                </div>
                <p class="text-xs whitespace-pre-wrap" style="line-height:1.7">${esc(hw.title)}</p>
            </div>
            <div class="flex justify-between items-center pt-3 mt-4" style="border-top:1px solid var(--line)">
                <span class="text-[10px] muted"><i class="fa-regular fa-clock"></i> ${new Date(hw.deadline).toLocaleDateString('th-TH')}</span>
                <button onclick="markAsDone(${Number(hw.id)})" class="btn btn-ok btn-sm"><i class="fa-solid fa-check"></i> ทำเสร็จแล้ว</button>
            </div>
        </div>`;
    }).join('');
}

async function addHomework() {
    const subject = document.getElementById('hw-subject').value.trim();
    const title = document.getElementById('hw-title').value.trim();
    const deadline = document.getElementById('hw-deadline').value;
    if (!subject || !title || !deadline) return showAlert('แจ้งเตือน', 'กรุณากรอกวิชา รายละเอียด และวันกำหนดส่งให้ครบ', 'warning');

    const { error } = await _supabase.from('homework').insert([{ subject_name: subject, title, deadline, created_by: userData.student_id }]);
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');

    ['hw-subject', 'hw-title', 'hw-deadline'].forEach(id => document.getElementById(id).value = '');
    showAlert('สำเร็จ', 'เพิ่มการบ้านใหม่เรียบร้อยแล้ว', 'success');
    loadHomeworkData();
}

async function markAsDone(homeworkId) {
    const { error } = await _supabase.from('homework_status').insert([{ student_id: userData.student_id, homework_id: homeworkId }]);
    if (error && error.code !== '23505') return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    showAlert('สำเร็จ', 'บันทึกสถานะทำเสร็จแล้ว', 'success');
    loadHomeworkData();
}
