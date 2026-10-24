let busAdminFloor = 1;
let busQrScanner = null;
let currentScanBookingId = null;

function switchBusAdminTab(tab) {
    ['layout', 'time', 'bookings', 'scan'].forEach(t => {
        document.getElementById(`bus-tab-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`bus-tabbtn-${t}`).className = t === tab ? 'tab on' : 'tab';
    });

    if (tab === 'layout') renderBusAdminLayout();
    if (tab === 'time') {
        if (busConfig && busConfig.booking_open_at) {
            const d = new Date(busConfig.booking_open_at);
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('bus-open-time-input').value = local;
        }
    }
    if (tab === 'bookings') renderBusAdminBookingsList();
    if (tab === 'scan') startBusScanner(); else stopBusScanner();
}

function switchBusAdminFloor(floor) {
    busAdminFloor = floor;
    document.getElementById('bus-adm-floor1-btn').className = floor === 1 ? 'on' : '';
    document.getElementById('bus-adm-floor2-btn').className = floor === 2 ? 'on' : '';
    renderBusAdminLayout();
}

function renderBusAdminLayout() {
    if (!busConfig) return;
    if (!busConfig.floor1_cells) busConfig.floor1_cells = {};
    if (!busConfig.floor2_cells) busConfig.floor2_cells = {};
    switchBusAdminFloorUI();
    const rows = busAdminFloor === 1 ? busConfig.floor1_rows : busConfig.floor2_rows;
    const cols = busAdminFloor === 1 ? busConfig.floor1_cols : busConfig.floor2_cols;
    document.getElementById('bus-inp-rows').value = rows;
    document.getElementById('bus-inp-cols').value = cols;

    const cellsKey = busAdminFloor === 1 ? 'floor1_cells' : 'floor2_cells';
    const cells = busConfig[cellsKey] || {};

    const container = document.getElementById('bus-admin-seat-map');
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    const gridWidth = cols * 62;
    container.style.width = gridWidth + 'px';
    if (container.parentElement) container.parentElement.style.width = gridWidth + 'px';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const cell = cells[key] || { type: 'seat', label: BUS_ALPHABET[r % 26] + (c + 1) };

            const div = document.createElement('div');
            div.className = 'seat seat-vacant';
            div.innerText = cell.label || '';
            if (cell.type === 'driver') { div.innerHTML = '<i class="fa-solid fa-user-tie"></i>'; div.style.cssText = 'background:var(--surface3);color:var(--gold)'; }
            if (cell.type === 'stairs') { div.innerHTML = '<i class="fa-solid fa-stairs"></i>'; div.style.cssText = 'background:var(--surface3);color:var(--gold)'; }
            if (cell.type === 'empty') { div.innerText = ''; div.style.cssText = 'background:transparent;border:1px dashed var(--line);'; }
            div.onclick = () => openBusCellEditor(r, c, cell);
            container.appendChild(div);
        }
    }

    renderBusAdminObjects();
}

function openBusCellEditor(r, c, cell) {
    document.getElementById('bus-cell-r').value = r;
    document.getElementById('bus-cell-c').value = c;
    document.getElementById('bus-cell-type').value = cell.type;
    document.getElementById('bus-cell-label').value = cell.type === 'seat' ? (cell.label || '') : '';
    document.getElementById('bus-cell-label-box').classList.toggle('hidden', cell.type !== 'seat');
    document.getElementById('bus-cell-modal').classList.remove('hidden');
}

function saveBusCellEditor() {
    const r = parseInt(document.getElementById('bus-cell-r').value);
    const c = parseInt(document.getElementById('bus-cell-c').value);
    const type = document.getElementById('bus-cell-type').value;
    const label = document.getElementById('bus-cell-label').value.trim();
    const key = `${r}-${c}`;

    const cellsKey = busAdminFloor === 1 ? 'floor1_cells' : 'floor2_cells';
    if (!busConfig[cellsKey]) busConfig[cellsKey] = {};

    busConfig[cellsKey][key] = type === 'seat'
        ? { type: 'seat', label: label || (BUS_ALPHABET[r % 26] + (c + 1)) }
        : { type };

    document.getElementById('bus-cell-modal').classList.add('hidden');
    renderBusAdminLayout();
}

function resetBusLayout() {
    const r = Math.min(Math.max(parseInt(document.getElementById('bus-inp-rows').value) || 10, 1), 26);
    const c = Math.min(Math.max(parseInt(document.getElementById('bus-inp-cols').value) || 4, 1), 12);
    if (busAdminFloor === 1) { busConfig.floor1_rows = r; busConfig.floor1_cols = c; }
    else { busConfig.floor2_rows = r; busConfig.floor2_cols = c; }
    renderBusAdminLayout();
}

// ---- จุดสังเกต: หน้าต่าง/ประตู (ติดผนัง) + ทีวี (วางได้ทุกจุด) ----
function openBusObjectModal() {
    document.getElementById('bus-obj-type').value = 'window';
    toggleBusObjFields();
    document.getElementById('bus-obj-modal').classList.remove('hidden');
}

function toggleBusObjFields() {
    const type = document.getElementById('bus-obj-type').value;
    document.getElementById('bus-obj-wall-fields').classList.toggle('hidden', type === 'tv');
    document.getElementById('bus-obj-tv-fields').classList.toggle('hidden', type !== 'tv');
}

function confirmAddBusObject() {
    const type = document.getElementById('bus-obj-type').value;
    const objKey = busAdminFloor === 1 ? 'floor1_objects' : 'floor2_objects';
    if (!busConfig[objKey]) busConfig[objKey] = [];

    if (type === 'tv') {
        const top = parseInt(document.getElementById('bus-obj-tv-top').value);
        const left = parseInt(document.getElementById('bus-obj-tv-left').value);
        busConfig[objKey].push({ type: 'tv', top, left });
    } else {
        const pos = parseInt(document.getElementById('bus-obj-pos').value);
        const side = document.getElementById('bus-obj-side').value;
        busConfig[objKey].push({ type, side, top: pos });
    }

    document.getElementById('bus-obj-modal').classList.add('hidden');
    renderBusAdminObjects();
}

function renderBusAdminObjects() {
    const container = document.getElementById('bus-admin-wall-container');
    container.innerHTML = '';
    const objKey = busAdminFloor === 1 ? 'floor1_objects' : 'floor2_objects';
    const objects = busConfig[objKey] || [];
    const wallClassMap = { window: 'win-v', door: 'door-v' };

    objects.forEach((obj, idx) => {
        const w = document.createElement('div');
        if (obj.type === 'tv') {
            w.className = 'tv-h';
            w.style.position = 'absolute';
            w.style.top = obj.top + '%';
            w.style.left = obj.left + '%';
            w.style.transform = 'translate(-50%, -50%)';
        } else {
            w.className = `wall-v ${wallClassMap[obj.type] || ''}`;
            w.style.top = obj.top + '%';
            w.style[obj.side === 'right' ? 'right' : 'left'] = '-4px';
            w.style.height = '60px';
        }
        w.style.pointerEvents = 'auto';
        w.style.cursor = 'pointer';
        w.title = 'คลิกเพื่อลบจุดนี้';
        w.onclick = () => { objects.splice(idx, 1); renderBusAdminObjects(); };
        container.appendChild(w);
    });
}

async function saveBusConfig() {
    const saveBtn = document.getElementById('bus-admin-save-btn');
    saveBtn.disabled = true;
    saveBtn.innerText = 'กำลังบันทึก...';

    const { error } = await _supabase.from('bus_room').upsert({
        id: 1,
        floor1_rows: busConfig.floor1_rows,
        floor1_cols: busConfig.floor1_cols,
        floor2_rows: busConfig.floor2_rows,
        floor2_cols: busConfig.floor2_cols,
        floor1_cells: busConfig.floor1_cells,
        floor2_cells: busConfig.floor2_cells,
        floor1_objects: busConfig.floor1_objects,
        floor2_objects: busConfig.floor2_objects
    });

    saveBtn.disabled = false;
    saveBtn.innerText = 'บันทึกผังที่นั่งรถบัส';

    if (!error) showAlert('สำเร็จ', 'บันทึกผังที่นั่งรถบัสเรียบร้อยแล้ว', 'success');
    else showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
}

async function saveBusOpenTime() {
    const val = document.getElementById('bus-open-time-input').value;
    if (!val) return showAlert('แจ้งเตือน', 'กรุณาเลือกวันและเวลา', 'warning');
    const iso = new Date(val).toISOString();
    const { error } = await _supabase.from('bus_room').upsert({ id: 1, booking_open_at: iso });
    if (!error) {
        busConfig.booking_open_at = iso;
        showAlert('สำเร็จ', 'ตั้งเวลาเปิดจองเรียบร้อยแล้ว', 'success');
    } else {
        showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
    }
}

function openBusBookingNow() {
    const iso = new Date(Date.now() - 60000).toISOString();
    _supabase.from('bus_room').upsert({ id: 1, booking_open_at: iso }).then(({ error }) => {
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        busConfig.booking_open_at = iso;
        switchBusAdminTab('time');
        showAlert('สำเร็จ', 'เปิดให้จองที่นั่งรถบัสแล้วตั้งแต่ตอนนี้', 'success');
    });
}

function renderBusAdminBookingsList() {
    const container = document.getElementById('bus-admin-bookings-list');
    container.innerHTML = '';
    if (!busBookings || busBookings.length === 0) {
        container.innerHTML = '<div class="empty">ยังไม่มีคนจองที่นั่งรถบัส</div>';
        return;
    }
    busBookings
        .slice()
        .sort((a, b) => a.floor - b.floor || String(a.seat_label).localeCompare(String(b.seat_label)))
        .forEach(b => {
            const row = document.createElement('div');
            row.className = 'row-item';
            row.innerHTML = `
                <div class="min-w-0">
                    <p class="font-semibold"><span class="gold">ชั้น ${Number(b.floor)} · ${esc(b.seat_label)}</span></p>
                    <p class="muted text-[11px] truncate">${esc(b.name)} (${esc(b.student_id)})</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="chip ${b.checked_in ? 'chip-ok' : ''}">${b.checked_in ? 'เช็กอินแล้ว' : 'ยังไม่เช็กอิน'}</span>
                    <button onclick="viewBusTicketAdmin(${Number(b.id)})" class="icon-btn"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="removeBusBookingAdmin(${Number(b.id)})" class="icon-btn del"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            container.appendChild(row);
        });
}

function viewBusTicketAdmin(id) {
    const booking = busBookings.find(b => b.id === id);
    if (booking) renderTicketModal(booking, false); // แอดมินดูตั๋วคนอื่น -> ไม่โชว์ปุ่มยกเลิก (ใช้ปุ่มลบในรายชื่อแทน)
}

function removeBusBookingAdmin(id) {
    showAlert('ยืนยัน', 'ต้องการลบที่นั่งจองของนักเรียนคนนี้ใช่หรือไม่?', 'confirm', async () => {
        const { error } = await _supabase.from('bus_bookings').delete().eq('id', id);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        showAlert('สำเร็จ', 'ลบรายการจองเรียบร้อย', 'success');
        await loadBusData();
        renderBusAdminBookingsList();
    });
}

// ---- ปริ้นตั๋วทั้งหมด (ปรับจำนวนแถว/คอลัมน์ได้เอง) ----
function openBusPrintModal() {
    if (!busBookings || busBookings.length === 0) {
        return showAlert('ไม่มีข้อมูล', 'ยังไม่มีนักเรียนคนไหนจองที่นั่งรถบัส', 'warning');
    }
    document.getElementById('bus-print-count-info').innerText = `ทั้งหมด ${busBookings.length} คน`;
    updateBusPrintPageEstimate();
    document.getElementById('bus-print-modal').classList.remove('hidden');
}

function updateBusPrintPageEstimate() {
    const rows = parseInt(document.getElementById('bus-print-rows').value) || 1;
    const cols = parseInt(document.getElementById('bus-print-cols').value) || 1;
    const perPage = rows * cols;
    const totalPages = Math.ceil((busBookings ? busBookings.length : 0) / perPage);
    document.getElementById('bus-print-estimate').innerText = `${rows} แถว x ${cols} คอลัมน์ = ${perPage} ใบ/แผ่น (ประมาณ ${totalPages} แผ่น)`;
}

function printAllBusTickets() {
    let rows = parseInt(document.getElementById('bus-print-rows').value) || 5;
    let cols = parseInt(document.getElementById('bus-print-cols').value) || 2;
    rows = Math.min(Math.max(rows, 1), 10);
    cols = Math.min(Math.max(cols, 1), 6);

    const sorted = busBookings.slice().sort((a, b) => a.floor - b.floor || String(a.seat_label).localeCompare(String(b.seat_label)));

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    const ticketCells = sorted.map(b => {
        const qrDiv = document.createElement('div');
        tempContainer.appendChild(qrDiv);
        new QRCode(qrDiv, {
            text: JSON.stringify({ bookingId: b.id, sid: b.student_id }),
            width: 90,
            height: 90
        });
        const canvas = qrDiv.querySelector('canvas');
        const qrDataUrl = canvas ? canvas.toDataURL('image/png') : '';

        const bookedDate = new Date(b.booked_at);
        const dateStr = bookedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = bookedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        return `
            <div class="ticket-cell">
                <div class="tk-header">
                    <div>
                        <p class="tk-brand">BUS BOARDING PASS</p>
                        <p class="tk-subtitle">ตั๋วรถบัสทัศนศึกษา</p>
                    </div>
                    <i class="fa-solid fa-bus"></i>
                </div>
                <div class="tk-body">
                    <div class="ticket-left">
                        <div class="tk-field">
                            <p class="tk-label">ชื่อผู้โดยสาร</p>
                            <p class="tk-value tk-name">${esc(b.name)}</p>
                        </div>
                        <div class="tk-field-row">
                            <div class="tk-field"><p class="tk-label">เลขประจำตัว</p><p class="tk-value">${esc(b.student_id)}</p></div>
                            <div class="tk-field"><p class="tk-label">ชั้น</p><p class="tk-value">${Number(b.floor)}</p></div>
                        </div>
                        <div class="tk-field-row">
                            <div class="tk-field"><p class="tk-label">วันที่จอง</p><p class="tk-value">${dateStr}</p></div>
                            <div class="tk-field"><p class="tk-label">เวลาที่จอง</p><p class="tk-value">${timeStr}</p></div>
                        </div>
                    </div>
                    <div class="tk-divider-wrap">
                        <div class="tk-divider"></div>
                    </div>
                    <div class="ticket-right">
                        <p class="tk-seat-label">ที่นั่ง</p>
                        <p class="tk-seat">${esc(b.seat_label)}</p>
                        <img src="${qrDataUrl}" class="tk-qr">
                    </div>
                </div>
            </div>
        `;
    });

    document.body.removeChild(tempContainer);

    const perPage = rows * cols;
    let pagesHTML = '';
    for (let i = 0; i < ticketCells.length; i += perPage) {
        pagesHTML += `<div class="print-page">${ticketCells.slice(i, i + perPage).join('')}</div>`;
    }

    document.getElementById('bus-print-modal').classList.add('hidden');

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
        <meta charset="UTF-8">
        <title>พิมพ์ตั๋วรถบัสทั้งหมด</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        <style>
            @page { size: A4; margin: 10mm; }
            * {
                box-sizing: border-box;
                font-family: 'Kanit', 'Sarabun', sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
            }
            body { margin: 0; }
            .print-page {
                display: grid;
                grid-template-columns: repeat(${cols}, 1fr);
                grid-template-rows: repeat(${rows}, 1fr);
                gap: 4mm;
                width: 190mm;
                height: 277mm;
                page-break-after: always;
            }
            .print-page:last-child { page-break-after: auto; }
            .ticket-cell {
                border: 1px dashed #9fc3e3;
                border-radius: 3mm;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                background: #f6fafd;
            }
            .tk-header {
                background: #d6e8fb;
                color: #34506b;
                padding: 2mm 3mm;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                flex-shrink: 0;
            }
            .tk-brand { font-size: 6.5pt; letter-spacing: 1.5px; font-weight: bold; margin: 0; opacity: .9; }
            .tk-subtitle { font-size: 8pt; font-weight: bold; margin: 0.3mm 0 0 0; }
            .tk-header i { font-size: 10pt; opacity: .85; margin-top: 0.5mm; }
            .tk-body { flex: 1; display: flex; min-height: 0; }
            .ticket-left { flex: 1; padding: 2mm 3mm; display: flex; flex-direction: column; justify-content: center; gap: 1.8mm; min-width: 0; }
            .tk-field-row { display: flex; gap: 3mm; }
            .tk-field { flex: 1; min-width: 0; }
            .tk-label { font-size: 5.5pt; color: #94a3b8; text-transform: uppercase; letter-spacing: .3px; margin: 0; }
            .tk-value { font-size: 7.5pt; font-weight: bold; color: #334155; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .tk-name { font-size: 9pt; }
            .tk-divider-wrap { position: relative; width: 0; flex-shrink: 0; }
            .tk-divider { height: 100%; border-left: 1px dashed #cbd5e1; }
            .ticket-right { width: 26mm; flex-shrink: 0; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; gap: 1mm; }
            .tk-seat-label { font-size: 5.5pt; color: #94a3b8; margin: 0; text-transform: uppercase; }
            .tk-seat { font-size: 12pt; font-weight: bold; color: #3f86c9; margin: 0; }
            .tk-qr { width: 14mm; height: 14mm; }
        </style>
        </head>
        <body>
            ${pagesHTML}
            <script>window.onload = () => { setTimeout(() => window.print(), 400); };<\/script>
        </body>
        </html>
    `);
    printWin.document.close();
}

// ---- สแกน QR (ไม่เช็คอินอัตโนมัติ - โชว์ข้อมูลแล้วให้แอดมินติ๊กยืนยันเอง) ----
function startBusScanner() {
    const el = document.getElementById('bus-qr-reader');
    if (!el) return;
    el.innerHTML = '';
    document.getElementById('bus-scan-detail').classList.add('hidden');
    currentScanBookingId = null;
    stopBusScanner();

    busQrScanner = new Html5Qrcode('bus-qr-reader');
    busQrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        onBusScanSuccess,
        () => {}
    ).catch(() => {
        el.innerHTML = '<p class="danger text-xs font-semibold text-center py-4">ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์</p>';
    });
}

function stopBusScanner() {
    if (busQrScanner) {
        const s = busQrScanner;
        busQrScanner = null;
        try { s.stop().then(() => s.clear()).catch(() => {}); } catch (e) { /* กล้องยังไม่เริ่ม */ }
    }
}

async function onBusScanSuccess(decodedText) {
    let payload;
    try { payload = JSON.parse(decodedText); } catch (e) { return; }
    if (!payload.bookingId) return;

    stopBusScanner();

    const { data: booking } = await _supabase.from('bus_bookings').select('*').eq('id', payload.bookingId).maybeSingle();

    if (!booking) {
        document.getElementById('bus-qr-reader').innerHTML = '<p class="danger text-xs font-semibold text-center py-4">ไม่พบข้อมูลการจองนี้ในระบบ</p>';
        setTimeout(() => startBusScanner(), 2000);
        return;
    }

    currentScanBookingId = booking.id;
    document.getElementById('scan-name').innerText = booking.name;
    document.getElementById('scan-id').innerText = booking.student_id;
    document.getElementById('scan-seat').innerText = `ชั้น ${booking.floor} - ${booking.seat_label}`;
    document.getElementById('scan-checkin-box').checked = !!booking.checked_in;
    document.getElementById('bus-scan-detail').classList.remove('hidden');
}

async function confirmBusCheckin() {
    if (!currentScanBookingId) return;
    const checked = document.getElementById('scan-checkin-box').checked;

    const { error } = await _supabase.from('bus_bookings').update({
        checked_in: checked,
        checked_in_at: checked ? new Date().toISOString() : null
    }).eq('id', currentScanBookingId);

    if (!error) {
        showAlert('สำเร็จ', checked ? 'บันทึกเช็คอินขึ้นรถเรียบร้อยแล้ว' : 'ยกเลิกสถานะเช็คอินแล้ว', 'success');
        await loadBusData();
    }

    document.getElementById('bus-scan-detail').classList.add('hidden');
    setTimeout(() => startBusScanner(), 500);
}


// ปุ่มชั้น 1/2 ในแผงแอดมินให้ตรงกับชั้นที่กำลังแก้
function switchBusAdminFloorUI() {
    document.getElementById('bus-adm-floor1-btn').className = busAdminFloor === 1 ? 'on' : '';
    document.getElementById('bus-adm-floor2-btn').className = busAdminFloor === 2 ? 'on' : '';
}
