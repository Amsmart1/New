// Supabase Configuration
// Public anon key is safe to expose in client-side code.
const SUPABASE_URL = 'https://hupssocmagotpaoyhezt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cHNzb2NtYWdvdHBhb3loZXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzA2MTAsImV4cCI6MjA5NDQ0NjYxMH0.DiGpIi-yb0YxafLTGPhk1kqH7maD4FtPiC4gvmpYqnA';

// Initialize Supabase client
if (!window.supabase) {
    console.error('Supabase library not loaded. Please check your internet connection or CDN availability.');
    alert('Critical Error: Supabase connection could not be established.');
}
const { createClient } = window.supabase || { createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: () => ({}) }) }) }) }) };
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabaseClient = supabaseClient;

const _stats = {
    totalRequests: 0,
    failedRequests: 0,
    lastRequestTime: 0
};

const _cache = {
    data: {},
    ttl: 30000, // 30 seconds
    async fetch(key, fn) {
        const now = Date.now();
        if (this.data[key] && (now - this.data[key].ts < this.ttl)) {
            return this.data[key].val;
        }
        const val = await fn();
        this.data[key] = { val, ts: now };
        return val;
    },
    invalidate(key) {
        if (key) delete this.data[key];
        else this.data = {};
    }
};

// Supabase Database Operations
class SupabaseDB {
    static async _request(fn) {
        _stats.totalRequests++;
        try {
            const start = performance.now();
            const res = await fn();
            _stats.lastRequestTime = Math.round(performance.now() - start);
            return res;
        } catch (e) {
            _stats.failedRequests++;
            throw e;
        }
    }

    static getStats() {
        const successRate = _stats.totalRequests ? ((_stats.totalRequests - _stats.failedRequests) / _stats.totalRequests * 100).toFixed(1) : 100;
        return { ..._stats, successRate };
    }

    // Generic count operation
    static async getCount(table, filterFn = null, select = '*') {
        return this._request(async () => {
            let query = supabaseClient.from(table).select(select, { count: 'exact', head: true });
            if (filterFn) query = filterFn(query);
            const { count, error } = await query;
            if (error) throw error;
            return count || 0;
        });
    }

    // User operations
    static async getUsers() {
        return _cache.fetch('users', async () => {
            return this._request(async () => {
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('*');
                if (error) throw error;
                return data || [];
            });
        });
    }

    static async getUsersByRole(role) {
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('role', role);
            if (error) throw error;
            return data || [];
        });
    }

    static async getEnrolledStudents(courseIds) {
        if (!courseIds || courseIds.length === 0) return [];
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*, enrollments!inner(*)')
                .in('enrollments.course_id', courseIds);
            if (error) throw error;
            return data || [];
        });
    }

    static async getEnrollmentsByCourses(courseIds) {
        if (!courseIds || courseIds.length === 0) return [];
        const { data, error } = await supabaseClient
            .from('enrollments')
            .select('*, users(*), courses(title)')
            .in('course_id', courseIds);
        if (error) throw error;
        return data || [];
    }

    static async saveUser(user) {
        // Sanitize payload
        const payload = {
            email: user.email,
            full_name: user.full_name,
            phone: user.phone,
            password: user.password,
            role: user.role,
            last_login: user.last_login,
            failed_attempts: user.failed_attempts,
            locked_until: user.locked_until,
            lockouts: user.lockouts,
            flagged: user.flagged,
            reset_request: user.reset_request,
            active: user.active,
            notification_preferences: user.notification_preferences,
            metadata: user.metadata,
            updated_at: new Date().toISOString()
        };
        if (user.created_at) payload.created_at = user.created_at;

        const { data, error } = await supabaseClient
            .from('users')
            .upsert(payload, { onConflict: 'email' })
            .select();
        if (error) throw error;
        _cache.invalidate('users');
        _cache.invalidate(`user_${user.email}`);
        return data?.[0];
    }

    static async updateUserEmail(oldEmail, newEmail, userData) {
        const { data, error } = await supabaseClient
            .from('users')
            .update({ ...userData, email: newEmail })
            .eq('email', oldEmail)
            .select();
        if (error) throw error;
        _cache.invalidate('users');
        _cache.invalidate(`user_${oldEmail}`);
        _cache.invalidate(`user_${newEmail}`);
        return data?.[0];
    }

    static async deleteDiscussion(id) {
        const { error } = await supabaseClient
            .from('discussions')
            .delete()
            .eq('id', id);
        if (error) throw error;
        _cache.invalidate();
    }

    static async getUser(email, bypassCache = false) {
        if (bypassCache) _cache.invalidate(`user_${email}`);
        return _cache.fetch(`user_${email}`, async () => {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('email', email);
            if (error) throw error;
            return data?.[0] || null;
        });
    }

    static async deleteUser(email) {
        const { error } = await supabaseClient
            .from('users')
            .delete()
            .eq('email', email);
        if (error) throw error;
        _cache.invalidate('users');
        _cache.invalidate(`user_${email}`);
    }

    // Assignment operations
    static async getAssignments(teacherEmail = null, courseId = null, courseIds = null) {
        if (courseIds && courseIds.length === 0) return [];
        return this._request(async () => {
            let query = supabaseClient.from('assignments').select('*');
            if (teacherEmail) {
                query = query.eq('teacher_email', teacherEmail);
            }
            if (courseId) {
                query = query.eq('course_id', courseId);
            }
            if (courseIds && courseIds.length > 0) {
                query = query.in('course_id', courseIds);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        });
    }

    static async getEnrolledCourses(studentEmail) {
        return _cache.fetch(`enrolled_courses_${studentEmail}`, async () => {
            const enrollments = await this.getEnrollments(studentEmail);
            const courseIds = enrollments.map(e => e.course_id);
            if (courseIds.length === 0) return [];
            const { data, error } = await supabaseClient
                .from('courses')
                .select('*')
                .in('id', courseIds);
            if (error) throw error;
            return data || [];
        });
    }

    static async getCourse(id) {
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('courses')
                .select('*')
                .eq('id', id);
            if (error) throw error;
            return data?.[0] || null;
        });
    }

    static async getAssignment(id) {
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('assignments')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        });
    }

    static async saveAssignment(assignment) {
        // Sanitize payload to avoid 400 error from extra fields (e.g. from joins)
        const payload = {
            course_id: assignment.course_id,
            title: assignment.title,
            description: assignment.description,
            teacher_email: assignment.teacher_email,
            start_at: assignment.start_at,
            due_date: assignment.due_date,
            points_possible: assignment.points_possible,
            allow_late_submissions: assignment.allow_late_submissions,
            late_penalty_per_day: assignment.late_penalty_per_day,
            allowed_extensions: assignment.allowed_extensions,
            questions: assignment.questions,
            attachments: assignment.attachments,
            status: assignment.status,
            updated_at: new Date().toISOString()
        };
        if (assignment.id) payload.id = assignment.id;
        if (assignment.created_at) payload.created_at = assignment.created_at;

        const { data, error } = await supabaseClient
            .from('assignments')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async deleteAssignment(id) {
        const { error } = await supabaseClient
            .from('assignments')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // Submission operations
    static async getSubmissions(assignmentId = null, studentEmail = null, teacherEmail = null) {
        return this._request(async () => {
            let selectStr = '*, assignments(*)';
            if (teacherEmail) selectStr = '*, assignments!inner(*)';

            let query = supabaseClient.from('submissions').select(selectStr);
            if (assignmentId) query = query.eq('assignment_id', assignmentId);
            if (studentEmail) query = query.eq('student_email', studentEmail);
            if (teacherEmail) query = query.eq('assignments.teacher_email', teacherEmail);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        });
    }

    static async getSubmission(assignmentId, studentEmail) {
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('submissions')
                .select('*')
                .eq('assignment_id', assignmentId)
                .eq('student_email', studentEmail);
            if (error) throw error;
            return data?.[0] || null;
        });
    }

    static async saveSubmission(submission) {
        // Sanitize payload
        const payload = {
            assignment_id: submission.assignment_id,
            student_email: submission.student_email,
            submitted_at: submission.submitted_at,
            answers: submission.answers,
            question_scores: submission.question_scores,
            question_feedback: submission.question_feedback,
            late_penalty_applied: submission.late_penalty_applied,
            attachments: submission.attachments,
            grade: submission.grade,
            final_grade: submission.final_grade,
            feedback: submission.feedback,
            regrade_request: submission.regrade_request,
            graded_at: submission.graded_at,
            status: submission.status,
            updated_at: new Date().toISOString()
        };
        if (submission.id) payload.id = submission.id;

        const { data, error } = await supabaseClient
            .from('submissions')
            .upsert(payload, { onConflict: 'assignment_id,student_email' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async deleteSubmission(assignmentId, studentEmail) {
        const { error } = await supabaseClient
            .from('submissions')
            .delete()
            .eq('assignment_id', assignmentId)
            .eq('student_email', studentEmail);
        if (error) throw error;
    }

    // Enrollment operations
    static async getEnrollments(studentEmail) {
        return _cache.fetch(`enrollments_${studentEmail}`, async () => {
            const { data, error } = await supabaseClient
                .from('enrollments')
                .select('*')
                .eq('student_email', studentEmail);
            if (error) throw error;
            return data || [];
        });
    }

    static async saveEnrollment(enrollment) {
        const payload = {
            course_id: enrollment.course_id,
            student_email: enrollment.student_email,
            enrolled_at: enrollment.enrolled_at,
            progress: enrollment.progress,
            completed: enrollment.completed,
            completed_lessons: enrollment.completed_lessons
        };
        const { data, error } = await supabaseClient
            .from('enrollments')
            .upsert(payload, { onConflict: 'course_id,student_email' })
            .select();
        if (error) throw error;
        _cache.invalidate(`enrollments_${enrollment.student_email}`);
        return data?.[0];
    }

    static async enrollInCourse(courseId, studentEmail, enrollmentId = null) {
        const { error } = await supabaseClient.rpc('enroll_in_course', {
            p_course_id: courseId,
            p_student_email: studentEmail,
            p_enrollment_id: enrollmentId
        });
        if (error) throw error;
        _cache.invalidate(`enrollments_${studentEmail}`);
        _cache.invalidate(`enrolled_courses_${studentEmail}`);
    }

    static async deleteEnrollment(courseId, studentEmail) {
        // Thorough cleanup: Delete all related student history for this course
        try {
            const [assignments, quizzes] = await Promise.all([
                this.getAssignments(null, courseId),
                this.getQuizzes(courseId)
            ]);

            const assignIds = assignments.map(a => a.id);
            const quizIds = quizzes.map(q => q.id);

            // Delete submissions
            if (assignIds.length > 0) {
                await supabaseClient
                    .from('submissions')
                    .delete()
                    .eq('student_email', studentEmail)
                    .in('assignment_id', assignIds);
            }

            // Delete quiz submissions
            if (quizIds.length > 0) {
                await supabaseClient
                    .from('quiz_submissions')
                    .delete()
                    .eq('student_email', studentEmail)
                    .in('quiz_id', quizIds);
            }

            // Delete study sessions
            await supabaseClient
                .from('study_sessions')
                .delete()
                .match({ course_id: courseId, user_email: studentEmail });

            // Delete attendance
            const liveClasses = await this.getLiveClasses(courseId);
            const classIds = liveClasses.map(lc => lc.id);
            if (classIds.length > 0) {
                await supabaseClient
                    .from('attendance')
                    .delete()
                    .eq('student_email', studentEmail)
                    .in('live_class_id', classIds);
            }

            // Delete discussions
            await supabaseClient
                .from('discussions')
                .delete()
                .match({ course_id: courseId, user_email: studentEmail });
        } catch (e) {
            console.warn('History cleanup during unenrollment partially failed:', e);
        }

        const { error } = await supabaseClient
            .from('enrollments')
            .delete()
            .match({ course_id: courseId, student_email: studentEmail });
        if (error) throw error;
        _cache.invalidate(`enrollments_${studentEmail}`);
        _cache.invalidate(`enrolled_courses_${studentEmail}`);
    }

    static async markLessonComplete(courseId, studentEmail, lessonId) {
        const { data: enrollment, error: fetchError } = await supabaseClient
            .from('enrollments')
            .select('completed_lessons')
            .match({ course_id: courseId, student_email: studentEmail })
            .maybeSingle();

        if (fetchError) throw fetchError;

        let completed = enrollment?.completed_lessons || [];
        if (!completed.includes(lessonId)) {
            completed.push(lessonId);
            const { error: updateError } = await supabaseClient
                .from('enrollments')
                .update({ completed_lessons: completed })
                .match({ course_id: courseId, student_email: studentEmail });
            if (updateError) throw updateError;
            _cache.invalidate(`enrollments_${studentEmail}`);
            await this.updateCourseProgress(courseId, studentEmail);
        }
    }

    static async updateCourseProgress(courseId, studentEmail) {
        try {
            const [lessons, courseAssignments, courseQuizzes, submissions, quizSubs] = await Promise.all([
                this.getLessons(courseId),
                this.getAssignments(null, courseId),
                this.getQuizzes(courseId),
                this.getSubmissions(null, studentEmail),
                this.getQuizSubmissions(null, studentEmail)
            ]);

            // Filter for published only as they count towards progress
            const activeAssignments = courseAssignments.filter(a => a.status === 'published');
            const activeQuizzes = courseQuizzes.filter(q => q.status === 'published');

            const totalItems = lessons.length + activeAssignments.length + activeQuizzes.length;
            if (totalItems === 0) return;

            let completedItems = 0;

            // Lessons: Use completed_lessons tracker
            const { data: enrollment } = await supabaseClient
                .from('enrollments')
                .select('completed_lessons')
                .match({ course_id: courseId, student_email: studentEmail })
                .maybeSingle();

            const completedLessonIds = enrollment?.completed_lessons || [];
            completedItems += lessons.filter(l => completedLessonIds.includes(l.id)).length;

            // Assignments
            activeAssignments.forEach(a => {
                if (submissions.some(s => s.assignment_id === a.id && (s.status === 'submitted' || s.status === 'graded'))) {
                    completedItems++;
                }
            });

            // Quizzes
            activeQuizzes.forEach(q => {
                if (quizSubs.some(s => s.quiz_id === q.id && s.status === 'submitted')) {
                    completedItems++;
                }
            });

            const progress = Math.min(100, Math.round((completedItems / totalItems) * 100));

            await supabaseClient
                .from('enrollments')
                .update({ progress: progress, completed: progress === 100 })
                .match({ course_id: courseId, student_email: studentEmail });

            _cache.invalidate(`enrollments_${studentEmail}`);
        } catch (e) {
            console.error('Failed to update progress:', e);
        }
    }

    // Course operations
    static async getCourses(teacherEmail = null, status = null) {
        const cacheKey = `courses_${teacherEmail || 'all'}_${status || 'all'}`;
        return _cache.fetch(cacheKey, async () => {
            let query = supabaseClient.from('courses').select('*');
            if (teacherEmail) {
                query = query.eq('teacher_email', teacherEmail);
            }
            if (status) {
                query = query.eq('status', status);
            }
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        });
    }

    static async saveCourse(course) {
        // Sanitize payload to avoid 400 error from extra fields
        const payload = {
            title: course.title,
            description: course.description,
            teacher_email: course.teacher_email,
            created_by: course.created_by,
            enrollment_id: course.enrollment_id,
            status: course.status,
            metadata: course.metadata,
            updated_at: new Date().toISOString()
        };
        if (course.id) payload.id = course.id;
        if (course.created_at) payload.created_at = course.created_at;

        const { data, error } = await supabaseClient
            .from('courses')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        _cache.invalidate('courses_all');
        if (course.teacher_email) _cache.invalidate(`courses_${course.teacher_email}`);
        return data?.[0];
    }

    static async deleteCourse(id) {
        const { error } = await supabaseClient
            .from('courses')
            .delete()
            .eq('id', id);
        if (error) throw error;
        _cache.invalidate(); // Broad invalidation to be safe
    }

    // Lesson operations
    static async getLessons(courseId) {
        const { data, error } = await supabaseClient
            .from('lessons')
            .select('*')
            .eq('course_id', courseId)
            .order('order_index', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    static async saveLesson(lesson) {
        const payload = {
            course_id: lesson.course_id,
            title: lesson.title,
            content: lesson.content,
            video_url: lesson.video_url,
            order_index: lesson.order_index,
            updated_at: new Date().toISOString()
        };
        if (lesson.id) payload.id = lesson.id;
        if (lesson.created_at) payload.created_at = lesson.created_at;

        const { data, error } = await supabaseClient
            .from('lessons')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async deleteLesson(id) {
        const { error } = await supabaseClient
            .from('lessons')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // Discussion operations
    static async getMaterials(courseId = null, courseIds = null) {
        if (courseIds && courseIds.length === 0) return [];
        let query = supabaseClient.from('materials').select('*');
        if (courseId) query = query.eq('course_id', courseId);
        if (courseIds && courseIds.length > 0) query = query.in('course_id', courseIds);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    static async saveMaterial(material) {
        const payload = {
            course_id: material.course_id,
            teacher_email: material.teacher_email,
            title: material.title,
            description: material.description,
            file_url: material.file_url,
            file_type: material.file_type,
            created_at: material.created_at || new Date().toISOString()
        };
        if (material.id) payload.id = material.id;
        const { data, error } = await supabaseClient
            .from('materials')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async deleteMaterial(id) {
        const { error } = await supabaseClient
            .from('materials')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // Discussion operations
    static async getDiscussions(courseId) {
        const { data, error } = await supabaseClient
            .from('discussions')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    static async saveDiscussion(discussion) {
        const payload = {
            course_id: discussion.course_id,
            user_email: discussion.user_email,
            parent_id: discussion.parent_id,
            title: discussion.title,
            content: discussion.content,
            updated_at: new Date().toISOString()
        };
        if (discussion.id) payload.id = discussion.id;
        if (discussion.created_at) payload.created_at = discussion.created_at;

        const { data, error } = await supabaseClient
            .from('discussions')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    // Quiz operations
    static async getQuizzes(courseId = null, teacherEmail = null, courseIds = null) {
        if (courseIds && courseIds.length === 0) return [];
        const cacheKey = `quizzes_${courseId || 'all'}_${teacherEmail || 'all'}_${courseIds ? courseIds.join(',') : 'none'}`;
        return _cache.fetch(cacheKey, async () => {
            let query = supabaseClient.from('quizzes').select('*');
            if (courseId) query = query.eq('course_id', courseId);
            if (teacherEmail) query = query.eq('teacher_email', teacherEmail);
            if (courseIds && courseIds.length > 0) query = query.in('course_id', courseIds);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        });
    }

    static async getQuiz(id) {
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('quizzes')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        });
    }

    static async saveQuiz(quiz) {
        // Sanitize payload to avoid 400 error from extra fields
        const payload = {
            course_id: quiz.course_id,
            teacher_email: quiz.teacher_email,
            title: quiz.title,
            description: quiz.description,
            time_limit: quiz.time_limit,
            start_at: quiz.start_at,
            end_at: quiz.end_at,
            attempts_allowed: quiz.attempts_allowed,
            passing_score: quiz.passing_score,
            questions: quiz.questions,
            shuffle_questions: quiz.shuffle_questions,
            status: quiz.status,
            updated_at: new Date().toISOString()
        };
        if (quiz.id) payload.id = quiz.id;
        if (quiz.created_at) payload.created_at = quiz.created_at;

        const { data, error } = await supabaseClient
            .from('quizzes')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        _cache.invalidate(); // Quizzes have complex keys, simpler to clear all
        return data?.[0];
    }

    static async deleteQuiz(id) {
        const { error } = await supabaseClient
            .from('quizzes')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    static async getQuizSubmissions(quizId = null, studentEmail = null, teacherEmail = null) {
        let query = supabaseClient.from('quiz_submissions').select('*, quizzes(*)');
        if (quizId) query = query.eq('quiz_id', quizId);
        if (studentEmail) query = query.eq('student_email', studentEmail);
        if (teacherEmail) query = query.eq('quizzes.teacher_email', teacherEmail);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    static async saveQuizSubmission(submission) {
        // Sanitize payload to avoid 400 error from extra fields
        const payload = {
            quiz_id: submission.quiz_id,
            student_email: submission.student_email,
            score: submission.score,
            total_points: submission.total_points,
            answers: submission.answers,
            analytics: submission.analytics,
            status: submission.status,
            time_spent: submission.time_spent,
            started_at: submission.started_at,
            submitted_at: submission.submitted_at
        };
        if (submission.id) payload.id = submission.id;

        const { data, error } = await supabaseClient
            .from('quiz_submissions')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async getQuizSubmissionById(id) {
        return this._request(async () => {
            const { data, error } = await supabaseClient
                .from('quiz_submissions')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            return data;
        });
    }

    static async invokeFunction(name, payload) {
        const { data, error } = await supabaseClient.functions.invoke(name, {
            body: payload
        });
        if (error) throw error;
        return data;
    }

    // Notification operations
    static async createNotification(userEmail, title, message, link = null, type = 'system') {
        const { data, error } = await supabaseClient
            .from('notifications')
            .insert([{ user_email: userEmail, title, message, link, type }])
            .select();
        if (error) throw error;
        _cache.invalidate(`notifications_${userEmail}`);
        return data?.[0];
    }

    static async getNotifications(userEmail) {
        return _cache.fetch(`notifications_${userEmail}`, async () => {
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .eq('user_email', userEmail)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        });
    }

    static async getBroadcasts() {
        return _cache.fetch('broadcasts_active', async () => {
            const { data, error } = await supabaseClient
                .from('broadcasts')
                .select('*')
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        });
    }

    static async deleteExpiredBroadcasts() {
        const { error } = await supabaseClient
            .from('broadcasts')
            .delete()
            .lt('expires_at', new Date().toISOString());
        if (error) throw error;
    }

    static async saveBroadcast(broadcast) {
        const payload = {
            course_id: broadcast.course_id,
            target_role: broadcast.target_role,
            title: broadcast.title,
            message: broadcast.message,
            link: broadcast.link,
            type: broadcast.type,
            expires_at: broadcast.expires_at,
            created_at: broadcast.created_at || new Date().toISOString()
        };
        if (broadcast.id) payload.id = broadcast.id;
        const { data, error } = await supabaseClient
            .from('broadcasts')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        _cache.invalidate('broadcasts_active');
        return data?.[0];
    }

    static async markNotificationsAsRead(userEmail, id = null) {
        const query = supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_email', userEmail);

        if (id) {
            query.eq('id', id);
        } else {
            query.eq('is_read', false);
        }

        const { error } = await query;
        if (error) throw error;
        _cache.invalidate(`notifications_${userEmail}`);
    }

    static async deleteNotifications(userEmail) {
        const { error } = await supabaseClient
            .from('notifications')
            .delete()
            .eq('user_email', userEmail);
        if (error) throw error;
        _cache.invalidate(`notifications_${userEmail}`);
    }

    static async invalidateCache(key = null) {
        _cache.invalidate(key);
    }

    // Certificate operations
    static async issueCertificate(certificate) {
        const payload = {
            course_id: certificate.course_id,
            student_email: certificate.student_email,
            issued_at: certificate.issued_at,
            certificate_url: certificate.certificate_url,
            metadata: certificate.metadata
        };
        if (certificate.id) payload.id = certificate.id;
        const { data, error } = await supabaseClient
            .from('certificates')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async getCertificates(studentEmail) {
        const { data, error } = await supabaseClient
            .from('certificates')
            .select('*, courses(*)')
            .eq('student_email', studentEmail);
        if (error) throw error;
        return data || [];
    }

    // Planner operations
    static async getPlannerItems(email) {
        const { data, error } = await supabaseClient
            .from('planner')
            .select('*')
            .eq('user_email', email)
            .order('due_date', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    static async savePlannerItem(item) {
        const payload = {
            user_email: item.user_email,
            title: item.title,
            description: item.description,
            due_date: item.due_date,
            priority: item.priority,
            completed: item.completed,
            created_at: item.created_at || new Date().toISOString()
        };
        if (item.id) payload.id = item.id;
        const { data, error } = await supabaseClient
            .from('planner')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async deletePlannerItem(id) {
        const { error } = await supabaseClient
            .from('planner')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    // Study session operations
    static async saveStudySession(session) {
        const payload = {
            user_email: session.user_email,
            course_id: session.course_id,
            duration: session.duration,
            started_at: session.started_at,
            ended_at: session.ended_at
        };
        if (session.id) payload.id = session.id;
        const { data, error } = await supabaseClient
            .from('study_sessions')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async getStudySessions(email) {
        const { data, error } = await supabaseClient
            .from('study_sessions')
            .select('*')
            .eq('user_email', email)
            .order('started_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    // Live Class operations
    static async getLiveClasses(courseId = null, teacherEmail = null, courseIds = null) {
        if (courseIds && courseIds.length === 0) return [];
        let query = supabaseClient.from('live_classes').select('*');
        if (courseId) query = query.eq('course_id', courseId);
        if (teacherEmail) query = query.eq('teacher_email', teacherEmail);
        if (courseIds && courseIds.length > 0) query = query.in('course_id', courseIds);
        const { data, error } = await query.order('start_at', { ascending: true });
        if (error) throw error;
        return data || [];
    }

    static async getLiveClass(id) {
        const { data, error } = await supabaseClient
            .from('live_classes')
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async saveLiveClass(liveClass) {
        // Sanitize payload
        const payload = {
            course_id: liveClass.course_id,
            teacher_email: liveClass.teacher_email,
            title: liveClass.title,
            description: liveClass.description,
            start_at: liveClass.start_at,
            end_at: liveClass.end_at,
            room_name: liveClass.room_name,
            meeting_url: liveClass.meeting_url,
            recording_url: liveClass.recording_url,
            recurring_config: liveClass.recurring_config,
            metadata: liveClass.metadata,
            status: liveClass.status,
            actual_end_at: liveClass.actual_end_at
        };
        if (liveClass.id) payload.id = liveClass.id;

        const { data, error } = await supabaseClient
            .from('live_classes')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async deleteLiveClass(id) {
        const { error } = await supabaseClient
            .from('live_classes')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    static async saveAttendance(attendance) {
        const payload = {
            live_class_id: attendance.live_class_id,
            student_email: attendance.student_email,
            join_time: attendance.join_time,
            leave_time: attendance.leave_time,
            duration: attendance.duration,
            is_present: attendance.is_present,
            created_at: attendance.created_at || new Date().toISOString()
        };
        if (attendance.id) payload.id = attendance.id;
        const { data, error } = await supabaseClient
            .from('attendance')
            .upsert(payload, { onConflict: 'live_class_id,student_email' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async getAttendance(classId, studentEmail = null) {
        let query = supabaseClient.from('attendance').select('*').eq('live_class_id', classId);
        if (studentEmail) query = query.eq('student_email', studentEmail);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    // Maintenance operations
    static async getMaintenance(bypassCache = false) {
        if (bypassCache) _cache.invalidate('maintenance');
        return _cache.fetch('maintenance', async () => {
            return this._request(async () => {
                const { data, error } = await supabaseClient
                    .from('maintenance')
                    .select('*')
                    .limit(1)
                    .maybeSingle();
                if (error && error.code !== 'PGRST116') throw error;
                return data || { enabled: false, schedules: [] };
            });
        });
    }

    static async saveMaintenance(maintenance) {
        const payload = {
            enabled: maintenance.enabled,
            manual_until: maintenance.manual_until,
            message: maintenance.message,
            schedules: maintenance.schedules,
            updated_at: new Date().toISOString()
        };
        if (maintenance.id) payload.id = maintenance.id;
        if (maintenance.created_at) payload.created_at = maintenance.created_at;

        const { data, error } = await supabaseClient
            .from('maintenance')
            .upsert(payload, { onConflict: 'id' })
            .select();
        if (error) throw error;
        _cache.invalidate('maintenance');
        return data?.[0];
    }

    // Invite operations
    static async saveInvite(invite) {
        const payload = {
            token: invite.token,
            email: invite.email,
            role: invite.role,
            expires_at: invite.expires_at,
            used_at: invite.used_at,
            created_by: invite.created_by,
            created_at: invite.created_at || new Date().toISOString()
        };
        if (invite.id) payload.id = invite.id;
        const { data, error } = await supabaseClient
            .from('invites')
            .upsert(payload, { onConflict: 'token' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async getInvite(token) {
        const { data, error } = await supabaseClient
            .from('invites')
            .select('*')
            .eq('token', token)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    static async markInviteUsed(token) {
        const { error } = await supabaseClient
            .from('invites')
            .update({ used_at: new Date().toISOString() })
            .eq('token', token);
        if (error) throw error;
    }

    // Storage operations
    static async uploadFile(bucket, path, file) {
        const { data, error } = await supabaseClient.storage
            .from(bucket)
            .upload(path, file, { upsert: true });
        if (error) throw error;
        return data;
    }

    static async getPublicUrl(bucket, path) {
        const { data } = supabaseClient.storage
            .from(bucket)
            .getPublicUrl(path);
        return data.publicUrl;
    }
}

// Session management
class SessionManager {
    static async setCurrentUser(user) {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
    }

    static async getCurrentUser() {
        const raw = sessionStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    }

    static async clearCurrentUser() {
        sessionStorage.removeItem('currentUser');
    }

    static getSessionId() {
        let sid = sessionStorage.getItem('sessionId');
        if (!sid) {
            sid = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
            sessionStorage.setItem('sessionId', sid);
        }
        return sid;
    }
}
