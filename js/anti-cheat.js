(function() {
    'use strict';

    /**
     * Anti-Cheat System for SmartLMS
     * Blocks copy/paste, DevTools, tab switching, and more based on configuration.
     */
    class AntiCheatSystem {
        constructor() {
            this.config = {
                DEBUG: false,
                FULLSCREEN_REQUIRED: false,
                MULTI_TAB_LOCK: false,
                BLOCK_COPY: false,
                BLOCK_PASTE: false,
                BLOCK_CUT: false,
                BLOCK_CONTEXT_MENU: false,
                BLOCK_KEYBOARD_SHORTCUTS: false,
                BLOCK_LONG_PRESS: false,
                BLOCK_TEXT_SELECTION: false,
                BLOCK_DRAG: false,
                BLOCK_DEVTOOLS: false,
                BLOCK_TAB_SWITCH: false,

                LONG_PRESS_THRESHOLD: 500,
                DEVTOOLS_THRESHOLD: 160,
                BLUR_THRESHOLD: 2000,
                MIN_VIOLATION_INTERVAL: 2000,

                callbacks: {
                    onViolation: null,
                    onBlocked: null
                }
            };

            this.state = {
                isActive: false,
                assessmentId: null,
                assessmentType: null, // 'quiz' or 'assignment'
                userEmail: null,
                startTime: null,
                lastViolationTime: {}
            };

            this.longPressTimers = new Map();
            this.focusLossTimer = null;
            this.resizeTimeout = null;
            this.tabChannel = null;
            this.mutationObserver = null;
            this.eventListeners = [];
        }

        configure(options = {}) {
            for (const key in options) {
                if (key === 'callbacks') {
                    Object.assign(this.config.callbacks, options.callbacks);
                } else if (this.config.hasOwnProperty(key)) {
                    this.config[key] = options[key];
                }
            }
        }

        async init(assessmentId, assessmentType, userEmail, config = {}) {
            if (this.state.isActive) this.destroy();

            this.state.assessmentId = assessmentId;
            this.state.assessmentType = assessmentType;
            this.state.userEmail = userEmail;
            this.state.startTime = Date.now();
            this.state.isActive = true;

            this.configure(config);

            if (this.config.FULLSCREEN_REQUIRED) {
                this.initFullscreenHandlers();
                this.enforceFullscreen();
            }

            if (this.config.MULTI_TAB_LOCK) this.initMultiTabLock();
            this.initEventBlocking();
            this.initLongPressDetection();
            this.initInputControl();
            this.initVisibilityDetection();
            this.initDevToolsDetection();

            if (this.config.DEBUG) console.log('Anti-Cheat: Initialized', { assessmentId, assessmentType, config: this.config });
        }

        logViolation(type, details = {}) {
            if (!this.state.isActive) return;

            const now = Date.now();
            const lastTime = this.state.lastViolationTime[type] || 0;
            if (now - lastTime < this.config.MIN_VIOLATION_INTERVAL) return;

            this.state.lastViolationTime[type] = now;

            const violation = {
                user_email: this.state.userEmail,
                assessment_id: this.state.assessmentId,
                assessment_type: this.state.assessmentType,
                type,
                details: {
                    ...details,
                    elapsed: now - this.state.startTime,
                    url: window.location.href
                },
                timestamp: new Date(now).toISOString()
            };

            // Sync to DB if SupabaseDB is available
            if (window.SupabaseDB && typeof window.SupabaseDB.saveViolation === 'function') {
                window.SupabaseDB.saveViolation(violation).catch(err => console.error('Anti-Cheat: Sync failed', err));
            }

            // Callbacks
            if (this.config.callbacks.onViolation) {
                this.config.callbacks.onViolation(violation);
            }

            if (this.config.DEBUG) {
                console.log('Anti-Cheat Violation:', type, details);
            }

            return violation;
        }

        addGlobalListener(target, type, handler, options) {
            target.addEventListener(type, handler, options);
            this.eventListeners.push({ target, type, handler, options });
        }

        // Fullscreen
        initFullscreenHandlers() {
            const handler = () => {
                if (this.config.FULLSCREEN_REQUIRED && !document.fullscreenElement && this.state.isActive) {
                    this.logViolation('EXIT_FULLSCREEN', { reason: 'exited fullscreen' });
                    this.enforceFullscreen();
                }
            };
            this.addGlobalListener(document, 'fullscreenchange', handler);
            this.addGlobalListener(document, 'webkitfullscreenchange', handler);
        }

        enforceFullscreen() {
            try {
                const docEl = document.documentElement;
                if (docEl.requestFullscreen) docEl.requestFullscreen();
                else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
            } catch (err) {
                // If it fails, it might need user interaction
                if (this.config.DEBUG) console.warn('Anti-Cheat: Fullscreen enforcement failed', err);
            }
        }

        // Multi-tab
        initMultiTabLock() {
            if (!window.BroadcastChannel) return;
            this.tabChannel = new BroadcastChannel('anticheat_tab_' + this.state.assessmentId);
            const tabId = Math.random().toString(36).substring(2);

            this.tabChannel.onmessage = (e) => {
                if (e.data === 'PING') {
                    this.tabChannel.postMessage('PONG_' + tabId);
                } else if (e.data.startsWith('PONG_') && e.data !== 'PONG_' + tabId) {
                    this.logViolation('MULTIPLE_TABS', { reason: 'another tab detected' });
                }
            };

            this._tabInterval = setInterval(() => this.tabChannel.postMessage('PING'), 5000);
        }

        // Event Blocking
        initEventBlocking() {
            const block = (e, type, details = {}) => {
                e.preventDefault();
                this.logViolation(type, details);
                if (this.config.callbacks.onBlocked) this.config.callbacks.onBlocked(type);
                return false;
            };

            if (this.config.BLOCK_CONTEXT_MENU) {
                this.addGlobalListener(document, 'contextmenu', (e) => block(e, 'RIGHT_CLICK', { target: e.target.tagName }), { passive: false });
            }

            if (this.config.BLOCK_COPY) {
                this.addGlobalListener(document, 'copy', (e) => block(e, 'COPY_ATTEMPT', { target: e.target?.tagName }), { passive: false });
            }

            if (this.config.BLOCK_PASTE) {
                this.addGlobalListener(document, 'paste', (e) => block(e, 'PASTE_ATTEMPT', { target: e.target?.tagName }), { passive: false });
            }

            if (this.config.BLOCK_CUT) {
                this.addGlobalListener(document, 'cut', (e) => block(e, 'CUT_ATTEMPT', { target: e.target?.tagName }), { passive: false });
            }

            if (this.config.BLOCK_DRAG) {
                this.addGlobalListener(document, 'dragstart', (e) => block(e, 'DRAG_ATTEMPT', { target: e.target?.tagName }), { passive: false });
                this.addGlobalListener(document, 'drop', (e) => block(e, 'DROP_ATTEMPT', {}), { passive: false });
            }

            if (this.config.BLOCK_KEYBOARD_SHORTCUTS) {
                this.addGlobalListener(document, 'keydown', (e) => this.handleKeydown(e), { passive: false });
            }
        }

        handleKeydown(e) {
            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;
            const alt = e.altKey;
            const key = e.key;

            let violated = false;
            let type = '';
            let shortcut = '';

            if (key === 'F12') {
                violated = true; type = 'DEVTOOLS_ATTEMPT'; shortcut = 'F12';
            } else if (ctrl && shift && ['I', 'J', 'C'].includes(key.toUpperCase())) {
                violated = true; type = 'DEVTOOLS_ATTEMPT'; shortcut = `Ctrl+Shift+${key}`;
            } else if (ctrl && alt && ['U', 'A'].includes(key.toUpperCase())) {
                violated = true; type = 'DEVTOOLS_ATTEMPT'; shortcut = `Ctrl+Alt+${key}`;
            } else if (ctrl && key.toUpperCase() === 'U') {
                violated = true; type = 'VIEW_SOURCE_ATTEMPT'; shortcut = 'Ctrl+U';
            } else if (key === 'PrintScreen') {
                violated = true; type = 'SCREENSHOT_ATTEMPT'; shortcut = 'PrintScreen';
            }

            if (violated) {
                e.preventDefault();
                this.logViolation(type, { shortcut });
                if (this.config.callbacks.onBlocked) this.config.callbacks.onBlocked(type);
                return false;
            }
        }

        // Long Press Detection
        initLongPressDetection() {
            if (!this.config.BLOCK_LONG_PRESS) return;
            const selectors = 'input:not([type="hidden"]), textarea, [contenteditable]';

            const setup = (el) => {
                let timer = null;
                const start = (e) => {
                    if (!this.state.isActive) return;
                    timer = setTimeout(() => {
                        this.logViolation('LONG_PRESS', { target: e.target.tagName });
                        if (this.config.callbacks.onBlocked) this.config.callbacks.onBlocked('LONG_PRESS');
                        window.getSelection()?.removeAllRanges();
                    }, this.config.LONG_PRESS_THRESHOLD);
                };
                const end = () => { if (timer) clearTimeout(timer); };

                el.addEventListener('mousedown', start);
                el.addEventListener('mouseup', end);
                el.addEventListener('mouseleave', end);
                el.addEventListener('touchstart', start);
                el.addEventListener('touchend', end);
                el.addEventListener('touchmove', end);
            };

            document.querySelectorAll(selectors).forEach(setup);
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(m => m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.matches(selectors)) setup(node);
                        node.querySelectorAll(selectors).forEach(setup);
                    }
                }));
            });
            this.mutationObserver.observe(document.body, { childList: true, subtree: true });
        }

        // Input Control
        initInputControl() {
            if (!this.config.BLOCK_TEXT_SELECTION) return;
            const selectors = 'input:not([type="hidden"]), textarea, [contenteditable]';
            const setup = (el) => {
                el.addEventListener('selectstart', (e) => {
                    e.preventDefault();
                    this.logViolation('TEXT_SELECTION', { target: e.target.tagName });
                });
                el.style.userSelect = 'none';
                el.style.webkitUserSelect = 'none';
            };
            document.querySelectorAll(selectors).forEach(setup);
        }

        // Visibility
        initVisibilityDetection() {
            if (!this.config.BLOCK_TAB_SWITCH) return;
            this.addGlobalListener(document, 'visibilitychange', () => {
                if (document.hidden && this.state.isActive) {
                    this.focusLossTimer = setTimeout(() => {
                        this.logViolation('TAB_SWITCH', {});
                    }, this.config.BLUR_THRESHOLD);
                } else if (!document.hidden && this.focusLossTimer) {
                    clearTimeout(this.focusLossTimer);
                    this.focusLossTimer = null;
                }
            });
        }

        // DevTools Detection
        initDevToolsDetection() {
            if (!this.config.BLOCK_DEVTOOLS) return;
            const check = () => {
                const threshold = this.config.DEVTOOLS_THRESHOLD;
                if (Math.abs(window.outerWidth - window.innerWidth) > threshold || Math.abs(window.outerHeight - window.innerHeight) > threshold) {
                    this.logViolation('DEVTOOLS_OPEN', {});
                }
            };
            this.addGlobalListener(window, 'resize', () => {
                if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(check, 500);
            });
            setTimeout(check, 1000);
        }

        destroy() {
            if (!this.state.isActive) return;

            this.state.isActive = false;
            if (this._tabInterval) {
                clearInterval(this._tabInterval);
                this._tabInterval = null;
            }
            if (this.tabChannel) {
                this.tabChannel.close();
                this.tabChannel = null;
            }
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }
            if (this.focusLossTimer) {
                clearTimeout(this.focusLossTimer);
                this.focusLossTimer = null;
            }
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = null;
            }

            this.eventListeners.forEach(l => {
                l.target.removeEventListener(l.type, l.handler, l.options);
            });
            this.eventListeners = [];

            if (this.config.DEBUG) console.log('Anti-Cheat: Destroyed');

            // Try to exit fullscreen if we forced it
            if (this.config.FULLSCREEN_REQUIRED && document.fullscreenElement) {
                try {
                    if (document.exitFullscreen) document.exitFullscreen();
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                } catch (e) {}
            }
        }
    }

    window.AntiCheat = new AntiCheatSystem();
})();
