
import {
  resolveCsrfTokenForRequest,
  setCachedCsrfToken,
  clearCachedCsrfToken,
} from '../utils/csrfClientStore.js';

const BUILD_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

let cachedBaseUrl = null;

/** Exported for school logo and other assets that must target the API host (split SPA/API). */
export async function getApiBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  if (!isProd) {
    cachedBaseUrl = BUILD_API_URL;
    return cachedBaseUrl;
  }
  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (res.ok) {
      const config = await res.json();
      if (config && config.apiUrl) {
        cachedBaseUrl = config.apiUrl.replace(/\/+$/, '');
        if (!cachedBaseUrl.endsWith('/api')) cachedBaseUrl += '/api';
        return cachedBaseUrl;
      }
    }
  } catch (_) { }
  cachedBaseUrl = BUILD_API_URL;
  return cachedBaseUrl;
}

/** SessionStorage key for split SPA/API (TENANT_BEARER_AUTH on server). */
const TENANT_BEARER_KEY = 'myschool_tenant_bearer';

export function getTenantBearerToken() {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(TENANT_BEARER_KEY);
  } catch {
    return null;
  }
}

export function setTenantBearerToken(token) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (token) sessionStorage.setItem(TENANT_BEARER_KEY, token);
    else sessionStorage.removeItem(TENANT_BEARER_KEY);
  } catch {
    /* private / disabled storage */
  }
}

export function clearTenantBearerToken() {
  setTenantBearerToken(null);
}

// Request deduplication: track ongoing requests to prevent duplicate simultaneous calls
const pendingRequests = new Map();

/**
 * Tenant API only: whether 401 should run logout + auth:sessionExpired (full app redirect).
 * Skip /auth/login (wrong password is a normal 401) and /auth/me (session probe; AuthBootstrap clears Redux softly).
 */
function shouldGlobalSessionExpireOn401(requestUrl) {
  let pathname = '';
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    // Relative URLs (e.g. dev proxy: `/api/...`) — strip query so /api/auth/me?... still matches.
    pathname = String(requestUrl).split('?')[0];
  }
  if (pathname === '/api/auth/me' || pathname.endsWith('/api/auth/me')) return false;
  if (pathname === '/api/auth/login' || pathname.endsWith('/api/auth/login')) return false;
  return true;
}

class ApiService {
  async makeRequest(endpoint, options = {}) {
    const base = await getApiBaseUrl();
    const url = `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    // Create a unique key for this request (endpoint + method + body hash)
    const method = (options.method || 'GET').toUpperCase();
    const bodyKey = options.body
      ? (typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)).substring(0, 120)
      : '';
    const requestKey = `${method}:${endpoint}:${bodyKey}`;

    // Only dedupe safe reads. Never dedupe POST/PUT/PATCH/DELETE — reusing a pending
    // mutation promise can mask failures or return the wrong response; refetch-after-create
    // must not accidentally reuse a pre-mutation GET.
    const dedupeReadsOnly = method === 'GET' || method === 'HEAD';
    if (dedupeReadsOnly && pendingRequests.has(requestKey)) {
      if (isDev) console.log('Deduplicating request:', url, '- reusing pending request');
      return pendingRequests.get(requestKey);
    }

    if (isDev) console.log('Making API request to:', url);

    // Create the request promise
    const requestPromise = this._executeRequest(url, options)
      .finally(() => {
        // Remove from pending requests when done (success or error)
        pendingRequests.delete(requestKey);
      });

    // Store the pending request
    pendingRequests.set(requestKey, requestPromise);

    return requestPromise;
  }

  async _executeRequest(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    const headers = {
      'Content-Type': options.isMultipart ? undefined : 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (headers['Content-Type'] === undefined) {
      delete headers['Content-Type'];
    }

    const existingAuth = headers['Authorization'] || headers['authorization'];
    if (!existingAuth) {
      const tb = getTenantBearerToken();
      if (tb) headers['Authorization'] = `Bearer ${tb}`;
    }

    // Cookie + optional Bearer (split-host); CSRF for unsafe when cookie mode:
    // - auth session is stored in httpOnly cookies (not accessible to JS)
    // - CSRF uses double-submit cookie (readable) + header for unsafe methods
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (unsafe) {
      const csrf = resolveCsrfTokenForRequest();
      if (csrf) headers['X-XSRF-TOKEN'] = csrf;
    }

    try {
      const { headers: _omit, ...restOptions } = options;
      const response = await fetch(url, {
        method,
        headers,
        mode: 'cors',
        credentials: 'include',
        ...restOptions,
        // Required when API returns ETag/304 or intermediaries cache; 304 is not response.ok and breaks JSON auth flows
        cache: options.cache !== undefined ? options.cache : 'no-store',
      });

      if (isDev) {
        console.log('Response status:', response.status);
      }

      if (!response.ok) {
        if (response.status === 401 && shouldGlobalSessionExpireOn401(url)) {
          this.logout().catch(() => {});
          window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
        }
        // Handle rate limiting (429) specifically
        if (response.status === 429) {
          const errorText = await response.text();
          if (isDev) console.error('Rate limit exceeded:', errorText);
          // Don't throw immediately - wait a bit and let deduplication handle retries
          throw new Error(`Rate limit exceeded. Please wait a moment before trying again.`);
        }
        const errorText = await response.text();
        if (isDev) console.error('Response error text:', errorText);
        let parsed = null;
        try {
          parsed = errorText ? JSON.parse(errorText) : null;
        } catch {
          parsed = null;
        }
        const apiMessage =
          parsed && typeof parsed.message === 'string' && parsed.message.trim()
            ? parsed.message.trim()
            : errorText;
        const err = new Error(`HTTP error! status: ${response.status}, message: ${apiMessage}`);
        err.status = response.status;
        if (parsed && typeof parsed.code === 'string') {
          err.code = parsed.code;
        }
        if (parsed && parsed.data !== undefined) {
          err.data = parsed.data;
        }
        throw err;
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        throw new Error('Server returned empty response. Check that the API URL is correct and CORS is configured for this site.');
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (_) {
        throw new Error('Server returned invalid JSON. Check API URL and backend logs.');
      }
      if (isDev) console.log('Response data:', data);
      return data;
    } catch (error) {
      if (isDev) {
        console.error('API request failed:', error);
      }
      throw error;
    }
  }

  // Academic Years
  async getAcademicYears() {
    return this.makeRequest('/academic-years');
  }

  async getAcademicYearById(id) {
    return this.makeRequest(`/academic-years/${id}`);
  }

  async getAcademicYearsManage() {
    return this.makeRequest('/academic-years/manage');
  }

  async createAcademicYear(data) {
    return this.makeRequest('/academic-years', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAcademicYearSummary(id) {
    return this.makeRequest(`/academic-years/${id}/summary`);
  }

  async updateAcademicYear(id, data) {
    return this.makeRequest(`/academic-years/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAcademicYear(id, password) {
    return this.makeRequest(`/academic-years/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    });
  }

  // Classes
  async getClasses() {
    return this.makeRequest('/classes');
  }

  async getClassById(id) {
    return this.makeRequest(`/classes/${id}`);
  }

  async getClassesByAcademicYear(academicYearId) {
    return this.makeRequest(`/classes/academic-year/${academicYearId}`);
  }

  async updateClass(id, classData) {
    return this.makeRequest(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(classData)
    });
  }
  async createClass(classData) {
    return this.makeRequest('/classes', { method: 'POST', body: JSON.stringify(classData) });
  }
  async deleteClass(id) {
    return this.makeRequest(`/classes/${id}`, { method: 'DELETE' });
  }

  // Sections
  async getSections(params = {}) {
    const query = new URLSearchParams();
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      query.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = query.toString();
    return this.makeRequest(`/sections${qs ? `?${qs}` : ''}`);
  }

  async getSectionById(id) {
    return this.makeRequest(`/sections/${id}`);
  }

  async getSectionsByClass(classId) {
    return this.makeRequest(`/sections/class/${classId}`);
  }

  async updateSection(id, sectionData) {
    return this.makeRequest(`/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sectionData)
    });
  }
  async createSection(data) {
    return this.makeRequest('/sections', { method: 'POST', body: JSON.stringify(data) });
  }
  async deleteSection(id) {
    return this.makeRequest(`/sections/${id}`, { method: 'DELETE' });
  }

  // Class Rooms
  async getClassRooms() {
    return this.makeRequest('/class-rooms');
  }

  async getClassRoomById(id) {
    return this.makeRequest(`/class-rooms/${id}`);
  }

  async createClassRoom(data) {
    return this.makeRequest('/class-rooms', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateClassRoom(id, data) {
    return this.makeRequest(`/class-rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteClassRoom(id) {
    return this.makeRequest(`/class-rooms/${id}`, {
      method: 'DELETE'
    });
  }

  // Class schedules (timetable: class + subject + time_slot)
  async getClassSchedules() {
    return this.makeRequest('/class-schedules');
  }
  async getClassSchedulesScoped(params = {}) {
    const search = new URLSearchParams();
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    const qs = search.toString();
    return this.makeRequest(`/class-schedules${qs ? `?${qs}` : ''}`);
  }

  /** Scoped class+section timetable (includes slot metadata). */
  async getTimetableForClass(params = {}) {
    const search = new URLSearchParams();
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    const qs = search.toString();
    return this.makeRequest(`/timetable/class${qs ? `?${qs}` : ''}`);
  }

  async getTimetableForTeacher(teacherId, params = {}) {
    const search = new URLSearchParams();
    search.set('teacher_id', String(teacherId));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    const qs = search.toString();
    return this.makeRequest(`/timetable/teacher?${qs}`);
  }

  async getClassScheduleById(id) {
    return this.makeRequest(`/class-schedules/${id}`);
  }

  async createClassSchedule(data) {
    return this.makeRequest('/class-schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  async updateClassSchedule(id, data) {
    return this.makeRequest(`/class-schedules/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  async deleteClassSchedule(id) {
    return this.makeRequest(`/class-schedules/${id}`, { method: 'DELETE' });
  }

  // Schedules (time_slots / schedule table - ID, Type, Start Time, End Time, Status)
  async getSchedules() {
    return this.makeRequest('/schedules');
  }
  async createSchedule(data) {
    return this.makeRequest('/schedules', { method: 'POST', body: JSON.stringify(data) });
  }

  async getScheduleById(id) {
    return this.makeRequest(`/schedules/${id}`);
  }

  async updateSchedule(id, scheduleData) {
    return this.makeRequest(`/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(scheduleData)
    });
  }
  async deleteSchedule(id) {
    return this.makeRequest(`/schedules/${id}`, { method: 'DELETE' });
  }

  // Students
  async getStudents(academicYearId = null) {
    const qs = academicYearId != null ? `?academic_year_id=${academicYearId}` : '';
    return this.makeRequest(`/students${qs}`);
  }

  async getTeacherStudents(academicYearId = null) {
    const qs = academicYearId != null ? `?academic_year_id=${academicYearId}` : '';
    return this.makeRequest(`/students/teacher/students${qs}`);
  }

  async createStudent(studentData) {
    return this.makeRequest('/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  }

  async updateStudent(id, studentData) {
    return this.makeRequest(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData)
    });
  }

  async deleteStudent(id) {
    return this.makeRequest(`/students/${id}`, {
      method: 'DELETE'
    });
  }

  async promoteStudents(payload) {
    return this.makeRequest('/students/promote', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getStudentPromotions(limit = 200, studentId = null) {
    const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 200;
    const params = new URLSearchParams();
    params.set('limit', String(safeLimit));
    if (studentId != null && Number.isFinite(Number(studentId))) {
      params.set('student_id', String(studentId));
    }
    return this.makeRequest(`/students/promotions?${params.toString()}`);
  }

  async leaveStudents(payload) {
    return this.makeRequest('/students/leave', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async rejoinStudent(payload) {
    return this.makeRequest('/students/rejoin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLeavingStudents(limit = 200) {
    const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 200;
    return this.makeRequest(`/students/leaving?limit=${safeLimit}`);
  }

  async getStudentRejoins(limit = 200) {
    const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 200;
    return this.makeRequest(`/students/rejoins?limit=${safeLimit}`);
  }

  async getStudentById(id) {
    return this.makeRequest(`/students/${id}`);
  }

  /**
   * Duplicate check for admission number (form UX). excludeId = student id when editing.
   */
  async checkAdmissionNumberUnique(admissionNumber, excludeId = null) {
    const params = new URLSearchParams();
    params.set('admissionNumber', String(admissionNumber ?? '').trim());
    if (excludeId != null && String(excludeId).trim() !== '') {
      params.set('excludeId', String(excludeId));
    }
    return this.makeRequest(`/students/check-admission-number?${params.toString()}`);
  }

  /** Typeahead: parent_persons + legacy parents/guardians tables (mobile/email/name). */
  async searchParentPersons(q, limit = 20, role = 'any') {
    const params = new URLSearchParams();
    params.set('q', String(q ?? '').trim());
    params.set('limit', String(limit));
    if (role && role !== 'any') {
      params.set('role', String(role));
    }
    return this.makeRequest(`/parent-persons/search?${params.toString()}`);
  }

  async getParentPersonById(id) {
    return this.makeRequest(`/parent-persons/${id}`);
  }

  async downloadStudentBonafide(studentId) {
    const base = await getApiBaseUrl();
    const url = `${base}/students/${studentId}/bonafide`.replace(/([^:]\/)\/+/g, '$1');
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/pdf',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to download bonafide (${response.status}): ${errorText}`);
    }
    return await response.blob();
  }

  async fetchStudentForBonafide(payload) {
    return this.makeRequest('/bonafide/fetch-student', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async downloadBonafideByStudentId(studentId) {
    return this.downloadStudentBonafide(studentId);
  }

  async getStudentLoginDetails(studentId) {
    return this.makeRequest(`/students/${studentId}/login-details`);
  }

  async getStudentAttendance(studentId) {
    return this.makeRequest(`/students/${studentId}/attendance`);
  }

  async getStudentExamResults(studentId) {
    return this.makeRequest(`/students/${studentId}/exam-results`);
  }

  async getStudentsLatestExamSummary(studentIds) {
    return this.makeRequest('/students/exam-results/summary', {
      method: 'POST',
      body: JSON.stringify({ student_ids: Array.isArray(studentIds) ? studentIds : [] }),
    });
  }

  async listExams(query = {}) {
    const search = new URLSearchParams();
    if (query.academic_year_id != null && query.academic_year_id !== '') {
      search.set('academic_year_id', String(query.academic_year_id));
    }
    const qs = search.toString();
    return this.makeRequest(`/exams${qs ? `?${qs}` : ''}`);
  }

  async createExam(payload) {
    return this.makeRequest('/exams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteExam(examId) {
    return this.makeRequest(`/exams/${examId}`, {
      method: 'DELETE',
    });
  }

  async getExamManageContext(examId) {
    return this.makeRequest(`/exams/${examId}/manage-context`);
  }

  async listExamSubjectsQuery(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exams/subjects/list?${search.toString()}`);
  }

  async getExamSubjectOptions(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exams/subjects/options?${search.toString()}`);
  }

  async getExamSubjectsContext(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exam-subjects/context?${search.toString()}`);
  }

  async saveExamSubjects(payload) {
    return this.makeRequest('/exams/subjects/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async saveExamSubjectSetup(payload) {
    return this.makeRequest('/exam-subjects/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async viewExamSchedule(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exam-subjects/schedule?${search.toString()}`);
  }

  async viewExamResults(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exam-subjects/results?${search.toString()}`);
  }

  async getExamTopPerformers(params = {}) {
    const search = new URLSearchParams();
    if (params.exam_id != null && params.exam_id !== '') search.set('exam_id', String(params.exam_id));
    if (params.class_id != null && params.class_id !== '' && params.class_id !== 'all') search.set('class_id', String(params.class_id));
    if (params.section_id != null && params.section_id !== '' && params.section_id !== 'all') search.set('section_id', String(params.section_id));
    if (params.top != null && params.top !== '') search.set('top', String(params.top));
    return this.makeRequest(`/exam-subjects/top-performers?${search.toString()}`);
  }

  async listSelfExams(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exam-subjects/self-exams?${search.toString()}`);
  }

  async getExamMarksContext(params = {}) {
    const search = new URLSearchParams(params);
    return this.makeRequest(`/exam-subjects/marks-context?${search.toString()}`);
  }

  async getExamGradeScale() {
    return this.makeRequest('/exam-subjects/grade-scale');
  }

  async createExamGradeScale(payload) {
    return this.makeRequest('/exam-subjects/grade-scale', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateExamGradeScale(id, payload) {
    return this.makeRequest(`/exam-subjects/grade-scale/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteExamGradeScale(id) {
    return this.makeRequest(`/exam-subjects/grade-scale/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
  }

  async saveExamMarks(payload) {
    return this.makeRequest('/exam-subjects/marks-save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getGradeReport(params = {}) {
    const search = new URLSearchParams();
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    if (params.examId != null) search.set('exam_id', String(params.examId));
    const qs = search.toString();
    return this.makeRequest(`/students/reports/grade${qs ? `?${qs}` : ''}`);
  }

  async getAttendanceReport(params = {}) {
    const search = new URLSearchParams();
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    if (params.month) search.set('month', String(params.month));
    const qs = search.toString();
    return this.makeRequest(`/students/reports/attendance${qs ? `?${qs}` : ''}`);
  }

  async getAttendanceMarkingRoster(entityType, params = {}) {
    const search = new URLSearchParams();
    if (params.date) search.set('date', String(params.date));
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    if (params.departmentId != null) search.set('department_id', String(params.departmentId));
    if (params.designationId != null) search.set('designation_id', String(params.designationId));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    const qs = search.toString();
    return this.makeRequest(`/attendance/marking/${entityType}${qs ? `?${qs}` : ''}`);
  }

  async getHolidays(params = {}) {
    const search = new URLSearchParams();
    if (params.startDate) search.set('start_date', String(params.startDate));
    if (params.endDate) search.set('end_date', String(params.endDate));
    if (params.month != null) search.set('month', String(params.month));
    if (params.year != null) search.set('year', String(params.year));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    const qs = search.toString();
    return this.makeRequest(`/holidays${qs ? `?${qs}` : ''}`);
  }

  async getHolidayById(id) {
    return this.makeRequest(`/holidays/${id}`);
  }

  async createHoliday(payload) {
    return this.makeRequest('/holidays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateHoliday(id, payload) {
    return this.makeRequest(`/holidays/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteHoliday(id) {
    return this.makeRequest(`/holidays/${id}`, {
      method: 'DELETE',
    });
  }

  async getEnquiries(params = {}) {
    const search = new URLSearchParams();
    if (params.academic_year_id != null) search.set('academic_year_id', String(params.academic_year_id));
    if (params.status) search.set('status', String(params.status));
    if (params.search) search.set('search', String(params.search));
    if (params.enquiry_date) search.set('enquiry_date', String(params.enquiry_date));
    if (params.from_date) search.set('from_date', String(params.from_date));
    if (params.to_date) search.set('to_date', String(params.to_date));
    if (params.month) search.set('month', String(params.month));
    if (params.added_by) search.set('added_by', String(params.added_by));
    const qs = search.toString();
    return this.makeRequest(`/enquiries${qs ? `?${qs}` : ''}`);
  }

  async createEnquiry(payload) {
    return this.makeRequest('/enquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async saveAttendance(payload) {
    return this.makeRequest('/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateAttendance(payload) {
    return this.makeRequest('/attendance', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getEntityAttendanceReport(entityType, params = {}) {
    const search = new URLSearchParams();
    if (params.month) search.set('month', String(params.month));
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    if (params.departmentId != null) search.set('department_id', String(params.departmentId));
    if (params.designationId != null) search.set('designation_id', String(params.designationId));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    const qs = search.toString();
    return this.makeRequest(`/attendance/reports/${entityType}${qs ? `?${qs}` : ''}`);
  }

  async getEntityAttendanceDayWise(entityType, params = {}) {
    const search = new URLSearchParams();
    if (params.date) search.set('date', String(params.date));
    if (params.classId != null) search.set('class_id', String(params.classId));
    if (params.sectionId != null) search.set('section_id', String(params.sectionId));
    if (params.departmentId != null) search.set('department_id', String(params.departmentId));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    const qs = search.toString();
    return this.makeRequest(`/attendance/day-wise/${entityType}${qs ? `?${qs}` : ''}`);
  }

  async getMyAttendance(params = {}) {
    const search = new URLSearchParams();
    if (params.days != null) search.set('days', String(params.days));
    if (params.academicYearId != null) search.set('academic_year_id', String(params.academicYearId));
    const qs = search.toString();
    return this.makeRequest(`/attendance/me${qs ? `?${qs}` : ''}`);
  }

  async getCurrentStudent() {
    return this.makeRequest('/students/me');
  }

  async getStudentsByClass(classId) {
    return this.makeRequest(`/students/class/${classId}`);
  }

  // Blood Groups
  async getBloodGroups() {
    return this.makeRequest('/blood-groups');
  }

  async getBloodGroupById(id) {
    return this.makeRequest(`/blood-groups/${id}`);
  }

  // Religions
  async getReligions(options = {}) {
    const search = new URLSearchParams();
    if (options.includeInactive) search.set('include_inactive', '1');
    const qs = search.toString();
    return this.makeRequest(`/religions${qs ? `?${qs}` : ''}`);
  }

  async getReligionById(id) {
    return this.makeRequest(`/religions/${id}`);
  }

  async createReligion(payload) {
    return this.makeRequest('/religions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateReligion(id, payload) {
    return this.makeRequest(`/religions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async toggleReligionStatus(id) {
    return this.makeRequest(`/religions/${id}/toggle-status`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
  }

  async deleteReligion(id) {
    return this.makeRequest(`/religions/${id}`, {
      method: 'DELETE',
    });
  }

  // Casts
  async getCasts() {
    return this.makeRequest('/casts');
  }

  async getCastById(id) {
    return this.makeRequest(`/casts/${id}`);
  }

  // Mother Tongues
  async getMotherTongues() {
    return this.makeRequest('/mother-tongues');
  }

  async getMotherTongueById(id) {
    return this.makeRequest(`/mother-tongues/${id}`);
  }

  // Houses
  async getHouses() {
    return this.makeRequest('/houses');
  }

  async getHouseById(id) {
    return this.makeRequest(`/houses/${id}`);
  }

  // Parents
  async getParents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/parents${qs ? `?${qs}` : ''}`);
  }

  async getMyParents() {
    return this.makeRequest('/parents/me');
  }

  async getParentById(id) {
    return this.makeRequest(`/parents/${id}`);
  }

  async getParentByStudentId(studentId) {
    return this.makeRequest(`/parents/student/${studentId}`);
  }

  async createParent(parentData) {
    return this.makeRequest('/parents', {
      method: 'POST',
      body: JSON.stringify(parentData)
    });
  }

  async updateParent(id, parentData) {
    return this.makeRequest(`/parents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(parentData)
    });
  }

  /** Typeahead: min 2 chars on server; debounce in UI */
  async searchStudentsForParent(q) {
    const qs = new URLSearchParams();
    qs.set('q', String(q ?? ''));
    return this.makeRequest(`/students/search?${qs.toString()}`);
  }

  async uploadParentProfileImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.makeRequest('/parents/profile-image', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  /** Creates parent user (role parent) + optional guardian (father) link */
  async createParentWithChild(payload) {
    return this.makeRequest('/parents/create-with-child', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Guardians
  async getGuardianByStudentId(studentId) {
    return this.makeRequest(`/guardians/student/${studentId}`);
  }

  async getGuardians(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/guardians${qs ? `?${qs}` : ''}`);
  }

  async getCurrentGuardian() {
    return this.makeRequest('/guardians/me');
  }

  async getGuardianById(id) {
    return this.makeRequest(`/guardians/${id}`);
  }

  async createGuardian(guardianData) {
    return this.makeRequest('/guardians', {
      method: 'POST',
      body: JSON.stringify(guardianData)
    });
  }

  async updateGuardian(id, guardianData) {
    return this.makeRequest(`/guardians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(guardianData)
    });
  }

  // Teachers
  async getTeachers() {
    return this.makeRequest('/teachers');
  }

  async getCurrentTeacher() {
    return this.makeRequest('/teachers/me');
  }

  async getTeacherById(id, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null && params.academicYearId !== '') {
      searchParams.set('academic_year_id', String(params.academicYearId));
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/teachers/${id}${qs ? `?${qs}` : ''}`);
  }

  async getTeachersByClass(classId) {
    return this.makeRequest(`/teachers/class/${classId}`);
  }

  async getTeacherRoutine(teacherId, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/teachers/${teacherId}/routine${qs ? `?${qs}` : ''}`);
  }

  async getTeacherClassAttendance(teacherId, params = {}) {
    const searchParams = new URLSearchParams();
    if (params.days != null) searchParams.set('days', params.days);
    if (params.offset != null) searchParams.set('offset', params.offset);
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/teachers/${teacherId}/class-attendance${qs ? `?${qs}` : ''}`);
  }

  async updateTeacher(id, teacherData) {
    return this.makeRequest(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(teacherData)
    });
  }

  async createTeacher(teacherData) {
    return this.makeRequest('/teachers', {
      method: 'POST',
      body: JSON.stringify(teacherData)
    });
  }

  /** @param {{ teacherId?: number|string, classId?: number|string, academicYearId?: number|string }} [params] */
  async getTeacherAssignments(params = {}) {
    const q = new URLSearchParams();
    if (params.teacherId != null && params.teacherId !== '') q.set('teacherId', String(params.teacherId));
    if (params.classId != null && params.classId !== '') q.set('classId', String(params.classId));
    if (params.academicYearId != null && params.academicYearId !== '') q.set('academicYearId', String(params.academicYearId));
    const qs = q.toString();
    return this.makeRequest(`/teacher-assignments${qs ? `?${qs}` : ''}`);
  }

  async getTeacherAssignmentClassMeta(classId) {
    return this.makeRequest(`/teacher-assignments/class/${classId}/meta`);
  }

  async createTeacherAssignment(body) {
    return this.makeRequest('/teacher-assignments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateTeacherAssignment(id, body) {
    return this.makeRequest(`/teacher-assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteTeacherAssignment(id) {
    return this.makeRequest(`/teacher-assignments/${id}`, { method: 'DELETE' });
  }

  /**
   * Upload teacher PDFs (multipart). Do not set Content-Type — browser sets boundary.
   * @param {number|string} teacherId
   * @param {FormData} formData fields: resume, joining_letter (optional each)
   */
  async uploadTeacherDocuments(teacherId, formData) {
    const base = await getApiBaseUrl();
    const url = `${base}/teachers/${teacherId}/documents`;
    const headers = { Accept: 'application/json' };
    const tb = getTenantBearerToken();
    if (tb) headers['Authorization'] = `Bearer ${tb}`;
    const csrf = resolveCsrfTokenForRequest();
    if (csrf) headers['X-XSRF-TOKEN'] = csrf;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData,
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 401 && shouldGlobalSessionExpireOn401(url)) {
        this.logout().catch(() => {});
        window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      }
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error('Server returned empty response.');
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error('Server returned invalid JSON.');
    }
    return data;
  }

  /**
   * @param {'resume' | 'joining_letter'} docType
   */
  async fetchTeacherDocumentBlob(teacherId, docType) {
    const base = await getApiBaseUrl();
    const pathSeg = docType === 'joining_letter' ? 'joining-letter' : 'resume';
    const url = `${base}/teachers/${teacherId}/documents/${pathSeg}`;
    const headers = { Accept: 'application/pdf' };
    const tb = getTenantBearerToken();
    if (tb) headers['Authorization'] = `Bearer ${tb}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers,
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 401 && shouldGlobalSessionExpireOn401(url)) {
        this.logout().catch(() => {});
        window.dispatchEvent(new CustomEvent('auth:sessionExpired'));
      }
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    return response.blob();
  }

  // Staff
  async getStaff() {
    return this.makeRequest('/staff');
  }

  async getStaffById(id) {
    return this.makeRequest(`/staff/${id}`);
  }

  async createStaff(data) {
    return this.makeRequest('/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateStaff(id, data) {
    return this.makeRequest(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStaff(id) {
    return this.makeRequest(`/staff/${id}`, {
      method: 'DELETE',
    });
  }

  // Departments
  async getDepartments() {
    return this.makeRequest('/departments');
  }

  async getDepartmentById(id) {
    return this.makeRequest(`/departments/${id}`);
  }

  async updateDepartment(id, departmentData) {
    return this.makeRequest(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(departmentData),
    });
  }

  async createDepartment(departmentData) {
    return this.makeRequest('/departments', {
      method: 'POST',
      body: JSON.stringify(departmentData),
    });
  }

  async deleteDepartment(id) {
    return this.makeRequest(`/departments/${id}`, {
      method: 'DELETE',
    });
  }

  // Designations
  async getDesignations() {
    return this.makeRequest('/designations');
  }

  async getDesignationById(id) {
    return this.makeRequest(`/designations/${id}`);
  }

  async updateDesignation(id, designationData) {
    return this.makeRequest(`/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(designationData),
    });
  }

  // Users
  async getUsers() {
    return this.makeRequest('/users');
  }

  async getUsersByRole(roleId) {
    return this.makeRequest(`/users?role_id=${roleId}`);
  }

  async getUserById(id) {
    return this.makeRequest(`/users/${id}`);
  }

  async getDeleteAccountRequests() {
    return this.makeRequest('/users/delete-account-requests');
  }

  /**
   * Real-time uniqueness for mobile / email (optional excludeId for edit).
   * @param {{ mobile?: string, email?: string, excludeId?: number|null }} params
   */
  async checkUserUnique(params = {}) {
    const sp = new URLSearchParams();
    if (params.mobile != null && String(params.mobile).trim() !== '') {
      sp.set('mobile', String(params.mobile).trim());
    }
    if (params.email != null && String(params.email).trim() !== '') {
      sp.set('email', String(params.email).trim());
    }
    if (params.excludeId != null && String(params.excludeId).trim() !== '') {
      sp.set('excludeId', String(params.excludeId));
    }
    const qs = sp.toString();
    return this.makeRequest(`/users/check-unique${qs ? `?${qs}` : ''}`);
  }

  // User Roles
  async getUserRoles() {
    return this.makeRequest('/user-roles');
  }

  async getUserRoleById(id) {
    return this.makeRequest(`/user-roles/${id}`);
  }

  async createUserRole(payload) {
    return this.makeRequest('/user-roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUserRole(id, payload) {
    return this.makeRequest(`/user-roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteUserRole(id) {
    return this.makeRequest(`/user-roles/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard stats (optional academicYearId for Headmaster/Teacher year filter)
  async getDashboardStats(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    if (params.attendanceScope === 'all_time') {
      searchParams.set('attendance_scope', 'all_time');
    } else if (params.attendanceDate != null && params.attendanceDate !== '') {
      searchParams.set('attendance_date', params.attendanceDate);
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/stats${qs ? `?${qs}` : ''}`);
  }

  async getDashboardUpcomingEvents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/upcoming-events${qs ? `?${qs}` : ''}`);
  }

  async getDashboardClassRoutine(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/class-routine${qs ? `?${qs}` : ''}`);
  }

  async getDashboardBestPerformers(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/best-performers${qs ? `?${qs}` : ''}`);
  }

  async getDashboardStarStudents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    if (params.className != null && String(params.className).trim() !== '' && String(params.className) !== 'All Classes') {
      searchParams.set('class_name', String(params.className).trim());
    }
    if (params.sectionName != null && String(params.sectionName).trim() !== '' && String(params.sectionName) !== 'All Sections') {
      searchParams.set('section_name', String(params.sectionName).trim());
    }
    if (params.timeRange != null && String(params.timeRange).trim() !== '' && String(params.timeRange) !== 'All Time') {
      searchParams.set('time_range', String(params.timeRange).trim());
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/star-students${qs ? `?${qs}` : ''}`);
  }

  async getDashboardPerformanceSummary(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    if (params.classId != null) searchParams.set('class_id', params.classId);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/performance-summary${qs ? `?${qs}` : ''}`);
  }

  async getDashboardMergedUpcomingEvents(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/merged-upcoming-events${qs ? `?${qs}` : ''}`);
  }

  async getDashboardStudentActivity(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/student-activity${qs ? `?${qs}` : ''}`);
  }

  async getDashboardTopSubjects(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    if (params.classId != null) searchParams.set('class_id', params.classId);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/top-subjects${qs ? `?${qs}` : ''}`);
  }

  async getDashboardRecentActivity(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/recent-activity${qs ? `?${qs}` : ''}`);
  }

  async getDashboardNoticeBoard(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/notice-board${qs ? `?${qs}` : ''}`);
  }

  async getDashboardFeeStats(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    if (params.feePeriod != null && params.feePeriod !== '' && params.feePeriod !== 'all') {
      searchParams.set('fee_period', params.feePeriod);
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/fee-stats${qs ? `?${qs}` : ''}`);
  }

  async getDashboardFinanceSummary(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    if (params.feePeriod != null && params.feePeriod !== '' && params.feePeriod !== 'all') {
      searchParams.set('fee_period', params.feePeriod);
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/dashboard/finance-summary${qs ? `?${qs}` : ''}`);
  }

  // Fees (optional academicYearId for year filter)
  async getFeeCollectionsList(params = {}) {
    const searchParams = new URLSearchParams();
    const academicYear =
      params.academicYearId ?? params.academic_year_id ?? params.academicYear ?? null;
    if (academicYear != null && academicYear !== '') {
      searchParams.set('academic_year_id', String(academicYear));
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/fees/collections${qs ? `?${qs}` : ''}`);
  }

  async getStudentFees(studentId) {
    return this.makeRequest(`/fees/student/${studentId}`);
  }

  async getFeeStructures() {
    return this.makeRequest('/fees/structures');
  }

  async createFeeCollection(data) {
    return this.makeRequest('/fees/collect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Fees Groups
  async getFeesGroups(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/fees-groups${qs ? `?${qs}` : ''}`);
  }
  async createFeesGroup(data) {
    return this.makeRequest('/fees-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateFeesGroup(id, data) {
    return this.makeRequest(`/fees-groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deleteFeesGroup(id) {
    return this.makeRequest(`/fees-groups/${id}`, {
      method: 'DELETE',
    });
  }

  // Fees Types
  async getFeesTypes(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/fees-types${qs ? `?${qs}` : ''}`);
  }
  async createFeesType(data) {
    return this.makeRequest('/fees-types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateFeesType(id, data) {
    return this.makeRequest(`/fees-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deleteFeesType(id) {
    return this.makeRequest(`/fees-types/${id}`, {
      method: 'DELETE',
    });
  }

  // Fees Master
  async getFeesMaster(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/fees-master${qs ? `?${qs}` : ''}`);
  }
  async createFeesMaster(data) {
    return this.makeRequest('/fees-master', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateFeesMaster(id, data) {
    return this.makeRequest(`/fees-master/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async deleteFeesMaster(id) {
    return this.makeRequest(`/fees-master/${id}`, {
      method: 'DELETE',
    });
  }

  // Fees Assign
  async getFeesAssignments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/fees-assign${qs ? `?${qs}` : ''}`);
  }
  async assignFees(data) {
    return this.makeRequest('/fees-assign/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async deleteFeesAssignment(id) {
    return this.makeRequest(`/fees-assign/${id}`, {
      method: 'DELETE',
    });
  }
  async getFeeCollectionsList(params = {}) {
    const academic_year_id = params.academic_year_id || params.academicYearId;
    const searchParams = new URLSearchParams();
    if (academic_year_id) searchParams.set('academic_year_id', academic_year_id);
    const qs = searchParams.toString();
    return this.makeRequest(`/fees-collect/list${qs ? `?${qs}` : ''}`);
  }

  // Fees Collect (Enterprise)
  async collectFeesEnterprise(data) {
    return this.makeRequest('/fees-collect/collect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async getStudentFeeDetailedStatus(studentId, academicYearId) {
    return this.makeRequest(`/fees-collect/student/${studentId}/${academicYearId}`);
  }
  async getPaymentHistoryDetailed(studentId, academicYearId) {
    return this.makeRequest(`/fees-collect/history/${studentId}/${academicYearId}`);
  }

  // Notice Board
  async getNoticeBoard(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    const qs = searchParams.toString();
    return this.makeRequest(`/notice-board${qs ? `?${qs}` : ''}`);
  }

  async getNoticeById(id) {
    return this.makeRequest(`/notice-board/${id}`);
  }

  async createNotice(data) {
    return this.makeRequest('/notice-board', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateNotice(id, data) {
    return this.makeRequest(`/notice-board/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteNotice(id) {
    return this.makeRequest(`/notice-board/${id}`, {
      method: 'DELETE'
    });
  }

  async getLeaveTypes() {
    return this.makeRequest('/leave-applications/leave-types');
  }

  async getLeaveApplications(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.page != null) searchParams.set('page', params.page);
    if (params.page_size != null) searchParams.set('page_size', params.page_size);
    if (params.student_id != null) searchParams.set('student_id', params.student_id);
    if (params.staff_id != null) searchParams.set('staff_id', params.staff_id);
    if (params.class_id != null) searchParams.set('class_id', params.class_id);
    if (params.section_id != null) searchParams.set('section_id', params.section_id);
    if (params.department_id != null) searchParams.set('department_id', params.department_id);
    if (params.designation_id != null) searchParams.set('designation_id', params.designation_id);
    if (params.leave_type_id != null) searchParams.set('leave_type_id', params.leave_type_id);
    if (params.applicant_type != null && params.applicant_type !== '') searchParams.set('applicant_type', params.applicant_type);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.status != null && params.status !== '') searchParams.set('status', params.status);
    if (params.sort_by != null && params.sort_by !== '') searchParams.set('sort_by', params.sort_by);
    if (params.sort_order != null && params.sort_order !== '') searchParams.set('sort_order', params.sort_order);
    if (params.leave_from != null && params.leave_from !== '') searchParams.set('leave_from', params.leave_from);
    if (params.leave_to != null && params.leave_to !== '') searchParams.set('leave_to', params.leave_to);
    if (params.pending_only === true || params.pending_only === 1 || params.pending_only === '1') {
      searchParams.set('pending_only', '1');
    }
    // Bust client-side GET dedupe after mutations (see makeRequest pendingRequests).
    if (params._refresh != null && params._refresh !== '') {
      searchParams.set('_refresh', String(params._refresh));
    }
    const qs = searchParams.toString();
    return this.makeRequest(`/leave-applications${qs ? `?${qs}` : ''}`);
  }

  async createLeaveApplication(data) {
    return this.makeRequest('/leave-applications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateLeaveApplicationStatus(id, status, options = {}) {
    return this.makeRequest(`/leave-applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        ...(options.rejection_reason ? { rejection_reason: options.rejection_reason } : {}),
      })
    });
  }

  async cancelLeaveApplication(id) {
    return this.makeRequest(`/leave-applications/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getMyLeaveApplications(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    const qs = searchParams.toString();
    return this.makeRequest(`/leave-applications/me${qs ? `?${qs}` : ''}`);
  }

  async getParentChildrenLeaves(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    if (params.student_id != null) searchParams.set('student_id', params.student_id);
    const qs = searchParams.toString();
    return this.makeRequest(`/leave-applications/parent-children${qs ? `?${qs}` : ''}`);
  }

  async getGuardianWardLeaves(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.limit != null) searchParams.set('limit', params.limit);
    const qs = searchParams.toString();
    return this.makeRequest(`/leave-applications/guardian-wards${qs ? `?${qs}` : ''}`);
  }

  // Transport
  async getTransportRoutes(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.pickup_point_id && params.pickup_point_id !== 'all') searchParams.set('pickup_point_id', params.pickup_point_id);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    
    const qs = searchParams.toString();
    return this.makeRequest(`/transport/routes${qs ? `?${qs}` : ''}`);
  }

  async getTransportRouteById(id) {
    return this.makeRequest(`/transport/routes/${id}`);
  }

  async createTransportRoute(routeData) {
    return this.makeRequest('/transport/routes', {
      method: 'POST',
      body: JSON.stringify(routeData)
    });
  }

  async updateTransportRoute(id, routeData) {
    return this.makeRequest(`/transport/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(routeData)
    });
  }

  async deleteTransportRoute(id) {
    return this.makeRequest(`/transport/routes/${id}`, {
      method: 'DELETE'
    });
  }

  async getTransportPickupPoints(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.route_id) searchParams.set('route_id', params.route_id);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    
    const qs = searchParams.toString();
    return this.makeRequest(`/transport/pickup-points${qs ? `?${qs}` : ''}`);
  }

  async createTransportPickupPoint(pickupData) {
    return this.makeRequest('/transport/pickup-points', {
      method: 'POST',
      body: JSON.stringify(pickupData)
    });
  }

  async updateTransportPickupPoint(id, pickupData) {
    return this.makeRequest(`/transport/pickup-points/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pickupData)
    });
  }

  async deleteTransportPickupPoint(id) {
    return this.makeRequest(`/transport/pickup-points/${id}`, {
      method: 'DELETE'
    });
  }

  async getTransportVehicles(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.route_id) searchParams.set('route_id', params.route_id);
    if (params.pickup_point_id) searchParams.set('pickup_point_id', params.pickup_point_id);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    
    const qs = searchParams.toString();
    return this.makeRequest(`/transport/vehicles${qs ? `?${qs}` : ''}`);
  }

  async createTransportVehicle(vehicleData) {
    return this.makeRequest('/transport/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData)
    });
  }

  async updateTransportVehicle(id, vehicleData) {
    return this.makeRequest(`/transport/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData)
    });
  }

  async deleteTransportVehicle(id) {
    return this.makeRequest(`/transport/vehicles/${id}`, {
      method: 'DELETE'
    });
  }

  async getTransportDrivers(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.role && params.role !== 'all') searchParams.set('role', params.role);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.status) searchParams.set('status', params.status);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    
    const qs = searchParams.toString();
    return this.makeRequest(`/transport/drivers${qs ? `?${qs}` : ''}`);
  }

  async createTransportDriver(driverData) {
    return this.makeRequest('/transport/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData)
    });
  }

  async updateTransportDriver(id, driverData) {
    return this.makeRequest(`/transport/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(driverData)
    });
  }

  async deleteTransportDriver(id) {
    return this.makeRequest(`/transport/drivers/${id}`, {
      method: 'DELETE'
    });
  }

  async deleteTransportAssignment(vehicleId) {
    return this.makeRequest(`/transport/assignments/${vehicleId}`, {
      method: 'DELETE'
    });
  }

  async getTransportAssignments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.status) searchParams.set('status', params.status);
    if (params.route_id && params.route_id !== 'all') searchParams.set('route_id', params.route_id);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const qs = searchParams.toString();
    return this.makeRequest(`/transport/assignments${qs ? `?${qs}` : ''}`);
  }

  async createTransportAssignment(assignmentData) {
    return this.makeRequest('/transport/assignments', {
      method: 'POST',
      body: JSON.stringify(assignmentData)
    });
  }

  async updateTransportAssignment(id, assignmentData) {
    return this.makeRequest(`/transport/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assignmentData)
    });
  }

  async getTransportFees(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.pickup_point_id && params.pickup_point_id !== 'all') searchParams.set('pickup_point_id', params.pickup_point_id);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    return this.makeRequest(`/transport/fees${qs ? `?${qs}` : ''}`);
  }

  async createTransportFee(feeData) {
    return this.makeRequest('/transport/fees', {
      method: 'POST',
      body: JSON.stringify(feeData)
    });
  }

  async updateTransportFee(id, feeData) {
    return this.makeRequest(`/transport/fees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(feeData)
    });
  }

  async deleteTransportFee(id) {
    return this.makeRequest(`/transport/fees/${id}`, {
      method: 'DELETE'
    });
  }

  async getTransportAllocations(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page);
    if (params.limit) searchParams.set('limit', params.limit);
    if (params.search) searchParams.set('search', params.search);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.user_type && params.user_type !== 'all') searchParams.set('user_type', params.user_type);
    if (params.vehicle_id && params.vehicle_id !== 'all') searchParams.set('vehicle_id', params.vehicle_id);
    if (params.sortField) searchParams.set('sortField', params.sortField);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    return this.makeRequest(`/transport/allocations${qs ? `?${qs}` : ''}`);
  }

  async createTransportAllocation(payload) {
    return this.makeRequest('/transport/allocations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateTransportAllocation(id, payload) {
    return this.makeRequest(`/transport/allocations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async deleteTransportAllocation(id) {
    return this.makeRequest(`/transport/allocations/${id}`, {
      method: 'DELETE'
    });
  }

  async getTransportPickupPointById(id) {
    return this.makeRequest(`/transport/pickup-points/${id}`);
  }

  async getTransportVehicleById(id) {
    return this.makeRequest(`/transport/vehicles/${id}`);
  }

  async getTransportDriverById(id) {
    return this.makeRequest(`/transport/drivers/${id}`);
  }

  // Driver Portal (self-scoped)
  async getDriverPortalMe() {
    return this.makeRequest('/driver-portal/me');
  }

  // Subjects
  async getSubjects(params = {}) {
    const query = new URLSearchParams();
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      query.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = query.toString();
    return this.makeRequest(`/subjects${qs ? `?${qs}` : ''}`);
  }

  async getSubjectById(id) {
    return this.makeRequest(`/subjects/${id}`);
  }

  async getSubjectsByClass(classId) {
    return this.makeRequest(`/subjects/class/${classId}`);
  }

  async updateSubject(id, subjectData) {
    return this.makeRequest(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(subjectData),
    });
  }
  async createSubject(subjectData) {
    return this.makeRequest('/subjects', { method: 'POST', body: JSON.stringify(subjectData) });
  }
  async deleteSubject(id) {
    return this.makeRequest(`/subjects/${id}`, { method: 'DELETE' });
  }

  // Hostels
  async getHostels(params = {}) {
    const search = new URLSearchParams();
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      search.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = search.toString();
    return this.makeRequest(`/hostels${qs ? `?${qs}` : ''}`);
  }

  async getHostelById(id) {
    return this.makeRequest(`/hostels/${id}`);
  }

  async createHostel(data) {
    return this.makeRequest('/hostels', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateHostel(id, data) {
    return this.makeRequest(`/hostels/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteHostel(id) {
    return this.makeRequest(`/hostels/${id}`, { method: 'DELETE' });
  }

  // Hostel Rooms
  async getHostelRooms(params = {}) {
    const search = new URLSearchParams();
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      search.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = search.toString();
    return this.makeRequest(`/hostel-rooms${qs ? `?${qs}` : ''}`);
  }

  async getHostelRoomById(id) {
    return this.makeRequest(`/hostel-rooms/${id}`);
  }

  async createHostelRoom(roomData) {
    return this.makeRequest('/hostel-rooms', {
      method: 'POST',
      body: JSON.stringify(roomData),
    });
  }

  async updateHostelRoom(id, roomData) {
    return this.makeRequest(`/hostel-rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roomData),
    });
  }

  async deleteHostelRoom(id) {
    return this.makeRequest(`/hostel-rooms/${id}`, { method: 'DELETE' });
  }

  // Room Types
  async getRoomTypes() {
    return this.makeRequest('/room-types');
  }

  async getRoomTypeById(id) {
    return this.makeRequest(`/room-types/${id}`);
  }

  async createRoomType(data) {
    return this.makeRequest('/room-types', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateRoomType(id, data) {
    return this.makeRequest(`/room-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteRoomType(id) {
    return this.makeRequest(`/room-types/${id}`, { method: 'DELETE' });
  }

  // Health check
  async getHealthStatus() {
    return this.makeRequest('/health');
  }

  // Auth
  async login(instituteNumber, username, password) {
    const data = await this.makeRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ instituteNumber, username, password }),
    });
    const token = data?.data?.csrfToken;
    if (token) setCachedCsrfToken(token);
    const access = data?.data?.accessToken;
    if (access) setTenantBearerToken(access);
    else clearTenantBearerToken();
    return data;
  }

  /** Load CSRF into memory when the cookie exists on the API host but JS cannot read it (cross-origin). */
  async ensureCsrfToken() {
    const base = await getApiBaseUrl();
    const url = `${base}/auth/csrf-token`.replace(/([^:]\/)\/+/g, '$1');
    try {
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        mode: 'cors',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      if (!res.ok || !text) return;
      const data = JSON.parse(text);
      const token = data?.data?.csrfToken;
      if (token) setCachedCsrfToken(token);
    } catch {
      // ignore
    }
  }

  async getMe() {
    return this.makeRequest('/auth/me');
  }

  async updateMe(payload) {
    return this.makeRequest('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async uploadMyProfileAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'users/profile');
    return this.makeRequest('/storage/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  async changePassword(currentPassword, newPassword, confirmPassword) {
    return this.makeRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  async logout() {
    try {
      return await this.makeRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } finally {
      clearCachedCsrfToken();
      clearTenantBearerToken();
    }
  }

  // Chats
  async getChats() {
    return this.makeRequest('/chats');
  }

  async getConversations() {
    return this.makeRequest('/chats/conversations');
  }

  async getChatById(id) {
    return this.makeRequest(`/chats/${id}`);
  }

  async getChatMessages(recipientId) {
    return this.makeRequest(`/chats/messages/${recipientId}`);
  }

  async getSharedMedia(recipientId, type) {
    const qs = type ? `?type=${type}` : '';
    return this.makeRequest(`/chats/shared-media/${recipientId}${qs}`);
  }

  async createChat(data) {
    return this.makeRequest('/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChat(id, data) {
    return this.makeRequest(`/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateChatConversationPin(recipientId, isPinned) {
    return this.makeRequest(`/chats/conversation/${recipientId}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ is_pinned: isPinned }),
    });
  }

  async deleteConversation(recipientId) {
    return this.makeRequest(`/chats/conversation/${recipientId}`, {
      method: 'DELETE',
    });
  }

  async muteConversation(recipientId, isMuted, mutedUntil) {
    return this.makeRequest(`/chats/conversation/${recipientId}/mute`, {
      method: 'PUT',
      body: JSON.stringify({ is_muted: isMuted, muted_until: mutedUntil }),
    });
  }

  async clearConversation(recipientId) {
    return this.makeRequest(`/chats/conversation/${recipientId}/clear`, {
      method: 'PUT',
    });
  }

  async reportUser(recipientId, reason) {
    return this.makeRequest(`/chats/conversation/${recipientId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async blockUser(recipientId) {
    return this.makeRequest(`/chats/conversation/${recipientId}/block`, {
      method: 'POST',
    });
  }

  async deleteChat(id) {
    return this.makeRequest(`/chats/${id}`, {
      method: 'DELETE',
    });
  }

  // Calls
  async getCalls() {
    return this.makeRequest('/calls');
  }

  async getCallById(id) {
    return this.makeRequest(`/calls/${id}`);
  }

  async createCall(data) {
    return this.makeRequest('/calls', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCall(id, data) {
    return this.makeRequest(`/calls/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCall(id) {
    return this.makeRequest(`/calls/${id}`, {
      method: 'DELETE',
    });
  }

  // School-wide Events (events table - for all dashboards)
  async getEvents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/events${qs ? `?${qs}` : ''}`);
  }

  async getUpcomingEvents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/events/upcoming${qs ? `?${qs}` : ''}`);
  }

  async getCompletedEvents(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.makeRequest(`/events/completed${qs ? `?${qs}` : ''}`);
  }

  async createEvent(data) {
    return this.makeRequest('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id, data) {
    return this.makeRequest(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEvent(id) {
    return this.makeRequest(`/events/${id}`, {
      method: 'DELETE',
    });
  }

  async getEventAttachments(eventId) {
    return this.makeRequest(`/events/${eventId}/attachments`);
  }

  async uploadEventAttachment(eventId, file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.makeRequest(`/events/${eventId}/attachments`, {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  async deleteEventAttachment(eventId, attachmentId) {
    return this.makeRequest(`/events/${eventId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  // Calendar Events
  async getCalendarEvents(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/calendar${queryString ? `?${queryString}` : ''}`);
  }

  async getCalendarEventById(id) {
    return this.makeRequest(`/calendar/${id}`);
  }

  async createCalendarEvent(data) {
    return this.makeRequest('/calendar', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCalendarEvent(id, data) {
    return this.makeRequest(`/calendar/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCalendarEvent(id) {
    return this.makeRequest(`/calendar/${id}`, {
      method: 'DELETE',
    });
  }

  // Emails
  async getEmails(folder = 'inbox') {
    return this.makeRequest(`/emails?folder=${folder}`);
  }

  async getEmailById(id) {
    return this.makeRequest(`/emails/${id}`);
  }

  async createEmail(data) {
    return this.makeRequest('/emails', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmail(id, data) {
    return this.makeRequest(`/emails/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmail(id) {
    return this.makeRequest(`/emails/${id}`, {
      method: 'DELETE',
    });
  }

  // Todos
  async getTodos(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/todos${queryString ? `?${queryString}` : ''}`);
  }

  async getTodoById(id) {
    return this.makeRequest(`/todos/${id}`);
  }

  async createTodo(data) {
    return this.makeRequest('/todos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTodo(id, data) {
    return this.makeRequest(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTodo(id) {
    return this.makeRequest(`/todos/${id}`, {
      method: 'DELETE',
    });
  }

  // Notes
  async getNotes(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/notes${queryString ? `?${queryString}` : ''}`);
  }

  async getNoteById(id) {
    return this.makeRequest(`/notes/${id}`);
  }

  async createNote(data) {
    return this.makeRequest('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNote(id, data) {
    return this.makeRequest(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNote(id) {
    return this.makeRequest(`/notes/${id}`, {
      method: 'DELETE',
    });
  }

  // Files
  async getFiles(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.makeRequest(`/files${queryString ? `?${queryString}` : ''}`);
  }

  async getFileById(id) {
    return this.makeRequest(`/files/${id}`);
  }

  async createFile(data) {
    return this.makeRequest('/files', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFile(id, data) {
    return this.makeRequest(`/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFile(id) {
    return this.makeRequest(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  // Class Syllabus
  async getClassSyllabus(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.academicYearId != null && params.academicYearId !== '') {
      searchParams.set('academic_year_id', String(params.academicYearId));
    }
    if (params.classId != null && params.classId !== '') {
      searchParams.set('class_id', String(params.classId));
    }
    if (params.sectionId != null && params.sectionId !== '') {
      searchParams.set('section_id', String(params.sectionId));
    }
    if (params.status != null && params.status !== '' && params.status !== 'Select') {
      searchParams.set('status', String(params.status));
    }
    if (params.dateFrom) searchParams.set('date_from', String(params.dateFrom));
    if (params.dateTo) searchParams.set('date_to', String(params.dateTo));
    if (params.sort) searchParams.set('sort', String(params.sort));
    const qs = searchParams.toString();
    return this.makeRequest(`/class-syllabus${qs ? `?${qs}` : ''}`);
  }

  /** Detail fetch for a single syllabus row (available for future detail views). */
  async getClassSyllabusById(id) {
    return this.makeRequest(`/class-syllabus/${id}`);
  }

  async createClassSyllabus(data) {
    return this.makeRequest('/class-syllabus', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClassSyllabus(id, data) {
    return this.makeRequest(`/class-syllabus/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClassSyllabus(id) {
    return this.makeRequest(`/class-syllabus/${id}`, {
      method: 'DELETE',
    });
  }

  // Library (requires DB migration 002_library_module.sql for members + book_code)
  async getLibraryCategories() {
    return this.makeRequest('/library/categories');
  }

  async getLibraryCategoryById(id) {
    return this.makeRequest(`/library/categories/${id}`);
  }

  async createLibraryCategory(data) {
    return this.makeRequest('/library/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLibraryCategory(id, data) {
    return this.makeRequest(`/library/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLibraryCategory(id) {
    return this.makeRequest(`/library/categories/${id}`, {
      method: 'DELETE',
    });
  }

  async getLibraryBooks(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.category_id != null && params.category_id !== '') q.set('category_id', String(params.category_id));
    if (params.book_code) q.set('book_code', String(params.book_code));
    if (params.date_from) q.set('date_from', String(params.date_from));
    if (params.date_to) q.set('date_to', String(params.date_to));
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      q.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = q.toString();
    return this.makeRequest(`/library/books${qs ? `?${qs}` : ''}`);
  }

  async importLibraryBooks(payload) {
    return this.makeRequest('/library/books/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getLibraryBookById(id) {
    return this.makeRequest(`/library/books/${id}`);
  }

  async createLibraryBook(data) {
    return this.makeRequest('/library/books', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLibraryBook(id, data) {
    return this.makeRequest(`/library/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLibraryBook(id) {
    return this.makeRequest(`/library/books/${id}`, {
      method: 'DELETE',
    });
  }

  async getLibraryMembers(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.member_type) q.set('member_type', String(params.member_type));
    if (params.member_id != null && params.member_id !== '') q.set('member_id', String(params.member_id));
    if (params.date_from) q.set('date_from', String(params.date_from));
    if (params.date_to) q.set('date_to', String(params.date_to));
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      q.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = q.toString();
    return this.makeRequest(`/library/members${qs ? `?${qs}` : ''}`);
  }

  async getLibraryMemberById(id) {
    return this.makeRequest(`/library/members/${id}`);
  }

  async createLibraryMember(data) {
    return this.makeRequest('/library/members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLibraryMember(id, data) {
    return this.makeRequest(`/library/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLibraryMember(id) {
    return this.makeRequest(`/library/members/${id}`, {
      method: 'DELETE',
    });
  }

  async getLibraryIssues(params = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.student_id != null) q.set('student_id', String(params.student_id));
    if (params.staff_id != null) q.set('staff_id', String(params.staff_id));
    if (params.member_id != null && params.member_id !== '') q.set('member_id', String(params.member_id));
    if (params.book_id != null && params.book_id !== '') q.set('book_id', String(params.book_id));
    if (params.issue_date_from) q.set('issue_date_from', String(params.issue_date_from));
    if (params.issue_date_to) q.set('issue_date_to', String(params.issue_date_to));
    if (params.search) q.set('search', String(params.search));
    if (params.academic_year_id != null && params.academic_year_id !== '') {
      q.set('academic_year_id', String(params.academic_year_id));
    }
    const qs = q.toString();
    return this.makeRequest(`/library/issues${qs ? `?${qs}` : ''}`);
  }

  async getLibraryIssueById(id) {
    return this.makeRequest(`/library/issues/${id}`);
  }

  async createLibraryIssue(data) {
    return this.makeRequest('/library/issues', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async returnLibraryIssue(id, data) {
    return this.makeRequest(`/library/issues/${id}/return`, {
      method: 'PATCH',
      body: JSON.stringify(data || {}),
    });
  }

  /** @private */
  _accountsListParams(params = {}) {
    const q = new URLSearchParams();
    const set = (key, val) => {
      if (val != null && val !== '') q.set(key, String(val));
    };
    set('search', params.search);
    set('date_from', params.date_from);
    set('date_to', params.date_to);
    set('status', params.status);
    set('transaction_type', params.transaction_type);
    set('category_id', params.category_id);
    set('academic_year_id', params.academic_year_id);
    set('is_active', params.is_active);
    set('page', params.page);
    set('page_size', params.page_size);
    set('sort_by', params.sort_by);
    set('sort_order', params.sort_order);
    set('payment_method', params.payment_method);
    return q;
  }

  // Finance & Accounts (requires migrations 004_accounts_module.sql, 005_accounts_expenses_and_tx_expense_fk.sql)
  async getAccountsIncome(params = {}) {
    const q = this._accountsListParams(params);
    const qs = q.toString();
    return this.makeRequest(`/accounts/income${qs ? `?${qs}` : ''}`);
  }

  async getAccountsIncomeById(id) {
    return this.makeRequest(`/accounts/income/${id}`);
  }

  async createAccountsIncome(data) {
    return this.makeRequest('/accounts/income', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountsIncome(id, data) {
    return this.makeRequest(`/accounts/income/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccountsIncome(id) {
    return this.makeRequest(`/accounts/income/${id}`, {
      method: 'DELETE',
    });
  }

  async getAccountsInvoices(params = {}) {
    const q = this._accountsListParams(params);
    const qs = q.toString();
    return this.makeRequest(`/accounts/invoices${qs ? `?${qs}` : ''}`);
  }

  async getAccountsInvoiceById(id) {
    return this.makeRequest(`/accounts/invoices/${id}`);
  }

  async createAccountsInvoice(data) {
    return this.makeRequest('/accounts/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountsInvoice(id, data) {
    return this.makeRequest(`/accounts/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccountsInvoice(id) {
    return this.makeRequest(`/accounts/invoices/${id}`, {
      method: 'DELETE',
    });
  }

  async getAccountsTransactions(params = {}) {
    const q = this._accountsListParams(params);
    const qs = q.toString();
    return this.makeRequest(`/accounts/transactions${qs ? `?${qs}` : ''}`);
  }

  async getAccountsTransactionById(id) {
    return this.makeRequest(`/accounts/transactions/${id}`);
  }

  async getAccountsExpenseCategories(params = {}) {
    const q = this._accountsListParams(params);
    const qs = q.toString();
    return this.makeRequest(`/accounts/expense-categories${qs ? `?${qs}` : ''}`);
  }

  async getAccountsExpenseCategoryById(id) {
    return this.makeRequest(`/accounts/expense-categories/${id}`);
  }

  async createAccountsExpenseCategory(data) {
    return this.makeRequest('/accounts/expense-categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountsExpenseCategory(id, data) {
    return this.makeRequest(`/accounts/expense-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccountsExpenseCategory(id) {
    return this.makeRequest(`/accounts/expense-categories/${id}`, {
      method: 'DELETE',
    });
  }

  async getAccountsExpenses(params = {}) {
    const q = this._accountsListParams(params);
    const qs = q.toString();
    return this.makeRequest(`/accounts/expenses${qs ? `?${qs}` : ''}`);
  }

  async getAccountsExpenseById(id) {
    return this.makeRequest(`/accounts/expenses/${id}`);
  }

  async createAccountsExpense(data) {
    return this.makeRequest('/accounts/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAccountsExpense(id, data) {
    return this.makeRequest(`/accounts/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccountsExpense(id) {
    return this.makeRequest(`/accounts/expenses/${id}`, {
      method: 'DELETE',
    });
  }

  // School Profile
  async getSchoolProfile() {
    return this.makeRequest('/school/profile');
  }

  async updateSchoolProfile(payload) {
    return this.makeRequest('/school/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async uploadSchoolLogo(file) {
    const maxBytes = 5 * 1024 * 1024;
    if (file && file.size > maxBytes) {
      const err = new Error(
        `File is too large (${Math.round(file.size / 1024)} KB). Maximum size is 5 MB. Compress the image or choose a smaller file.`
      );
      err.code = 'CLIENT_FILE_TOO_LARGE';
      throw err;
    }
    const base = await getApiBaseUrl();
    const url = `${base}/school/profile/logo`.replace(/([^:]\/)\/+/g, '$1');
    const form = new FormData();
    form.append('logo', file);
    const uploadHeaders = {};
    const csrf = resolveCsrfTokenForRequest();
    if (csrf) uploadHeaders['X-XSRF-TOKEN'] = csrf;
    const tb = getTenantBearerToken();
    if (tb) uploadHeaders['Authorization'] = `Bearer ${tb}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: uploadHeaders,
      body: form,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const apiMsg =
        body && typeof body.message === 'string' && body.message.trim()
          ? body.message.trim()
          : text && text.length > 0 && text.length < 800
            ? text
            : `Upload failed (HTTP ${response.status})`;
      const err = new Error(apiMsg);
      err.status = response.status;
      err.code = body && body.code;
      throw err;
    }
    if (body && body.status && body.status !== 'SUCCESS') {
      const err = new Error(body.message || 'Upload did not succeed');
      err.status = response.status;
      throw err;
    }
    return body;
  }
  async getSettings(group) {
    let url = '/settings';
    if (group) url += `?group=${encodeURIComponent(group)}`;
    return this.makeRequest(url);
  }

  async upsertSettings(group, settingsObject) {
    return this.makeRequest('/settings', {
      method: 'POST',
      body: JSON.stringify({ group, settings: settingsObject }),
    });
  }

  async uploadSettingFile(file, group, key) {
    const formData = new FormData();
    formData.append('file', file);
    if (group) formData.append('group', group);
    if (key) formData.append('key', key);
    return this.makeRequest('/settings/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true
    });
  }

  /**
   * Multi-tenant school storage (school id from session/JWT only).
   * @param {File} file
   * @param {'students'|'documents'|'uploads'|'temp'} folder
   */
  async uploadSchoolStorageFile(file, folder) {
    const formData = new FormData();
    formData.append('file', file);

    let targetFolder = folder;
    if (folder === 'students') targetFolder = 'users/student';
    else if (folder === 'parents') targetFolder = 'users/parent';
    else if (folder === 'guardians') targetFolder = 'users/guardian';

    formData.append('folder', targetFolder);
    return this.makeRequest('/storage/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  /**
   * Student PDF documents (medical / transfer certificate). Tenant school from JWT only.
   * @param {File} file
   * @param {'medical'|'transfer_certificate'} docType
   */
  async uploadStudentDocumentPdf(file, docType) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', docType);
    formData.append('folder', 'documents');
    return this.makeRequest('/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  async uploadStudentPhoto(file, userId = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'students');
    if (userId) formData.append('userId', String(userId));
    return this.makeRequest('/storage/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  async uploadTeacherPhoto(file, userId = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'teachers');
    if (userId) formData.append('userId', String(userId));
    return this.makeRequest('/storage/upload', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
  }

  /** @param {string} relativePath — e.g. school_12/students/abc.jpg */
  async deleteSchoolStorageFile(relativePath) {
    return this.makeRequest('/storage/file', {
      method: 'DELETE',
      body: JSON.stringify({ relativePath }),
    });
  }

  /**
   * Turn API path `/api/storage/files/...` into an absolute URL for `<img src>` (same host as API).
   * @param {string} apiPath — `data.url` from uploadSchoolStorageFile
   */
  async getSchoolStorageFileAbsoluteUrl(apiPath) {
    if (!apiPath) return "";
    const rawPath = String(apiPath).trim();
    if (!rawPath) return "";

    // Already absolute URL (http/https): use as-is.
    if (/^https?:\/\//i.test(rawPath)) {
      return rawPath;
    }

    let origin = '';
    const base = await getApiBaseUrl();
    try {
      // Supports both absolute API URLs and relative `/api` proxy URLs.
      origin = new URL(base, window.location.origin).origin;
    } catch {
      origin = window.location.origin;
    }

    let p = rawPath;
    if (p.startsWith("school_")) {
      p = `/api/storage/files/${p}`;
    } else if (!p.startsWith("/")) {
      p = `/${p}`;
    }
    return `${origin}${p}`;
  }

  /**
   * Resolve avatar path from DB/API into a safe absolute URL for <img src>.
   * Supports: absolute URL, `/api/...` path, or storage relative `school_{id}/...`.
   */
  async resolveAvatarUrl(avatarPath) {
    if (!avatarPath) return '';
    const raw = String(avatarPath).trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/storage/files/')) {
      return this.getSchoolStorageFileAbsoluteUrl(`/api${raw}`);
    }
    if (raw.startsWith('storage/files/')) {
      return this.getSchoolStorageFileAbsoluteUrl(`/api/${raw}`);
    }
    if (raw.startsWith('api/storage/files/')) {
      return this.getSchoolStorageFileAbsoluteUrl(`/${raw}`);
    }
    if (raw.startsWith('/api/')) {
      return this.getSchoolStorageFileAbsoluteUrl(raw);
    }
    if (raw.startsWith('school_')) {
      return this.getSchoolStorageFileAbsoluteUrl(raw);
    }
    return raw;
  }

  /**
   * GET /api/users/check-unique?mobile=&email=&excludeId=
   * Independent checks for active users; excludeId skips that user (edit mode).
   */
  async checkUserUnique(params = {}) {
    const search = new URLSearchParams();
    if (params.mobile != null) search.set('mobile', String(params.mobile).trim());
    if (params.email != null) search.set('email', String(params.email).trim());
    if (params.excludeId != null) search.set('excludeId', String(params.excludeId));
    const qs = search.toString();
    return this.makeRequest(`/users/check-unique?${qs}`);
  }
}

export const apiService = new ApiService();
