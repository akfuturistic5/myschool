import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Table from "../../../core/common/dataTable/index";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../core/data/redux/authSlice";
import { useHomework } from "../../../core/hooks/useHomework";
import { useCurrentTeacher } from "../../../core/hooks/useCurrentTeacher";
import { apiService } from "../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../core/utils/apiErrorMessage";
import { getDashboardForRole, isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";
import type { HomeworkListItem, SubjectAssignmentOption } from "../../../core/types/homework";
import HomeworkModal from "./HomeworkModal";
import HomeworkEditModal from "./HomeworkEditModal";
import Swal from "sweetalert2";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Closed", label: "Closed" },
  { value: "Archived", label: "Archived" },
];

const statusBadgeClass = (status: string) => {
  const s = status.toLowerCase();
  if (s === "published") return "badge-soft-success";
  if (s === "draft") return "badge-soft-secondary";
  if (s === "closed") return "badge-soft-warning";
  if (s === "archived") return "badge-soft-dark";
  return "badge-soft-info";
};

const ClassHomeWork = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dashboardRoute = getDashboardForRole(user?.role);
  const { teacher, loading: teacherLoading } = useCurrentTeacher();
  const teacherStaffId =
    teacher && typeof teacher === "object" && "id" in teacher
      ? Number((teacher as { id: number }).id)
      : null;

  const [draftStatus, setDraftStatus] = useState("");
  const [draftClassId, setDraftClassId] = useState<string | null>(null);
  const [draftSectionId, setDraftSectionId] = useState<string | null>(null);
  const [draftSubjectId, setDraftSubjectId] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterClassId, setFilterClassId] = useState<number | null>(null);
  const [filterSectionId, setFilterSectionId] = useState<number | null>(null);
  const [filterSubjectId, setFilterSubjectId] = useState<number | null>(null);

  const [formResetKey, setFormResetKey] = useState(0);
  const [editHomework, setEditHomework] = useState<Record<string, unknown> | null>(null);
  const [assignments, setAssignments] = useState<SubjectAssignmentOption[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const listFilters = useMemo(
    () => ({
      academic_year_id: academicYearId,
      class_id: filterClassId,
      class_section_id: filterSectionId,
      class_subject_id: filterSubjectId,
      status: filterStatus || null,
      page: 1,
      limit: 50,
    }),
    [academicYearId, filterClassId, filterSectionId, filterSubjectId, filterStatus]
  );

  const { rows, loading, error, refetch } = useHomework(listFilters);

  const isTeacherOnly =
    !isHeadmasterRole(user) &&
    !isAdministrativeRole(user) &&
    String(user?.role ?? "")
      .trim()
      .toLowerCase() === "teacher";

  const loadAssignments = useCallback(async () => {
    if (academicYearId == null) {
      setAssignments([]);
      return;
    }
    setAssignmentsLoading(true);
    try {
      const params: { academicYearId: number; teacherId?: number } = { academicYearId };
      if (isTeacherOnly && teacherStaffId) {
        params.teacherId = teacherStaffId;
      }
      const res = await apiService.getSubjectTeacherAssignments(params);
      const raw = Array.isArray(res?.data) ? res.data : [];
      const mapped: SubjectAssignmentOption[] = raw
        .filter(
          (r: {
            classSectionId?: number | null;
            class_section_id?: number | null;
          }) => (r.classSectionId ?? r.class_section_id) != null
        )
        .map(
          (r: {
            id: number;
            teacherId?: number;
            staff_id?: number;
            classId?: number;
            class_id?: number;
            classSectionId?: number;
            class_section_id?: number;
            classSubjectId?: number;
            class_subject_id?: number;
            academicYearId?: number;
            academic_year_id?: number;
            className?: string;
            class_name?: string;
            sectionName?: string;
            section_name?: string;
            subjectName?: string;
            subject_name?: string;
          }) => {
            const className = r.className ?? r.class_name ?? "";
            const sectionName = r.sectionName ?? r.section_name ?? "";
            const subjectName = r.subjectName ?? r.subject_name ?? "";
            return {
              id: r.id,
              teacherId: r.teacherId ?? r.staff_id ?? 0,
              classId: r.classId ?? r.class_id ?? 0,
              classSectionId: r.classSectionId ?? r.class_section_id ?? 0,
              classSubjectId: r.classSubjectId ?? r.class_subject_id ?? 0,
              academicYearId: r.academicYearId ?? r.academic_year_id ?? academicYearId,
              className: String(className),
              sectionName: String(sectionName),
              subjectName: String(subjectName),
              label: [className, sectionName, subjectName].filter(Boolean).join(" · "),
            };
          }
        );
      setAssignments(mapped);
    } catch (err) {
      console.error("loadAssignments:", err);
      setAssignments([]);
    } finally {
      setAssignmentsLoading(false);
    }
  }, [academicYearId, isTeacherOnly, teacherStaffId]);

  useEffect(() => {
    if (!isTeacherOnly || !teacherLoading) {
      loadAssignments();
    }
  }, [loadAssignments, isTeacherOnly, teacherLoading]);

  const classFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assignments) {
      if (!seen.has(String(a.classId))) {
        seen.set(String(a.classId), a.className || `Class ${a.classId}`);
      }
    }
    return [
      { value: "", label: "All classes" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [assignments]);

  const sectionFilterOptions = useMemo(() => {
    const filtered = draftClassId
      ? assignments.filter((a) => String(a.classId) === draftClassId)
      : assignments;
    const seen = new Map<string, string>();
    for (const a of filtered) {
      const key = String(a.classSectionId);
      if (!seen.has(key)) {
        seen.set(key, a.sectionName || `Section ${a.classSectionId}`);
      }
    }
    return [
      { value: "", label: "All sections" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [assignments, draftClassId]);

  const subjectFilterOptions = useMemo(() => {
    let filtered = assignments;
    if (draftClassId) filtered = filtered.filter((a) => String(a.classId) === draftClassId);
    if (draftSectionId) {
      filtered = filtered.filter((a) => String(a.classSectionId) === draftSectionId);
    }
    const seen = new Map<string, string>();
    for (const a of filtered) {
      const key = String(a.classSubjectId);
      if (!seen.has(key)) {
        seen.set(key, a.subjectName || `Subject ${a.classSubjectId}`);
      }
    }
    return [
      { value: "", label: "All subjects" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [assignments, draftClassId, draftSectionId]);

  const handleApplyClick = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setFilterStatus(draftStatus || null);
    setFilterClassId(draftClassId ? Number(draftClassId) : null);
    setFilterSectionId(draftSectionId ? Number(draftSectionId) : null);
    setFilterSubjectId(draftSubjectId ? Number(draftSubjectId) : null);
    dropdownMenuRef.current?.classList.remove("show");
  };

  const handleResetFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    setDraftStatus("");
    setDraftClassId(null);
    setDraftSectionId(null);
    setDraftSubjectId(null);
    setFilterStatus(null);
    setFilterClassId(null);
    setFilterSectionId(null);
    setFilterSubjectId(null);
  };

  const handleRefresh = async () => {
    await refetch();
    Swal.fire({ icon: "success", title: "Refreshed", timer: 1000, showConfirmButton: false });
  };

  const detailPath = (homeworkId: number) =>
    routes.classHomeWorkDetail.replace(":id", String(homeworkId));

  const handleEditRow = async (record: TableData) => {
    const hid = Number(record.id);
    if (!hid) return;
    try {
      const res = await apiService.getHomeworkById(hid);
      setEditHomework(res?.data ?? res);
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const handleDeleteRow = async (record: TableData) => {
    const hid = Number(record.id);
    if (!hid) return;
    const confirm = await Swal.fire({
      title: "Delete homework?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!confirm.isConfirmed) return;
    try {
      await apiService.deleteHomework(hid);
      await refetch();
      Swal.fire({ icon: "success", title: "Deleted", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (_text: unknown, record: TableData) => (
        <Link to={detailPath(Number(record.id))} className="link-primary">
          HW{record.id}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => Number(a.id) - Number(b.id),
    },
    {
      title: "Title",
      dataIndex: "title",
      sorter: (a: TableData, b: TableData) => String(a.title).localeCompare(String(b.title)),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => String(a.class).localeCompare(String(b.class)),
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => String(a.section).localeCompare(String(b.section)),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      sorter: (a: TableData, b: TableData) => String(a.subject).localeCompare(String(b.subject)),
    },
    {
      title: "Assign date",
      dataIndex: "homeworkDate",
      sorter: (a: TableData, b: TableData) =>
        String(a.homeworkDate).localeCompare(String(b.homeworkDate)),
    },
    {
      title: "Due date",
      dataIndex: "submissionDate",
      sorter: (a: TableData, b: TableData) =>
        String(a.submissionDate).localeCompare(String(b.submissionDate)),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <span className={`badge ${statusBadgeClass(text)} d-inline-flex align-items-center`}>
          {text || "—"}
        </span>
      ),
    },
    {
      title: "Students",
      dataIndex: "recipientCount",
      render: (_: unknown, record: TableData) => {
        const r = record as unknown as HomeworkListItem;
        return (
          <span className="text-muted small">
            {r.submittedCount}/{r.recipientCount} submitted
          </span>
        );
      },
    },
    {
      title: "Teacher",
      dataIndex: "createdBy",
      sorter: (a: TableData, b: TableData) => String(a.createdBy).localeCompare(String(b.createdBy)),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: TableData) => (
        <div className="dropdown">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
            data-bs-toggle="dropdown"
            data-bs-boundary="viewport"
            data-bs-popper-config='{"strategy":"fixed"}'
            aria-expanded="false"
          >
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-end p-2">
            <li>
              <Link
                className="dropdown-item rounded-1"
                to={detailPath(Number(record.id))}
              >
                <i className="ti ti-eye me-2" />
                View & grade
              </Link>
            </li>
            <li>
              <Link
                className="dropdown-item rounded-1"
                to="#"
                data-bs-toggle="modal"
                data-bs-target="#edit_home_work"
                onClick={(e) => {
                  e.preventDefault();
                  handleEditRow(record);
                }}
              >
                <i className="ti ti-edit-circle me-2" />
                Edit
              </Link>
            </li>
            <li>
              <Link
                className="dropdown-item rounded-1 text-danger"
                to="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteRow(record);
                }}
              >
                <i className="ti ti-trash-x me-2" />
                Delete
              </Link>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  const openAddModal = () => {
    if (academicYearId == null) {
      Swal.fire({
        icon: "warning",
        title: "Academic year required",
        text: "Select an academic year from the header first.",
      });
      return;
    }
    if (assignments.length === 0 && !assignmentsLoading) {
      Swal.fire({
        icon: "info",
        title: "No assignments",
        text: isTeacherOnly
          ? "You need a subject teacher assignment for this year before creating homework."
          : "Add subject teacher assignments for this academic year first.",
      });
      return;
    }
    setFormResetKey((k) => k + 1);
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Class Work</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={dashboardRoute}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Academic</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Class Work
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <TooltipOption />
              <button type="button" className="btn btn-outline-light bg-white mb-2" onClick={handleRefresh}>
                <i className="ti ti-refresh me-1" />
                Refresh
              </button>
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_home_work"
                  onClick={openAddModal}
                >
                  <i className="ti ti-square-rounded-plus-filled me-2" />
                  Add Home Work
                </Link>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-warning py-2 mb-3" role="alert">
              {error}
            </div>
          )}

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Class Home Work</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    data-bs-boundary="viewport"
                    data-bs-popper-config='{"strategy":"fixed"}'
                    data-bs-auto-close="outside"
                  >
                    <i className="ti ti-filter me-2" />
                    Filter
                  </Link>
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form onSubmit={handleApplyClick}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4 className="mb-0">Filter</h4>
                      </div>
                      <div className="p-3 border-bottom pb-0">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={STATUS_FILTER_OPTIONS}
                                value={draftStatus || null}
                                onChange={(v) => setDraftStatus(v ?? "")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classFilterOptions}
                                value={draftClassId}
                                onChange={(v) => {
                                  setDraftClassId(v);
                                  setDraftSectionId(null);
                                  setDraftSubjectId(null);
                                }}
                                isDisabled={assignmentsLoading}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionFilterOptions}
                                value={draftSectionId}
                                onChange={(v) => {
                                  setDraftSectionId(v);
                                  setDraftSubjectId(null);
                                }}
                                isDisabled={!draftClassId && classFilterOptions.length <= 1}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Subject</label>
                              <CommonSelect
                                className="select"
                                options={subjectFilterOptions}
                                value={draftSubjectId}
                                onChange={setDraftSubjectId}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={handleResetFilters}>
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              <Table columns={columns} dataSource={rows} loading={loading} Selection={true} />
            </div>
          </div>
        </div>
      </div>

      <HomeworkModal
        academicYearId={academicYearId}
        assignmentOptions={assignments}
        assignmentsLoading={assignmentsLoading || (isTeacherOnly && teacherLoading)}
        formResetKey={formResetKey}
        onSuccess={refetch}
      />
      <HomeworkEditModal
        homework={editHomework}
        onSuccess={() => {
          refetch();
          setEditHomework(null);
        }}
      />
    </div>
  );
};

export default ClassHomeWork;
