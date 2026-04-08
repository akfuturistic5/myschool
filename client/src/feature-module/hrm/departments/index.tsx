import  { useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Table from "../../../core/common/dataTable/index";
import type { TableData } from '../../../core/data/interface';
import PredefinedDateRanges from '../../../core/common/datePicker';
import CommonSelect from '../../../core/common/commonSelect';
import { all_routes } from '../../router/all_routes';
import TooltipOption from '../../../core/common/tooltipOption';
import { useDepartments } from '../../../core/hooks/useDepartments';
import { apiService } from '../../../core/services/apiService';

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

function parseDepartmentApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  const marker = 'message: ';
  const idx = msg.indexOf(marker);
  if (idx === -1) return msg || fallback;
  const jsonPart = msg.slice(idx + marker.length).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    if (typeof j.message === 'string' && j.message.trim()) return j.message;
  } catch {
    /* ignore */
  }
  return msg || fallback;
}

type TableSortMode = 'none' | 'nameAsc' | 'nameDesc' | 'recentId';

function closeModalById(modalId: string) {
  const el = document.getElementById(modalId);
  if (!el) return;
  const bs = (window as any).bootstrap;
  if (bs?.Modal) {
    const modal = bs.Modal.getInstance(el) || new bs.Modal(el);
    modal.hide();
  }
}

const Departments = () => {
  const routes = all_routes;
  const { departments, loading, error, refetch } = useDepartments();
  const data = departments;
  const [selectedDepartment, setSelectedDepartment] = useState<any>(null);
  const [editDepartmentName, setEditDepartmentName] = useState<string>('');
  const [editDepartmentStatus, setEditDepartmentStatus] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [addDepartmentName, setAddDepartmentName] = useState('');
  const [addDepartmentActive, setAddDepartmentActive] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [filterDeptId, setFilterDeptId] = useState<string | null>('__all__');
  const [filterStatus, setFilterStatus] = useState<string | null>('__all__');
  const [tableSort, setTableSort] = useState<TableSortMode>('none');
  const [departmentPendingDelete, setDepartmentPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const departmentFilterSelectOptions = useMemo(() => {
    const all = [{ value: '__all__', label: 'All departments' }];
    if (!Array.isArray(departments)) {
      return all;
    }
    const opts = departments
      .filter((d: { originalData?: { id?: number | string } }) => d.originalData?.id != null)
      .map((d: {
        department?: string;
        originalData: { id: number | string };
      }) => ({
        value: String(d.originalData.id),
        label: String(d.department ?? 'N/A'),
      }));
    return [...all, ...opts];
  }, [departments]);

  const displayData = useMemo(() => {
    if (!Array.isArray(data)) {
      return [];
    }
    let rows = data.filter((row: any) => {
      if (filterDeptId && filterDeptId !== '__all__') {
        const rid =
          row.originalData?.id != null ? String(row.originalData.id) : String(row.key ?? '');
        if (rid !== filterDeptId) return false;
      }
      if (filterStatus && filterStatus !== '__all__') {
        if (row.status !== filterStatus) return false;
      }
      return true;
    });
    rows = [...rows];
    if (tableSort === 'nameAsc') {
      rows.sort((a: any, b: any) =>
        String(a.department ?? '').localeCompare(String(b.department ?? ''), undefined, {
          sensitivity: 'base',
        })
      );
    } else if (tableSort === 'nameDesc') {
      rows.sort((a: any, b: any) =>
        String(b.department ?? '').localeCompare(String(a.department ?? ''), undefined, {
          sensitivity: 'base',
        })
      );
    } else if (tableSort === 'recentId') {
      rows.sort(
        (a: any, b: any) =>
          Number(b.originalData?.id ?? b.key ?? 0) - Number(a.originalData?.id ?? a.key ?? 0)
      );
    }
    return rows;
  }, [data, filterDeptId, filterStatus, tableSort]);

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
        <>
          <Link to="#" className="link-primary">{text || record.id || 'N/A'}</Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => String(a.id || '').length - String(b.id || '').length,
    },
    {
      title: "Department",
      dataIndex: "department",
      sorter: (a: TableData, b: TableData) =>
        a.department.length - b.department.length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span
              className="badge badge-soft-success d-inline-flex align-items-center"
            >
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          ):
          (
            <span
              className="badge badge-soft-danger d-inline-flex align-items-center"
            >
              <i className='ti ti-circle-filled fs-5 me-1'></i>{text}
            </span>
          )}
        </>
      ),
      sorter: (a: TableData, b: TableData) =>
        a.status.length - b.status.length,
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
                      setEditFormError(null);
                      setSelectedDepartment(record);
                      const dept = record.originalData || record;
                      setEditDepartmentName(dept.department_name || dept.department || '');
                      setEditDepartmentStatus(dept.is_active !== false && dept.status !== 'Inactive');
                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_department');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
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
                    onClick={(e) => {
                      e.preventDefault();
                      const dept = record.originalData || record;
                      const rawId = dept.id ?? record.originalData?.id;
                      const nid =
                        typeof rawId === 'number' ? rawId : parseInt(String(rawId ?? ''), 10);
                      if (!Number.isFinite(nid) || nid < 1) return;
                      setDeleteError(null);
                      setDepartmentPendingDelete({
                        id: nid,
                        name: String(
                          dept.department_name || dept.department || record.department || 'this department'
                        ),
                      });
                      setTimeout(() => {
                        const modalElement = document.getElementById('delete_department_modal');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal =
                              bootstrap.Modal.getInstance(modalElement) ||
                              new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 0);
                    }}
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
    <div>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Department</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">HRM</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Department
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary d-flex align-items-center"
                  data-bs-toggle="modal"
                  data-bs-target="#add_department"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Department
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Department List</h4>
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
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Department</label>
                              {loading ? (
                                <div className="form-control d-flex align-items-center">
                                  <span
                                    className="spinner-border spinner-border-sm text-primary me-2"
                                    role="status"
                                  />
                                  Loading…
                                </div>
                              ) : (
                                <CommonSelect
                                  className="select"
                                  options={departmentFilterSelectOptions}
                                  value={filterDeptId}
                                  onChange={(v) => setFilterDeptId(v || '__all__')}
                                />
                              )}
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={STATUS_FILTER_OPTIONS}
                                value={filterStatus}
                                onChange={(v) => setFilterStatus(v || '__all__')}
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
                            setFilterDeptId('__all__');
                            setFilterStatus('__all__');
                          }}
                        >
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
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${tableSort === 'nameAsc' ? ' active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setTableSort('nameAsc');
                        }}
                      >
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${tableSort === 'nameDesc' ? ' active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setTableSort('nameDesc');
                        }}
                      >
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${tableSort === 'none' ? ' active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setTableSort('none');
                        }}
                      >
                        Default order
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="#"
                        className={`dropdown-item rounded-1${tableSort === 'recentId' ? ' active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          setTableSort('recentId');
                        }}
                      >
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
                  <p className="mt-2">Loading departments data...</p>
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

              {/* Student List */}
              {!loading && !error && (
                <Table columns={columns} dataSource={displayData} Selection={true} />
              )}
              {/* /Student List */}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      <>
  {/* Add Department */}
  <div className="modal fade" id="add_department">
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header">
          <h4 className="modal-title">Add Department</h4>
          <button
            type="button"
            className="btn-close custom-btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
            onClick={() => {
              setAddFormError(null);
              setAddDepartmentName('');
              setAddDepartmentActive(true);
            }}
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = addDepartmentName.trim();
            if (!name) {
              setAddFormError('Department name is required.');
              return;
            }
            setAddFormError(null);
            try {
              setIsCreating(true);
              const res: any = await apiService.createDepartment({
                department_name: name,
                is_active: addDepartmentActive,
              });
              if (res?.status === 'SUCCESS' || res?.data) {
                setAddDepartmentName('');
                setAddDepartmentActive(true);
                closeModalById('add_department');
                await refetch();
              } else {
                setAddFormError('Could not create department. Please try again.');
              }
            } catch (err) {
              setAddFormError(parseDepartmentApiError(err, 'Failed to create department.'));
            } finally {
              setIsCreating(false);
            }
          }}
        >
          <div className="modal-body">
            {addFormError && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {addFormError}
              </div>
            )}
            <div className="row">
              <div className="col-md-12">
                <div className="mb-3">
                  <label className="form-label">Department Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={addDepartmentName}
                    onChange={(ev) => setAddDepartmentName(ev.target.value)}
                    maxLength={100}
                    autoComplete="off"
                    disabled={isCreating}
                  />
                </div>
              </div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="status-title">
                  <h5>Status</h5>
                  <p>Change the Status by toggle </p>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="switch-sm"
                    checked={addDepartmentActive}
                    onChange={(ev) => setAddDepartmentActive(ev.target.checked)}
                    disabled={isCreating}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-light me-2"
              data-bs-dismiss="modal"
              disabled={isCreating}
              onClick={() => {
                setAddFormError(null);
                setAddDepartmentName('');
                setAddDepartmentActive(true);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCreating}>
              {isCreating ? 'Saving…' : 'Add Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  {/* Add Department */}
  {/* Edit Department */}
  <div className="modal fade" id="edit_department">
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <div className="modal-header">
          <h4 className="modal-title">Edit Department</h4>
          <button
            type="button"
            className="btn-close custom-btn-close"
            data-bs-dismiss="modal"
            aria-label="Close"
            onClick={() => setEditFormError(null)}
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <form >
          <div className="modal-body">
            {editFormError && (
              <div className="alert alert-danger py-2 mb-3" role="alert">
                {editFormError}
              </div>
            )}
            <div className="row">
              <div className="col-md-12">
                <div className="mb-3">
                  <label className="form-label">Department Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter Department Name"
                    value={editDepartmentName}
                    onChange={(e) => {
                      setEditDepartmentName(e.target.value);
                      setEditFormError(null);
                    }}
                    maxLength={100}
                    autoComplete="off"
                    key={`dept-name-${selectedDepartment?.id || 'new'}`}
                  />
                </div>
              </div>
              <div className="d-flex align-items-center justify-content-between">
                <div className="status-title">
                  <h5>Status</h5>
                  <p>Change the Status by toggle </p>
                </div>
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="switch-sm2"
                    checked={editDepartmentStatus}
                    onChange={(e) => setEditDepartmentStatus(e.target.checked)}
                    key={`dept-status-${selectedDepartment?.id || 'new'}`}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <Link
              to="#"
              className="btn btn-light me-2"
              data-bs-dismiss="modal"
              onClick={() => setEditFormError(null)}
            >
              Cancel
            </Link>
            <Link
              to="#"
              className="btn btn-primary"
              onClick={async (e) => {
                e.preventDefault();
                if (isUpdating) return;
                if (!selectedDepartment) return;

                const id =
                  selectedDepartment?.originalData?.id ?? selectedDepartment?.id;

                if (!id) {
                  setEditFormError('No department id found for update.');
                  return;
                }

                const trimmed = editDepartmentName.trim();
                if (!trimmed) {
                  setEditFormError('Department name is required.');
                  return;
                }

                try {
                  setIsUpdating(true);
                  setEditFormError(null);

                  const payload = {
                    department_name: trimmed,
                    is_active: editDepartmentStatus,
                  };

                  await apiService.updateDepartment(id, payload);

                  closeModalById('edit_department');

                  await refetch();

                  setSelectedDepartment(null);
                  setEditDepartmentName('');
                  setEditDepartmentStatus(true);
                } catch (err) {
                  setEditFormError(parseDepartmentApiError(err, 'Failed to update department.'));
                } finally {
                  setIsUpdating(false);
                }
              }}
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Link>
          </div>
        </form>
      </div>
    </div>
  </div>
  {/* Edit Department */}
  {/* Delete Modal */}
  <div className="modal fade" id="delete_department_modal">
    <div className="modal-dialog modal-dialog-centered">
      <div className="modal-content">
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="modal-body text-center">
            <span className="delete-icon">
              <i className="ti ti-trash-x" />
            </span>
            <h4>Confirm Deletion</h4>
            {deleteError && (
              <div className="alert alert-danger text-start py-2 mb-2" role="alert">
                {deleteError}
              </div>
            )}
            <p className="mb-1">
              Delete department{' '}
              <strong>{departmentPendingDelete?.name ?? '—'}</strong>? This cannot be undone.
            </p>
            <p className="text-muted small">
              Deletion is blocked if staff or designations still use this department.
            </p>
            <div className="d-flex justify-content-center mt-3">
              <button
                type="button"
                className="btn btn-light me-3"
                data-bs-dismiss="modal"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteError(null);
                  setDepartmentPendingDelete(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDeleting || !departmentPendingDelete}
                onClick={async () => {
                  if (!departmentPendingDelete) return;
                  setDeleteError(null);
                  try {
                    setIsDeleting(true);
                    await apiService.deleteDepartment(departmentPendingDelete.id);
                    closeModalById('delete_department_modal');
                    setDepartmentPendingDelete(null);
                    await refetch();
                  } catch (err) {
                    setDeleteError(parseDepartmentApiError(err, 'Failed to delete department.'));
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
  {/* /Delete Modal */}
</>

    </div>
  )
}

export default Departments
