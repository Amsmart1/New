import asyncio
from playwright.async_api import async_playwright
import os

async def run_verification():
    async with async_playwright() as p:
        # Use a mobile device descriptor
        iphone_13 = p.devices['iPhone 13']

        browser = await p.chromium.launch(headless=True)

        # Desktop context
        desktop_context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        # Mobile context
        mobile_context = await browser.new_context(**iphone_13)

        async def verify_context(context, prefix):
            page = await context.new_page()

            # Log console messages
            page.on("console", lambda msg: print(f"{prefix} CONSOLE: {msg.text}"))
            page.on("pageerror", lambda exc: print(f"{prefix} PAGE ERROR: {exc}"))

            await page.goto('http://localhost:8080/index.html')
            await page.wait_for_load_state('networkidle')

            # 1. Verify Header
            print(f"{prefix} Verifying header...")
            await page.screenshot(path=f"{prefix}landing.png", full_page=True)

            # Check for About Us, Contact Us, Get Started
            assert await page.is_visible("text=About Us")
            assert await page.is_visible("text=Contact Us")
            assert await page.is_visible("text=Get Started")

            # 2. Verify About Us Modal
            print(f"{prefix} Verifying About Us modal...")
            await page.click("text=About Us")
            await page.wait_for_selector("#infoOverlay.active", timeout=5000)
            # Check for content (Mission/Stats)
            assert await page.is_visible("text=Our mission is to make education accessible")
            assert await page.is_visible("text=100%")
            await page.screenshot(path=f"{prefix}about_modal.png")
            # Close it
            await page.click("#infoOverlay .close-btn")
            await page.wait_for_selector("#infoOverlay.active", state='hidden', timeout=5000)

            # 3. Verify Contact Us Modal
            print(f"{prefix} Verifying Contact Us modal...")
            await page.click("text=Contact Us")
            await page.wait_for_selector("#infoOverlay.active", timeout=5000)
            assert await page.is_visible("text=eduquizlms@gmail.com")
            await page.screenshot(path=f"{prefix}contact_modal.png")
            await page.click("#infoOverlay .close-btn")
            await page.wait_for_selector("#infoOverlay.active", state='hidden', timeout=5000)

            # 4. Verify Help Center Responsiveness
            print(f"{prefix} Verifying Help Center...")
            # Scroll to footer FAQ link to open Help Center
            await page.click("footer a:has-text('FAQ')")
            await page.wait_for_selector("#helpCenterOverlay.active", timeout=5000)
            await page.screenshot(path=f"{prefix}help_center_init.png")

            # Select Student role
            # Using force=True because of the flippable card complexity
            await page.click("#card-student", force=True)

            try:
                await page.wait_for_selector("#helpCenterBodyContainer", state='visible', timeout=5000)
                print(f"{prefix} Help Center body visible.")
            except Exception as e:
                print(f"{prefix} Help Center body FAILED to become visible.")
                await page.screenshot(path=f"{prefix}help_center_fail.png")

            if await page.is_visible("#helpCenterBodyContainer"):
                await page.screenshot(path=f"{prefix}help_center_student.png")
                # Check for FAQ items
                assert await page.is_visible("text=Frequently Asked Questions")

            await page.close()

        print("Starting Desktop verification...")
        await verify_context(desktop_context, "verification/desktop_")

        print("\nStarting Mobile verification...")
        await verify_context(mobile_context, "verification/mobile_")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists('verification'):
        os.makedirs('verification')

    # Start a simple server in the background
    import subprocess
    server = subprocess.Popen(['python3', '-m', 'http.server', '8080'])

    try:
        asyncio.run(run_verification())
    finally:
        server.terminate()
