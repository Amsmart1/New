
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Load the app
        await page.goto(f"file://{os.getcwd()}/index.html")

        # Set a user in session storage to trigger IdleManager
        await page.evaluate("""() => {
            sessionStorage.setItem('currentUser', JSON.stringify({email: 'test@example.com', role: 'student'}));
        }""")

        # Reload to apply session
        await page.goto(f"file://{os.getcwd()}/student.html")

        # Inject shorter idle limit
        await page.evaluate("""() => {
            IdleManager.idleLimit = 5000; // 5 seconds
            IdleManager.warningTime = 2000; // 2 seconds
            IdleManager.lastActivity = Date.now();
            // Re-init or ensure it's running
            if (IdleManager._interval) clearInterval(IdleManager._interval);
            IdleManager._interval = setInterval(() => IdleManager.checkIdle(), 1000);
        }""")

        print("Waiting for idle warning...")
        # Should see a notification after 3 seconds (5 - 2)
        # UI.showNotification uses toast, let's see if we can find it
        try:
            await page.wait_for_selector(".toast", timeout=10000)
            print("Idle warning shown!")
        except:
            print("Idle warning NOT shown or selector incorrect.")

        print("Waiting for logout...")
        # Should redirect to index.html after 5 seconds
        # playwright handles alerts by dismissing them usually, but we might need to handle it
        page.on("dialog", lambda dialog: dialog.dismiss())

        try:
            await page.wait_for_url("**/index.html", timeout=10000)
            print("Successfully redirected to index.html after idle!")
        except:
            print("Failed to redirect to index.html")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
