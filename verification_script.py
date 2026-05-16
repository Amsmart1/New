import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # Helper to take screenshot
        async def take_screenshot(name):
            path = f"verification/{name}.png"
            await page.screenshot(path=path)
            print(f"Screenshot saved to {path}")

        # 1. Landing Page
        print("Verifying Landing Page...")
        await page.goto(f"file://{os.getcwd()}/index.html")
        await take_screenshot("landing_page")

        # 2. Student Dashboard
        print("Verifying Student Dashboard...")
        await page.goto(f"file://{os.getcwd()}/student.html")
        # Wait a bit for any JS to run
        await asyncio.sleep(1)
        await take_screenshot("student_dashboard")

        # 3. Teacher Dashboard
        print("Verifying Teacher Dashboard...")
        await page.goto(f"file://{os.getcwd()}/teacher.html")
        await asyncio.sleep(1)
        await take_screenshot("teacher_dashboard")

        # 4. Admin Dashboard
        print("Verifying Admin Dashboard...")
        await page.goto(f"file://{os.getcwd()}/admin.html")
        await asyncio.sleep(1)
        await take_screenshot("admin_dashboard")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
