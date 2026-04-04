import {
  resolveCsrfTokenForRequest,
  setCachedCsrfToken,
  clearCachedCsrfToken,
} from '../utils/csrfClientStore.js';

const BUILD_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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
    const method = options.method || 'GET';
    const bodyKey = options.body ? JSON.stringify(options.body).substring(0, 50) : '';
    const requestKey = `${method}:${endpoint}:${bodyKey}`;

    // If the same request is already pending, return the existing promise
    if (pendingRequests.has(requestKey)) {
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
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };

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
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
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

  // Sections
  async getSections() {
    return this.makeRequest('/sections');
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

  async getClassScheduleById(id) {
    return this.makeRequest(`/class-schedules/${id}`);
  }

  async createClassSchedule(data) {
    return this.makeRequest('/class-schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Schedules (time_slots / schedule table - ID, Type, Start Time, End Time, Status)
  async getSchedules() {
    return this.makeRequest('/schedules');
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

  async promoteStudents(payload) {
    return this.makeRequest('/students/promote', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getStudentById(id) {
    return this.makeRequest(`/students/${id}`);
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
  async getReligions() {
    return this.makeRequest('/religions');
  }

  async getReligionById(id) {
    return this.makeRequest(`/religions/${id}`);
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

  // Guardians
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

  async getGuardianByStudentId(studentId) {
    return this.makeRequest(`/guardians/student/${studentId}`);
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

  async getTeacherById(id) {
    return this.makeRequest(`/teachers/${id}`);
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

  // User Roles
  async getUserRoles() {
    return this.makeRequest('/user-roles');
  }

  async getUserRoleById(id) {
    return this.makeRequest(`/user-roles/${id}`);
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
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
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
    if (params.student_id != null) searchParams.set('student_id', params.student_id);
    if (params.staff_id != null) searchParams.set('staff_id', params.staff_id);
    if (params.academic_year_id != null) searchParams.set('academic_year_id', params.academic_year_id);
    if (params.leave_from != null && params.leave_from !== '') searchParams.set('leave_from', params.leave_from);
    if (params.leave_to != null && params.leave_to !== '') searchParams.set('leave_to', params.leave_to);
    if (params.pending_only === true || params.pending_only === 1 || params.pending_only === '1') {
      searchParams.set('pending_only', '1');
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

  async updateLeaveApplicationStatus(id, status) {
    return this.makeRequest(`/leave-applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
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
  async getTransportRoutes() {
    return this.makeRequest('/transport/routes');
  }

  async getTransportRouteById(id) {
    return this.makeRequest(`/transport/routes/${id}`);
  }

  async updateTransportRoute(id, routeData) {
    return this.makeRequest(`/transport/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(routeData)
    });
  }

  async updateTransportPickupPoint(id, pickupData) {
    return this.makeRequest(`/transport/pickup-points/${id}`, {
      method: 'PUT',
      body: JSON.stringify(pickupData)
    });
  }

  async updateTransportVehicle(id, vehicleData) {
    return this.makeRequest(`/transport/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData)
    });
  }

  async updateTransportDriver(id, driverData) {
    return this.makeRequest(`/transport/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(driverData)
    });
  }

  async getTransportPickupPoints() {
    return this.makeRequest('/transport/pickup-points');
  }

  async getTransportPickupPointById(id) {
    return this.makeRequest(`/transport/pickup-points/${id}`);
  }

  async getTransportVehicles() {
    return this.makeRequest('/transport/vehicles');
  }

  async getTransportVehicleById(id) {
    return this.makeRequest(`/transport/vehicles/${id}`);
  }

  async getTransportDrivers() {
    return this.makeRequest('/transport/drivers');
  }

  async getTransportDriverById(id) {
    return this.makeRequest(`/transport/drivers/${id}`);
  }

  // Subjects
  async getSubjects() {
    return this.makeRequest('/subjects');
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

  // Hostels
  async getHostels() {
    return this.makeRequest('/hostels');
  }

  async getHostelById(id) {
    return this.makeRequest(`/hostels/${id}`);
  }

  // Hostel Rooms
  async getHostelRooms() {
    return this.makeRequest('/hostel-rooms');
  }

  async getHostelRoomById(id) {
    return this.makeRequest(`/hostel-rooms/${id}`);
  }

  async updateHostelRoom(id, roomData) {
    return this.makeRequest(`/hostel-rooms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(roomData),
    });
  }

  // Room Types
  async getRoomTypes() {
    return this.makeRequest('/room-types');
  }

  async getRoomTypeById(id) {
    return this.makeRequest(`/room-types/${id}`);
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
    if (params.academicYearId != null) searchParams.set('academic_year_id', params.academicYearId);
    const qs = searchParams.toString();
    return this.makeRequest(`/class-syllabus${qs ? `?${qs}` : ''}`);
  }

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
}

export const apiService = new ApiService();
