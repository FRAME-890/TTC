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
