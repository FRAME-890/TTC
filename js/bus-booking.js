let busConfig = null;
let busBookings = [];
let currentBusFloor = 1;
let selectedBusSeat = null;   // { floor, key, label }
let myBusBooking = null;

const BUS_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function loadBusData() {
    const { data: config } = await _supabase.from('bus_room').select('*').eq('id', 1).maybeSingle();
    busConfig = config;

    const { data: bookings } = await _supabase.from('bus_bookings').select('*');
    busBookings = bookings || [];

    myBusBooking = busBookings.find(b => String(b.student_id) === String(userData.student_id)) || null;
    currentBusFloor = 1;
    selectedBusSeat = null;
    renderBusUI();
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
    container.style.maxWidth = (cols * 62) + 'px';

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
                outer.className = 'aspect-square flex items-center justify-center bg-slate-700 text-white rounded-xl text-[9px] font-bold';
                outer.innerHTML = '<i class="fa-solid fa-steering-wheel"></i>';
                container.appendChild(outer);
                continue;
            }

            // ที่นั่งปกติ
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
    const classMap = { window: 'win-v', door: 'door-v', tv: 'tv-v', stairs: 'stairs-v' };
    const labelMap = { window: 'หน้าต่าง', door: 'ประตู', tv: 'ทีวี', stairs: 'บันได' };

    objects.forEach(obj => {
        const w = document.createElement('div');
        w.className = `wall-v ${classMap[obj.type] || ''}`;
        w.style.top = obj.top + '%';
        w.style[obj.side] = '-4px';
        w.style.height = '60px';
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

async function showMyBusTicket() {
    if (!myBusBooking) {
        const { data } = await _supabase.from('bus_bookings').select('*').eq('student_id', userData.student_id).maybeSingle();
        myBusBooking = data;
    }
    if (!myBusBooking) return showAlert('ยังไม่ได้จอง', 'คุณยังไม่มีที่นั่งรถบัส', 'warning');

    document.getElementById('bus-ticket-name').innerText = myBusBooking.name;
    document.getElementById('bus-ticket-id').innerText = 'รหัส: ' + myBusBooking.student_id;
    document.getElementById('bus-ticket-floor').innerText = 'ชั้น ' + myBusBooking.floor;
    document.getElementById('bus-ticket-seat').innerText = myBusBooking.seat_label;
    document.getElementById('bus-ticket-checkin').innerText = myBusBooking.checked_in ? '✓ เช็คอินขึ้นรถแล้ว' : 'ยังไม่เช็คอิน';
    document.getElementById('bus-ticket-checkin').className = myBusBooking.checked_in
        ? 'text-[11px] font-bold text-green-600' : 'text-[11px] font-bold text-gray-400';

    const qrBox = document.getElementById('bus-ticket-qr');
    qrBox.innerHTML = '';
    new QRCode(qrBox, {
        text: JSON.stringify({ bookingId: myBusBooking.id, sid: myBusBooking.student_id }),
        width: 160,
        height: 160
    });

    document.getElementById('bus-ticket-modal').classList.remove('hidden');
}

function closeBusTicket() {
    document.getElementById('bus-ticket-modal').classList.add('hidden');
}
