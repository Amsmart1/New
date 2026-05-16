/**
 * Optimized Vanilla JS Countdown System
 * Supports multiple countdowns with one global scheduler
 */

(function (global) {
    'use strict';

    // ==========================================
    // UTILITIES
    // ==========================================
    const Utils = {
        sanitizeClassName(className = '') {
            return String(className)
                .replace(/[^\w-\s]/g, '')
                .trim();
        },

        escapeHtml(str) {
            if (str === null || str === undefined) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        parseDate(dateInput) {
            if (!dateInput) return null;

            if (dateInput instanceof Date) {
                return isNaN(dateInput.getTime()) ? null : dateInput.getTime();
            }

            if (typeof dateInput === 'number') {
                return dateInput > 0 ? dateInput : null;
            }

            if (typeof dateInput === 'string') {
                // Require ISO format for consistency
                const isoRegex =
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

                if (!isoRegex.test(dateInput)) {
                    console.warn(
                        `Countdown: Use ISO date format (YYYY-MM-DDTHH:mm:ssZ): ${dateInput}`
                    );
                }

                const timestamp = new Date(dateInput).getTime();
                return isNaN(timestamp) ? null : timestamp;
            }

            return null;
        }
    };

    // ==========================================
    // ICONS
    // ==========================================
    const Icons = {
        Clock(size = 18) {
            return `
                <svg xmlns="http://www.w3.org/2000/svg"
                     width="${size}"
                     height="${size}"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2"
                     stroke-linecap="round"
                     stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            `;
        }
    };

    // ==========================================
    // GLOBAL TIMER MANAGER
    // ==========================================
    const TimerManager = {
        currentTime: Date.now(),
        listeners: new Set(),
        timeoutId: null,

        init() {
            this.currentTime = Date.now();
            if (this.timeoutId) return;
            this.tick();
        },

        tick() {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }

            if (this.listeners.size === 0) return;

            this.currentTime = Date.now();
            this.notifyListeners();
            this.scheduleNextTick();
        },

        scheduleNextTick() {
            if (this.listeners.size === 0) return;

            const shortestRemaining = this.getShortestRemainingTime();
            let nextInterval = 1000;

            if (shortestRemaining > 86400000) {
                nextInterval = 60000; // daily-ish updates
            } else if (shortestRemaining > 3600000) {
                nextInterval = 10000; // every 10 sec
            }

            this.timeoutId = setTimeout(() => {
                this.tick();
            }, nextInterval);
        },

        getShortestRemainingTime() {
            let shortest = Infinity;

            this.listeners.forEach(cb => {
                if (cb.remainingTime && cb.remainingTime < shortest) {
                    shortest = cb.remainingTime;
                }
            });

            return shortest;
        },

        subscribe(callback) {
            this.listeners.add(callback);
            this.init();

            return () => {
                this.listeners.delete(callback);

                if (this.listeners.size === 0) {
                    this.destroy();
                }
            };
        },

        notifyListeners() {
            this.listeners.forEach(cb => {
                try {
                    cb(this.currentTime);
                } catch (error) {
                    console.error(
                        'Countdown listener error:',
                        error
                    );
                }
            });
        },

        destroy() {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
        }
    };

    // Pause updates when tab hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            TimerManager.destroy();
        } else if (TimerManager.listeners.size > 0) {
            TimerManager.tick();
        }
    });

    // ==========================================
    // COUNTDOWN CLASS
    // ==========================================
    class Countdown {
        constructor(options = {}) {
            this.targetDate = options.targetDate;
            this.onEnd = options.onEnd || null;
            this.onTick = options.onTick || null;
            this.headless = options.headless === true;
            this.className = Utils.sanitizeClassName(
                options.className
            );
            this.showIcon = options.showIcon !== false;
            this.compact = options.compact === true;
            this.endLabel =
                options.endLabel !== undefined
                    ? options.endLabel
                    : 'Ended';

            this.container = null;
            this.targetTimestamp = null;
            this.unsubscribe = null;
            this.hasEndedCalled = false;
            this.mounted = false;

            this.elements = {};

            if (options.selector) {
                this.mount(options.selector);
            }
        }

        mount(selector) {
            if (this.mounted) {
                this.destroy();
            }

            if (this.headless) {
                this.container = null;
            } else {
                this.container =
                    typeof selector === 'string'
                        ? document.querySelector(selector)
                        : selector;

                if (!this.container) {
                    console.error(
                        `Countdown element not found: ${selector}`
                    );
                    return this;
                }
            }

            this.targetTimestamp = Utils.parseDate(
                this.targetDate
            );

            if (!this.targetTimestamp) {
                if (!this.headless) this.container.innerHTML = '';
                return this;
            }

            this.renderInitialDOM();

            const updateHandler = () => this.update();
            updateHandler.remainingTime = Infinity;

            this.unsubscribe =
                TimerManager.subscribe(updateHandler);

            this.updateHandler = updateHandler;
            this.mounted = true;

            this.update();

            return this;
        }

        calculateTimeLeft() {
            const diff =
                this.targetTimestamp - TimerManager.currentTime;

            if (diff <= 0) {
                return {
                    total: 0,
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0
                };
            }

            return {
                total: diff,
                days: Math.floor(
                    diff / (1000 * 60 * 60 * 24)
                ),
                hours: Math.floor(
                    (diff / (1000 * 60 * 60)) % 24
                ),
                minutes: Math.floor(
                    (diff / (1000 * 60)) % 60
                ),
                seconds: Math.floor(
                    (diff / 1000) % 60
                )
            };
        }

        renderInitialDOM() {
            if (this.headless) return;
            const iconSize = this.compact ? 14 : 18;

            // Check if we already have a countdown display
            let display = this.container.querySelector(':scope > .countdown-display');
            if (!display) {
                display = document.createElement('div');
                this.container.appendChild(display);
            }

            display.className = `countdown-display ${this.className}`;

            display.innerHTML = `
                ${
                    this.showIcon
                        ? Icons.Clock(iconSize)
                        : ''
                }
                <div class="countdown-values">
                    <span data-unit="days"></span>
                    <span data-unit="hours"></span>
                    <span data-unit="minutes"></span>
                    <span data-unit="seconds"></span>
                </div>
            `;

            this.elements.days =
                display.querySelector(
                    '[data-unit="days"]'
                );
            this.elements.hours =
                display.querySelector(
                    '[data-unit="hours"]'
                );
            this.elements.minutes =
                display.querySelector(
                    '[data-unit="minutes"]'
                );
            this.elements.seconds =
                display.querySelector(
                    '[data-unit="seconds"]'
                );
        }

        update() {
            if (!this.mounted) return;

            if (!this.headless && this.container && !document.body.contains(this.container)) {
                this.destroy();
                return;
            }

            const time = this.calculateTimeLeft();

            if (this.updateHandler) {
                this.updateHandler.remainingTime =
                    time.total;
            }

            if (typeof this.onTick === 'function') {
                try {
                    this.onTick(time);
                } catch (error) {
                    console.error('Countdown onTick error:', error);
                }
            }

            if (time.total <= 0) {
                this.handleEnd();
                return;
            }

            if (!this.headless) {
                this.elements.days.textContent =
                    time.days > 0
                        ? `${time.days}d `
                        : '';

                this.elements.hours.textContent =
                    time.days > 0 || time.hours > 0
                        ? `${String(time.hours).padStart(
                              2,
                              '0'
                          )}h `
                        : '';

                this.elements.minutes.textContent =
                    `${String(time.minutes).padStart(
                        2,
                        '0'
                    )}m `;

                this.elements.seconds.textContent =
                    `${String(time.seconds).padStart(
                        2,
                        '0'
                    )}s`;
            }
        }

        handleEnd() {
            if (this.hasEndedCalled) return;

            this.hasEndedCalled = true;

            if (!this.headless) {
                if (this.endLabel === null) {
                    const display = this.container.querySelector(':scope > .countdown-display');
                    if (display) display.remove();
                } else {
                    let display = this.container.querySelector(':scope > .countdown-display');
                    if (!display) {
                        display = document.createElement('div');
                        display.className = 'countdown-display';
                        this.container.appendChild(display);
                    }
                    display.innerHTML = `
                        <span class="countdown-ended">
                            ${
                                this.showIcon
                                    ? Icons.Clock(12)
                                    : ''
                            }
                            ${Utils.escapeHtml(
                                this.endLabel
                            )}
                        </span>
                    `;
                }
            }

            if (typeof this.onEnd === 'function') {
                try {
                    this.onEnd();
                } catch (error) {
                    console.error(
                        'Countdown onEnd error:',
                        error
                    );
                }
            }

            this.destroy();
        }

        setTargetDate(newDate) {
            const parsed =
                Utils.parseDate(newDate);

            if (!parsed) return;

            this.targetDate = newDate;
            this.targetTimestamp = parsed;
            this.hasEndedCalled = false;

            if (this.mounted) {
                this.update();
            }
        }

        setOptions(options = {}) {
            let needsRerender = false;

            if (
                options.className !== undefined &&
                options.className !== this.className
            ) {
                this.className =
                    Utils.sanitizeClassName(
                        options.className
                    );
                needsRerender = true;
            }

            if (
                options.endLabel !== undefined
            ) {
                this.endLabel =
                    options.endLabel;
            }

            if (
                options.showIcon !== undefined &&
                options.showIcon !== this.showIcon
            ) {
                this.showIcon =
                    options.showIcon;
                needsRerender = true;
            }

            if (
                options.compact !== undefined &&
                options.compact !== this.compact
            ) {
                this.compact =
                    options.compact;
                needsRerender = true;
            }

            if (this.mounted) {
                if (needsRerender) {
                    this.renderInitialDOM();
                }
                this.update();
            }
        }

        destroy() {
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }

            this.mounted = false;
            this.container = null;
            this.elements = {};
            this.updateHandler = null;
            this.targetTimestamp = null;
        }
    }

    // ==========================================
    // STATIC HELPERS
    // ==========================================
    Countdown.create = function (
        selector,
        options = {}
    ) {
        return new Countdown({
            ...options,
            selector
        });
    };

    Countdown.createAll = function (
        selector,
        options = {}
    ) {
        const elements =
            document.querySelectorAll(selector);

        return Array.from(elements).map(
            element => {
                const targetDate =
                    element.dataset.date ||
                    options.targetDate;

                return new Countdown({
                    ...options,
                    targetDate,
                    selector: element
                });
            }
        );
    };

    // ==========================================
    // EXPORTS
    // ==========================================
    global.Countdown = Countdown;
    global.TimerManager = TimerManager;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = {
            Countdown,
            TimerManager
        };
    }
})(typeof window !== 'undefined'
    ? window
    : this);