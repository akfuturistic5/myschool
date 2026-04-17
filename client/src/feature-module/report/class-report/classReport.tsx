/* eslint-disable */
import { useEffect, useMemo, useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import type { TableData } from "../../../core/data/interface";
import PredefinedDateRanges from "../../../core/common/datePicker";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import { gender, status } from "../../../core/common/selectoption/selectoption";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import type { Dayjs } from "dayjs";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const ClassReport = () => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections, loading, error, refetch } = useClassesWithSections(academicYearId);
  const [selectedClassRow, setSelectedClassRow] = useState<any | null>(null);
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [appliedClass, setAppliedClass] = useState<string>("All");
  const [appliedSection, setAppliedSection] = useState<string>("All");
  const [appliedStatus, setAppliedStatus] = useState<string>("All");

  const [modalSelectedGender, setModalSelectedGender] = useState<string>("All");
  const [modalSelectedStatus, setModalSelectedStatus] = useState<string>("All");
  const [modalAppliedGender, setModalAppliedGender] = useState<string>("All");
  const [modalAppliedStatus, setModalAppliedStatus] = useState<string>("All");
  const [modalDateRange, setModalDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const data = useMemo(
    () =>
      (Array.isArray(classesWithSections) ? classesWithSections : []).map((row: any, index: number) => ({
        key: row.sectionId ?? `${row.classId}-${index}`,
        id: row.classCode || String(row.classId) || "—",
        class: row.className || "—",
        section: row.sectionName || "—",
        noOfStudents: Number(row.noOfStudents ?? 0),
        action: "View Details",
        classId: row.classId,
        sectionId: row.sectionId,
        status: row.status || "Inactive",
      })),
    [classesWithSections]
  );

  const classFilterOptions = useMemo(() => {
    const unique = Array.from(
      new Set(data.map((r) => String(r.class || "").trim()).filter((v) => v && v !== "—"))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Classes" }, ...unique.map((value) => ({ value, label: value }))];
  }, [data]);

  const sectionFilterOptions = useMemo(() => {
    const pool =
      appliedClass === "All" ? data : data.filter((r) => r.class === appliedClass);
    const unique = Array.from(
      new Set(pool.map((r) => String(r.section || "").trim()).filter((v) => v && v !== "—"))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Sections" }, ...unique.map((value) => ({ value, label: value }))];
  }, [appliedClass, data]);

  const filteredMainRows = useMemo(
    () =>
      data.filter((row) => {
        const classOk = appliedClass === "All" || row.class === appliedClass;
        const sectionOk = appliedSection === "All" || row.section === appliedSection;
        const statusOk = appliedStatus === "All" || row.status === appliedStatus;
        return classOk && sectionOk && statusOk;
      }),
    [appliedClass, appliedSection, appliedStatus, data]
  );

  const modalRowBase = useMemo(
    () =>
      classStudents.map((student: any, index: number) => {
        const dobRaw = student.date_of_birth ? new Date(student.date_of_birth).toISOString().slice(0, 10) : "";
        return {
          key: student.admission_number || student.id || `class-student-report-${index}`,
          studentId: student.id,
          admissionNo: student.admission_number || "—",
          rollNo: student.roll_number || "—",
          name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "—",
          class: student.class_name || selectedClassRow?.class || "—",
          section: student.section_name || "—",
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
    [classStudents, selectedClassRow]
  );

  const genderKey = (g: string) => {
    const v = String(g || "").trim().toLowerCase();
    if (v === "m") return "male";
    if (v === "f") return "female";
    return v;
  };

  const filteredModalRows = useMemo(
    () =>
      modalRowBase.filter((row) => {
        const genderOk =
          modalAppliedGender === "All" || genderKey(row.gender) === modalAppliedGender;
        const statusOk = modalAppliedStatus === "All" || row.status === modalAppliedStatus;
        const dateOk =
          !modalDateRange ||
          (row.dobRaw &&
            row.dobRaw >= modalDateRange[0].format("YYYY-MM-DD") &&
            row.dobRaw <= modalDateRange[1].format("YYYY-MM-DD"));
        return genderOk && statusOk && dateOk;
      }),
    [modalAppliedGender, modalAppliedStatus, modalDateRange, modalRowBase]
  );

  const routes = all_routes;

  useEffect(() => {
    if (!selectedClassRow?.classId) {
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
          rows = all.filter((s: any) => Number(s.class_id) === Number(selectedClassRow.classId));
        } else {
          const response = await apiService.getStudentsByClass(selectedClassRow.classId);
          rows = Array.isArray(response?.data) ? response.data : [];
        }
        const filteredRows = selectedClassRow.sectionId
          ? rows.filter((student: any) => Number(student.section_id) === Number(selectedClassRow.sectionId))
          : rows;
        if (!cancelled) setClassStudents(filteredRows);
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
  }, [selectedClassRow, academicYearId]);

  const mainExportColumns = useMemo(
    () => [
      { title: "ID", dataKey: "id" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "No Of Students", dataKey: "noOfStudents" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const handleMainExportExcel = () => {
    const rows = filteredMainRows.map((row) => ({
      ID: row.id,
      Class: row.class,
      Section: row.section,
      "No Of Students": row.noOfStudents,
      Status: row.status,
    }));
    exportToExcel(rows, `ClassReport_${new Date().toISOString().split("T")[0]}`);
  };

  const handleMainExportPDF = () => {
    const rows = filteredMainRows.map((r) => ({
      ...r,
      noOfStudents: String(r.noOfStudents ?? ""),
    }));
    exportToPDF(rows, "Class Report", `ClassReport_${new Date().toISOString().split("T")[0]}`, mainExportColumns);
  };

  const handleMainPrint = () => {
    const rows = filteredMainRows.map((r) => ({
      ...r,
      noOfStudents: String(r.noOfStudents ?? ""),
    }));
    printData("Class Report", mainExportColumns, rows);
  };

  const modalExportColumns = useMemo(
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

  const handleModalExportExcel = () => {
    const rows = filteredModalRows.map((row) => ({
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

  const handleModalExportPDF = () => {
    exportToPDF(
      filteredModalRows,
      "Class Report — Students",
      `ClassReportStudents_${new Date().toISOString().split("T")[0]}`,
      modalExportColumns
    );
  };

  const handleModalPrint = () => {
    printData("Class Report — Students", modalExportColumns, filteredModalRows);
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (id: string) => (
        <Link to="#" className="link-primary">
          {id}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.id, (b as any)?.id),
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
      title: "No Of Students",
      dataIndex: "noOfStudents",
      sorter: (a: TableData, b: TableData) => compareNumber((a as any)?.noOfStudents, (b as any)?.noOfStudents),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_text: string, record: any) => (
        <Link
          to="#"
          className="btn btn-light view details"
          data-bs-toggle="modal"
          data-bs-target="#view_class_report"
          onClick={() => {
            setSelectedClassRow(record);
            setModalSelectedGender("All");
            setModalSelectedStatus("All");
            setModalAppliedGender("All");
            setModalAppliedStatus("All");
            setModalDateRange(null);
          }}
        >
          View Details
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.action, (b as any)?.action),
    },
  ];

  const columns2 = [
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

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const handleApplyClick = () => {
    setAppliedClass(selectedClass);
    setAppliedSection(selectedSection);
    setAppliedStatus(selectedStatus);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    setSelectedClass("All");
    setSelectedSection("All");
    setSelectedStatus("All");
    setAppliedClass("All");
    setAppliedSection("All");
    setAppliedStatus("All");
  };

  const handleModalApply = () => {
    setModalAppliedGender(modalSelectedGender);
    setModalAppliedStatus(modalSelectedStatus);
  };

  const handleModalReset = () => {
    setModalSelectedGender("All");
    setModalSelectedStatus("All");
    setModalAppliedGender("All");
    setModalAppliedStatus("All");
    setModalDateRange(null);
  };

  const statusFilterOptions = [{ value: "All", label: "All Status" }, ...status];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Class Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Class Report
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={refetch}
                onPrint={handleMainPrint}
                onExportExcel={handleMainExportExcel}
                onExportPdf={handleMainExportPDF}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Class Report List</h4>
              <div className="d-flex align-items-center flex-wrap">
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
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classFilterOptions}
                                value={selectedClass}
                                onChange={(value: any) => setSelectedClass(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionFilterOptions}
                                value={selectedSection}
                                onChange={(value: any) => setSelectedSection(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
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
                        <Link to="#" className="btn btn-light me-3" onClick={handleResetFilters}>
                          Reset
                        </Link>
                        <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>
                          Apply
                        </Link>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {error && (
                <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && data.length === 0 && (
                <div className="alert alert-info mx-3 mt-3 mb-0" role="alert">
                  No class sections found. Add classes and sections for the selected academic year, or pick a different
                  year from the header.
                </div>
              )}
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading class report...</p>
                </div>
              ) : (
                <Table columns={columns} dataSource={filteredMainRows} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="view_class_report">
        <div className="modal-dialog modal-dialog-centered modal-xl">
          <div className="modal-content">
            <div className="modal-wrapper">
              <div className="modal-body">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                  <h5 className="mb-0">
                    Students — {selectedClassRow?.class || "—"} / {selectedClassRow?.section || "—"}
                  </h5>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleModalExportExcel}>
                      <i className="ti ti-file-type-xls me-1" />
                      Excel
                    </button>
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleModalExportPDF}>
                      <i className="ti ti-file-type-pdf me-1" />
                      PDF
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleModalPrint}>
                      <i className="ti ti-printer me-1" />
                      Print
                    </button>
                    <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                </div>

                <div className="row g-2 align-items-end mb-3">
                  <div className="col-md-4">
                    <label className="form-label small text-muted">Date of birth range</label>
                    <PredefinedDateRanges onChange={(range: [Dayjs, Dayjs]) => setModalDateRange(range)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Gender</label>
                    <CommonSelect
                      className="select"
                      options={[{ value: "All", label: "All Gender" }, ...gender]}
                      value={modalSelectedGender}
                      onChange={(value: any) => setModalSelectedGender(String(value))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Status</label>
                    <CommonSelect
                      className="select"
                      options={statusFilterOptions}
                      value={modalSelectedStatus}
                      onChange={(value: any) => setModalSelectedStatus(String(value))}
                    />
                  </div>
                  <div className="col-md-2 d-flex gap-1 justify-content-md-end">
                    <button type="button" className="btn btn-light btn-sm" onClick={handleModalReset}>
                      Reset
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleModalApply}>
                      Apply
                    </button>
                  </div>
                </div>

                {studentsError && (
                  <div className="alert alert-danger mb-3" role="alert">
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
                ) : (
                  <Table columns={columns2} dataSource={filteredModalRows} Selection={true} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassReport;
