// Common Utilities
window.escapeHtml = function(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

window.escapeAttr = function(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// Common UI and Logic
const UI = {
    renderStats(containerId, stats) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="stats-grid">
                ${stats.map(s => `
                    <div class="stat-card">
                        <h4>${escapeHtml(s.label)}</h4>
                        <div class="value">${escapeHtml(s.value)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    isEmbeddable(url) {
        if (!url) return true;
        const restricted = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'webex.com'];
        return !restricted.some(domain => url.toLowerCase().includes(domain));
    },

    showMeetingChoice(url = '') {
        return new Promise((resolve) => {
            const embeddable = this.isEmbeddable(url);
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.display = 'flex';
            backdrop.innerHTML = `
                <div class="modal" style="max-width:400px; text-align:center">
                    <h3>Join Meeting</h3>
                    <p class="small">${embeddable ? 'How would you like to open this meeting?' : 'This meeting provider does not allow embedding. Please open in a new tab.'}</p>
                    <div class="flex-column gap-10 mt-20">
                        ${embeddable ? '<button class="button" id="choiceApp">Open in App (Embed)</button>' : ''}
                        <button class="button ${embeddable ? 'secondary' : ''}" id="choiceTab">Open in New Tab</button>
                        <button class="button danger small" id="choiceCancel">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);

            const cleanup = (val) => {
                backdrop.remove();
                resolve(val);
            };

            if (embeddable) document.getElementById('choiceApp').onclick = () => cleanup('app');
            document.getElementById('choiceTab').onclick = () => cleanup('tab');
            document.getElementById('choiceCancel').onclick = () => cleanup(null);
        });
    },

    showNotification(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 3000);
        }, 3000);
    },

    showLoading(containerId = 'pageContent', message = 'Loading content...') {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="loading-state flex-center flex-column p-40">
                <div class="loading-spinner mb-20"></div>
                <div class="text-muted">${escapeHtml(message)}</div>
            </div>
        `;
    },

    hideLoading(containerId = 'pageContent') {
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = '';
    },

    confirm(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.display = 'flex';
            backdrop.innerHTML = `
                <div class="modal" style="max-width:400px; text-align:center">
                    <h3>${escapeHtml(title)}</h3>
                    <p class="small">${escapeHtml(message)}</p>
                    <div class="flex gap-10 mt-20">
                        <button class="button danger" id="confirmYes">Confirm</button>
                        <button class="button secondary" id="confirmNo">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
            document.getElementById('confirmYes').onclick = () => { backdrop.remove(); resolve(true); };
            document.getElementById('confirmNo').onclick = () => { backdrop.remove(); resolve(false); };
        });
    },

    prompt(message, placeholder = '', title = 'Input Required') {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.style.display = 'flex';
            backdrop.innerHTML = `
                <div class="modal" style="max-width:400px">
                    <h3>${escapeHtml(title)}</h3>
                    <p class="small">${escapeHtml(message)}</p>
                    <input type="text" id="promptInput" class="mt-10" placeholder="${escapeAttr(placeholder)}">
                    <div class="flex gap-10 mt-20">
                        <button class="button" id="promptOk">OK</button>
                        <button class="button secondary" id="promptCancel">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(backdrop);
            const input = document.getElementById('promptInput');
            input.focus();
            document.getElementById('promptOk').onclick = () => {
                const val = input.value;
                backdrop.remove();
                resolve(val);
            };
            document.getElementById('promptCancel').onclick = () => { backdrop.remove(); resolve(null); };
        });
    },

    viewFile(url, title) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.display = 'flex';

        const ext = url.split('.').pop().toLowerCase().split('?')[0];
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
        const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
        const isCsv = ext === 'csv';

        let viewerHtml = '';
        if (isImage) {
            viewerHtml = `<div style="flex:1; display:flex; align-items:center; justify-content:center; background:#f0f0f0; border-radius:8px; overflow:auto">
                <img src="${escapeAttr(url)}" style="max-width:100%; max-height:100%; object-fit:contain">
            </div>`;
        } else if (isOffice || isCsv) {
            // Office and CSV are best viewed via Google Docs viewer for in-app preview
            const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
            viewerHtml = `<div style="flex:1; background:#f0f0f0; border-radius:8px; overflow:hidden; position:relative">
                <iframe src="${viewerUrl}" style="width:100%; height:100%; border:none"></iframe>
                <div class="absolute bottom-10 right-10 flex gap-5">
                    <a href="${escapeAttr(url)}" target="_blank" class="button secondary small w-auto" style="background:rgba(255,255,255,0.9)">Download Original</a>
                </div>
            </div>`;
        } else {
            // Default to iframe for PDF and others
            viewerHtml = `<div style="flex:1; background:#f0f0f0; border-radius:8px; overflow:hidden">
                <iframe src="${escapeAttr(url)}" style="width:100%; height:100%; border:none"></iframe>
            </div>`;
        }

        backdrop.innerHTML = `
            <div class="modal" style="width:95%; max-width:1200px; height:95vh; display:flex; flex-direction:column">
                <div class="flex-between mb-10">
                    <h3 class="m-0">${escapeHtml(title)}</h3>
                    <div class="flex gap-10">
                        <a href="${escapeAttr(url)}" download class="button secondary w-auto small">Download</a>
                        <button class="button secondary w-auto small" onclick="this.closest('.modal-backdrop').remove()">Close</button>
                    </div>
                </div>
                ${viewerHtml}
            </div>
        `;
        document.body.appendChild(backdrop);
    }
};

// Global init for all dashboards
async function initDashboard(role) {
    // 1. Initialize UI interactions immediately
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        // Use a persistent listener to avoid issues with cloning if called multiple times
        if (!toggle.hasAttribute('data-listener')) {
            toggle.setAttribute('data-listener', 'true');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.innerWidth <= 1024) {
                    document.body.classList.toggle('sidebar-open');
                } else {
                    document.body.classList.toggle('sidebar-collapsed');
                }
            });
        }
    }

    if (!document.documentElement.hasAttribute('data-global-click')) {
        document.documentElement.setAttribute('data-global-click', 'true');
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && document.body.classList.contains('sidebar-open')) {
                const sidebar = document.querySelector('.sidebar, aside');
                if (sidebar && !sidebar.contains(e.target)) {
                    document.body.classList.remove('sidebar-open');
                }
            }
        });
    }

    const navButtons = document.querySelectorAll('nav button');
    navButtons.forEach(btn => {
        if (!btn.hasAttribute('data-listener')) {
            btn.setAttribute('data-listener', 'true');
            btn.addEventListener('click', () => {
                if (window.innerWidth <= 1024) {
                    document.body.classList.remove('sidebar-open');
                }
            });
        }
    });

    // 2. Auth checks
    const user = await SessionManager.getCurrentUser();

    // Start idle management if user is logged in
    if (user) {
        IdleManager.init();
    }

    if (!user || user.role !== role) {
        if (!window.location.href.includes('index.html')) {
            alert(`Please login as a ${role}`);
            window.location.href = 'index.html';
        }
        return null;
    }

    // Initialize SessionGuard and perform initial validation
    if (typeof SessionGuard !== 'undefined') {
        SessionGuard.init();
        await SessionGuard.validate(true);
    }

    // Force password change if reset is approved but not yet completed
    try {
        const freshUser = await SupabaseDB.getUser(user.email);
        if (freshUser && freshUser.reset_request && freshUser.reset_request.status === 'approved') {
            alert('You must change your password before continuing.');
            window.location.href = 'index.html';
            return null;
        }
    } catch (e) {
        console.warn('Dashboard init check failed:', e);
    }

    return user;
}

// Register Service Worker (only on supported protocols like https or http://localhost)
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
    });
}

// Request notification permission
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
        }
    }
}

// PWA Install Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // Centralize the installprompt banner on the landing page only
    const isLandingPage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    if (!isLandingPage) return;

    e.preventDefault();
    deferredPrompt = e;

    // Show a custom install button or banner after 10 seconds of active interaction
    // We check if it's the first time in the current session
    if (!sessionStorage.getItem('installPromptShown')) {
        setTimeout(() => {
            if (deferredPrompt) {
                UI.showNotification('Install SmartLMS App for offline access and a better experience! Tap here to install.', 'info');
                sessionStorage.setItem('installPromptShown', 'true');
                const toasts = document.querySelectorAll('.toast');
                const lastToast = toasts[toasts.length - 1];
                if (lastToast) {
                    lastToast.style.cursor = 'pointer';
                    lastToast.onclick = async () => {
                        if (deferredPrompt) {
                            try {
                                await deferredPrompt.prompt();
                                await deferredPrompt.userChoice;
                            } catch (err) {
                                console.warn('Install prompt error:', err);
                            } finally {
                                deferredPrompt = null;
                            }
                        }
                        lastToast.remove();
                    };
                }
            }
        }, 10000);
    }
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
});

// Global notification system
const NotificationManager = {
    _polling: false,

    async fetchNotifications() {
        try {
            const user = await SessionManager.getCurrentUser();
            if (!user) return [];

            // 1. Fetch personal notifications and active broadcasts
            const [personalRes, broadcastsRes, enrollmentsRes] = await Promise.all([
                SupabaseDB.getNotifications(user.email),
                SupabaseDB.getBroadcasts(),
                user.role === 'student' ? SupabaseDB.getEnrollments(user.email) : Promise.resolve({ data: [] })
            ]);

            const personal = personalRes.data || [];
            const broadcasts = broadcastsRes.data || [];
            const enrollments = enrollmentsRes.data || [];

            const enrolledCourseIds = enrollments.map(e => e.course_id);

            // 2. Filter broadcasts based on relevance and recency (e.g. last 14 days)
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 14);

            const relevantBroadcasts = broadcasts.filter(b => {
                // Check recency
                if (new Date(b.created_at) < recentDate) return false;
                // If course-specific, must be enrolled
                if (b.course_id && !enrolledCourseIds.includes(b.course_id)) return false;
                // If role-specific, must match role
                if (b.target_role && b.target_role !== user.role) return false;
                return true;
            });

            // 3. Filter out cleared broadcasts
            const clearedBroadcasts = JSON.parse(localStorage.getItem(`cleared_broadcasts_${user.email}`) || '[]');
            const activeBroadcasts = relevantBroadcasts.filter(b => !clearedBroadcasts.includes(b.id));

            // 4. Mark broadcasts as "read" locally using localStorage
            const readBroadcasts = JSON.parse(localStorage.getItem(`read_broadcasts_${user.email}`) || '[]');
            const mappedBroadcasts = activeBroadcasts.map(b => ({
                ...b,
                is_read: readBroadcasts.includes(b.id),
                is_broadcast: true
            }));

            // 5. Combine and sort
            return [...personal, ...mappedBroadcasts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } catch (e) {
            console.warn('Failed to fetch notifications:', e);
            UI.showNotification('Could not update notifications. Retrying...', 'error');
            return [];
        }
    },

    async getPreferences() {
        const user = await SessionManager.getCurrentUser();
        if (!user) return { email: true, push: true, inApp: true };
        const fresh = await SupabaseDB.getUser(user.email);
        return fresh?.notification_preferences || { email: true, push: true, inApp: true };
    },

    async updatePreferences(prefs) {
        const user = await SessionManager.getCurrentUser();
        if (!user) return;
        const fresh = await SupabaseDB.getUser(user.email);
        await SupabaseDB.saveUser({ ...fresh, notification_preferences: prefs });
        UI.showNotification('Notification preferences updated.');
    },


    async markAllAsRead() {
        const user = await SessionManager.getCurrentUser();
        if (!user) return;

        try {
            const notifications = await this.fetchNotifications();

            // Mark personal notifications in DB
            await SupabaseDB.markNotificationsAsRead(user.email);

            // Mark broadcasts in localStorage
            const broadcastIds = notifications.filter(n => n.is_broadcast).map(n => n.id);
            const readBroadcasts = JSON.parse(localStorage.getItem(`read_broadcasts_${user.email}`) || '[]');
            const updatedRead = [...new Set([...readBroadcasts, ...broadcastIds])];
            localStorage.setItem(`read_broadcasts_${user.email}`, JSON.stringify(updatedRead));

            this.updateUI();
            UI.showNotification('All notifications marked as read', 'success');
        } catch (e) {
            console.error('Failed to mark all as read:', e);
        }
    },

    async clearAll() {
        if (!confirm('Are you sure you want to clear all notification history? Broadcasts will also be hidden.')) return;

        const user = await SessionManager.getCurrentUser();
        if (!user) return;

        try {
            const notifications = await this.fetchNotifications();

            // Clear broadcasts by saving their IDs to cleared_broadcasts
            const broadcastIds = notifications.filter(n => n.is_broadcast).map(n => n.id);
            const clearedBroadcasts = JSON.parse(localStorage.getItem(`cleared_broadcasts_${user.email}`) || '[]');
            const updatedCleared = [...new Set([...clearedBroadcasts, ...broadcastIds])];
            localStorage.setItem(`cleared_broadcasts_${user.email}`, JSON.stringify(updatedCleared));

            // Actually delete personal notifications for this user using SupabaseDB
            await SupabaseDB.deleteNotifications(user.email);
            this.updateUI();
            UI.showNotification('Notifications cleared', 'info');
        } catch (e) {
            console.error('Failed to clear notifications:', e);
            UI.showNotification('Error clearing notifications', 'error');
        }
    },

    async updateUI() {
        const notifications = await this.fetchNotifications();
        const unreadCount = notifications.filter(n => !n.is_read).length;
        
        const unreadBadge = document.getElementById('unreadCount');
        if (unreadBadge) {
            unreadBadge.textContent = unreadCount;
            unreadBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }

        const list = document.getElementById('notifList');
        if (list) {
            try {
            const itemsHtml = notifications.map(n => `
                <div class="notif-item" style="padding:12px; border-bottom:1px solid #f0f0f0; background:${n.is_read ? '#fff' : '#f0f4ff'}; cursor:pointer; transition: background 0.2s"
                        onclick="NotificationManager.handleNotificationClick('${n.id}', ${!!n.is_broadcast}, '${n.link || ''}')">
                    <div style="display:flex; justify-content:space-between; align-items:start">
                        <div style="font-weight:600; font-size:13px; color:var(--text)">${n.is_broadcast ? '📢 ' : ''}${escapeHtml(n.title)}</div>
                        ${!n.is_read ? '<div style="width:8px; height:8px; background:var(--purple); border-radius:50%; margin-top:4px"></div>' : ''}
                    </div>
                    <div style="font-size:12px; color:#555; margin-top:4px; line-height:1.4">${escapeHtml(n.message)}</div>
                    <div style="font-size:10px; color:#999; margin-top:8px; display:flex; justify-content:space-between">
                        <span>${new Date(n.created_at).toLocaleString()}</span>
                        ${n.is_broadcast ? '<span style="color:var(--purple); font-weight:bold">BROADCAST</span>' : ''}
                    </div>
                </div>
            `).join('');

            list.innerHTML = `
                <div style="padding:12px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center; background:#fafafa; position:sticky; top:0; z-index:10">
                    <div class="flex-center-y gap-10">
                        <button class="button secondary tiny" style="width:24px; height:24px; padding:0; margin:0; display:flex; align-items:center; justify-content:center; border-radius:50%" onclick="document.getElementById('notifList').classList.remove('active'); event.stopPropagation();">✕</button>
                        <strong style="font-size:14px">Notifications</strong>
                    </div>
                    <div class="flex gap-5">
                        <button class="button secondary tiny" style="width:auto; margin:0" onclick="NotificationManager.markAllAsRead(); event.stopPropagation();">Mark Read</button>
                        <button class="button danger tiny" style="width:auto; margin:0; background:#fee2e2; color:#b91c1c" onclick="NotificationManager.clearAll(); event.stopPropagation();">Clear All</button>
                    </div>
                </div>
                <div class="notif-items-container" style="max-height:350px; overflow-y:auto; scroll-behavior: smooth;">
                    ${notifications.length === 0 ? '<div style="padding:40px 20px; text-align:center; color:#999"><div style="font-size:32px; margin-bottom:10px">🔔</div>No notifications yet</div>' : itemsHtml}
                </div>
            `;

            // Ensure the view scrolls to the last message if they are plenty
            const container = list.querySelector('.notif-items-container');
            if (container && notifications.length > 0) {
                container.style.paddingBottom = '20px';
                // Use a small timeout to ensure the DOM is rendered before scrolling
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 100);
            }
            } catch (e) {
                console.warn('Error updating notif list:', e);
                list.innerHTML = '<div style="padding:10px">Could not load notifications.</div>';
            }
        }
        
        // Browser notification for new unread ones
        const lastCount = parseInt(sessionStorage.getItem('lastNotifCount') || '0');
        if (unreadCount > lastCount) {
            // Newest notifications are first in the list
            const latest = notifications.find(n => !n.is_read);
            if (latest) this.sendBrowserNotification(latest.title, latest.message);
        }
        sessionStorage.setItem('lastNotifCount', unreadCount);
    },

    async handleNotificationClick(id, isBroadcast, link) {
        if (isBroadcast) {
            this.markBroadcastRead(id);
        } else {
            try {
                const user = await SessionManager.getCurrentUser();
                if (user) {
                    await SupabaseDB.markNotificationsAsRead(user.email, id);
                    this.updateUI();
                }
            } catch (e) {
                console.warn('Failed to mark notification as read:', e);
            }
        }
        if (link) {
            // Internal deep linking support
            if (link.startsWith('student.html') || link.startsWith('teacher.html') || link.startsWith('admin.html')) {
                const url = new URL(link, window.location.origin);
                const page = url.searchParams.get('page');

                // If we are already on the same dashboard, use internal navigation
                const currentDashboard = window.location.pathname.split('/').pop();
                const targetDashboard = link.split('?')[0];

                if (currentDashboard === targetDashboard && page) {
                    const navBtn = document.querySelector(`nav button[data-page="${page}"]`);
                    if (navBtn) {
                        navBtn.click();
                        // Close notification list
                        document.getElementById('notifList')?.classList.remove('active');
                        return;
                    }
                }
            }
            window.location.href = link;
        }
    },

    markBroadcastRead(id) {
        SessionManager.getCurrentUser().then(user => {
            if (!user) return;
            const readBroadcasts = JSON.parse(localStorage.getItem(`read_broadcasts_${user.email}`) || '[]');
            if (!readBroadcasts.includes(id)) {
                readBroadcasts.push(id);
                localStorage.setItem(`read_broadcasts_${user.email}`, JSON.stringify(readBroadcasts));
                this.updateUI();
            }
        });
    },

    async renderSettings(title = 'Settings', pushDesc = 'Enable real-time desktop notifications.') {
        const content = document.getElementById('pageContent');
        if (!content) return;

        const prefs = await this.getPreferences();

        content.innerHTML = `
            <h2 class="m-0">${escapeHtml(title)}</h2>
            <div class="card mt-20">
                <h3 class="m-0">Notification Preferences</h3>
                <p class="small mt-5">Choose how you want to receive updates.</p>
                <div class="flex-column gap-10 mt-15">
                    <label class="flex-center-y gap-10"><input type="checkbox" id="prefInApp" ${prefs.inApp ? 'checked' : ''} class="w-auto m-0"> In-App Notifications</label>
                    <label class="flex-center-y gap-10"><input type="checkbox" id="prefPush" ${prefs.push ? 'checked' : ''} class="w-auto m-0"> Browser Push Notifications</label>
                    <label class="flex-center-y gap-10"><input type="checkbox" id="prefEmail" ${prefs.email ? 'checked' : ''} class="w-auto m-0"> Email Alerts</label>
                    <button class="button w-auto mt-10 px-30" onclick="NotificationManager.saveSettings()">Save Preferences</button>
                </div>
            </div>
            <div class="card mt-20">
                <h3 class="m-0">Push Subscription</h3>
                <p class="small mt-5">${escapeHtml(pushDesc)}</p>
                <button class="button secondary w-auto mt-10 px-30" onclick="NotificationManager.subscribeToPush()">Enable Push Notifications</button>
            </div>
        `;
    },

    async saveSettings() {
        const prefs = {
            inApp: document.getElementById('prefInApp').checked,
            push: document.getElementById('prefPush').checked,
            email: document.getElementById('prefEmail').checked
        };
        await this.updatePreferences(prefs);
    },

    async sendBrowserNotification(title, body) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        try {
            const options = {
                body,
                icon: 'favicon.ico',
                badge: 'favicon.ico',
                tag: 'smartlms-notif',
                renotify: true
            };

            // Try to use service worker registration if available
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                reg.showNotification(title, options);
            } else {
                new Notification(title, options);
            }
        } catch (e) {
            console.warn('Failed to send browser notification:', e);
        }
    },

    async subscribeToPush() {
        if (!('Notification' in window)) {
            UI.showNotification('Push notifications are not supported by your browser.', 'error');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            UI.showNotification('Push notifications enabled successfully!', 'success');
            // Logic for actual push token registration would go here
        } else {
            UI.showNotification('Notification permission was denied.', 'warn');
        }
    },

    initPolling() {
        if (this._polling) return;
        this._polling = true;
        this.updateUI();
        setInterval(() => this.updateUI(), 10000); // Poll every 10s
        
        // Request browser permission if not set
        if (Notification.permission === 'default') {
            requestNotificationPermission();
        }

        // Global event delegation for the notification bell
        if (!document.documentElement.hasAttribute('data-notif-listener')) {
            document.documentElement.setAttribute('data-notif-listener', 'true');
            document.addEventListener('click', (e) => {
                const bell = e.target.closest('#notifBell') || e.target.closest('#unreadCount');
                const list = document.getElementById('notifList');

                if (bell) {
                    e.stopPropagation();
                    if (list) {
                        const isActive = list.classList.contains('active');
                        // Close all other dropdowns if any, then toggle this one
                        document.querySelectorAll('.notif-list.active').forEach(el => el.classList.remove('active'));
                        if (!isActive) list.classList.add('active');
                    }
                } else if (list && list.classList.contains('active')) {
                    if (!list.contains(e.target)) {
                        list.classList.remove('active');
                    }
                }
            });
        }
    },

    initRealtimeSubscriptions(email, role, onTableChange = null) {
        if (!window.supabaseClient) return;

        const channel = window.supabaseClient.channel(`${role}-db-changes`);

        // Always subscribe to personal notifications
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_email=eq.${email}` }, () => {
            SupabaseDB.invalidateCache(`notifications_${email}`);
            this.updateUI();
        });

        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, () => {
            SupabaseDB.invalidateCache('broadcasts_active');
            this.updateUI();
        });

        // Optional callback for specific dashboard table changes
        if (onTableChange) {
            // Apply status filter for teacher/admin to avoid huge in-progress payloads
            // Student only sees their own, but teacher/admin sees everyone
            const filter = role === 'student' ? `student_email=eq.${email}` : `status=eq.submitted`;
            channel.on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quiz_submissions',
                filter: filter
            }, onTableChange);
        }

        channel.subscribe();
    }
};

let maintCountdown = null;

const SessionGuard = {
    _lastCheck: 0,
    _throttle: 5000, // 5 seconds

    async validate(force = false) {
        const now = Date.now();
        if (!force && (now - this._lastCheck < this._throttle)) return;
        this._lastCheck = now;

        try {
            const user = await SessionManager.getCurrentUser();
            if (!user) return;

            const [fresh, m] = await Promise.all([
                SupabaseDB.getUser(user.email, true),
                SupabaseDB.getMaintenance(true)
            ]);

            if (!fresh) {
                console.warn('SessionGuard: User not found.');
                return this.logout('Your account could not be verified.');
            }

            const isMaint = isActiveMaintenance(m);
            const isRestricted = !fresh.active || fresh.flagged || isAccountLocked(fresh);
            const currentSid = SessionManager.getSessionId();
            // Invalidation detection: mismatch occurs if fresh.session_id is missing (unauthorized)
            // or if it doesn't match the local session ID.
            const sessionMismatch = !fresh.session_id || fresh.session_id !== currentSid;

            if ((isMaint && user.role !== 'admin') || isRestricted || sessionMismatch) {
                let msg = isMaint ? 'System entered maintenance mode.' : 'Your account status has changed.';
                if (sessionMismatch) msg = 'You have been logged in from another device or tab.';

                await this.logout(msg);
            }
        } catch (e) {
            console.warn('SessionGuard: Validation failed', e);
        }
    },

    async logout(message) {
        await SessionManager.clearCurrentUser();
        if (!window.location.href.includes('index.html')) {
            alert(message + ' Logging out.');
            window.location.href = 'index.html';
        }
    },

    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Listen for visibility changes and focus to trigger immediate validation
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') this.validate(true);
        });
        window.addEventListener('focus', () => this.validate(true));

        // Initial check
        this.validate();
    }
};

async function updateMaintBanner() {
    // Integrate session validation into the banner update polling
    await SessionGuard.validate();

    let m;
    try {
        m = await SupabaseDB.getMaintenance(false); // Use cache here for banner as SessionGuard already bypassed it
    } catch (e) {
        console.warn('Maintenance check failed:', e);
        return;
    }

    const ids = ['maintBanner', 'maintBannerSignup', 'maintBannerLogin', 'maintBannerReset'];
    
    let targetDate = null;
    let labelPrefix = '';

    if (isActiveMaintenance(m)) {
        targetDate = getActiveMaintenanceEnd(m);
        labelPrefix = 'System maintenance ACTIVE — restores in ';
    } else {
        const up = getUpcomingMaintenance(m);
        if (up) {
            targetDate = new Date(up.startAt).getTime();
            labelPrefix = 'Upcoming system maintenance — starts in ';
        }
    }

    if (targetDate) {
        if (!maintCountdown) {
            maintCountdown = new Countdown({
                targetDate: targetDate,
                headless: true,
                onEnd: () => {
                    maintCountdown = null;
                    updateMaintBanner();
                },
                onTick: (time) => {
                    const h = Math.floor(time.total / 3600000);
                    const mm = Math.floor((time.total % 3600000) / 60000);
                    const ss = Math.floor((time.total % 60000) / 1000);
                    const timeStr = `${h}h ${mm}m ${ss}s (at ${new Date(targetDate).toLocaleString()})`;

                    ids.forEach(id => {
                        const b = document.getElementById(id);
                        if (b) {
                            b.style.display = 'block';
                            b.textContent = labelPrefix + timeStr;
                        }
                    });
                }
            });
        } else {
            maintCountdown.setTargetDate(targetDate);
        }

        // Ensure it is "mounted" (subscribed to TimerManager)
        if (!maintCountdown.mounted) {
            maintCountdown.mount();
        }
        maintCountdown.update();
    } else {
        ids.forEach(id => {
            const b = document.getElementById(id);
            if (b) b.style.display = 'none';
        });
        if (maintCountdown) {
            maintCountdown.destroy();
            maintCountdown = null;
        }
    }
}

window.normalizeEmail = function(email) {
    return (email || '').trim().toLowerCase();
};

window.isValidEmail = function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

window.isStrongPassword = function(pass) {
    if (!pass || pass.length < 10) return false;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /\d/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>[\]\\/`~;:'"-=+]/.test(pass);
    return hasUpper && hasLower && hasNumber && hasSpecial;
};

window.isAccountLocked = function(user) {
    return !!(user && user.locked_until && Date.now() < new Date(user.locked_until).getTime());
};

window.isActiveMaintenance = function(m) {
    if (!m) return false;
    const now = new Date().getTime();
    if (m.enabled) {
        if (!m.manual_until) return true;
        if (now < new Date(m.manual_until).getTime()) return true;
    }
    const schedules = Array.isArray(m.schedules) ? m.schedules : [];
    return schedules.some(s => now >= new Date(s.startAt).getTime() && now <= new Date(s.endAt).getTime());
};

window.getUpcomingMaintenance = function(m) {
    const now = new Date().getTime();
    const schedules = (Array.isArray(m.schedules) ? m.schedules : []).filter(s => new Date(s.startAt).getTime() > now).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return schedules[0] || null;
};

window.getActiveMaintenanceEnd = function(m) {
    const now = new Date().getTime();
    if (m && m.manual_until && now < new Date(m.manual_until).getTime()) return new Date(m.manual_until).getTime();
    const s = (Array.isArray(m.schedules) ? m.schedules : []).find(s => now >= new Date(s.startAt).getTime() && now <= new Date(s.endAt).getTime());
    return s ? new Date(s.endAt).getTime() : null;
};

window.NotificationManager = NotificationManager;

window.legacyHashPassword = async function(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

window.hashPassword = async function(password, salt = '') {
    const encoder = new TextEncoder();
    // Use a fixed system salt + provided salt (e.g. email)
    const systemSalt = 'smart-lms-v1-';
    const data = encoder.encode(systemSalt + salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const CertificateGenerator = {
    async generatePDF(studentName, courseTitle, issueDate, verificationId) {
        if (!window.jspdf) {
            console.error('jsPDF not loaded');
            return null;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();

        // Background
        doc.setFillColor(248, 246, 255);
        doc.rect(0, 0, width, height, 'F');

        // Border
        doc.setDrawColor(91, 46, 166);
        doc.setLineWidth(2);
        doc.rect(10, 10, width - 20, height - 20);
        doc.setLineWidth(0.5);
        doc.rect(12, 12, width - 24, height - 24);

        // Header
        doc.setTextColor(91, 46, 166);
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.text('CERTIFICATE OF COMPLETION', width / 2, 40, { align: 'center' });

        // Body
        doc.setTextColor(34, 34, 34);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text('This is to certify that', width / 2, 65, { align: 'center' });

        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text(studentName, width / 2, 85, { align: 'center' });

        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text('has successfully completed the course', width / 2, 105, { align: 'center' });

        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.text(courseTitle, width / 2, 125, { align: 'center' });

        // Footer
        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text(`Issued on: ${new Date(issueDate).toLocaleDateString()}`, width / 2, 155, { align: 'center' });
        doc.text(`Verification ID: ${verificationId}`, width / 2, 165, { align: 'center' });

        // Logo / Stamp Placeholder
        doc.setDrawColor(91, 46, 166);
        doc.setLineWidth(1);
        doc.circle(width / 2, 185, 10);
        doc.setFontSize(10);
        doc.text('SmartLMS', width / 2, 186, { align: 'center' });

        return doc;
    }
};

window.CertificateGenerator = CertificateGenerator;

UI.createFileUploader = function(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
        bucket = 'materials',
        pathPrefix = 'uploads',
        maxSize = 5 * 1024 * 1024, // 5MB
        allowedTypes = [], // e.g. ['.pdf', '.docx']
        onUploadSuccess = (url) => {}
    } = options;

    container.innerHTML = `
        <div class="uploader-wrapper" onclick="this.querySelector('input').click()">
            <input type="file" style="display:none" ${allowedTypes.length ? `accept="${allowedTypes.join(',')}"` : ''}>
            <div class="uploader-icon">📁</div>
            <div class="uploader-text">Click to upload or drag and drop</div>
            <div class="uploader-info">Max size: ${maxSize / 1024 / 1024}MB ${allowedTypes.length ? `• Types: ${allowedTypes.join(', ')}` : ''}</div>
            <div class="uploader-progress">
                <div class="bar"></div>
            </div>
        </div>
    `;

    const input = container.querySelector('input');
    const text = container.querySelector('.uploader-text');
    const info = container.querySelector('.uploader-info');
    const progress = container.querySelector('.uploader-progress');
    const bar = progress.querySelector('.bar');

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validation
        if (file.size > maxSize) {
            alert(`File is too large. Max size is ${maxSize / 1024 / 1024}MB.`);
            return;
        }

        if (allowedTypes.length) {
            const ext = '.' + file.name.split('.').pop().toLowerCase();
            if (!allowedTypes.includes(ext)) {
                alert(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
                return;
            }
        }

        // Start Upload
        text.textContent = `Uploading ${file.name}...`;
        progress.style.display = 'block';
        bar.style.width = '20%';

        try {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const path = `${pathPrefix}/${fileName}`;

            await SupabaseDB.uploadFile(bucket, path, file);
            bar.style.width = '80%';

            const url = await SupabaseDB.getPublicUrl(bucket, path);
            bar.style.width = '100%';

            text.textContent = 'Upload complete!';
            text.style.color = 'var(--ok)';
            info.textContent = file.name;

            onUploadSuccess(url, file.name);
        } catch (err) {
            console.error('Upload error:', err);
            text.textContent = 'Upload failed. Try again.';
            text.style.color = 'var(--danger)';
            bar.style.width = '0';
        }
    });

    // Drag and Drop
    const wrapper = container.querySelector('.uploader-wrapper');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        wrapper.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    wrapper.addEventListener('dragover', () => wrapper.style.borderColor = 'var(--purple)');
    wrapper.addEventListener('dragleave', () => wrapper.style.borderColor = '#d9e0ea');
    wrapper.addEventListener('drop', (e) => {
        wrapper.style.borderColor = '#d9e0ea';
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
    });
};

UI.renderDiscussion = function(containerId, discussions, currentUserEmail, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const {
        onReply = (parentId) => {},
        onEdit = (id) => {},
        onDelete = (id) => {},
        onPost = (content, parentId) => {}
    } = options;

    const renderThread = (parentId = null, depth = 0) => {
        return discussions.filter(d => d.parent_id === parentId).map(d => {
            const isMine = d.user_email === currentUserEmail;
            return `
                <div class="question mb-10" style="margin-left:${depth * 20}px" id="disc-${d.id}">
                    <div class="flex-between" style="align-items:start">
                        <div class="small"><strong>${escapeHtml(d.user_email)}</strong> - ${new Date(d.created_at).toLocaleString()}</div>
                        <div class="flex gap-5">
                            <button class="button secondary tiny" onclick="UI._dispatchDiscussionAction('${containerId}', 'reply', '${d.id}')">Reply</button>
                            ${isMine ? `
                                <button class="button secondary tiny" onclick="UI._dispatchDiscussionAction('${containerId}', 'edit', '${d.id}')">Edit</button>
                                <button class="button danger tiny" onclick="UI._dispatchDiscussionAction('${containerId}', 'delete', '${d.id}')">Delete</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="mt-5 disc-content">${escapeHtml(d.content)}</div>
                    <div id="reply-area-${d.id}"></div>
                    ${renderThread(d.id, depth + 1)}
                </div>
            `;
        }).join('');
    };

    container.innerHTML = `
        <div class="card">
            <h3 class="m-0">Course Discussion</h3>
            <div id="disc-list" class="mt-20 mb-20" style="max-height:500px; overflow-y:auto">
                ${renderThread() || '<div class="empty">No messages yet. Start the conversation!</div>'}
            </div>
            <div class="flex gap-10">
                <input type="text" id="discInputMain" placeholder="Start a new thread..." class="m-0">
                <button class="button w-auto" onclick="UI._dispatchDiscussionAction('${containerId}', 'post', null)">Post</button>
            </div>
        </div>
    `;

    // Internal action dispatcher
    UI._discussionOptions = UI._discussionOptions || {};
    UI._discussionOptions[containerId] = options;
};

UI._dispatchDiscussionAction = function(containerId, action, id) {
    const opts = UI._discussionOptions[containerId];
    if (!opts) return;

    if (action === 'reply') {
        const area = document.getElementById(`reply-area-${id}`);
        area.innerHTML = `
            <div class="flex gap-10 mt-10">
                <input type="text" id="replyInput-${id}" placeholder="Write a reply..." class="m-0 small p-10">
                <button class="button small w-auto" onclick="UI._dispatchDiscussionAction('${containerId}', 'post', '${id}')">Reply</button>
                <button class="button secondary small w-auto" onclick="this.parentElement.remove()">Cancel</button>
            </div>
        `;
    } else if (action === 'post') {
        const inputId = id ? `replyInput-${id}` : 'discInputMain';
        const content = document.getElementById(inputId).value;
        if (content) opts.onPost(content, id);
    } else if (action === 'edit') {
        opts.onEdit(id);
    } else if (action === 'delete') {
        opts.onDelete(id);
    }
};

UI.renderIntegrityReport = function(containerId, violations, userEmail) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (typeof AntiCheat === 'undefined' || !AntiCheat.calculateStats) {
        container.innerHTML = '<div class="empty">Anti-Cheat system not loaded.</div>';
        return;
    }

    const stats = AntiCheat.calculateStats(violations);
    const firstV = violations[violations.length - 1];
    const lastV = violations[0];

    container.innerHTML = `
      <div class="card mb-20">
        <h3>Session Information</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <h4>Device Context</h4>
            <div class="value" style="font-size: 1.1rem">
                ${lastV?.device || 'Unknown'} / ${lastV?.os || 'N/A'}
            </div>
          </div>
          <div class="stat-card">
            <h4>Browser</h4>
            <div class="value" style="font-size: 1.1rem">${lastV?.browser || 'Unknown'}</div>
          </div>
          <div class="stat-card">
            <h4>Session Window</h4>
            <div class="value" style="font-size: 1.1rem">
                ${firstV ? new Date(firstV.timestamp).toLocaleTimeString() : 'N/A'} -
                ${lastV ? new Date(lastV.timestamp).toLocaleTimeString() : 'N/A'}
            </div>
          </div>
          <div class="stat-card">
            <h4>Duration (est)</h4>
            <div class="value" style="font-size: 1.1rem">
                ${firstV && lastV ? Math.round((new Date(lastV.timestamp) - new Date(firstV.timestamp)) / 60000) : 0} min
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-20">
        <h3>Violation Statistics</h3>
        <div class="stats-grid">
          <div class="stat-card ${stats.riskLevel === 'High' ? 'danger' : (stats.riskLevel === 'Medium' ? 'warn' : 'success')}">
            <h4>Risk Level</h4>
            <div class="value">
                <span class="badge ${stats.riskLevel === 'High' ? 'badge-inactive' : (stats.riskLevel === 'Medium' ? 'badge-warn' : 'badge-active')}">
                    ${stats.riskLevel}
                </span>
            </div>
          </div>
          <div class="stat-card">
            <h4>Total Score</h4>
            <div class="value">${stats.totalScore}</div>
          </div>
          <div class="stat-card">
            <h4>Frequency</h4>
            <div class="value" style="font-size: 1rem">
                C:${stats.criticalCount} | H:${stats.highCount} | L:${stats.lowCount}
            </div>
          </div>
          <div class="stat-card">
            <h4>Most Frequent</h4>
            <div class="value" style="font-size: 1rem">${escapeHtml(stats.topViolation)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Detailed Violation History</h3>
        ${violations.length === 0 ? `
          <div class="empty">No violations detected for this session.</div>
        ` : `
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Score</th>
                  <th>Context</th>
                </tr>
              </thead>
              <tbody>
                ${violations.map(v => `
                  <tr>
                    <td class="small">${new Date(v.timestamp).toLocaleTimeString()}</td>
                    <td><span class="bold">${escapeHtml(v.type.replace(/_/g, ' '))}</span></td>
                    <td>
                        <span class="badge ${v.severity === 'CRITICAL' ? 'badge-inactive' : (v.severity === 'HIGH' ? 'badge-warn' : 'badge-active')}">
                            ${v.severity}
                        </span>
                    </td>
                    <td>${v.score || 0}</td>
                    <td class="tiny text-muted">
                        ${v.metadata?.url ? `URL: ${v.metadata.url.substring(0,30)}...` : ''}
                        ${v.metadata?.shortcut ? `Shortcut: ${v.metadata.shortcut}` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
};

window.UI = UI;

const IdleManager = {
    idleLimit: 15 * 60 * 1000, // 15 minutes
    warningTime: 60 * 1000, // 1 minute
    lastActivity: Date.now(),
    warningShown: false,
    _interval: null,

    init() {
        if (this._interval) return;
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(name => {
            document.addEventListener(name, () => this.resetTimer(), true);
        });
        this.lastActivity = Date.now();
        this._interval = setInterval(() => this.checkIdle(), 10000);
    },

    resetTimer() {
        this.lastActivity = Date.now();
        if (this.warningShown) {
            this.warningShown = false;
            // Remove any existing warning toast if possible, or just let it expire
        }
    },

    async checkIdle() {
        const elapsed = Date.now() - this.lastActivity;
        const user = await SessionManager.getCurrentUser();
        if (!user) {
            if (this._interval) {
                clearInterval(this._interval);
                this._interval = null;
            }
            return;
        }

        if (elapsed >= this.idleLimit) {
            await SessionManager.clearCurrentUser();
            alert('Your session has expired due to inactivity.');
            window.location.href = 'index.html';
        } else if (elapsed >= (this.idleLimit - this.warningTime) && !this.warningShown) {
            this.warningShown = true;
            UI.showNotification('Your session will expire in 1 minute due to inactivity. Move your mouse or press a key to stay logged in.', 'info');
        }
    }
};

window.IdleManager = IdleManager;

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    // Suppress notification for background sync errors to avoid UI noise
    const reason = event.reason?.message || String(event.reason);
    if (!reason.includes('background sync')) {
        UI.showNotification('A background operation failed. Please refresh if the issue persists.', 'warn');
    }

    // Log to system logs
    if (window.SupabaseDB && typeof SupabaseDB.saveSystemLog === 'function') {
        SupabaseDB.saveSystemLog({
            level: 'error',
            category: 'runtime',
            message: `Unhandled Rejection: ${reason}`,
            metadata: { stack: event.reason?.stack }
        }).catch(() => {});
    }
});
