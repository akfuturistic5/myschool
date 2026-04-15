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

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const GradeReport = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections } = useClassesWithSections(academicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>({ selectedExam: null, availableExams: [], subjects: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const classOptions = useMemo(() => {
    const seen = new Map<string, { value: string; label: string }>();
    (Array.isArray(classesWithSections) ? classesWithSections : []).forEach((row: any) => {
      if (row?.classId == null || seen.has(String(row.classId))) return;
      seen.set(String(row.classId), {
        value: String(row.classId),
        label: row.className || `Class ${row.classId}`,
      });
    });
    return Array.from(seen.values());
  }, [classesWithSections]);

  const sectionOptions = useMemo(() => {
    const base = [{ value: "", label: "All Sections" }];
    const items = (Array.isArray(classesWithSections) ? classesWithSections : [])
      .filter((row: any) => String(row.classId) === String(selectedClassId || ""))
      .filter((row: any) => row?.sectionId != null)
      .map((row: any) => ({
        value: String(row.sectionId),
        label: row.sectionName || `Section ${row.sectionId}`,
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
      [{ value: "", label: "Latest Exam" }].concat(
        (Array.isArray(reportData.availableExams) ? reportData.availableExams : []).map((exam: any) => ({
          value: String(exam.examId),
          label: [exam.examName, exam.examType].filter(Boolean).join(" - ") || `Exam ${exam.examId}`,
        }))
      ),
    [reportData.availableExams]
  );

  useEffect(() => {
    if (!selectedClassId && classOptions.length > 0) {
      setSelectedClassId(classOptions[0].value);
    }
  }, [classOptions, selectedClassId]);

  useEffect(() => {
    if (selectedSectionId && !sectionOptions.some((option) => option.value === selectedSectionId)) {
      setSelectedSectionId("");
    }
  }, [sectionOptions, selectedSectionId]);

  useEffect(() => {
    if (!selectedClassId) {
      setReportData({ selectedExam: null, availableExams: [], subjects: [], rows: [] });
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchReport = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getGradeReport({
          classId: selectedClassId,
          sectionId: selectedSectionId || null,
          academicYearId,
          examId: selectedExamId || null,
        });
        const payload = res?.data || { selectedExam: null, availableExams: [], subjects: [], rows: [] };
        if (!cancelled) {
          setReportData(payload);
          const nextExamId = payload?.selectedExam?.examId != null ? String(payload.selectedExam.examId) : "";
          if ((selectedExamId || "") !== nextExamId) {
            setSelectedExamId(nextExamId);
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
  }, [academicYearId, selectedClassId, selectedSectionId, selectedExamId]);

  const data = useMemo(
    () =>
      (Array.isArray(reportData.rows) ? reportData.rows : []).map((row: any, index: number) => ({
        key: row.studentId ?? `grade-report-${index}`,
        ...row,
      })),
    [reportData.rows]
  );

  const subjectColumns = useMemo(
    () =>
      (Array.isArray(reportData.subjects) ? reportData.subjects : []).map((subject: any) => ({
        title: subject.subjectName || `Subject ${subject.subjectId}`,
        key: `subject-${subject.subjectId}`,
        render: (_text: any, record: any) => {
          const marks = record.subjectMarks?.[String(subject.subjectId)];
          if (!marks) return "—";
          if (marks.isAbsent) return "AB";
          return marks.marksObtained ?? "—";
        },
        sorter: (a: any, b: any) =>
          compareNumber(
            a?.subjectMarks?.[String(subject.subjectId)]?.marksObtained,
            b?.subjectMarks?.[String(subject.subjectId)]?.marksObtained
          ),
      })),
    [reportData.subjects]
  );

  const columns = useMemo(
    () => [
      {
        title: "Admission No",
        dataIndex: "admissionNo",
        key: "admissionNo",
        sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
        render: (text: any) => <Link to="#" className="link-primary">{text || "—"}</Link>,
      },
      {
        title: "Student Name",
        dataIndex: "studentName",
        key: "studentName",
        sorter: (a: TableData, b: TableData) => compareText(a?.studentName, b?.studentName),
        render: (text: any, record: any) => (
          <div className="d-flex align-items-center">
            <Link to={routes.studentDetail} className="avatar avatar-md">
              <ImageWithBasePath
                src={record.avatar}
                className="img-fluid rounded-circle"
                alt="img"
                gender={record.gender}
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to={routes.studentDetail}>{text || "—"}</Link>
              </p>
              <span className="fs-12">Roll No : {record.rollNo || "—"}</span>
            </div>
          </div>
        ),
      },
      ...subjectColumns,
      {
        title: "Total",
        key: "total",
        render: (_text: any, record: any) => record.summary?.totalObtained ?? "—",
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
    [routes.studentDetail, subjectColumns]
  );

  const handleApply = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

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
              <TooltipOption />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <div className="mb-3">
                <h4 className="mb-1">Grade Report List</h4>
                {reportData.selectedExam && (
                  <p className="text-muted mb-0">
                    Showing {reportData.selectedExam.examName || "Latest Exam"}
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
                                onChange={(value) => setSelectedClassId(value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionOptions}
                                value={selectedSectionId ?? ""}
                                onChange={(value) => setSelectedSectionId(value ?? "")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Exam</label>
                              <CommonSelect
                                className="select"
                                options={examOptions}
                                value={selectedExamId ?? ""}
                                onChange={(value) => setSelectedExamId(value ?? "")}
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
                            setSelectedSectionId("");
                            setSelectedExamId("");
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
              {error && (
                <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                  {error}
                </div>
              )}
              {loading ? (
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
