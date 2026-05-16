
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        await page.goto(f"file://{os.getcwd()}/index.html")

        # 1. Login Toggle Screenshot
        print("Showing Login...")
        await page.evaluate("showLogin()")
        await page.wait_for_selector("#login", state="visible")
        await page.evaluate("document.getElementById('loginPassword').value = 'secret123'")
        await page.screenshot(path="/home/jules/verification/login_toggle_hidden.png")

        print("Toggling visibility...")
        await page.evaluate("togglePasswordVisibility('loginPassword')")
        await page.screenshot(path="/home/jules/verification/login_toggle_visible.png")

        # 2. Signup Strength Meter Screenshot
        print("Showing Signup...")
        await page.evaluate("showSignup('student')")
        await page.wait_for_selector("#signup", state="visible")
        await page.evaluate("document.getElementById('password').value = 'Ab1!5678'; document.getElementById('password').dispatchEvent(new Event('input'))")
        await asyncio.sleep(1) # wait for transition
        await page.screenshot(path="/home/jules/verification/signup_strength_strong.png")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("/home/jules/verification"):
        os.makedirs("/home/jules/verification")
    asyncio.run(run())
