import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

function formatLeaveDate(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatLeaveRange(startVal, endVal) {
  const start = formatLeaveDate(startVal);
  const end = formatLeaveDate(endVal);
  if (start === 'N/A' && end === 'N/A') return 'N/A';
  if (start === end) return start;
  return `${start} - ${end}`;
}

// Map leave type name to badge class (match existing UI: Emergency=danger, Casual=warning)
function getBadgeClass(leaveTypeName) {
  if (!leaveTypeName) return 'badge-soft-primary';
  const t = String(leaveTypeName).toLowerCase();
  if (t.includes('emergency')) return 'badge-soft-danger';
  if (t.includes('casual')) return 'badge-soft-warning';
  return 'badge-soft-primary';
}

export const useLeaveApplications = (options = {}) => {
  const {
    limit = 20,
    studentOnly = false,
    parentChildren = false,
    studentId = null,
    staffId = null,
    canUseAdminList = false,
    classId = null,
    sectionId = null,
    academicYearId = null,
    leaveFrom = null,
    leaveTo = null,
    pendingOnly = false,
    status = null,
    leaveTypeId = null,
    applicantType = null,
    sortBy = null,
    sortOrder = null,
    page = null,
    pageSize = null,
  } = options;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchList = async (bustCache = false) => {
    try {
      setLoading(true);
      setError(null);
      const refreshKey = bustCache ? Date.now() : null;
      let response;
      if (parentChildren) {
        response = await apiService.getParentChildrenLeaves({ limit });
      } else if (studentOnly) {
        response = await apiService.getMyLeaveApplications({ limit });
      } else if (studentId != null) {
        // Admin-only endpoint - only call when role is confirmed (avoids 403 when role loading)
        if (!canUseAdminList) {
          setList([]);
          setLoading(false);
          return;
        }
        response = await apiService.getLeaveApplications({
          limit,
          page: page ?? undefined,
          page_size: pageSize ?? undefined,
          student_id: studentId,
          academic_year_id: academicYearId,
          leave_type_id: leaveTypeId ?? undefined,
          applicant_type: applicantType ?? undefined,
          class_id: classId ?? undefined,
          section_id: sectionId ?? undefined,
          status: status ?? undefined,
          sort_by: sortBy ?? undefined,
          sort_order: sortOrder ?? undefined,
          leave_from: leaveFrom || undefined,
          leave_to: leaveTo || undefined,
          ...(refreshKey != null ? { _refresh: refreshKey } : {}),
        });
      } else if (staffId != null) {
        if (!canUseAdminList) {
          setList([]);
          setLoading(false);
          return;
        }
        response = await apiService.getLeaveApplications({
          limit,
          page: page ?? undefined,
          page_size: pageSize ?? undefined,
          staff_id: staffId,
          academic_year_id: academicYearId,
          leave_type_id: leaveTypeId ?? undefined,
          applicant_type: applicantType ?? undefined,
          class_id: classId ?? undefined,
          section_id: sectionId ?? undefined,
          status: status ?? undefined,
          sort_by: sortBy ?? undefined,
          sort_order: sortOrder ?? undefined,
          leave_from: leaveFrom || undefined,
          leave_to: leaveTo || undefined,
          ...(refreshKey != null ? { _refresh: refreshKey } : {}),
        });
      } else if (canUseAdminList) {
        response = await apiService.getLeaveApplications({
          limit,
          page: page ?? undefined,
          page_size: pageSize ?? undefined,
          academic_year_id: academicYearId,
          leave_type_id: leaveTypeId ?? undefined,
          applicant_type: applicantType ?? undefined,
          class_id: classId ?? undefined,
          section_id: sectionId ?? undefined,
          status: status ?? undefined,
          sort_by: sortBy ?? undefined,
          sort_order: sortOrder ?? undefined,
          leave_from: leaveFrom || undefined,
          leave_to: leaveTo || undefined,
          ...(pendingOnly ? { pending_only: true } : {}),
          ...(refreshKey != null ? { _refresh: refreshKey } : {}),
        });
      } else {
        // Role loading or non-admin - skip admin API to avoid 403
        setList([]);
        setLoading(false);
        return;
      }

      const rawData = response?.data;
      const dataArr = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : rawData?.items) || [];
      if (response.status === 'SUCCESS' && Array.isArray(dataArr)) {
        let rows = dataArr;
        if (parentChildren && studentId != null) {
          rows = rows.filter((r) => Number(r.student_id) === Number(studentId));
        }
        // Safety: when viewing a specific student's leaves, filter to only that student_id
        if (!parentChildren && !studentOnly && studentId != null) {
          rows = rows.filter((r) => r.student_id != null && Number(r.student_id) === Number(studentId));
        }
        // Safety: when viewing a specific staff's leaves, filter to only that staff_id
        if (!parentChildren && !studentOnly && staffId != null) {
          rows = rows.filter((r) => r.staff_id != null && Number(r.staff_id) === Number(staffId));
        }
        const mapped = rows.map((row, index) => {
          const name =
            [row.applicant_first_name, row.applicant_last_name].filter(Boolean).join(' ') ||
            [row.staff_first_name, row.staff_last_name].filter(Boolean).join(' ') ||
            row.applicant_name ||
            'N/A';
          const leaveType =
            row.leave_type_name || row.leave_type || row.type_name || 'N/A';
          const role =
            row.applicant_role ||
            row.designation_name ||
            row.designation ||
            row.role ||
            'N/A';
          const startDate = row.start_date || row.from_date;
          const endDate = row.end_date || row.to_date;
          const appliedAt = row.applied_at || row.created_at || row.start_date;
          const leaveRange = formatLeaveRange(startDate, endDate);
          const applyOn = formatLeaveDate(appliedAt);
          const photoUrl =
            row.applicant_photo_url ||
            row.staff_photo_url ||
            row.photo_url ||
            'assets/img/profiles/avatar-14.jpg';

          const statusRaw = row.status || row.leave_status || 'pending';
          const statusLower = String(statusRaw).toLowerCase();
          const statusVal = statusLower;

          const noOfDays = row.total_days ?? row.no_of_days ?? row.noOfDays ?? (startDate && endDate ? Math.ceil((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000)) + 1 : 1);

          return {
            key: row.id != null ? String(row.id) : `leave-${index}`,
            id: row.id,
            leaveTypeId: row.leave_type_id ?? row.leaveTypeId ?? null,
            studentId: row.student_id ?? null,
            staffId: row.staff_id ?? null,
            applicantType: row.applicant_type || (row.student_id ? 'student' : row.staff_id ? 'staff' : null),
            name,
            leaveType,
            role,
            leaveRange,
            leaveDate: leaveRange,
            startDate,
            endDate,
            noOfDays: String(noOfDays),
            applyOn,
            photoUrl,
            description:
              row.reason ||
              row.description ||
              row.leave_reason ||
              row.leaveDescription ||
              '',
            badgeClass: getBadgeClass(leaveType),
            status: statusVal,
            rejectionReason: row.rejection_reason ?? null,
            approvedBy: row.approved_by ?? null,
            approvedDate: row.approved_date ?? null,
            statusBadgeClass: statusLower.includes('approv') ? 'bg-success' : statusLower.includes('declin') || statusLower.includes('reject') ? 'bg-danger' : 'bg-skyblue',
          };
        });
        setList(mapped);
      } else {
        setList([]);
      }
    } catch (err) {
      console.error('Error fetching leave applications:', err);
      setError(err.message || 'Failed to fetch leave applications');
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(false);
  }, [limit, studentOnly, parentChildren, studentId, staffId, canUseAdminList, classId, sectionId, academicYearId, leaveFrom, leaveTo, pendingOnly, status, leaveTypeId, applicantType, sortBy, sortOrder, page, pageSize]);

  return {
    leaveApplications: list,
    loading,
    error,
    refetch: () => fetchList(true),
  };
};
