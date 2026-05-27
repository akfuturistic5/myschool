import React, { useRef } from "react";
import Table from "../../../core/common/dataTable/index";
import { usePayroll } from "../../../core/hooks/usePayroll";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { Link, useNavigate } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import TooltipOption from "../../../core/common/tooltipOption";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type SalaryPeriodParts = {
  monthNum: number;
  yearNum: number;
  label: string;
};

const parseSalaryPeriod = (period: unknown): SalaryPeriodParts | null => {
  if (period == null || period === "") return null;
  const dateStr = String(period).split(",")[0].replace(/[\[\]\(\)]/g, "").trim();
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return {
    monthNum: date.getMonth() + 1,
    yearNum: date.getFullYear(),
    label: date.toLocaleString("default", { month: "long", year: "numeric" }),
  };
};

const Payroll = () => {
  const { payrollData, loading, refresh } = usePayroll();
  const [selectedRowKeys, setSelectedRowKeys] = React.useState<any[]>([]);
  const [filterStaffId, setFilterStaffId] = React.useState<string | null>(null);
  const [filterMonth, setFilterMonth] = React.useState<string | null>(null);
  const [filterYear, setFilterYear] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const routes = all_routes;

  const formatSalaryPeriod = (period: unknown) => parseSalaryPeriod(period)?.label ?? "—";

  const getExportRows = () =>
    (Array.isArray(payrollData) ? payrollData : []).map((row: any) => ({
      ID: row.employee_code || row.id || "",
      Name: row.name || "",
      Month: formatSalaryPeriod(row.salary_period),
      Department: row.department || "",
      Designation: row.designation || "",
      Phone: row.phone || "",
      Amount: Number.parseFloat(row.net_salary || 0),
      Status: row.status || "",
    }));

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string, record: any) => (
        <Link to="#" className="link-primary">
          {record.employee_code || record.id}
        </Link>
      ),
      sorter: (a: any, b: any) => String(a.employee_code).localeCompare(String(b.employee_code)),
    },
    {
      title: "Name",
      dataIndex: "name",
      sorter: (a: any, b: any) => a.name.localeCompare(b.name),
    },
    {
      title: "Month",
      dataIndex: "salary_period",
      render: (period: any) => formatSalaryPeriod(period),
    },
    {
      title: "Department",
      dataIndex: "department",
      sorter: (a: any, b: any) => (a.department || "").localeCompare(b.department || ""),
    },
    {
      title: "Designation",
      dataIndex: "designation",
      sorter: (a: any, b: any) => (a.designation || "").localeCompare(b.designation || ""),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      sorter: (a: any, b: any) => (a.phone || "").localeCompare(b.phone || ""),
    },
    {
      title: "Amount",
      dataIndex: "net_salary",
      render: (text: any) => (
        <span>{parseFloat(text || 0).toLocaleString()}</span>
      ),
      sorter: (a: any, b: any) => parseFloat(a.net_salary) - parseFloat(b.net_salary),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Paid" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-warning d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          )}
        </>
      ),
      sorter: (a: any, b: any) => a.status.localeCompare(b.status),
    },
    {
      title: "Action",
      dataIndex: "id",
      render: (id: any, record: any) => (
        <div className="d-flex align-items-center">
          <Link to={routes.invoice.replace(":id", id)} className="btn btn-light btn-sm me-2">
            View Payslip
          </Link>
          {record.status !== "Paid" ? (
            <button 
              className="btn btn-soft-success btn-sm me-2"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Mark as Paid?',
                  text: "Are you sure you want to mark this payslip as paid?",
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonColor: '#3085d6',
                  cancelButtonColor: '#d33',
                  confirmButtonText: 'Yes, mark as paid'
                });

                if (result.isConfirmed) {
                  try {
                    const res = await apiService.updatePayslipStatus(id, "Paid");
                    if (res && res.status === "SUCCESS") {
                      Swal.fire('Paid!', 'Payslip has been marked as paid.', 'success');
                      refresh();
                    } else {
                      Swal.fire('Error', res?.message || 'Failed to update status', 'error');
                    }
                  } catch (err: any) {
                    Swal.fire('Error', err.message || 'An error occurred', 'error');
                  }
                }
              }}
            >
              <i className="ti ti-check me-1"></i>
              Mark Paid
            </button>
          ) : (
            <button 
              className="btn btn-soft-warning btn-sm me-2"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Revert to Draft?',
                  text: "This will move the payslip back to Draft state.",
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#f1b44c',
                  cancelButtonColor: '#d33',
                  confirmButtonText: 'Yes, revert'
                });

                if (result.isConfirmed) {
                  try {
                    const res = await apiService.updatePayslipStatus(id, "Draft");
                    if (res && res.status === "SUCCESS") {
                      Swal.fire('Reverted!', 'Status changed back to Draft.', 'success');
                      refresh();
                    } else {
                      Swal.fire('Error', res?.message || 'Failed to update status', 'error');
                    }
                  } catch (err: any) {
                    Swal.fire('Error', err.message || 'An error occurred', 'error');
                  }
                }
              }}
            >
              <i className="ti ti-rotate me-1"></i>
              Mark Draft
            </button>
          )}
          {record.status !== "Paid" && (
            <button 
              className="btn btn-soft-danger btn-sm"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Delete Payslip?',
                  text: "This will permanently remove this record.",
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#d33',
                  cancelButtonColor: '#3085d6',
                  confirmButtonText: 'Yes, delete it'
                });

                if (result.isConfirmed) {
                  try {
                    const res = await apiService.makeRequest(`/payroll/${id}`, { method: 'DELETE' });
                    if (res && res.status === "SUCCESS") {
                      Swal.fire('Deleted!', 'Record removed.', 'success');
                      refresh();
                    } else {
                      Swal.fire('Error', res?.message || 'Failed to delete', 'error');
                    }
                  } catch (err: any) {
                    Swal.fire('Error', err.message || 'An error occurred', 'error');
                  }
                }
              }}
            >
              <i className="ti ti-trash me-1"></i>
            </button>
          )}
        </div>
      ),
    },
  ];

  const onSelectionChange = (keys: any[]) => {
    setSelectedRowKeys(keys);
  };

  const payrollRows = React.useMemo(
    () => (Array.isArray(payrollData) ? payrollData : []),
    [payrollData]
  );

  const filterStaffOptions = React.useMemo(() => {
    const byStaff = new Map<string, string>();
    payrollRows.forEach((row: { staff_id?: number | string; name?: string }) => {
      const staffId = row.staff_id != null ? String(row.staff_id) : "";
      const name = String(row.name || "").trim();
      if (staffId && name && !byStaff.has(staffId)) {
        byStaff.set(staffId, name);
      }
    });
    return Array.from(byStaff.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [payrollRows]);

  const filterMonthOptions = React.useMemo(() => {
    const byMonth = new Map<number, string>();
    payrollRows.forEach((row: { salary_period?: unknown }) => {
      const parts = parseSalaryPeriod(row.salary_period);
      if (parts && !byMonth.has(parts.monthNum)) {
        byMonth.set(
          parts.monthNum,
          new Date(parts.yearNum, parts.monthNum - 1, 1).toLocaleString("default", { month: "long" })
        );
      }
    });
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a - b)
      .map(([monthNum, label]) => ({ value: String(monthNum), label }));
  }, [payrollRows]);

  const filterYearOptions = React.useMemo(() => {
    const years = new Set<number>();
    payrollRows.forEach((row: { salary_period?: unknown }) => {
      const parts = parseSalaryPeriod(row.salary_period);
      if (parts) years.add(parts.yearNum);
    });
    return Array.from(years)
      .sort((a, b) => b - a)
      .map((y) => ({ value: String(y), label: String(y) }));
  }, [payrollRows]);

  const filteredPayrollData = React.useMemo(() => {
    let rows = payrollRows;

    if (filterStaffId) {
      rows = rows.filter((row: { staff_id?: number | string }) =>
        String(row.staff_id) === filterStaffId
      );
    }

    if (filterMonth) {
      const wantMonth = Number.parseInt(filterMonth, 10);
      rows = rows.filter((row: { salary_period?: unknown }) => {
        const parts = parseSalaryPeriod(row.salary_period);
        return parts != null && parts.monthNum === wantMonth;
      });
    }

    if (filterYear) {
      const wantYear = Number.parseInt(filterYear, 10);
      rows = rows.filter((row: { salary_period?: unknown }) => {
        const parts = parseSalaryPeriod(row.salary_period);
        return parts != null && parts.yearNum === wantYear;
      });
    }

    return rows;
  }, [payrollRows, filterStaffId, filterMonth, filterYear]);

  const handleBulkMarkPaid = async () => {
    if (!selectedRowKeys.length) return;
    const result = await Swal.fire({
      title: 'Bulk Mark as Paid?',
      text: `Are you sure you want to mark ${selectedRowKeys.length} payslips as paid?`,
      icon: 'question',
      showCancelButton: true,
    });
    if (result.isConfirmed) {
      try {
        const res = await apiService.bulkUpdatePayslipStatus(selectedRowKeys, "Paid");
        if (res && res.status === "SUCCESS") {
          Swal.fire('Updated!', res.message, 'success');
          setSelectedRowKeys([]);
          refresh();
        }
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) return;
    const result = await Swal.fire({
      title: 'Bulk Delete?',
      text: `Are you sure you want to delete ${selectedRowKeys.length} payslips? Only unpaid ones will be removed.`,
      icon: 'warning',
      showCancelButton: true,
    });
    if (result.isConfirmed) {
      try {
        const res = await apiService.bulkDeletePayslips(selectedRowKeys);
        if (res && res.status === "SUCCESS") {
          Swal.fire('Deleted!', res.message, 'success');
          setSelectedRowKeys([]);
          refresh();
        }
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handlePrint = () => {
    const rows = getExportRows();
    if (!rows.length) {
      Swal.fire("No Data", "No payroll rows available to print.", "info");
      return;
    }
    const tableHeader = `
      <tr>
        <th>ID</th><th>Name</th><th>Month</th><th>Department</th>
        <th>Designation</th><th>Phone</th><th>Amount</th><th>Status</th>
      </tr>
    `;
    const tableRows = rows
      .map(
        (r) => `
          <tr>
            <td>${r.ID}</td>
            <td>${r.Name}</td>
            <td>${r.Month}</td>
            <td>${r.Department}</td>
            <td>${r.Designation}</td>
            <td>${r.Phone}</td>
            <td>${Number(r.Amount || 0).toLocaleString()}</td>
            <td>${r.Status}</td>
          </tr>
        `
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      Swal.fire("Blocked", "Please allow pop-ups to print payroll.", "warning");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Payroll List</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h2 { margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f4f6f8; }
          </style>
        </head>
        <body>
          <h2>Payroll List</h2>
          <table>
            <thead>${tableHeader}</thead>
            <tbody>${tableRows}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleExportPdf = () => {
    const rows = getExportRows();
    if (!rows.length) {
      Swal.fire("No Data", "No payroll rows available to export.", "info");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const headers = Object.keys(rows[0]);
    const body = rows.map((r) => headers.map((h) => String(r[h as keyof typeof r] ?? "")));
    doc.text("Payroll List", 30, 30);
    autoTable(doc, {
      startY: 42,
      margin: { left: 20, right: 20 },
      head: [headers],
      body,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: "bold" },
    });
    doc.save(`payroll-list-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportExcel = () => {
    const rows = getExportRows();
    if (!rows.length) {
      Swal.fire("No Data", "No payroll rows available to export.", "info");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");
    XLSX.writeFile(workbook, `payroll-list-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Payroll</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to="#">HRM</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Payroll
                </li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <button className="btn btn-outline-primary me-2" onClick={() => navigate(routes.salarySettings)}>
              <i className="ti ti-settings me-2" />
              Manage Components
            </button>
            <TooltipOption
              onRefresh={refresh}
              onPrint={handlePrint}
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
            />
          </div>
        </div>

        {/* Filter Section */}
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
            <h4 className="mb-3">Payroll List</h4>
            <div className="d-flex align-items-center flex-wrap">
              <button
                className="btn btn-primary d-flex align-items-center mb-3 me-2"
                onClick={async () => {
                  const { value: formValues } = await Swal.fire({
                    title: 'Generate Payroll',
                    html:
                      '<div class="mb-3"><label class="form-label">Month</label><select id="swal-month" class="form-select">' +
                      '<option value="1">January</option><option value="2">February</option><option value="3">March</option>' +
                      '<option value="4">April</option><option value="5">May</option><option value="6">June</option>' +
                      '<option value="7">July</option><option value="8">August</option><option value="9">September</option>' +
                      '<option value="10">October</option><option value="11">November</option><option value="12">December</option>' +
                      '</select></div>' +
                      '<div class="mb-3"><label class="form-label">Year</label><input id="swal-year" type="number" class="form-control" value="' + new Date().getFullYear() + '"></div>',
                    focusConfirm: false,
                    showCancelButton: true,
                    preConfirm: () => {
                      return {
                        month: (document.getElementById('swal-month') as HTMLSelectElement).value,
                        year: (document.getElementById('swal-year') as HTMLInputElement).value
                      }
                    }
                  });
                  
                  if (formValues) {
                    try {
                      Swal.fire({ title: 'Generating...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
                      const res = await apiService.processPayroll({ 
                        month: parseInt(formValues.month),
                        year: parseInt(formValues.year)
                      });
                      if (res && res.status === 'SUCCESS') {
                        Swal.fire('Success', 'Payroll generated successfully', 'success');
                        refresh();
                      } else {
                        Swal.fire({
                          title: 'Generation Failed',
                          text: res?.message || 'We could not find any active staff with salary settings for the selected month.',
                          icon: 'info'
                        });
                      }
                    } catch (err: any) {
                      const msg = err.message || "";
                      const cleanMsg = msg.includes("message: ") ? msg.split("message: ")[1] : msg;
                      Swal.fire({
                        title: 'Generation Failed',
                        text: cleanMsg || 'An unexpected error occurred while generating payroll.',
                        icon: 'info'
                      });
                    }
                  }
                }}
              >
                <i className="ti ti-settings-automation me-2" />
                Generate Payroll
              </button>
              {selectedRowKeys.length > 0 && (
                <div className="d-flex align-items-center mb-3">
                  <button className="btn btn-success me-2" onClick={handleBulkMarkPaid}>
                    <i className="ti ti-check me-1" />
                    Mark Selected Paid ({selectedRowKeys.length})
                  </button>
                  <button className="btn btn-danger me-2" onClick={handleBulkDelete}>
                    <i className="ti ti-trash me-1" />
                    Delete Selected ({selectedRowKeys.length})
                  </button>
                </div>
              )}
              <div className="input-icon-start mb-3 me-2 position-relative">
                <PredefinedDateRanges />
              </div>
              <div className="dropdown mb-3 me-2">
                <Link
                  to="#"
                  className="btn btn-outline-light bg-white dropdown-toggle"
                  data-bs-toggle="dropdown"
                >
                  <i className="ti ti-filter me-2" />
                  Filter
                </Link>
                <div
                  className="dropdown-menu drop-width"
                  ref={dropdownMenuRef}
                  onClick={(e) => e.stopPropagation()}
                >
                  <form>
                    <div className="d-flex align-items-center border-bottom p-3">
                      <h4>Filter</h4>
                    </div>
                    <div className="p-3 border-bottom">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Staff Name</label>
                            <CommonSelect
                              className="select"
                              options={filterStaffOptions}
                              value={filterStaffId}
                              onChange={(v) => setFilterStaffId(v || null)}
                              placeholder={
                                filterStaffOptions.length
                                  ? "All staff"
                                  : "No staff in payroll list"
                              }
                              isDisabled={!filterStaffOptions.length}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Month</label>
                            <CommonSelect
                              className="select"
                              options={filterMonthOptions}
                              value={filterMonth}
                              onChange={(v) => setFilterMonth(v || null)}
                              placeholder={
                                filterMonthOptions.length
                                  ? "All months"
                                  : "No payroll months yet"
                              }
                              isDisabled={!filterMonthOptions.length}
                            />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <div className="mb-0">
                            <label className="form-label">Year</label>
                            <CommonSelect
                              className="select"
                              options={filterYearOptions}
                              value={filterYear}
                              onChange={(v) => setFilterYear(v || null)}
                              placeholder={
                                filterYearOptions.length
                                  ? "All years"
                                  : "No payroll years yet"
                              }
                              isDisabled={!filterYearOptions.length}
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
                          setFilterStaffId(null);
                          setFilterMonth(null);
                          setFilterYear(null);
                        }}
                      >
                        Reset
                      </Link>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleApplyClick}
                      >
                        Apply
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="card-body p-0 py-3">
            <Table 
              columns={columns} 
              dataSource={filteredPayrollData} 
              loading={loading}
              Selection={true} 
              selectedRowKeys={selectedRowKeys}
              onSelectionChange={onSelectionChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payroll;
