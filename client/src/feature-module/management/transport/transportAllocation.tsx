import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import Table from "../../../core/common/dataTable";
import CommonSelect from "../../../core/common/commonSelect";
import { useTransportAllocations } from "../../../core/hooks/useTransportAllocations";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import TransportAllocationModal from "./transportAllocationModal";

const TransportAllocation = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedAllocation, setSelectedAllocation] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState("all");
  const [draftUserType, setDraftUserType] = useState("all");
  const [draftVehicleId, setDraftVehicleId] = useState("all");
  const [params, setParams] = useState<any>({
    page: 1,
    limit: 10,
    search: "",
    status: "all",
    user_type: "all",
    vehicle_id: "all",
    sortField: "id",
    sortOrder: "DESC",
  });

  const { data, loading, metadata, refetch } = useTransportAllocations(params);

  useEffect(() => {
    apiService.getTransportVehicles({ limit: 1000 }).then((res: any) => {
      if (res?.status === "SUCCESS") setVehicles(res.data || []);
    });
  }, []);

  const onRefresh = async () => {
    await refetch();
    Swal.fire({ icon: "success", title: "Refreshed", text: "Data updated successfully", timer: 1200, showConfirmButton: false });
  };

  const onPageChange = (page: number, limit: number) => setParams((p: any) => ({ ...p, page, limit }));

  const onSort = (field: string, order: string) => {
    if (!field) return;
    const map: any = { displayId: "id", userType: "user_type", routeName: "route_name", pickupPointName: "point_name", vehicleNumber: "vehicle_number", feeAmount: "assigned_fee_amount", startDate: "start_date", status: "status" };
    setParams((p: any) => ({ ...p, sortField: map[field] || "id", sortOrder: order === "ascend" ? "ASC" : "DESC" }));
  };

  const handleApplyFilter = (e: any) => {
    e.preventDefault();
    setParams((p: any) => ({
      ...p,
      page: 1,
      status: draftStatus,
      user_type: draftUserType,
      vehicle_id: draftVehicleId,
    }));
    dropdownMenuRef.current?.classList.remove("show");
  };

  const handleReset = () => {
    setDraftStatus("all");
    setDraftUserType("all");
    setDraftVehicleId("all");
    setParams((p: any) => ({ ...p, page: 1, status: "all", user_type: "all", vehicle_id: "all" }));
  };

  const handleExportExcel = () =>
    exportToExcel(
      data.map((i: any) => ({
        ID: i.displayId,
        User: i.userName,
        "User Type": i.userType,
        Route: i.routeName,
        "Pickup Point": i.pickupPointName,
        Vehicle: i.vehicleNumber,
        "Fee Plan": i.feePlan,
        "Plan Days": i.planDays || "-",
        "Fee Amount": i.feeAmount,
        "Is Free": i.isFree ? "Yes" : "No",
        "Start Date": i.startDate,
        "End Date": i.endDate,
        Status: i.status,
      })),
      `Transport_Allocations_${new Date().toISOString().split("T")[0]}`
    );

  const exportCols = [
    { title: "ID", dataKey: "displayId" },
    { title: "User", dataKey: "userName" },
    { title: "User Type", dataKey: "userType" },
    { title: "Route", dataKey: "routeName" },
    { title: "Pickup Point", dataKey: "pickupPointName" },
    { title: "Vehicle", dataKey: "vehicleNumber" },
    { title: "Fee Plan", dataKey: "feePlan" },
    { title: "Plan Days", dataKey: "planDays" },
    { title: "Fee Amount", dataKey: "feeAmount" },
    { title: "Is Free", dataKey: "isFree" },
    { title: "Start Date", dataKey: "startDate" },
    { title: "End Date", dataKey: "endDate" },
    { title: "Status", dataKey: "status" },
  ];
  const handleExportPDF = () => exportToPDF(data, "Transport Allocations", `Transport_Allocations_${new Date().toISOString().split("T")[0]}`, exportCols);
  const handlePrint = () => printData("Transport Allocations", exportCols, data);

  const columns = [
    { title: "ID", dataIndex: "displayId", sorter: true, render: (t: string) => <Link to="#" className="link-primary">{t}</Link> },
    { title: "User", dataIndex: "userName", sorter: true, render: (t: any, r: any) => `${t} (${r.userType})` },
    { title: "Route", dataIndex: "routeName", sorter: true },
    { title: "Pickup Point", dataIndex: "pickupPointName", sorter: true },
    { title: "Vehicle", dataIndex: "vehicleNumber", sorter: true },
    {
      title: "Fee Plan",
      dataIndex: "feePlan",
      sorter: true,
      render: (t: string, r: any) => (
        <div>
          <div>{t}</div>
          {r.planDays ? <span className="badge badge-soft-info mt-1">{r.planDays} days</span> : null}
        </div>
      ),
    },
    { title: "Fee Amount", dataIndex: "feeAmount", sorter: true, render: (v: number, r: any) => (r.isFree ? "0 (Free)" : v) },
    { title: "Start Date", dataIndex: "startDate", sorter: true },
    { title: "End Date", dataIndex: "endDate", sorter: true },
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
              <Link className="dropdown-item rounded-1" to="#" data-bs-toggle="modal" data-bs-target="#edit_transport_allocation" onClick={() => setSelectedAllocation(record)}>
                <i className="ti ti-edit-circle me-2" />Edit
              </Link>
            </li>
            <li>
              <Link className="dropdown-item rounded-1" to="#" data-bs-toggle="modal" data-bs-target="#delete-transport-allocation-modal" onClick={() => setDeleteId(record.originalData.id)}>
                <i className="ti ti-trash-x me-2" />Close Allocation
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
              <h3 className="page-title mb-1">Transport Allocation</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                  <li className="breadcrumb-item"><Link to="#">Management</Link></li>
                  <li className="breadcrumb-item active" aria-current="page">Transport Allocation</li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption onRefresh={onRefresh} onPrint={handlePrint} onExportExcel={handleExportExcel} onExportPdf={handleExportPDF} />
              <div className="mb-2 me-2">
                <Link to="#" className="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#add_transport_allocation_bulk">
                  <i className="ti ti-users-group me-2" />Bulk Allocate
                </Link>
              </div>
              <div className="mb-2">
                <Link to="#" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#add_transport_allocation" onClick={() => setSelectedAllocation(null)}>
                  <i className="ti ti-square-rounded-plus me-2" />Add Allocation
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Transport Allocation List</h4>
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
                          <label className="form-label">User Type</label>
                          <CommonSelect className="select" options={[{ value: "all", label: "All User Types" }, { value: "student", label: "Student" }, { value: "staff", label: "Staff" }]} value={draftUserType} onChange={(v: string | null) => setDraftUserType(v || "all")} />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Vehicle</label>
                          <CommonSelect className="select" options={[{ value: "all", label: "All Vehicles" }, ...vehicles.map((v: any) => ({ value: String(v.id), label: v.vehicle_number }))]} value={draftVehicleId} onChange={(v: string | null) => setDraftVehicleId(v || "all")} />
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
      <TransportAllocationModal selectedAllocation={selectedAllocation} deleteId={deleteId} onSuccess={() => { refetch(); setDeleteId(null); setSelectedAllocation(null); }} />
    </>
  );
};

export default TransportAllocation;
