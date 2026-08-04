window.onload = () => {
    const savedSession = localStorage.getItem('thaiticket_session');
    if (savedSession) {
        userData = JSON.parse(savedSession);
        showNav();
        goToPage('landing-page');
        handleSharedPollLink();
    }
};

async function doLogin() {
    const sid = document.getElementById('student_id_input').value.trim();
    if(!sid) return showAlert("แจ้งเตือน", "กรุณากรอกรหัสประจำตัวนักเรียนก่อนเข้าสู่ระบบ", "warning");

    const { data, error } = await _supabase.from('settings').select('*').eq('student_id', sid).maybeSingle();
    if (error || !data) return showAlert("ข้อผิดพลาด", "ไม่พบข้อมูลนักเรียนรายนี้ในระบบฐานข้อมูล", "error");

    userData = data;
    localStorage.setItem('thaiticket_session', JSON.stringify(userData));
    showNav();
    goToPage('landing-page');
    handleSharedPollLink();
}

function logout() {
    localStorage.removeItem('thaiticket_session');
    userData = null;
    document.getElementById('nav').classList.add('hidden');
    if(voteSubscription) _supabase.removeChannel(voteSubscription);
    goToPage('login-page');
}

// ---- เปิดลิงก์แชร์โหวต (?poll=23) แล้วพาไปหน้าโหวตพร้อมเลื่อนจอไปหาโพลนั้น ----
async function handleSharedPollLink() {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('poll');
    if (!pollId) return;

    // เอา query string ออกจาก URL ทันที กัน redirect ซ้ำตอน refresh หน้าซ้ำ
    history.replaceState({}, '', window.location.pathname);

    goToPage('vote-page');
    await loadVoteData();

    setTimeout(() => {
        const card = document.getElementById(`poll-card-${pollId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('ring-4', 'ring-rose-400', 'ring-offset-2');
            setTimeout(() => card.classList.remove('ring-4', 'ring-rose-400', 'ring-offset-2'), 2500);
        }
    }, 150);
}
