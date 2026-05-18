import asyncio
from playwright.async_api import async_playwright
import os
import http.server
import socketserver
import threading
import time

PORT = 8087

def run_server():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) + "/..")
    handler = http.server.SimpleHTTPRequestHandler
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Serving at port {PORT}")
        httpd.serve_forever()

async def run_verification():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print(f"Navigating to http://localhost:{PORT}/verification/test_calendar.html...")
        await page.goto(f"http://localhost:{PORT}/verification/test_calendar.html", wait_until="load")

        # Wait for any cell to be present
        await page.wait_for_selector('.calendar-cell')

        # Desktop screenshot
        await page.screenshot(path="verification/calendar_desktop.png")
        print("Desktop screenshot saved.")

        # Mobile screenshot
        await page.set_viewport_size({'width': 375, 'height': 667})
        await page.wait_for_timeout(1000)
        await page.screenshot(path="verification/calendar_mobile.png")
        print("Mobile screenshot saved.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
