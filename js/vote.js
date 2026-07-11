 async function loadVoteData() {
            try {
                const { data: polls } = await _supabase.from('polls').select('*').order('created_at', { ascending: false });
                activePolls = polls || [];

                const { data: votes } = await _supabase.from('poll_votes').select('*').eq('student_id', userData.student_id);
                myVotes = votes || [];

                for(let poll of activePolls) {
                    const { data: allVotes } = await _supabase.from('poll_votes').select('option_index').eq('poll_id', poll.id);
                    poll.votesData = allVotes || [];
                }

                renderPollsList();

                if (voteSubscription) _supabase.removeChannel(voteSubscription);
                voteSubscription = _supabase.channel('public:poll_votes')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => {
                    loadVoteData();
                })
                .subscribe();

            } catch(err) { console.error(err); }
        }

        function renderPollsList() {
            const container = document.getElementById('polls-list-container');
            container.innerHTML = '';

            if(activePolls.length === 0) {
                container.innerHTML = `<div class="text-center py-12 bg-white/60 text-slate-400 rounded-3xl font-medium border border-dashed border-slate-200">ยังไม่มีหัวข้อเปิดโหวตในขณะนี้</div>`;
                return;
            }

            activePolls.forEach(poll => {
                const card = document.createElement('div');
                card.className = "bg-white p-6 rounded-3xl border shadow-sm space-y-4 animate-pop";
                
                const myVotedInThisPoll = myVotes.find(v => String(v.poll_id) === String(poll.id));
                const totalVotesCount = poll.votesData ? poll.votesData.length : 0;

                let optionsHTML = '';
                poll.options.forEach((opt, index) => {
                    const optVotesCount = poll.votesData ? poll.votesData.filter(v => v.option_index === index).length : 0;
                    const percent = totalVotesCount > 0 ? ((optVotesCount / totalVotesCount) * 100).toFixed(0) : 0;
                    const isSelectedOption = myVotedInThisPoll && myVotedInThisPoll.option_index === index;

                    optionsHTML += `
                        <div class="relative flex flex-col justify-center p-3.5 border rounded-2xl overflow-hidden group transition ${
                            isSelectedOption ? 'border-rose-400 bg-rose-50/20' : 'bg-gray-50/50 hover:bg-gray-50'
                        }">
                            <div class="absolute inset-y-0 left-0 bg-rose-100/60 transition-all duration-500" style="width: ${percent}%"></div>
                            <div class="relative flex justify-between items-center z-10 text-xs font-semibold">
                                <span class="text-slate-700 flex items-center gap-2">
                                    ${isSelectedOption ? '<i class="fa-solid fa-circle-check text-rose-500"></i>' : '<i class="fa-regular fa-circle text-gray-300"></i>'}
                                    ${opt}
                                </span>
                                <span class="text-rose-600 font-bold">${optVotesCount} โหวต (${percent}%)</span>
                            </div>
                            ${!myVotedInThisPoll ? `<button onclick="castVote(${poll.id}, ${index})" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"></button>` : ''}
                        </div>
                    `;
                });

                let deleteBtnHTML = '';
                if(String(poll.created_by) === String(userData.student_id) || userData.role === 'admin') {
                    deleteBtnHTML = `<button onclick="deletePoll(${poll.id})" class="text-xs text-gray-400 hover:text-red-500 font-bold transition"><i class="fa-solid fa-trash-can"></i> ลบโหวต</button>`;
                }

                card.innerHTML = `
                    <div class="flex justify-between items-start gap-4">
                        <div>
                            <h3 class="font-bold text-slate-800 text-base"><i class="fa-solid fa-circle-question text-rose-500 mr-1.5"></i> ${poll.question}</h3>
                            <p class="text-[10px] text-gray-400 mt-1 font-medium"><i class="fa-solid fa-users"></i> ผู้ร่วมโหวตทั้งหมด: ${totalVotesCount} คน</p>
                        </div>
                        ${deleteBtnHTML}
                    </div>
                    <div class="space-y-2.5 pt-2">${optionsHTML}</div>
                `;
                container.appendChild(card);
            });
        }

        async function createNewPoll() {
            const question = document.getElementById('vote-question').value.trim();
            const rawOptions = document.getElementById('vote-options').value.trim();
            
            if(!question || !rawOptions) return showAlert("แจ้งเตือน", "กรุณากรอกหัวข้อคำถามและระบุตัวเลือกให้ครบถ้วน", "warning");

            const optionsArray = rawOptions.split(',').map(o => o.trim()).filter(o => o.length > 0);
            if(optionsArray.length < 2) return showAlert("แจ้งเตือน", "กรุณาใส่ตัวเลือกอย่างน้อย 2 ตัวเลือกขึ้นไป (แยกกันด้วยคอมม่า ,)", "warning");

            const { error } = await _supabase.from('polls').insert([{
                question: question,
                options: optionsArray,
                created_by: userData.student_id
            }]);

            if(!error) {
                document.getElementById('vote-question').value = '';
                document.getElementById('vote-options').value = '';
                showAlert("สำเร็จ", "เปิดใช้งานหัวข้อโหวตใหม่เรียบร้อยแล้ว", "success");
                loadVoteData();
            } else {
                showAlert("ข้อผิดพลาด", "ไม่สามารถเปิดหัวข้อโหวตได้ในขณะนี้", "error");
            }
        }

        async function castVote(pollId, optionIndex) {
            const { error } = await _supabase.from('poll_votes').insert([{
                poll_id: pollId,
                student_id: userData.student_id,
                option_index: optionIndex
            }]);
            if(!error) loadVoteData();
            else showAlert("ปฏิเสธ", "คุณสิทธิ์ลงคะแนนเสียงไปแล้ว ไม่สามารถแก้ไขหรือโหวตซ้ำได้", "error");
        }

        function deletePoll(pollId) {
            showAlert("ยืนยันการลบ", "คุณต้องการปิดและลบหัวข้อโหวตนี้ออกจากระบบถาวรใช่หรือไม่?", "confirm", async () => {
                const { error } = await _supabase.from('polls').delete().eq('id', pollId);
                if(!error) {
                    showAlert("สำเร็จ", "ลบหัวข้อโหวตเรียบร้อย", "success");
                    loadVoteData();
                } else {
                    showAlert("ข้อผิดพลาด", "ไม่สามารถลบข้อมูลโหวตได้", "error");
                }
            });
        }
