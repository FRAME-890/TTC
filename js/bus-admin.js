let busAdminFloor = 1;
let busQrScanner = null;
let currentScanBookingId = null;

function switchBusAdminTab(tab) {
    ['layout', 'time', 'bookings', 'scan'].forEach(t => {
        document.getElementById(`bus-tab-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`bus-tabbtn-${t}`).className = t === tab
            ? 'px-4 py-2 rounded-xl text-xs font-bold bg-[#00b272] text-white transition'
            : 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 transition';
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
    document.getElementById('bus-adm-floor1-btn').className = floor === 1
        ? 'flex-1 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white' : 'flex-1 py-2 rounded-xl text-xs font-bold text-slate-500';
    document.getElementById('bus-adm-floor2-btn').className = floor === 2
        ? 'flex-1 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white' : 'flex-1 py-2 rounded-xl text-xs font-bold text-slate-500';
    renderBusAdminLayout();
}

function renderBusAdminLayout() {
    if (!busConfig) return;
    const rows = busAdminFloor === 1 ? busConfig.floor1_rows : busConfig.floor2_rows;
    const cols = busAdminFloor === 1 ? busConfig.floor1_cols : busConfig.floor2_cols;
    document.getElementById('bus-inp-rows').value = rows;
    document.getElementById('bus-inp-cols').value = cols;

    const cellsKey = busAdminFloor === 1 ? 'floor1_cells' : 'floor2_cells';
    const cells = busConfig[cellsKey] || {};

    const container = document.getElementById('bus-admin-seat-map');
    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    container.style.maxWidth = (cols * 60) + 'px';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const cell = cells[key] || { type: 'seat', label: BUS_ALPHABET[r % 26] + (c + 1) };

            const div = document.createElement('div');
            let styleClass = 'bg-white border-slate-200 text-slate-500 hover:border-[#00b272]';
            let content = cell.label;
            if (cell.type === 'driver') { styleClass = 'bg-slate-700 text-white'; content = '🚘'; }
            if (cell.type === 'stairs') { styleClass = 'bg-slate-400 text-white'; content = '🪜'; }
            if (cell.type === 'empty') { styleClass = 'bg-slate-100 border-dashed border-slate-300 text-slate-300'; content = ''; }

            div.className = 'aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold cursor-pointer border transition ' + styleClass;
            div.innerText = content;
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
    const r = parseInt(document.getElementById('bus-inp-rows').value) || 10;
    const c = parseInt(document.getElementById('bus-inp-cols').value) || 4;
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
            w.style[obj.side] = '-4px';
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

    const { error } = await _supabase.from('bus_room').update({
        floor1_rows: busConfig.floor1_rows,
        floor1_cols: busConfig.floor1_cols,
        floor2_rows: busConfig.floor2_rows,
        floor2_cols: busConfig.floor2_cols,
        floor1_cells: busConfig.floor1_cells,
        floor2_cells: busConfig.floor2_cells,
        floor1_objects: busConfig.floor1_objects,
        floor2_objects: busConfig.floor2_objects
    }).eq('id', 1);

    saveBtn.disabled = false;
    saveBtn.innerText = 'บันทึกผังที่นั่งรถบัส';

    if (!error) showAlert('สำเร็จ', 'บันทึกผังที่นั่งรถบัสเรียบร้อยแล้ว', 'success');
    else showAlert('ข้อผิดพลาด', 'บันทึกไม่สำเร็จ กรุณาลองใหม่', 'error');
}

async function saveBusOpenTime() {
    const val = document.getElementById('bus-open-time-input').value;
    if (!val) return showAlert('แจ้งเตือน', 'กรุณาเลือกวันและเวลา', 'warning');
    const iso = new Date(val).toISOString();
    const { error } = await _supabase.from('bus_room').update({ booking_open_at: iso }).eq('id', 1);
    if (!error) {
        busConfig.booking_open_at = iso;
        showAlert('สำเร็จ', 'ตั้งเวลาเปิดจองเรียบร้อยแล้ว', 'success');
    } else {
        showAlert('ข้อผิดพลาด', 'ตั้งเวลาไม่สำเร็จ', 'error');
    }
}

function renderBusAdminBookingsList() {
    const container = document.getElementById('bus-admin-bookings-list');
    container.innerHTML = '';
    if (!busBookings || busBookings.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 italic py-4">ยังไม่มีคนจองที่นั่งรถบัส</p>';
        return;
    }
    busBookings
        .slice()
        .sort((a, b) => a.floor - b.floor || String(a.seat_label).localeCompare(String(b.seat_label)))
        .forEach(b => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-2 text-xs';
            row.innerHTML = `
                <div>
                    <p class="font-bold text-slate-800">ชั้น ${b.floor} - ${b.seat_label}</p>
                    <p class="text-gray-400">${b.name} (${b.student_id})</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="${b.checked_in ? 'text-green-600' : 'text-gray-300'} font-bold text-[10px]">${b.checked_in ? 'เช็คอินแล้ว' : 'ยังไม่เช็คอิน'}</span>
                    <button onclick="viewBusTicketAdmin(${b.id})" class="text-sky-500 hover:text-sky-700"><i class="fa-solid fa-eye"></i></button>
                    <button onclick="removeBusBookingAdmin(${b.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
            container.appendChild(row);
        });
}

function viewBusTicketAdmin(id) {
    const booking = busBookings.find(b => b.id === id);
    if (booking) renderTicketModal(booking);
}

function removeBusBookingAdmin(id) {
    showAlert('ยืนยัน', 'ต้องการลบที่นั่งจองของนักเรียนคนนี้ใช่หรือไม่?', 'confirm', async () => {
        const { error } = await _supabase.from('bus_bookings').delete().eq('id', id);
        if (!error) {
            showAlert('สำเร็จ', 'ลบรายการจองเรียบร้อย', 'success');
            await loadBusData();
            renderBusAdminBookingsList();
        }
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

    // สร้าง QR code ของทุกใบแบบซ่อนไว้ก่อน แล้วแปลงเป็นรูปภาพ (data URL)
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
                <div class="ticket-left">
                    <p class="tk-brand">BOARDING PASS</p>
                    <p class="tk-name">${b.name}</p>
                    <div class="tk-row"><span>รหัส ${b.student_id}</span><span>ชั้น ${b.floor}</span></div>
                    <div class="tk-row"><span>${dateStr}</span><span>${timeStr}</span></div>
                </div>
                <div class="tk-divider"></div>
                <div class="ticket-right">
                    <p class="tk-seat-label">ที่นั่ง</p>
                    <p class="tk-seat">${b.seat_label}</p>
                    <img src="${qrDataUrl}" class="tk-qr">
                </div>
            </div>
        `;
    });

    document.body.removeChild(tempContainer);

    // แบ่งเป็นหน้าๆ ตามจำนวนแถว x คอลัมน์ที่ตั้งไว้
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
        <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; font-family: 'Kanit', 'Sarabun', sans-serif; }
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
                border: 1px dashed #94a3b8;
                border-radius: 4mm;
                display: flex;
                overflow: hidden;
                background: white;
            }
            .ticket-left { flex: 1; padding: 3mm; display: flex; flex-direction: column; justify-content: center; gap: 1.5mm; min-width: 0; }
            .tk-brand { font-size: 7pt; letter-spacing: 1px; color: #0ea5e9; font-weight: bold; margin: 0; }
            .tk-name { font-size: 11pt; font-weight: bold; color: #1e293b; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .tk-row { display: flex; justify-content: space-between; font-size: 8pt; color: #475569; }
            .tk-divider { border-left: 1px dashed #cbd5e1; }
            .ticket-right { width: 30mm; flex-shrink: 0; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; gap: 1mm; }
            .tk-seat-label { font-size: 6pt; color: #94a3b8; margin: 0; text-transform: uppercase; }
            .tk-seat { font-size: 14pt; font-weight: bold; color: #00b272; margin: 0; }
            .tk-qr { width: 18mm; height: 18mm; }
        </style>
        </head>
        <body>
            ${pagesHTML}
            <script>window.onload = () => { window.print(); };<\/script>
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

    busQrScanner = new Html5Qrcode('bus-qr-reader');
    busQrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        onBusScanSuccess,
        () => {}
    ).catch(() => {
        el.innerHTML = '<p class="text-red-500 text-xs font-bold text-center py-4">ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์</p>';
    });
}

function stopBusScanner() {
    if (busQrScanner) {
        busQrScanner.stop().catch(() => {});
        busQrScanner = null;
    }
}

async function onBusScanSuccess(decodedText) {
    let payload;
    try { payload = JSON.parse(decodedText); } catch (e) { return; }
    if (!payload.bookingId) return;

    stopBusScanner();

    const { data: booking } = await _supabase.from('bus_bookings').select('*').eq('id', payload.bookingId).maybeSingle();

    if (!booking) {
        document.getElementById('bus-qr-reader').innerHTML = '<p class="text-red-500 text-xs font-bold text-center py-4">ไม่พบข้อมูลการจองนี้ในระบบ</p>';
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
