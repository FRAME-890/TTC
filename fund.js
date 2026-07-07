async function loadFundData() {
            try {
                const { data: config } = await _supabase.from('classroom_funds').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
                currentFundConfig = config;

                if (!currentFundConfig) {
                    document.getElementById('fund-target-title').innerText = "ยังไม่มีหัวข้อเก็บเงิน";
                    document.getElementById('user-payment-status-box').innerHTML = `<p class="text-gray-400 text-sm py-6">ยังไม่มีการตั้งเป้าหมายกองทุนในปัจจุบัน</p>`;
                    return;
                }

                document.getElementById('fund-target-title').innerText = `${currentFundConfig.title} (${currentFundConfig.amount_per_person} บาท)`;

                const { data: payments } = await _supabase.from('fund_payments').select('*').eq('fund_id', currentFundConfig.id).order('paid_at', { ascending: false });
                paymentList = payments || [];

                const { data: withdraws } = await _supabase.from('fund_withdrawals').select('*').eq('fund_id', currentFundConfig.id).order('withdrawn_at', { ascending: false });
                withdrawalList = withdraws || [];

                let totalIncome = 0;
                let qrCount = 0;
                let cashCount = 0;

                paymentList.forEach(p => {
                    totalIncome += parseFloat(p.amount);
                    if (p.payment_method === 'qrcode') qrCount++;
                    if (p.payment_method === 'cash') cashCount++;
                });

                let totalExpense = 0;
                withdrawalList.forEach(w => {
                    totalExpense += parseFloat(w.amount);
                });

                let netBalance = totalIncome - totalExpense;

                document.getElementById('total-fund-amount').innerText = netBalance.toFixed(2) + " บาท";
                document.getElementById('count-qr-payment').innerText = qrCount + " คน";
                document.getElementById('count-cash-payment').innerText = cashCount + " คน";

                const tbody = document.getElementById('payment-history-rows');
                tbody.innerHTML = '';
                if(paymentList.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400 italic">ยังไม่มีข้อมูลผู้ร่วมสมทบทุนกองทุนในรอบนี้</td></tr>`;
                } else {
                    paymentList.forEach(p => {
                        const tr = document.createElement('tr');
                        tr.className = "border-b hover:bg-slate-50";
                        
                        let slipButton = ''; 
                        if(p.payment_method === 'qrcode') {
                            if (p.slip_url && userData.role === 'admin') {
                                slipButton = `
                                    <a href="${p.slip_url}" target="_blank" class="ml-1 inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 font-bold border border-blue-200 bg-blue-50 px-2 py-0.5 rounded transition" title="คลิกเพื่อดูรูปภาพสลิปหลักฐาน">
                                        <i class="fa-solid fa-image text-[11px]"></i> ดูสลิป
                                    </a>`;
                            } else {
                                slipButton = p.slip_url ? '<span class="text-green-600 font-bold ml-1">ส่งแล้ว</span>' : '<span class="text-gray-400 italic ml-1">ยังไม่ส่ง</span>';
                            }
                        }

                        tr.innerHTML = `
                            <td class="py-2.5">${p.student_id}</td>
                            <td class="py-2.5 font-bold">${p.student_name}</td>
                            <td class="py-2.5 text-center text-emerald-600 font-bold">${parseFloat(p.amount).toFixed(2)}</td>
                            <td class="py-2.5 text-right flex items-center justify-end gap-1">
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${p.payment_method==='qrcode'?'bg-blue-50 text-blue-600':'bg-orange-50 text-orange-600'}">
                                    ${p.payment_method==='qrcode'?'<i class="fa-solid fa-qrcode"></i> QR':'<i class="fa-solid fa-money-bill-wave"></i> เงินสด'}
                                </span>
                                ${slipButton}
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }

                const wTbody = document.getElementById('withdrawal-history-rows');
                wTbody.innerHTML = '';
                if(withdrawalList.length === 0) {
                    wTbody.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-gray-400 italic">ยังไม่มีรายการถอนเงิน/รายจ่ายในรอบนี้</td></tr>`;
                } else {
                    withdrawalList.forEach(w => {
                        const tr = document.createElement('tr');
                        tr.className = "border-b hover:bg-red-50/50";
                        tr.innerHTML = `
                            <td class="py-2 text-slate-700 font-medium">${w.title} <span class="block text-[9px] text-gray-400">${new Date(w.withdrawn_at).toLocaleDateString('th-TH')}</span></td>
                            <td class="py-2 text-right font-bold text-red-500">- ${parseFloat(w.amount).toFixed(2)}</td>
                        `;
                        wTbody.appendChild(tr);
                    });
                }

                renderUserPaymentStatus();
            } catch (err) { console.error(err); }
        }

        function renderUserPaymentStatus() {
            const container = document.getElementById('user-payment-status-box');
            const myPayment = paymentList.find(p => String(p.student_id) === String(userData.student_id));

            if (myPayment) {
                container.innerHTML = `
                    <div class="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl p-6">
                        <div class="text-3xl mb-2"><i class="fa-solid fa-circle-check"></i></div>
                        <p class="font-bold text-sm">ชำระเงินเสร็จสิ้นแล้ว</p>
                        <p class="text-[10px] opacity-80 mt-1">ระบบได้ทำการบันทึกข้อมูลการโอนเรียบร้อย</p>
                    </div>
                `;
            } else {
                const ppId = currentFundConfig.promptpay_id;
                const money = currentFundConfig.amount_per_person;
                const qrUrl = `https://promptpay.io/${ppId}/${money}.png`;

                container.innerHTML = `
                    <div class="space-y-4">
                        <p class="text-xs text-gray-500">สแกนชำระเงินผ่านระบบ Mobile Banking ตามยอดที่ระบุ</p>
                        <div class="bg-white p-2 border-2 border-slate-100 inline-block rounded-2xl shadow-inner mx-auto relative group">
                            <img id="fund-qr-image" src="${qrUrl}" alt="Promptpay QR Code" class="w-44 h-44 mx-auto rounded-xl">
                        </div>

                        <div class="bg-slate-50 rounded-xl p-2.5 border text-center">
                            <p class="text-[10px] text-gray-400 font-bold">ยอดเงินที่ต้องโอน</p>
                            <p class="text-lg font-bold text-slate-800">${money} บาท</p>
                        </div>
                        
                        <div class="text-left border border-dashed border-slate-200 p-3 rounded-2xl bg-white">
                            <label class="text-[10px] font-bold text-slate-500 block mb-1.5"><i class="fa-solid fa-paperclip text-blue-500"></i> แนบหลักฐานสลิปการโอนเงิน (จำเป็น)</label>
                            <input type="file" id="fund-slip-input" accept="image/*" class="hidden" onchange="handleSlipSelection()">
                            <button onclick="document.getElementById('fund-slip-input').click()" class="w-full py-2 bg-slate-50 hover:bg-slate-100 border text-slate-600 font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                                <i class="fa-solid fa-cloud-arrow-up text-sm"></i> <span id="slip-upload-label">เลือกรูปภาพสลิป</span>
                            </button>
                            <div id="slip-preview-container" class="hidden mt-2 border rounded-xl overflow-hidden bg-slate-50 p-1">
                                <img id="slip-preview-img" src="" class="w-full h-auto max-h-32 object-contain mx-auto rounded-lg">
                            </div>
                        </div>

                        <button id="fund-pay-btn" onclick="submitQrPaymentSuccess()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs shadow transition">
                            <i class="fa-solid fa-receipt mr-1"></i> ยืนยันการโอนเงินสำเร็จ
                        </button>
                        <p class="text-[9px] text-gray-400 italic">กรณีชำระด้วยเงินสด โปรดติดต่อกรรมการนักเรียนเพื่อบันทึกข้อมูล</p>
                    </div>
                `;
                selectedSlipFile = null;
            }
        }

        function handleSlipSelection() {
            const input = document.getElementById('fund-slip-input');
            if (input.files.length === 0) return;
            
            selectedSlipFile = input.files[0];
            document.getElementById('slip-upload-label').innerText = `เปลี่ยนรูป (${(selectedSlipFile.size / 1024).toFixed(1)} KB)`;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('slip-preview-img').src = e.target.result;
                document.getElementById('slip-preview-container').classList.remove('hidden');
            }
            reader.readAsDataURL(selectedSlipFile);
        }

        function submitQrPaymentSuccess() {
            if(!currentFundConfig || !userData) return;
            if(!selectedSlipFile) return showAlert("แจ้งเตือน", "โปรดเลือกและแนบรูปภาพไฟล์สลิปการโอนเงินเพื่อใช้เป็นหลักฐานก่อนกดปุ่มยืนยัน", "warning");
            
            showAlert(
                "ยืนยันการทำรายการ", 
                `คุณต้องการยืนยันการทำรายการโอนเงินสมทบทุนจำนวน ${currentFundConfig.amount_per_person} บาท พร้อมไฟล์แนบหลักฐานใช่หรือไม่?`, 
                "confirm", 
                async () => {
                    const payBtn = document.getElementById('fund-pay-btn');
                    payBtn.disabled = true;
                    payBtn.innerHTML = `<i class="fa-solid fa-circle-notch animate-spin mr-1"></i> กำลังอัปโหลดสลิปหลักฐาน...`;

                    let slipPublicUrl = null;
                    try {
                        const fileExt = selectedSlipFile.name.split('.').pop();
                        const uniqueSlipName = `slip_${userData.student_id}_${Date.now()}.${fileExt}`;

                        const { data: uploadData, error: uploadErr } = await _supabase.storage
                            .from('fund-files') 
                            .upload(uniqueSlipName, selectedSlipFile);

                        if(uploadErr) throw uploadErr;

                        const { data: urlData } = _supabase.storage.from('fund-files').getPublicUrl(uniqueSlipName);
                        slipPublicUrl = urlData.publicUrl;

                    } catch (uploadError) {
                        console.error(uploadError);
                        showAlert("ข้อผิดพลาด", "การอัปโหลดไฟล์รูปภาพสลิปล้มเหลว กรุณาลองใหม่อีกครั้ง", "error");
                        payBtn.disabled = false;
                        payBtn.innerHTML = `<i class="fa-solid fa-receipt mr-1"></i> ยืนยันการโอนเงินสำเร็จ`;
                        return;
                    }

                    const { error } = await _supabase.from('fund_payments').insert([{
                        fund_id: currentFundConfig.id,
                        student_id: userData.student_id,
                        student_name: userData.name,
                        amount: currentFundConfig.amount_per_person,
                        payment_method: 'qrcode',
                        slip_url: slipPublicUrl 
                    }]);

                    if(!error) {
                        showAlert("สำเร็จ", "ระบบได้รับข้อมูลและสลิปหลักฐานการชำระเงินของท่านเรียบร้อยแล้ว", "success");
                        selectedSlipFile = null;
                        loadFundData();
                    } else { 
                        showAlert("ข้อผิดพลาด", "ไม่สามารถบันทึกข้อมูลการชำระเงินได้ในขณะนี้", "error"); 
                        payBtn.disabled = false;
                        payBtn.innerHTML = `<i class="fa-solid fa-receipt mr-1"></i> ยืนยันการโอนเงินสำเร็จ`;
                    }
                }
            );
        }

        async function fetchStudentNameForCash(studentId) {
            const previewBox = document.getElementById('cash-name-preview');
            const trimmedId = studentId.trim();
            if(!trimmedId) {
                previewBox.innerText = "พิมพ์รหัสเพื่อค้นหาชื่อ...";
                previewBox.className = "text-[11px] text-slate-500 px-2 font-medium bg-slate-50 py-1.5 rounded-lg border border-dashed border-slate-200 min-h-[28px] flex items-center";
                resolvedCashStudentName = ""; return;
            }
            const { data } = await _supabase.from('settings').select('name').eq('student_id', trimmedId).maybeSingle();
            if(data) {
                resolvedCashStudentName = data.name;
                previewBox.innerText = `🟢 พบชื่อนักเรียน: ${data.name}`;
                previewBox.className = "text-[11px] text-emerald-700 px-2 font-bold bg-emerald-50 py-1.5 rounded-lg border border-emerald-200 min-h-[28px] flex items-center";
            } else {
                resolvedCashStudentName = "";
                previewBox.innerText = "❌ ไม่พบข้อมูลรายชื่อรหัสนี้";
                previewBox.className = "text-[11px] text-red-600 px-2 font-medium bg-red-50 py-1.5 rounded-lg border border-dashed border-slate-200 min-h-[28px] flex items-center";
            }
        }

        async function addCashPaymentByAdmin() {
            if(!currentFundConfig) return showAlert("ข้อผิดพลาด", "โปรดสร้างรอบการเก็บเงินแคมเปญกองทุนห้องก่อน", "error");
            const inputId = document.getElementById('cash-student-id');
            const targetId = inputId.value.trim();

            if(!targetId || !resolvedCashStudentName) {
                return showAlert("แจ้งเตือน", "กรุณาระบุรหัสประจำตัวของนักเรียนที่ถูกต้องและตรวจสอบความถูกต้องของชื่อผู้โอนก่อน", "warning");
            }

            const { error } = await _supabase.from('fund_payments').insert([{
                fund_id: currentFundConfig.id,
                student_id: targetId,
                student_name: resolvedCashStudentName,
                amount: currentFundConfig.amount_per_person,
                payment_method: 'cash'
            }]);

            if(!error) {
                showAlert("สำเร็จ", `บันทึกรายการจ่ายเงินสดให้แก่คุณ ${resolvedCashStudentName} เรียบร้อยแล้ว`, "success");
                inputId.value = ''; fetchStudentNameForCash('');
                loadFundData();
            } else { showAlert("ข้อผิดพลาด", "รหัสนักเรียนท่านนี้ถูกบันทึกชำระเงินในรอบนี้ไปแล้ว", "error"); }
        }

        async function addFundWithdrawalByAdmin() {
            if(!currentFundConfig) return showAlert("ข้อผิดพลาด", "โปรดสร้างแคมเปญกองทุนห้องก่อนจึงจะสามารถทำรายการถอนเงินได้", "error");
            
            const titleInput = document.getElementById('withdraw-title');
            const amountInput = document.getElementById('withdraw-amount');
            
            const wTitle = titleInput.value.trim();
            const wAmount = parseFloat(amountInput.value);

            if(!wTitle || !wAmount || wAmount <= 0) {
                return showAlert("แจ้งเตือน", "กรุณากรอกรายละเอียดเหตุผลของการเบิกจ่าย และจำนวนเงินที่ถูกต้อง (มากกว่า 0 บาท)", "warning");
            }

            showAlert("ยืนยันการถอนเงิน", `คุณต้องการบันทึกรายการรายจ่ายจำนวน ${wAmount} บาท สำหรับ "${wTitle}" ใช่หรือไม่?`, "confirm", async () => {
                const { error } = await _supabase.from('fund_withdrawals').insert([{
                    fund_id: currentFundConfig.id,
                    title: wTitle,
                    amount: wAmount
                }]);

                if(!error) {
                    showAlert("สำเร็จ", "บันทึกข้อมูลการถอนรายจ่ายออกจากกองทุนเสร็จสิ้น", "success");
                    titleInput.value = '';
                    amountInput.value = '';
                    loadFundData();
                } else {
                    showAlert("ข้อผิดพลาด", "ไม่สามารถบันทึกรายการรายจ่ายลงระบบฐานข้อมูลได้ในขณะนี้", "error");
                }
            });
        }

        async function saveFundConfig() {
            const title = document.getElementById('adm-fund-title').value.trim();
            const money = document.getElementById('adm-fund-amount').value;
            const pp = document.getElementById('adm-fund-pp').value.trim();
            if(!title || !money || !pp) return showAlert("แจ้งเตือน", "กรุณากรอกข้อมูลตัวเลือกกองทุนให้ครบทุกช่องก่อนอัปเดต", "warning");

            const { error } = await _supabase.from('classroom_funds').insert([{ title: title, amount_per_person: parseFloat(money), promptpay_id: pp }]);
            if(!error) { showAlert("สำเร็จ", "เริ่มต้นแคมเปญระดมทุนและอัปเดตข้อมูลใหม่ของห้องเรียนสำเร็จ", "success"); loadFundData(); }
            else { showAlert("ข้อผิดพลาด", "ล้มเหลวในการอัปเดตเงื่อนไขการตั้งค่าตารางข้อมูล", "error"); }
        }
