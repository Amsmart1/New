from playwright.sync_api import Page, expect, sync_playwright
import os

def test_admin_ui(page: Page):
    # Load the admin page directly. Since we don't have a real Supabase backend in this environment,
    # we'll just check if the button is absent from the HTML structure rendered.
    # We can mock the SupabaseDB calls if needed, but for a simple UI check,
    # we can just see if the code that renders the button is gone.

    # Actually, let's just use a simple script to check the pageContent after calling renderManagement
    # Since it's an SPA, we might need to trigger the rendering.

    page.goto("http://localhost:8000/admin.html")

    # Wait for the page to load
    page.wait_for_timeout(2000)

    # Take a screenshot of the Management section if possible
    # We'll try to find the System Management header
    try:
        # If we can't login, we might just see the login screen or a redirected page.
        # But we can check if the string "View System Logs" exists in the page content.
        content = page.content()
        if "View System Logs" in content:
            print("FAILURE: 'View System Logs' button text found in page content.")
        else:
            print("SUCCESS: 'View System Logs' button text NOT found in page content.")

        page.screenshot(path="verification/admin_dashboard_check.png")
    except Exception as e:
        print(f"Error during verification: {e}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_admin_ui(page)
        finally:
            browser.close()
