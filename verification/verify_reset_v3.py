import os
import time
from playwright.sync_api import sync_playwright

def verify_reset_v3():
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

        # 3. Select "I'm having trouble logging in"
        page.select_option("#resetReason", "I'm having trouble logging in")
        time.sleep(1)

        # 4. Verify tips appear and severity is hidden
        tips_visible = page.is_visible("#resetTipsContainer")
        tips_content = page.inner_text("#resetTips")
        severity_present = page.query_selector("#resetSecurityLevel")

        if tips_visible and "Check caps lock" in tips_content:
            print("SUCCESS: Requested tips are visible.")
        else:
            print(f"ERROR: Tips visibility or content mismatch. Visible: {tips_visible}, Content: {tips_content}")

        if severity_present:
            print("ERROR: Severity level/badge is still present in the UI!")
        else:
            print("SUCCESS: Severity level is hidden from the UI.")

        page.screenshot(path="verification/reset_v3_tips.png")

        # 5. Verify 8-character password strength
        strength_results = page.evaluate("""() => {
            return {
                is_8_strong: isStrongPassword('Pass123!@'),
                is_7_weak: isStrongPassword('Pas123!'),
            }
        }""")

        if strength_results['is_8_strong'] and not strength_results['is_7_weak']:
             print("SUCCESS: 8-character password logic confirmed.")
        else:
             print(f"ERROR: Password logic mismatch. Results: {strength_results}")

        browser.close()

if __name__ == "__main__":
    verify_reset_v3()
