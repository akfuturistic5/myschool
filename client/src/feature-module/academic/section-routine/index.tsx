import { useCallback, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import TooltipOption from "../../../core/common/tooltipOption";
import {
  exportTimetableGridToExcel,
  exportTimetableGridToPDF,
  printTimetableGrid,
} from "../../../core/utils/exportUtils";
import { all_routes } from "../../router/all_routes";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import {
  WEEK_DAYS,
  buildPeriodColumnsFromSlots,
  findCellForSlot,
  formatSectionExportCell,
  RoutineGridCell,
} from "../utils/sectionRoutineGrid";

const SectionRoutine = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [filterClassId, setFilterClassId] = useState("");
  const [filterSectionId, setFilterSectionId] = useState("");
  const ready = Boolean(academicYearId && filterClassId && filterSectionId);

  const { data, slots: apiSlots, loading, error, refetch } = useClassSchedules({
    academicYearId,
    classId: filterClassId ? Number(filterClassId) : null,
    sectionId: filterSectionId ? Number(filterSectionId) : null,
    skip: !ready,
  });

  const { classes = [] } = useClasses(academicYearId ?? undefined);
  const { sections: filterSections = [] } = useSections(filterClassId || null, { fetchAllWhenNoClass: false });

  const sectionRoomLabel = useMemo(() => {
    const sec = filterSections.find((x: { id?: unknown }) => String(x.id) === String(filterSectionId));
    const rn =
      sec && typeof sec === "object" && sec !== null && "room_number" in sec ? (sec as { room_number?: string }).room_number : "";
    return String(rn ?? "").trim() || "—";
  }, [filterSections, filterSectionId]);

  const periodColumns = useMemo(() => buildPeriodColumnsFromSlots(apiSlots, data), [apiSlots, data]);

  const options = (arr: any[], valueKey = "id", labelKey = "name") =>
    [{ value: "", label: "Select" }, ...arr.map((x: any) => ({ value: String(x[valueKey]), label: x[labelKey] ?? String(x[valueKey]) }))];
  const classOptions = options(classes, "id", "class_name");
  const filterSectionOptions = options(filterSections, "id", "section_name");

  const selectedClassName = useMemo(() => {
    const c = classes.find((x: { id?: unknown }) => String(x.id) === String(filterClassId));
    return c ? String((c as { class_name?: string }).class_name ?? filterClassId) : String(filterClassId);
  }, [classes, filterClassId]);

  const selectedSectionName = useMemo(() => {
    const s = filterSections.find((x: { id?: unknown }) => String(x.id) === String(filterSectionId));
    return s ? String((s as { section_name?: string }).section_name ?? filterSectionId) : String(filterSectionId);
  }, [filterSections, filterSectionId]);

  const exportGridHeaders = useMemo(() => {
    return [
      "Day",
      ...periodColumns.map((c) => (c.isBreak ? c.label : `${c.label}\n${c.start} – ${c.end}`)),
    ];
  }, [periodColumns]);

  const exportGridBody = useMemo(() => {
    if (!ready || !periodColumns.length) return [] as string[][];
    return WEEK_DAYS.map(({ label: dayLabel }) => [
      dayLabel,
      ...periodColumns.map((col) =>
        formatSectionExportCell(col, findCellForSlot(data, dayLabel, col.id), sectionRoomLabel)
      ),
    ]);
  }, [ready, periodColumns, data, sectionRoomLabel]);

  const exportTitle = useMemo(
    () => `Section timetable — ${selectedClassName} / ${selectedSectionName}`,
    [selectedClassName, selectedSectionName]
  );

  const hasGridExport = exportGridBody.length > 0;

  const handleExportExcel = useCallback(() => {
    if (!hasGridExport) return;
    exportTimetableGridToExcel(exportGridHeaders, exportGridBody, "section-routine", "Section routine");
  }, [hasGridExport, exportGridHeaders, exportGridBody]);

  const handleExportPdf = useCallback(() => {
    if (!hasGridExport) return;
    exportTimetableGridToPDF(exportTitle, exportGridHeaders, exportGridBody, "section-routine", {
      showHead: "firstPage",
    });
  }, [hasGridExport, exportTitle, exportGridHeaders, exportGridBody]);

  const handlePrint = useCallback(() => {
    if (!hasGridExport) return;
    printTimetableGrid(exportTitle, exportGridHeaders, exportGridBody);
  }, [hasGridExport, exportTitle, exportGridHeaders, exportGridBody]);

  return (
    <div>
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Section routine</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Academic</li>
                  <li className="breadcrumb-item">Timetable</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Section routine
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <TooltipOption
                onRefresh={() => void refetch()}
                onPrint={handlePrint}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <h5 className="card-title mb-3">Filter by class &amp; section</h5>
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Class</label>
                  <CommonSelect
                    className="select"
                    options={classOptions}
                    value={filterClassId || null}
                    placeholder="Select class"
                    onChange={(v) => {
                      setFilterClassId(v || "");
                      setFilterSectionId("");
                    }}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Section</label>
                  <CommonSelect
                    className="select"
                    options={filterSectionOptions}
                    value={filterSectionId || null}
                    placeholder={filterClassId ? "Select section" : "Select class first"}
                    onChange={(v) => setFilterSectionId(v || "")}
                  />
                </div>
                <div className="col-md-4">
                  <p className="text-muted small mb-0">
                    View-only weekly timetable. Periods are defined under <Link to={routes.sheduleClasses}>Time slots</Link>. Use
                    Export for PDF or Excel when a class and section are selected.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {!academicYearId ? <div className="alert alert-warning">Select an academic year in the header.</div> : null}
          {academicYearId && !ready ? (
            <div className="alert alert-light border">Select both class and section to view the routine.</div>
          ) : null}
          {error && ready ? <div className="alert alert-danger">{error}</div> : null}

          {ready ? (
            <div className="card">
              <div className="card-header">
                <h4 className="mb-0">Weekly timetable</h4>
                <p className="text-muted small mb-0 mt-1">Rows are days; columns are periods from your time slots.</p>
              </div>
              <div className="card-body">
                {loading ? (
                  <p className="text-muted mb-0">Loading…</p>
                ) : periodColumns.length === 0 ? (
                  <div className="alert alert-secondary mb-0">
                    No periods found. Add active periods under <strong>Academic → Timetable → Time slots</strong>.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-bordered table-sm align-middle">
                      <thead className="table-light">
                        <tr>
                          <th style={{ minWidth: 96 }}>Day</th>
                          {periodColumns.map((col) => (
                            <th key={col.id} className={col.isBreak ? "text-muted" : ""} style={{ minWidth: 140 }}>
                              <div>{col.label}</div>
                              <div className="small fw-normal text-muted">
                                {col.isBreak ? "Break" : `${col.start} – ${col.end}`}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {WEEK_DAYS.map(({ label }) => (
                          <tr key={label}>
                            <th className="table-light">{label}</th>
                            {periodColumns.map((col) => (
                              <RoutineGridCell
                                key={`${label}-${col.id}`}
                                slot={col}
                                entry={findCellForSlot(data, label, col.id)}
                                sectionRoomLabel={sectionRoomLabel}
                              />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SectionRoutine;
