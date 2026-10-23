// ==========================================================
//  auth.js — เข้าสู่ระบบ / ออกจากระบบ / กู้คืนเซสชัน
// ==========================================================
const SESSION_KEY = 'thaiticket_session';

window.addEventListener('load', async () => {
    document.getElementById('student_id_input').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });

    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;

    let cached;
    try { cached = JSON.parse(saved); } catch (e) { localStorage.removeItem(SESSION_KEY); return; }
    if (!cached || !cached.student_id) { localStorage.removeItem(SESSION_KEY); return; }

    document.getElementById('login-page').classList.add('hidden');

    // ตรวจซ้ำกับฐานข้อมูล: กันกรณีนักเรียนถูกลบ / สิทธิ์ถูกเปลี่ยน / แก้ localStorage เอง
    const { data, error } = await _supabase.from('settings').select('*').eq('student_id', cached.student_id).maybeSingle();
    if (!error && !data) {
        localStorage.removeItem(SESSION_KEY);
        document.getElementById('login-page').classList.remove('hidden');
        showAlert('ไม่พบบัญชี', 'ไม่พบข้อมูลนักเรียนรายนี้ในระบบแล้ว กรุณาติดต่อผู้ดูแล', 'error');
        return;
    }
    userData = data || cached;
    if (data) localStorage.setItem(SESSION_KEY, JSON.stringify(userData));

    showNav();
    history.replaceState({ page: 'landing-page' }, '', '#landing-page');
    goToPage('landing-page', true);
    handleSharedPollLink();
});

async function doLogin() {
    const btn = document.getElementById('login-btn');
    const sid = document.getElementById('student_id_input').value.trim();
    if (!sid) return showAlert('แจ้งเตือน', 'กรุณากรอกเลขประจำตัวนักเรียนก่อนเข้าสู่ระบบ', 'warning');

    btn.disabled = true;
    const { data, error } = await _supabase.from('settings').select('*').eq('student_id', sid).maybeSingle();
    btn.disabled = false;

    if (error) return showAlert('เชื่อมต่อไม่ได้', 'ไม่สามารถติดต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'error');
    if (!data) return showAlert('ไม่พบข้อมูล', 'ไม่พบเลขประจำตัวนี้ในระบบ หากเป็นนักเรียนใหม่ให้แจ้งผู้ดูแลเพื่อเพิ่มรายชื่อ', 'error');

    userData = data;
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    document.getElementById('student_id_input').value = '';
    showNav();
    goToPage('landing-page');
    handleSharedPollLink();
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    userData = null;
    localChecklistState = {};
    myRoomBooking = null;
    selectedSeat = null;
    if (voteSubscription) { _supabase.removeChannel(voteSubscription); voteSubscription = null; }
    if (typeof unsubscribeBusRealtime === 'function') unsubscribeBusRealtime();
    document.getElementById('nav').classList.add('hidden');
    goToPage('login-page');
}

// เปิดลิงก์แชร์โหวต (?poll=23) แล้วพาไปหน้าโหวต พร้อมเลื่อนไปหาโพลนั้น
async function handleSharedPollLink() {
    const pollId = new URLSearchParams(window.location.search).get('poll');
    if (!pollId) return;
    history.replaceState({}, '', window.location.pathname);

    goToPage('vote-page');
    await loadVoteData();

    setTimeout(() => {
        const card = document.getElementById(`poll-card-${pollId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.boxShadow = '0 0 0 2px var(--gold)';
            setTimeout(() => { card.style.boxShadow = ''; }, 2500);
        }
    }, 150);
}
