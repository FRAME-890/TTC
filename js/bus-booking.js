// ==========================================================
//  bus-booking.js — จองที่นั่งรถบัส (ฝั่งนักเรียน)
// ==========================================================
let busConfig = null;
let busBookings = [];
let currentBusFloor = 1;
let selectedBusSeat = null;   // { floor, key, label }
let myBusBooking = null;
let busSubscription = null;

const BUS_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BUS_DEFAULT = { id: 1, floor1_rows: 10, floor1_cols: 4, floor2_rows: 10, floor2_cols: 4, floor1_cells: {}, floor2_cells: {}, floor1_objects: [], floor2_objects: [] };

async function loadBusData() {
    let { data: config } = await _supabase.from('bus_room').select('*').eq('id', 1).maybeSingle();
    if (!config) {
        // ยังไม่มีแถวตั้งค่ารถบัส: ใช้ค่าเริ่มต้น (แอดมินกดบันทึกผังครั้งแรกแล้วจะถูกสร้างลงฐานข้อมูลเอง)
        config = { ...BUS_DEFAULT, booking_open_at: null };
    }
    ['floor1_rows', 'floor1_cols', 'floor2_rows', 'floor2_cols'].forEach(k => { if (!config[k]) config[k] = BUS_DEFAULT[k]; });
    busConfig = config;

    const { data: bookings } = await _supabase.from('bus_bookings').select('*');
    busBookings = bookings || [];
    myBusBooking = busBookings.find(b => String(b.student_id) === String(userData.student_id)) || null;

    if (document.getElementById('bus-seat-map')) renderBusUI();
    subscribeBusRealtime();
}

// อัปเดตอัตโนมัติเมื่อมีคนจอง / ยกเลิก / เช็กอิน
function subscribeBusRealtime() {
    if (busSubscription) return;
    busSubscription = _supabase
        .channel('bus_bookings_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_bookings' }, handleBusRealtimeChange)
        .subscribe();
}

function unsubscribeBusRealtime() {
    if (busSubscription) { _supabase.removeChannel(busSubscription); busSubscription = null; }
}

async function handleBusRealtimeChange() {
    if (!userData) return;
    const { data: bookings } = await _supabase.from('bus_bookings').select('*');
    busBookings = bookings || [];
    myBusBooking = busBookings.find(b => String(b.student_id) === String(userData.student_id)) || null;
    renderBusUI();

    const tab = document.getElementById('bus-tab-bookings');
    if (tab && !tab.classList.contains('hidden') && typeof renderBusAdminBookingsList === 'function') renderBusAdminBookingsList();
}

function switchBusFloor(floor) {
    currentBusFloor = floor;
    selectedBusSeat = null;
    document.getElementById('bus-display-seat').innerText = '--';
    renderBusUI();
}

function isBusBookingOpen() {
    if (!busConfig || !busConfig.booking_open_at) return false;
    return new Date() >= new Date(busConfig.booking_open_at);
}

function renderBusUI() {
    document.getElementById('bus-floor1-btn').className = currentBusFloor === 1 ? 'on' : '';
    document.getElementById('bus-floor2-btn').className = currentBusFloor === 2 ? 'on' : '';

    const banner = document.getElementById('bus-status-banner');
    if (isBusBookingOpen()) {
        banner.classList.add('hidden');
    } else {
        banner.classList.remove('hidden');
        banner.className = 'max-w-3xl mx-auto dashed text-center text-xs warn font-semibold py-3 px-4 mb-5';
        const t = busConfig && busConfig.booking_open_at ? new Date(busConfig.booking_open_at).toLocaleString('th-TH') : 'ยังไม่กำหนด';
        banner.innerText = `ยังไม่ถึงเวลาเปิดจอง (เปิดจอง: ${t}) — ดูผังได้แต่ยังกดจองไม่ได้`;
    }

    document.getElementById('bus-my-seat-btn').classList.toggle('hidden', !myBusBooking);
    document.getElementById('bus-confirm-btn').classList.toggle('hidden', !!myBusBooking);
    renderBusMap();
    renderBusObjects();
}

function renderBusMap() {
    const container = document.getElementById('bus-seat-map');
    container.innerHTML = '';
    if (!busConfig) return;

    const rows = currentBusFloor === 1 ? busConfig.floor1_rows : busConfig.floor2_rows;
    const cols = currentBusFloor === 1 ? busConfig.floor1_cols : busConfig.floor2_cols;
    const cells = (currentBusFloor === 1 ? busConfig.floor1_cells : busConfig.floor2_cells) || {};

    container.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    const gridWidth = cols * 62;
    container.style.width = gridWidth + 'px';
    if (container.parentElement) container.parentElement.style.width = gridWidth + 'px';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const cell = cells[key] || { type: 'seat', label: BUS_ALPHABET[r % 26] + (c + 1) };
            const outer = document.createElement('div');

            if (cell.type === 'empty') { outer.style.aspectRatio = '1/1'; container.appendChild(outer); continue; }
            if (cell.type === 'driver' || cell.type === 'stairs') {
                outer.className = 'seat';
                outer.style.cssText = 'background:var(--surface3);color:var(--gold);cursor:default;border:1px solid var(--line2)';
                outer.innerHTML = cell.type === 'driver' ? '<i class="fa-solid fa-user-tie"></i>' : '<i class="fa-solid fa-stairs"></i>';
                outer.title = cell.type === 'driver' ? 'ที่นั่งคนขับ' : 'บันได';
                container.appendChild(outer);
                continue;
            }

            const booking = busBookings.find(b => b.floor === currentBusFloor && b.seat_key === key);
            const isMine = booking && String(booking.student_id) === String(userData.student_id);
            const isSelected = selectedBusSeat && selectedBusSeat.floor === currentBusFloor && selectedBusSeat.key === key;

            const col = document.createElement('div');
            col.className = 'flex flex-col items-center gap-1';

            const seat = document.createElement('div');
            seat.className = 'seat ' + (booking ? (isMine ? 'seat-selected' : 'seat-occupied') : (isSelected ? 'seat-selected' : 'seat-vacant'));
            seat.innerText = cell.label;
            if (!booking && isBusBookingOpen() && !myBusBooking) seat.onclick = () => selectBusSeat(key, cell.label);
            col.appendChild(seat);

            if (booking) {
                const tag = document.createElement('span');
                tag.className = 'text-[8px] faint font-semibold truncate text-center';
                tag.style.maxWidth = '54px';
                tag.innerText = booking.name;
                col.appendChild(tag);
            }
            outer.appendChild(col);
            container.appendChild(outer);
        }
    }
}

function renderBusObjects() {
    const container = document.getElementById('bus-wall-container');
    container.innerHTML = '';
    if (!busConfig) return;
    const objects = (currentBusFloor === 1 ? busConfig.floor1_objects : busConfig.floor2_objects) || [];
    const labelMap = { window: 'หน้าต่าง', door: 'ประตู', tv: 'ทีวี' };

    objects.forEach(obj => {
        const w = document.createElement('div');
        if (obj.type === 'tv') {
            w.className = 'tv-h';
            w.style.cssText = `position:absolute;top:${obj.top}%;left:${obj.left}%;transform:translate(-50%,-50%)`;
        } else {
            w.className = `wall-v ${obj.type === 'door' ? 'door-v' : 'win-v'}`;
            w.style.top = obj.top + '%';
            w.style[obj.side === 'right' ? 'right' : 'left'] = '-4px';
            w.style.height = '60px';
        }
        w.title = labelMap[obj.type] || obj.type;
        container.appendChild(w);
    });
}

function selectBusSeat(key, label) {
    if (!isBusBookingOpen()) return showAlert('ยังไม่เปิดจอง', 'กรุณารอถึงเวลาเปิดจองที่นั่งรถบัส', 'warning');
    if (myBusBooking) return showAlert('จองแล้ว', 'คุณมีที่นั่งรถบัสแล้ว (จองได้คนละ 1 ที่นั่ง)', 'warning');
    selectedBusSeat = { floor: currentBusFloor, key, label };
    document.getElementById('bus-display-seat').innerText = `ชั้น ${currentBusFloor} · ${label}`;
    renderBusMap();
}

async function confirmBusBooking() {
    if (!selectedBusSeat) return showAlert('แจ้งเตือน', 'กรุณาเลือกที่นั่งก่อน', 'warning');
    if (!isBusBookingOpen()) return showAlert('ยังไม่เปิดจอง', 'กรุณารอถึงเวลาเปิดจองที่นั่งรถบัส', 'warning');

    const { data: existing } = await _supabase.from('bus_bookings').select('*').eq('student_id', userData.student_id).maybeSingle();
    if (existing) { await loadBusData(); return showAlert('จองแล้ว', 'คุณมีที่นั่งรถบัสอยู่แล้ว', 'warning'); }

    const { error } = await _supabase.from('bus_bookings').insert([{
        student_id: userData.student_id, name: userData.name,
        floor: selectedBusSeat.floor, seat_key: selectedBusSeat.key, seat_label: selectedBusSeat.label
    }]);
    if (error) {
        selectedBusSeat = null;
        document.getElementById('bus-display-seat').innerText = '--';
        await loadBusData();
        return showAlert('ข้อผิดพลาด', 'ที่นั่งนี้อาจเพิ่งถูกจองไป กรุณาเลือกใหม่อีกครั้ง', 'error');
    }
    selectedBusSeat = null;
    document.getElementById('bus-display-seat').innerText = '--';
    await loadBusData();
    showMyBusTicket();
}

function cancelMyBusBooking() {
    if (!myBusBooking) return;
    const warn = myBusBooking.checked_in
        ? `คุณเช็กอินขึ้นรถแล้ว ต้องการยกเลิกที่นั่ง ${myBusBooking.seat_label} จริงหรือไม่?`
        : `ต้องการยกเลิกที่นั่ง ${myBusBooking.seat_label} ใช่หรือไม่? คุณจะกลับมาจองใหม่ได้อีกครั้ง`;

    showAlert('ยืนยันการยกเลิก', warn, 'confirm', async () => {
        const { error } = await _supabase.from('bus_bookings').delete().eq('id', myBusBooking.id);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        closeBusTicket();
        await loadBusData();
        showAlert('สำเร็จ', 'ยกเลิกที่นั่งรถบัสเรียบร้อยแล้ว', 'success');
    });
}

// ตั๋ว Boarding Pass — ใช้ร่วมกัน: นักเรียนดูตั๋วตัวเอง (ยกเลิกได้) / แอดมินดูตั๋วทุกคน (ยกเลิกไม่ได้)
function renderTicketModal(booking, allowCancel) {
    const d = new Date(booking.booked_at);
    document.getElementById('bus-ticket-name').innerText = booking.name;
    document.getElementById('bus-ticket-id').innerText = booking.student_id;
    document.getElementById('bus-ticket-floor').innerText = 'ชั้น ' + booking.floor;
    document.getElementById('bus-ticket-seat').innerText = booking.seat_label;
    document.getElementById('bus-ticket-date').innerText = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('bus-ticket-time').innerText = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const checkin = document.getElementById('bus-ticket-checkin');
    checkin.innerText = booking.checked_in ? '✓ เช็กอินขึ้นรถแล้ว' : 'ยังไม่เช็กอิน';
    checkin.style.color = booking.checked_in ? '#2e8b57' : '#8a7a52';

    const qrBox = document.getElementById('bus-ticket-qr');
    qrBox.innerHTML = '';
    new QRCode(qrBox, { text: JSON.stringify({ bookingId: booking.id, sid: booking.student_id }), width: 100, height: 100 });

    document.getElementById('bus-ticket-cancel-btn').classList.toggle('hidden', !allowCancel);
    document.getElementById('bus-ticket-modal').classList.remove('hidden');
}

async function showMyBusTicket() {
    if (!myBusBooking) {
        const { data } = await _supabase.from('bus_bookings').select('*').eq('student_id', userData.student_id).maybeSingle();
        myBusBooking = data;
    }
    if (!myBusBooking) return showAlert('ยังไม่ได้จอง', 'คุณยังไม่มีที่นั่งรถบัส', 'warning');
    renderTicketModal(myBusBooking, true);
}

function closeBusTicket() { document.getElementById('bus-ticket-modal').classList.add('hidden'); }
