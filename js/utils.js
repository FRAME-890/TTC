// ==========================================================
//  utils.js — ฟังก์ชันช่วยเหลือกลาง: ป้องกัน XSS, แจ้งเตือน, นำทางหน้า
// ==========================================================

// แปลงข้อความจากผู้ใช้ให้ปลอดภัยก่อนใส่ใน innerHTML (กัน XSS)
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// แปลงข้อความ error จากฐานข้อมูลให้เป็นภาษาที่เข้าใจง่าย
function dbErrorText(error) {
    if (!error) return '';
    const msg = String(error.message || error);
    if (error.code === '42501' || /row-level security/i.test(msg)) {
        return 'ฐานข้อมูลไม่อนุญาตให้ทำรายการนี้ (Row Level Security) — ให้เปิดสิทธิ์ตามไฟล์ supabase-setup.sql';
    }
    if (error.code === '23505') return 'ข้อมูลนี้มีอยู่ในระบบแล้ว (ซ้ำ)';
    if (error.code === '23503') return 'ข้อมูลนี้ถูกอ้างอิงอยู่ในตารางอื่น จึงทำรายการไม่ได้';
    return msg;
}

const ALERT_ICONS = {
    success: 'fa-circle-check', error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation', confirm: 'fa-circle-question'
};

let alertHideTimer = null;

function showAlert(title, message, type = 'success', onConfirm = null) {
    const modal = document.getElementById('custom-alert-modal');
    clearTimeout(alertHideTimer); // กันตัวหน่วงเวลาปิดของหน้าต่างก่อนหน้า มาซ่อนหน้าต่างใหม่ทิ้ง
    const card = modal.querySelector('.modal');
    document.getElementById('alert-title').innerText = title;
    document.getElementById('alert-message').innerText = message;
    document.getElementById('alert-icon-box').className = 'alert-ico ai-' + type;
    document.getElementById('alert-icon').className = 'fa-solid ' + (ALERT_ICONS[type] || ALERT_ICONS.success);

    const actions = document.getElementById('alert-action-buttons');
    if (type === 'confirm') {
        actions.innerHTML = `
            <button onclick="closeCustomAlert()" class="btn btn-quiet flex-1">ยกเลิก</button>
            <button id="alert-confirm-execute" class="btn btn-gold flex-1">ยืนยัน</button>`;
        document.getElementById('alert-confirm-execute').onclick = () => {
            closeCustomAlert();
            if (onConfirm) onConfirm();
        };
    } else {
        actions.innerHTML = `<button onclick="closeCustomAlert()" class="btn btn-gold btn-block">ตกลง</button>`;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        card.classList.remove('scale-95');
    }, 10);
}

function closeCustomAlert() {
    const modal = document.getElementById('custom-alert-modal');
    modal.classList.add('opacity-0');
    modal.querySelector('.modal').classList.add('scale-95');
    clearTimeout(alertHideTimer);
    alertHideTimer = setTimeout(() => modal.classList.add('hidden'), 300);
}

function showNav() {
    const isAdmin = userData.role === 'admin';
    document.getElementById('admin-trigger').classList.toggle('hidden', !isAdmin);
    document.getElementById('nav-name').innerText = userData.name || '-';
    document.getElementById('nav-id').innerText = 'ID: ' + userData.student_id;
    document.getElementById('nav-avatar').innerText = (userData.name || '?').trim().charAt(0);
    document.getElementById('nav').classList.remove('hidden');
}

const ALL_PAGES = ['login-page', 'landing-page', 'main-app', 'bus-page', 'duty-page', 'homework-page', 'fund-page', 'vote-page', 'admin-panel'];

function goToPage(id, isBackNavigation) {
    ALL_PAGES.forEach(p => {
        const el = document.getElementById(p);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');

    if (id === 'landing-page' && userData) {
        document.getElementById('landing-name').innerText = userData.name;
    }
    if (id !== 'vote-page' && voteSubscription) {
        _supabase.removeChannel(voteSubscription);
        voteSubscription = null;
    }
    if (id !== 'bus-page' && id !== 'admin-panel' && typeof unsubscribeBusRealtime === 'function') {
        unsubscribeBusRealtime();
    }
    if (id !== 'admin-panel' && typeof stopBusScanner === 'function') stopBusScanner();
    window.scrollTo({ top: 0 });

    // บันทึกลงประวัติเบราว์เซอร์ เพื่อให้ปุ่มย้อนกลับของเครื่องใช้งานได้
    if (!isBackNavigation) history.pushState({ page: id }, '', '#' + id);
}

window.addEventListener('popstate', (e) => {
    if (!userData) return;
    const target = (e.state && e.state.page) ? e.state.page : 'landing-page';
    if (target === 'login-page') return;
    if (document.getElementById(target)) goToPage(target, true);
});
