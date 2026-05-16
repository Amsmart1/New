
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        print("Verification started...")
        await page.goto(f"file://{os.getcwd()}/index.html")

        # Test Visibility Toggle in Login
        print("Testing Visibility Toggle in Login...")
        await page.evaluate("showLogin()")

        type_before = await page.evaluate("document.getElementById('loginPassword').type")
        if type_before != 'password': raise Exception("Fail: Initial type not password")

        await page.evaluate("togglePasswordVisibility('loginPassword')")
        type_after = await page.evaluate("document.getElementById('loginPassword').type")
        if type_after != 'text': raise Exception("Fail: Type not text after toggle")
        print("Toggle OK")

        # Test Strength Meter in Signup
        print("Testing Strength Meter in Signup...")
        await page.evaluate("showSignup('student')")

        async def get_strength_width():
            return await page.evaluate("document.getElementById('passwordStrength').style.width")

        # 1. Just length (25%)
        await page.evaluate("document.getElementById('password').value = 'abcdefgh'; document.getElementById('password').dispatchEvent(new Event('input'))")
        width = await get_strength_width()
        print(f"Width (length only): {width}")
        if width != '25%': raise Exception(f"Fail: Expected 25%, got {width}")

        # 2. Length + Numbers (50%)
        await page.evaluate("document.getElementById('password').value = 'abcdefgh1'; document.getElementById('password').dispatchEvent(new Event('input'))")
        width = await get_strength_width()
        print(f"Width (length + numbers): {width}")
        if width != '50%': raise Exception(f"Fail: Expected 50%, got {width}")

        # 3. Length + Numbers + Upper (75%)
        await page.evaluate("document.getElementById('password').value = 'abcdefgh1A'; document.getElementById('password').dispatchEvent(new Event('input'))")
        width = await get_strength_width()
        print(f"Width (length + numbers + upper): {width}")
        if width != '75%': raise Exception(f"Fail: Expected 75%, got {width}")

        # 4. Length + Numbers + Upper + Symbol (100%)
        await page.evaluate("document.getElementById('password').value = 'abcdefgh1A!'; document.getElementById('password').dispatchEvent(new Event('input'))")
        width = await get_strength_width()
        print(f"Width (All): {width}")
        if width != '100%': raise Exception(f"Fail: Expected 100%, got {width}")

        print("Verification Successful!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
