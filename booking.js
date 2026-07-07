async function loadSeatData() {
            try {
                const { data: config } = await supabase.from('room').select('*').eq('id', 1).maybeSingle();
                if(config) {
                    roomConfig = {
                        id: 1, rows: config.rows || 8, cols: config.cols || 6,
                        wall_objects: config.wall_objects || [], blocked_seats: config.blocked_seats || [],
                        custom_labels: config.custom_labels || {}
                    };
                }
                const { data: bookings } = await supabase.from('bookings').select('*');
                fullBookingsData = bookings || [];
                bookedSeats = fullBookingsData.map(b => b.seat_number);
                render('seat-map', 'wall-elements-container', false);
            } catch(err) { console.error(err); }
        }

        function render(mapId, wallId, isAdmin) {
            const container = document.getElementById(mapId);
            if(!container) return;
            container.style.gridTemplateColumns = `repeat(${roomConfig.cols}, minmax(40px, 55px))`;
            container.innerHTML = '';
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

            for(let r=0; r<roomConfig.rows; r++) {
                for(let c=0; c<roomConfig.cols; c++) {
                    const defaultID = alphabet[r] + (c+1);
                    const label = roomConfig.custom_labels[defaultID] || defaultID;
                    const isBooked = bookedSeats.includes(label);
                    const isBlocked = roomConfig.blocked_seats.includes(defaultID);
                    
                    const div = document.createElement('div');
                    div.innerText = label;

                    if(isBlocked) div.className = `seat ${isAdmin ? 'seat-admin-blocked' : 'seat-blocked'}`;
                    else {
                        div.className = `seat ${isBooked ? 'seat-occupied' : 'seat-vacant border'}`;
                        if(isAdmin) {
                            div.ondblclick = () => toggleBlockSeatAdmin(defaultID);
                        } else if(!isBooked) {
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
            if(!container) return; container.innerHTML = '';
            if(!roomConfig.wall_objects) roomConfig.wall_objects = [];
            roomConfig.wall_objects.forEach((o) => {
                const w = document.createElement('div');
                w.className = `wall-v ${o.type === 'window' ? 'win-v' : 'door-v'}`;
                w.style.top = o.top + '%';
                w.style.height = o.type === 'window' ? '50px' : '90px';
                if(o.side === 'left') w.style.left = '-12px'; else w.style.right = '-12px';
                container.appendChild(w);
            });
        }

        async function confirmBooking() {
            if(!selectedSeat) return showAlert("แจ้งเตือน", "กรุณาเลือกตำแหน่งที่นั่งที่ต้องการจองบนผังห้องเรียน", "warning");
            
            const { data: existing } = await supabase.from('bookings').select('*').eq('student_id', userData.student_id).maybeSingle();
            if (existing) return showAlert("ปฏิเสธการดำเนินการ", `คุณได้สิทธิ์จองที่นั่งเลขที่ ${existing.seat_number} แล้ว ไม่สามารถจองซ้ำได้`, "error");

            const { error } = await supabase.from('bookings').insert([{
                student_id: userData.student_id,
                student_name: userData.name,
                seat_number: selectedSeat
            }]);

            if(!error) {
                document.getElementById('m-seat').innerText = selectedSeat;
                document.getElementById('m-name').innerText = userData.name;
                document.getElementById('m-id').innerText = "ID: " + userData.student_id;
                document.getElementById('success-modal').classList.remove('hidden');
            } else {
                showAlert("ข้อผิดพลาด", "ที่นั่งนี้อาจถูกจองโดยผู้ใชื่นแล้วในเวลาเดียวกัน กรุณาเลือกที่นั่งใหม่อีกครั้ง", "error");
                loadSeatData();
            }
        }
