import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import CommonSelect from "../../../../core/common/commonSelect";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSections } from "../../../../core/hooks/useSections";
import { useStudents } from "../../../../core/hooks/useStudents";
import { apiService } from "../../../../core/services/apiService.js";
import { isAdministrativeRole, isHeadmasterRole } from "../../../../core/utils/roleUtils";

const StudentPromotion = () => {
  /** Show roster + checkboxes immediately (otherwise the list block stays hidden until "Manage Promotion"). */
  const [isPromotion, setIsPromotion] = useState<boolean>(true);
  const routes = all_routes;
  const promoteModalRef = useRef<HTMLDivElement>(null);

  const fromAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const { students, loading: studentsLoading, error: studentsError, refetch: refetchStudents } =
    useStudents();
  const { academicYears, loading: academicYearsLoading, error: academicYearsError } =
    useAcademicYears();

  const { classes: classesFrom, loading: classesFromLoading, error: classesFromError } =
    useClasses(fromAcademicYearId ?? null);

  const [toAcademicYearId, setToAcademicYearId] = useState<string>("");
  const [fromClassId, setFromClassId] = useState<string>("");
  const [fromSectionId, setFromSectionId] = useState<string>("");
  const [toClassId, setToClassId] = useState<string>("");
  const [toSectionId, setToSectionId] = useState<string>("");

  const toYearNum = toAcademicYearId ? parseInt(toAcademicYearId, 10) : null;
  const { classes: classesTo, loading: classesToLoading, error: classesToError } =
    useClasses(toYearNum);

  const fromClassNum = fromClassId ? parseInt(fromClassId, 10) : null;
  const toClassNum = toClassId ? parseInt(toClassId, 10) : null;
  const {
    sections: fromSections,
    loading: fromSectionsLoading,
    error: fromSectionsError,
  } = useSections(fromClassNum);
  const {
    sections: toSections,
    loading: toSectionsLoading,
    error: toSectionsError,
  } = useSections(toClassNum);

  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteSuccess, setPromoteSuccess] = useState<string | null>(null);

  const user = useSelector(selectUser);
  const canPromote = Boolean(
    user && (isHeadmasterRole(user) || isAdministrativeRole(user))
  );

  useEffect(() => {
    if (!academicYears?.length) return;
    setToAcademicYearId((prev) => {
      if (prev && academicYears.some((y) => String(y.id) === prev)) return prev;
      const other = academicYears.find(
        (y) => fromAcademicYearId == null || Number(y.id) !== Number(fromAcademicYearId)
      );
      return String((other ?? academicYears[0]).id);
    });
  }, [academicYears, fromAcademicYearId]);

  useEffect(() => {
    if (!classesFrom.length) return;
    setFromClassId((prev) => {
      if (prev && classesFrom.some((c) => String(c.id) === prev)) return prev;
      return String(classesFrom[0].id);
    });
  }, [classesFrom]);

  useEffect(() => {
    if (!fromSections.length || !fromClassId) return;
    setFromSectionId((prev) => {
      if (prev && fromSections.some((sec) => String(sec.id) === prev)) return prev;
      return String(fromSections[0].id);
    });
  }, [fromSections, fromClassId]);

  useEffect(() => {
    if (!classesTo.length || !toAcademicYearId) return;
    setToClassId((prev) => {
      if (prev && classesTo.some((c) => String(c.id) === prev)) return prev;
      return String(classesTo[0].id);
    });
  }, [classesTo, toAcademicYearId]);

  useEffect(() => {
    if (!toSections.length || !toClassId) return;
    setToSectionId((prev) => {
      if (prev && toSections.some((sec) => String(sec.id) === prev)) return prev;
      return String(toSections[0].id);
    });
  }, [toSections, toClassId]);

  const currentYearLabel = useMemo(() => {
    if (fromAcademicYearId == null) return "—";
    const y = academicYears?.find((a) => Number(a.id) === Number(fromAcademicYearId));
    return y?.year_name ?? `Year #${fromAcademicYearId}`;
  }, [academicYears, fromAcademicYearId]);

  const targetYearLabel = useMemo(() => {
    if (!toAcademicYearId) return "—";
    const y = academicYears?.find((a) => String(a.id) === toAcademicYearId);
    return y?.year_name ?? `Year #${toAcademicYearId}`;
  }, [academicYears, toAcademicYearId]);

  const normLabel = (v: string | null | undefined) =>
    String(v ?? "")
      .trim()
      .toLowerCase();

  /**
   * Match by class_id/section_id first (correct when student.class_id is the same row as the dropdown).
   * Fallback: match by class_name + section_name — needed when class rows are duplicated per academic year
   * but legacy student rows still point at another year's class id while academic_year_id is correct.
   */
  const filteredStudents = useMemo(() => {
    if (!fromClassId) return students;
    const cid = parseInt(fromClassId, 10);
    if (Number.isNaN(cid)) return students;

    const fromClass = classesFrom.find((c) => String(c.id) === fromClassId);
    const fromSec = fromSections.find((sec) => String(sec.id) === fromSectionId);
    const wantClassName = normLabel(fromClass?.class_name);
    const wantSectionName = fromSectionId ? normLabel(fromSec?.section_name) : "";

    return students.filter((s: any) => {
      const sid = fromSectionId ? parseInt(fromSectionId, 10) : NaN;
      const idMatch =
        Number(s.class_id) === cid &&
        (!fromSectionId || Number.isNaN(sid) || Number(s.section_id) === sid);

      const nameMatch =
        !!wantClassName &&
        normLabel(s.class_name) === wantClassName &&
        (!fromSectionId ||
          !wantSectionName ||
          normLabel(s.section_name) === wantSectionName);

      return idMatch || nameMatch;
    });
  }, [students, fromClassId, fromSectionId, classesFrom, fromSections]);

  const data = useMemo(
    () =>
      filteredStudents.map((student: any) => ({
        key: String(student.id),
        studentId: student.id,
        student,
        AdmissionNo: student.admission_number ?? "",
        RollNo: student.roll_number ?? "",
        name:
          [student.first_name, student.last_name].filter(Boolean).join(" ") || "N/A",
        class: student.class_name ?? "N/A",
        section: student.section_name ?? "N/A",
        result: "N/A",
        imgSrc: student.photo_url || "assets/img/students/student-01.jpg",
      })),
    [filteredStudents]
  );

  const fromClassName =
    classesFrom.find((c) => String(c.id) === fromClassId)?.class_name ?? "—";
  const fromSectionName =
    fromSections.find((s) => String(s.id) === fromSectionId)?.section_name ?? "—";
  const toClassName = classesTo.find((c) => String(c.id) === toClassId)?.class_name ?? "—";
  const toSectionName =
    toSections.find((s) => String(s.id) === toSectionId)?.section_name ?? "—";

  const classOptionsFrom = useMemo(
    () =>
      classesFrom.map((cls) => ({
        value: cls.id.toString(),
        label: cls.class_name,
      })),
    [classesFrom]
  );
  const classOptionsTo = useMemo(
    () =>
      classesTo.map((cls) => ({
        value: cls.id.toString(),
        label: cls.class_name,
      })),
    [classesTo]
  );
  const sectionOptionsFrom = useMemo(
    () =>
      fromSections.map((section) => ({
        value: section.id.toString(),
        label: section.section_name,
      })),
    [fromSections]
  );
  const sectionOptionsTo = useMemo(
    () =>
      toSections.map((section) => ({
        value: section.id.toString(),
        label: section.section_name,
      })),
    [toSections]
  );
  const yearOptions = useMemo(
    () =>
      (academicYears ?? []).map((year) => ({
        value: year.id.toString(),
        label: year.year_name,
      })),
    [academicYears]
  );

  const onTableSelectionChange = useCallback((keys: (string | number)[]) => {
    setSelectedRowKeys(keys);
  }, []);

  useEffect(() => {
    setSelectedRowKeys((prev) => prev.filter((k) => data.some((row) => row.key === k)));
  }, [data]);

  const columns = useMemo(
    () => [
      {
        title: "Admission No",
        dataIndex: "AdmissionNo",
        render: (text: string, record: any) => (
          <Link
            to={routes.studentDetail}
            state={{ studentId: record.studentId, student: record.student }}
            className="link-primary"
          >
            {text}
          </Link>
        ),
        sorter: (a: TableData, b: TableData) =>
          String(a.AdmissionNo).length - String(b.AdmissionNo).length,
      },
      {
        title: "Roll No",
        dataIndex: "RollNo",
        sorter: (a: TableData, b: TableData) =>
          String(a.RollNo).length - String(b.RollNo).length,
      },
      {
        title: "Name",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div className="d-flex align-items-center">
            <Link
              to={routes.studentDetail}
              state={{ studentId: record.studentId, student: record.student }}
              className="avatar avatar-md"
            >
              <ImageWithBasePath
                src={record.imgSrc}
                className="img-fluid rounded-circle"
                alt="img"
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link
                  to={routes.studentDetail}
                  state={{ studentId: record.studentId, student: record.student }}
                >
                  {text}
                </Link>
              </p>
            </div>
          </div>
        ),
        sorter: (a: TableData, b: TableData) => String(a.name).length - String(b.name).length,
      },
      {
        title: "Class",
        dataIndex: "class",
        sorter: (a: TableData, b: TableData) =>
          String(a.class).length - String(b.class).length,
      },
      {
        title: "Section",
        dataIndex: "section",
        sorter: (a: TableData, b: TableData) =>
          String(a.section).length - String(b.section).length,
      },
      {
        title: "Exam Result",
        dataIndex: "result",
        render: (text: string) => (
          <>
            {text === "Pass" ? (
              <span className="badge badge-soft-success d-inline-flex align-items-center">
                <i className="ti ti-circle-filled fs-5 me-1"></i>
                {text}
              </span>
            ) : (
              <span className="badge badge-soft-danger d-inline-flex align-items-center">
                <i className="ti ti-circle-filled fs-5 me-1"></i>
                {text}
              </span>
            )}
          </>
        ),
        sorter: (a: TableData, b: TableData) =>
          String(a.result).length - String(b.result).length,
      },
    ],
    [all_routes.studentDetail]
  );

  /** Same pattern as profile password modal — use getOrCreateInstance; ref alone can miss the node timing. */
  const hidePromoteModal = () => {
    const el =
      (document.getElementById("student_promote") as HTMLElement | null) ??
      promoteModalRef.current;
    if (!el) return;
    try {
      const Modal = (window as unknown as { bootstrap?: { Modal: any } }).bootstrap?.Modal;
      if (Modal?.getOrCreateInstance) {
        Modal.getOrCreateInstance(el).hide();
      }
    } catch {
      // fall through to DOM cleanup
    }
    // If Bootstrap API did not run or hide() no-opped, remove overlay (fixes stuck modal after success).
    window.setTimeout(() => {
      if (!el.classList.contains("show")) return;
      el.classList.remove("show");
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
      document.querySelectorAll(".modal-backdrop").forEach((node) => {
        node.parentElement?.removeChild(node);
      });
    }, 400);
  };

  const handleConfirmPromote = async () => {
    setPromoteError(null);
    setPromoteSuccess(null);
    if (!canPromote) {
      setPromoteError("You do not have permission to promote students.");
      return;
    }
    if (selectedRowKeys.length === 0) {
      setPromoteError("Select at least one student.");
      return;
    }
    const ids = selectedRowKeys
      .map((key) => data.find((row) => row.key === key)?.studentId)
      .filter((id): id is number => typeof id === "number" && !Number.isNaN(id));
    if (ids.length === 0) {
      setPromoteError("Could not resolve selected students.");
      return;
    }
    const tc = parseInt(toClassId, 10);
    const ts = parseInt(toSectionId, 10);
    const ty = parseInt(toAcademicYearId, 10);
    if (Number.isNaN(tc) || Number.isNaN(ts) || Number.isNaN(ty)) {
      setPromoteError("Choose a valid target class, section, and academic year.");
      return;
    }

    setPromoteSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        student_ids: ids,
        to_class_id: tc,
        to_section_id: ts,
        to_academic_year_id: ty,
      };
      if (fromAcademicYearId != null && !Number.isNaN(Number(fromAcademicYearId))) {
        body.from_academic_year_id = Number(fromAcademicYearId);
      }
      const res = await apiService.promoteStudents(body);
      if (res?.status !== "SUCCESS") {
        throw new Error(res?.message || "Promotion failed");
      }
      hidePromoteModal();
      setPromoteSuccess(
        `${res?.data?.promoted ?? ids.length} student(s) promoted successfully.`
      );
      setSelectedRowKeys([]);
      await refetchStudents();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Promotion failed";
      setPromoteError(msg);
    } finally {
      setPromoteSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <div className="col-md-12">
              <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
                <div className="my-auto mb-2">
                  <h3 className="page-title mb-1">Student Promotion</h3>
                  <nav>
                    <ol className="breadcrumb mb-0">
                      <li className="breadcrumb-item">
                        <Link to={routes.adminDashboard}>Dashboard</Link>
                      </li>
                      <li className="breadcrumb-item">
                        <Link to="#">Students</Link>
                      </li>
                      <li className="breadcrumb-item active" aria-current="page">
                        Student Promotion
                      </li>
                    </ol>
                  </nav>
                </div>
                <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
                  <TooltipOption />
                </div>
              </div>
              <div className="alert alert-outline-primary bg-primary-transparent p-2 d-flex align-items-center flex-wrap row-gap-2 mb-4">
                <i className="ti ti-info-circle me-1" />
                <strong>Note :</strong> Promoting students updates their class, section, and
                academic year for the target session. An audit row is stored in promotion
                history. The student list always follows the{" "}
                <strong>Academic Year chosen in the top header</strong> — it is not filtered by
                calendar dates.
              </div>
              {fromAcademicYearId == null && (
                <div className="alert alert-warning mb-4" role="alert">
                  Select an <strong>Academic Year</strong> in the header dropdown so the correct
                  students load for promotion.
                </div>
              )}
              <div className="card">
                <div className="card-header border-0 pb-0">
                  <div className="bg-light-gray p-3 rounded">
                    <h4>Promotion</h4>
                    <p>Select current class/section (to filter the list) and target session</p>
                  </div>
                </div>
                <div className="card-body">
                  <form>
                    <div className="d-md-flex align-items-center justify-content-between">
                      <div className="card flex-fill w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              Current Session <span className="text-danger">*</span>
                            </label>
                            <div className="form-control-plaintext p-0">{currentYearLabel}</div>
                          </div>
                          <div>
                            <label className="form-label mb-2">
                              Promotion from Class
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="d-block d-md-flex">
                              <div className=" flex-fill me-md-3 me-0 mb-0">
                                <label className="form-label">Class</label>
                                {classesFromLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading classes...
                                  </div>
                                ) : classesFromError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {classesFromError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={classOptionsFrom}
                                    value={fromClassId || undefined}
                                    onChange={(v) => {
                                      setFromClassId(v || "");
                                      setFromSectionId("");
                                    }}
                                  />
                                )}
                              </div>
                              <div className=" flex-fill mb-0">
                                <label className="form-label">Section</label>
                                {fromSectionsLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading sections...
                                  </div>
                                ) : fromSectionsError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {fromSectionsError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={sectionOptionsFrom}
                                    value={fromSectionId || undefined}
                                    onChange={(v) => setFromSectionId(v || "")}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Link
                        to="#"
                        className="badge bg-primary badge-xl exchange-link text-white d-flex align-items-center justify-content-center mx-md-4 mx-auto my-md-0 my-4 flex-shrink-0"
                      >
                        <span>
                          <i className="ti ti-arrows-exchange fs-16" />
                        </span>
                      </Link>
                      <div className="card flex-fill w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              Promote to Session <span className="text-danger"> *</span>
                            </label>
                            {academicYearsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading academic years...
                              </div>
                            ) : academicYearsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {academicYearsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={yearOptions}
                                value={toAcademicYearId || undefined}
                                onChange={(v) => {
                                  setToAcademicYearId(v || "");
                                  setToClassId("");
                                  setToSectionId("");
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <label className="form-label mb-2">
                              Target class
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="d-block d-md-flex">
                              <div className="flex-fill me-md-3 me-0 mb-0">
                                <label className="form-label">Class</label>
                                {classesToLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading classes...
                                  </div>
                                ) : classesToError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {classesToError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={classOptionsTo}
                                    value={toClassId || undefined}
                                    onChange={(v) => {
                                      setToClassId(v || "");
                                      setToSectionId("");
                                    }}
                                  />
                                )}
                              </div>
                              <div className=" flex-fill ">
                                <label className="form-label">Section</label>
                                {toSectionsLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading sections...
                                  </div>
                                ) : toSectionsError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {toSectionsError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={sectionOptionsTo}
                                    value={toSectionId || undefined}
                                    onChange={(v) => setToSectionId(v || "")}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="manage-promote-btn d-flex justify-content-center flex-wrap row-gap-2">
                        <button
                          type="reset"
                          className="btn btn-light reset-promote me-3"
                          onClick={() => {
                            setIsPromotion(false);
                            setSelectedRowKeys([]);
                            setPromoteError(null);
                            setPromoteSuccess(null);
                          }}
                        >
                          Reset Promotion
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary promote-students-btn"
                          onClick={() => setIsPromotion(true)}
                        >
                          Manage Promotion
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
              <div
                className={`promote-card-main ${isPromotion && "promote-card-main-show"}`}
              >
                <div className="card">
                  <div className="card-header border-0 pb-0">
                    <div className="bg-light-gray p-3 rounded">
                      <h4>Map Class Sections</h4>
                      <p>Summary of source and target (adjust selections above if needed)</p>
                    </div>
                  </div>
                  <div className="card-body pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="card w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              From Class<span className="text-danger">*</span>
                            </label>
                            <div className="form-control-plaintext p-0">{fromClassName}</div>
                          </div>
                          <div className="mb-0">
                            <label className="form-label d-block mb-2">
                              From Section
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="form-control-plaintext p-0">{fromSectionName}</div>
                          </div>
                        </div>
                      </div>
                      <Link
                        to="#"
                        className="badge bg-primary badge-xl exchange-link text-white d-flex align-items-center justify-content-center mx-md-4 mx-auto my-md-0 my-4 flex-shrink-0"
                      >
                        <span>
                          <i className="ti ti-arrows-exchange fs-16" />
                        </span>
                      </Link>
                      <div className="card w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              Promote to Session <span className="text-danger"> *</span>
                            </label>
                            <div className="form-control-plaintext p-0">{targetYearLabel}</div>
                          </div>
                          <div>
                            <label className="form-label mb-2">
                              Target class & section
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="form-control-plaintext p-0">
                              {toClassName} — {toSectionName}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">Students List</h4>
                    <div className="d-flex align-items-center flex-wrap">
                      <div className="mb-3 me-3 small text-muted">
                        <span className="d-block fw-semibold text-dark">Roster academic year</span>
                        <span>
                          {currentYearLabel}
                          {fromAcademicYearId != null ? (
                            <span className="text-muted"> (same as header dropdown)</span>
                          ) : (
                            <span className="text-warning"> — select a year in the header</span>
                          )}
                        </span>
                      </div>
                      <div className="dropdown mb-3">
                        <Link
                          to="#"
                          className="btn btn-outline-light bg-white dropdown-toggle"
                          data-bs-toggle="dropdown"
                        >
                          <i className="ti ti-sort-ascending-2 me-2" />
                          Sort by A-Z{" "}
                        </Link>
                        <ul className="dropdown-menu p-3">
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Ascending
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Descending
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Recently Viewed
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Recently Added
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="card-body p-0 py-3">
                    {promoteSuccess && (
                      <div className="alert alert-success mx-3" role="alert">
                        {promoteSuccess}
                      </div>
                    )}
                    {studentsLoading && (
                      <div className="text-center p-4">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-2">Loading students...</p>
                      </div>
                    )}
                    {studentsError && (
                      <div className="text-center p-4">
                        <div className="alert alert-danger mb-0">{studentsError}</div>
                      </div>
                    )}
                    {!studentsLoading && !studentsError && students.length === 0 && (
                      <div className="alert alert-warning mx-3" role="alert">
                        <strong>No students loaded</strong> for the academic year selected in the header (
                        {currentYearLabel}). Add students for this session or switch the dashboard academic year.
                        Also ensure each student has <strong>Academic year</strong> set on their record.
                      </div>
                    )}
                    {!studentsLoading &&
                      !studentsError &&
                      students.length > 0 &&
                      data.length === 0 &&
                      (fromClassId || fromSectionId) && (
                        <div className="alert alert-info mx-3" role="alert">
                          <strong>No students in this class/section.</strong> Use{" "}
                          <strong>Promotion from Class</strong> and <strong>Section</strong> (left column above) to
                          match where students are enrolled for {currentYearLabel}. Names are matched as well as
                          IDs, so the list should still show if class/section labels match. The table checkboxes
                          appear on each row once students show here.
                        </div>
                      )}
                    {!studentsLoading && !studentsError && (
                      <Table
                        dataSource={data}
                        columns={columns}
                        Selection={true}
                        selectedRowKeys={selectedRowKeys}
                        onSelectionChange={(keys) => {
                          onTableSelectionChange(keys);
                        }}
                      />
                    )}
                    {!canPromote && (
                      <p className="text-muted small px-3 mb-0">
                        Only administrators can save promotions. Teachers can review this list
                        but cannot submit.
                      </p>
                    )}
                  </div>
                </div>
                <div className="promoted-year text-center">
                  <p>
                    {selectedRowKeys.length} student(s) selected — target:{" "}
                    <strong>{targetYearLabel}</strong>
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-bs-toggle="modal"
                    data-bs-target="#student_promote"
                    disabled={selectedRowKeys.length === 0 || !canPromote}
                    onClick={() => setPromoteError(null)}
                  >
                    Promote Students
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal fade"
        id="student_promote"
        ref={promoteModalRef}
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <h4>Confirm Promotion</h4>
              <p>
                Promote <strong>{selectedRowKeys.length}</strong> selected student(s) to{" "}
                <strong>{toClassName}</strong> section <strong>{toSectionName}</strong> in{" "}
                <strong>{targetYearLabel}</strong>?
              </p>
              {promoteError && (
                <div className="alert alert-danger text-start small" role="alert">
                  {promoteError}
                </div>
              )}
              <div className="d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-light me-3"
                  data-bs-dismiss="modal"
                  disabled={promoteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={promoteSubmitting}
                  onClick={() => void handleConfirmPromote()}
                >
                  {promoteSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      Promoting…
                    </>
                  ) : (
                    "Promote"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentPromotion;
