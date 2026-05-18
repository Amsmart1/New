import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # 1. Setup mock student
        await page.goto(f"file://{os.getcwd()}/index.html")
        await page.evaluate("""
            sessionStorage.setItem('currentUser', JSON.stringify({
                email: 'student@example.com',
                full_name: 'Test Student',
                role: 'student'
            }));
        """)

        await page.goto(f"file://{os.getcwd()}/student.html")
        await asyncio.sleep(5)

        await page.evaluate("""
            const container = document.getElementById('pageContent') || document.body;
            const testDiv = document.createElement('div');
            testDiv.id = 'verification-container';
            testDiv.style.background = 'white';
            testDiv.style.padding = '20px';
            testDiv.innerHTML = '<h2>Verification</h2>' +
                               '<h3>Regular Timer</h3><div id="test-timer"></div>' +
                               '<h3>Compact Timer</h3><div id="test-timer-compact"></div>' +
                               '<h3>Upcoming Timer (with Progress)</h3><div id="test-timer-upcoming"></div>';
            container.prepend(testDiv);

            window.Countdown.create('#test-timer', {
                targetDate: Date.now() + 10000000,
                startTime: Date.now() - 5000000,
                showProgress: true,
                label: 'Due in:'
            });

            window.Countdown.create('#test-timer-compact', {
                targetDate: Date.now() + 10000000,
                startTime: Date.now() - 5000000,
                showProgress: true,
                compact: true,
                label: 'Remaining:'
            });

            window.Countdown.create('#test-timer-upcoming', {
                targetDate: Date.now() + 20000000,
                startAt: Date.now() + 10000000,
                startTime: Date.now() - 5000000,
                showProgress: true,
                upcomingLabel: 'Starts in:'
            });
        """)
        await asyncio.sleep(2)
        await page.screenshot(path="verification/final_verification_v2.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
