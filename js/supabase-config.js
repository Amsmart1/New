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
        const { data, error } = await supabaseClient
            .from('users')
            .upsert(user, { onConflict: 'email' })
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
        const { data, error } = await supabaseClient
            .from('assignments')
            .upsert(assignment, { onConflict: 'id' })
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
            let query = supabaseClient.from('submissions').select('*, assignments(*)');
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
        const { assignments, ...payload } = submission;
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
        const { data, error } = await supabaseClient
            .from('enrollments')
            .upsert(enrollment, { onConflict: 'course_id,student_email' })
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
        const { data, error } = await supabaseClient
            .from('courses')
            .upsert(course, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('lessons')
            .upsert(lesson, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('materials')
            .upsert(material, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('discussions')
            .upsert(discussion, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('quizzes')
            .upsert(quiz, { onConflict: 'id' })
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
        const { quizzes, ...payload } = submission;
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
        return data?.[0];
    }

    static async getNotifications(userEmail) {
        const { data, error } = await supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_email', userEmail)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    static async getBroadcasts() {
        const { data, error } = await supabaseClient
            .from('broadcasts')
            .select('*')
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    }

    static async deleteExpiredBroadcasts() {
        const { error } = await supabaseClient
            .from('broadcasts')
            .delete()
            .lt('expires_at', new Date().toISOString());
        if (error) throw error;
    }

    static async saveBroadcast(broadcast) {
        const { data, error } = await supabaseClient
            .from('broadcasts')
            .upsert(broadcast, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data?.[0];
    }

    static async markNotificationsAsRead(userEmail) {
        const { error } = await supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('user_email', userEmail)
            .eq('is_read', false);
        if (error) throw error;
    }

    // Certificate operations
    static async issueCertificate(certificate) {
        const { data, error } = await supabaseClient
            .from('certificates')
            .upsert(certificate, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('planner')
            .upsert(item, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('study_sessions')
            .upsert(session, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('live_classes')
            .upsert(liveClass, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('attendance')
            .upsert(attendance, { onConflict: 'id' })
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
        const { data, error } = await supabaseClient
            .from('maintenance')
            .upsert(maintenance, { onConflict: 'id' })
            .select();
        if (error) throw error;
        _cache.invalidate('maintenance');
        return data?.[0];
    }

    // Invite operations
    static async saveInvite(invite) {
        const { data, error } = await supabaseClient
            .from('invites')
            .upsert(invite, { onConflict: 'token' })
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
