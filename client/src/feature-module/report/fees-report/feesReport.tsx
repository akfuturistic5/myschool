import { useMemo } from "react";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import {
  classes,
  sections,
  studentName,
} from "../../../core/common/selectoption/selectoption";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import Table from "../../../core/common/dataTable/index";
import type { TableData } from "../../../core/data/interface";
import { all_routes } from "../../router/all_routes";
import { useFeeCollections } from "../../../core/hooks/useFeeCollections";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const FeesReport = () => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { data: feeRows, loading, error } = useFeeCollections({ academicYearId });
  const data = useMemo(
    () =>
      (Array.isArray(feeRows) ? feeRows : []).map((row: any, index: number) => {
        const amount = Number(row.amount ?? 0);
        const paid = Number(row.totalPaid ?? 0);
        const balance = Math.max(amount - paid, 0);
        const statusText = row.status || (balance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");

        return {
          key: row.key ?? row.id ?? `fees-report-${index}`,
          admissionNo: row.admNo || "—",
          rollNo: row.rollNo || "—",
          student: row.student || "—",
          class: row.class || "—",
          section: row.section || "—",
          amount,
          paid,
          balance,
          status: statusText,
        };
      }),
    [feeRows]
  );
  const routes = all_routes; 

  const columns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      key: "admissionNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
      render: (text: any) => (
        <Link to="#" className="link-primary">
          {text}
        </Link>
      ),
    },
    {
      title: "Roll No",
      dataIndex: "rollNo",
      key: "rollNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.rollNo, b?.rollNo),
    },
    {
      title: "Student",
      dataIndex: "student",
      key: "student",
      sorter: (a: TableData, b: TableData) => compareText(a?.student, b?.student),
    },
    {
      title: "Class",
      dataIndex: "class",
      key: "class",
      sorter: (a: TableData, b: TableData) => compareText(a?.class, b?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      key: "section",
      sorter: (a: TableData, b: TableData) => compareText(a?.section, b?.section),
    },
    {
      title: "Total Due",
      dataIndex: "amount",
      key: "amount",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.amount, b?.amount),
      render: (amount: number) => Number(amount ?? 0).toFixed(2),
    },
    {
      title: "Paid",
      dataIndex: "paid",
      key: "paid",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.paid, b?.paid),
      render: (paid: number) => Number(paid ?? 0).toFixed(2),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      sorter: (a: TableData, b: TableData) => compareText(a?.status, b?.status),
      render: (status: any) =>
        status ? (
          <span
            className={`badge d-inline-flex align-items-center ${
              String(status).toLowerCase() === "paid"
                ? "badge-soft-success"
                : String(status).toLowerCase() === "partial"
                  ? "badge-soft-warning"
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
      sorter: (a: TableData, b: TableData) => compareNumber(a?.balance, b?.balance),
      render: (balance: number) => Number(balance ?? 0).toFixed(2),
    },
  ];

  return (
    <div>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
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
              <TooltipOption />
            </div>
          </div>
          {/* /Page Header */}
          {/* Student List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Report List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
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
                  <div className="dropdown-menu drop-width">
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
                                options={classes}
                                defaultValue={classes[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sections}
                                defaultValue={sections[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Students</label>
                              <CommonSelect
                                className="select"
                                options={studentName}
                                defaultValue={studentName[0]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="dropdown mb-3">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    Sort by A-Z
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
                <>
                  {/* Student List */}
                  <Table dataSource={data} columns={columns} Selection={true} />
                  {/* /Student List */}
                </>
              )}
            </div>
          </div>
          {/* /Student List */}
        </div>
      </div>
      {/* /Page Wrapper */}
    </div>
  );
};

export default FeesReport;
