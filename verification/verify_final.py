import os
import time
from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to home
        page.goto("http://localhost:8000")
        time.sleep(1)
        page.screenshot(path="verification/final_landing.png")
        print("Landing page screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify()
