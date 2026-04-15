import { useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  hostelName,
  HostelroomNo,
  hostelType,
  moreFilterRoom,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import HostelModal from "./hostelModal";
import { useHostelRooms } from "../../../core/hooks/useHostelRooms";
import { apiService } from "../../../core/services/apiService";

const HostelRooms = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { hostelRooms, loading, error, refetch } = useHostelRooms();
  const data = hostelRooms;
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [editRoomBeds, setEditRoomBeds] = useState<string>('');
  const [editRoomCost, setEditRoomCost] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any, record: any) => (
        <Link to="#" className="link-primary">
          {text || record.id || 'N/A'}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => String(a.id || '').length - String(b.id || '').length,
    },
    {
      title: "Room No",
      dataIndex: "roomNo",
      
      sorter: (a: TableData, b: TableData) =>
        a.roomNo.length - b.roomNo.length,
    },
    {
      title: "Hostel Name",
      dataIndex: "hostelName",
      
      sorter: (a: TableData, b: TableData) =>
        a.hostelName.length - b.hostelName.length,
    },
    {
      title: "Room Type",
      dataIndex: "roomType",
      sorter: (a: TableData, b: TableData) =>
        a.roomType.length - b.roomType.length,
    },
    {
      title: "No Of Bed",
      dataIndex: "noofBed",
      sorter: (a: TableData, b: TableData) =>
        a.noofBed.length - b.noofBed.length,
    },
    {
      title: "Cost Per Bed",
      dataIndex: "amount",
      
      sorter: (a: TableData, b: TableData) => a.amount.length - b.amount.length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => (
        <>
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
              <ul className="dropdown-menu dropdown-menu-right p-3">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      const room = record.originalData || record;

                      // Beds from current_occupancy
                      const bedsRaw = room.current_occupancy ?? room.no_of_bed ?? record.noofBed;
                      const bedsStr =
                        bedsRaw !== undefined && bedsRaw !== null && bedsRaw !== 'N/A'
                          ? String(bedsRaw)
                          : '';
                      setEditRoomBeds(bedsStr);

                      // Cost from monthly_fee / monthly_fees
                      const costRaw = room.monthly_fee ?? room.monthly_fees ?? null;
                      const costStr =
                        costRaw !== null && costRaw !== undefined
                          ? (() => {
                              if (typeof costRaw === 'number') return String(costRaw);
                              const n = Number(String(costRaw).replace(/[^\d.]/g, ''));
                              return !Number.isNaN(n) ? String(n) : '';
                            })()
                          : '';
                      setEditRoomCost(costStr);

                      setSelectedRoom(record);
                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_hostel_rooms');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal =
                              bootstrap.Modal.getInstance(modalElement) ||
                              new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 100);
                    }}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#delete-modal"
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
      ),
    },
  ];
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Hostel Rooms</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                  Hostel Rooms
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_hostel_rooms"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Hostel Rooms
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Hostel Rooms</h4>
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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Room No</label>
                              <CommonSelect
                                className="select"
                                options={HostelroomNo}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Name</label>
                              <CommonSelect
                                className="select"
                                options={hostelName}
                                defaultValue={hostelName[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Type</label>
                              <CommonSelect
                                className="select"
                                options={hostelType}
                                defaultValue={hostelType[0]}
                              />
                            </div>
                          </div>
                          
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">More Filter</label>
                              <CommonSelect
                                className="select"
                                options={moreFilterRoom}
                                defaultValue={moreFilterRoom[0]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
                          Reset
                        </Link>
                        <Link
                          to="#"
                          className="btn btn-primary"
                          onClick={handleApplyClick}
                        >
                          Apply
                        </Link>
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
              {/* Loading State */}
              {loading && (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading hostel rooms data...</p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="text-center p-4">
                  <div className="alert alert-danger" role="alert">
                    <i className="ti ti-alert-circle me-2"></i>
                    {error}
                    <button 
                      className="btn btn-sm btn-outline-danger ms-3" 
                      onClick={refetch}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Hostel Rooms List */}
              {!loading && !error && (
                <Table dataSource={data} columns={columns} Selection={true} />
              )}
              {/* /Hostel Rooms List */}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <HostelModal
        selectedRoom={selectedRoom}
        editRoomBeds={editRoomBeds}
        setEditRoomBeds={setEditRoomBeds}
        editRoomCost={editRoomCost}
        setEditRoomCost={setEditRoomCost}
        isUpdating={isUpdating}
        setIsUpdating={setIsUpdating}
        onRoomUpdate={async () => {
          const roomId = selectedRoom?.originalData?.id || selectedRoom?.id;
          if (!roomId || isUpdating) return;

          // Prepare payload
          const beds =
            editRoomBeds !== undefined && editRoomBeds !== null && editRoomBeds !== ''
              ? Number(editRoomBeds)
              : undefined;
          const cost =
            editRoomCost !== undefined && editRoomCost !== null && editRoomCost !== ''
              ? Number(editRoomCost)
              : undefined;

          setIsUpdating(true);
          try {
            const payload: any = {};
            if (!Number.isNaN(beds as any) && beds !== undefined) {
              payload.current_occupancy = beds;
            }
            if (!Number.isNaN(cost as any) && cost !== undefined) {
              payload.monthly_fee = cost;
            }

            const response = await apiService.updateHostelRoom(roomId, payload);
            if (response && response.status === 'SUCCESS') {
              const modalElement = document.getElementById('edit_hostel_rooms');
              if (modalElement) {
                const bootstrap = (window as any).bootstrap;
                if (bootstrap && bootstrap.Modal) {
                  const modal = bootstrap.Modal.getInstance(modalElement);
                  if (modal) modal.hide();
                }
              }
              await refetch();
              setSelectedRoom(null);
            } else {
              alert(response?.message || 'Failed to update hostel room');
            }
          } catch (err: any) {
            console.error('Error updating hostel room:', err);
            alert(err?.message || 'Failed to update hostel room. Please try again.');
          } finally {
            setIsUpdating(false);
          }
        }}
      />
    </>
  );
};

export default HostelRooms;
