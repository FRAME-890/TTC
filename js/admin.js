async function openAdmin() {
            if(userData.role !== 'admin') return;
            document.getElementById('admin-panel').classList.remove('hidden');
            history.pushState({ page: 'admin-panel' }, '', '#admin-panel');
            
            const { data: config } = await _supabase.from('room').select('*').eq('id', 1).maybeSingle();
            if(config) {
                roomConfig = {
                    id: 1, rows: config.rows || 8, cols: config.cols || 6,
                    wall_objects: config.wall_objects || [], blocked_seats: config.blocked_seats || [],
                    custom_labels: config.custom_labels || {}
                };
            }
            document.getElementById('inp-rows').value = roomConfig.rows;
            document.getElementById('inp-cols').value = roomConfig.cols;
            
            const { data: fundConfig } = await _supabase.from('classroom_funds').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
            currentFundConfig = fundConfig;
            if (currentFundConfig) {
                document.getElementById('adm-fund-title').value = currentFundConfig.title;
                document.getElementById('adm-fund-amount').value = currentFundConfig.amount_per_person;
                document.getElementById('adm-fund-pp').value = currentFundConfig.promptpay_id;
            }
            
            await loadAdminDashboardData();
            renderAdminMap();
            await loadBusData();
            switchAdminMainTab('room');
        }

function switchAdminMainTab(tab) {
    const tabs = ['room', 'bus', 'duty', 'fund', 'vote', 'homework'];
    tabs.forEach(t => {
        document.getElementById(`admtab-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`admtab-btn-${t}`).className = t === tab
            ? 'px-4 py-2 rounded-xl text-xs font-bold bg-[#00b272] text-white transition'
            : 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 transition';
    });

    if (tab === 'bus') {
        switchBusAdminTab('layout');
    } else {
        stopBusScanner(); // ปิดกล้องสแกนเมื่อออกจากแท็บรถบัส กันกล้องค้าง
    }

    if (tab === 'vote') {
        loadVoteData().then(renderAdminVoteList);
    }
}

function renderAdminVoteList() {
    const container = document.getElementById('admin-vote-list');
    if (!container) return;
    container.innerHTML = '';

    if (!activePolls || activePolls.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 italic py-4">ยังไม่มีหัวข้อโหวตในระบบ</p>';
        return;
    }

    activePolls.forEach(poll => {
        const count = poll.votesData ? poll.votesData.length : 0;
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 mb-2 text-xs';
        row.innerHTML = `
            <div>
                <p class="font-bold text-slate-800">${poll.question}</p>
                <p class="text-gray-400 text-[10px] mt-1">${count} โหวต</p>
            </div>
            <button onclick="deletePoll(${poll.id})" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
        `;
        container.appendChild(row);
    });
}
        async function loadAdminDashboardData() {
            try {
                const { data: bookings } = await _supabase.from('bookings').select('*').order('seat_number');
                fullBookingsData = bookings || [];
                bookedSeats = fullBookingsData.map(b => b.seat_number);
                renderAdminBookingsTable();

                const { data: duties } = await _supabase.from('duties').select('*').order('id');
                dutiesConfig = duties || [];
                const { data: regs } = await _supabase.from('duty_registrations').select('*');
                dutyRegistrations = regs || [];
                
                const { data: checks } = await _supabase.from('duty_checklist').select('*');
                doneChecklistData = checks || [];

                renderAdminDutyList();
                calculateWeeklyReportDashboard(); 

                const { data: hws } = await _supabase.from('homework').select('*').order('deadline', { ascending: true });
                homeworkList = hws || [];
                renderAdminHomeworkList();

            } catch (err) { console.error("Admin dashboard load error:", err); }
        }

        function calculateWeeklyReportDashboard() {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            let totalRegisteredTeammates = dutyRegistrations.length; 
            let totalDoneCount = doneChecklistData.filter(c => c.is_done === 'ทำเวร' || c.is_done === true).length;

            days.forEach(day => {
                const count = doneChecklistData.filter(c => c.day_name_en.toLowerCase() === day && (c.is_done === 'ทำเวร' || c.is_done === true)).length;
                const shortDay = day.substring(0, 3);
                const el = document.getElementById(`summary-${shortDay}-count`);
                if(el) el.innerText = count + " คน";
            });

            const percentElement = document.getElementById('summary-weekly-percent');
            if (totalRegisteredTeammates > 0) {
                const weeklyPercent = ((totalDoneCount / totalRegisteredTeammates) * 100).toFixed(0);
                percentElement.innerText = weeklyPercent + "%";
            } else {
                percentElement.innerText = "0%";
            }
        }

        function renderAdminBookingsTable() {
            const tbody = document.getElementById('admin-bookings-rows');
            tbody.innerHTML = '';
            
            if(fullBookingsData.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-400 italic">ไม่มีข้อมูลการจองที่นั่งในขณะนี้</td></tr>`;
                return;
            }

            fullBookingsData.forEach(b => {
                const tr = document.createElement('tr');
                tr.className = "border-b hover:bg-slate-50";
                tr.innerHTML = `
                    <td class="py-2 font-bold text-[#00b272]">${b.seat_number}</td>
                    <td class="py-2 text-gray-400">${b.student_id}</td>
                    <td class="py-2 font-medium">${b.student_name}</td>
                    <td class="py-2 text-right">
                        <button onclick="removeBookingAdmin('${b.student_id}', '${b.seat_number}')" class="text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-lg font-bold text-[10px]">
                            <i class="fa-solid fa-user-minus"></i> ลบสิทธิ์การจอง
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function removeBookingAdmin(studentId, seatNum) {
            showAlert("ยืนยันการลบ", `คุณต้องการยกเลิกและคืนสิทธิ์ที่นั่งหมายเลข ${seatNum} ใช่หรือไม่?`, "confirm", async () => {
                const { error } = await _supabase.from('bookings').delete().eq('student_id', studentId);
                if(!error) {
                    showAlert("สำเร็จ", "ยกเลิกการจองเรียบร้อยแล้ว", "success");
                    await loadAdminDashboardData();
                    renderAdminMap();
                } else { 
                    showAlert("ข้อผิดพลาด", "ไม่สามารถลบสิทธิ์การจองได้ในขณะนี้", "error"); 
                }
            });
        }

        function renderAdminDutyList() {
            const container = document.getElementById('admin-duty-list');
            container.innerHTML = '';

            dutiesConfig.forEach(day => {
                const workers = dutyRegistrations.filter(r => r.day_name_en.toLowerCase() === day.day_name_en.toLowerCase());
                const dayBlock = document.createElement('div');
                dayBlock.className = 'p-3 bg-slate-50 rounded-xl mb-2 border';
                
                let workersHTML = '<p class="text-gray-400 italic mt-1">ยังไม่มีผู้ลงทะเบียน</p>';
                if(workers.length > 0) {
                    workersHTML = workers.map(w => {
                        const checkLog = doneChecklistData.find(c => String(c.student_id) === String(w.student_id));
                        const isDone = checkLog && (checkLog.is_done === 'ทำเวร' || checkLog.is_done === true);
                        return `
                            <div class="flex justify-between items-center bg-white p-1.5 px-2 rounded-lg border mt-1 font-medium text-slate-700 text-xs">
                                <span class="flex items-center gap-1.5">
                                    ${isDone ? '<i class="fa-solid fa-circle-check text-green-500" title="ทำเวรแล้ว"></i>' : '<i class="fa-solid fa-circle-minus text-gray-300" title="ยังไม่ได้ทำเวร"></i>'}
                                    ${w.student_name}
                                </span>
                                <button onclick="removeDutyAdmin('${w.student_id}')" class="text-red-500 font-bold px-1.5 py-0.5 bg-red-50 hover:bg-red-100 rounded-md text-[10px] transition"><i class="fa-solid fa-xmark"></i> เอาออก</button>
                            </div>
                        `;
                    }).join('');
                }

                dayBlock.innerHTML = `
                    <div class="flex justify-between items-center font-bold text-slate-700 border-b pb-1">
                        <span>วัน${day.day_name_th} (${workers.length}/${day.max_slots})</span>
                    </div>
                    <div class="mt-1">${workersHTML}</div>
                `;
                container.appendChild(dayBlock);
            });
        }

        async function removeDutyAdmin(studentId) {
            showAlert("ยืนยัน", "ต้องการเอารายชื่อนักเรียนคนนี้ออกจากเวรใช่หรือไม่?", "confirm", async () => {
                await _supabase.from('duty_checklist').delete().eq('student_id', studentId);
                const { error } = await _supabase.from('duty_registrations').delete().eq('student_id', studentId);
                if(!error) {
                    showAlert("สำเร็จ", "ลบรายชื่อออกจากตารางเวรเรียบร้อย", "success");
                    await loadAdminDashboardData();
                }
            });
        }

        function resetAllDutiesAdmin() {
            showAlert("ล้างข้อมูลเวร", "คุณต้องการล้างข้อมูลสมาชิกเวรประจำวันทั้งหมดออกใช่หรือไม่? (ลบถาวร)", "confirm", async () => {
                await _supabase.from('duty_checklist').delete().neq('student_id', '0');
                const { error } = await _supabase.from('duty_registrations').delete().neq('student_id', '0');
                if(!error) {
                    showAlert("สำเร็จ", "ล้างข้อมูลตารางเวรทั้งหมดเสร็จสิ้น", "success");
                    await loadAdminDashboardData();
                }
            });
        }

        function renderAdminHomeworkList() {
            const container = document.getElementById('admin-homework-list');
            container.innerHTML = '';

            if(homeworkList.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-400 italic py-4">ไม่มีภารกิจการบ้านในระบบ</p>';
                return;
            }

            homeworkList.forEach(hw => {
                const item = document.createElement('div');
                item.className = 'flex justify-between items-start p-2.5 bg-slate-50 rounded-xl border border-slate-100 mb-2 gap-2';
                item.innerHTML = `
                    <div class="truncate">
                        <p class="font-bold text-slate-800 text-xs truncate">[${hw.subject_name}] ${hw.title}</p>
                        <p class="text-[10px] text-gray-400 mt-0.5">กำหนดส่ง: ${new Date(hw.deadline).toLocaleDateString('th-TH')}</p>
                    </div>
                    <button onclick="deleteHomeworkAdmin(${hw.id})" class="text-red-400 hover:text-red-600 font-bold text-sm px-1"><i class="fa-solid fa-trash-can"></i></button>
                `;
                container.appendChild(item);
            });
        }

        async function deleteHomeworkAdmin(id) {
            showAlert("ยืนยันการลบ", "คุณต้องการลบรายการแจ้งการบ้านนี้ออกจากระบบใช่หรือไม่?", "confirm", async () => {
                await _supabase.from('homework_status').delete().eq('homework_id', id);
                const { error } = await _supabase.from('homework').delete().eq('id', id);
                if(!error) {
                    showAlert("สำเร็จ", "ลบข้อมูลเรียบร้อยแล้ว", "success");
                    await loadAdminDashboardData();
                }
            });
        }

        function renderAdminMap() {
            render('admin-seat-map', 'admin-wall-container', true);
        }

        function toggleBlockSeatAdmin(defaultID) {
            if (roomConfig.blocked_seats.includes(defaultID)) {
                roomConfig.blocked_seats = roomConfig.blocked_seats.filter(id => id !== defaultID);
            } else {
                roomConfig.blocked_seats.push(defaultID);
            }
            renderAdminMap();
        }

        function resetLayout() {
            const r = parseInt(document.getElementById('inp-rows').value) || 8;
            const c = parseInt(document.getElementById('inp-cols').value) || 6;
            roomConfig.rows = r;
            roomConfig.cols = c;
            renderAdminMap();
        }

        async function saveAndCloseAdmin() {
            const saveBtn = document.getElementById('admin-save-btn');
            saveBtn.disabled = true;
            saveBtn.innerText = "กำลังบันทึกข้อมูล...";

            const { error } = await _supabase.from('room').update({
                rows: roomConfig.rows,
                cols: roomConfig.cols,
                blocked_seats: roomConfig.blocked_seats,
                wall_objects: roomConfig.wall_objects,
                custom_labels: roomConfig.custom_labels
            }).eq('id', 1);

            saveBtn.disabled = false;
            saveBtn.innerText = "บันทึกโครงสร้างผังที่นั่ง";

            if(!error) {
                showAlert("สำเร็จ", "บันทึกแก้ไขผังห้องเรียนและมิติตารางเรียบร้อยแล้ว", "success");
                document.getElementById('admin-panel').classList.add('hidden');
                goToPage('landing-page');
            } else {
                showAlert("ข้อผิดพลาด", "ล้มเหลวในการบันทึกข้อมูลลงฐานข้อมูล", "error");
            }
        }

        // --- MISC MODAL CONTROLS ---
        let tempSide = 'left';
        function updateSideUI() {
            document.getElementById('side-left').className = tempSide === 'left' ? 'flex-1 py-3 rounded-xl font-bold text-sm bg-slate-800 text-white' : 'flex-1 py-3 rounded-xl font-bold text-sm text-slate-500';
            document.getElementById('side-right').className = tempSide === 'right' ? 'flex-1 py-3 rounded-xl font-bold text-sm bg-slate-800 text-white' : 'flex-1 py-3 rounded-xl font-bold text-sm text-slate-500';
        }

        function confirmAddObj() {
            const pos = document.getElementById('obj-pos').value;
            if(!roomConfig.wall_objects) roomConfig.wall_objects = [];
            roomConfig.wall_objects.push({ type: 'window', side: tempSide, top: pos });
            document.getElementById('obj-modal').classList.add('hidden');
            renderAdminMap();
        }

        function closeSuccessModal() {
            document.getElementById('success-modal').classList.add('hidden');
            selectedSeat = null;
            document.getElementById('display-seat').innerText = '--';
            loadSeatData();
        }
