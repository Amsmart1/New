const LandingUI = {
    faqs: {
        student: [
            {
                category: "ACCOUNT",
                items: [
                    { q: "How do I reset my password?", a: "Click on 'Forgot Password' on the login screen and follow the instructions to request a reset." },
                    { q: "Can I change my email address?", a: "Email addresses are currently locked to your account. Contact an administrator if you need a change." },
                    { q: "How do I earn XP?", a: "You earn XP by completing lessons, assignments, and quizzes across your enrolled courses." }
                ]
            },
            {
                category: "COURSES",
                items: [
                    { q: "How do I enroll in a course?", a: "Browse the catalog and click 'Enroll'. Some courses may require an Enrollment ID from your teacher." },
                    { q: "Where can I find my course materials?", a: "Navigate to your course dashboard and look under the 'Materials' tab." },
                    { q: "How is my progress calculated?", a: "Your progress is based on the percentage of lessons and assignments completed in the course." }
                ]
            },
            {
                category: "TECHNICAL",
                items: [
                    { q: "Does SmartLMS work offline?", a: "You can access some materials offline if you have installed the PWA app on your device." },
                    { q: "What file types are supported for assignments?", a: "We support PDF, DOCX, ZIP, and common image formats (JPG, PNG)." },
                    { q: "Why can't I access a live class?", a: "Ensure the teacher has started the session and you have a stable internet connection." }
                ]
            }
        ],
        teacher: [
            {
                category: "COURSE MANAGEMENT",
                items: [
                    { q: "How do I create a new course?", a: "Click 'Create Course' in your teacher dashboard and fill in the required details." },
                    { q: "Can I hide a course while building it?", a: "Yes, set the course status to 'Draft' until you are ready to publish it." },
                    { q: "How do I manage enrollments?", a: "You can view and manage students in the 'Students' section of your course dashboard." }
                ]
            },
            {
                category: "GRADING & ASSESSMENTS",
                items: [
                    { q: "How do I grade assignments?", a: "Go to the 'Grading' tab to view pending submissions and provide feedback and scores." },
                    { q: "What are regrade requests?", a: "Students can request a review of their grade if they believe there was an error in assessment." },
                    { q: "How do quizzes work?", a: "Quizzes are automatically graded based on the correct answers you provide during creation." }
                ]
            },
            {
                category: "LIVE INTERACTION",
                items: [
                    { q: "How do I start a live class?", a: "Create a session and click 'Start Meeting' at the scheduled time." }
                ]
            }
        ],
        admin: [
            {
                category: "SYSTEM",
                items: [
                    { q: "How do I manage system maintenance?", a: "Use the 'Maintenance' tab in the admin dashboard to schedule or toggle maintenance mode." },
                    { q: "How do I view system health?", a: "The 'Overview' tab provides real-time health metrics and server status." }
                ]
            },
            {
                category: "USER MANAGEMENT",
                items: [
                    { q: "How do I create teacher accounts?", a: "Go to 'User Management' and use the 'Invite User' or 'Create User' function." },
                    { q: "Can I reactivate a deactivated user?", a: "Yes, find the user in the management list and toggle their 'Active' status." }
                ]
            }
        ]
    },

    showInfoModal(type) {
        const content = document.getElementById('infoModalContent');
        const overlay = document.getElementById('infoOverlay');
        if (!content || !overlay) return;

        let html = '';
        switch (type) {
            case 'about':
                html = `<h2>About SmartLMS</h2>
                        <p>SmartLMS is a secure, next-generation learning platform designed for modern education. We focus on academic integrity, student engagement, and providing educators with the tools they need to succeed in a digital-first world.</p>
                        <p>Our mission is to make education accessible and interactive for everyone, everywhere. We believe in the power of technology to transform learning and empower both students and teachers.</p>`;
                break;
            case 'privacy':
                html = `<h2>Privacy Policy</h2>
                        <p>At SmartLMS, your privacy is our priority. We only collect data necessary to provide you with the best learning experience.</p>
                        <ul>
                            <li><strong>Personal Information:</strong> We store your name, email, and phone number for account management.</li>
                            <li><strong>Learning Data:</strong> We track your progress, grades, and attendance to help you and your teachers.</li>
                            <li><strong>Security Data:</strong> In proctored assessments, we monitor browser activity to ensure academic integrity.</li>
                        </ul>
                        <p>We do not sell your data to third parties.</p>`;
                break;
            case 'terms':
                html = `<h2>Terms of Service</h2>
                        <p>By using SmartLMS, you agree to follow our code of conduct:</p>
                        <ul>
                            <li><strong>Academic Integrity:</strong> Users must not engage in cheating or plagiarism during assessments.</li>
                            <li><strong>Respect:</strong> Users must be respectful in discussions and live classes.</li>
                            <li><strong>Account Security:</strong> You are responsible for maintaining the confidentiality of your password.</li>
                        </ul>`;
                break;
            case 'standards':
                html = `<h2>Teaching Standards</h2>
                        <p>Our platform encourages high teaching standards through:</p>
                        <ul>
                            <li><strong>Clear Objectives:</strong> Every course and lesson should have clearly defined learning outcomes.</li>
                            <li><strong>Active Engagement:</strong> Teachers are encouraged to use live classes and discussions to engage students.</li>
                            <li><strong>Timely Feedback:</strong> Providing constructive feedback on assignments in a timely manner.</li>
                            <li><strong>Integrity Monitoring:</strong> Utilizing our anti-cheat tools to ensure fair assessments for all students.</li>
                        </ul>`;
                break;
        }

        content.innerHTML = html;
        overlay.classList.add('active');
    },

    closeInfoModal() {
        document.getElementById('infoOverlay').classList.remove('active');
    },

    showHelpCenter() {
        const content = document.getElementById('helpCenterContent');
        const overlay = document.getElementById('helpCenterOverlay');
        if (!content || !overlay) return;

        content.innerHTML = `
            <div class="help-center-hero" style="background: var(--bg); padding: 60px 20px; text-align: center;">
                <h1 style="font-size: 2.5rem; margin-bottom: 10px;">Help Center</h1>
                <p class="text-muted">How can we help you today? Please select your role to continue.</p>

                <div class="role-grid" style="max-width: 800px; margin: 40px auto 0; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                    <div class="role-btn" onclick="LandingUI.renderHelpCenter('student')">
                        <div class="icon">🧑‍🎓</div>
                        <span>Student</span>
                    </div>
                    <div class="role-btn" onclick="LandingUI.renderHelpCenter('teacher')">
                        <div class="icon">🧑‍🏫</div>
                        <span>Teacher</span>
                    </div>
                    <div class="role-btn" onclick="LandingUI.renderHelpCenter('admin')">
                        <div class="icon">⚙️</div>
                        <span>Admin</span>
                    </div>
                </div>
            </div>
        `;

        overlay.classList.add('active');
    },

    renderHelpCenter(role) {
        const content = document.getElementById('helpCenterContent');
        const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
        const faqs = this.faqs[role] || [];

        content.innerHTML = `
            <div class="help-center-header" style="background: #fff; padding: 40px 60px; border-bottom: 1px solid #eee;">
                <button class="button secondary tiny w-auto mb-20" onclick="LandingUI.showHelpCenter()">← Back to Role Selection</button>
                <h1 style="font-size: 2.2rem; margin-bottom: 5px;">${roleTitle} Help Center</h1>
                <p class="text-muted">Resources to help you manage your ${role} account and support your journey effectively.</p>
                <div class="search-wrapper mt-30" style="max-width: 600px; position: relative;">
                    <input type="text" placeholder="Search for ${role} tools or guides..." style="padding: 15px 20px; border-radius: 12px; border: 1px solid #ddd; background: #f8fafc;">
                    <span style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #999;">🔍</span>
                </div>
            </div>

            <div class="help-center-body" style="flex: 1; overflow-y: auto; background: #f9fafb; padding: 40px 60px; display: grid; grid-template-columns: 1fr 350px; gap: 40px;">
                <div class="help-main-col">
                    <div class="section-title mb-20" style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem;">
                        <span style="color: var(--warn); font-size: 1.2rem;">🕒</span> Your Recent Requests
                        <span style="margin-left: auto; color: var(--purple); font-size: 0.8rem; cursor: pointer;">REFRESH</span>
                    </div>
                    <div class="card mb-40" style="background: #fff; border: 1px dashed #ddd; padding: 40px; text-align: center; color: #999; border-radius: 15px;">
                        No recent support requests.
                    </div>

                    <div class="section-title mb-20" style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem;">
                        <span style="color: var(--purple); font-size: 1.2rem;">❓</span> Frequently Asked Questions
                    </div>

                    <div class="faq-accordion">
                        ${faqs.map(cat => `
                            <div class="faq-cat-group mb-30">
                                <h4 style="font-size: 0.8rem; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">${cat.category}</h4>
                                ${cat.items.map(item => `
                                    <div class="faq-accordion-item" style="background: #fff; border: 1px solid #eee; border-radius: 12px; margin-bottom: 10px; overflow: hidden;">
                                        <div class="faq-accordion-header" onclick="LandingUI.toggleAccordion(this)" style="padding: 18px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
                                            <span style="font-weight: 600; color: #333;">${item.q}</span>
                                            <span class="icon" style="color: #ccc; transition: transform 0.3s;">⌄</span>
                                        </div>
                                        <div class="faq-accordion-content" style="padding: 0 20px; max-height: 0; overflow: hidden; transition: all 0.3s ease-out; color: #666; line-height: 1.6;">
                                            <div style="padding-bottom: 20px;">${item.a}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="help-sidebar-col">
                    <div class="card" style="background: #111827; color: #fff; padding: 30px; border-radius: 20px; border: none; margin-bottom: 30px;">
                        <h3 style="margin-top: 0; margin-bottom: 5px;">Contact Support</h3>
                        <p style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 20px;">Expected response time: Under 24 hours</p>

                        <label style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 5px; text-transform: uppercase;">Subject</label>
                        <input type="text" placeholder="e.g. Access Issue" style="background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; margin-bottom: 15px;">

                        <label style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 5px; text-transform: uppercase;">Message</label>
                        <textarea rows="4" placeholder="Describe your problem in detail..." style="background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; margin-bottom: 20px;"></textarea>

                        <button class="button" style="width: 100%; gap: 10px;" onclick="LandingUI.mockSubmitSupport()">
                            <span>✈️</span> Send Message
                        </button>
                    </div>

                    <div class="card" style="background: #fff; padding: 30px; border-radius: 20px; border: 1px solid #eee;">
                        <h3 style="margin-top: 0; margin-bottom: 20px; font-size: 1.1rem;">Quick Resources</h3>
                        <div class="quick-link" onclick="LandingUI.showInfoModal('standards')" style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px; cursor: pointer;">
                            <div style="width: 32px; height: 32px; background: #f5f3ff; color: var(--purple); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">📘</div>
                            <span style="font-size: 0.95rem; font-weight: 600; color: #4b5563;">Teaching Standards</span>
                        </div>
                        <div class="quick-link" onclick="LandingUI.showInfoModal('privacy')" style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px; cursor: pointer;">
                            <div style="width: 32px; height: 32px; background: #fff7ed; color: #f97316; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">🛡️</div>
                            <span style="font-size: 0.95rem; font-weight: 600; color: #4b5563;">Privacy Policy</span>
                        </div>
                        <div class="quick-link" style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                            <div style="width: 32px; height: 32px; background: #ecfdf5; color: #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">💬</div>
                            <span style="font-size: 0.95rem; font-weight: 600; color: #4b5563;">Community Forum</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    toggleAccordion(header) {
        const item = header.parentElement;
        const content = item.querySelector('.faq-accordion-content');
        const icon = header.querySelector('.icon');
        const isOpen = item.classList.contains('active');

        // Close all others in this category if desired, but here we just toggle the current one
        if (isOpen) {
            item.classList.remove('active');
            content.style.maxHeight = '0';
            icon.style.transform = 'rotate(0deg)';
            header.style.background = '#fff';
        } else {
            item.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            icon.style.transform = 'rotate(180deg)';
            header.style.background = '#f8fafc';
        }
    },

    mockSubmitSupport() {
        UI.showNotification('Support ticket submitted successfully! We will get back to you shortly.', 'success');
        // Clear inputs in a real scenario
    },

    closeHelpCenter() {
        document.getElementById('helpCenterOverlay').classList.remove('active');
    }
};

window.LandingUI = LandingUI;
