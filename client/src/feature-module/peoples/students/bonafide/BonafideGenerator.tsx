import { FormEvent, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { apiService } from "../../../../../core/services/apiService";
import { useCurrentUser } from "../../../../../core/hooks/useCurrentUser";
import { getSchoolLogoSrc } from "../../../../../core/utils/schoolLogo";
import BonafideCertificateLayout from "./BonafideCertificateLayout";
import "./bonafide.css";

type BonafidePayload = {
  student: {
    id: number;
    first_name: string;
    last_name: string;
    gr_number: string;
    admission_number: string;
  };
  class?: { class_name?: string };
  section?: { section_name?: string };
  academic_year?: { year_name?: string };
  parent?: { father_name?: string; mother_name?: string };
};

type CurrentUserShape = {
  school_name?: string;
  school_type?: string;
  school_logo?: string;
};

const BonafideGenerator = () => {
  const { user: currentUser } = useCurrentUser();
  const [name, setName] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [result, setResult] = useState<BonafidePayload | null>(null);
  const [downloading, setDownloading] = useState(false);

  const schoolName = useMemo(() => {
    const user = (currentUser || {}) as CurrentUserShape;
    const school = user.school_name || "";
    const type = user.school_type || "";
    return `${school} ${type}`.trim() || "School";
  }, [currentUser]);

  const studentFullName = useMemo(() => {
    if (!result?.student) return "";
    return `${result.student.first_name || ""} ${result.student.last_name || ""}`.trim();
  }, [result]);

  const parentName = useMemo(() => {
    return result?.parent?.father_name || result?.parent?.mother_name || "-";
  }, [result]);

  const issueDate = useMemo(() => new Date().toLocaleDateString("en-GB"), []);
  const schoolLogoSrc = useMemo(() => getSchoolLogoSrc((currentUser || null) as CurrentUserShape | null), [currentUser]);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedGr = grNumber.trim();

    if (!trimmedName || !trimmedGr) {
      await Swal.fire({
        icon: "warning",
        title: "Required fields",
        text: "Student Name and GR Number are required",
      });
      return;
    }

    Swal.fire({
      title: "Fetching student details...",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const res = await apiService.fetchStudentForBonafide({
        name: trimmedName,
        gr_number: trimmedGr,
      });
      setResult(res?.data || null);
      Swal.close();
    } catch (error: any) {
      setResult(null);
      const message = String(error?.message || "");
      if (message.includes("404")) {
        await Swal.fire({
          icon: "error",
          title: "Student not found",
          text: "Please verify Name and GR Number",
        });
        return;
      }
      await Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: "Unable to fetch student details",
      });
    }
  };

  const handleDownload = async () => {
    if (!result?.student?.id || downloading) return;
    try {
      setDownloading(true);
      const blob = await apiService.downloadBonafideByStudentId(result.student.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bonafide_${result.student.admission_number || result.student.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      await Swal.fire({
        icon: "error",
        title: "Something went wrong",
        text: "Unable to download certificate",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content bonafide-page">
        <div className="row justify-content-center no-print">
          <div className="col-xl-8 col-lg-10">
            <div className="card bonafide-form-card">
              <div className="card-body p-4 p-md-5">
                <h4 className="mb-1">Bonafide Certificate</h4>
                <p className="text-muted mb-4">Search student by Name and GR Number to preview, print, or download.</p>
                <form onSubmit={handleSearch}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Student Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter student name"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">GR Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={grNumber}
                        onChange={(e) => setGrNumber(e.target.value)}
                        placeholder="Enter GR number"
                      />
                    </div>
                    <div className="col-12 d-flex justify-content-end">
                      <button type="submit" className="btn btn-primary px-4">
                        Generate
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <>
            <div className="row justify-content-center mt-1 no-print">
              <div className="col-xl-8 col-lg-10 bonafide-action-row mb-3">
                <button type="button" className="btn btn-outline-primary" onClick={() => window.print()}>
                  <i className="ti ti-printer me-2" />
                  Print
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
                  <i className="ti ti-download me-2" />
                  {downloading ? "Downloading..." : "Download PDF"}
                </button>
              </div>
            </div>

            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-10">
                <BonafideCertificateLayout
                  schoolName={schoolName}
                  schoolLogoSrc={schoolLogoSrc}
                  studentName={studentFullName}
                  parentName={parentName}
                  className={result.class?.class_name || "-"}
                  sectionName={result.section?.section_name || ""}
                  academicYear={result.academic_year?.year_name || "Current Academic Year"}
                  rollNumber={result.student.admission_number || "-"}
                  issueDate={issueDate}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BonafideGenerator;
