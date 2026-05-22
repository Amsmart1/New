from playwright.sync_api import sync_playwright

def verify_student_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            page.goto("http://localhost:8000/student.html")

            # Mock successful login and role
            page.evaluate("""
                sessionStorage.setItem('currentUser', JSON.stringify({
                    email: 'test@student.com',
                    role: 'student',
                    full_name: 'Test Student'
                }));
                sessionStorage.setItem('sessionId', 's_mock_session');
            """)

            page.reload()
            page.wait_for_timeout(3000) # Wait for initial scripts and initDashboard

            # Check if global functions are defined
            is_start_quiz_defined = page.evaluate("typeof window.startQuiz === 'function'")
            is_submit_quiz_defined = page.evaluate("typeof window.submitQuiz === 'function'")

            print(f"window.startQuiz defined: {is_start_quiz_defined}")
            print(f"window.submitQuiz defined: {is_submit_quiz_defined}")

            page.screenshot(path="verification/student_page_load.png")

            if not is_start_quiz_defined or not is_submit_quiz_defined:
                print("Error: Global quiz functions not defined!")
                # exit(1) # Don't exit yet, let's see what's on the page
        except Exception as e:
            print(f"Failed to load student page: {e}")
            exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_student_page()
