import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";

type SchoolEventRow = {
  id: number;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  event_color?: string | null;
  is_all_day?: boolean;
  location?: string | null;
  event_category?: string | null;
};

const Calendar = () => {
  const calendarEvents = useMemo(() => [], []);

  const routes = all_routes;

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Calendar</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Application</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Calendar
                  </li>
                </ol>
              </nav>
            </div>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card bg-white">
                <div className="card-body position-relative">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin]}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    initialView="dayGridMonth"
                    editable={false}
                    selectable={false}
                    dayMaxEvents={true}
                    weekends={true}
                    events={calendarEvents}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Calendar;

