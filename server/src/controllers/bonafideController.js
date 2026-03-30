const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const { query, masterQuery, getCurrentTenantDbName } = require('../config/database');
const { error: errorResponse } = require('../utils/responseHelper');
const { canAccessStudent } = require('../utils/accessControl');
const { getSchoolProfile } = require('../services/schoolProfileService');

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB');
}

function parseRole(req) {
  const roleName = (req.user?.role_name || '').toString().trim().toLowerCase();
  const roleId = Number(req.user?.role_id || 0);
  return { roleName, roleId };
}

function isAllowedBonafideRole(req) {
  const { roleName, roleId } = parseRole(req);
  if (roleName === 'admin' || roleId === 1) return true;
  if (roleName === 'student' || roleId === 2) return true;
  if (roleName === 'parent' || roleId === 4) return true;
  if (roleName === 'guardian' || roleId === 5) return true;
  return false;
}

function resolveLogoPathOrUrl(logoUrl) {
  let value = String(logoUrl || '').trim();
  if (!value) return null;

  // If an absolute URL is stored (https://.../api/school/profile/logo/...),
  // use only the pathname so PDF resolves from local filesystem.
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname || value;
    } catch {
      // Keep raw value if URL parsing fails.
    }
  }

  if (value.startsWith('/api/school/profile/logo/')) {
    const parts = value.split('/').filter(Boolean);
    const tenant = (parts[4] || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const file = (parts[5] || '').replace(/[^a-zA-Z0-9._-]/g, '');
    if (!tenant || !file) return null;
    return path.join(process.cwd(), 'uploads', 'school-logos', tenant, file);
  }
  if (value.startsWith('/uploads/school-logos/')) {
    return path.join(process.cwd(), value.replace(/^\/+/, ''));
  }
  if (value.startsWith('/assets/') || value.startsWith('assets/')) {
    const rel = value.replace(/^\/+/, '');
    const serverCwdPath = path.join(process.cwd(), '../client/public', rel);
    if (fs.existsSync(serverCwdPath)) return serverCwdPath;
    const repoRootPath = path.join(process.cwd(), 'client/public', rel);
    if (fs.existsSync(repoRootPath)) return repoRootPath;
    return null;
  }
  return null;
}

async function getLogoBuffer(logoUrl) {
  const source = resolveLogoPathOrUrl(logoUrl);
  if (!source) return null;
  if (!fs.existsSync(source)) return null;
  const ext = path.extname(source).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    return fs.readFileSync(source);
  }
  try {
    // PDFKit is most reliable with PNG/JPEG; normalize others (svg/webp/bmp/gif) to PNG buffer.
    return await sharp(source).png().toBuffer();
  } catch {
    return null;
  }
  return null;
}

function safeText(value, fallback = '-') {
  const v = String(value == null ? '' : value).trim();
  return v || fallback;
}

function drawCertificateLayout(doc, data) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 52;
  const centerX = pageWidth / 2;
  const textColor = '#111827';
  const lineColor = '#4b5563';
  const rollNumber = safeText(data.rollNumber, data.admissionNumber);

  doc.save().fillColor('#ffffff').rect(0, 0, pageWidth, pageHeight).fill().restore();

  const logoTop = margin;
  const title = 'BONAFIDE CERTIFICATE';
  let cursorY = logoTop;

  // Header with centered logo and school identity
  if (data.logoBuffer) {
    try {
      const logoSize = 56;
      doc.image(data.logoBuffer, centerX - logoSize / 2, cursorY, {
        fit: [logoSize, logoSize],
        align: 'center',
        valign: 'center',
      });
    } catch {
      // Continue without logo if image decode fails.
    }
  }
  cursorY += 66;

  doc.fillColor(textColor).font('Helvetica-Bold').fontSize(19);
  const schoolNameText = safeText(data.schoolName, 'School').toUpperCase();
  doc.text(schoolNameText, margin, cursorY, { width: pageWidth - margin * 2, align: 'center' });
  cursorY = doc.y + 4;

  // Keep fixed subtitle line-height to avoid layout shifts between documents.
  const subtitle = safeText(data.schoolSubtitle, '');
  doc.fillColor('#4b5563').font('Helvetica').fontSize(12);
  doc.text(subtitle || ' ', margin, cursorY, { width: pageWidth - margin * 2, align: 'center' });
  cursorY = doc.y + 20; // Header -> Title exact spacing

  // Title and underline
  doc.fillColor(textColor).font('Helvetica-Bold').fontSize(23);
  const titleWidth = doc.widthOfString(title);
  const titleX = centerX - titleWidth / 2;
  doc.text(title, titleX, cursorY, { lineBreak: false });
  const underlineY = cursorY + 28;
  doc
    .save()
    .lineWidth(1)
    .strokeColor('#374151')
    .moveTo(titleX, underlineY)
    .lineTo(titleX + titleWidth, underlineY)
    .stroke()
    .restore();

  // Body paragraph
  const bodyWidth = 400;
  const bodyX = centerX - bodyWidth / 2;
  const bodyY = underlineY + 20; // Title -> Body exact spacing
  const commonTextOptions = { width: bodyWidth, align: 'left', lineGap: 5, continued: true };
  doc.fillColor(textColor).font('Helvetica').fontSize(13.5);
  doc.text('This is to certify that ', bodyX, bodyY, commonTextOptions);
  doc.font('Helvetica-Bold').text(`${data.studentName}, `, commonTextOptions);
  doc.font('Helvetica').text('S/O ', commonTextOptions);
  doc.font('Helvetica-Bold').text(`${data.parentName} `, commonTextOptions);
  doc.font('Helvetica').text(`bearing roll number ${rollNumber}, is a student of `, commonTextOptions);
  const classLine = data.sectionName ? `${data.className} - ${data.sectionName}` : data.className;
  doc.font('Helvetica-Bold').text(`class ${classLine} `, commonTextOptions);
  doc.font('Helvetica').text('for the academic year ', commonTextOptions);
  doc.font('Helvetica-Bold').text(`${data.academicYear}. `, commonTextOptions);
  doc.font('Helvetica').text('He is a bona fide student of ', commonTextOptions);
  doc.font('Helvetica-Bold').text(`${data.schoolName}.`, { width: bodyWidth, align: 'left', lineGap: 5 });

  // Footer spacing tuned to align with UI preview rhythm.
  const bodyEndY = doc.y;
  const footerLineY = Math.max(bodyEndY + 40, pageHeight - 198); // Body -> Footer exact spacing
  const leftLineX = margin + 8;
  const lineWidth = 160;
  const rightLineX = pageWidth - margin - 8 - lineWidth;

  doc
    .save()
    .lineWidth(1)
    .strokeColor(lineColor)
    .moveTo(leftLineX, footerLineY)
    .lineTo(leftLineX + lineWidth, footerLineY)
    .moveTo(rightLineX, footerLineY)
    .lineTo(rightLineX + lineWidth, footerLineY)
    .stroke()
    .restore();

  doc.fillColor(textColor).font('Helvetica').fontSize(12);
  doc.text('Signature, Principal', leftLineX, footerLineY + 6, { width: lineWidth, align: 'left' });
  doc.text(`Date: ${safeText(data.issueDate)}`, rightLineX, footerLineY + 6, { width: lineWidth, align: 'right' });

  // Center-bottom blank area reserved for physical school seal.
  const sealBoxW = 100;
  const sealBoxH = 60;
  const sealBoxX = centerX - sealBoxW / 2;
  const sealBoxY = footerLineY + 30; // Signature -> Seal exact spacing
  doc
    .save()
    .lineWidth(1)
    .strokeColor('#000000')
    .rect(sealBoxX, sealBoxY, sealBoxW, sealBoxH)
    .stroke()
    .restore();

  doc
    .fillColor(textColor)
    .font('Helvetica')
    .fontSize(10)
    .text('School Seal', sealBoxX, sealBoxY + sealBoxH + 5, {
      width: sealBoxW,
      align: 'center',
    });
}

const downloadBonafide = async (req, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return errorResponse(res, 400, 'Invalid student ID');
    }

    if (!isAllowedBonafideRole(req)) {
      return errorResponse(res, 403, 'Access denied. Insufficient permissions.');
    }

    const access = await canAccessStudent(req, studentId);
    if (!access.ok) {
      return errorResponse(res, access.status || 403, access.message || 'Access denied');
    }

    const studentRes = await query(
      `SELECT
         s.id,
         s.first_name,
         s.last_name,
         s.admission_number,
         s.date_of_birth,
         c.class_name,
         sec.section_name,
         ay.year_name AS academic_year_name,
         p.father_name,
         p.mother_name,
         g.first_name AS guardian_first_name,
         g.last_name AS guardian_last_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
       LEFT JOIN parents p ON s.parent_id = p.id
       LEFT JOIN guardians g ON s.guardian_id = g.id
       WHERE s.id = $1 AND s.is_active = true
       LIMIT 1`,
      [studentId]
    );

    if (!studentRes.rows || studentRes.rows.length === 0) {
      return errorResponse(res, 404, 'Student not found');
    }

    const student = studentRes.rows[0];
    const studentName = safeText(`${student.first_name || ''} ${student.last_name || ''}`.trim());
    const parentName = safeText(
      student.father_name ||
        student.mother_name ||
        `${student.guardian_first_name || ''} ${student.guardian_last_name || ''}`.trim()
    );

    const profile = await getSchoolProfile(req.user?.school_name || null);
    const tenantDbName = getCurrentTenantDbName();
    let fullSchoolNameFromMaster = null;
    let logoUrlFromMaster = null;
    try {
      const masterSchool = await masterQuery(
        `SELECT school_name, type, logo
         FROM schools
         WHERE db_name = $1
         ORDER BY id ASC
         LIMIT 1`,
        [tenantDbName]
      );
      const schoolNamePart = safeText(masterSchool?.rows?.[0]?.school_name, '');
      const schoolTypePart = safeText(masterSchool?.rows?.[0]?.type, '');
      const combined = `${schoolNamePart} ${schoolTypePart}`.trim();
      fullSchoolNameFromMaster = combined || null;
      logoUrlFromMaster = safeText(masterSchool?.rows?.[0]?.logo, '');
    } catch {
      fullSchoolNameFromMaster = null;
      logoUrlFromMaster = null;
    }
    const schoolName = safeText(fullSchoolNameFromMaster || profile?.school_name, safeText(req.user?.school_name, 'School'));

    let logoBuffer = null;
    try {
      // Keep tenant-safe local file resolution but add robust logo fallback sources.
      const logoUrlCandidate = safeText(
        req.user?.school_logo || profile?.logo_url || logoUrlFromMaster || '/assets/img/logo-small.svg',
        '/assets/img/logo-small.svg'
      );
      logoBuffer = await getLogoBuffer(logoUrlCandidate);
    } catch {
      logoBuffer = null;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', (err) => {
      console.error('Bonafide PDF stream error:', err);
    });
    doc.on('end', () => {
      const pdf = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="bonafide_${String(student.admission_number).replace(/[^a-zA-Z0-9_-]/g, '') || student.id}.pdf"`
      );
      return res.status(200).send(pdf);
    });

    drawCertificateLayout(doc, {
      logoBuffer,
      schoolName,
      schoolSubtitle: '',
      studentName,
      parentName,
      className: safeText(student.class_name),
      sectionName: safeText(student.section_name),
      academicYear: safeText(student.academic_year_name, 'Current Academic Year'),
      admissionNumber: safeText(student.admission_number),
      dob: formatDate(student.date_of_birth),
      issueDate: formatDate(new Date()),
    });

    doc.end();
  } catch (err) {
    console.error('Bonafide generation error:', err);
    return errorResponse(res, 500, 'Failed to generate bonafide certificate');
  }
};

const fetchStudentForBonafide = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const grNumber = String(req.body?.gr_number || '').trim();

    if (!name || !grNumber) {
      return errorResponse(res, 400, 'Name and GR number are required');
    }

    const studentRes = await query(
      `SELECT
         s.id,
         s.first_name,
         s.last_name,
         s.gr_number,
         s.admission_number,
         s.date_of_birth,
         c.id AS class_id,
         c.class_name,
         sec.id AS section_id,
         sec.section_name,
         ay.id AS academic_year_id,
         ay.year_name AS academic_year_name,
         p.id AS parent_id,
         p.father_name,
         p.mother_name
       FROM students s
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN sections sec ON s.section_id = sec.id
       LEFT JOIN academic_years ay ON s.academic_year_id = ay.id
       LEFT JOIN parents p ON s.parent_id = p.id
       WHERE s.is_active = true
         AND LOWER(TRIM(COALESCE(s.gr_number, ''))) = LOWER(TRIM($2))
         AND (
           LOWER(TRIM(CONCAT_WS(' ', COALESCE(s.first_name, ''), COALESCE(s.last_name, '')))) = LOWER(TRIM($1))
           OR LOWER(TRIM(COALESCE(s.first_name, ''))) = LOWER(TRIM($1))
         )
       ORDER BY s.id DESC
       LIMIT 1`,
      [name, grNumber]
    );

    if (!studentRes.rows || studentRes.rows.length === 0) {
      return errorResponse(res, 404, 'Student not found');
    }

    const row = studentRes.rows[0];
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'Student fetched successfully',
      data: {
        student: {
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          gr_number: row.gr_number,
          admission_number: row.admission_number,
          date_of_birth: row.date_of_birth,
        },
        class: {
          id: row.class_id,
          class_name: row.class_name,
        },
        section: {
          id: row.section_id,
          section_name: row.section_name,
        },
        academic_year: {
          id: row.academic_year_id,
          year_name: row.academic_year_name,
        },
        parent: {
          id: row.parent_id,
          father_name: row.father_name,
          mother_name: row.mother_name,
        },
      },
    });
  } catch (err) {
    console.error('Bonafide fetch student error:', err);
    return errorResponse(res, 500, 'Failed to fetch student details');
  }
};

module.exports = {
  downloadBonafide,
  fetchStudentForBonafide,
};

