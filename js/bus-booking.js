let busConfig = null;
let busBookings = [];
let currentBusFloor = 1;
let selectedBusSeat = null;   // { floor, key, label }
let myBusBooking = null;
let busSubscription = null;

const BUS_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function loadBusData() {
    const { data: config } = await _supabase.from('bus_room').select('*').eq('id', 1).maybeSingle();
    busConfig = config;

    const { data: bookings } = await _supabase.from('bus_bookings').select('*');
    busBookings = bookings || [];

    myBusBooking = busBookings.find(b => String(b.student_id) === String(userData.student_id)) || null;
    if (document.getElementById('bus-seat-map')) renderBusUI();

    subscribeBusRealtime();
}

// ---- REALTIME: อัปเดตอัตโนมัติเมื่อมีคนจอง/ยกเลิก/เช็คอินที่นั่งรถบัส ----
function subscribeBusRealtime() {
    if (busSubscription) return;
    busSubscription = _supabase
        .channel('bus_bookings_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bus_bookings' }, handleBusRealtimeChange)
        .subscribe();
}

function unsubscribeBusRealtime() {
    if (busSubscription) {
        _supabase.removeChannel(busSubscription);
        busSubscription = null;
    }
}

async function handleBusRealtimeChange() {
    const { data: bookings } = await _supabase.from('bus_bookings').select('*');
    busBookings = bookings || [];
    myBusBooking = busBookings.find(b => String(b.student_id) === String(userData.student_id)) || null;

    if (document.getElementById('bus-seat-map')) renderBusUI();

    const bookingsTab = document.getElementById('bus-tab-bookings');
    if (bookingsTab && !bookingsTab.classList.contains('hidden') && typeof renderBusAdminBookingsList === 'function') {
        renderBusAdminBookingsList();
    }
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
    document.getElementById('bus-floor1-btn').className = currentBusFloor === 1
        ? 'flex-1 py-3 rounded-xl font-bold text-sm bg-[#00b272] text-white shadow-md transition'
        : 'flex-1 py-3 rounded-xl font-bold text-sm bg-white text-slate-500 border transition';
    document.getElementById('bus-floor2-btn').className = currentBusFloor === 2
        ? 'flex-1 py-3 rounded-xl font-bold text-sm bg-[#00b272] text-white shadow-md transition'
        : 'flex-1 py-3 rounded-xl font-bold text-sm bg-white text-slate-500 border transition';

    const banner = document.getElementById('bus-status-banner');
    if (isBusBookingOpen()) {
        banner.classList.add('hidden');
    } else {
        banner.classList.remove('hidden');
        banner.className = 'bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold text-center py-3 rounded-2xl mb-4';
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

            if (cell.type === 'empty') {
                outer.className = 'aspect-square';
                container.appendChild(outer);
                continue;
            }

            if (cell.type === 'driver') {
                outer.className = 'aspect-square flex items-center justify-center bg-slate-700 text-white rounded-xl text-lg';
                outer.innerHTML = '<i class="fa-solid fa-steering-wheel"></i>';
                outer.title = 'ที่นั่งคนขับ';
                container.appendChild(outer);
                continue;
            }

            if (cell.type === 'stairs') {
                outer.className = 'aspect-square flex items-center justify-center bg-slate-400 text-white rounded-xl text-lg';
                outer.innerHTML = '🪜';
                outer.title = 'บันได';
                container.appendChild(outer);
                continue;
            }

            const booking = busBookings.find(b => b.floor === currentBusFloor && b.seat_key === key);
            const isMine = booking && String(booking.student_id) === String(userData.student_id);
            const isSelected = selectedBusSeat && selectedBusSeat.floor === currentBusFloor && selectedBusSeat.key === key;

            const col = document.createElement('div');
            col.className = 'flex flex-col items-center gap-1';

            const seatBtn = document.createElement('div');
            seatBtn.className = 'seat ' + (booking ? (isMine ? 'seat-selected' : 'seat-occupied') : (isSelected ? 'seat-selected' : 'seat-vacant'));
            seatBtn.innerText = cell.label;
            if (!booking && isBusBookingOpen() && !myBusBooking) {
                seatBtn.onclick = () => selectBusSeat(key, cell.label);
            }
            col.appendChild(seatBtn);

            if (booking) {
                const nameTag = document.createElement('span');
                nameTag.className = 'text-[8px] text-slate-400 font-bold truncate max-w-[54px] text-center';
                nameTag.innerText = booking.name;
                col.appendChild(nameTag);
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
    const wallClassMap = { window: 'win-v', door: 'door-v' };
    const labelMap = { window: 'หน้าต่าง', door: 'ประตู', tv: 'ทีวี' };

    objects.forEach(obj => {
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
        w.title = labelMap[obj.type] || obj.type;
        container.appendChild(w);
    });
}

function selectBusSeat(key, label) {
    if (!isBusBookingOpen()) return showAlert('ยังไม่เปิดจอง', 'กรุณารอถึงเวลาเปิดจองที่นั่งรถบัส', 'warning');
    if (myBusBooking) return showAlert('จองแล้ว', 'คุณมีที่นั่งรถบัสอยู่แล้ว (จองได้คนละ 1 ที่นั่ง)', 'warning');
    selectedBusSeat = { floor: currentBusFloor, key, label };
    document.getElementById('bus-display-seat').innerText = `ชั้น ${currentBusFloor} - ${label}`;
    renderBusMap();
}

async function confirmBusBooking() {
    if (!selectedBusSeat) return showAlert('แจ้งเตือน', 'กรุณาเลือกที่นั่งก่อน', 'warning');
    if (!isBusBookingOpen()) return showAlert('ยังไม่เปิดจอง', 'กรุณารอถึงเวลาเปิดจองที่นั่งรถบัส', 'warning');

    const { data: existing } = await _supabase.from('bus_bookings').select('*').eq('student_id', userData.student_id).maybeSingle();
    if (existing) return showAlert('จองแล้ว', 'คุณมีที่นั่งรถบัสอยู่แล้ว', 'warning');

    const { error } = await _supabase.from('bus_bookings').insert([{
        student_id: userData.student_id,
        name: userData.name,
        floor: selectedBusSeat.floor,
        seat_key: selectedBusSeat.key,
        seat_label: selectedBusSeat.label
    }]);

    if (error) return showAlert('ข้อผิดพลาด', 'ที่นั่งนี้อาจเพิ่งถูกจองไปแล้ว กรุณาลองใหม่อีกครั้ง', 'error');

    await loadBusData();
    showMyBusTicket();
}

// ---- ยกเลิกการจองของตัวเอง ----
function cancelMyBusBooking() {
    if (!myBusBooking) return;

    const warnText = myBusBooking.checked_in
        ? `คุณเช็คอินขึ้นรถแล้ว ต้องการยกเลิกที่นั่ง ${myBusBooking.seat_label} จริงหรือไม่?`
        : `ต้องการยกเลิกที่นั่ง ${myBusBooking.seat_label} ใช่หรือไม่? คุณจะสามารถกลับมาจองที่นั่งใหม่ได้อีกครั้ง`;

    showAlert('ยืนยันการยกเลิก', warnText, 'confirm', async () => {
        const { error } = await _supabase.from('bus_bookings').delete().eq('id', myBusBooking.id);
        if (!error) {
            closeBusTicket();
            await loadBusData();
            showAlert('สำเร็จ', 'ยกเลิกที่นั่งรถบัสเรียบร้อยแล้ว', 'success');
        } else {
            showAlert('ข้อผิดพลาด', 'ยกเลิกไม่สำเร็จ กรุณาลองใหม่', 'error');
        }
    });
}

// ---- BOARDING PASS TICKET ----
// ใช้ร่วมกัน 2 ที่: นักเรียนดูตั๋วตัวเอง (แสดงปุ่มยกเลิกได้) และแอดมินดูตั๋วของทุกคน (ไม่แสดงปุ่มยกเลิก)
function renderTicketModal(booking, allowCancel) {
    const bookedDate = new Date(booking.booked_at);

    document.getElementById('bus-ticket-name').innerText = booking.name;
    document.getElementById('bus-ticket-id').innerText = booking.student_id;
    document.getElementById('bus-ticket-floor').innerText = 'ชั้น ' + booking.floor;
    document.getElementById('bus-ticket-seat').innerText = booking.seat_label;
    document.getElementById('bus-ticket-date').innerText = bookedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    document.getElementById('bus-ticket-time').innerText = bookedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const checkinEl = document.getElementById('bus-ticket-checkin');
    checkinEl.innerText = booking.checked_in ? '✓ เช็คอินขึ้นรถแล้ว' : 'ยังไม่เช็คอิน';
    checkinEl.className = booking.checked_in ? 'text-[11px] font-bold text-green-600' : 'text-[11px] font-bold text-gray-400';

    const qrBox = document.getElementById('bus-ticket-qr');
    qrBox.innerHTML = '';
    new QRCode(qrBox, {
        text: JSON.stringify({ bookingId: booking.id, sid: booking.student_id }),
        width: 100,
        height: 100
    });

    const cancelBtn = document.getElementById('bus-ticket-cancel-btn');
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !allowCancel);

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

function closeBusTicket() {
    document.getElementById('bus-ticket-modal').classList.add('hidden');
}
