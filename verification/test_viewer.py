import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        await page.goto(f"file://{os.getcwd()}/index.html")
        await page.evaluate("""
            window.UI.viewFile('test.png', 'Test Image');
        """)
        await asyncio.sleep(1)
        await page.screenshot(path="verification/viewer_image.png")

        await page.evaluate("""
            document.querySelector('.modal-backdrop').remove();
            window.UI.viewFile('test.docx', 'Test Doc');
        """)
        await asyncio.sleep(1)
        await page.screenshot(path="verification/viewer_doc.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
