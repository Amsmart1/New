import asyncio
from playwright.async_api import async_playwright
import os
import json

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        async def mock_setup(page):
            # Stub ALL external scripts to prevent loading errors and speed up
            await page.route("**/supabase-js**", lambda route: route.fulfill(body=""))
            await page.route("**/jspdf**", lambda route: route.fulfill(body=""))
            await page.route("**/chart.js**", lambda route: route.fulfill(body=""))
            await page.route("**/external_api.js**", lambda route: route.fulfill(body=""))

            await page.add_init_script("""
                window.supabase = { createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => ({}) }) }) }) }) };

                window.SessionManager = {
                    getCurrentUser: async () => ({
                        email: 'student@example.com',
                        full_name: 'Test Student',
                        role: 'student'
                    }),
                    getSessionId: () => 'test-session'
                };

                const mockQuiz = {
                    id: 'quiz-1',
                    course_id: 'course-1',
                    title: 'Test Quiz',
                    description: 'A test quiz',
                    attempts_allowed: 3,
                    time_limit: 0,
                    questions: [
                        { type: 'short', text: 'What is 1+1?', points: 1, correct: '2' }
                    ],
                    status: 'published'
                };

                let quizSubmissions = [];

                window.SupabaseDB = {
                    getQuizzes: async () => [mockQuiz],
                    getQuiz: async () => mockQuiz,
                    getQuizSubmissions: async () => quizSubmissions,
                    getEnrolledCourses: async () => [{ id: 'course-1', title: 'Course 1' }],
                    getEnrollments: async () => [{ course_id: 'course-1', student_email: 'student@example.com' }],
                    getUser: async () => ({ email: 'student@example.com', full_name: 'Test Student', active: true }),
                    saveQuizSubmission: async (sub) => {
                        if (sub.status === 'submitted') {
                            const newSub = { ...sub, id: sub.id || 'sub-' + Date.now() };
                            quizSubmissions.push(newSub);
                            return newSub;
                        } else if (sub.status === 'draft') {
                            const existing = quizSubmissions.find(s => s.status === 'draft');
                            if (!existing) {
                                const newSub = { ...sub, id: 'draft-' + Date.now() };
                                quizSubmissions.push(newSub);
                                return newSub;
                            }
                            return existing;
                        }
                        return sub;
                    },
                    updateCourseProgress: async () => {},
                    getMaintenance: async () => ({ enabled: false }),
                    getNotifications: async () => [],
                    getBroadcasts: async () => [],
                    getCount: async () => 0,
                    invalidateCache: () => {}
                };

                // Mock Countdown
                window.Countdown = {
                    create: (el, opts) => {
                        return {
                            destroy: () => {},
                            mount: () => {},
                            update: () => {}
                        };
                    }
                };

                // Notification Manager Mock
                window.NotificationManager = {
                    initPolling: () => {},
                    initRealtimeSubscriptions: () => {},
                    updateUI: () => {}
                };

                // Override initDashboard to skip real checks
                window.initDashboard = async () => ({ email: 'student@example.com', role: 'student' });
                window.updateMaintBanner = () => {};

                // Set global escape functions if not defined
                window.escapeHtml = (s) => String(s);
                window.escapeAttr = (s) => String(s);
            """)

        print("Navigating to student.html...")
        await mock_setup(page)
        abs_path = os.path.abspath("student.html")
        await page.goto(f"file://{abs_path}")

        # Wait for student.js functions to be attached to window
        print("Waiting for renderDashboardOverview...")
        await page.wait_for_function("typeof window.renderDashboardOverview === 'function'")

        print("Navigating to Quizzes...")
        await page.evaluate("window.renderQuizzes()")

        print("Waiting for quiz card...")
        await page.wait_for_selector("#attempts-count-quiz-1")

        attempts_text = await page.inner_text("#attempts-count-quiz-1")
        print(f"Initial attempts: {attempts_text}")

        print("Starting Quiz...")
        # Capture button state immediately after click
        await page.click("#quiz-btn-quiz-1")

        is_disabled = await page.is_disabled("#quiz-btn-quiz-1")
        btn_text = await page.inner_text("#quiz-btn-quiz-1")
        print(f"Is button disabled immediately? {is_disabled}, Text: {btn_text}")

        if not is_disabled or btn_text != "Starting...":
            print("FAIL: Button should be disabled and show 'Starting...'")

        # Wait for quiz questions
        await page.wait_for_selector("input[placeholder='Your answer...']")
        await page.fill("input[placeholder='Your answer...']", "2")

        # Mock alert
        await page.evaluate("window.alert = () => {}")

        print("Submitting Quiz...")
        await page.click("#submitQuizBtn")

        # Check for Refreshing... state in the list button
        is_refreshing = await page.evaluate("""() => {
            const b = document.getElementById('quiz-btn-quiz-1');
            return b && b.disabled && b.textContent === 'Refreshing...';
        }""")
        print(f"Is list button refreshing? {is_refreshing}")

        print("Waiting for attempt count update...")
        await page.wait_for_function("""() => {
            const el = document.getElementById('attempts-count-quiz-1');
            return el && el.innerText === '1 / 3';
        }""")

        final_attempts = await page.inner_text("#attempts-count-quiz-1")
        print(f"Final attempts: {final_attempts}")

        if final_attempts == "1 / 3":
            print("SUCCESS: Quiz refresh logic verified!")
        else:
            print("FAIL: Attempts count did not update correctly")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
