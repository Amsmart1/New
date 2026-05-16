import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # 1. Check Admin Users UI
        print("Checking Admin Users UI...")
        await page.goto("http://localhost:8000/admin.html")

        # Inject mocks after page load
        await page.evaluate("""
            window.SessionManager = {
                getCurrentUser: () => Promise.resolve({role: 'admin', email: 'admin@test.com'}),
                getSessionId: () => 'test-session'
            };
            window.SupabaseDB = window.SupabaseDB || {};
            window.SupabaseDB.getUser = () => Promise.resolve({active: true, role: 'admin', email: 'admin@test.com'});
            window.SupabaseDB.getUsers = () => Promise.resolve([]);
            window.SupabaseDB.getMaintenance = () => Promise.resolve({enabled: false, schedules: []});
            window.SupabaseDB.getCount = () => Promise.resolve(0);
            window.SupabaseDB.getStats = () => ({ successRate: 100, lastRequestTime: 10 });

            if (window.renderUsers) window.renderUsers();
        """)
        await asyncio.sleep(2)

        invite_btn = await page.query_selector("button:has-text('Invite User')")
        if invite_btn:
            print("Found 'Invite User' button.")
            await invite_btn.click()
            await asyncio.sleep(1)
            await page.screenshot(path="verification/admin_invite_modal.png")
            print("Screenshot saved: verification/admin_invite_modal.png")
        else:
            print("FAILED: 'Invite User' button not found.")
            await page.screenshot(path="verification/admin_failed.png")

        # 2. Check Signup Page with Invite Parameter
        print("Checking Signup with Invite Param...")
        await page.goto("http://localhost:8000/index.html?invite=test-token")
        await page.evaluate("""
            window.SupabaseDB = window.SupabaseDB || {};
            window.SupabaseDB.getInvite = () => Promise.resolve({
                token: 'test-token',
                role: 'teacher',
                email: 'teacher@test.com',
                expires_at: new Date(Date.now() + 86400000).toISOString(),
                used_at: null
            });
            window.SupabaseDB.getUser = () => Promise.resolve(null);
            window.SupabaseDB.getMaintenance = () => Promise.resolve({enabled: false, schedules: []});

            if (window.Auth && window.Auth.handleInvite) Auth.handleInvite('test-token');
        """)
        await asyncio.sleep(2)

        signup_visible = await page.is_visible("#signup")
        if signup_visible:
            print("Signup form shown for invite.")
            email_val = await page.input_value("#email")
            email_readonly = await page.evaluate("document.getElementById('email').readOnly")
            role_val = await page.evaluate("document.getElementById('role').value")
            role_disabled = await page.evaluate("document.getElementById('role').disabled")

            print(f"Prefilled Email: {email_val}, Readonly: {email_readonly}")
            print(f"Prefilled Role: {role_val}, Disabled: {role_disabled}")

            if email_val == 'teacher@test.com' and email_readonly == True and role_val == 'teacher' and role_disabled == True:
                print("Invite prefill verification SUCCESS.")
            else:
                print("Invite prefill verification FAILED.")

            await page.screenshot(path="verification/invite_signup_prefilled.png")
            print("Screenshot saved: verification/invite_signup_prefilled.png")
        else:
            print("FAILED: Signup form not shown for invite.")
            await page.screenshot(path="verification/signup_failed.png")

        await browser.close()

if __name__ == "__main__":
    if not os.path.exists("verification"):
        os.makedirs("verification")
    asyncio.run(run())
