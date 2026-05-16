
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # Mock user and SupabaseDB
        setup_script = """
            sessionStorage.setItem('currentUser', JSON.stringify({email: 'teacher@example.com', full_name: 'Dr. Smith', role: 'teacher'}));
            window.SupabaseDB = {
                getCourses: async () => [],
                getNotifications: async () => [],
                getBroadcasts: async () => [],
                getStats: () => ({ successRate: 100 }),
                getMaintenance: async () => ({ enabled: false, schedules: [] }),
                deleteExpiredBroadcasts: async () => {}
            };
            window.NotificationManager = { initPolling: () => {} };
        """

        # 1. Verify Teacher Dashboard Course Form
        print("Verifying Teacher Dashboard Course Form...")
        await page.goto(f"file://{os.getcwd()}/teacher.html")
        await page.evaluate(setup_script)
        await page.goto(f"file://{os.getcwd()}/teacher.html")

        # Manually trigger showCourseForm
        await page.evaluate("showCourseForm()")
        await page.wait_for_selector("#courseEnrollmentId")
        await page.screenshot(path="verification/teacher_course_form.png")

        # 2. Verify Student Catalog
        print("Verifying Student Catalog...")
        await page.goto(f"file://{os.getcwd()}/student.html")
        await page.evaluate("""
            sessionStorage.setItem('currentUser', JSON.stringify({email: 'student@example.com', full_name: 'John Doe', role: 'student'}));
            window.myEnrollments = [];
            window.SupabaseDB = {
                getCourses: async () => [
                    {id: '1', title: 'Math 101', description: 'Basics', created_by: 'Dr. Smith', enrollment_id: 'MATH123', status: 'published'}
                ],
                getEnrollments: async () => [],
                getNotifications: async () => [],
                getBroadcasts: async () => [],
                getCount: async () => 0,
                getMaintenance: async () => ({ enabled: false, schedules: [] }),
                getAssignments: async () => [],
                getLiveClasses: async () => [],
                getQuizzes: async () => [],
                getMaterials: async () => []
            };
            window.NotificationManager = { initPolling: () => {} };
        """)
        await page.goto(f"file://{os.getcwd()}/student.html?page=catalog")
        # Ensure it renders - in student.js it's called 'renderCourses' for catalog too if page is 'courses' but catalog is usually separate.
        # Actually in student.js, 'courses' might be the catalog page depending on implementation.
        await page.evaluate("renderCourses()")
        await asyncio.sleep(1)
        await page.screenshot(path="verification/student_catalog.png")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
