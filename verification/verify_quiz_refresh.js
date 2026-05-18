const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.new_context();
  const page = await context.new_page();

  const studentHtmlPath = `file://${path.join(__dirname, '../student.html')}`;

  // Mock Supabase and SessionManager
  await page.addInitScript(() => {
    window.SessionManager = {
      getCurrentUser: async () => ({
        email: 'student@example.com',
        full_name: 'Test Student',
        role: 'student'
      }),
      getSessionId: () => 'test-session'
    };

    const mockQuiz = {
      id: 'quiz-1',
      course_id: 'course-1',
      title: 'Test Quiz',
      description: 'A test quiz',
      attempts_allowed: 3,
      time_limit: 0,
      questions: [
        { type: 'short', text: 'What is 1+1?', points: 1, correct: '2' }
      ],
      status: 'published'
    };

    let quizSubmissions = [];

    window.SupabaseDB = {
      getQuizzes: async () => [mockQuiz],
      getQuiz: async () => mockQuiz,
      getQuizSubmissions: async () => quizSubmissions,
      getEnrolledCourses: async () => [{ id: 'course-1', title: 'Course 1' }],
      getEnrollments: async () => [{ course_id: 'course-1', student_email: 'student@example.com' }],
      getUser: async () => ({ email: 'student@example.com', full_name: 'Test Student', active: True }),
      saveQuizSubmission: async (sub) => {
        if (sub.status === 'submitted') {
            // Find existing draft or add new
            const idx = quizSubmissions.findIndex(s => s.id === sub.id || (s.quiz_id === sub.quiz_id && s.status === 'draft'));
            if (idx >= 0) {
                quizSubmissions[idx] = { ...sub, id: sub.id || 'sub-' + Date.now() };
            } else {
                quizSubmissions.push({ ...sub, id: 'sub-' + Date.now() });
            }
        } else if (sub.status === 'draft') {
            const existing = quizSubmissions.find(s => s.status === 'draft');
            if (!existing) {
                const newSub = { ...sub, id: 'draft-' + Date.now() };
                quizSubmissions.push(newSub);
                return newSub;
            }
            return existing;
        }
        return sub;
      },
      updateCourseProgress: async () => {},
      getMaintenance: async () => ({ enabled: false }),
      getNotifications: async () => [],
      getBroadcasts: async () => [],
      getCount: async () => 0
    };

    // Mock Countdown
    window.Countdown = {
        create: () => ({ destroy: () => {} }),
        clearActiveCountdowns: () => {}
    };

    window.initDashboard = async () => ({ email: 'student@example.com', role: 'student' });
    window.updateMaintBanner = () => {};
  });

  await page.goto(studentHtmlPath);
  await page.waitForLoadState('networkidle');

  console.log('Navigating to Quizzes...');
  await page.evaluate(() => {
    const btn = document.querySelector('nav button[data-page="quizzes"]');
    if (btn) btn.click();
  });

  await page.waitForSelector('#attempts-count-quiz-1');
  let attemptsText = await page.innerText('#attempts-count-quiz-1');
  console.log('Initial attempts:', attemptsText);

  console.log('Starting Quiz...');
  await page.click('#quiz-btn-quiz-1');

  // Verify button is disabled immediately
  const isBtnDisabled = await page.isDisabled('#quiz-btn-quiz-1');
  const btnText = await page.innerText('#quiz-btn-quiz-1');
  console.log('Is button disabled after start click?', isBtnDisabled);
  console.log('Button text after start click:', btnText);

  if (!isBtnDisabled || btnText !== 'Starting...') {
      console.error('FAIL: Button should be disabled and show "Starting..." immediately');
      process.exit(1);
  }

  // Wait for quiz area to show
  await page.waitForSelector('#quizArea', { state: 'visible' });
  console.log('Quiz area is visible');

  // Answer question
  await page.fill('input[placeholder="Your answer..."]', '2');

  // Mock alert to prevent hanging
  await page.evaluate(() => {
      window.alert = () => {};
  });

  console.log('Submitting Quiz...');
  await page.click('#submitQuizBtn');

  // Verify button in list shows "Refreshing..."
  // It might be hidden by quizArea but we can check its state in DOM
  const isBtnDisabledAfterSubmit = await page.evaluate(() => {
      const b = document.getElementById('quiz-btn-quiz-1');
      return b.disabled && b.textContent === 'Refreshing...';
  });
  console.log('Is list button showing "Refreshing..." after submit click?', isBtnDisabledAfterSubmit);

  // Wait for attempts to update
  await page.waitForFunction(() => {
      const el = document.getElementById('attempts-count-quiz-1');
      return el && el.innerText === '1 / 3';
  });

  attemptsText = await page.innerText('#attempts-count-quiz-1');
  console.log('Updated attempts:', attemptsText);

  if (attemptsText !== '1 / 3') {
      console.error('FAIL: Attempts count did not update correctly');
      process.exit(1);
  }

  console.log('SUCCESS: Quiz refresh logic verified');

  await browser.close();
})();
