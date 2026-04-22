import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { apiService } from "../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

type HolidayItem = {
  id: number;
  title: string;
  description?: string | null;
  start_date: string;
  end_date: string;
  holiday_type?: string | null;
};

const todayYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const prettyDate = (d: string) => {
  const parsed = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return String(d).slice(0, 10);
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export default function HolidayDashboardCard() {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [holiday, setHoliday] = useState<HolidayItem | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const today = todayYMD();
        const res = await apiService.getHolidays({
          startDate: today,
          endDate: today,
          academicYearId,
        });
        if (disposed) return;
        const rows = Array.isArray(res?.data) ? res.data : [];
        setHoliday(rows.length > 0 ? rows[0] : null);
      } catch {
        if (!disposed) setHoliday(null);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [academicYearId]);

  if (!holiday) return null;

  return (
    <div className="col-md-6 col-lg-5 col-xl-4 d-flex">
      <div className="alert alert-warning border-0 border-start border-5 border-warning shadow-sm flex-fill mb-3">
        <div className="d-flex flex-column">
          <div className="d-flex align-items-center mb-2">
            <span className="avatar avatar-sm rounded bg-warning text-dark me-2">
              <i className="ti ti-bell-ringing fs-16" />
            </span>
            <strong className="text-dark fs-14 text-uppercase">Holiday Notification</strong>
          </div>
          <h4 className="mb-2 text-dark fw-bold">{holiday.title}</h4>
          <p className="mb-1 fw-semibold text-dark">
            {prettyDate(holiday.start_date)} - {prettyDate(holiday.end_date)}
          </p>
          <p className="mb-0 text-dark fw-semibold">
            {holiday.description || "Today is a holiday. Attendance is auto-marked for all users."}
          </p>
        </div>
      </div>
    </div>
  );
}

