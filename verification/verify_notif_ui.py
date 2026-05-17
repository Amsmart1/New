import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # 1. Verify Notifications using the specialized verification HTML
        print("Verifying Notification System...")
        await page.goto(f"file://{os.getcwd()}/verify_notifications.html")
        await asyncio.sleep(1)

        # Take screenshot of open notification list with close button
        await page.screenshot(path="verification/notif_header_check.png")

        # Click close button (✕)
        print("Clicking notification close button...")
        # The button we added has text '✕'
        await page.click("button:has-text('✕')")
        await asyncio.sleep(0.5)

        # Verify it's closed
        is_active = await page.evaluate("document.getElementById('notifList').classList.contains('active')")
        print(f"Notification list has 'active' class after close click: {is_active}")
        await page.screenshot(path="verification/notif_header_closed.png")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
