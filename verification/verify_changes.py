from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # We can't easily login without a real database connection,
        # but we can check if the scripts load correctly and check some UI elements
        # that might be visible without auth if any, or just check the landing page.

        try:
            page.goto("http://localhost:8000/index.html")
            time.sleep(2)
            page.screenshot(path="verification/landing.png")
            print("Landing page screenshot saved.")

            # Check teacher.html
            page.goto("http://localhost:8000/teacher.html")
            time.sleep(2)
            # Since we are not logged in, it should alert and redirect,
            # but we can see the layout for a brief moment.
            page.screenshot(path="verification/teacher_layout.png")
            print("Teacher layout screenshot saved.")

            # Check student.html
            page.goto("http://localhost:8000/student.html")
            time.sleep(2)
            page.screenshot(path="verification/student_layout.png")
            print("Student layout screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
