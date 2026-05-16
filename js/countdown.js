 //
 * Countdown Component - Vanilla JavaScript
 * Supports multiple countdown instances with shared timer
 */

(function(global) {
    'use strict';

    // ============================================
    // GLOBAL TIMER MANAGER (Replaces React Context)
    // ============================================
    const TimerManager = {
        currentTime: Date.now(),
        intervalId: null,
        listeners: new Set(),
        tickInterval: 1000, // Update every second

        init() {
            if (this.intervalId) return;
            this.currentTime = Date.now();
            this.intervalId = setInterval(() => {
                this.currentTime = Date.now();
                this.notifyListeners();
            }, this.tickInterval);
        },

        destroy() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            this.listeners.clear();
        },

        getTime() {
            return this.currentTime;
        },

        subscribe(callback) {
            this.init();
            this.listeners.add(callback);
            return () => this.listeners.delete(callback);
        },

        notifyListeners() {
            this.listeners.forEach(cb => cb(this.currentTime));
        }
    };

    // ============================================
    // SVG ICON HELPERS (Replaces Lucide React)
    // ============================================
    const Icons = {
        Clock: (size = 18) => `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        `
    };

    // ============================================
    // COUNTDOWN CLASS
    // ============================================
    class Countdown {
        constructor(options = {}) {
            // Props with defaults
            this.targetDate = options.targetDate || new Date();
            this.onEnd = options.onEnd || null;
            this.className = options.className || '';
            this.showIcon = options.showIcon !== false;
            this.compact = options.compact === true;
            this.endLabel = options.endLabel !== undefined ? options.endLabel : 'Ended';

            // Internal state
            this.container = null;
            this.timeLeft = null;
            this.hasEndedCalled = false;
            this.targetTimestamp = null;
            this.unsubscribe = null;
            this.mounted = false;

            // Create container if target element provided
            if (options.selector) {
                this.mount(options.selector);
            }
        }

        // Parse target date to timestamp
        parseTargetDate() {
            const date = new Date(this.targetDate);
            const ts = date.getTime();
            if (isNaN(ts)) {
                console.warn(`Countdown: Invalid targetDate provided: ${this.targetDate}`);
                return null;
            }
            return ts;
        }

        // Calculate time remaining
        calculateTimeLeft() {
            if (!this.targetTimestamp) return null;

            const difference = this.targetTimestamp - TimerManager.getTime();

            if (difference <= 0) {
                return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isSoon: false };
            }

            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
                total: difference,
                isSoon: difference > 0 && difference < 60 * 60 * 1000 // Less than 1 hour
            };
        }

        // Initialize the countdown
        mount(selector) {
            this.container = typeof selector === 'string'
                ? document.querySelector(selector)
                : selector;

            if (!this.container) {
                console.error(`Countdown: Element not found for selector: ${selector}`);
                return this;
            }

            // Parse target date
            this.targetTimestamp = this.parseTargetDate();
            if (!this.targetTimestamp) {
                this.container.innerHTML = '';
                return this;
            }

            // Reset ended state for new target
            this.hasEndedCalled = false;

            // Subscribe to timer updates
            this.unsubscribe = TimerManager.subscribe(() => this.update());

            // Initial render
            this.mounted = true;
            this.update();

            return this;
        }

        // Update the display
        update() {
            if (!this.container || !this.mounted) return;

            this.timeLeft = this.calculateTimeLeft();

            // Handle ended state
            if (this.timeLeft && this.timeLeft.total <= 0) {
                if (this.endLabel === null) {
                    this.container.innerHTML = '';
                    return;
                }

                this.container.innerHTML = `
                    <span class="countdown-ended ${this.className}">
                        ${this.showIcon ? Icons.Clock(12) : ''}
                        <span class="countdown-label">${this.escapeHtml(this.endLabel)}</span>
                    </span>
                `;

                // Trigger onEnd callback once
                if (!this.hasEndedCalled) {
                    this.hasEndedCalled = true;
                    if (typeof this.onEnd === 'function') {
                        this.onEnd();
                    }
                }
                return;
            }

            if (!this.timeLeft) return;

            // Render countdown
            this.render();
        }

        // Render the countdown UI
        render() {
            const { days, hours, minutes, seconds, isSoon } = this.timeLeft;
            const iconSize = this.compact ? 14 : 18;

            const timeClasses = [
                'countdown-display',
                'inline-flex',
                'items-center',
                'gap-2',
                isSoon ? 'countdown-soon' : 'countdown-normal',
                this.className
            ].filter(Boolean).join(' ');

            let html = `
                <div class="${timeClasses}">
                    ${this.showIcon ? Icons.Clock(iconSize) : ''}
                    <div class="countdown-values flex gap-1 font-mono font-bold text-sm md:text-base">
            `;

            // Days (only show if > 0)
            if (days > 0) {
                html += `
                    <div class="countdown-unit flex flex-col items-center">
                        <span>${days}d</span>
                        ${!this.compact ? '<span class="text-[8px] uppercase tracking-tighter -mt-1 opacity-60">Days</span>' : ''}
                    </div>
                `;
            }

            // Hours (show if > 0 or days > 0)
            if (days > 0 || hours > 0) {
                html += `
                    <div class="countdown-unit flex flex-col items-center">
                        <span>${hours.toString().padStart(2, '0')}h</span>
                        ${!this.compact ? '<span class="text-[8px] uppercase tracking-tighter -mt-1 opacity-60">Hrs</span>' : ''}
                    </div>
                `;
            }

            // Minutes (always show)
            html += `
                <div class="countdown-unit flex flex-col items-center">
                    <span>${minutes.toString().padStart(2, '0')}m</span>
                    ${!this.compact ? '<span class="text-[8px] uppercase tracking-tighter -mt-1 opacity-60">Min</span>' : ''}
                </div>
            `;

            // Seconds (always show)
            html += `
                <div class="countdown-unit flex flex-col items-center">
                    <span>${seconds.toString().padStart(2, '0')}s</span>
                    ${!this.compact ? '<span class="text-[8px] uppercase tracking-tighter -mt-1 opacity-60">Sec</span>' : ''}
                </div>
            `;

            html += `
                    </div>
                </div>
            `;

            this.container.innerHTML = html;
        }

        // Update target date dynamically
        setTargetDate(newDate) {
            this.targetDate = newDate;
            this.targetTimestamp = this.parseTargetDate();
            this.hasEndedCalled = false;
            if (this.mounted) {
                this.update();
            }
        }

        // Update options dynamically
        setOptions(options) {
            Object.keys(options).forEach(key => {
                if (key in this && key !== 'container' && key !== 'unsubscribe') {
                    this[key] = options[key];
                }
            });
            if (this.mounted) {
                this.update();
            }
        }

        // Cleanup
        destroy() {
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }
            if (this.container) {
                this.container.innerHTML = '';
            }
            this.mounted = false;
        }

        // HTML escape utility
        escapeHtml(str) {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    }

    // ============================================
    // STATIC HELPER: Create countdown instances
    // ============================================
    Countdown.create = function(selector, options) {
        return new Countdown({ ...options, selector });
    };

    Countdown.createAll = function(selector, options) {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => new Countdown({ ...options, selector: el }));
    };

    // ============================================
    // EXPORT TO GLOBAL
    // ============================================
    global.TimerManager = TimerManager;
    global.Countdown = Countdown;

    // AMD / CommonJS support
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { Countdown, TimerManager };
    }

})(typeof window !== 'undefined' ? window : this);
