from playwright.sync_api import sync_playwright, expect
import os
import re

def test_landing_refinement(page):
    file_path = "file://" + os.path.join(os.getcwd(), "index.html")
    page.goto(file_path)
    page.wait_for_load_state("networkidle")

    # 1. Verify Header
    nav_links = page.locator(".landing-header .nav-links")
    expect(nav_links.get_by_text("Platform")).not_to_be_visible()
    expect(nav_links.get_by_text("Company")).not_to_be_visible()
    expect(nav_links.get_by_text("Documents")).not_to_be_visible()
    expect(nav_links.get_by_text("Sign In")).to_be_visible()

    # Take screenshot of header
    page.screenshot(path="verification/header_check.png", clip={"x": 0, "y": 0, "width": 1280, "height": 100})

    # 2. Verify Footer
    footer = page.locator(".landing-footer")
    expect(footer.get_by_role("heading", name="Quick Resources")).to_be_visible()
    expect(footer.get_by_text("📘 Teaching Standards")).to_be_visible()
    expect(footer.get_by_text("🛡️ Privacy Policy")).to_be_visible()
    expect(footer.get_by_text("💬 Community Forum")).to_be_visible()

    # Scroll to footer and take screenshot
    footer.scroll_into_view_if_needed()
    page.screenshot(path="verification/footer_check.png")

    # 3. Verify Footer Actions
    # Click Teaching Standards
    footer.get_by_text("📘 Teaching Standards").click()
    expect(page.locator("#infoOverlay")).to_have_class(re.compile(r"active"))
    expect(page.locator("#infoModalContent")).to_contain_text("Teaching Standards")
    page.screenshot(path="verification/standards_modal.png")
    page.locator("#infoOverlay .close-btn").click()
    page.wait_for_timeout(500) # Wait for animation
    expect(page.locator("#infoOverlay")).not_to_have_class(re.compile(r"active"))

    # Click Community Forum
    footer.get_by_text("💬 Community Forum").click()
    expect(page.locator(".toast")).to_be_visible()
    expect(page.locator(".toast")).to_contain_text("Community Forum coming soon!")
    page.screenshot(path="verification/toast_check.png")

    # 4. Verify Help Center
    footer.get_by_text("FAQ").click()
    expect(page.locator("#helpCenterOverlay")).to_have_class(re.compile(r"active"))

    # Select Student role in Help Center
    page.locator("#helpCenterContent .role-btn").filter(has_text="Student").click()
    expect(page.get_by_role("heading", name="Student Help Center")).to_be_visible()

    # Verify Quick Resources is GONE from Help Center SIDEBAR (it's still in footer, so use selector scoping)
    expect(page.locator(".help-sidebar-col").get_by_role("heading", name="Quick Resources")).not_to_be_visible()
    page.screenshot(path="verification/help_center_sidebar_check.png")

    print("Verification complete!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_landing_refinement(page)
        except Exception as e:
            print(f"Error during verification: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
