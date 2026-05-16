
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # 1. Verify Teacher Dashboard Course Form
        print("Verifying Teacher Dashboard Course Form...")
        await page.goto(f"file://{os.getcwd()}/teacher.html")
        await page.evaluate("""() => {
            sessionStorage.setItem('currentUser', JSON.stringify({email: 'teacher@example.com', full_name: 'Dr. Smith', role: 'teacher'}));
        }""")
        await page.goto(f"file://{os.getcwd()}/teacher.html")
        await page.click("text=+ Create Course")
        await page.wait_for_selector("#courseEnrollmentId")
        await page.screenshot(path="verification/teacher_course_form.png")

        # 2. Verify Student Catalog
        print("Verifying Student Catalog...")
        await page.goto(f"file://{os.getcwd()}/student.html")
        await page.evaluate("""() => {
            sessionStorage.setItem('currentUser', JSON.stringify({email: 'student@example.com', full_name: 'John Doe', role: 'student'}));
        }""")
        # Mocking some courses for catalog
        await page.evaluate("""() => {
            window.myEnrollments = [];
            // Mock SupabaseDB.getCourses to return a course with enrollment_id and created_by
            const originalGetCourses = SupabaseDB.getCourses;
            SupabaseDB.getCourses = async () => [
                {id: '1', title: 'Math 101', description: 'Basics', created_by: 'Dr. Smith', enrollment_id: 'MATH123', status: 'published'}
            ];
            const originalGetEnrollments = SupabaseDB.getEnrollments;
            SupabaseDB.getEnrollments = async () => [];
        }""")
        await page.goto(f"file://{os.getcwd()}/student.html?page=catalog")
        await asyncio.sleep(1)
        await page.screenshot(path="verification/student_catalog.png")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
