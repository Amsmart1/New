
import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        print("Testing Password Visibility Toggle...")
        await page.goto(f"file://{os.getcwd()}/index.html")

        # Open Login
        await page.click('#navSignIn')

        loginPass = page.locator('#loginPassword')
        # Use a more specific locator or just evaluate

        await expect_type(loginPass, 'password')

        # Click via evaluate to avoid interception issues in headless
        await page.evaluate("document.querySelector('#login .password-toggle').click()")
        await expect_type(loginPass, 'text')

        await page.evaluate("document.querySelector('#login .password-toggle').click()")
        await expect_type(loginPass, 'password')

        print("Testing Password Strength Meter...")
        # Close login and open signup
        await page.evaluate("closeAuth()")
        await page.click('#navGetStarted')
        await page.click('#heroStudent')

        signupPass = page.locator('#signup #password')
        meterFill = page.locator('#passwordStrength')

        await signupPass.fill('12345678')
        await expect_width(meterFill, '25%')

        await signupPass.fill('12345678A')
        await expect_width(meterFill, '50%')

        await signupPass.fill('12345678A!')
        await expect_width(meterFill, '75%')

        await signupPass.fill('12345678Aa!')
        await expect_width(meterFill, '100%')

        print("Verification Successful!")
        await browser.close()

async def expect_type(locator, expected_type):
    actual = await locator.get_attribute('type')
    if actual != expected_type:
        raise Exception(f"Expected type {expected_type}, got {actual}")
    print(f"Verified type: {actual}")

async def expect_width(locator, expected_width):
    # Wait for transition
    await asyncio.sleep(0.5)
    actual = await locator.evaluate("el => el.style.width")
    if actual != expected_width:
        raise Exception(f"Expected width {expected_width}, got {actual}")
    print(f"Verified width: {actual}")

if __name__ == "__main__":
    asyncio.run(run())
