// Authentication Logic
const RESET_TAXONOMY = {
    'User Self-Service': {
        reasons: {
            "I'm having trouble logging in": {
                level: 'Low',
                tip: '-Check caps lock. -Check the special character used. -Try another device.'
            },
            'Forgotten Password': {
                level: 'Low',
                tip: 'Use a password manager to keep your credentials safe.'
            },
            'Regular Update': {
                level: 'Low',
                tip: 'Regularly changing passwords helps maintain account health.'
            }
        }
    },
    'Security Incident': {
        reasons: {
            'Compromised Account': {
                level: 'Critical',
                tip: 'Check your active sessions and enable 2FA after resetting.'
            },
            'Suspicious Activity': {
                level: 'High',
                tip: 'Review your login history for unrecognized devices.'
            }
        }
    },
    'Administrative': {
        reasons: {
            'Policy Enforcement': {
                level: 'Medium',
                tip: 'Your organization requires a password update for compliance.'
            },
            'Account Recovery': {
                level: 'Medium',
                tip: 'Ensure your recovery email and phone are up to date.'
            }
        }
    },
    'Device Management': {
        reasons: {
            'Lost/Stolen Device': {
                level: 'High',
                tip: 'Revoke access for the old device in your security settings.'
            },
            'New Primary Device': {
                level: 'Medium',
                tip: 'Always set up new devices on a trusted, secure network.'
            }
        }
    }
};

const Auth = {
    async hashPassword(password, email = '') {
        return window.hashPassword(password, email);
    },

    async init() {
        // Parallelize initial checks
        const [m, user] = await Promise.all([
            this.getMaintenance(),
            SessionManager.getCurrentUser()
        ]);

        // Start maintenance banner polling (30s is enough for landing page)
        this.updateMaintBanners(m);
        setInterval(() => this.updateMaintBanners(), 30000);

        // Check for invite token in URL
        const urlParams = new URLSearchParams(window.location.search);
        const inviteToken = urlParams.get('invite');
        if (inviteToken) {
            await this.handleInvite(inviteToken);
            return;
        }

        // Check for forced password change session
        if (user && user.reset_request && user.reset_request.status === 'approved') {
            this.showNewPassword();
            return;
        }

        this.showSection('landing');
    },

    async handleInvite(token) {
        try {
            const invite = await SupabaseDB.getInvite(token);
            if (!invite) {
                alert('Invalid invitation link.');
                window.location.href = 'index.html';
                return;
            }

            if (invite.used_at) {
                alert('This invitation has already been used.');
                window.location.href = 'index.html';
                return;
            }

            if (new Date(invite.expires_at) < new Date()) {
                alert('This invitation has expired.');
                window.location.href = 'index.html';
                return;
            }

            // Valid invite, show signup form with prefilled data
            sessionStorage.setItem('activeInvite', JSON.stringify(invite));
            this.showSignup(invite.role);

            // Apply pre-fills immediately after switching the section view

            // Prefill email and make it readonly if it was specified in the invite
            const emailInput = document.getElementById('email');
            if (emailInput && invite.email) {
                emailInput.value = invite.email;
                if (invite.role === 'admin' || invite.role === 'teacher') {
                    emailInput.readOnly = true;
                }
            }

            // Lock the role selector
            const roleSelect = document.getElementById('role');
            if (roleSelect) {
                roleSelect.value = invite.role;
                roleSelect.disabled = true;
                // Add a visual indicator
                roleSelect.style.backgroundColor = '#f7fafc';
            }

        } catch (e) {
            console.error('Invite handling error:', e);
            alert('An error occurred while validating your invite.');
            window.location.href = 'index.html';
        }
    },

    // ---- Maintenance helpers ----
    async getMaintenance() {
        try {
            return await SupabaseDB.getMaintenance();
        } catch (error) {
            console.error('Error fetching maintenance:', error);
            return { enabled: false, schedules: [] };
        }
    },

    // ---- Section Switching ----
    showSection(id) {
        const overlay = document.getElementById('authOverlay');
        if (id === 'landing') {
            if (overlay) overlay.classList.remove('active');
            document.querySelectorAll('.container').forEach(c => c.style.display = 'none');
            return;
        }

        document.querySelectorAll('.container').forEach(c => c.style.display = 'none');
        const el = document.getElementById(id);
        if (overlay) overlay.classList.add('active');
        if (el) {
            el.style.display = 'block';
            // Focus first input
            const firstInput = el.querySelector('input');
            if (firstInput) firstInput.focus();
        }
    },

    showRoleAuth(role) {
        this.selectedRole = role;
        this.showLogin();
    },

    showSignup(role) {
        const targetRole = role || this.selectedRole || 'student';
        const titleEl = document.getElementById('signup-title');
        const roleEl = document.getElementById('role');
        const emailEl = document.getElementById('email');

        // Reset state from possible prior invite usage
        if (roleEl) {
            roleEl.value = targetRole;
            roleEl.disabled = false;
        }
        if (emailEl) {
            emailEl.readOnly = false;
            // Only clear if not prefilled by an invite
            if (!sessionStorage.getItem('activeInvite')) emailEl.value = '';
        }

        if (titleEl) titleEl.innerText = `Sign Up as ${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)}`;
        this.showSection('signup');
    },

    showLogin() {
        const titleEl = document.querySelector('#login h2');
        if (titleEl && this.selectedRole) {
            titleEl.innerText = `Login as ${this.selectedRole.charAt(0).toUpperCase() + this.selectedRole.slice(1)}`;
        } else if (titleEl) {
            titleEl.innerText = 'Login';
        }
        this.showSection('login');
    },
    showReset() {
        this.showSection('reset');
        this.initResetFormUI();
    },

    initResetFormUI() {
        const reasonSelect = document.getElementById('resetReason');
        const tipsContainer = document.getElementById('resetTipsContainer');
        const tipsText = document.getElementById('resetTips');
        if (!reasonSelect) return;

        // Reset state
        reasonSelect.innerHTML = '<option value="">Select Reason...</option>';
        if (tipsContainer) tipsContainer.style.display = 'none';

        // Populate flat list of reasons from taxonomy
        Object.keys(RESET_TAXONOMY).forEach(cat => {
            Object.keys(RESET_TAXONOMY[cat].reasons).forEach(reason => {
                const opt = document.createElement('option');
                opt.value = reason;
                opt.textContent = reason;
                reasonSelect.appendChild(opt);
            });
        });

        reasonSelect.onchange = () => {
            const reason = reasonSelect.value;
            if (!reason) {
                if (tipsContainer) tipsContainer.style.display = 'none';
                return;
            }

            // Find tip in taxonomy
            let foundTip = null;
            Object.values(RESET_TAXONOMY).forEach(cat => {
                if (cat.reasons[reason]) {
                    foundTip = cat.reasons[reason].tip;
                }
            });

            if (foundTip && tipsContainer && tipsText) {
                tipsContainer.style.display = 'block';
                tipsText.textContent = foundTip;
            } else if (tipsContainer) {
                tipsContainer.style.display = 'none';
            }
        };
    },
    showNewPassword() { this.showSection('newPassword'); },

    closeAuth() {
        const overlay = document.getElementById('authOverlay');
        if (overlay) overlay.classList.remove('active');
        document.querySelectorAll('.container').forEach(c => c.style.display = 'none');

        // Reset invite-related states
        sessionStorage.removeItem('activeInvite');
        const roleEl = document.getElementById('role');
        const emailEl = document.getElementById('email');
        if (roleEl) roleEl.disabled = false;
        if (emailEl) emailEl.readOnly = false;
    },

    // ---- Maintenance Banners ----
    mountMaintBanners() {
        return {
            landing: document.getElementById('maintBanner'),
            signup: document.getElementById('maintBannerSignup'),
            login: document.getElementById('maintBannerLogin'),
            reset: document.getElementById('maintBannerReset'),
        };
    },

    async updateMaintBanners(existingM = null) {
        // Delegate to global updateMaintBanner if core.js is loaded
        if (typeof updateMaintBanner === 'function') {
            return updateMaintBanner();
        }
    },

    redirectByRole(role) {
        if (role === 'student') window.location.href = 'student.html';
        else if (role === 'teacher') window.location.href = 'teacher.html';
        else if (role === 'admin') window.location.href = 'admin.html';
    },

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const toggle = input?.parentElement?.querySelector('.password-toggle');
        if (input) {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            if (toggle) toggle.textContent = isPassword ? '🔒' : '👁️';
        }
    },

    updatePasswordStrength(password) {
        const meter = document.getElementById('passwordStrength');
        const container = document.getElementById('passwordStrengthContainer');
        if (!meter || !container) return;

        if (!password) {
            meter.style.width = '0';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        let strength = 0;
        if (password.length >= 8) strength += 20;
        if (password.length >= 12) strength += 10;
        if (/[A-Z]/.test(password)) strength += 20;
        if (/[a-z]/.test(password)) strength += 10;
        if (/[0-9]/.test(password)) strength += 20;
        if (/[!@#$%^&*(),.?":{}|<>[\]\\/`~;:'"-=+]/.test(password)) strength += 20;

        meter.style.width = Math.min(100, strength) + '%';

        if (strength <= 40) meter.style.backgroundColor = 'var(--danger)';
        else if (strength <= 60) meter.style.backgroundColor = 'var(--warn)';
        else if (strength <= 80) meter.style.backgroundColor = '#4299e1'; // Blue
        else meter.style.backgroundColor = 'var(--ok)';
    }
};

// Global helpers (accessible from onclick)
window.showRoleAuth = (role) => Auth.showRoleAuth(role);
window.showSignup = (role) => Auth.showSignup(role);
window.showLogin = () => Auth.showLogin();
window.showReset = () => Auth.showReset();
window.showSection = (id) => Auth.showSection(id);
window.closeAuth = () => Auth.closeAuth();
window.togglePasswordVisibility = (id) => Auth.togglePasswordVisibility(id);

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();

    const signupPassword = document.getElementById('password');
    if (signupPassword) {
        signupPassword.addEventListener('input', (e) => {
            Auth.updatePasswordStrength(e.target.value);
        });
    }

    // ---- Signup ----
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const m = await Auth.getMaintenance();
            if (isActiveMaintenance(m)) {
                const untilTs = getActiveMaintenanceEnd(m);
                const untilStr = untilTs ? new Date(untilTs).toLocaleString() : 'the scheduled end time';
                alert(`System is currently undergoing maintenance. Signups are disabled until ${untilStr}.`);
                return;
            }
            const upcoming = getUpcomingMaintenance(m);
            if(upcoming){ alert(`Upcoming system maintenance: ${new Date(upcoming.startAt).toLocaleString()}`); }
            
            const fullName = (document.getElementById('fullName').value || '').trim();
            const email = normalizeEmail(document.getElementById('email').value);
            const phone = (document.getElementById('phone').value || '').trim();
            const password = document.getElementById('password').value;
            const confirm = document.getElementById('confirmPassword').value;
            const role = (document.getElementById('role').value || 'student');

            const errorEl = document.getElementById('signupError');
            errorEl.innerText = '';

            if (!fullName) {
                errorEl.innerText = 'Full name is required.';
                return;
            }
            if (!isValidEmail(email)) {
                errorEl.innerText = 'Please enter a valid email address.';
                return;
            }

            if (phone && !/^\+?[\d\s-]{10,}$/.test(phone)) {
                errorEl.innerText = 'Please enter a valid phone number (at least 10 digits).';
                return;
            }

            // Enforce limit of 3 accounts for admin and teacher roles for landing page signups
            // Bypassed if using a valid invitation
            const activeInviteRaw = sessionStorage.getItem('activeInvite');
            let activeInvite = null;
            if (activeInviteRaw) {
                try { activeInvite = JSON.parse(activeInviteRaw); } catch (e) { console.warn('Corrupt invite session data'); }
            }

            if ((role === 'admin' || role === 'teacher') && !activeInvite) {
                try {
                    const roleCount = await SupabaseDB.getCount('users', q => q.eq('role', role));
                    if (roleCount >= 3) {
                        const roleName = role.charAt(0).toUpperCase() + role.slice(1);
                        errorEl.innerText = `The maximum number of ${roleName} accounts has been reached. Please contact an existing admin to create more accounts.`;
                        return;
                    }
                } catch (e) {
                    console.error(`Error checking ${role} count:`, e);
                }
            }

            const existing = await SupabaseDB.getUser(email);
            if (existing) {
                if (existing.reset_request) {
                    if (existing.reset_request.status === 'pending') {
                        errorEl.innerText = 'This account has an active password reset request pending admin review. You cannot sign up again.';
                        return;
                    }
                    if (existing.reset_request.status === 'approved') {
                        errorEl.innerHTML = 'This account has an approved password reset. Please use the temporary password provided by your administrator to login.';
                        return;
                    }
                }
                errorEl.innerText = 'Account with this email already exists.';
                return;
            }
            if (password !== confirm) {
                errorEl.innerText = 'Passwords do not match.';
                return;
            }
            if (!isStrongPassword(password)) {
                errorEl.innerText = 'Password must be 8+ chars, include upper, lower, number, and special char.';
                return;
            }

            const hashedPassword = await Auth.hashPassword(password, email);

            // Generate a fresh session ID for the new signup
            const sid = SessionManager.getSessionId(true);

            const user = {
                full_name: fullName,
                email,
                phone,
                password: hashedPassword,
                role,
                session_id: sid,
                invite_token: activeInvite?.token || null
            };
            
            const savedUser = await SupabaseDB.saveUser(user);
            if (!savedUser) {
                errorEl.innerText = 'Failed to create account. Please try again.';
                return;
            }

            // Establish RLS session context
            window.setSupabaseSession(sid);

            // Mark invite as used if applicable
            if (activeInvite) {
                try {
                    await SupabaseDB.markInviteUsed(activeInvite.token);
                    sessionStorage.removeItem('activeInvite');
                } catch (e) {
                    console.warn('Failed to mark invite as used:', e);
                }
            }
            
            await SessionManager.setCurrentUser(savedUser);
            alert(`Welcome ${fullName}! Your ${role} account has been created.`);
            Auth.redirectByRole(role);
        });
    }

    // ---- Login ----
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = normalizeEmail(document.getElementById('loginEmail').value);
            const emailErr = document.getElementById('loginEmailError');
            if (emailErr) emailErr.innerText = '';

            if (!isValidEmail(email)) {
                if (emailErr) emailErr.innerText = 'Please enter a valid email address.';
                return;
            }

            const m = await Auth.getMaintenance();
            if (isActiveMaintenance(m)) {
                let allow = false;
                try {
                    const user = await SupabaseDB.getUser(email);
                    allow = !!(user && user.role === 'admin');
                } catch (_) { allow = false; }
                if (!allow) {
                    const untilTs = getActiveMaintenanceEnd(m);
                    const untilStr = untilTs ? new Date(untilTs).toLocaleString() : 'the scheduled end time';
                    alert(`System is currently undergoing maintenance. Only admin login allowed until ${untilStr}.`);
                    return;
                }
            }
            const upcoming = getUpcomingMaintenance(m);
            if (upcoming) { alert(`Upcoming system maintenance: ${new Date(upcoming.startAt).toLocaleString()}`); }
            
            const password = document.getElementById('loginPassword').value;
            const passErr = document.getElementById('loginPasswordError');
            if (emailErr) emailErr.innerText = '';
            if (passErr) passErr.innerText = '';

            const user = await SupabaseDB.getUser(email);

            if (!user) {
                if (emailErr) emailErr.innerText = 'No account found with this email';
                return;
            }

            if (isAccountLocked(user)) {
                const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
                if (passErr) passErr.innerText = `Account is locked. Try again in ${mins} minutes`;
                return;
            }

            // Handle expired reset requests
            if (user.reset_request && user.reset_request.expires_at && Date.now() > new Date(user.reset_request.expires_at).getTime()) {
                user.reset_request = null;
                await SupabaseDB.saveUser(user);
            }

            if (user.reset_request) {
                if (user.reset_request.status === 'pending') {
                    if (passErr) passErr.innerText = 'Password reset request pending admin review.';
                    return;
                }
                if (user.reset_request.status === 'approved') {
                    if (user.reset_request.expires_at && Date.now() > new Date(user.reset_request.expires_at).getTime()) {
                        user.reset_request = null;
                        await SupabaseDB.saveUser(user);
                        if (passErr) passErr.innerText = 'Temporary password expired. Please request a new reset.';
                        return;
                    }

                }
            }

            const hashedInput = await Auth.hashPassword(password, email);

            try {
                // Clear existing session and generate a fresh one BEFORE authentication
                const sid = SessionManager.getSessionId(true);

                const authResult = await SupabaseDB.authenticateUser(email, hashedInput, sid);

                if (!authResult.success) {
                    if (passErr) {
                        passErr.innerText = authResult.message || 'Login failed';
                    }
                    return;
                }

                const authUser = authResult.user;

                // Establish RLS session context immediately after successful auth
                window.setSupabaseSession(sid);
                await SessionManager.setCurrentUser(authUser);

                // Handle approved reset redirection
                if (authUser.reset_request && authUser.reset_request.status === 'approved') {
                    Auth.showNewPassword();
                    return;
                }

                alert(`Welcome back ${authUser.full_name}!`);
                Auth.redirectByRole(authUser.role);

            } catch (err) {
                console.error('Auth error:', err);
                if (passErr) passErr.innerText = 'An error occurred during login. Please try again.';
            }
        });
    }

    // ---- Reset Request ----
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = normalizeEmail(document.getElementById('resetEmail').value);
            const reason = document.getElementById('resetReason').value;
            const customReason = document.getElementById('resetCustomReason')?.value || '';

            const m = await Auth.getMaintenance();
            const err = document.getElementById('resetError');
            if (err) err.innerText = '';

            if (!isValidEmail(email)) {
                if (err) err.innerText = 'Please enter a valid email address.';
                return;
            }

            if (!reason) {
                if (err) err.innerText = 'Please select a reason.';
                return;
            }

            if (isActiveMaintenance(m)) {
                try {
                    const user = await SupabaseDB.getUser(email);
                    if (!(user && user.role === 'admin')) {
                        const untilTs = getActiveMaintenanceEnd(m);
                        const untilStr = untilTs ? new Date(untilTs).toLocaleString() : 'the scheduled end time';
                        if (err) err.innerText = `System is currently undergoing maintenance. No reset allowed until ${untilStr}.`;
                        return;
                    }
                } catch (_) {
                    const untilTs = getActiveMaintenanceEnd(m);
                    const untilStr = untilTs ? new Date(untilTs).toLocaleString() : 'the scheduled end time';
                    if (err) err.innerText = `System is currently undergoing maintenance. No reset allowed until ${untilStr}.`;
                    return;
                }
            }
            const upcoming = getUpcomingMaintenance(m);
            if (upcoming) { if (err) err.innerText = `Upcoming system maintenance: ${new Date(upcoming.startAt).toLocaleString()}`; }
            
            const user = await SupabaseDB.getUser(email);
            if (!user) {
                if (err) err.innerText = 'No account found with this email';
                return;
            }
            if (!user.active) {
                if (err) err.innerText = 'Your account has been deactivated.';
                return;
            }
            if (user.flagged) {
                if (err) err.innerText = 'Your account is flagged for suspicious activities. Contact admin for support.';
                return;
            }
            if (isAccountLocked(user)) {
                if (err) err.innerText = 'Your account is locked due to failed attempts. Try again later.';
                return;
            }

            // Expire old reset automatically
            if (user.reset_request && user.reset_request.expires_at && Date.now() > new Date(user.reset_request.expires_at).getTime()) {
                user.reset_request = null;
            }

            if (user.reset_request) {
                if (user.reset_request.status === 'pending') {
                    if (err) err.innerText = 'Reset request already pending review.';
                    return;
                }
                if (user.reset_request.status === 'approved') {
                    if (err) err.innerHTML = 'Reset already approved. Use temporary password provided by administrator to login.';
                    return;
                }
            }

            user.reset_request = {
                status: 'pending',
                reason: reason,
                custom_reason: customReason,
                temp_password: null,
                created_at: new Date().toISOString(),
                expires_at: null,
                denial_reason: null
            };

            await Promise.all([
                SupabaseDB.saveUser(user),
                SupabaseDB.createNotification(
                    user.email,
                    'Reset Requested',
                    'Password reset requested and pending admin review.',
                    null,
                    'reset_requested'
                )
            ]);
            alert('Password reset request submitted. Admin will review it.');
            Auth.showLogin();
        });
    }

    // ---- New Password ----
    const newPasswordForm = document.getElementById('newPasswordForm');
    if (newPasswordForm) {
        newPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let user = await SessionManager.getCurrentUser();

            const newPass = document.getElementById('newPass').value;
            const confirm = document.getElementById('confirmNewPass').value;

            const err = document.getElementById('newPasswordError');
            if (err) err.innerText = '';

            if (!user) {
                if (err) err.innerText = 'Session expired. Please login again with temporary password.';
                Auth.showLogin();
                return;
            }

            // Validate reset approval still valid
            const freshUser = await SupabaseDB.getUser(user.email);
            if (!freshUser.reset_request || freshUser.reset_request.status !== 'approved') {
                if (err) err.innerText = 'No active reset found. Please request a new reset.';
                Auth.showReset();
                return;
            }
            if (freshUser.reset_request.expires_at && Date.now() > new Date(freshUser.reset_request.expires_at).getTime()) {
                freshUser.reset_request = null;
                await SupabaseDB.saveUser(freshUser);
                if (err) err.innerText = 'Temporary password expired. Please request a new reset.';
                Auth.showReset();
                return;
            }

            if (newPass !== confirm) {
                if (err) err.innerText = 'Passwords do not match.';
                return;
            }
            if (!isStrongPassword(newPass)) {
                if (err) err.innerText = 'Password must be at least 8 chars, include upper, lower, number, and special char.';
                return;
            }

            // Update password and clear reset request
            freshUser.password = await Auth.hashPassword(newPass, freshUser.email);
            freshUser.reset_request = null;

            // After updating the password, generate a fresh session ID
            const sid = SessionManager.getSessionId(true);
            freshUser.session_id = sid;

            // Persist changes and get authoritative user object
            const updatedUser = await SupabaseDB.saveUser(freshUser);

            // Establish RLS session context and persist updated user data
            window.setSupabaseSession(sid);
            await SessionManager.setCurrentUser(updatedUser);

            // Notify user of update
            await SupabaseDB.createNotification(
                freshUser.email,
                'Password Updated',
                'Password updated after reset.',
                null,
                'password_updated'
            );

            alert('Password successfully reset. You can now login with your new password.');
            Auth.showLogin();
        });
    }
});
