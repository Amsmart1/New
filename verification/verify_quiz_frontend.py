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
            # Stub ALL external scripts
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
                    description: 'A test quiz with limited attempts',
                    attempts_allowed: 1,
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

                window.initDashboard = async () => ({ email: 'student@example.com', role: 'student' });
                window.updateMaintBanner = () => {};
                window.escapeHtml = (s) => String(s);
                window.escapeAttr = (s) => String(s);
            """)

        print("Navigating to student.html...")
        await mock_setup(page)
        abs_path = os.path.abspath("student.html")
        await page.goto(f"file://{abs_path}")

        await page.wait_for_function("typeof window.renderQuizzes === 'function'")
        await page.evaluate("window.renderQuizzes()")

        await page.wait_for_selector("#attempts-count-quiz-1")
        await page.screenshot(path="verification/quiz_initial.png")

        print("Starting Quiz...")
        # We click and take a quick screenshot to catch "Starting..."
        await page.click("#quiz-btn-quiz-1")
        await page.screenshot(path="verification/quiz_starting.png")

        await page.wait_for_selector("input[placeholder='Your answer...']")
        await page.fill("input[placeholder='Your answer...']", "2")
        await page.evaluate("window.alert = () => {}")

        print("Submitting Quiz...")
        # Screenshot during submission to catch "Refreshing..."
        await page.click("#submitQuizBtn")
        await page.screenshot(path="verification/quiz_submitting.png")

        print("Waiting for update...")
        await page.wait_for_function("""() => {
            const el = document.getElementById('attempts-count-quiz-1');
            return el && el.innerText === '1 / 1';
        }""")

        await page.screenshot(path="verification/quiz_final.png")
        print("Verification screenshot saved.")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
