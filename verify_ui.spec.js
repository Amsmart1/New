const { test, expect } = require('@playwright/test');

test('capture student dashboard', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/student.html');
  await page.screenshot({ path: 'student_dashboard.png', fullPage: true });
});

test('capture teacher dashboard', async ({ page }) => {
  await page.goto('file://' + process.cwd() + '/teacher.html');
  await page.screenshot({ path: 'teacher_dashboard.png', fullPage: true });
});
