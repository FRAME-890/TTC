function showAlert(title, message, type = 'success', onConfirm = null) {
            const modal = document.getElementById('custom-alert-modal');
            const card = modal.querySelector('.glass');
            const iconBox = document.getElementById('alert-icon-box');
            const icon = document.getElementById('alert-icon');
            const actionContainer = document.getElementById('alert-action-buttons');
            
            document.getElementById('alert-title').innerText = title;
            document.getElementById('alert-message').innerText = message;
            
            iconBox.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg";
            
            if (type === 'success') {
                iconBox.classList.add('bg-green-100', 'text-green-600', 'shadow-green-100');
                icon.className = "fa-solid fa-circle-check";
            } else if (type === 'error') {
                iconBox.classList.add('bg-red-100', 'text-red-600', 'shadow-red-100');
                icon.className = "fa-solid fa-circle-xmark";
            } else if (type === 'warning') {
                iconBox.classList.add('bg-amber-100', 'text-amber-600', 'shadow-amber-100');
                icon.className = "fa-solid fa-triangle-exclamation";
            } else if (type === 'confirm') {
                iconBox.classList.add('bg-blue-100', 'text-blue-600', 'shadow-blue-100');
                icon.className = "fa-solid fa-circle-question";
            }

            if (type === 'confirm') {
                actionContainer.innerHTML = `
                    <button onclick="closeCustomAlert()" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl text-xs font-bold transition">ยกเลิก</button>
                    <button id="alert-confirm-execute" class="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md transition">ยืนยัน</button>
                `;
                document.getElementById('alert-confirm-execute').onclick = () => {
                    closeCustomAlert();
                    if (onConfirm) onConfirm();
                };
            } else {
                actionContainer.innerHTML = `
                    <button onclick="closeCustomAlert()" class="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-md transition">ตกลง</button>
                `;
            }

            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }, 10);
        }

        function closeCustomAlert() {
            const modal = document.getElementById('custom-alert-modal');
            const card = modal.querySelector('.glass');
            
            modal.classList.add('opacity-0');
            card.classList.remove('scale-100');
            card.classList.add('scale-95');
            
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }

        function showNav() {
            if (userData.role === 'admin') {
                document.getElementById('admin-trigger').classList.remove('hidden');
                document.getElementById('user-info').classList.add('hidden');
                document.getElementById('user-display-name').innerText = userData.name;
                document.getElementById('user-display-id').innerText = "ID: " + userData.student_id;
            } else {
                document.getElementById('admin-trigger').classList.add('hidden');
                document.getElementById('user-info').classList.remove('hidden');
                document.getElementById('student-name').innerText = userData.name;
                document.getElementById('student-id-display').innerText = "ID: " + userData.student_id;
            }
            document.getElementById('nav').classList.remove('hidden');
        }

        function goToPage(id) {
            ['login-page', 'landing-page', 'main-app', 'duty-page', 'homework-page', 'fund-page', 'vote-page', 'admin-panel'].forEach(p => {
                if(document.getElementById(p)) document.getElementById(p).classList.add('hidden');
            });
            document.getElementById(id).classList.remove('hidden');
            if(id === 'landing-page' && userData) {
                document.getElementById('landing-name').innerText = userData.name;
            }
            if (id !== 'vote-page' && voteSubscription) {
                _supabase.removeChannel(voteSubscription);
                voteSubscription = null;
            }
        }
