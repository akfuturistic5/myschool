import { Link, useLocation } from "react-router-dom";
import React, { useEffect, useState, useMemo } from "react";

import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import StudentSidebar from "../student-details/studentSidebar";
import StudentBreadcrumb from "../student-details/studentBreadcrumb";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { isTeacherRole } from "../../../../core/utils/roleUtils";
import { apiService } from "../../../../core/services/apiService";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

function parsePositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

const StudentSubjects = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const user = useSelector(selectUser);
  const headerAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const isTeacher = isTeacherRole(user);
  const { student, loading: studentLoading } = useLinkedStudentContext({
    locationState: state,
  });
  const effectiveStudentId = parsePositiveId(student?.id);
  const studentAcademicYearId = parsePositiveId(student?.academic_year_id);
  const academicYearForSubjects = studentAcademicYearId ?? headerAcademicYearId ?? undefined;

const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const [electives, setElectives] = useState<any[]>([]);
  const [loadingElectives, setLoadingElectives] = useState(false);
  const [selectedElectiveIds, setSelectedElectiveIds] = useState<number[]>([]);
  const [savingElectives, setSavingElectives] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const isStudentUser = useMemo(() => {
    const roleName = String(user?.role || '').trim().toLowerCase();
    return roleName === 'student' || roleName === 'parent' || roleName === 'guardian';
  }, [user]);

  const hasSavedElectives = useMemo(() => {
    return subjects.some(s => s.is_elective);
  }, [subjects]);

  const isSelectionLocked = isStudentUser && hasSavedElectives;

  useEffect(() => {
    let cancelled = false;
    if (!effectiveStudentId) {
      setSubjects([]);
      return;
    }

    setLoading(true);
    setError(null);
    apiService.getStudentSubjects(effectiveStudentId, academicYearForSubjects)
      .then((res: any) => {
        if (cancelled) return;
        if (res?.status === "SUCCESS") {
          setSubjects(res.data || []);
        } else {
          setError(res?.message || "Failed to fetch subjects");
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err.message || "Failed to fetch subjects");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveStudentId, academicYearForSubjects]);

  // Fetch electives if class_id is known
  useEffect(() => {
    let cancelled = false;
    const classId = parsePositiveId(student?.class_id || student?.classId);
    if (!classId || !academicYearForSubjects || !effectiveStudentId) {
      setElectives([]);
      return;
    }

    setLoadingElectives(true);
    apiService.getElectiveSubjects({ class_id: classId, academic_year_id: academicYearForSubjects })
      .then((res: any) => {
        if (cancelled) return;
        if (res?.status === "SUCCESS") {
          setElectives(res.data || []);
        } else {
           console.error("Failed to fetch electives:", res);
        }
      })
      .catch((err) => {
         console.error("Error fetching electives:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingElectives(false);
      });

    return () => {
      cancelled = true;
    };
  }, [student?.class_id, student?.classId, academicYearForSubjects, effectiveStudentId]);

  useEffect(() => {
    const currentChoiceIds = subjects.filter(s => s.is_elective).map(s => s.class_subject_id);
    setSelectedElectiveIds(currentChoiceIds);
  }, [subjects]);

  const electivesByGroup = useMemo(() => {
    const map: Record<string, { maxSelectable: number, subjects: any[] }> = {};
    electives.forEach(e => {
      const gName = e.elective_group_name || 'Ungrouped Electives';
      if (!map[gName]) {
        map[gName] = {
          maxSelectable: e.selectable_subjects || e.max_subjects || 1,
          subjects: []
        };
      }
      map[gName].subjects.push(e);
    });
    return map;
  }, [electives]);

  const handleToggleElective = (classSubjectId: number, groupName: string, maxSelectable: number) => {
    if (isSelectionLocked) return;
    setSaveError(null);
    setSaveSuccess(null);
    setSelectedElectiveIds(prev => {
      if (prev.includes(classSubjectId)) {
        return prev.filter(id => id !== classSubjectId);
      } else {
        const currentlySelectedInGroup = electives
          .filter(e => (e.elective_group_name || 'Ungrouped Electives') === groupName)
          .map(e => e.class_subject_id)
          .filter(id => prev.includes(id));
        if (maxSelectable > 0 && currentlySelectedInGroup.length >= maxSelectable) {
           setSaveError(`You can only select up to ${maxSelectable} subjects in ${groupName}`);
           return prev; // Do not add
        }
        return [...prev, classSubjectId];
      }
    });
  };

  const handleSaveElectives = () => {
    if (isSelectionLocked) return;
    if (!effectiveStudentId || !academicYearForSubjects) return;

    // Validate selection limits for all elective groups before submitting
    for (const [groupName, groupData] of Object.entries(electivesByGroup)) {
      const selectedInGroup = groupData.subjects.filter(sub => 
        selectedElectiveIds.includes(sub.class_subject_id)
      );
      if (groupData.maxSelectable > 0 && selectedInGroup.length > groupData.maxSelectable) {
        setSaveError(`You have selected ${selectedInGroup.length} subjects in "${groupName}", but only up to ${groupData.maxSelectable} are allowed.`);
        return;
      }
    }

    setSavingElectives(true);
    setSaveError(null);
    setSaveSuccess(null);
    const payload = {
      student_ids: [effectiveStudentId],
      class_subject_ids: selectedElectiveIds,
      academic_year_id: academicYearForSubjects
    };
    
    apiService.assignElectives(payload)
      .then((res: any) => {
        if (res?.status === "SUCCESS") {
          setSaveSuccess("Electives saved successfully");
          // Refresh subjects
          setLoading(true);
          apiService.getStudentSubjects(effectiveStudentId, academicYearForSubjects)
            .then((res: any) => {
              if (res?.status === "SUCCESS") {
                setSubjects(res.data || []);
              }
            })
            .finally(() => setLoading(false));
        } else {
          setSaveError(res?.message || "Failed to save electives");
        }
      })
      .catch((err: any) => {
        setSaveError(err?.message || "Failed to save electives");
      })
      .finally(() => {
        setSavingElectives(false);
      });
  };

  if (studentLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading student...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StudentBreadcrumb />
          </div>
          <div className="row">
            <StudentSidebar student={student} />
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentDetail}?studentId=${effectiveStudentId}` : routes.studentDetail}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentTimeTable}?studentId=${effectiveStudentId}` : routes.studentTimeTable}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLeaves}?studentId=${effectiveStudentId}` : routes.studentLeaves}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    {!isTeacher && (
                      <li>
                        <Link
                          to={effectiveStudentId ? `${routes.studentFees}?studentId=${effectiveStudentId}` : routes.studentFees}
                          className="nav-link"
                          state={student ? { studentId: student.id, student } : undefined}
                        >
                          <i className="ti ti-report-money me-2" />
                          Fees
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentResult}?studentId=${effectiveStudentId}` : routes.studentResult}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLibrary}?studentId=${effectiveStudentId}` : routes.studentLibrary}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-books me-2" />
                        Library
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentSubjects}?studentId=${effectiveStudentId}` : routes.studentSubjects}
                        className="nav-link active"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-book me-2" />
                        Subjects
                      </Link>
                    </li>
                  </ul>

                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <h4 className="mb-3">Enrolled Subjects</h4>
                    </div>
                    <div className="card-body">
                      {error && (
                        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-alert-circle me-2 fs-18" />
                          <span>{error}</span>
                        </div>
                      )}

                      {loading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading subjects...</span>
                        </div>
                      )}

                      {!loading && subjects.length === 0 && (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No subjects found for this student.</span>
                        </div>
                      )}

                      {!loading && subjects.length > 0 && (
                        <div className="table-responsive custom-table">
                          <table className="table table-hover border">
                            <thead className="thead-light">
                              <tr>
                                <th>Subject Code</th>
                                <th>Subject Name</th>
                                <th>Subject Type</th>
                                <th>Category</th>
                                <th>Assigned Teacher</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subjects.map((sub) => (
                                <tr key={sub.class_subject_id}>
                                  <td>{sub.subject_code || "-"}</td>
                                  <td className="fw-medium text-dark">{sub.subject_name}</td>
                                  <td>{sub.subject_type || "-"}</td>
                                  <td>
                                    {sub.is_elective ? (
                                      <span className="badge badge-soft-info">Elective</span>
                                    ) : (
                                      <span className="badge badge-soft-success">Core</span>
                                    )}
                                  </td>
                                  <td>
                                    {sub.teacher_first_name ? (
                                      <div className="d-flex align-items-center">
                                        <div className="ms-2">
                                          <p className="text-dark mb-0 fw-medium">
                                            {sub.teacher_first_name} {sub.teacher_last_name || ""}
                                          </p>
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-muted">Not Assigned</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Elective Selection Card */}
                  <div className="card mt-4">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <h4 className="mb-3 d-flex align-items-center">
                        <i className="ti ti-book-off me-2 text-primary" />
                        Manage Elective Subjects
                        {isSelectionLocked && (
                          <span className="badge badge-soft-danger ms-2 fs-12 d-flex align-items-center">
                            <i className="ti ti-lock me-1" /> Choices Locked
                          </span>
                        )}
                      </h4>
                      {!isSelectionLocked && (
                        <button 
                          className="btn btn-primary mb-3"
                          onClick={handleSaveElectives}
                          disabled={savingElectives || loadingElectives}
                        >
                          {savingElectives ? (
                            <><span className="spinner-border spinner-border-sm me-2" /> Saving...</>
                          ) : (
                            <><i className="ti ti-device-floppy me-2" /> Save Choices</>
                          )}
                        </button>
                      )}
                    </div>
                    <div className="card-body">
                      {isSelectionLocked && (
                        <div className="alert alert-info d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-lock me-2 fs-18 text-info" />
                          <div>
                            <strong>Choices Finalized:</strong> You have already saved your elective subjects. Your selections are now locked. To make any changes, please contact the school administration.
                          </div>
                        </div>
                      )}
                      {saveError && (
                        <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-alert-circle me-2 fs-18" />
                          <span>{saveError}</span>
                        </div>
                      )}
                      {saveSuccess && (
                        <div className="alert alert-success d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-check me-2 fs-18" />
                          <span>{saveSuccess}</span>
                        </div>
                      )}
                      {loadingElectives ? (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading electives...</span>
                        </div>
                      ) : (
                        <div className="row">
                          {electives.length === 0 ? (
                            <div className="col-12">
                              <div className="alert alert-info mb-0 d-flex align-items-center">
                                <i className="ti ti-info-circle me-2 fs-18"></i>
                                <span>No elective subjects are available for your current class and academic year.</span>
                              </div>
                            </div>
                          ) : (
                            Object.entries(electivesByGroup).map(([groupName, groupData]) => (
                            <div className="col-md-6 mb-4" key={groupName}>
                              <div className="border rounded p-3 h-100 bg-light-50">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                  <h6 className="fw-bold mb-0 text-dark">{groupName}</h6>
                                  <span className="badge badge-soft-primary">
                                    Max: {groupData.maxSelectable}
                                  </span>
                                </div>
                                <div className="d-flex flex-column gap-2">
                                  {groupData.subjects.map(sub => {
                                    const isSelected = selectedElectiveIds.includes(sub.class_subject_id);
                                    return (
                                      <div 
                                        key={sub.class_subject_id}
                                        className={`border rounded p-2 transition-all ${isSelected ? 'bg-primary-transparent border-primary' : 'bg-white'} ${isSelectionLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
                                        onClick={() => {
                                          if (isSelectionLocked) return;
                                          handleToggleElective(sub.class_subject_id, groupName, groupData.maxSelectable);
                                        }}
                                      >
                                        <div className="d-flex align-items-center justify-content-between w-100">
                                            <div className="d-flex align-items-center">
                                              <div className="form-check mb-0 flex-shrink-0">
                                                <input 
                                                  className="form-check-input" 
                                                  type="checkbox" 
                                                  checked={isSelected}
                                                  disabled={isSelectionLocked}
                                                  onChange={() => {}} // handled by onClick on parent
                                                />
                                              </div>
                                              <div className="ms-2">
                                                <p className="mb-0 fw-medium text-dark">{sub.subject_name}</p>
                                              </div>
                                            </div>
                                            {sub.subject_type && (
                                              <span className="badge badge-soft-info ms-2">
                                                {sub.subject_type}
                                              </span>
                                            )}
                                          </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* /Elective Selection Card */}

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentSubjects;
