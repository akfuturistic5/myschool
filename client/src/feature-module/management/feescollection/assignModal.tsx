import { useRef, useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import ImageWithBasePath from '../../../core/common/imageWithBasePath'
import { all_routes } from '../../router/all_routes'
import { selectSelectedAcademicYearId } from '../../../core/data/redux/academicYearSlice'
import { apiService } from '../../../core/services/apiService'
import CommonSelect from '../../../core/common/commonSelect'
import { Modal } from "react-bootstrap";
import Swal from 'sweetalert2'

const AssignModal = ({ addModal, setAddModal, editModal, setEditModal, deleteId, onDeleteSuccess }: any) => {
    const routes = all_routes
    const academicYearId = useSelector(selectSelectedAcademicYearId);
    
    const [feesMaster, setFeesMaster] = useState<any[]>([]);
    const [filteredFees, setFilteredFees] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [selectedFees, setSelectedFees] = useState<number[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    // Dynamic Options
    const [groups, setGroups] = useState<any[]>([]);
    const [types, setTypes] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);

    // Filter States
    const [filterGroup, setFilterGroup] = useState<string>("All");
    const [filterType, setFilterType] = useState<string>("All");
    const [filterClass, setFilterClass] = useState<string>("All");
    const [filterGender, setFilterGender] = useState<string>("All");

    const fetchCriteriaData = async () => {
      try {
        setLoading(true);
        if (!academicYearId) return;

        // Fetch Fees Master (available fees to assign)
        const fmRes = await apiService.getFeesMaster({ academic_year_id: academicYearId });
        if (fmRes.status === "SUCCESS") {
          setFeesMaster(fmRes.data);
          setFilteredFees(fmRes.data);
        }

        // Fetch Students (available students to assign to)
        const sRes = await apiService.getStudents(academicYearId);
        if (sRes.status === "SUCCESS") {
          setStudents(sRes.data);
          setFilteredStudents(sRes.data);
        }

        const gRes = await apiService.getFeesGroups({ academic_year_id: academicYearId });
        if (gRes.status === "SUCCESS") setGroups(gRes.data);
        
        const tRes = await apiService.getFeesTypes();
        if (tRes.status === "SUCCESS") setTypes(tRes.data);
        
        const cRes = await apiService.getClasses();
        if (cRes.status === "SUCCESS") setClasses(cRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      if (addModal || editModal) {
        fetchCriteriaData();
      }
    }, [addModal, editModal, academicYearId]);

    const handleAssign = async () => {
      try {
        if (selectedFees.length === 0 || selectedStudents.length === 0) {
          Swal.fire("Error", "Please select at least one fee type and one student", "error");
          return;
        }

        setLoading(true);
        const res = await apiService.assignFees({
          academic_year_id: academicYearId,
          fees_master_ids: selectedFees,
          student_ids: selectedStudents
        });

        if (res.status === "SUCCESS") {
          Swal.fire("Success", "Fees assigned successfully", "success");
          handleClose();
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to assign fees", "error");
      } finally {
        setLoading(false);
      }
    };

    const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
    const dropdownMenuRef2 = useRef<HTMLDivElement | null>(null);

    const handleApplyFilter = (e: any) => {
      e.preventDefault();
      
      // Filter Fees
      let fFees = [...feesMaster];
      if (filterGroup !== "All") fFees = fFees.filter(f => f.fees_group_id === Number(filterGroup));
      if (filterType !== "All") fFees = fFees.filter(f => f.fees_type_id === Number(filterType));
      setFilteredFees(fFees);

      // Filter Students
      let fStuds = [...students];
      if (filterClass !== "All") fStuds = fStuds.filter(s => s.class_name === filterClass);
      if (filterGender !== "All") fStuds = fStuds.filter(s => s.gender === filterGender);
      setFilteredStudents(fStuds);

      if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
      if (dropdownMenuRef2.current) dropdownMenuRef2.current.classList.remove("show");
    };

    const handleReset = () => {
      setFilterGroup("All");
      setFilterType("All");
      setFilterClass("All");
      setFilterGender("All");
      setFilteredFees(feesMaster);
      setFilteredStudents(students);
    };

    const handleClose = () => {
      setAddModal(false);
      setEditModal(false);
      setSelectedFees([]);
      setSelectedStudents([]);
    };

    const handleDelete = async () => {
      try {
        if (!deleteId) return;
        setLoading(true);
        const res = await apiService.deleteFeesAssignment(deleteId);
        if (res.status === "SUCCESS") {
          Swal.fire("Success", "Fees assignment deleted", "success");
          if (onDeleteSuccess) onDeleteSuccess();
          const modalElement = document.getElementById('delete-modal');
          if (modalElement) {
            (window as any).bootstrap?.Modal?.getInstance(modalElement)?.hide();
          }
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to delete assignment", "error");
      } finally {
        setLoading(false);
      }
    };

  return (
    <>
      {/* Add Fees Assign */}
      <Modal show={addModal} onHide={handleClose} centered size="xl">
        <div className="modal-header">
          <h4 className="modal-title">Assign New Fees</h4>
          <button type="button" className="btn-close custom-btn-close" onClick={handleClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="table-filter-head">
            <div className="filter-head-left">
              <h5>Search Criteria</h5>
              <div className="dropdown mb-3 me-2">
                <Link to="#" className="btn btn-outline-light bg-white dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside">
                  <i className="ti ti-filter me-2" /> Filter
                </Link>
                <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                  <form onSubmit={handleApplyFilter}>
                    <div className="d-flex align-items-center border-bottom p-3"><h4>Filter</h4></div>
                    <div className="p-3 pb-0 border-bottom">
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Fees Group</label>
                          <CommonSelect
                            className="select"
                            options={[{ value: "All", label: "All Groups" }, ...groups.map(g => ({ value: g.id.toString(), label: g.name }))]}
                            value={filterGroup}
                            onChange={(val: any) => setFilterGroup(val || "All")}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Fees Type</label>
                          <CommonSelect
                            className="select"
                            options={[{ value: "All", label: "All Types" }, ...types.map(t => ({ value: t.id.toString(), label: t.name }))]}
                            value={filterType}
                            onChange={(val: any) => setFilterType(val || "All")}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Class</label>
                          <CommonSelect
                            className="select"
                            options={[{ value: "All", label: "All Classes" }, ...classes.map(c => ({ value: c.name, label: c.name }))]}
                            value={filterClass}
                            onChange={(val: any) => setFilterClass(val || "All")}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Gender</label>
                          <CommonSelect
                            className="select"
                            options={[{ value: "All", label: "All" }, { value: "Male", label: "Male" }, { value: "Female", label: "Female" }]}
                            value={filterGender}
                            onChange={(val: any) => setFilterGender(val || "All")}
                          />
                        </div>
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

          <div className="row">
            <div className="col-md-5">
              <div className="modal-card-table">
                <div className="modal-table-head d-flex align-items-center justify-content-between">
                  <h4>List of Fees type</h4>
                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      checked={filteredFees.length > 0 && selectedFees.length === filteredFees.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedFees(filteredFees.map(f => f.id));
                        else setSelectedFees([]);
                      }}
                    />
                  </div>
                </div>
                <div className="table-responsive custom-table">
                  <table className="table">
                    <thead className="thead-light">
                      <tr>
                        <th></th>
                        <th>Group</th>
                        <th>Type</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFees.map((fm) => (
                        <tr key={fm.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedFees.includes(fm.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedFees([...selectedFees, fm.id]);
                                else setSelectedFees(selectedFees.filter(id => id !== fm.id));
                              }}
                            />
                          </td>
                          <td>{fm.fees_group_name}</td>
                          <td>{fm.fees_type_name}</td>
                          <td>{fm.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-7">
              <div className="modal-card-table">
                <div className="modal-table-head d-flex align-items-center justify-content-between">
                  <h4>Student Details</h4>
                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      checked={filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudents(filteredStudents.map(s => s.id));
                        else setSelectedStudents([]);
                      }}
                    />
                  </div>
                </div>
                <div className="table-responsive custom-table" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead className="thead-light">
                      <tr>
                        <th></th>
                        <th>Student</th>
                        <th>Class</th>
                        <th>Gen</th>
                        <th>Admission No</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedStudents.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedStudents([...selectedStudents, student.id]);
                                else setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                              }}
                            />
                          </td>
                          <td>{student.first_name} {student.last_name}</td>
                          <td>{student.class_name}</td>
                          <td>{student.gender?.charAt(0)}</td>
                          <td>{student.admission_number}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          <div className="student-pomote-note d-flex mt-3">
            <span className="info-icon"><i className="ti ti-info-circle" /></span>
            <p> Selected {selectedFees.length} Fees, {selectedStudents.length} Students</p>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={handleClose} className="btn btn-light me-2">Cancel</button>
          <button onClick={handleAssign} className="btn btn-primary" disabled={loading}>
            {loading ? "Assigning..." : "Add Fees"}
          </button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="modal-body text-center">
                <span className="delete-icon"><i className="ti ti-trash-x" /></span>
                <h4>Confirm Deletion</h4>
                <p>You want to delete this assignment? This cannot be undone.</p>
                <div className="d-flex justify-content-center">
                  <button type="button" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                    {loading ? "Deleting..." : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default AssignModal
