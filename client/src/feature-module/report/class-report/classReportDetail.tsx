/* eslint-disable */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import PredefinedDateRanges from "../../../core/common/datePicker";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import { gender, status } from "../../../core/common/selectoption/selectoption";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import type { Dayjs } from "dayjs";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

type LocationState = {
  className?: string;
  sectionName?: string;
};

const ClassReportDetail = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const location = useLocation();
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const { classId: classIdParam, sectionId: sectionIdParam } = useParams();
  const state = (location.state as LocationState) || {};

  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const classId = classIdParam ? Number(classIdParam) : null;
  const initialSectionId =
    sectionIdParam && sectionIdParam !== "0" ? Number(sectionIdParam) : null;

  const [resolvedClassName, setResolvedClassName] = useState(state.className || "");
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [sectionOptions, setSectionOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "All", label: "All Sections" },
  ]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [selectedSection, setSelectedSection] = useState<string>(
    initialSectionId != null ? String(initialSectionId) : "All"
  );
  const [appliedSection, setAppliedSection] = useState<string>(
    initialSectionId != null ? String(initialSectionId) : "All"
  );
  const [selectedGender, setSelectedGender] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [appliedGender, setAppliedGender] = useState<string>("All");
  const [appliedStatus, setAppliedStatus] = useState<string>("All");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const className = resolvedClassName || "—";

  useEffect(() => {
    if (!classId || Number.isNaN(classId) || resolvedClassName) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getClassById(classId);
        const name = res?.data?.class_name || res?.data?.className;
        if (!cancelled && name) setResolvedClassName(String(name));
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, resolvedClassName]);

  useEffect(() => {
    if (!classId || Number.isNaN(classId)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getClassSections(classId, academicYearId);
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (cancelled) return;
        const opts = [
          { value: "All", label: "All Sections" },
          ...rows
            .filter((s: any) => s.section_id != null)
            .map((s: any) => ({
              value: String(s.section_id),
              label: s.section_name || `Section ${s.section_id}`,
            })),
        ];
        const seen = new Set<string>();
        setSectionOptions(
          opts.filter((o) => {
            if (seen.has(o.value)) return false;
            seen.add(o.value);
            return true;
          })
        );
      } catch {
        if (!cancelled) setSectionOptions([{ value: "All", label: "All Sections" }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, academicYearId]);

  useEffect(() => {
    if (initialSectionId != null && sectionOptions.some((o) => o.value === String(initialSectionId))) {
      setSelectedSection(String(initialSectionId));
      setAppliedSection(String(initialSectionId));
    }
  }, [initialSectionId, sectionOptions]);

  useEffect(() => {
    if (!classId || Number.isNaN(classId)) {
      setClassStudents([]);
      setStudentsError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setStudentsLoading(true);
        setStudentsError(null);
        let rows: any[] = [];
        if (academicYearId != null) {
          const response = await apiService.getStudents(academicYearId);
          const all = Array.isArray(response?.data) ? response.data : [];
          rows = all.filter((s: any) => Number(s.class_id) === Number(classId));
        } else {
          const response = await apiService.getStudentsByClass(classId);
          rows = Array.isArray(response?.data) ? response.data : [];
        }
        if (!cancelled) setClassStudents(rows);
      } catch (err: any) {
        if (!cancelled) {
          setStudentsError(err?.message || "Failed to fetch class students");
          setClassStudents([]);
        }
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, academicYearId]);

  const studentRows = useMemo(
    () =>
      classStudents.map((student: any, index: number) => {
        const dobRaw = student.date_of_birth ? new Date(student.date_of_birth).toISOString().slice(0, 10) : "";
        return {
          key: student.admission_number || student.id || `class-student-report-${index}`,
          studentId: student.id,
          admissionNo: student.admission_number || "—",
          rollNo: student.roll_number || "—",
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "—",
          class: student.class_name || className,
          section: student.section_name || "—",
          sectionId: student.section_id,
          gender: student.gender || "—",
          parent:
            student.father_name ||
            student.mother_name ||
            [student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(" ") ||
            "—",
          dob: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—",
          dobRaw,
          status: student.is_active ? "Active" : "Inactive",
          imgSrc: student.photo_url || "",
        };
      }),
    [classStudents, className]
  );

  const genderKey = (g: string) => {
    const v = String(g || "").trim().toLowerCase();
    if (v === "m") return "male";
    if (v === "f") return "female";
    return v;
  };

  const filteredRows = useMemo(
    () =>
      studentRows.filter((row) => {
        const sectionOk =
          appliedSection === "All" || String(row.sectionId) === String(appliedSection);
        const genderOk = appliedGender === "All" || genderKey(row.gender) === appliedGender;
        const statusOk = appliedStatus === "All" || row.status === appliedStatus;
        const dateOk =
          !dateRange ||
          (row.dobRaw &&
            row.dobRaw >= dateRange[0].format("YYYY-MM-DD") &&
            row.dobRaw <= dateRange[1].format("YYYY-MM-DD"));
        return sectionOk && genderOk && statusOk && dateOk;
      }),
    [appliedGender, appliedSection, appliedStatus, dateRange, studentRows]
  );

  const appliedSectionLabel =
    appliedSection === "All"
      ? "All Sections"
      : sectionOptions.find((o) => o.value === appliedSection)?.label || "—";

  const exportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Name", dataKey: "name" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Gender", dataKey: "gender" },
      { title: "Parent", dataKey: "parent" },
      { title: "DOB", dataKey: "dob" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const handleExportExcel = () => {
    const rows = filteredRows.map((row) => ({
      "Admission No": row.admissionNo,
      "Roll No": row.rollNo,
      Name: row.name,
      Class: row.class,
      Section: row.section,
      Gender: row.gender,
      Parent: row.parent,
      DOB: row.dob,
      Status: row.status,
    }));
    exportToExcel(rows, `ClassReportStudents_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPDF = () => {
    exportToPDF(
      filteredRows,
      "Class Report — Students",
      `ClassReportStudents_${new Date().toISOString().split("T")[0]}`,
      exportColumns
    );
  };

  const handlePrint = () => {
    printData("Class Report — Students", exportColumns, filteredRows);
  };

  const handleApplyFilters = () => {
    setAppliedSection(selectedSection);
    setAppliedGender(selectedGender);
    setAppliedStatus(selectedStatus);
    if (filterMenuRef.current) {
      filterMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    const defaultSection = initialSectionId != null ? String(initialSectionId) : "All";
    setSelectedSection(defaultSection);
    setSelectedGender("All");
    setSelectedStatus("All");
    setDateRange(null);
    setAppliedSection(defaultSection);
    setAppliedGender("All");
    setAppliedStatus("All");
  };

  const statusFilterOptions = [{ value: "All", label: "All Status" }, ...status];
  const genderFilterOptions = [{ value: "All", label: "All Gender" }, ...gender];

  const columns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      render: (admissionNo: string, record: any) => (
        <Link
          to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
          className="link-primary"
        >
          {admissionNo}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.admissionNo, (b as any)?.admissionNo),
    },
    {
      title: "Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.rollNo, (b as any)?.rollNo),
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (_text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
            className="avatar avatar-md"
          >
            <ImageWithBasePath
              src={record.imgSrc}
              className="img-fluid rounded-circle"
              alt="img"
              gender={record.gender}
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}>
                {record.name}
              </Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.name, (b as any)?.name),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.class, (b as any)?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.section, (b as any)?.section),
    },
    {
      title: "Gender",
      dataIndex: "gender",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.gender, (b as any)?.gender),
    },
    {
      title: "Parent",
      dataIndex: "parent",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.parent, (b as any)?.parent),
    },
    {
      title: "DOB",
      dataIndex: "dob",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.dob, (b as any)?.dob),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) =>
        text === "Active" ? (
          <span className="badge badge-soft-success d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1"></i>
            {text}
          </span>
        ) : (
          <span className="badge badge-soft-danger d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1"></i>
            {text}
          </span>
        ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.status, (b as any)?.status),
    },
  ];

  if (!classId || Number.isNaN(classId)) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning">Invalid class. Return to the class report list.</div>
          <Link to={routes.classReport} className="btn btn-primary">
            Back to Class Report
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">
                Students — {className}
                {appliedSection !== "All" ? ` (${appliedSectionLabel})` : ""}
              </h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={routes.classReport}>Class Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Class Details
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <button type="button" className="btn btn-light" onClick={() => navigate(routes.classReport)}>
                <i className="ti ti-arrow-left me-1" />
                Back
              </button>
              <TooltipOption
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Student List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="mb-3 me-2">
                  <PredefinedDateRanges onChange={(range: [Dayjs, Dayjs]) => setDateRange(range)} />
                </div>
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                  >
                    <i className="ti ti-filter me-2" />
                    Filter
                  </Link>
                  <div className="dropdown-menu drop-width" ref={filterMenuRef}>
                    <form onSubmit={(e) => e.preventDefault()}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionOptions}
                                value={selectedSection}
                                onChange={(value: any) => setSelectedSection(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Gender</label>
                              <CommonSelect
                                className="select"
                                options={genderFilterOptions}
                                value={selectedGender}
                                onChange={(value: any) => setSelectedGender(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={statusFilterOptions}
                                value={selectedStatus}
                                onChange={(value: any) => setSelectedStatus(String(value))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={handleResetFilters}>
                          Reset
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleApplyFilters}>
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {studentsError && (
                <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                  {studentsError}
                </div>
              )}
              {studentsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading class students...</p>
                </div>
              ) : !studentsError && filteredRows.length === 0 ? (
                <div className="alert alert-info mx-3 mt-3 mb-0" role="alert">
                  No students match the selected filters.
                </div>
              ) : (
                <Table columns={columns} dataSource={filteredRows} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassReportDetail;
