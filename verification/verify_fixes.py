import asyncio
from playwright.async_api import async_playwright
import os
import json

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # 1. Mock session
        print("Mocking session...")
        await page.goto(f"file://{os.getcwd()}/index.html")
        await page.evaluate("""
            sessionStorage.setItem('currentUser', JSON.stringify({
                email: 'student@example.com',
                full_name: 'Test Student',
                role: 'student'
            }));
        """)

        # 2. Check Notification Close Button
        print("Checking Notification Close Button...")
        await page.goto(f"file://{os.getcwd()}/student.html")
        await asyncio.sleep(2)

        # Open notifications
        print("Clicking notifBell...")
        await page.click("#notifBell")
        await asyncio.sleep(1)

        # Take screenshot of open notification list with close button
        await page.screenshot(path="verification/notif_open.png")

        # Click close button (the one with ✕)
        print("Clicking close button...")
        await page.click("#notifList button:has-text('✕')")
        await asyncio.sleep(1)

        # Verify it's closed (check if it has 'active' class)
        is_active = await page.evaluate("document.getElementById('notifList').classList.contains('active')")
        print(f"Notification list has 'active' class after close click: {is_active}")
        await page.screenshot(path="verification/notif_closed.png")

        # 3. Check sidebar items independence
        print("Checking sidebar items...")
        await page.click("nav button[data-page='courses']")
        await asyncio.sleep(2)
        await page.screenshot(path="verification/student_courses.png")

        await page.click("nav button[data-page='assignments']")
        await asyncio.sleep(2)
        await page.screenshot(path="verification/student_assignments.png")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
