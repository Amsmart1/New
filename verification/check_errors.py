import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        errors = []
        page.on("console", lambda msg: errors.append(f"CONSOLE {msg.type}: {msg.text}"))
        page.on("pageerror", lambda exc: errors.append(f"PAGE ERROR: {exc}"))

        print("Checking student.html for errors...")
        await page.goto(f"file://{os.getcwd()}/student.html")
        await asyncio.sleep(5)

        for err in errors:
            print(err)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
