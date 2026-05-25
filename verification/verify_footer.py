from playwright.sync_api import sync_playwright, expect
import os

def test_footer(page):
    file_path = "file://" + os.path.join(os.getcwd(), "index.html")
    page.goto(file_path)
    page.wait_for_load_state("networkidle")

    footer = page.locator(".landing-footer")
    footer.scroll_into_view_if_needed()
    # Wait a bit for scroll to finish
    page.wait_for_timeout(500)
    footer.screenshot(path="verification/footer_check_v2.png")

    print("Footer screenshot taken!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_footer(page)
        finally:
            browser.close()
