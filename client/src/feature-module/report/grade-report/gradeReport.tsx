import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Table from "../../../core/common/dataTable/index";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { all_routes } from "../../router/all_routes";
import type { TableData } from "../../../core/data/interface";
import CommonSelect from "../../../core/common/commonSelect";
import TooltipOption from "../../../core/common/tooltipOption";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const formatTotalMarks = (summary: any) => {
  const obtained = summary?.totalObtained;
  const max = summary?.totalMax;
  if (obtained == null && (max == null || max === 0)) return "—";
  if (max == null || Number(max) === 0) {
    return obtained != null ? String(obtained) : "—";
  }
  return `${obtained ?? 0}/${max}`;
};

const CLASS_ALL = "all";
const SECTION_ALL = "all";
const EXAM_LATEST = "latest";

const GradeReport = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections, loading: classesLoading, error: classesError, refetch: refetchClasses } =
    useClassesWithSections(academicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>(CLASS_ALL);
  const [selectedSectionId, setSelectedSectionId] = useState<string>(SECTION_ALL);
  const [selectedExamId, setSelectedExamId] = useState<string>(EXAM_LATEST);
  const [reportData, setReportData] = useState<any>({ selectedExam: null, availableExams: [], subjects: [], rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const classOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    (Array.isArray(classesWithSections) ? classesWithSections : []).forEach((row: any) => {
      if (row?.classId == null || seen.has(String(row.classId))) return;
      seen.set(String(row.classId), {
        value: String(row.classId),
        label: row.className || `Class ${row.classId}`,
      });
    });
    return [{ value: CLASS_ALL, label: "All Classes" }, ...Array.from(seen.values())];
  }, [classesWithSections]);

  const sectionOptions = useMemo(() => {
    const base = [{ value: SECTION_ALL, label: "All Sections" }];
    const pool =
      selectedClassId === CLASS_ALL
        ? Array.isArray(classesWithSections)
          ? classesWithSections
          : []
        : (Array.isArray(classesWithSections) ? classesWithSections : []).filter(
            (row: any) => String(row.classId) === String(selectedClassId)
          );
    const items = pool
      .filter((row: any) => row?.sectionId != null)
      .map((row: any) => ({
        value: String(row.sectionId),
        label:
          selectedClassId === CLASS_ALL
            ? `${row.className || "Class"} — ${row.sectionName || `Section ${row.sectionId}`}`
            : row.sectionName || `Section ${row.sectionId}`,
      }));

    const seen = new Set<string>();
    return base.concat(
      items.filter((item) => {
        if (seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      })
    );
  }, [classesWithSections, selectedClassId]);

  const examOptions = useMemo(
    () =>
      [{ value: EXAM_LATEST, label: "Latest Exam" }].concat(
        (Array.isArray(reportData.availableExams) ? reportData.availableExams : []).map((exam: any) => ({
          value: String(exam.examId),
          label: [exam.examName, exam.examType].filter(Boolean).join(" - ") || `Exam ${exam.examId}`,
        }))
      ),
    [reportData.availableExams]
  );

  useEffect(() => {
    if (selectedSectionId !== SECTION_ALL && !sectionOptions.some((option) => option.value === selectedSectionId)) {
      setSelectedSectionId(SECTION_ALL);
    }
  }, [sectionOptions, selectedSectionId]);

  useEffect(() => {
    if (selectedExamId !== EXAM_LATEST && !examOptions.some((option) => option.value === selectedExamId)) {
      setSelectedExamId(EXAM_LATEST);
    }
  }, [examOptions, selectedExamId]);

  useEffect(() => {
    if (!classOptions.some((o) => o.value === selectedClassId)) {
      setSelectedClassId(CLASS_ALL);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    if (academicYearId == null) {
      setReportData({ selectedExam: null, availableExams: [], subjects: [], rows: [] });
      setError("Select an academic year from the header to load the grade report.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getGradeReport({
          classId: selectedClassId === CLASS_ALL ? null : selectedClassId,
          sectionId: selectedSectionId === SECTION_ALL ? null : selectedSectionId,
          academicYearId,
          examId: selectedExamId === EXAM_LATEST ? null : selectedExamId,
        });
        const isSuccess =
          res &&
          (res.status === "SUCCESS" ||
            res.success === true ||
            (res.data != null && typeof res.data === "object"));
        const payload =
          isSuccess && res?.data != null && typeof res.data === "object" && !Array.isArray(res.data)
            ? res.data
            : { selectedExam: null, availableExams: [], subjects: [], rows: [] };
        if (!cancelled) {
          setReportData(payload);
          if (!isSuccess && res?.message) {
            setError(String(res.message));
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to fetch grade report");
          setReportData({ selectedExam: null, availableExams: [], subjects: [], rows: [] });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, selectedClassId, selectedSectionId, selectedExamId, refreshTick]);

  const data = useMemo(
    () =>
      (Array.isArray(reportData.rows) ? reportData.rows : []).map((row: any, index: number) => ({
        key: row.studentId ?? `grade-report-${index}`,
        ...row,
      })),
    [reportData.rows]
  );

  const columns = useMemo(
    () => [
      {
        title: "Admission No",
        dataIndex: "admissionNo",
        key: "admissionNo",
        sorter: (a: TableData, b: TableData) => compareText((a as any)?.admissionNo, (b as any)?.admissionNo),
        render: (text: any) => (
          <Link to="#" className="link-primary">
            {text || "—"}
          </Link>
        ),
      },
      {
        title: "Class",
        dataIndex: "className",
        key: "className",
        sorter: (a: TableData, b: TableData) => compareText((a as any)?.className, (b as any)?.className),
        render: (text: any) => text || "—",
      },
      {
        title: "Section",
        dataIndex: "sectionName",
        key: "sectionName",
        sorter: (a: TableData, b: TableData) => compareText((a as any)?.sectionName, (b as any)?.sectionName),
        render: (text: any) => text || "—",
      },
      {
        title: "Student Name",
        dataIndex: "studentName",
        key: "studentName",
        sorter: (a: TableData, b: TableData) => compareText((a as any)?.studentName, (b as any)?.studentName),
        render: (text: any, record: any) => (
          <div className="d-flex align-items-center">
            <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList} className="avatar avatar-md">
              <ImageWithBasePath
                src={record.avatar}
                className="img-fluid rounded-circle"
                alt="img"
                gender={record.gender}
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}>
                  {text || "—"}
                </Link>
              </p>
              <span className="fs-12">Roll No : {record.rollNo || "—"}</span>
            </div>
          </div>
        ),
      },
      {
        title: "Total",
        key: "total",
        render: (_text: any, record: any) => formatTotalMarks(record.summary),
        sorter: (a: any, b: any) => compareNumber(a?.summary?.totalObtained, b?.summary?.totalObtained),
      },
      {
        title: "Percent(%)",
        key: "percent",
        render: (_text: any, record: any) => record.summary?.percentage ?? "—",
        sorter: (a: any, b: any) => compareNumber(a?.summary?.percentage, b?.summary?.percentage),
      },
      {
        title: "Grade",
        key: "grade",
        render: (_text: any, record: any) => {
          const grade = record.summary?.grade || "—";
          const textColor = grade === "F" ? "text-danger" : "";
          return <span className={textColor}>{grade}</span>;
        },
        sorter: (a: any, b: any) => compareText(a?.summary?.grade, b?.summary?.grade),
      },
    ],
    [routes.studentDetail, routes.studentList]
  );

  const exportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Class", dataKey: "className" },
      { title: "Section", dataKey: "sectionName" },
      { title: "Student Name", dataKey: "studentName" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Total", dataKey: "totalMarks" },
      { title: "Percent(%)", dataKey: "percentage" },
      { title: "Grade", dataKey: "grade" },
    ],
    []
  );

  const exportRows = useMemo(() => {
    return data.map((row: any) => {
      return {
        admissionNo: row.admissionNo ?? "—",
        className: row.className ?? "—",
        sectionName: row.sectionName ?? "—",
        studentName: row.studentName ?? "—",
        rollNo: row.rollNo ?? "—",
        totalMarks: formatTotalMarks(row.summary),
        percentage: row.summary?.percentage ?? "—",
        grade: row.summary?.grade ?? "—",
      };
    });
  }, [data]);

  const handleExportExcel = () => {
    const rows = data.map((row: any) => {
      return {
        "Admission No": row.admissionNo ?? "—",
        Class: row.className ?? "—",
        Section: row.sectionName ?? "—",
        "Student Name": row.studentName ?? "—",
        "Roll No": row.rollNo ?? "—",
        Total: formatTotalMarks(row.summary),
        "Percent(%)": row.summary?.percentage ?? "—",
        Grade: row.summary?.grade ?? "—",
      };
    });
    const stamp = new Date().toISOString().split("T")[0];
    exportToExcel(rows, `GradeReport_${stamp}`);
  };

  const handleExportPDF = () => {
    const stamp = new Date().toISOString().split("T")[0];
    exportToPDF(exportRows, "Grade Report", `GradeReport_${stamp}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Grade Report", exportColumns, exportRows);
  };

  const handleApply = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const tableLoading = classesLoading || loading;
  const noClassConfigured = !classesLoading && classOptions.length <= 1;
  const noExamData =
    !tableLoading &&
    !error &&
    academicYearId != null &&
    Array.isArray(reportData.availableExams) &&
    reportData.availableExams.length === 0 &&
    data.length === 0;

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Grade Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Grade Report
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={() => {
                  refetchClasses();
                  setRefreshTick((t) => t + 1);
                }}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <div className="mb-3">
                <h4 className="mb-1">Grade Report List</h4>
                {reportData.selectedExam && (
                  <p className="text-muted mb-0">
                    Showing {reportData.selectedExam.examName || "Exam"} —{" "}
                    {[reportData.selectedExam.examType].filter(Boolean).join(" ")}
                  </p>
                )}
              </div>
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
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classOptions}
                                value={selectedClassId}
                                onChange={(value) => setSelectedClassId(value || CLASS_ALL)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionOptions}
                                value={selectedSectionId}
                                onChange={(value) => setSelectedSectionId(value || SECTION_ALL)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Exam</label>
                              <CommonSelect
                                className="select"
                                options={examOptions}
                                value={selectedExamId}
                                onChange={(value) => setSelectedExamId(value || EXAM_LATEST)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link
                          to="#"
                          className="btn btn-light me-3"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedClassId(CLASS_ALL);
                            setSelectedSectionId(SECTION_ALL);
                            setSelectedExamId(EXAM_LATEST);
                          }}
                        >
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary" onClick={handleApply}>
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {(error || classesError) && (
                <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                  {error || classesError}
                </div>
              )}
              {noClassConfigured && (
                <div className="alert alert-info mx-3 mt-3 mb-0" role="alert">
                  No classes found for the selected academic year. Choose an academic year that has classes, or add
                  classes in Academic Settings.
                </div>
              )}
              {noExamData && (
                <div className="alert alert-info mx-3 mt-3 mb-0" role="alert">
                  No exams are scheduled for the selected academic year. Add exam schedules and enter marks in Exam
                  Results to see the grade report.
                </div>
              )}
              {!tableLoading && !error && data.length > 0 && reportData.availableExams?.length === 0 && (
                <div className="alert alert-warning mx-3 mt-3 mb-0" role="alert">
                  Students are listed, but no exam timetable was found for the selected filters.
                </div>
              )}
              {tableLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading grade report...</p>
                </div>
              ) : (
                <Table dataSource={data} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeReport;

