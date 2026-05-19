import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectSelectedAcademicYearId } from '../../../core/data/redux/academicYearSlice'
import { apiService } from '../../../core/services/apiService'
import { useClasses } from '../../../core/hooks/useClasses'
import CommonSelect from '../../../core/common/commonSelect'
import { Modal } from "react-bootstrap";
import Swal from 'sweetalert2'

const MappingModal = ({ show, handleClose, onSuccess, initialClass, initialSection, initialStudentId, initialSubjects }: any) => {
    const academicYearId = useSelector(selectSelectedAcademicYearId);
    const { classes = [] } = useClasses(academicYearId);
    
    const [electives, setElectives] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    const [sections, setSections] = useState<any[]>([]);
    const [filterClass, setFilterClass] = useState<string>(initialClass || "");
    const [filterSection, setFilterSection] = useState<string>(initialSection || "");

    const fetchSectionsForClass = useCallback(async (classId: string) => {
        if (!classId || !academicYearId) {
            setSections([]);
            return;
        }
        try {
            const res = await apiService.getClassSections(classId, academicYearId);
            if (res.status === "SUCCESS") {
                setSections(Array.isArray(res.data) ? res.data : []);
            } else {
                setSections([]);
            }
        } catch (err) {
            console.error(err);
            setSections([]);
        }
    }, [academicYearId]);

    const fetchElectives = async (classId: string) => {
        if (!classId || !academicYearId) {
            setElectives([]);
            return;
        }
        try {
            const res = await apiService.getElectiveSubjects({ 
                class_id: classId,
                academic_year_id: academicYearId
            });
            if (res.status === "SUCCESS") {
                setElectives(res.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchStudents = async (classId: string, sectionId: string) => {
        if (!academicYearId || !classId) {
            setStudents([]);
            return;
        }
        try {
            const res = await apiService.getCurriculumMap({ 
                academic_year_id: academicYearId,
                class_id: classId,
                section_id: sectionId || null
            });
            if (res.status === "SUCCESS") {
                setStudents(res.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (show) {
            if (initialClass) {
                setFilterClass(initialClass);
                fetchSectionsForClass(initialClass);
                fetchElectives(initialClass);
                fetchStudents(initialClass, initialSection || "");
            }
            if (initialStudentId) {
                setSelectedStudents([initialStudentId]);
            } else {
                setSelectedStudents([]);
            }
            if (initialSubjects && initialSubjects.length > 0) {
                setSelectedSubjects(initialSubjects);
            } else {
                setSelectedSubjects([]);
            }
        }
    }, [show, initialClass, initialSection, initialStudentId, initialSubjects, academicYearId, fetchSectionsForClass]);

    const handleClassChange = (val: string | null) => {
        const classId = val || "";
        setFilterClass(classId);
        setFilterSection("");
        setSelectedSubjects([]);
        setSelectedStudents([]);
        if (classId) {
            fetchSectionsForClass(classId);
            fetchElectives(classId);
            fetchStudents(classId, "");
        } else {
            setSections([]);
            setElectives([]);
            setStudents([]);
        }
    };

    const handleSectionChange = (val: string | null) => {
        const sectionId = val || "";
        setFilterSection(sectionId);
        setSelectedStudents([]);
        if (filterClass) {
            fetchStudents(filterClass, sectionId);
        }
    };

    const handleAssign = async () => {
      try {
        if (selectedSubjects.length === 0 || selectedStudents.length === 0) {
          Swal.fire("Error", "Please select at least one elective subject and one student", "error");
          return;
        }

        setLoading(true);
        const res = await apiService.assignElectives({
          academic_year_id: academicYearId,
          class_subject_ids: selectedSubjects,
          student_ids: selectedStudents
        });

        if (res.status === "SUCCESS") {
          Swal.fire("Success", "Electives assigned successfully", "success");
          onSuccess(filterClass, filterSection);
          handleClose();
          setSelectedSubjects([]);
          setSelectedStudents([]);
        }
      } catch (err: any) {
        Swal.fire("Error", err.message || "Failed to assign electives", "error");
      } finally {
        setLoading(false);
      }
    };

  return (
    <Modal show={show} onHide={handleClose} centered size="xl">
        <div className="modal-header">
          <h4 className="modal-title">Bulk Assign Electives</h4>
          <button type="button" className="btn-close custom-btn-close" onClick={handleClose} aria-label="Close">
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">
          <div className="row mb-4">
              <div className="col-md-6">
                  <label className="form-label">Target Class</label>
                  <CommonSelect
                    className="select"
                    options={classes.map((c: any) => ({
                      value: String(c.id),
                      label: c.class_name || c.name,
                    }))}
                    value={filterClass}
                    onChange={handleClassChange}
                    isDisabled={!academicYearId}
                  />
              </div>
              <div className="col-md-6">
                  <label className="form-label">Target Section</label>
                  <CommonSelect
                    className="select"
                    options={[
                      { value: "", label: "All Sections" },
                      ...sections.map((s: any) => ({
                        value: String(s.section_id ?? s.id),
                        label: s.section_name || s.name,
                      })),
                    ]}
                    value={filterSection}
                    onChange={handleSectionChange}
                    isDisabled={!filterClass}
                  />
              </div>
          </div>

          <div className="row">
            <div className="col-md-5">
              <div className="modal-card-table">
                <div className="modal-table-head d-flex align-items-center justify-content-between">
                  <h4>Available Electives</h4>
                  {/* Select All disabled for subjects to respect group limits */}
                </div>
                <div className="table-responsive custom-table" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead className="thead-light">
                      <tr>
                        <th></th>
                        <th>Subject</th>
                        <th>Group / Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {electives.map((e) => (
                        <tr key={e.class_subject_id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedSubjects.includes(e.class_subject_id)}
                              onChange={(ev) => {
                                if (ev.target.checked) {
                                  // Find all elective subjects belonging to the same group as 'e'
                                  const groupElectives = electives.filter(el => el.elective_group_id === e.elective_group_id);
                                  // Count how many subjects in THIS group are currently selected
                                  const groupSelectedCount = selectedSubjects.filter(id => 
                                    groupElectives.some(el => el.class_subject_id === id)
                                  ).length;

                                  const limit = Number(e.selectable_subjects || 0);
                                  if (limit > 0 && groupSelectedCount >= limit) {
                                    Swal.fire({
                                      title: "Selection Limit",
                                      text: `You can only select up to ${limit} subject(s) from the "${e.elective_group_name}" group.`,
                                      icon: "warning"
                                    });
                                    return;
                                  }

                                  setSelectedSubjects([...selectedSubjects, e.class_subject_id]);
                                } else {
                                  setSelectedSubjects(selectedSubjects.filter(id => id !== e.class_subject_id));
                                }
                              }}
                            />
                          </td>
                          <td>
                            <div className="d-flex flex-column">
                              <span>{e.subject_name}</span>
                              <small className="text-muted" style={{ fontSize: '10px' }}>{e.subject_type}</small>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex flex-column">
                              <span className={`badge ${e.elective_group_name ? 'badge-soft-info' : 'badge-soft-warning'} mb-1`}>
                                {e.elective_group_name || "Ungrouped"}
                              </span>
                              {Number(e.selectable_subjects) > 0 ? (
                                <small className="text-primary fw-bold" style={{ fontSize: '10px' }}>
                                  Pick {e.selectable_subjects} of {electives.filter(el => el.elective_group_id === e.elective_group_id).length}
                                </small>
                              ) : (
                                <small className="text-muted" style={{ fontSize: '10px' }}>
                                  No Limit
                                </small>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {electives.length === 0 && (
                          <tr>
                              <td colSpan={3} className="text-center p-3 text-muted">No electives found for this class</td>
                          </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="col-md-7">
              <div className="modal-card-table">
                <div className="modal-table-head d-flex align-items-center justify-content-between">
                  <h4>Select Students</h4>
                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      checked={students.length > 0 && selectedStudents.length === students.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedStudents(students.map(s => s.id));
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
                        <th>Admission No</th>
                        <th>Current Choices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
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
                          <td>{student.admission_number}</td>
                          <td>
                              <small className="text-muted" style={{ fontSize: '10px' }}>
                                {student.selected_electives || "None"}
                              </small>
                          </td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                          <tr>
                              <td colSpan={4} className="text-center p-3 text-muted">No students found</td>
                          </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
          <div className="student-pomote-note d-flex mt-3 p-2 bg-light rounded">
            <span className="info-icon me-2 text-primary"><i className="ti ti-info-circle" /></span>
            <p className="mb-0"> 
                Assigning a subject will replace existing choices for students within the <strong>same elective group</strong>.
                Selected: {selectedSubjects.length} Electives, {selectedStudents.length} Students.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={handleClose} className="btn btn-light me-2">Cancel</button>
          <button onClick={handleAssign} className="btn btn-primary" disabled={loading || selectedStudents.length === 0 || selectedSubjects.length === 0}>
            {loading ? "Assigning..." : "Apply Selection"}
          </button>
        </div>
      </Modal>
  )
}

export default MappingModal;
