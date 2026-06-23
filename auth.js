function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getApiBase() {
    if (typeof window !== 'undefined' && window.EDU_API_BASE) {
        return String(window.EDU_API_BASE).replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
    }
    return '';
}

function getEduToken() {
    return localStorage.getItem('edu_token') || '';
}

function setEduSession(token, user) {
    if (token) localStorage.setItem('edu_token', token);
    localStorage.setItem('currentUser', user.displayName || user.username);
    localStorage.setItem('currentUsername', user.username);
    localStorage.setItem('currentUserRole', user.role || 'student');
    localStorage.setItem('currentUserLevel', user.level || 'beginner');
}

async function loginViaApi(username, password) {
    const base = getApiBase();
    if (!base) return null;

    try {
        const res = await fetch(`${base}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return null;
        if (!data.token || !data.user) return null;
        return { token: data.token, user: data.user };
    } catch (e) {
        console.warn('API login unavailable:', e);
        return null;
    }
}

/** @deprecated Legacy fallback when API routes are unavailable (statik server) */
async function findUserByCredentialsLegacy(username, password) {
    if (username === 'admin123' && password === 'admin') {
        return { 
            username: 'admin123', 
            role: 'admin', 
            displayName: 'EduLife Admin', 
            token: 'local_admin_dummy_token' 
        };
    }
    return null;
}

async function loginUser(e) {
    if (e) e.preventDefault();
    const userEmail = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const error = document.getElementById('loginError');

    let userFound = false;

    if (window.eduSupabase) {
        try {
            const { data, error: rpcError } = await window.eduSupabase
                .rpc('verify_student_login', {
                    p_username: userEmail,
                    p_password: pass
                });

            if (!rpcError && data && data.length > 0) {
                const user = data[0];
                setEduSession('', {
                    username: user.username,
                    displayName: user.display_name,
                    role: user.role || 'student',
                    level: user.level
                });

                if (user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
                userFound = true;
            } else if (userEmail === 'admin123' && pass === 'admin') {
                setEduSession('', {
                    username: 'admin123',
                    displayName: 'Admin',
                    role: 'admin'
                });
                window.location.href = 'admin.html';
                userFound = true;
            }
        } catch (e) {
            console.error('RPC login failed', e);
        }
    }

    if (!userFound) {
        const apiResult = await loginViaApi(userEmail, pass);
        if (apiResult) {
            setEduSession(apiResult.token, apiResult.user);
            const role = apiResult.user.role || 'student';
            if (role === 'student') {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'admin.html';
            }
            userFound = true;
        }
    }

    if (!userFound) {
        const legacy = await findUserByCredentialsLegacy(userEmail, pass);
        if (legacy) {
            if (legacy.token) localStorage.setItem('edu_token', legacy.token);
            else localStorage.removeItem('edu_token');
            setEduSession(legacy.token || '', legacy);
            if (legacy.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
            userFound = true;
        }
    }

    if (!userFound) {
        error.innerText = getApiBase()
            ? 'Invalid username or password'
            : 'Login requires the site server (Vercel or npx vercel dev). Statik fayl ochish ishlamaydi.';
        error.style.display = 'block';
    }
}

async function logout() {
    if (window.eduSupabase) {
        await window.eduSupabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentUsername');
    localStorage.removeItem('currentUserRole');
    localStorage.removeItem('currentUserLevel');
    localStorage.removeItem('edu_token');
    localStorage.removeItem('supabase_session');
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', loginUser);
    }

    const navRight = document.querySelector('.nav-links');
    if (navRight && !window.location.href.includes('admin.html')) {
        const currentUser = localStorage.getItem('currentUser');
        const currentRole = localStorage.getItem('currentUserRole');
        const esc = escapeHtml;

        if (currentUser) {
            if (currentRole === 'admin') {
                const adminLi = document.createElement('li');
                adminLi.innerHTML = '<a href="admin.html" style="font-weight:700;">Admin</a>';
                navRight.appendChild(adminLi);

                const studentLi = document.createElement('li');
                studentLi.innerHTML = '<a href="students.html" style="font-weight:700;">Student Logins</a>';
                navRight.appendChild(studentLi);
            }

            const li = document.createElement('li');
            li.innerHTML = `<a href="#" onclick="logout(); return false;" style="color:var(--primary); font-weight:700;">Logout (${esc(currentUser)})</a>`;
            navRight.appendChild(li);
        } else {
            const li = document.createElement('li');
            li.innerHTML = '<a href="login.html" class="btn btn-outline" style="padding: 0.4rem 1rem; border-width:1px;">Login</a>';
            navRight.appendChild(li);
        }
    }
});

if (typeof window !== 'undefined') {
    window.getEduToken = getEduToken;
    window.getApiBase = getApiBase;
}
