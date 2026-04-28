import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import Table from "../../../core/common/dataTable";
import CommonSelect from "../../../core/common/commonSelect";
import { useTransportFees } from "../../../core/hooks/useTransportFees";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import TransportFeesModal from "./transportFeesModal";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const TransportFees = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedFee, setSelectedFee] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [pickupOptions, setPickupOptions] = useState<any[]>([]);
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftPickupPointId, setDraftPickupPointId] = useState("all");
  const [params, setParams] = useState<any>({
    page: 1,
    limit: 10,
    search: "",
    status: "all",
    pickup_point_id: "all",
    sortField: "id",
    sortOrder: "DESC",
    academic_year_id: undefined,
  });

  const { data, loading, metadata, refetch } = useTransportFees(params);

  useEffect(() => {
    setParams((p: any) => ({ ...p, academic_year_id: academicYearId ?? undefined, page: 1 }));
  }, [academicYearId]);

  useEffect(() => {
    apiService.getTransportPickupPoints({ limit: 1000, status: "active", academic_year_id: academicYearId ?? undefined }).then((res: any) => {
      if (res?.status === "SUCCESS") setPickupOptions(res.data || []);
    });
  }, [academicYearId]);

  const onRefresh = async () => {
    await refetch();
    Swal.fire({ icon: "success", title: "Refreshed", text: "Data updated successfully", timer: 1200, showConfirmButton: false });
  };

  const onPageChange = (page: number, limit: number) => setParams((p: any) => ({ ...p, page, limit }));

  const onSort = (field: string, order: string) => {
    if (!field) return;
    const map: any = {
      displayId: "id",
      planName: "plan_name",
      pickupPointName: "point_name",
      durationDays: "duration_days",
      studentAmount: "amount",
      staffAmount: "staff_amount",
      status: "status"
    };
    setParams((p: any) => ({ ...p, sortField: map[field] || "id", sortOrder: order === "ascend" ? "ASC" : "DESC" }));
  };

  const handleApplyFilter = (e: any) => {
    e.preventDefault();
    setParams((p: any) => ({ ...p, page: 1, status: draftStatus, pickup_point_id: draftPickupPointId }));
    dropdownMenuRef.current?.classList.remove("show");
  };

  const handleReset = () => {
    setDraftStatus("all");
    setDraftPickupPointId("all");
    setParams((p: any) => ({ ...p, page: 1, status: "all", pickup_point_id: "all" }));
  };

  const handleExportExcel = () =>
    exportToExcel(
      data.map((i: any) => ({
        ID: i.displayId,
        "Pickup Point": i.pickupPointName,
        "Plan Name": i.planName,
        "Duration Days": i.durationDays,
        "Student Amount": i.studentAmount,
        "Staff Amount": i.staffAmount,
        Status: i.status,
      })),
      `Transport_Fees_${new Date().toISOString().split("T")[0]}`
    );

  const exportCols = [
    { title: "ID", dataKey: "displayId" },
    { title: "Pickup Point", dataKey: "pickupPointName" },
    { title: "Plan Name", dataKey: "planName" },
    { title: "Duration Days", dataKey: "durationDays" },
    { title: "Student Amount", dataKey: "studentAmount" },
    { title: "Staff Amount", dataKey: "staffAmount" },
    { title: "Status", dataKey: "status" },
  ];

  const handleExportPDF = () => exportToPDF(data, "Transport Fees", `Transport_Fees_${new Date().toISOString().split("T")[0]}`, exportCols);
  const handlePrint = () => printData("Transport Fees", exportCols, data);

  const columns = [
    { title: "ID", dataIndex: "displayId", sorter: true, render: (t: string) => <Link to="#" className="link-primary">{t}</Link> },
    { title: "Pickup Point", dataIndex: "pickupPointName", sorter: true },
    { title: "Plan Name", dataIndex: "planName", sorter: true },
    { title: "Duration Days", dataIndex: "durationDays", sorter: true },
    { title: "Student Amount", dataIndex: "studentAmount", sorter: true },
    { title: "Staff Amount", dataIndex: "staffAmount", sorter: true },
    {
      title: "Status",
      dataIndex: "status",
      sorter: true,
      render: (text: string) => (
        <span className={`badge d-inline-flex align-items-center ${text === "Active" ? "badge-soft-success" : "badge-soft-danger"}`}>
          <i className="ti ti-circle-filled fs-5 me-1" />{text}
        </span>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="dropdown">
          <Link to="#" className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0" data-bs-toggle="dropdown">
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-right p-3">
            <li>
              <Link className="dropdown-item rounded-1" to="#" data-bs-toggle="modal" data-bs-target="#edit_transport_fee" onClick={() => setSelectedFee(record)}>
                <i className="ti ti-edit-circle me-2" />Edit
              </Link>
            </li>
            <li>
              <Link className="dropdown-item rounded-1" to="#" data-bs-toggle="modal" data-bs-target="#delete-transport-fee-modal" onClick={() => setDeleteId(record.originalData.id)}>
                <i className="ti ti-trash-x me-2" />Delete
              </Link>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Transport Fees</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                  <li className="breadcrumb-item"><Link to="#">Management</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">Transport Fees</li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption onRefresh={onRefresh} onPrint={handlePrint} onExportExcel={handleExportExcel} onExportPdf={handleExportPDF} />
              <div className="mb-2">
                <Link to="#" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#add_transport_fee" onClick={() => setSelectedFee(null)}>
                  <i className="ti ti-square-rounded-plus me-2" />Add Transport Fee
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Transport Fee Plan List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="dropdown mb-3 me-2">
                  <Link to="#" className="btn btn-outline-light bg-white dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside">
                    <i className="ti ti-filter me-2" />Filter
                  </Link>
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form onSubmit={handleApplyFilter}>
                      <div className="d-flex align-items-center border-bottom p-3"><h4>Filter</h4></div>
                      <div className="p-3 border-bottom">
                        <div className="mb-3">
                          <label className="form-label">Pickup Point</label>
                          <CommonSelect className="select" options={[{ value: "all", label: "All Pickup Points" }, ...pickupOptions.map((p: any) => ({ value: String(p.id), label: p.point_name }))]} value={draftPickupPointId} onChange={(v: string | null) => setDraftPickupPointId(v || "all")} />
                        </div>
                        <div className="mb-0">
                          <label className="form-label">Status</label>
                          <CommonSelect className="select" options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} value={draftStatus} onChange={(v: string | null) => setDraftStatus(v || "all")} />
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={handleReset}>Reset</button>
                        <button type="submit" className="btn btn-primary">Apply</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              <Table
                dataSource={data}
                columns={columns}
                Selection={true}
                loading={loading}
                pagination={{ current: params.page, pageSize: params.limit, total: metadata.totalCount, showSizeChanger: true, onChange: onPageChange }}
                onTableChange={(pagination: any, _filters: any, sorter: any) => {
                  onPageChange(pagination.current, pagination.pageSize);
                  onSort(sorter.field, sorter.order);
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <TransportFeesModal selectedFee={selectedFee} deleteId={deleteId} onSuccess={() => { refetch(); setDeleteId(null); setSelectedFee(null); }} />
    </>
  );
};

export default TransportFees;
