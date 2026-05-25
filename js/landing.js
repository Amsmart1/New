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

    showContactUs() {
        const content = document.getElementById('infoModalContent');
        const overlay = document.getElementById('infoOverlay');
        if (!content || !overlay) return;

        content.innerHTML = `
            <div class="text-center">
                <div style="font-size: 3rem; margin-bottom: 1.5rem;">📞</div>
                <h2>Contact Us</h2>
                <p class="text-muted mb-30">Get in touch with our team for any business inquiries or urgent matters.</p>

                <div class="card" style="text-align: left; background: #f8fafc; padding: 25px; border-radius: 15px; border: 1px solid #e2e8f0;">
                    <div class="mb-20" style="display: flex; align-items: center; gap: 15px;">
                        <div style="background: var(--p); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📧</div>
                        <div>
                            <div class="tiny bold" style="color: var(--p); text-transform: uppercase;">Email Address</div>
                            <div style="font-weight: 600;">eduquizlms@gmail.com</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="background: var(--ok); color: #fff; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">📞</div>
                        <div>
                            <div class="tiny bold" style="color: var(--ok); text-transform: uppercase;">Phone Number</div>
                            <div style="font-weight: 600;">+233 50 596 5310</div>
                        </div>
                    </div>
                </div>

                <p class="tiny text-muted mt-20">Our team is available Monday to Friday, 9 AM - 5 PM GMT.</p>
                <button class="button primary mt-20 w-auto" onclick="LandingUI.closeInfoModal()">Close</button>
            </div>
        `;
        overlay.classList.add('active');
    },

    showHelpCenter() {
        const content = document.getElementById('helpCenterContent');
        const overlay = document.getElementById('helpCenterOverlay');
        if (!content || !overlay) return;

        content.innerHTML = `
            <div id="helpCenterHero" class="help-center-hero" style="background: var(--bg); padding: 60px 20px; text-align: center; transition: all 0.4s ease;">
                <h1 style="font-size: 2.5rem; margin-bottom: 10px;">Help Center</h1>
                <p class="text-muted">How can we help you today? Please select your role to continue.</p>

                <div class="role-grid" style="max-width: 900px; margin: 40px auto 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px;">
                    <div class="flippable-card" id="card-student" onclick="LandingUI.selectRole('student')">
                        <div class="flippable-card-inner">
                            <div class="flippable-card-front">
                                <div class="icon" style="font-size: 3.5rem; margin-bottom: 1rem;">🧑‍🎓</div>
                                <span style="font-size: 1.25rem; font-weight: 700;">Student</span>
                            </div>
                            <div class="flippable-card-back">
                                <p style="font-weight: 600; color: var(--p);">Access learning resources & support</p>
                                <button class="button primary tiny mt-10">Select</button>
                            </div>
                        </div>
                    </div>
                    <div class="flippable-card" id="card-teacher" onclick="LandingUI.selectRole('teacher')">
                        <div class="flippable-card-inner">
                            <div class="flippable-card-front">
                                <div class="icon" style="font-size: 3.5rem; margin-bottom: 1rem;">🧑‍🏫</div>
                                <span style="font-size: 1.25rem; font-weight: 700;">Teacher</span>
                            </div>
                            <div class="flippable-card-back">
                                <p style="font-weight: 600; color: var(--p);">Manage courses & students</p>
                                <button class="button primary tiny mt-10">Select</button>
                            </div>
                        </div>
                    </div>
                    <div class="flippable-card" id="card-admin" onclick="LandingUI.selectRole('admin')">
                        <div class="flippable-card-inner">
                            <div class="flippable-card-front">
                                <div class="icon" style="font-size: 3.5rem; margin-bottom: 1rem;">⚙️</div>
                                <span style="font-size: 1.25rem; font-weight: 700;">Admin</span>
                            </div>
                            <div class="flippable-card-back">
                                <p style="font-weight: 600; color: var(--p);">System configuration & control</p>
                                <button class="button primary tiny mt-10">Select</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div id="helpCenterBodyContainer" style="flex: 1; overflow: hidden; display: none;"></div>
        `;

        overlay.classList.add('active');

        // Add flip listeners
        document.querySelectorAll('.flippable-card').forEach(card => {
            card.addEventListener('mouseenter', () => card.classList.add('flipped'));
            card.addEventListener('mouseleave', () => card.classList.remove('flipped'));
        });
    },

    selectRole(role) {
        const hero = document.getElementById('helpCenterHero');
        hero.classList.add('minimized');

        // Highlight selected role card visually by adding a class or just shrinking others
        document.querySelectorAll('.flippable-card').forEach(c => {
            if (c.id !== `card-${role}`) {
                c.style.opacity = '0.5';
                c.style.pointerEvents = 'none';
            } else {
                c.style.opacity = '1';
                c.style.transform = 'scale(0.9)';
            }
        });

        this.renderHelpCenter(role);
    },

    async renderHelpCenter(role) {
        const bodyContainer = document.getElementById('helpCenterBodyContainer');
        const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);
        const faqs = this.faqs[role] || [];

        bodyContainer.style.display = 'block';

        const user = await SessionManager.getCurrentUser();
        const userEmail = user?.email || null;

        bodyContainer.innerHTML = `
            <div class="help-center-body" style="height: 100%; overflow-y: auto; background: #f9fafb; padding: 40px 60px; display: grid; grid-template-columns: 1fr 350px; gap: 40px;">
                <div class="help-main-col">
                    <div class="section-title mb-20" style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem;">
                        <span style="color: var(--warn); font-size: 1.2rem;">🕒</span> Your Recent Requests
                        <span style="margin-left: auto; color: var(--purple); font-size: 0.8rem; cursor: pointer;" onclick="LandingUI.refreshRequests('${userEmail}')">REFRESH</span>
                    </div>
                    <div id="recentRequestsList" class="card mb-40" style="background: #fff; border: 1px dashed #ddd; padding: 40px; text-align: center; color: #999; border-radius: 15px;">
                        ${userEmail ? 'Loading your requests...' : 'Sign in to see your requests.'}
                    </div>

                    <div class="section-title mb-20" style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem;">
                        <span style="color: var(--purple); font-size: 1.2rem;">❓</span> Frequently Asked Questions
                    </div>

                    <div class="faq-accordion" style="max-height: 600px; overflow-y: auto; padding-right: 10px;">
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

                <div class="help-sidebar-col" style="max-height: 800px; overflow-y: auto; padding-right: 5px;">
                    <div class="card" style="background: #111827; color: #fff; padding: 30px; border-radius: 20px; border: none; margin-bottom: 30px;">
                        <h3 style="margin-top: 0; margin-bottom: 5px;">Contact Support</h3>
                        <p style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 20px;">Expected response time: Under 24 hours</p>

                        <label style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 5px; text-transform: uppercase;">Your Email</label>
                        <input type="email" id="supportEmail" value="${userEmail || ''}" placeholder="email@example.com" style="background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; margin-bottom: 15px;" ${userEmail ? 'readonly' : ''}>

                        <label style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 5px; text-transform: uppercase;">Subject</label>
                        <input type="text" id="supportSubject" placeholder="e.g. Access Issue" style="background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; margin-bottom: 15px;">

                        <label style="color: #9ca3af; font-size: 0.75rem; margin-bottom: 5px; text-transform: uppercase;">Message</label>
                        <textarea id="supportMessage" rows="4" placeholder="Describe your problem in detail..." style="background: #1f2937; border: 1px solid #374151; color: #fff; border-radius: 8px; margin-bottom: 20px;"></textarea>

                        <button class="button" style="width: 100%; gap: 10px;" onclick="LandingUI.submitSupport('${role}')">
                            <span>✈️</span> Send Message
                        </button>
                    </div>

                    <div class="card" style="padding: 25px; border-radius: 20px;">
                         <h4 style="margin-top: 0;">Quick Resources</h4>
                         <p class="tiny text-muted">Direct links to important documents.</p>
                         <ul style="list-style: none; padding: 0; margin-top: 15px;">
                            <li class="mb-10"><a href="#" onclick="LandingUI.showInfoModal('standards')" style="color: var(--p); font-weight: 600; text-decoration: none;">📘 Teaching Standards</a></li>
                            <li class="mb-10"><a href="#" onclick="LandingUI.showInfoModal('privacy')" style="color: var(--p); font-weight: 600; text-decoration: none;">🛡️ Privacy Policy</a></li>
                            <li><a href="#" onclick="LandingUI.showInfoModal('terms')" style="color: var(--p); font-weight: 600; text-decoration: none;">📜 Terms of Service</a></li>
                         </ul>
                    </div>
                </div>
            </div>
        `;

        if (userEmail) {
            this.refreshRequests(userEmail);
        }
    },

    async refreshRequests(email) {
        const list = document.getElementById('recentRequestsList');
        if (!list || !email) return;

        try {
            const { data: tickets } = await SupabaseDB.getSupportTickets(email);
            if (!tickets || tickets.length === 0) {
                list.innerHTML = 'No recent support requests.';
                list.style.borderStyle = 'dashed';
                return;
            }

            list.style.borderStyle = 'solid';
            list.style.textAlign = 'left';
            list.style.padding = '15px';
            list.innerHTML = tickets.map(t => `
                <div style="border-bottom: 1px solid #eee; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="bold" style="font-size: 0.9rem;">${t.subject}</div>
                        <div class="tiny text-muted">${new Date(t.created_at).toLocaleDateString()}</div>
                    </div>
                    <span class="badge-${t.status === 'open' ? 'warn' : 'active'}" style="font-size: 0.7rem; padding: 2px 8px;">${t.status.toUpperCase()}</span>
                </div>
            `).join('');
        } catch (e) {
            console.error('Failed to fetch tickets:', e);
            list.innerHTML = 'Error loading requests.';
        }
    },

    async submitSupport(role) {
        const email = document.getElementById('supportEmail').value;
        const subject = document.getElementById('supportSubject').value;
        const message = document.getElementById('supportMessage').value;

        if (!email || !subject || !message) {
            UI.showNotification('Please fill in all fields.', 'error');
            return;
        }

        try {
            await SupabaseDB.saveSupportTicket({
                user_email: email,
                role: role,
                subject: subject,
                message: message
            });
            UI.showNotification('Support ticket submitted successfully! We will get back to you shortly.', 'success');

            // Clear inputs
            document.getElementById('supportSubject').value = '';
            document.getElementById('supportMessage').value = '';

            // Refresh list
            this.refreshRequests(email);
        } catch (e) {
            console.error('Failed to submit ticket:', e);
            UI.showNotification('Failed to submit ticket. Please try again.', 'error');
        }
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
