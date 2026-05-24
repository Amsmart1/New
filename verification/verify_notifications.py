import os
import time
from playwright.sync_api import sync_playwright, expect

def verify_notifications(page):
    # Load the index page
    page.goto("http://localhost:8000/index.html")

    # Check if we can see the login form
    expect(page.get_by_placeholder("Email address")).to_be_visible()

    # Since we can't easily login without a real database/session in this environment,
    # we'll just verify the existence of core scripts and UI elements that would be there.
    # Actually, I can try to mock the session in localStorage/sessionStorage.

    page.evaluate("""
        sessionStorage.setItem('currentUser', JSON.stringify({
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'admin'
        }));
        sessionStorage.setItem('sessionId', 'mock-session-id');
    """)

    # Navigate to admin dashboard
    page.goto("http://localhost:8000/admin.html")

    # Wait for the dashboard to load
    page.wait_for_selector("#notifBell")

    # Click the notification bell
    page.click("#notifBell")

    # Check if notification list appeared
    expect(page.locator("#notifList")).to_be_visible()

    # Take a screenshot
    page.screenshot(path="verification/notifications_ui.png")
    print("Screenshot saved to verification/notifications_ui.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            verify_notifications(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
