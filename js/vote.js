// ==========================================================
//  vote.js — ระบบโหวต
// ==========================================================
async function loadVoteData() {
    try {
        const { data: polls } = await _supabase.from('polls').select('*').order('created_at', { ascending: false });
        activePolls = polls || [];

        const { data: mine } = await _supabase.from('poll_votes').select('*').eq('student_id', userData.student_id);
        myVotes = mine || [];

        // ดึงคะแนนทุกโพลในคำสั่งเดียว (เดิมยิงทีละโพล ช้ามากเมื่อโพลเยอะ)
        activePolls.forEach(p => { p.votesData = []; });
        if (activePolls.length) {
            const { data: all } = await _supabase.from('poll_votes').select('poll_id, option_index').in('poll_id', activePolls.map(p => p.id));
            (all || []).forEach(v => {
                const poll = activePolls.find(p => String(p.id) === String(v.poll_id));
                if (poll) poll.votesData.push(v);
            });
        }

        renderPollsList();
        if (!document.getElementById('admtab-vote').classList.contains('hidden')) renderAdminVoteList();
        subscribeVoteRealtime();
    } catch (err) { console.error(err); }
}

function subscribeVoteRealtime() {
    if (voteSubscription) return; // สมัครครั้งเดียว ไม่สร้างซ้ำทุกครั้งที่โหลด
    voteSubscription = _supabase.channel('public:poll_votes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => loadVoteData())
        .subscribe();
}

function renderPollsList() {
    const box = document.getElementById('polls-list-container');
    if (activePolls.length === 0) {
        box.innerHTML = `<div class="empty">ยังไม่มีหัวข้อเปิดโหวตในขณะนี้</div>`;
        return;
    }

    box.innerHTML = activePolls.map(poll => {
        const mine = myVotes.find(v => String(v.poll_id) === String(poll.id));
        const total = poll.votesData.length;
        const options = (Array.isArray(poll.options) ? poll.options : []).map((opt, i) => {
            const count = poll.votesData.filter(v => v.option_index === i).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const sel = mine && mine.option_index === i;
            return `
            <div class="bar-wrap ${sel ? 'mine' : ''}">
                <div class="bar-fill" style="width:${pct}%"></div>
                <div class="relative flex justify-between items-center text-xs font-medium gap-3">
                    <span class="flex items-center gap-2">${sel ? '<i class="fa-solid fa-circle-check gold"></i>' : '<i class="fa-regular fa-circle faint"></i>'} ${esc(opt)}</span>
                    <span class="gold font-semibold shrink-0">${count} โหวต · ${pct}%</span>
                </div>
                ${!mine ? `<button onclick="castVote(${Number(poll.id)}, ${i})" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="โหวต ${esc(opt)}"></button>` : ''}
            </div>`;
        }).join('');

        const canDelete = String(poll.created_by) === String(userData.student_id) || userData.role === 'admin';
        return `
        <div id="poll-card-${Number(poll.id)}" class="card card-pad space-y-4 animate-pop" style="transition:box-shadow .3s">
            <div class="flex justify-between items-start gap-4">
                <div>
                    <h3 class="display text-base"><i class="fa-solid fa-circle-question gold"></i> ${esc(poll.question)}</h3>
                    <p class="text-[10px] muted mt-1"><i class="fa-solid fa-users"></i> ผู้ร่วมโหวต ${total} คน ${mine ? '· คุณโหวตแล้ว' : '· แตะตัวเลือกเพื่อโหวต'}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button onclick="sharePoll(${Number(poll.id)})" class="btn btn-quiet btn-sm"><i class="fa-solid fa-share-nodes"></i> แชร์</button>
                    ${canDelete ? `<button onclick="deletePoll(${Number(poll.id)})" class="btn btn-quiet btn-sm"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </div>
            <div class="space-y-2">${options}</div>
        </div>`;
    }).join('');
}

function sharePoll(pollId) {
    const url = `${window.location.origin}${window.location.pathname}?poll=${pollId}`;
    if (navigator.share) {
        navigator.share({ title: 'ร่วมโหวตกันเถอะ!', url }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(
            () => showAlert('คัดลอกลิงก์แล้ว', 'นำลิงก์ไปวางในแชทเพื่อนได้เลย เปิดแล้วจะพาไปที่โหวตนี้โดยตรง', 'success'),
            () => showAlert('ข้อผิดพลาด', 'คัดลอกลิงก์ไม่สำเร็จ', 'error'));
    }
}

async function createNewPoll() {
    const question = document.getElementById('vote-question').value.trim();
    const raw = document.getElementById('vote-options').value;
    if (!question || !raw.trim()) return showAlert('แจ้งเตือน', 'กรุณากรอกหัวข้อและตัวเลือกให้ครบ', 'warning');

    // รองรับทั้งคอมม่าภาษาอังกฤษ , และภาษาไทย/จีน ， และขึ้นบรรทัดใหม่
    const options = [...new Set(raw.split(/[,，\n]/).map(o => o.trim()).filter(Boolean))];
    if (options.length < 2) return showAlert('แจ้งเตือน', 'ใส่ตัวเลือกอย่างน้อย 2 ตัวเลือก (คั่นด้วยคอมม่า)', 'warning');

    const { error } = await _supabase.from('polls').insert([{ question, options, created_by: userData.student_id }]);
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');

    document.getElementById('vote-question').value = '';
    document.getElementById('vote-options').value = '';
    showAlert('สำเร็จ', 'เปิดโหวตใหม่เรียบร้อยแล้ว', 'success');
    loadVoteData();
}

async function castVote(pollId, optionIndex) {
    const { error } = await _supabase.from('poll_votes').insert([{ poll_id: pollId, student_id: userData.student_id, option_index: optionIndex }]);
    if (error) {
        await loadVoteData();
        return showAlert('โหวตไม่ได้', error.code === '23505' ? 'คุณโหวตหัวข้อนี้ไปแล้ว ไม่สามารถโหวตซ้ำได้' : dbErrorText(error), 'error');
    }
    loadVoteData();
}

function deletePoll(pollId) {
    showAlert('ยืนยันการลบ', 'ลบหัวข้อโหวตนี้ออกจากระบบถาวรใช่หรือไม่?', 'confirm', async () => {
        await _supabase.from('poll_votes').delete().eq('poll_id', pollId); // ลบคะแนนก่อน กัน foreign key ค้าง
        const { error } = await _supabase.from('polls').delete().eq('id', pollId);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'ลบหัวข้อโหวตเรียบร้อย', 'success');
        loadVoteData();
    });
}
