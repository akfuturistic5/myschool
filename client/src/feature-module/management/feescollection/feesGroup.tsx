import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import FeesModal from "./feesModal";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const FeesGroup = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);

  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchFeesGroups = async (isManualRefresh = false) => {
    if (!academicYearId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getFeesGroups({ academic_year_id: academicYearId });
      if (res.status === "SUCCESS") {
        const mapped = (res.data ?? []).map((item: any) => ({
          ...item,
          key: item.id,
        }));
        setData(mapped);
        setFilteredData(mapped);
        if (isManualRefresh) {
          Swal.fire({ icon: "success", title: "Refreshed", timer: 1200, showConfirmButton: false });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch fee configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeesGroups(); }, [academicYearId]);

  const handleEdit = (record: any) => setSelectedFee(record);
  const handleDeleteClick = (id: number) => setDeleteId(id);
  const handleDeleteSuccess = () => { fetchFeesGroups(); setDeleteId(null); };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      ID: item.id,
      Class: item.class_name,
      "Fee Items": item.fee_items?.length ?? 0,
      "Total Amount": item.total_amount,
      "Compulsory": item.total_compulsory,
      "Optional": item.total_optional,
      "Due Date": item.due_date ?? "—",
    }));
    exportToExcel(exportData, `FeeConfigs_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPDF = () => {
    const columns = [
      { title: "Class", dataKey: "class_name" },
      { title: "Fee Items", dataKey: "fee_items_count" },
      { title: "Total (₹)", dataKey: "total_amount" },
      { title: "Due Date", dataKey: "due_date" },
    ];
    const rows = filteredData.map(r => ({
      ...r,
      fee_items_count: r.fee_items?.length ?? 0,
      due_date: r.due_date ?? "—",
    }));
    exportToPDF(rows, "Fee Configurations", `FeeConfigs_${new Date().toISOString().split("T")[0]}`, columns);
  };

  const handlePrint = () => {
    const columns = [
      { title: "Class", dataKey: "class_name" },
      { title: "Fee Items", dataKey: "fee_items_count" },
      { title: "Total (₹)", dataKey: "total_amount" },
    ];
    const rows = filteredData.map(r => ({ ...r, fee_items_count: r.fee_items?.length ?? 0 }));
    printData("Fee Configurations", columns, rows);
  };

  const columns = [
    {
      title: "Class",
      dataIndex: "class_name",
      sorter: (a: any, b: any) => (a.class_name ?? "").localeCompare(b.class_name ?? ""),
      render: (text: string) => <span className="fw-medium">{text}</span>
    },
    {
      title: "Fee Items",
      dataIndex: "fee_items",
      render: (items: any[]) => (
        <div>
          {Array.isArray(items) && items.length > 0 ? (
            <ul className="list-unstyled mb-0 small">
              {items.map((i: any, idx: number) => (
                <li key={idx} className="d-flex justify-content-between gap-3">
                  <span>{i.fee_type_name}{i.is_optional ? <span className="badge badge-soft-info ms-1 py-0">optional</span> : null}</span>
                  <strong>₹{parseFloat(i.amount).toFixed(2)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-muted small">No items</span>
          )}
        </div>
      )
    },
    {
      title: "Total (₹)",
      dataIndex: "total_amount",
      sorter: (a: any, b: any) => Number(a.total_amount) - Number(b.total_amount),
      render: (val: any) => (
        <span className="fw-medium text-primary">₹{parseFloat(val || 0).toFixed(2)}</span>
      )
    },
    {
      title: "Late Fee",
      dataIndex: "late_fee_type",
      render: (_: any, record: any) => {
        if (!record.late_fee_charge || Number(record.late_fee_charge) === 0) {
          return <span className="text-muted">None</span>;
        }
        return (
          <span className="badge badge-soft-warning">
            {record.late_fee_type === "percentage"
              ? `${record.late_fee_charge}% / ${record.late_fee_frequency}`
              : `₹${record.late_fee_charge} / ${record.late_fee_frequency}`}
          </span>
        );
      }
    },
    {
      title: "Due Date",
      dataIndex: "due_date",
      render: (val: string) => val
        ? new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : <span className="text-muted">—</span>
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center">
          <div className="dropdown">
            <Link
              to="#"
              className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="ti ti-dots-vertical fs-14" />
            </Link>
            <ul className="dropdown-menu dropdown-menu-end p-2">
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  data-bs-toggle="modal"
                  data-bs-target="#edit_fees_group"
                  onClick={() => handleEdit(record)}
                >
                  <i className="ti ti-edit-circle me-2" />Edit
                </Link>
              </li>
              <li>
                <Link
                  className="dropdown-item rounded-1 text-danger"
                  to="#"
                  data-bs-toggle="modal"
                  data-bs-target="#delete-modal"
                  onClick={() => handleDeleteClick(record.id)}
                >
                  <i className="ti ti-trash-x me-2" />Delete
                </Link>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Fee Configurations</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                  <li className="breadcrumb-item"><Link to="#">Fees Collection</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">Fee Groups</li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <TooltipOption
                onRefresh={() => fetchFeesGroups(true)}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <Link
                to="#"
                className="btn btn-primary"
                data-bs-toggle="modal"
                data-bs-target="#add_fees_group"
                onClick={() => setSelectedFee(null)}
              >
                <i className="ti ti-square-rounded-plus me-2" />
                Add Fee Configuration
              </Link>
            </div>
          </div>

          {/* Table Card */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between pb-0">
              <h4 className="mb-3">Fee Configurations</h4>
              {!academicYearId && (
                <span className="badge bg-warning text-dark">Select an Academic Year to view</span>
              )}
            </div>
            <div className="card-body p-0 py-3">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="mt-2 text-muted">Loading fee configurations...</p>
                </div>
              ) : error ? (
                <div className="alert alert-danger mx-3">{error}</div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="ti ti-file-description fs-1 mb-2 d-block" />
                  No fee configurations found for this academic year.
                  <br />
                  <Link to="#" className="btn btn-sm btn-primary mt-3" data-bs-toggle="modal" data-bs-target="#add_fees_group">
                    Create First Configuration
                  </Link>
                </div>
              ) : (
                <Table dataSource={filteredData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>

      <FeesModal
        onSuccess={fetchFeesGroups}
        editFeeData={selectedFee}
        deleteId={deleteId}
        deleteContext="fee"
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
};

export default FeesGroup;
