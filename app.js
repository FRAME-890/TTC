let userData = null;
        let bookedSeats = [];
        let fullBookingsData = []; 
        let selectedSeat = null;
        let roomConfig = { id: 1, rows: 8, cols: 6, wall_objects: [], blocked_seats: [], custom_labels: {} };
        
        let dutiesConfig = [];
        let dutyRegistrations = [];
        let localChecklistState = {}; // เก็บสถานะชั่วคราว { student_id: true / false / 'leave' }
        let doneChecklistData = []; 
        
        let homeworkList = [];
        let completedHomeworkIds = [];

        let currentFundConfig = null;
        let paymentList = [];
        let withdrawalList = []; 
        let resolvedCashStudentName = ""; 

        let selectedSlipFile = null; 

        let activePolls = [];
        let myVotes = [];
        let voteSubscription = null;

        window.onload = () => {
            const savedSession = localStorage.getItem('thaiticket_session');
            if (savedSession) {
                userData = JSON.parse(savedSession);
                showNav();
                goToPage('landing-page');
            }
        };
