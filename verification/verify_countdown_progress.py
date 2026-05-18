import asyncio
from playwright.async_api import async_playwright
import os

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create a local server to serve the files or use file://
        # Since we are in the repo root, we can use file path
        path = "file://" + os.path.abspath("index.html")
        page = await browser.new_page()

        # Test visual rendering by injecting a timer
        await page.goto(path)

        # Inject an enhanced countdown into the landing page for demonstration
        await page.evaluate('''() => {
            const div = document.createElement('div');
            div.id = "test-timer";
            div.style.position = "fixed";
            div.style.top = "20px";
            div.style.right = "20px";
            div.style.zIndex = "9999";
            div.style.background = "white";
            div.style.padding = "20px";
            div.style.border = "2px solid black";
            document.body.appendChild(div);

            // Critical (Red) - < 25%
            const divRed = document.createElement('div');
            divRed.id = "timer-red";
            divRed.style.marginBottom = "20px";
            div.appendChild(divRed);

            // Warning (Yellow) - 25% to 50%
            const divYellow = document.createElement('div');
            divYellow.id = "timer-yellow";
            divYellow.style.marginBottom = "20px";
            div.appendChild(divYellow);

            // OK (Green) - > 50%
            const divGreen = document.createElement('div');
            divGreen.id = "timer-green";
            div.appendChild(divGreen);

            const now = Date.now();

            // Red: total 100s, 10s left
            window.Countdown.create("#timer-red", {
                targetDate: now + 10000,
                startTime: now - 90000,
                showProgress: true,
                label: "Critical State (<25%)"
            });

            // Yellow: total 100s, 40s left
            window.Countdown.create("#timer-yellow", {
                targetDate: now + 40000,
                startTime: now - 60000,
                showProgress: true,
                label: "Warning State (<50%)"
            });

            // Green: total 100s, 80s left
            window.Countdown.create("#timer-green", {
                targetDate: now + 80000,
                startTime: now - 20000,
                showProgress: true,
                label: "Plenty of Time (>50%)"
            });
        }''')

        await page.wait_for_timeout(2000)
        await page.screenshot(path="verification/countdown_enhanced.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
