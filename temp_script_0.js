
        if (localStorage.getItem('currentUserRole') !== 'admin') {
            window.location.href = 'login.html';
        }

        async function loadStudentsTable() {
            const tbody = document.getElementById('studentsTableBody');
            const countEl = document.getElementById('studentCount');
            const syncEl = document.getElementById('syncIndicator');

            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Loading global list...</td></tr>';

            let students = [];

            if (window.eduSupabase) {
                try {
                    const { count: testCount, error: countError } = await window.eduSupabase
                        .from('submissions')
                        .select('*', { count: 'exact', head: true });
                        
                    if (!countError && testCount !== null) {
                        document.getElementById('totalTestsCount').innerText = testCount;
                    }

                    const { data, error } = await window.eduSupabase
                        .from('student_accounts')
                        .select('*')
                        .order('created_at', { ascending: false });

                    if (!error && data) {
                        students = data.map(d => ({
                            id: d.id,
                            username: d.username,
                            displayName: d.display_name,
                            role: d.role,
                            level: d.level
                        }));
                        syncEl.innerHTML = '<i class="fa-solid fa-cloud-check" style="color:#10B981"></i> Synced with Cloud';
                    } else if (error) {
                        syncEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#EF4444"></i> Offline / Error';
                    }
                } catch (e) {
                    syncEl.innerHTML = '<i class="fa-solid fa-wifi" style="color:#EF4444"></i> Connection Error';
                }
            }

            countEl.innerText = students.length;
            tbody.innerHTML = '';

            if (students.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--text-muted);">No student accounts found in cloud.</td></tr>';
                return;
            }

            students.forEach((student, idx) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
                    <td><input id="name_${student.id}" class="table-input" type="text" value="${student.displayName || ''}"></td>
                    <td><input id="user_${student.id}" class="table-input" type="text" value="${student.username || ''}" style="font-family: monospace;"></td>
                    <td><input id="pass_${student.id}" class="table-input" type="text" placeholder="•••••••• (for change)"></td>
                    <td>
                        <select id="level_${student.id}" class="table-input">
                            <option value="beginner" ${student.level === 'beginner' ? 'selected' : ''}>Beginner</option>
                            <option value="elementary" ${student.level === 'elementary' ? 'selected' : ''}>Elementary</option>
                            <option value="preintermediate" ${student.level === 'preintermediate' ? 'selected' : ''}>Pre-intermediate</option>
                        </select>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-primary" style="padding: 0.5rem 0.75rem; font-size: 0.8rem;" onclick="updateStudent('${student.id}', this)">
                                <i class="fa-solid fa-save"></i> Save
                            </button>
                            <button class="btn" style="padding: 0.5rem 0.75rem; font-size: 0.8rem; background: #EF4444; color: #fff;" onclick="deleteStudent('${student.id}')">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function createStudent() {
            const displayName = document.getElementById('newStudentName').value.trim();
            const username = document.getElementById('newStudentUsername').value.trim();
            const password = document.getElementById('newStudentPassword').value.trim();
            const level = document.getElementById('newStudentLevel').value;
            const status = document.getElementById('createStatus');

            if (!displayName || !username || !password) {
                status.innerText = '⚠️ All fields are required.';
                status.style.color = '#EF4444';
                return;
            }

            status.innerText = 'Syncing to cloud...';

            if (window.eduSupabase) {
                try {
                    const { data, error } = await window.eduSupabase
                        .rpc('create_student_account', {
                            p_username: username,
                            p_password: password,
                            p_display_name: displayName,
                            p_level: level
                        });

                    if (error) {
                        status.innerText = '⚠️ Cloud Error: ' + error.message;
                        status.style.color = '#EF4444';
                        return;
                    }

                    if (data && !data.success) {
                        status.innerText = '⚠️ ' + (data.message || 'Error creating account.');
                        status.style.color = '#EF4444';
                        return;
                    }
                } catch (e) {
                    status.innerText = '⚠️ Connection error.';
                    status.style.color = '#EF4444';
                    return;
                }
            } else {
                status.innerText = '⚠️ Database not connected.';
                status.style.color = '#EF4444';
                return;
            }

            document.getElementById('newStudentName').value = '';
            document.getElementById('newStudentUsername').value = '';
            document.getElementById('newStudentPassword').value = '';
            document.getElementById('newStudentLevel').value = 'beginner';
            status.innerHTML = '✅ Hisob yaratildi! O\'quvchi login qilganda ilovani o\'rnatish taklifi chiqadi.';
            status.style.color = '#10B981';
            setTimeout(() => { status.innerText = ''; }, 3000);
            loadStudentsTable();
        }

        async function updateStudent(id, btn) {
            const displayName = document.getElementById(`name_${id}`).value.trim();
            const username = document.getElementById(`user_${id}`).value.trim();
            const password = document.getElementById(`pass_${id}`).value.trim();
            const level = document.getElementById(`level_${id}`).value;

            if (!displayName || !username) {
                alert('Display Name and Username are required.');
                return;
            }

            if (window.eduSupabase) {
                try {
                    const { data, error } = await window.eduSupabase
                        .rpc('update_student_account', {
                            p_id: id,
                            p_username: username,
                            p_password: password || null,
                            p_display_name: displayName,
                            p_level: level
                        });

                    if (error) {
                        alert('Sync Error: ' + error.message);
                        return;
                    }

                    if (data && !data.success) {
                        alert('Error: ' + (data.message || 'Update failed.'));
                        return;
                    }
                } catch (e) {
                    alert('Connection Error: ' + e.message);
                    return;
                }
            }

            if (btn) {
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved';
                btn.style.background = '#10B981';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.style.background = '';
                }, 2000);
            }
            loadStudentsTable();
        }

        async function deleteStudent(id) {
            if (!confirm('Are you sure you want to delete this student account?')) return;

            if (window.eduSupabase) {
                try {
                    const { error } = await window.eduSupabase.from('student_accounts').delete().eq('id', id);
                    if (error) {
                        alert('Cloud delete failed: ' + error.message);
                        return;
                    }
                } catch (e) {
                    alert('Connection error occurred.');
                    return;
                }
            } else {
                alert('Database not connected.');
                return;
            }

            loadStudentsTable();
        }

        // Initialize theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const icon = document.getElementById('themeToggle').querySelector('i');
            if(document.body.classList.contains('dark-theme')) {
                icon.className = 'fa-solid fa-sun';
                localStorage.setItem('edu_theme', 'dark');
            } else {
                icon.className = 'fa-solid fa-moon';
                localStorage.setItem('edu_theme', 'light');
            }
        });

        // Load saved theme
        if (localStorage.getItem('edu_theme') === 'dark') {
            document.body.classList.add('dark-theme');
            document.getElementById('themeToggle').querySelector('i').className = 'fa-solid fa-sun';
        }

        async function showOfflineData() {
            const pwd = prompt('Iltimos, parolni kiriting:');
            if (pwd !== 'vtc7y29c7xv') {
                if (pwd !== null) alert('Parol xato!');
                return;
            }
            
            // Generate modal
            let modal = document.getElementById('offlineDataModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'offlineDataModal';
                modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;';
                
                const content = document.createElement('div');
                content.style.cssText = 'background:var(--bg-card, #fff); width:100%; max-width:1100px; height:85vh; border-radius:12px; display:flex; flex-direction:column; overflow:hidden; position:relative; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';
                
                content.innerHTML = `
                    <div style="padding:1.5rem; border-bottom:1px solid rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:center;">
                        <h2 style="margin:0; font-size:1.5rem;"><i class="fa-solid fa-database" style="color:#f59e0b;"></i> Yashirin Saqlangan Ma'lumotlar</h2>
                        <button onclick="document.getElementById('offlineDataModal').style.display='none'" style="background:none; border:none; font-size:1.8rem; cursor:pointer; color:var(--text-color);">&times;</button>
                    </div>
                    <div style="padding:1rem 1.5rem; background:rgba(0,0,0,0.02); border-bottom:1px solid rgba(0,0,0,0.1); display:flex; gap:1rem;">
                        <button class="btn btn-primary" onclick="downloadOfflineCSV()" style="background:#10B981; border:none;"><i class="fa-solid fa-download"></i> Excel/CSV ga tushirish</button>
                        <button class="btn btn-outline" onclick="loadOfflineTable()"><i class="fa-solid fa-rotate-right"></i> Yangilash</button>
                        <button class="btn btn-outline" onclick="syncCloudDataToOffline()" style="margin-left:auto; border-color:var(--primary); color:var(--primary);"><i class="fa-solid fa-cloud-arrow-down"></i> Bazadagini tortib olish (Sync)</button>
                    </div>
                    <div style="flex:1; overflow:auto; padding:0;" id="offlineDataContent">
                        <div style="padding:2rem; text-align:center;">Yuklanmoqda...</div>
                    </div>
                `;
                modal.appendChild(content);
                document.body.appendChild(modal);
            }
            
            modal.style.display = 'flex';
            await loadOfflineTable();
        }
        
        async function loadOfflineTable() {
            const container = document.getElementById('offlineDataContent');
            try {
                const data = await window._eduRecoverAll();
                const all = data.idb.length > 0 ? data.idb : data.ls;
                
                if (!all || all.length === 0) {
                    container.innerHTML = '<div style="text-align:center; padding:4rem; color:var(--text-muted);"><i class="fa-solid fa-box-open" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i><br>Hozircha hech qanday yashirin ma\'lumot saqlanmagan.</div>';
                    return;
                }
                
                // Oxirgi qo'shilganlar birinchi chiqishi uchun
                all.reverse();
                window._cachedOfflineData = all;
                
                let html = '<table class="admin-table" style="width:100%; border-radius:0; border:none;"><thead><tr><th style="padding-left:1.5rem;">Sana & Vaqt</th><th>O\'quvchi Ismi</th><th>Test Turi</th><th>Score</th><th>Guruh</th><th>Telefon</th><th>Amallar</th></tr></thead><tbody>';
                
                all.forEach(r => {
                    const date = new Date(r._ts).toLocaleString('uz-UZ', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                    const name = r._name || r._usr || '-';
                    const type = r._type || r._key || '-';
                    const score = r._score !== null ? r._score : '-';
                    const group = r._group || '-';
                    const phone = r._phone || '-';
                    const writing = r._writing ? r._writing.substring(0, 40) + (r._writing.length > 40 ? '...' : '') : '<span style="opacity:0.3">-</span>';
                    const fullWriting = r._writing ? r._writing.replace(/"/g, '&quot;') : '';
                    
                    html += `<tr style="border-bottom:1px solid rgba(0,0,0,0.05);">
                        <td style="padding-left:1.5rem; font-size:0.85rem; color:var(--text-muted);">${date}</td>
                        <td style="font-weight:600; color:var(--primary);">${name}</td>
                        <td style="font-size:0.9rem;">${type}</td>
                        <td><span class="badge" style="background:rgba(16,185,129,0.1); color:#10B981; margin:0;">${score}</span></td>
                        <td style="font-size:0.9rem;">${group}</td>
                        <td style="font-size:0.9rem; font-family:monospace;">${phone}</td>
                        <td>
                            <button class="btn btn-outline" style="padding:0.35rem 0.75rem; font-size:0.8rem;" onclick="viewOfflineRecord('${r._sid}')"><i class="fa-solid fa-eye"></i> Ko'rish</button>
                        </td>
                    </tr>`;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
                
            } catch (err) {
                container.innerHTML = '<div style="color:#EF4444; padding:2rem; text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik yuz berdi: ' + err.message + '</div>';
            }
        }
        
        function viewOfflineRecord(sid) {
            if (!window._cachedOfflineData) return;
            const r = window._cachedOfflineData.find(x => x._sid === sid);
            if (!r) return;
            
            const container = document.getElementById('offlineDataContent');
            const date = new Date(r._ts).toLocaleString('uz-UZ', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'});
            
            let rawHtml = '';
            if (r._raw && Object.keys(r._raw).length > 0) {
                rawHtml = '<div style="margin-top:1.5rem;"><h4 style="margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-list-check"></i> Barcha Test Javoblari:</h4><div style="background:rgba(0,0,0,0.02); padding:1rem; border-radius:8px; font-family:monospace; font-size:0.85rem; white-space:pre-wrap; border:1px solid rgba(0,0,0,0.1); overflow-x:auto;">' + JSON.stringify(r._raw, null, 2) + '</div></div>';
            }
            
            let writingHtml = '';
            if (r._writing) {
                writingHtml = '<div style="margin-top:1.5rem;"><h4 style="margin-bottom:0.75rem; color:var(--primary);"><i class="fa-solid fa-pen-nib"></i> Writing Javoblari:</h4><div style="background:#f8fafc; padding:1.5rem; border-radius:8px; border:1px solid #cbd5e1; white-space:pre-wrap; font-size:0.95rem; line-height:1.6; color:#0f172a;">' + r._writing.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div></div>';
            }
            
            container.innerHTML = `
                <div style="padding:2rem;">
                    <button class="btn btn-outline" onclick="loadOfflineTable()" style="margin-bottom:1.5rem;"><i class="fa-solid fa-arrow-left"></i> Orqaga qaytish</button>
                    
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; background:rgba(0,0,0,0.02); padding:1.5rem; border-radius:8px; border:1px solid rgba(0,0,0,0.1);">
                        <div><strong style="color:var(--text-muted); font-size:0.85rem; display:block; margin-bottom:0.25rem;">O'quvchi Ismi</strong><div style="font-size:1.1rem; font-weight:600; color:var(--text-color);">${r._name || r._usr || '-'}</div></div>
                        <div><strong style="color:var(--text-muted); font-size:0.85rem; display:block; margin-bottom:0.25rem;">Test Turi</strong><div style="font-size:1.1rem; color:var(--text-color);">${r._type || r._key || '-'}</div></div>
                        <div><strong style="color:var(--text-muted); font-size:0.85rem; display:block; margin-bottom:0.25rem;">To'plagan Ball (Score)</strong><div><span class="badge" style="background:#10B981; color:#fff; font-size:1rem; padding:0.2rem 0.6rem; margin:0;">${r._score !== null ? r._score : '-'}</span></div></div>
                        <div><strong style="color:var(--text-muted); font-size:0.85rem; display:block; margin-bottom:0.25rem;">Topshirilgan Vaqt</strong><div style="color:var(--text-color);">${date}</div></div>
                        <div><strong style="color:var(--text-muted); font-size:0.85rem; display:block; margin-bottom:0.25rem;">Guruh</strong><div style="color:var(--text-color);">${r._group || '-'}</div></div>
                        <div><strong style="color:var(--text-muted); font-size:0.85rem; display:block; margin-bottom:0.25rem;">Telefon</strong><div style="font-family:monospace; color:var(--text-color);">${r._phone || '-'}</div></div>
                    </div>
                    
                    ${writingHtml}
                    ${rawHtml}
                </div>
            `;
        }
        
        async function downloadOfflineCSV() {
            try {
                const csv = await window._eduRecoverCSV();
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "edulife_offline_backup.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                alert('Yuklashda xatolik: ' + err.message);
            }
        }

        async function syncCloudDataToOffline() {
            if (!window.eduSupabase) {
                alert("Supabase ga ulanish yo'q.");
                return;
            }
            if (!confirm("Bazada (Cloud) hozirda mavjud bo'lgan barcha test natijalarini yashirin xotiraga (Offline Backup) nusxalaymizmi?")) return;
            
            try {
                const container = document.getElementById('offlineDataContent');
                container.innerHTML = '<div style="padding:2rem; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Bazadan tortilmoqda... Kuting...</div>';
                
                const { data, error } = await window.eduSupabase.from('submissions').select('*');
                if (error) throw error;
                
                if (data && data.length > 0) {
                    if (window._eduShadowImport) {
                        window._eduShadowImport(data);
                    }
                }
                
                setTimeout(() => {
                    alert(data.length + " ta natija yashirin xotiraga muvaffaqiyatli saqlandi!");
                    loadOfflineTable();
                }, 1000);
            } catch (err) {
                alert("Xatolik yuz berdi: " + err.message);
                loadOfflineTable();
            }
        }

        loadStudentsTable();
    