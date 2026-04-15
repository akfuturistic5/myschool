import SchoolLogoImage from "../../../../core/common/schoolLogoImage";

type BonafideCertificateLayoutProps = {
  schoolName: string;
  schoolSubtitle?: string;
  schoolLogoSrc: string;
  studentName: string;
  parentName: string;
  className: string;
  sectionName?: string;
  academicYear: string;
  grNumber: string;
  admissionNumber: string;
  dob: string;
  issueDate: string;
};

const BonafideCertificateLayout = ({
  schoolName,
  schoolSubtitle,
  schoolLogoSrc,
  studentName,
  parentName,
  className,
  sectionName,
  academicYear,
  grNumber,
  admissionNumber,
  dob,
  issueDate,
}: BonafideCertificateLayoutProps) => {
  const classLine = sectionName ? `${className} - ${sectionName}` : className;

  return (
    <div id="bonafide-print-area" className="bonafide-print-area">
      <article className="bonafide-certificate-sheet">
        <header className="bonafide-header">
          <div className="bonafide-logo-wrap">
            <SchoolLogoImage
              src={schoolLogoSrc}
              className="bonafide-logo"
              alt="School Logo"
            />
          </div>
          <h1 className="bonafide-school-name">{schoolName.toUpperCase()}</h1>
          <p className="bonafide-school-subtitle">{schoolSubtitle || "\u00A0"}</p>
        </header>

        <section className="bonafide-title-wrap">
          <h2 className="bonafide-title">BONAFIDE CERTIFICATE</h2>
        </section>

        <section className="bonafide-body-wrap">
          <p className="bonafide-body">
            This is to certify that <strong>{studentName}</strong>, S/O{" "}
            <strong>{parentName}</strong>, bearing GR Number <strong>{grNumber}</strong>,
            Admission Number <strong>{admissionNumber}</strong>, and Date of Birth{" "}
            <strong>{dob}</strong>, is a student of <strong>class {classLine}</strong> for the
            academic year <strong>{academicYear}</strong>. He is a bona fide student of{" "}
            <strong>{schoolName}</strong>.
          </p>
        </section>

        <div className="bonafide-bottom-section">
          <footer className="bonafide-footer">
            <div className="bonafide-sign-block">
              <div className="bonafide-sign-line" />
              <p>Signature, Principal</p>
            </div>
            <div className="bonafide-sign-block bonafide-date-block">
              <div className="bonafide-sign-line" />
              <p>Date: {issueDate}</p>
            </div>
          </footer>

          <section className="bonafide-seal-wrap" aria-label="School seal area">
            <div className="bonafide-seal-space" />
            <p className="bonafide-seal-label">School Seal</p>
          </section>
        </div>
      </article>
    </div>
  );
};

export default BonafideCertificateLayout;
