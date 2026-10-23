// ==========================================================
//  fund.js — กองทุนห้องเรียน
// ==========================================================
const sumAmount = rows => rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
const fmtBaht = n => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadFundData() {
    try {
        const { data: config } = await _supabase.from('classroom_funds').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
        currentFundConfig = config;
        renderAdminFundStatus();

        if (!currentFundConfig) {
            document.getElementById('fund-target-title').innerText = 'ยังไม่มีหัวข้อเก็บเงิน';
            document.getElementById('user-payment-status-box').innerHTML = `<p class="muted text-sm py-6">ยังไม่มีการตั้งเป้าหมายกองทุนในปัจจุบัน</p>`;
            document.getElementById('total-fund-amount').innerText = '0.00';
            document.getElementById('fund-carry-info').innerText = '';
            document.getElementById('payment-history-rows').innerHTML = '';
            document.getElementById('withdrawal-history-rows').innerHTML = '';
            return;
        }

        const closed = !!currentFundConfig.is_closed;
        document.getElementById('fund-target-title').innerText =
            `${currentFundConfig.title} (${currentFundConfig.amount_per_person} บาท)${closed ? ' · ปิดรับแล้ว' : ''}`;

        const [pay, wd, payAll] = await Promise.all([
            _supabase.from('fund_payments').select('*').eq('fund_id', currentFundConfig.id).order('paid_at', { ascending: false }),
            _supabase.from('fund_withdrawals').select('*').order('withdrawn_at', { ascending: false }),   // ทุกรอบ
            _supabase.from('fund_payments').select('amount, fund_id')                                     // ทุกรอบ
        ]);
        paymentList = pay.data || [];
        withdrawalList = wd.data || [];
        const allPayments = payAll.data || [];

        // ยอดคงเหลือ = รายรับทุกรอบ − รายจ่ายทุกรอบ (ไม่รีเซ็ตเป็น 0 เมื่อเริ่มรอบใหม่)
        const balance = sumAmount(allPayments) - sumAmount(withdrawalList);
        const curId = String(currentFundConfig.id);
        const priorIncome = sumAmount(allPayments.filter(p => String(p.fund_id) !== curId));
        const priorExpense = sumAmount(withdrawalList.filter(w => String(w.fund_id) !== curId));
        const carry = priorIncome - priorExpense;
        const roundNet = (sumAmount(allPayments) - priorIncome) - (sumAmount(withdrawalList) - priorExpense);

        document.getElementById('total-fund-amount').innerText = fmtBaht(balance);
        document.getElementById('fund-carry-info').innerText =
            (allPayments.some(p => String(p.fund_id) !== curId) || withdrawalList.some(w => String(w.fund_id) !== curId))
                ? `ยกมาจากรอบก่อน ${fmtBaht(carry)} บาท  ·  รอบนี้ ${roundNet >= 0 ? '+' : ''}${fmtBaht(roundNet)} บาท`
                : '';

        let qr = 0, cash = 0;
        paymentList.forEach(p => { if (p.payment_method === 'qrcode') qr++; if (p.payment_method === 'cash') cash++; });
        document.getElementById('count-qr-payment').innerText = qr + ' คน';
        document.getElementById('count-cash-payment').innerText = cash + ' คน';

        const isAdmin = userData.role === 'admin';
        const tbody = document.getElementById('payment-history-rows');
        if (paymentList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4"><div class="empty">ยังไม่มีผู้ร่วมสมทบทุนในรอบนี้</div></td></tr>`;
        } else {
            tbody.innerHTML = paymentList.map(p => {
                let extra = '';
                if (p.payment_method === 'qrcode') {
                    extra = (p.slip_url && isAdmin)
                        ? `<a href="${esc(p.slip_url)}" target="_blank" rel="noopener" class="chip chip-info"><i class="fa-solid fa-image"></i> ดูสลิป</a>`
                        : (p.slip_url ? '<span class="chip chip-ok">ส่งสลิปแล้ว</span>' : '<span class="chip">ยังไม่ส่ง</span>');
                }
                const del = isAdmin ? `<button onclick="deletePaymentAdmin(${Number(p.id)}, '${esc(p.student_name)}')" class="icon-btn del" style="width:26px;height:26px" title="ลบรายการ"><i class="fa-solid fa-trash-can"></i></button>` : '';
                return `<tr>
                    <td class="muted">${esc(p.student_id)}</td>
                    <td class="font-semibold">${esc(p.student_name)}</td>
                    <td class="c ok font-semibold">${(parseFloat(p.amount) || 0).toFixed(2)}</td>
                    <td class="r"><span class="inline-flex items-center gap-2 justify-end">
                        <span class="chip ${p.payment_method === 'qrcode' ? 'chip-info' : 'chip-warn'}">${p.payment_method === 'qrcode' ? '<i class="fa-solid fa-qrcode"></i> QR' : '<i class="fa-solid fa-money-bill-wave"></i> เงินสด'}</span>
                        ${extra}${del}</span></td>
                </tr>`;
            }).join('');
        }

        const wTbody = document.getElementById('withdrawal-history-rows');
        wTbody.innerHTML = withdrawalList.length === 0
            ? `<tr><td colspan="2"><div class="empty">ยังไม่มีรายการรายจ่าย</div></td></tr>`
            : withdrawalList.map(w => `<tr>
                <td>${esc(w.title)}<span class="block text-[10px] muted">${new Date(w.withdrawn_at).toLocaleDateString('th-TH')}</span></td>
                <td class="r danger font-semibold">- ${(parseFloat(w.amount) || 0).toFixed(2)}</td></tr>`).join('');

        renderUserPaymentStatus();
    } catch (err) { console.error(err); }
}

function fundQrUrl() {
    return `https://promptpay.io/${encodeURIComponent(currentFundConfig.promptpay_id)}/${encodeURIComponent(currentFundConfig.amount_per_person)}.png`;
}

function renderUserPaymentStatus() {
    const box = document.getElementById('user-payment-status-box');
    const mine = paymentList.find(p => String(p.student_id) === String(userData.student_id));

    if (mine) {
        box.innerHTML = `
            <div class="inset p-6" style="border-color:rgba(127,209,160,.35)">
                <div class="text-3xl ok mb-2"><i class="fa-solid fa-circle-check"></i></div>
                <p class="display text-sm">ชำระเงินเสร็จสิ้นแล้ว</p>
                <p class="text-[10px] muted mt-1">ระบบบันทึกข้อมูลของคุณเรียบร้อย</p>
            </div>`;
        return;
    }

    if (currentFundConfig.is_closed) {
        box.innerHTML = `
            <div class="inset p-6">
                <div class="text-3xl warn mb-2"><i class="fa-solid fa-lock"></i></div>
                <p class="display text-sm">ปิดรับการสมทบทุนแล้ว</p>
                <p class="text-[10px] muted mt-1">รอบนี้ปิดการเก็บเงินแล้ว หากยังไม่ได้จ่ายให้ติดต่อกรรมการห้อง</p>
            </div>`;
        return;
    }

    box.innerHTML = `
        <div class="space-y-4">
            <p class="text-xs muted">สแกนจ่ายผ่าน Mobile Banking ตามยอดที่ระบุ</p>
            <div class="qr-box"><img id="fund-qr-image" src="${fundQrUrl()}" alt="PromptPay QR" class="mx-auto" style="width:176px;height:176px"></div>
            <button onclick="saveFundQr()" class="btn btn-ghost btn-block btn-sm"><i class="fa-solid fa-download"></i> บันทึกรูป QR ลงเครื่อง</button>
            <div class="inset p-3">
                <p class="text-[10px] muted">ยอดที่ต้องโอน</p>
                <p class="display text-xl gold">${esc(currentFundConfig.amount_per_person)} บาท</p>
            </div>
            <div class="dashed p-3 text-left">
                <label class="label"><i class="fa-solid fa-paperclip"></i> แนบสลิปการโอน (จำเป็น)</label>
                <input type="file" id="fund-slip-input" accept="image/*" class="hidden" onchange="handleSlipSelection()">
                <button onclick="document.getElementById('fund-slip-input').click()" class="btn btn-ghost btn-block btn-sm"><i class="fa-solid fa-cloud-arrow-up"></i> <span id="slip-upload-label">เลือกรูปสลิป</span></button>
                <div id="slip-preview-container" class="hidden mt-2 inset p-1"><img id="slip-preview-img" src="" class="mx-auto" style="max-height:130px;object-fit:contain"></div>
            </div>
            <button id="fund-pay-btn" onclick="submitQrPaymentSuccess()" class="btn btn-gold btn-block"><i class="fa-solid fa-receipt"></i> ยืนยันการโอนเงินสำเร็จ</button>
            <p class="text-[10px] faint italic">จ่ายเงินสด? ติดต่อกรรมการห้องเพื่อบันทึกข้อมูล</p>
        </div>`;
    selectedSlipFile = null;
}

// บันทึกรูป QR ลงเครื่อง (ถ้าเบราว์เซอร์ดาวน์โหลดตรงไม่ได้ จะเปิดรูปให้กดค้างบันทึกแทน)
async function saveFundQr() {
    if (!currentFundConfig) return;
    const url = fundQrUrl();
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `TTC-fund-QR-${currentFundConfig.amount_per_person}baht.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        showAlert('บันทึกแล้ว', 'บันทึกรูป QR ลงเครื่องเรียบร้อย นำไปสแกนจากแกลเลอรีในแอปธนาคารได้เลย', 'success');
    } catch (e) {
        window.open(url, '_blank');
        showAlert('เปิดรูป QR แล้ว', 'กดค้างที่รูปในแท็บใหม่แล้วเลือก "บันทึกรูปภาพ" เพื่อเก็บลงเครื่อง', 'warning');
    }
}

function handleSlipSelection() {
    const input = document.getElementById('fund-slip-input');
    if (!input.files.length) return;
    const file = input.files[0];
    if (file.size > 8 * 1024 * 1024) { input.value = ''; return showAlert('ไฟล์ใหญ่เกินไป', 'กรุณาเลือกรูปที่มีขนาดไม่เกิน 8 MB', 'warning'); }
    selectedSlipFile = file;
    document.getElementById('slip-upload-label').innerText = `เปลี่ยนรูป (${(file.size / 1024).toFixed(1)} KB)`;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('slip-preview-img').src = e.target.result;
        document.getElementById('slip-preview-container').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function submitQrPaymentSuccess() {
    if (!currentFundConfig || !userData) return;
    if (currentFundConfig.is_closed) return showAlert('ปิดรับแล้ว', 'การเก็บเงินรอบนี้ปิดแล้ว', 'warning');
    if (!selectedSlipFile) return showAlert('แจ้งเตือน', 'โปรดแนบรูปสลิปการโอนเงินก่อนกดยืนยัน', 'warning');

    showAlert('ยืนยันการทำรายการ', `ยืนยันการโอนสมทบทุน ${currentFundConfig.amount_per_person} บาท พร้อมสลิปแนบ ใช่หรือไม่?`, 'confirm', async () => {
        const btn = document.getElementById('fund-pay-btn');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch spin"></i> กำลังอัปโหลดสลิป...`;
        const reset = () => { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-receipt"></i> ยืนยันการโอนเงินสำเร็จ`; };

        let slipUrl = null;
        try {
            const ext = (selectedSlipFile.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';
            const name = `slip_${userData.student_id}_${Date.now()}.${ext}`;
            const { error: upErr } = await _supabase.storage.from('fund-files').upload(name, selectedSlipFile);
            if (upErr) throw upErr;
            slipUrl = _supabase.storage.from('fund-files').getPublicUrl(name).data.publicUrl;
        } catch (e) {
            console.error(e);
            reset();
            return showAlert('ข้อผิดพลาด', 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'error');
        }

        const { error } = await _supabase.from('fund_payments').insert([{
            fund_id: currentFundConfig.id, student_id: userData.student_id, student_name: userData.name,
            amount: currentFundConfig.amount_per_person, payment_method: 'qrcode', slip_url: slipUrl
        }]);
        if (error) { reset(); return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error'); }

        showAlert('สำเร็จ', 'ระบบได้รับข้อมูลและสลิปของคุณเรียบร้อยแล้ว', 'success');
        selectedSlipFile = null;
        loadFundData();
    });
}

async function fetchStudentNameForCash(studentId) {
    const preview = document.getElementById('cash-name-preview');
    const id = studentId.trim();
    if (!id) { preview.innerText = 'พิมพ์รหัสเพื่อค้นหาชื่อ...'; preview.className = 'dashed px-3 py-2 text-xs muted'; resolvedCashStudentName = ''; return; }
    const { data } = await _supabase.from('settings').select('name').eq('student_id', id).maybeSingle();
    if (document.getElementById('cash-student-id').value.trim() !== id) return; // มีการพิมพ์ต่อแล้ว ทิ้งผลเก่า
    if (data) {
        resolvedCashStudentName = data.name;
        preview.innerText = `✓ พบนักเรียน: ${data.name}`;
        preview.className = 'dashed px-3 py-2 text-xs ok font-semibold';
    } else {
        resolvedCashStudentName = '';
        preview.innerText = '✗ ไม่พบรหัสนี้ในระบบ';
        preview.className = 'dashed px-3 py-2 text-xs danger';
    }
}

async function addCashPaymentByAdmin() {
    if (!currentFundConfig) return showAlert('ข้อผิดพลาด', 'โปรดสร้างรอบเก็บเงินกองทุนก่อน', 'error');
    const input = document.getElementById('cash-student-id');
    const sid = input.value.trim();
    if (!sid || !resolvedCashStudentName) return showAlert('แจ้งเตือน', 'กรุณาระบุรหัสนักเรียนที่ถูกต้องและตรวจชื่อก่อนบันทึก', 'warning');

    const { data: dup } = await _supabase.from('fund_payments').select('id').eq('fund_id', currentFundConfig.id).eq('student_id', sid).maybeSingle();
    if (dup) return showAlert('ซ้ำ', 'นักเรียนคนนี้ชำระเงินในรอบนี้ไปแล้ว', 'error');

    const { error } = await _supabase.from('fund_payments').insert([{
        fund_id: currentFundConfig.id, student_id: sid, student_name: resolvedCashStudentName,
        amount: currentFundConfig.amount_per_person, payment_method: 'cash'
    }]);
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');

    showAlert('สำเร็จ', `บันทึกเงินสดของ ${resolvedCashStudentName} เรียบร้อยแล้ว`, 'success');
    input.value = ''; fetchStudentNameForCash('');
    loadFundData();
}

function deletePaymentAdmin(id, name) {
    showAlert('ลบรายการชำระเงิน', `ลบรายการของ ${name} ออกจากรอบนี้? (เช่น สลิปปลอม หรือบันทึกผิด) นักเรียนจะกลับไปเป็นสถานะยังไม่จ่าย`, 'confirm', async () => {
        const { error } = await _supabase.from('fund_payments').delete().eq('id', id);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'ลบรายการเรียบร้อยแล้ว', 'success');
        loadFundData();
    });
}

async function addFundWithdrawalByAdmin() {
    if (!currentFundConfig) return showAlert('ข้อผิดพลาด', 'โปรดสร้างรอบเก็บเงินกองทุนก่อน', 'error');
    const titleEl = document.getElementById('withdraw-title');
    const amountEl = document.getElementById('withdraw-amount');
    const title = titleEl.value.trim();
    const amount = parseFloat(amountEl.value);
    if (!title || !amount || amount <= 0) return showAlert('แจ้งเตือน', 'กรุณากรอกเหตุผลและจำนวนเงิน (มากกว่า 0)', 'warning');

    showAlert('ยืนยันรายจ่าย', `บันทึกรายจ่าย ${amount} บาท สำหรับ "${title}" ใช่หรือไม่?`, 'confirm', async () => {
        const { error } = await _supabase.from('fund_withdrawals').insert([{ fund_id: currentFundConfig.id, title, amount }]);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'บันทึกรายจ่ายเรียบร้อยแล้ว', 'success');
        titleEl.value = ''; amountEl.value = '';
        loadFundData();
    });
}

async function saveFundConfig() {
    const title = document.getElementById('adm-fund-title').value.trim();
    const money = parseFloat(document.getElementById('adm-fund-amount').value);
    const pp = document.getElementById('adm-fund-pp').value.trim();
    if (!title || !money || money <= 0 || !pp) return showAlert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง', 'warning');

    const { error } = await _supabase.from('classroom_funds').insert([{ title, amount_per_person: money, promptpay_id: pp }]);
    if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    showAlert('สำเร็จ', 'เริ่มรอบเก็บเงินใหม่เรียบร้อยแล้ว ยอดคงเหลือเดิมยกมารวมให้อัตโนมัติ', 'success');
    loadFundData();
}

// ---------- แอดมิน: ปิด / เปิดรับเงินรอบปัจจุบัน ----------
function renderAdminFundStatus() {
    const box = document.getElementById('adm-fund-status');
    const btn = document.getElementById('adm-fund-toggle-btn');
    if (!box || !btn) return;
    if (!currentFundConfig) {
        box.innerText = 'ยังไม่มีรอบเก็บเงิน — เริ่มรอบใหม่ด้านซ้าย';
        btn.disabled = true;
        return;
    }
    const closed = !!currentFundConfig.is_closed;
    box.innerHTML = `
        <p class="display text-sm mb-2">${esc(currentFundConfig.title)} · ${esc(currentFundConfig.amount_per_person)} บาท/คน</p>
        <span class="chip ${closed ? 'chip-danger' : 'chip-ok'}"><i class="fa-solid ${closed ? 'fa-lock' : 'fa-lock-open'}"></i> ${closed ? 'ปิดรับแล้ว' : 'กำลังเปิดรับ'}</span>`;
    btn.disabled = false;
    btn.className = `btn ${closed ? 'btn-ok' : 'btn-danger'} btn-block`;
    btn.innerHTML = closed ? '<i class="fa-solid fa-lock-open"></i> เปิดรับเงินอีกครั้ง' : '<i class="fa-solid fa-lock"></i> ปิดการเก็บเงินรอบนี้';
}

function toggleFundClosedAdmin() {
    if (!currentFundConfig) return;
    const closing = !currentFundConfig.is_closed;
    showAlert(closing ? 'ปิดการเก็บเงิน' : 'เปิดรับเงินอีกครั้ง',
        closing ? 'นักเรียนจะสแกนจ่ายรอบนี้ไม่ได้อีก ใช่หรือไม่? (ยอดคงเหลือยังอยู่ครบ)' : 'เปิดให้นักเรียนสแกนจ่ายรอบนี้ได้อีกครั้ง ใช่หรือไม่?',
        'confirm', async () => {
            const { error } = await _supabase.from('classroom_funds').update({ is_closed: closing }).eq('id', currentFundConfig.id);
            if (error) {
                const missing = error.code === '42703' || error.code === 'PGRST204' || /is_closed/i.test(error.message || '');
                return showAlert('ข้อผิดพลาด', missing
                    ? 'ตาราง classroom_funds ยังไม่มีคอลัมน์ is_closed — ให้รันคำสั่งในไฟล์ supabase-setup.sql (ข้อ 3) ใน Supabase ก่อน'
                    : dbErrorText(error), 'error');
            }
            currentFundConfig.is_closed = closing;
            showAlert('สำเร็จ', closing ? 'ปิดการเก็บเงินรอบนี้แล้ว' : 'เปิดรับเงินอีกครั้งแล้ว', 'success');
            loadFundData();
        });
}
