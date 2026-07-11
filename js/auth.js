 async function doLogin() {
            const sid = document.getElementById('student_id_input').value.trim();
            if(!sid) return showAlert("แจ้งเตือน", "กรุณากรอกรหัสประจำตัวนักเรียนก่อนเข้าสู่ระบบ", "warning");
            
            const { data, error } = await _supabase.from('settings').select('*').eq('student_id', sid).maybeSingle();
            if (error || !data) return showAlert("ข้อผิดพลาด", "ไม่พบข้อมูลนักเรียนรายนี้ในระบบฐานข้อมูล", "error");
            
            userData = data;
            localStorage.setItem('thaiticket_session', JSON.stringify(userData));
            showNav();
            goToPage('landing-page');
        }

        function logout() {
            localStorage.removeItem('thaiticket_session');
            userData = null;
            document.getElementById('nav').classList.add('hidden');
            if(voteSubscription) _supabase.removeChannel(voteSubscription);
            goToPage('login-page');
        }
