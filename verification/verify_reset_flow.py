import os
import time
from playwright.sync_api import sync_playwright

def verify_reset_flow():
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
        page.screenshot(path="verification/reset_flow_initial.png")
        print("Reset flow initial screenshot saved.")

        # 3. Select Category
        page.select_option("#resetCategory", "Security Incident")
        time.sleep(1)
        page.screenshot(path="verification/reset_flow_category_selected.png")
        print("Category selected screenshot saved.")

        # 4. Select Reason
        page.select_option("#resetReason", "Compromised Account")
        time.sleep(1)
        page.screenshot(path="verification/reset_flow_reason_selected.png")
        print("Reason selected screenshot saved.")

        # 5. Check Tips
        tips_visible = page.is_visible("#resetTipsContainer")
        tips_content = page.inner_text("#resetTips")
        level_content = page.inner_text("#resetSecurityLevel")
        print(f"Tips Visible: {tips_visible}")
        print(f"Tips Content: {tips_content}")
        print(f"Level Content: {level_content}")

        browser.close()

if __name__ == "__main__":
    verify_reset_flow()
