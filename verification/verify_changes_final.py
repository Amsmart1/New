from playwright.sync_api import Page, expect, sync_playwright
import time

def verify_changes(page: Page):
    # Go to landing page
    page.goto("http://localhost:8000/index.html")

    # Wait for Auth.init to complete
    time.sleep(1)

    # 1. Verify Reset Tips Flow
    print("Testing Reset Flow...")
    page.evaluate("Auth.showReset()")

    # Wait for animation/display update
    time.sleep(0.5)

    expect(page.locator("#reset")).to_be_visible()

    # Select the new reason
    page.select_option("#resetReason", "I'm having trouble logging in")

    # Check if tips container is visible and has correct content
    tips_container = page.locator("#resetTipsContainer")
    expect(tips_container).to_be_visible()

    tips_text = page.locator("#resetTips")
    expect(tips_text).to_contain_text("-Check caps lock.")

    # Take screenshot of reset tips
    page.screenshot(path="/home/jules/verification/reset_tips.png")
    print("Reset tips screenshot saved.")

    # 2. Verify Password Strength/Validation (8 chars)
    print("Testing Signup Password Validation...")
    page.evaluate("Auth.showSignup('student')")
    time.sleep(0.5)
    expect(page.locator("#signup")).to_be_visible()

    password_input = page.locator("#password")
    confirm_input = page.locator("#confirmPassword")

    # Try 7 chars
    password_input.fill("Abc123!")
    confirm_input.fill("Abc123!")

    page.fill("#fullName", "Test User")
    page.fill("#email", "test@example.com")

    page.click("button:has-text('Create Account')")

    error_el = page.locator("#signupError")
    expect(error_el).to_contain_text("Password must be 8+ chars")

    page.screenshot(path="/home/jules/verification/signup_error.png")
    print("Signup error screenshot saved.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_changes(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
