import os
import time
from playwright.sync_api import sync_playwright

def verify_reset_flow_final():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Navigate to home
        page.goto("http://localhost:8000")
        time.sleep(2)

        # 2. Open Reset Flow
        page.evaluate("showReset()")
        time.sleep(1)

        # 3. Fill Category and Reason
        page.select_option("#resetCategory", "Security Incident")
        page.select_option("#resetReason", "Compromised Account")

        # 4. Fill Custom Reason
        page.fill("#resetCustomReason", "My account was accessed from another country.")

        page.screenshot(path="verification/reset_flow_with_custom_reason.png")
        print("Custom reason screenshot saved.")

        # 5. Check Tips and Security Level
        tips_content = page.inner_text("#resetTips")
        level_content = page.inner_text("#resetSecurityLevel")
        print(f"Tips Content: {tips_content}")
        print(f"Level Content: {level_content}")

        # 6. Verify Login Error UI
        page.evaluate("showLogin()")
        time.sleep(1)
        page.fill("#loginEmail", "test@example.com")
        page.fill("#loginPassword", "wrongpassword")

        # Click the correct submit button in the login container
        page.click("#loginForm button[type='submit']")
        time.sleep(2)

        page.screenshot(path="verification/login_error_with_temp_password_check.png")
        print("Login error check screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_reset_flow_final()
