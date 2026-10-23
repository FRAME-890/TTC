// ==========================================================
//  seat-booking.js — จองที่นั่งห้องเรียน
// ==========================================================
async function loadSeatData() {
    try {
        const { data: config } = await _supabase.from('room').select('*').eq('id', 1).maybeSingle();
        if (config) {
            roomConfig = {
                id: 1, rows: config.rows || 8, cols: config.cols || 6,
                wall_objects: config.wall_objects || [], blocked_seats: config.blocked_seats || [],
                custom_labels: config.custom_labels || {}
            };
        }
        const { data: bookings } = await _supabase.from('bookings').select('*');
        fullBookingsData = bookings || [];
        bookedSeats = fullBookingsData.map(b => b.seat_number);
        myRoomBooking = fullBookingsData.find(b => String(b.student_id) === String(userData.student_id)) || null;

        render('seat-map', 'wall-elements-container', false);
        updateMySeatPanel();
    } catch (err) { console.error(err); }
}

function updateMySeatPanel() {
    document.getElementById('confirm-btn').classList.toggle('hidden', !!myRoomBooking);
    document.getElementById('my-seat-box').classList.toggle('hidden', !myRoomBooking);
    if (myRoomBooking) document.getElementById('display-seat').innerText = myRoomBooking.seat_number;
    else if (!selectedSeat) document.getElementById('display-seat').innerText = '--';
}

function render(mapId, wallId, isAdmin) {
    const container = document.getElementById(mapId);
    if (!container) return;
    container.style.gridTemplateColumns = `repeat(${roomConfig.cols}, minmax(40px, 55px))`;
    container.style.justifyContent = 'center';
    container.innerHTML = '';
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let r = 0; r < roomConfig.rows; r++) {
        for (let c = 0; c < roomConfig.cols; c++) {
            const defaultID = alphabet[r] + (c + 1);
            const label = roomConfig.custom_labels[defaultID] || defaultID;
            const isBooked = bookedSeats.includes(label);
            const isBlocked = roomConfig.blocked_seats.includes(defaultID);
            const isMine = !isAdmin && myRoomBooking && myRoomBooking.seat_number === label;

            const div = document.createElement('div');
            div.innerText = label;

            if (isBlocked) {
                div.className = `seat ${isAdmin ? 'seat-admin-blocked' : 'seat-blocked'}`;
                if (isAdmin) div.onclick = () => toggleBlockSeatAdmin(defaultID);
            } else {
                div.className = `seat ${isMine ? 'seat-selected' : (isBooked ? 'seat-occupied' : 'seat-vacant')}`;
                if (isAdmin) {
                    div.onclick = () => toggleBlockSeatAdmin(defaultID);
                    if (isBooked) div.title = 'มีคนจองแล้ว';
                } else if (!isBooked && !myRoomBooking) {
                    div.onclick = () => {
                        document.querySelectorAll('#seat-map .seat').forEach(s => s.classList.remove('seat-selected'));
                        div.classList.add('seat-selected');
                        selectedSeat = label;
                        document.getElementById('display-seat').innerText = label;
                    };
                }
            }
            container.appendChild(div);
        }
    }
    renderWalls(wallId);
}

function renderWalls(targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;
    container.innerHTML = '';
    (roomConfig.wall_objects || []).forEach(o => {
        const w = document.createElement('div');
        w.className = `wall-v ${o.type === 'door' ? 'door-v' : 'win-v'}`;
        w.style.top = o.top + '%';
        w.style.height = o.type === 'door' ? '90px' : '50px';
        if (o.side === 'left') w.style.left = '10px'; else w.style.right = '10px';
        container.appendChild(w);
    });
}

async function confirmBooking() {
    if (!selectedSeat) return showAlert('แจ้งเตือน', 'กรุณาเลือกที่นั่งที่ต้องการจองบนผังห้องเรียน', 'warning');

    const { data: existing } = await _supabase.from('bookings').select('*').eq('student_id', userData.student_id).maybeSingle();
    if (existing) {
        await loadSeatData();
        return showAlert('ปฏิเสธการดำเนินการ', `คุณจองที่นั่ง ${existing.seat_number} ไว้แล้ว หากต้องการเปลี่ยนให้ยกเลิกที่นั่งเดิมก่อน`, 'error');
    }

    const { error } = await _supabase.from('bookings').insert([{
        student_id: userData.student_id,
        student_name: userData.name,
        seat_number: selectedSeat
    }]);

    if (!error) {
        document.getElementById('m-seat').innerText = selectedSeat;
        document.getElementById('m-name').innerText = userData.name;
        document.getElementById('m-id').innerText = 'ID: ' + userData.student_id;
        document.getElementById('success-modal').classList.remove('hidden');
    } else {
        showAlert('ข้อผิดพลาด', 'ที่นั่งนี้อาจถูกจองไปพร้อมกัน กรุณาเลือกที่นั่งใหม่อีกครั้ง', 'error');
        selectedSeat = null;
        loadSeatData();
    }
}

function cancelMySeat() {
    if (!myRoomBooking) return;
    showAlert('ยกเลิกที่นั่ง', `ต้องการยกเลิกที่นั่ง ${myRoomBooking.seat_number} เพื่อเลือกใหม่ใช่หรือไม่?`, 'confirm', async () => {
        const { error } = await _supabase.from('bookings').delete().eq('student_id', userData.student_id);
        if (error) return showAlert('ข้อผิดพลาด', dbErrorText(error), 'error');
        selectedSeat = null;
        await loadSeatData();
        showAlert('สำเร็จ', 'ยกเลิกที่นั่งแล้ว คุณเลือกที่นั่งใหม่ได้เลย', 'success');
    });
}
