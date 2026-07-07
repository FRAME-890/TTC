async function doLogin() {
    try {
        const sid = document.getElementById('student_id_input').value.trim();
        if(!sid) return showAlert("แจ้งเตือน", "กรุณากรอกรหัสประจำตัวนักเรียนก่อนเข้าสู่ระบบ", "warning");
        
        // ตรงนี้แหละครับที่จะเช็คว่า supabase ทำงานไหม
        if (typeof supabase === 'undefined') {
            throw new Error("ตัวแปร supabase ไม่มีค่า (ไฟล์ตั้งค่าไม่โหลด)");
        }

        const { data, error } = await supabase.from('settings').select('*').eq('student_id', sid).maybeSingle();
        
        if (error) throw error;
        if (!data) throw new Error("ไม่พบข้อมูลนักเรียน");
        
        userData = data;
        localStorage.setItem('thaiticket_session', JSON.stringify(userData));
        showNav();
        goToPage('landing-page');
    } catch (err) {
        // แทนที่จะเงียบ ให้มันแจ้งเตือนออกมาตรงๆ
        alert("เกิดข้อผิดพลาด: " + err.message);
        console.error(err);
    }
}

        function logout() {
            localStorage.removeItem('thaiticket_session');
            userData = null;
            document.getElementById('nav').classList.add('hidden');
            if(voteSubscription) supabase.removeChannel(voteSubscription);
            goToPage('login-page');
        }
