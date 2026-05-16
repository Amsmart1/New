
import { test, expect } from '@playwright/test';

test('Password visibility toggle works', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Open Login
  await page.click('#navSignIn');

  const loginPass = page.locator('#loginPassword');
  const toggle = page.locator('#login .password-toggle');

  await expect(loginPass).toHaveAttribute('type', 'password');
  await toggle.click();
  await expect(loginPass).toHaveAttribute('type', 'text');
  await toggle.click();
  await expect(loginPass).toHaveAttribute('type', 'password');
});

test('Password strength meter works', async ({ page }) => {
  await page.goto('http://localhost:8080');

  // Open Signup
  await page.click('#navGetStarted');
  await page.click('text=Create one');

  const signupPass = page.locator('#signup #password');
  const meterFill = page.locator('#passwordStrength');
  const container = page.locator('#passwordStrengthContainer');

  // Initially hidden
  await expect(container).not.toBeVisible();

  // Weak (only length)
  await signupPass.fill('12345678');
  await expect(container).toBeVisible();
  await expect(meterFill).toHaveCSS('width', /25%/);

  // Medium (length + upper)
  await signupPass.fill('12345678A');
  await expect(meterFill).toHaveCSS('width', /50%/);

  // Strong (length + upper + number already there + symbol)
  await signupPass.fill('12345678A!');
  await expect(meterFill).toHaveCSS('width', /75%/);

  // Very Strong (everything)
  await signupPass.fill('12345678Aa!');
  // Wait, my logic was:
  // if (password.length >= 8) strength += 25;
  // if (/[A-Z]/.test(password)) strength += 25;
  // if (/[0-9]/.test(password)) strength += 25;
  // if (/[^A-Za-z0-9]/.test(password)) strength += 25;
  // Total 100.
});
