async function loadHomeworkData() {
            try {
                const { data: hws } = await supabase.from('homework').select('*').order('deadline', { ascending: true });
                homeworkList = hws || [];
                const { data: doneList } = await supabase.from('homework_status').select('homework_id').eq('student_id', userData.student_id);
                completedHomeworkIds = doneList ? doneList.map(item => item.homework_id) : [];
                renderHomeworkList();
            } catch (err) { console.error(err); }
        }

        function renderHomeworkList() {
            const container = document.getElementById('homework-list');
            container.innerHTML = '';
            const activeHomework = homeworkList.filter(hw => !completedHomeworkIds.includes(hw.id));

            if(activeHomework.length === 0) {
                container.innerHTML = `<div class="col-span-full text-center py-12 bg-white/60 text-slate-400 rounded-3xl font-medium border border-dashed border-slate-200">ไม่มีการบ้านค้างส่ง</div>`;
                return;
            }

            activeHomework.forEach(hw => {
                const today = new Date(); today.setHours(0,0,0,0);
                const dlDate = new Date(hw.deadline); dlDate.setHours(0,0,0,0);
                const diffTime = dlDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let badgeColor = 'bg-gray-100 text-gray-600';
                let countdownText = `เหลือเวลาอีก ${diffDays} วัน`;

                if (diffDays === 0) { badgeColor = 'bg-red-500 text-white animate-pulse'; countdownText = 'กำหนดส่งวันนี้'; }
                else if (diffDays === 1) { badgeColor = 'bg-orange-500 text-white'; countdownText = 'กำหนดส่งพรุ่งนี้'; }

                const card = document.createElement('div');
                card.className = `bg-white p-5 rounded-3xl border flex flex-col justify-between shadow-sm`;
                card.innerHTML = `
                    <div>
                        <div class="flex justify-between items-start gap-2 mb-2">
                            <span class="px-3 py-0.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs truncate">วิชา: ${hw.subject_name}</span>
                            <span class="px-2 py-0.5 rounded-lg text-[9px] font-bold shrink-0 ${badgeColor}">${countdownText}</span>
                        </div>
                        <p class="text-xs text-slate-700 font-medium whitespace-pre-wrap mt-2">${hw.title}</p>
                    </div>
                    <div class="border-t pt-3 mt-4 flex justify-between items-center">
                        <span class="text-[10px] text-gray-400"><i class="fa-regular fa-clock mr-1"></i> กำหนดส่ง: ${new Date(hw.deadline).toLocaleDateString('th-TH')}</span>
                        <button onclick="markAsDone(${hw.id})" class="text-[11px] font-bold bg-green-50 text-green-600 px-3 py-1.5 rounded-xl"><i class="fa-solid fa-check"></i> ทำเสร็จแล้ว</button>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        async function addHomework() {
            const subject = document.getElementById('hw-subject').value.trim();
            const title = document.getElementById('hw-title').value.trim();
            const deadline = document.getElementById('hw-deadline').value;
            if(!subject || !title || !deadline) return showAlert("แจ้งเตือน", "กรุณากรอกข้อมูลและรายละเอียดการบ้านให้ครบทุกช่องก่อนดำเนินการ", "warning");

            await supabase.from('homework').insert([{ subject_name: subject, title: title, deadline: deadline, created_by: userData.student_id }]);
            document.getElementById('hw-subject').value = ''; document.getElementById('hw-title').value = ''; document.getElementById('hw-deadline').value = '';
            showAlert("สำเร็จ", "เพิ่มข้อมูลการบ้านใหม่เข้าสู่ระบบเรียบร้อยแล้ว", "success");
            loadHomeworkData();
        }

        async function markAsDone(homeworkId) {
            await _supabase.from('homework_status').insert([{ student_id: userData.student_id, homework_id: homeworkId }]);
            showAlert("สำเร็จ", "บันทึกสถานะการทำเสร็จเรียบร้อยแล้ว", "success");
            loadHomeworkData();
        }
