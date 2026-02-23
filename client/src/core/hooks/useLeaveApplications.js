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
  const { limit = 20, studentOnly = false, parentChildren = false, studentId = null, staffId = null } = options;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      let response;
      if (parentChildren) {
        response = await apiService.getParentChildrenLeaves({ limit });
      } else if (studentOnly) {
        response = await apiService.getMyLeaveApplications({ limit });
      } else if (studentId != null) {
        response = await apiService.getLeaveApplications({ limit, student_id: studentId });
      } else if (staffId != null) {
        response = await apiService.getLeaveApplications({ limit, staff_id: staffId });
      } else {
        response = await apiService.getLeaveApplications({ limit });
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

          const statusVal = row.status || row.leave_status || 'Pending';
          const statusLower = String(statusVal).toLowerCase();

          const noOfDays = row.no_of_days ?? row.noOfDays ?? (startDate && endDate ? Math.ceil((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000)) + 1 : 1);

          return {
            key: row.id != null ? String(row.id) : `leave-${index}`,
            id: row.id,
            name,
            leaveType,
            role,
            leaveRange,
            leaveDate: leaveRange,
            noOfDays: String(noOfDays),
            applyOn,
            photoUrl,
            badgeClass: getBadgeClass(leaveType),
            status: statusVal,
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
    fetchList();
  }, [limit, studentOnly, parentChildren, studentId, staffId]);

  return {
    leaveApplications: list,
    loading,
    error,
    refetch: fetchList,
  };
};
