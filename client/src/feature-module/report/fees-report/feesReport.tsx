/* eslint-disable */
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import CommonSelect from "../../../core/common/commonSelect";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import { all_routes } from "../../router/all_routes";
import { useFeeCollections } from "../../../core/hooks/useFeeCollections";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import type { Dayjs } from "dayjs";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const FeesReport = () => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { data: feeRows, loading, error, refetch } = useFeeCollections({ academicYearId });
  const routes = all_routes;

  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [appliedClass, setAppliedClass] = useState<string>("All");
  const [appliedSection, setAppliedSection] = useState<string>("All");
  const [appliedStatus, setAppliedStatus] = useState<string>("All");
  const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const data = useMemo(
    () =>
      (Array.isArray(feeRows) ? feeRows : []).map((row: any, index: number) => {
        const amount = Number(row.amount ?? 0);
        const paid = Number(row.totalPaid ?? row.paid ?? 0);
        const balance = Number.isFinite(row.balance) ? Number(row.balance) : Math.max(amount - paid, 0);
        const statusText = row.status || (balance <= 0 && amount > 0 ? "Paid" : paid > 0 ? "Partial" : amount <= 0 ? "No Fees" : "Unpaid");

        return {
          key: row.key ?? row.id ?? `fees-report-${index}`,
          studentId: row.studentId ?? row.id,
          admissionNo: row.admNo || "—",
          rollNo: row.rollNo || "—",
          student: row.student || "—",
          class: row.class || "—",
          section: row.section || "—",
          amount,
          paid,
          balance,
          status: statusText,
          lastPaymentRaw: row.lastPaymentRaw || "",
          lastDate: row.lastDate || "—",
        };
      }),
    [feeRows]
  );

  const classOptions = useMemo(() => {
    const unique = Array.from(
      new Set(data.map((r) => String(r.class || "").trim()).filter((v) => v && v !== "—"))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Classes" }, ...unique.map((value) => ({ value, label: value }))];
  }, [data]);

  const sectionOptions = useMemo(() => {
    const pool = appliedClass === "All" ? data : data.filter((r) => r.class === appliedClass);
    const unique = Array.from(
      new Set(pool.map((r) => String(r.section || "").trim()).filter((v) => v && v !== "—"))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Sections" }, ...unique.map((value) => ({ value, label: value }))];
  }, [appliedClass, data]);

  const statusOptions = useMemo(() => {
    const unique = Array.from(
      new Set(data.map((r) => String(r.status || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Status" }, ...unique.map((value) => ({ value, label: value }))];
  }, [data]);

  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        const classOk = appliedClass === "All" || row.class === appliedClass;
        const sectionOk = appliedSection === "All" || row.section === appliedSection;
        const statusOk = appliedStatus === "All" || row.status === appliedStatus;
        const dateOk =
          !selectedDateRange ||
          (row.lastPaymentRaw &&
            row.lastPaymentRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
            row.lastPaymentRaw <= selectedDateRange[1].format("YYYY-MM-DD"));
        return classOk && sectionOk && statusOk && dateOk;
      }),
    [appliedClass, appliedSection, appliedStatus, data, selectedDateRange]
  );

  const exportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Student", dataKey: "student" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Total Due", dataKey: "amountStr" },
      { title: "Paid", dataKey: "paidStr" },
      { title: "Balance", dataKey: "balanceStr" },
      { title: "Last Payment", dataKey: "lastDate" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const exportRows = useMemo(
    () =>
      filteredData.map((row) => ({
        ...row,
        amountStr: Number(row.amount ?? 0).toFixed(2),
        paidStr: Number(row.paid ?? 0).toFixed(2),
        balanceStr: Number(row.balance ?? 0).toFixed(2),
      })),
    [filteredData]
  );

  const handleExportExcel = () => {
    const rows = filteredData.map((row) => ({
      "Admission No": row.admissionNo,
      "Roll No": row.rollNo,
      Student: row.student,
      Class: row.class,
      Section: row.section,
      "Total Due": Number(row.amount ?? 0).toFixed(2),
      Paid: Number(row.paid ?? 0).toFixed(2),
      Balance: Number(row.balance ?? 0).toFixed(2),
      "Last Payment": row.lastDate,
      Status: row.status,
    }));
    exportToExcel(rows, `FeesReport_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPDF = () => {
    exportToPDF(exportRows, "Fees Report", `FeesReport_${new Date().toISOString().split("T")[0]}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Fees Report", exportColumns, exportRows);
  };

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
    setSelectedDateRange(null);
  };

  const columns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      key: "admissionNo",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.admissionNo, (b as any)?.admissionNo),
      render: (text: any, record: any) => (
        <Link
          to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}
          className="link-primary"
        >
          {text}
        </Link>
      ),
    },
    {
      title: "Roll No",
      dataIndex: "rollNo",
      key: "rollNo",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.rollNo, (b as any)?.rollNo),
    },
    {
      title: "Student",
      dataIndex: "student",
      key: "student",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.student, (b as any)?.student),
    },
    {
      title: "Class",
      dataIndex: "class",
      key: "class",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.class, (b as any)?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      key: "section",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.section, (b as any)?.section),
    },
    {
      title: "Total Due",
      dataIndex: "amount",
      key: "amount",
      sorter: (a: TableData, b: TableData) => compareNumber((a as any)?.amount, (b as any)?.amount),
      render: (amount: number) => Number(amount ?? 0).toFixed(2),
    },
    {
      title: "Paid",
      dataIndex: "paid",
      key: "paid",
      sorter: (a: TableData, b: TableData) => compareNumber((a as any)?.paid, (b as any)?.paid),
      render: (paid: number) => Number(paid ?? 0).toFixed(2),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.status, (b as any)?.status),
      render: (status: any) =>
        status ? (
          <span
            className={`badge d-inline-flex align-items-center ${
              String(status).toLowerCase() === "paid"
                ? "badge-soft-success"
                : String(status).toLowerCase() === "partial"
                  ? "badge-soft-warning"
                  : String(status).toLowerCase() === "no fees"
                    ? "badge-soft-secondary"
                    : "badge-soft-danger"
            }`}
          >
            <i className="ti ti-circle-filled fs-5 me-1" />
            {status}
          </span>
        ) : (
          <></>
        ),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      sorter: (a: TableData, b: TableData) => compareNumber((a as any)?.balance, (b as any)?.balance),
      render: (balance: number) => Number(balance ?? 0).toFixed(2),
    },
    {
      title: "Last Payment",
      dataIndex: "lastDate",
      key: "lastDate",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.lastDate, (b as any)?.lastDate),
    },
  ];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Fees Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Fees Report
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={refetch}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Report List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="mb-3 me-2">
                  <PredefinedDateRanges
                    onChange={(range: [Dayjs, Dayjs]) => setSelectedDateRange(range)}
                  />
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
                                options={classOptions}
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
                                options={sectionOptions}
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
                                options={statusOptions}
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
              {academicYearId == null && (
                <div className="alert alert-info mx-3 mt-3 mb-0" role="alert">
                  Select an academic year in the header to load fee collections for that year.
                </div>
              )}
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
                  <p className="mt-2 mb-0">Loading fees report...</p>
                </div>
              ) : (
                <Table dataSource={filteredData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeesReport;

