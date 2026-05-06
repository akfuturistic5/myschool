import { useState, useEffect, useMemo, useRef } from "react";
import { useSections } from "../../../core/hooks/useSections";
import { useClassRooms } from "../../../core/hooks/useClassRooms";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import Swal from "sweetalert2";

const ClassSectionsAssignment = () => {
  const routes = all_routes;
  const { sections = [] as any[], loading: sectionsLoading } = useSections();
  const { classRooms = [] as any[], loading: roomsLoading } = useClassRooms();

  const [classes, setClasses] = useState<any[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [assignedSections, setAssignedSections] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);

  const showToast = (title: string, icon: 'success' | 'error' | 'warning' = 'success') => {
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      icon,
      title
    });
  };

  const fetchSummary = async () => {
    setClassesLoading(true);
    try {
      const res = await apiService.getClassSectionsSummary();
      setClasses(res?.data || []);
    } catch (error) {
      console.error("Failed to fetch summary", error);
    } finally {
      setClassesLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // For modal form
  const [selectedSectionIds, setSelectedSectionIds] = useState<(number | null)[]>([]);
  const [sectionDetails, setSectionDetails] = useState<Record<string, { class_room_id: number | string, max_students: number }>>({});

  const fetchAssignments = async (classId: number) => {
    console.log(`UI: Fetching assignments for classId: ${classId}`);
    setLoadingAssignments(true);
    setSelectedSectionIds([]);
    setSectionDetails({});
    try {
      const res = await apiService.getClassSections(classId);
      const data = res?.data || [];
      setAssignedSections(data);

      // Initialize form state
      const ids: number[] = [];
      const details: any = {};
      
      data.forEach((s: any) => {
        const rawId = s.section_id;
        const sid = (rawId === null || rawId === undefined || rawId === "") ? null : parseInt(String(rawId), 10);
        
        console.log(`UI: Raw section_id from API: ${rawId} (type: ${typeof rawId}) -> Parsed: ${sid}`);
        
        if (sid === null || !isNaN(sid)) {
          ids.push(sid as any);
          const stateKey = sid === null ? "null" : sid;
          details[stateKey] = {
            class_room_id: s.class_room_id ? String(s.class_room_id) : "",
            max_students: s.max_students || 30
          };
        }
      });
      
      setSelectedSectionIds(ids);
      setSectionDetails(details);
    } catch (error) {
      console.error("Failed to fetch assignments", error);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleManageClick = (cls: any) => {
    setSelectedClass(cls);
    fetchAssignments(cls.id);
    const modal = (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("manage_sections_modal"));
    modal?.show();
  };

  const handleToggleSection = (sectionId: number) => {
    setSelectedSectionIds(prev => {
      if (prev.includes(sectionId)) {
        return prev.filter(id => id !== sectionId);
      } else {
        // Initialize details if not present
        if (!sectionDetails[sectionId]) {
          setSectionDetails(d => ({
            ...d,
            [sectionId]: { class_room_id: "", max_students: 30 }
          }));
        }
        return [...prev, sectionId];
      }
    });
  };

  const handleDetailChange = (sectionId: string | number, field: string, value: any) => {
    setSectionDetails(prev => {
      const stateKey = sectionId === null ? "null" : String(sectionId);
      const current = prev[stateKey] || { class_room_id: "", max_students: 30 };
      
      // [VALIDATION] Check if room is already assigned to another section in this modal
      if (field === "class_room_id" && value !== "") {
        const duplicateSectionId = selectedSectionIds.find(sid => {
          const sidKey = sid === null ? "null" : String(sid);
          return sidKey !== stateKey && String(sectionDetails[sidKey]?.class_room_id) === String(value);
        });
        
        if (duplicateSectionId !== undefined) {
          const otherSec = sections.find((s: any) => s.id === (duplicateSectionId === null ? null : duplicateSectionId));
          showToast(`Room is already assigned to Section ${otherSec?.section_name || duplicateSectionId || 'General'} in this class`, 'warning');
          return prev; // Reject change
        }

        // [VALIDATION] Check if room is already assigned to ANY OTHER class
        for (const cls of classes) {
          if (cls.id === selectedClass.id) continue; // Skip current class (handled above)
          const conflict = cls.sections?.find((s: any) => String(s.class_room_id) === String(value));
          if (conflict) {
            showToast(`Room is already assigned to ${cls.class_name} - ${conflict.section_name}`, 'warning');
            return prev; // Reject change
          }
        }
      }

      const newDetails: any = {
        ...current,
        [field]: value
      };

      // Auto-set max students if room is changed
      if (field === "class_room_id" && value) {
        const room = classRooms.find((r: any) => String(r.id) === String(value));
        if (room && room.capacity) {
          newDetails.max_students = parseInt(String(room.capacity), 10);
        }
      }

      // Cap max students if it exceeds room capacity
      const roomId = field === "class_room_id" ? value : newDetails.class_room_id;
      if (roomId) {
        const room = classRooms.find((r: any) => String(r.id) === String(roomId));
        if (room && room.capacity) {
          const cap = parseInt(String(room.capacity), 10);
          const currentMax = parseInt(String(newDetails.max_students), 10);
          if (!isNaN(currentMax) && currentMax > cap) {
            newDetails.max_students = cap;
          }
        }
      }

      return {
        ...prev,
        [stateKey]: newDetails
      };
    });
  };

  const handleSave = async () => {
    if (!selectedClass) return;
    setSaving(true);

    try {
      const payload = {
        class_id: selectedClass.id,
        section_ids: selectedSectionIds.map(id => {
          const stateKey = id === null ? "null" : String(id);
          const details = sectionDetails[stateKey];
          
          let roomId: number | null = null;
          if (details && details.class_room_id !== undefined && details.class_room_id !== null && details.class_room_id !== "") {
            roomId = parseInt(String(details.class_room_id), 10);
          }
          
          return {
            section_id: id === null ? null : Number(id),
            class_room_id: (roomId === null || isNaN(roomId)) ? null : roomId,
            max_students: details?.max_students || 30
          };
        })
      };

      // [VALIDATION] Check for duplicate rooms in payload
      const assignedRooms = payload.section_ids
        .map(s => s.class_room_id)
        .filter(id => id !== null);
      
      if (new Set(assignedRooms).size !== assignedRooms.length) {
        showToast("The same room cannot be assigned to multiple sections in this class", 'warning');
        setSaving(false);
        return;
      }

      const res = await apiService.assignSectionsToClass(payload);
      if (res.status === "SUCCESS") {
        showToast("Assignments updated successfully", 'success');
        fetchSummary();
        const modal = (window as any).bootstrap?.Modal?.getInstance(document.getElementById("manage_sections_modal"));
        modal?.hide();
      } else {
        throw new Error(res.message || "Failed to update assignments");
      }
    } catch (error: any) {
      showToast(error.message || "An error occurred", 'error');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: "Class Name",
      dataIndex: "class_name",
      sorter: (a: any, b: any) => a.class_name.localeCompare(b.class_name),
      render: (text: string, record: any) => (
        <div className="d-flex flex-column">
          <span className="fw-bold">{text}</span>
          <span className="text-muted fs-12">{record.class_code || "No code"}</span>
        </div>
      )
    },
    {
      title: "Assigned Sections",
      dataIndex: "sections",
      render: (_: any, record: any) => {
        // Since useClasses might not return sections directly now, we might need a separate hook or just show count if available
        // But for now, let's assume we can fetch them or show a "View" action
        return (
          <div className="d-flex flex-wrap gap-1">
            {record.sections?.length > 0 ? (
              record.sections.map((s: any) => (
                <span key={s.id} className="badge badge-soft-info border-info-subtle px-2 py-1">
                  {s.section_name} {s.room_number ? `(${s.room_number})` : ""}
                </span>
              ))
            ) : (
              <span className="text-muted fs-12 italic">No sections assigned</span>
            )}
          </div>
        );
      }
    },
    {
      title: "Capacity",
      dataIndex: "total_capacity",
      render: (_: any, record: any) => {
        const total = record.sections?.reduce((acc: number, s: any) => acc + (s.max_students || 0), 0) || 0;
        return <span className="badge badge-soft-secondary">{total} Seats</span>;
      }
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <button
          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
          onClick={() => handleManageClick(record)}
        >
          <i className="ti ti-settings fs-14"></i>
          Manage
        </button>
      )
    }
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1 text-primary fw-bold">Class Section Assignments</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                <li className="breadcrumb-item text-muted">Academic</li>
                <li className="breadcrumb-item active">Class Sections</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
            <TooltipOption />
          </div>
        </div>


        <div className="card border-0 shadow-sm rounded-3">
          <div className="card-header bg-white border-bottom py-3">
            <div className="d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">Academic Structure</h5>
              <div className="text-muted fs-12">Manage room numbers and student capacities per class section</div>
            </div>
          </div>
          <div className="card-body p-0">
            <Table
              columns={columns}
              dataSource={classes}
              loading={classesLoading}
              Selection={false}
            />
          </div>
        </div>
      </div>

      {/* Management Modal */}
      <div className="modal fade" id="manage_sections_modal" tabIndex={-1} aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-primary text-white border-0">
              <div className="modal-title">
                <h5 className="mb-0 text-white">Manage Sections for <span className="fw-bold">{selectedClass?.class_name}</span></h5>
                <p className="fs-12 mb-0 opacity-75">Assign sections and configure their settings</p>
              </div>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div className="modal-body p-4">
              {loadingAssignments ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                  <p className="mt-2 text-muted">Loading assignments...</p>
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold mb-3">Select Sections</label>
                    <div className="d-flex flex-wrap gap-2 mb-4">
                      {sections.map((sec: any) => (
                        <button
                          key={sec.id}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 transition-all ${selectedSectionIds.includes(Number(sec.id)) ? 'btn-primary shadow-sm' : 'btn-outline-light text-dark bg-light'}`}
                          onClick={() => handleToggleSection(Number(sec.id))}
                        >
                          {sec.section_name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedSectionIds.length > 0 ? (
                    <div className="col-12">
                      <div className="table-responsive rounded border">
                        <table className="table table-nowrap mb-0 align-middle">
                          <thead className="bg-light">
                            <tr>
                              <th className="fs-12 text-uppercase fw-bold text-muted py-2">Section</th>
                              <th className="fs-12 text-uppercase fw-bold text-muted py-2" style={{ width: '40%' }}>Class Room</th>
                              <th className="fs-12 text-uppercase fw-bold text-muted py-2" style={{ width: '30%' }}>Max Students</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSectionIds.map(id => {
                              const stateKey = id === null ? "null" : String(id);
                              const isGeneral = id === null;
                              const sec = isGeneral ? { section_name: 'General' } : sections.find((s: any) => s.id === id);
                              
                              return (
                                <tr key={stateKey}>
                                  <td><span className="fw-medium text-primary">{sec?.section_name}</span></td>
                                  <td>
                                    <select
                                      className="form-select form-select-sm border-0 bg-light"
                                      value={String(sectionDetails[stateKey]?.class_room_id || "")}
                                      onChange={(e) => handleDetailChange(stateKey as any, "class_room_id", e.target.value)}
                                    >
                                      <option value="">Select Room</option>
                                      {classRooms.map((room: any) => (
                                        <option key={room.id} value={String(room.id)}>
                                          {room.room_number}
                                          {room.building_name ? ` (Building: ${room.building_name})` : ""}
                                          {room.floor !== null && room.floor !== undefined ? ` (Floor: ${room.floor})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td>
                                    {(() => {
                                      const roomId = sectionDetails[stateKey]?.class_room_id;
                                      const room = roomId ? classRooms.find((r: any) => String(r.id) === String(roomId)) : null;
                                      const maxCap = room && room.capacity ? parseInt(room.capacity, 10) : undefined;

                                      return (
                                        <input
                                          type="number"
                                          className="form-control form-control-sm border-0 bg-light"
                                          min={1}
                                          max={maxCap}
                                          value={sectionDetails[stateKey]?.max_students || 30}
                                          onChange={(e) => handleDetailChange(stateKey as any, "max_students", e.target.value)}
                                        />
                                      );
                                    })()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="col-12">
                      <div className="alert alert-soft-info border-dashed text-center py-4 mb-0">
                        <i className="ti ti-info-circle fs-24 mb-2"></i>
                        <p className="mb-3">No sections are assigned to this class. Would you like to assign a <strong>General Room</strong> for the entire class?</p>
                        <button 
                          type="button" 
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedSectionIds([null]);
                            setSectionDetails({ "null": { class_room_id: "", max_students: 30 } });
                          }}
                        >
                          Assign Class-Level Room
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer border-top bg-light">
              <button type="button" className="btn btn-light px-4" data-bs-dismiss="modal">Cancel</button>
              <button
                type="button"
                className="btn btn-primary px-4 shadow-sm"
                onClick={handleSave}
                disabled={saving || loadingAssignments}
              >
                {saving ? (
                  <span className="d-flex align-items-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Saving...
                  </span>
                ) : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassSectionsAssignment;
