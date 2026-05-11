import React, { useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import Table from "../../../core/common/dataTable/index";
import { useSalaryComponents } from "../../../core/hooks/useSalaryComponents";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";

const SalarySettings = () => {
  const { salaryComponents, loading, refresh } = useSalaryComponents() as any;
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedComp, setSelectedComp] = useState<any>(null);
  const [formData, setFormData] = useState({
    component_name: "",
    type: "earning",
    description: "",
  });

  const routes = all_routes;

  const handleEdit = (comp: any) => {
    setSelectedComp(comp);
    setFormData({
      component_name: comp.component_name,
      type: comp.type,
      description: comp.description || "",
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    });

    if (result.isConfirmed) {
      try {
        await apiService.deleteSalaryComponent(id);
        Swal.fire("Deleted!", "Component has been deleted.", "success");
        refresh();
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to delete component", "error");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editMode && selectedComp) {
        await apiService.updateSalaryComponent(selectedComp.id, formData);
        Swal.fire("Success", "Component updated successfully", "success");
      } else {
        await apiService.createSalaryComponent(formData);
        Swal.fire("Success", "Component created successfully", "success");
      }
      setShowModal(false);
      setEditMode(false);
      setFormData({ component_name: "", type: "earning", description: "" });
      refresh();
    } catch (err: any) {
      Swal.fire("Error", err.message || "Failed to save component", "error");
    }
  };

  const columns = [
    {
      title: "Component Name",
      dataIndex: "component_name",
      sorter: (a: any, b: any) => a.component_name.localeCompare(b.component_name),
    },
    {
      title: "Type",
      dataIndex: "type",
      render: (text: string) => (
        <span className={`badge ${text === 'earning' || text === 'allowance' ? 'badge-soft-success' : 'badge-soft-danger'}`}>
          {text.toUpperCase()}
        </span>
      ),
      sorter: (a: any, b: any) => a.type.localeCompare(b.type),
    },
    {
      title: "Description",
      dataIndex: "description",
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center">
          <Link to="#" className="btn btn-icon btn-sm btn-soft-primary me-2" onClick={() => handleEdit(record)}>
            <i className="ti ti-edit" />
          </Link>
          <Link to="#" className="btn btn-icon btn-sm btn-soft-danger" onClick={() => handleDelete(record.id)}>
            <i className="ti ti-trash" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Salary Components</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={routes.payroll}>Payroll</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Salary Components
                </li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <button className="btn btn-primary d-flex align-items-center" onClick={() => { setEditMode(false); setFormData({ component_name: "", type: "earning", description: "" }); setShowModal(true); }}>
              <i className="ti ti-square-rounded-plus me-2" />
              Add Component
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-body p-0 py-3">
            <Table columns={columns} dataSource={salaryComponents} Selection={true} />
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editMode ? 'Edit' : 'Add'} Salary Component</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Component Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.component_name}
                      onChange={(e) => setFormData({ ...formData, component_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="earning">Earning (Allowance)</option>
                      <option value="deduction">Deduction</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySettings;
