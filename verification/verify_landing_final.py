from playwright.sync_api import sync_playwright, expect

def verify_landing_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 3000})
        page = context.new_page()

        # Using file path for static page verification
        import os
        path = "file://" + os.path.abspath("index.html")
        page.goto(path)

        # Verify Header Links
        header = page.locator("header.landing-header")
        expect(header.get_by_role("link", name="Features")).to_be_visible()
        expect(header.get_by_role("link", name="How it Works")).to_be_visible()
        expect(header.get_by_role("link", name="About")).to_be_visible()

        # Verify New Sections
        expect(page.locator("#features")).to_be_visible()
        expect(page.locator("#how-it-works")).to_be_visible()
        expect(page.locator("#about")).to_be_visible()
        expect(page.locator(".bottom-cta")).to_be_visible()

        # Take full page screenshot
        page.screenshot(path="verification/final_landing_v2.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_landing_page()
