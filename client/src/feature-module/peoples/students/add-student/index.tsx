import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
// import { feeGroup, feesTypes, paymentType } from '../../../core/common/selectoption/selectoption'
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { all_routes } from "../../../router/all_routes";
import {
  allClass,
  gender,
  status,
} from "../../../../core/common/selectoption/selectoption";

import CommonSelect from "../../../../core/common/commonSelect";
import { useLocation } from "react-router-dom";
import TagInput from "../../../../core/common/Taginput";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSections } from "../../../../core/hooks/useSections";
import { useBloodGroups } from "../../../../core/hooks/useBloodGroups";
import { useReligions } from "../../../../core/hooks/useReligions";
import { useCasts } from "../../../../core/hooks/useCasts";
import { useMotherTongues } from "../../../../core/hooks/useMotherTongues";
import { useHouses } from "../../../../core/hooks/useHouses";
import { useHostels } from "../../../../core/hooks/useHostels";
import { useHostelRooms } from "../../../../core/hooks/useHostelRooms";
import { apiService } from "../../../../core/services/apiService";
import Swal from "sweetalert2";
import { useTransportRoutes } from "../../../../core/hooks/useTransportRoutes";
import { useTransportPickupPoints } from "../../../../core/hooks/useTransportPickupPoints";
import { useTransportVehicles } from "../../../../core/hooks/useTransportVehicles";
import {
  focusAddStudentField,
  formControlInvalidClass,
  getFirstInvalidFieldKey,
} from "./addStudentFormValidation";
import { FormLabelWithInfo } from "../../../../core/common/FormLabelWithInfo";
import { FieldError, RequiredLabel } from "./AddStudentFormUi";
import { STUDENT_FIELD_HELP_TEXT } from "./studentFieldHelpText";
import { useAddStudentFieldErrors } from "./useAddStudentFieldErrors";
import { ParentPersonPicker, type ParentPersonRow } from "./ParentPersonPicker";
import { useAdmissionNumberUniqueness } from "./useAdmissionNumberUniqueness";
import { ADMISSION_NUMBER_DUPLICATE_MSG } from "../../../../core/validation/uniqueFieldChecks";

const STUDENT_DOC_MAX_BYTES = 4 * 1024 * 1024;

function fileNameFromStoragePath(relativePath: string | null | undefined): string {
  if (!relativePath) return "";
  const parts = String(relativePath).replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

/** Path under API host for GET /api/storage/files/... */
function apiPathFromStudentDocRelativePath(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 3) return "";
  const [schoolKey, folder, ...rest] = parts;
  const fileName = rest.join("/");
  return `/api/storage/files/${encodeURIComponent(schoolKey)}/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`;
}

type DocUploadUiStatus = "idle" | "uploading" | "success" | "error";

// Lookup item types (hooks are JS and return untyped arrays)
interface AcademicYearItem {
  id: number;
  year_name?: string;
  is_current?: boolean;
}
interface ClassItem {
  id: number;
  class_name?: string;
}
interface SectionItem {
  id: number;
  section_name?: string;
}
interface BloodGroupItem {
  id: number;
  blood_group?: string;
}
interface HouseItem {
  id: number;
  house_name?: string;
}
interface ReligionItem {
  id: number;
  religion_name?: string;
}
interface CastItem {
  id: number;
  cast_name?: string;
}
interface MotherTongueItem {
  id: number;
  language_name?: string;
}

const AddStudent = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any>(null);
  const [loadingStudent, setLoadingStudent] = useState<boolean>(false);
  const fetchedStudentIdRef = useRef<string | null>(null); // Track which student ID we've fetched

  // Form state for Personal Information section
  const [formData, setFormData] = useState<{
    academic_year_id: string | null;
    unique_student_ids: string;
    pen_number: string;
    aadhaar_no: string;
    admission_number: string;
    gr_number: string;
    admission_date: dayjs.Dayjs | null;
    roll_number: string;
    status: string;
    first_name: string;
    last_name: string;
    class_id: string | null;
    section_id: string | null;
    gender: string;
    date_of_birth: dayjs.Dayjs | null;
    blood_group_id: string | null;
    house_id: string | null;
    religion_id: string | null;
    cast_id: string | null;
    phone: string;
    email: string;
    mother_tongue_id: string | null;
    current_address: string;
    permanent_address: string;
    father_name: string;
    father_email: string;
    father_phone: string;
    father_occupation: string;
    father_image_url: string;
    father_person_id: number | null;
    father_matched_from_legacy: boolean;
    mother_name: string;
    mother_email: string;
    mother_phone: string;
    mother_occupation: string;
    mother_image_url: string;
    mother_person_id: number | null;
    mother_matched_from_legacy: boolean;
    // Guardian
    guardian_first_name: string;
    guardian_last_name: string;
    guardian_relation: string;
    guardian_phone: string;
    guardian_email: string;
    guardian_occupation: string;
    guardian_address: string;
    guardian_person_id: number | null;
    guardian_matched_from_legacy: boolean;
    guardian_image_url: string;
    // Siblings
    siblings: {
      is_in_same_school: boolean;
      name: string;
      class_name: string;
      roll_number: string;
      admission_number: string;
    }[];
    // Transport
    is_transport_required: boolean;
    route_id: string | null;
    pickup_point_id: string | null;
    route_name: string;
    pickup_point_name: string;
    vehicle_number: string;
    // Hostel
    is_hostel_required: boolean;
    hostel_id: string | null;
    hostel_room_id: string | null;
    hostel_name: string;
    hostel_room_number: string;
    // Medical
    medical_condition: string;
    // Previous school
    previous_school: string;
    previous_school_address: string;
    // Other / Bank
    bank_name: string;
    branch: string;
    ifsc: string;
    other_information: string;
    medical_document_path: string | null;
    transfer_certificate_path: string | null;
    photo_url: string | null;
  }>({
    academic_year_id: null,
    unique_student_ids: '',
    pen_number: '',
    aadhaar_no: '',
    admission_number: '',
    gr_number: '',
    admission_date: dayjs().startOf("day"),
    roll_number: '',
    status: 'Active',
    first_name: '',
    last_name: '',
    class_id: null,
    section_id: null,
    gender: '',
    date_of_birth: null,
    blood_group_id: null,
    house_id: null,
    religion_id: null,
    cast_id: null,
    phone: '',
    email: '',
    mother_tongue_id: null,
    current_address: '',
    permanent_address: '',
    father_name: '',
    father_email: '',
    father_phone: '',
    father_occupation: '',
    father_image_url: '',
    father_person_id: null,
    father_matched_from_legacy: false,
    mother_name: '',
    mother_email: '',
    mother_phone: '',
    mother_occupation: '',
    mother_image_url: '',
    mother_person_id: null,
    mother_matched_from_legacy: false,
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relation: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_occupation: '',
    guardian_address: '',
    guardian_person_id: null,
    guardian_matched_from_legacy: false,
    guardian_image_url: '',
    siblings: [
      { is_in_same_school: true, name: '', class_name: '', roll_number: '', admission_number: '' }
    ],
    is_transport_required: false,
    route_id: null,
    pickup_point_id: null,
    route_name: '',
    pickup_point_name: '',
    vehicle_number: '',
    is_hostel_required: false,
    hostel_id: null,
    hostel_room_id: null,
    hostel_name: '',
    hostel_room_number: '',
    medical_condition: 'Good',
    previous_school: '',
    previous_school_address: '',
    bank_name: '',
    branch: '',
    ifsc: '',
    other_information: '',
    medical_document_path: null,
    transfer_certificate_path: null,
    photo_url: null,
  });

  const [baselineAdmission, setBaselineAdmission] = useState('');

  const [medicalDocUploadStatus, setMedicalDocUploadStatus] = useState<DocUploadUiStatus>("idle");
  const [tcDocUploadStatus, setTcDocUploadStatus] = useState<DocUploadUiStatus>("idle");
  const medicalDocInputRef = useRef<HTMLInputElement>(null);
  const tcDocInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fatherPhotoInputRef = useRef<HTMLInputElement>(null);
  const motherPhotoInputRef = useRef<HTMLInputElement>(null);
  const guardianPhotoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<DocUploadUiStatus>("idle");
  const [fatherPhotoUploadStatus, setFatherPhotoUploadStatus] = useState<DocUploadUiStatus>("idle");
  const [motherPhotoUploadStatus, setMotherPhotoUploadStatus] = useState<DocUploadUiStatus>("idle");
  const [guardianPhotoUploadStatus, setGuardianPhotoUploadStatus] = useState<DocUploadUiStatus>("idle");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [fatherPhotoPreview, setFatherPhotoPreview] = useState<string | null>(null);
  const [motherPhotoPreview, setMotherPhotoPreview] = useState<string | null>(null);
  const [guardianPhotoPreview, setGuardianPhotoPreview] = useState<string | null>(null);

  const {
    fieldErrors,
    setFieldErrors,
    clearFieldErrorSmart,
    validateOnBlur,
    validateAllForSubmit,
  } = useAddStudentFieldErrors(formData, { isEdit });

  const admissionUniqueness = useAdmissionNumberUniqueness({
    admissionNumber: formData.admission_number,
    excludeStudentId: isEdit && id ? id : null,
    baselineAdmission,
  });

  // Fetch academic years from API
  const { academicYears, loading: academicYearsLoading, error: academicYearsError } = useAcademicYears();

  // Fetch classes from API
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading, error: classesError } = useClasses(academicYearId);

  // Fetch sections from API
  const selectedClassId =
    formData.class_id && String(formData.class_id).trim() !== ""
      ? Number(formData.class_id)
      : null;
  const { sections, loading: sectionsLoading, error: sectionsError } = useSections(
    selectedClassId,
    { academicYearId, fetchAllWhenNoClass: false }
  );

  // Fetch ALL sections for siblings dropdown (filtered by selected class in each row)
  const { sections: allSectionsRaw, loading: allSectionsLoading } = useSections(
    null,
    { academicYearId, fetchAllWhenNoClass: true }
  );
  const allSectionsList = (allSectionsRaw || []) as any[];

  // Fetch blood groups from API
  const { bloodGroups, loading: bloodGroupsLoading, error: bloodGroupsError } = useBloodGroups();

  // Fetch religions from API
  const { religions, loading: religionsLoading, error: religionsError } = useReligions();

  // Fetch casts from API
  const { casts, loading: castsLoading, error: castsError } = useCasts();

  // Fetch mother tongues from API
  const { motherTongues, loading: motherTonguesLoading, error: motherTonguesError } = useMotherTongues();

  // Fetch houses from API
  const { houses, loading: housesLoading, error: housesError } = useHouses();

  // Fetch hostels and hostel rooms from API (for dropdowns with real IDs)
  const { hostels, loading: hostelsLoading, error: hostelsError } = useHostels();
  const { hostelRooms, loading: hostelRoomsLoading, error: hostelRoomsError } = useHostelRooms();
  const { data: transportRoutes, loading: routesLoading, error: routesError } = useTransportRoutes({ academic_year_id: academicYearId });
  const { data: pickupPoints, loading: pickupLoading, error: pickupError } = useTransportPickupPoints({ academic_year_id: academicYearId });
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError, setParams: setVehicleParams } = useTransportVehicles({ academic_year_id: academicYearId });
  const hostelOptions = (hostels || []).map((h: { originalData?: { id: number }; hostelName?: string }) => ({
    value: String((h.originalData as { id?: number })?.id ?? ""),
    label: (h.hostelName as string) || "N/A",
  })).filter((o: { value: string }) => o.value);
  const roomOptions = (hostelRooms || []).map((r: { originalData?: { id: number }; roomNo?: string }) => ({
    value: String((r.originalData as { id?: number })?.id ?? ""),
    label: (r.roomNo as string) || "N/A",
  })).filter((o: { value: string }) => o.value);

  // Typed lists (hooks are JS and return untyped arrays - avoid 'never' inference)
  const academicYearsList = (academicYears || []) as AcademicYearItem[];
  const classesList = (classes || []) as ClassItem[];
  const sectionsList = (sections || []) as SectionItem[];
  const bloodGroupsList = (bloodGroups || []) as BloodGroupItem[];
  const housesList = (houses || []) as HouseItem[];
  const religionsList = (religions || []) as ReligionItem[];
  const castsList = (casts || []) as CastItem[];
  const motherTonguesList = (motherTongues || []) as MotherTongueItem[];

  const routeOptions = (transportRoutes || []).map((r: any) => ({
    value: String((r.originalData?.id ?? r.id) ?? ""),
    label: r.routes ?? r.originalData?.route_name ?? "N/A",
    original: r,
  })).filter((o: { value: string }) => o.value);

  const pickupPointOptions = (pickupPoints || []).map((p: any) => ({
    value: String((p.originalData?.id ?? p.id) ?? ""),
    label: p.pickupPoint ?? p.originalData?.address ?? "N/A",
    original: p,
  })).filter((o: { value: string }) => o.value);

  const vehicleOptions = (vehicles || []).map((v: any) => {
    const vehicleNo = v.vehicleNo ?? v.originalData?.vehicle_number ?? "";
    return {
      value: vehicleNo || "",
      label: vehicleNo || "N/A",
      original: v,
    };
  }).filter((o: { value: string }) => o.value);

  // Parse comma-separated or single string into array of non-empty trimmed strings
  const parseTagList = (val: unknown): string[] => {
    if (val == null || val === '') return [];
    if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
    const s = String(val).trim();
    if (!s) return [];
    return s.split(',').map(part => part.trim()).filter(Boolean);
  };

  // Function to fetch student data for editing
  const fetchStudentData = async (studentId: string) => {
    // Prevent multiple simultaneous calls or re-fetching the same student
    if (loadingStudent) return;
    if (fetchedStudentIdRef.current === studentId && studentData) return;
    try {
      setLoadingStudent(true);
      fetchedStudentIdRef.current = studentId; // Mark as fetching
      const response = await apiService.getStudentById(studentId);
      const student = response?.data ?? response;
      const raw = (typeof student === 'object' && student !== null ? student?.student ?? student : {}) as Record<string, unknown>;
      setStudentData(raw);
      setBaselineAdmission(String(raw.admission_number ?? ''));
      setFormData({
        academic_year_id: raw.academic_year_id ? raw.academic_year_id.toString() : null,
        unique_student_ids: String(raw.unique_student_ids ?? raw.uniqueStudentIds ?? ''),
        pen_number: String(raw.pen_number ?? raw.penNumber ?? ''),
        aadhaar_no: String(raw.aadhaar_no ?? raw.aadhar_no ?? raw.aadhaarNo ?? ''),
        admission_number: raw.admission_number || '',
        gr_number: String(raw.gr_number ?? raw.grNumber ?? ''),
        admission_date: raw.admission_date ? dayjs(raw.admission_date) : null,
        roll_number: raw.roll_number || '',
        status: raw.is_active ? 'Active' : 'Inactive',
        first_name: raw.first_name || '',
        last_name: raw.last_name || '',
        class_id: raw.class_id ? raw.class_id.toString() : null,
        section_id: raw.section_id ? raw.section_id.toString() : null,
        gender: raw.gender || '',
        date_of_birth: raw.date_of_birth ? dayjs(raw.date_of_birth) : null,
        blood_group_id: raw.blood_group_id ? raw.blood_group_id.toString() : null,
        house_id: raw.house_id ? raw.house_id.toString() : null,
        religion_id: raw.religion_id ? raw.religion_id.toString() : null,
        cast_id: raw.cast_id ? raw.cast_id.toString() : null,
        phone: raw.phone || '',
        email: raw.email || '',
        mother_tongue_id: raw.mother_tongue_id ? raw.mother_tongue_id.toString() : null,
        current_address: (raw.current_address === 'Not Provided') ? '' : (raw.current_address || raw.address || ''),
        permanent_address: (raw.permanent_address === 'Not Provided') ? '' : (raw.permanent_address || ''),
        father_name: raw.father_name || '',
        father_email: raw.father_email || '',
        father_phone: raw.father_phone || '',
        father_occupation: raw.father_occupation || '',
        father_image_url: raw.father_image_url || '',
        father_person_id:
          raw.father_person_id != null ? Number(raw.father_person_id) : null,
        father_matched_from_legacy: false,
        mother_name: raw.mother_name || '',
        mother_email: raw.mother_email || '',
        mother_phone: raw.mother_phone || '',
        mother_occupation: raw.mother_occupation || '',
        mother_image_url: raw.mother_image_url || '',
        mother_person_id:
          raw.mother_person_id != null ? Number(raw.mother_person_id) : null,
        mother_matched_from_legacy: false,
        guardian_first_name: raw.guardian_first_name || '',
        guardian_last_name: raw.guardian_last_name || '',
        guardian_relation: raw.guardian_relation || '',
        guardian_phone: raw.guardian_phone || '',
        guardian_email: raw.guardian_email || '',
        guardian_occupation: raw.guardian_occupation || '',
        guardian_address: (raw.guardian_address === 'Not Provided') ? '' : (raw.guardian_address || ''),
        guardian_person_id:
          raw.guardian_person_id != null ? Number(raw.guardian_person_id) : null,
        guardian_matched_from_legacy: false,
        guardian_image_url: raw.guardian_image_url || '',
        siblings: Array.isArray(raw.siblings) && raw.siblings.length > 0 
          ? raw.siblings.map((s: any) => ({
              is_in_same_school: !!s.is_in_same_school,
              name: s.name || '',
              class_name: s.class_name || '',
              section_name: s.section_name || '',
              roll_number: s.roll_number || '',
              admission_number: s.admission_number || '',
            }))
          : [{ is_in_same_school: true, name: '', class_name: '', section_name: '', roll_number: '', admission_number: '' }],
        is_transport_required: !!raw.is_transport_required,
        route_id: raw.route_id != null ? raw.route_id.toString() : null,
        pickup_point_id: raw.pickup_point_id != null ? raw.pickup_point_id.toString() : null,
        route_name: raw.route_name || '',
        pickup_point_name: raw.pickup_point_name || '',
        vehicle_number: raw.vehicle_number || '',
        is_hostel_required: !!raw.is_hostel_required,
        hostel_id: raw.hostel_id != null ? raw.hostel_id.toString() : null,
        hostel_room_id: raw.hostel_room_id != null ? raw.hostel_room_id.toString() : null,
        hostel_name: raw.hostel_name || '',
        hostel_room_number: raw.hostel_room_number != null ? String(raw.hostel_room_number) : '',
        medical_condition: raw.medical_condition || 'Good',
        previous_school: raw.previous_school || '',
        previous_school_address: raw.previous_school_address || '',
        bank_name: raw.bank_name || raw.bankName || '',
        branch: raw.branch || raw.branchName || '',
        ifsc: raw.ifsc || raw.ifscCode || '',
        other_information: raw.other_information || '',
        medical_document_path: (() => {
          const v = raw.medical_document_path ?? raw.medicalDocumentPath;
          if (v == null || String(v).trim() === "") return null;
          return String(v).trim();
        })(),
        transfer_certificate_path: (() => {
          const v = raw.transfer_certificate_path ?? raw.transferCertificatePath;
          if (v == null || String(v).trim() === "") return null;
          return String(v).trim();
        })(),
        photo_url: (() => {
          const v = raw.photo_url ?? raw.photoUrl;
          if (v == null || String(v).trim() === "") return null;
          return String(v).trim();
        })(),
      });
      setMedicalDocUploadStatus(
        raw.medical_document_path || raw.medicalDocumentPath ? "success" : "idle"
      );
      setTcDocUploadStatus(
        raw.transfer_certificate_path || raw.transferCertificatePath ? "success" : "idle"
      );
      setOwner1(parseTagList(raw.known_allergies ?? raw.knownAllergies));
      setOwner2(parseTagList(raw.medications ?? raw.medicationsList));
    } catch (error: any) {
      console.error('Error fetching student data:', error);
      setSubmitError(error.message || 'Failed to fetch student data');
      fetchedStudentIdRef.current = null; // Reset on error so we can retry
    } finally {
      setLoadingStudent(false);
    }
  };

  // Effect to handle form data population when dropdown options are loaded
  // Use ref to track if we've already populated form data to prevent unnecessary updates
  const formDataPopulatedRef = useRef(false);
  useEffect(() => {
    if (studentData && isEdit && !formDataPopulatedRef.current) {
      // Only populate if dropdowns are loaded (non-empty arrays)
      const dropdownsReady = bloodGroups.length > 0 && religions.length > 0 &&
        casts.length > 0 && motherTongues.length > 0 && houses.length > 0;

      if (dropdownsReady) {
        const student = studentData;
        setFormData(prev => ({
          ...prev,
          blood_group_id: student.blood_group_id ? student.blood_group_id.toString() : null,
          house_id: student.house_id ? student.house_id.toString() : null,
          religion_id: student.religion_id ? student.religion_id.toString() : null,
          cast_id: student.cast_id ? student.cast_id.toString() : null,
          mother_tongue_id: student.mother_tongue_id ? student.mother_tongue_id.toString() : null,
          current_address: student.current_address || student.address || '',
          permanent_address: student.permanent_address || '',
        }));
        formDataPopulatedRef.current = true;
      }
    }
    // Reset ref when studentData changes (new student being edited)
    if (!studentData) {
      formDataPopulatedRef.current = false;
    }
  }, [studentData, bloodGroups.length, religions.length, casts.length, motherTongues.length, houses.length, isEdit]);
  
  // Refetch vehicles when route changes
  useEffect(() => {
    if (setVehicleParams) {
      setVehicleParams({ route_id: formData.route_id || 'all' });
    }
  }, [formData.route_id, setVehicleParams]);

  // Sync academic_year_id from dashboard selection (add mode only; non-editable)
  useEffect(() => {
    if (!isEdit && academicYearsList.length > 0) {
      const id = academicYearId ?? academicYearsList.find(y => y.is_current)?.id ?? academicYearsList[0]?.id;
      const yearIdStr = id != null ? String(id) : null;
      setFormData(prev => (prev.academic_year_id !== yearIdStr ? { ...prev, academic_year_id: yearIdStr } : prev));
    }
  }, [isEdit, academicYearId, academicYearsList]);

  const [owner, setOwner] = useState<string[]>([]);
  const handleTagsChange2 = (newTags: string[]) => {
    setOwner(newTags);
  };

  const [owner1, setOwner1] = useState<string[]>([]);
  const handleTagsChange3 = (newTags: string[]) => {
    setOwner1(newTags);
  };
  const [owner2, setOwner2] = useState<string[]>([]);
  const handleTagsChange4 = (newTags: string[]) => {
    setOwner2(newTags);
  };
  const [defaultDate, setDefaultDate] = useState<dayjs.Dayjs | null>(null);
  const location = useLocation();

  const addNewContent = () => {
    setFormData(prev => ({
      ...prev,
      siblings: [
        ...prev.siblings,
        { is_in_same_school: true, name: '', class_name: '', roll_number: '', admission_number: '' }
      ]
    }));
  };

  const removeContent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      siblings: prev.siblings.filter((_, i) => i !== index)
    }));
  };

  const updateSibling = (index: number, patch: any) => {
    setFormData(prev => ({
      ...prev,
      siblings: prev.siblings.map((s, i) => i === index ? { ...s, ...patch } : s)
    }));
  };

  // Handle form field changes
  const handleInputChange = (field: string, value: any) => {
    let next = value;
    if (field === "aadhaar_no") {
      next = String(value ?? "")
        .replace(/\D/g, "")
        .slice(0, 12);
    } else if (field === "pen_number") {
      next = String(value ?? "").slice(0, 20);
    } else if (field === "unique_student_ids") {
      next = String(value ?? "").slice(0, 50);
    }
    setFormData((prev) => {
      const patch: Record<string, unknown> = { [field]: next };
      if (["father_name", "father_phone", "father_email", "father_occupation"].includes(field)) {
        patch.father_matched_from_legacy = false;
        if (prev.father_person_id != null) {
          patch.father_person_id = null;
        }
      }
      if (["mother_name", "mother_phone", "mother_email", "mother_occupation"].includes(field)) {
        patch.mother_matched_from_legacy = false;
        if (prev.mother_person_id != null) {
          patch.mother_person_id = null;
        }
      }
      if (
        [
          "guardian_first_name",
          "guardian_last_name",
          "guardian_phone",
          "guardian_email",
          "guardian_occupation",
          "guardian_address",
          "guardian_relation",
        ].includes(field)
      ) {
        patch.guardian_matched_from_legacy = false;
        if (prev.guardian_person_id != null) {
          patch.guardian_person_id = null;
        }
      }
      return { ...prev, ...patch };
    });
    clearFieldErrorSmart(field);
  };

  const openStudentDocument = async (relativePath: string | null) => {
    if (!relativePath) return;
    const apiPath = apiPathFromStudentDocRelativePath(relativePath);
    if (!apiPath) return;
    const abs = await apiService.getSchoolStorageFileAbsoluteUrl(apiPath);
    window.open(abs, "_blank", "noopener,noreferrer");
  };

  const uploadStudentDoc = async (
    file: File,
    field: "medical_document_path" | "transfer_certificate_path",
    docType: "medical" | "transfer_certificate",
    setStatus: (s: DocUploadUiStatus) => void
  ) => {
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") {
      setStatus("error");
      void Swal.fire({ icon: "error", title: "Only PDF allowed", text: "Please choose a PDF file." });
      return;
    }
    if (file.size > STUDENT_DOC_MAX_BYTES) {
      setStatus("error");
      void Swal.fire({ icon: "error", title: "File too large", text: "Maximum size is 4MB." });
      return;
    }
    setStatus("uploading");
    try {
      const res = await apiService.uploadStudentDocumentPdf(file, docType);
      const payload = (res as { data?: { relativePath?: string; url?: string } })?.data ?? res;
      const rel = (payload as { relativePath?: string })?.relativePath;
      if (!rel || typeof rel !== "string") {
        throw new Error("Upload did not return a file path");
      }
      setFormData((prev) => ({ ...prev, [field]: rel }));
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Upload failed";
      void Swal.fire({ icon: "error", title: "Upload failed", text: msg });
    }
  };

  const uploadStudentPhoto = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      void Swal.fire({ icon: "error", title: "File too large", text: "Student photo must be under 4MB" });
      setPhotoUploadStatus("error");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setPhotoUploadStatus("error");
      void Swal.fire({ icon: "error", title: "Invalid file type", text: "Please upload JPG, PNG or SVG" });
      return;
    }

    setPhotoUploadStatus("uploading");
    try {
      const userId = isEdit && id ? parseInt(id, 10) : null;
      const res = await apiService.uploadStudentPhoto(file, userId);
      const payload = (res as { data?: { relativePath?: string; url?: string } })?.data ?? res;
      const rel = (payload as { relativePath?: string })?.relativePath;
      if (!rel || typeof rel !== "string") {
        throw new Error("Upload did not return a file path");
      }
      handleInputChange("photo_url", rel);
      setPhotoUploadStatus("success");
    } catch (err: unknown) {
      setPhotoUploadStatus("error");
      const msg = err instanceof Error ? err.message : "Upload failed";
      void Swal.fire({ icon: "error", title: "Upload failed", text: msg });
    }
  };

  const uploadContactPhoto = async (
    file: File, 
    userId: number | null, 
    field: "father_image_url" | "mother_image_url" | "guardian_image_url",
    setStatus: (s: DocUploadUiStatus) => void
  ) => {
    if (file.size > 4 * 1024 * 1024) {
      void Swal.fire({ icon: "error", title: "File too large", text: "Photo must be under 4MB" });
      setStatus("error");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setStatus("error");
      void Swal.fire({ icon: "error", title: "Invalid file type", text: "Please upload JPG, PNG or SVG" });
      return;
    }

    setStatus("uploading");
    try {
      // Reusing student photo endpoint but specifying the contact's userId if they exist
      const res = await apiService.uploadStudentPhoto(file, userId); 
      const payload = (res as { data?: { relativePath?: string; url?: string } })?.data ?? res;
      const rel = (payload as { relativePath?: string })?.relativePath;
      if (!rel || typeof rel !== "string") {
        throw new Error("Upload did not return a file path");
      }
      handleInputChange(field, rel);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Upload failed";
      void Swal.fire({ icon: "error", title: "Upload failed", text: msg });
    }
  };

  useEffect(() => {
    if (formData.photo_url) {
      apiService.getSchoolStorageFileAbsoluteUrl(formData.photo_url).then(setPhotoPreview);
    } else {
      setPhotoPreview(null);
    }
  }, [formData.photo_url]);

  useEffect(() => {
    if (formData.father_image_url) {
      apiService.getSchoolStorageFileAbsoluteUrl(formData.father_image_url).then(setFatherPhotoPreview);
    } else {
      setFatherPhotoPreview(null);
    }
  }, [formData.father_image_url]);

  useEffect(() => {
    if (formData.mother_image_url) {
      apiService.getSchoolStorageFileAbsoluteUrl(formData.mother_image_url).then(setMotherPhotoPreview);
    } else {
      setMotherPhotoPreview(null);
    }
  }, [formData.mother_image_url]);

  useEffect(() => {
    if (formData.guardian_image_url) {
      apiService.getSchoolStorageFileAbsoluteUrl(formData.guardian_image_url).then(setGuardianPhotoPreview);
    } else {
      setGuardianPhotoPreview(null);
    }
  }, [formData.guardian_image_url]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const submitErrors = validateAllForSubmit(formData);
      if (submitErrors) {
        const firstInvalid = getFirstInvalidFieldKey(submitErrors);
        if (firstInvalid) focusAddStudentField(firstInvalid);
        setIsSubmitting(false);
        return;
      }

      const duplicateAdmission = await admissionUniqueness.ensureUniqueBeforeSubmit();
      if (duplicateAdmission) {
        setFieldErrors((prev) => ({
          ...prev,
          admission_number: ADMISSION_NUMBER_DUPLICATE_MSG,
        }));
        focusAddStudentField('admission_number');
        setIsSubmitting(false);
        return;
      }

      // --- Cross-field email duplicate check ---
      const emailsToCheck: { label: string; email: string }[] = [
        { label: 'Father', email: (formData.father_email || '').trim().toLowerCase() },
        { label: 'Mother', email: (formData.mother_email || '').trim().toLowerCase() },
        { label: 'Guardian', email: (formData.guardian_email || '').trim().toLowerCase() },
      ].filter(x => x.email !== '');

      const emailsSeen = new Map<string, string>();
      const emailDuplicates: string[] = [];
      for (const { label, email } of emailsToCheck) {
        if (emailsSeen.has(email)) {
          emailDuplicates.push(`"${email}" is used for both ${emailsSeen.get(email)} and ${label}.`);
        } else {
          emailsSeen.set(email, label);
        }
      }

      if (emailDuplicates.length > 0) {
        await Swal.fire({
          icon: 'error',
          title: 'Duplicate Email',
          html: emailDuplicates.map(d => `<p>${d}</p>`).join(''),
          confirmButtonText: 'Fix Emails',
        });
        setIsSubmitting(false);
        return;
      }
      // --- End cross-field email duplicate check ---

      // Prepare data for submission (omit UI-only legacy flags)
      const {
        father_matched_from_legacy: _fml,
        mother_matched_from_legacy: _mml,
        guardian_matched_from_legacy: _gml,
        ...formDataForSubmit
      } = formData;
      const submitData = {
        ...formDataForSubmit,
        admission_date: formData.admission_date ? dayjs(formData.admission_date).format('YYYY-MM-DD') : null,
        date_of_birth: formData.date_of_birth ? dayjs(formData.date_of_birth).format('YYYY-MM-DD') : null,
        academic_year_id: formData.academic_year_id ? (typeof formData.academic_year_id === 'string' ? parseInt(formData.academic_year_id) : formData.academic_year_id) : null,
        class_id: formData.class_id ? (typeof formData.class_id === 'string' ? parseInt(formData.class_id) : formData.class_id) : null,
        section_id: formData.section_id ? (typeof formData.section_id === 'string' ? parseInt(formData.section_id) : formData.section_id) : null,
        blood_group_id: formData.blood_group_id ? (typeof formData.blood_group_id === 'string' ? parseInt(formData.blood_group_id) : formData.blood_group_id) : null,
        house_id: formData.house_id ? (typeof formData.house_id === 'string' ? parseInt(formData.house_id) : formData.house_id) : null,
        religion_id: formData.religion_id ? (typeof formData.religion_id === 'string' ? parseInt(formData.religion_id) : formData.religion_id) : null,
        cast_id: formData.cast_id ? (typeof formData.cast_id === 'string' ? parseInt(formData.cast_id) : formData.cast_id) : null,
        mother_tongue_id: formData.mother_tongue_id ? (typeof formData.mother_tongue_id === 'string' ? parseInt(formData.mother_tongue_id) : formData.mother_tongue_id) : null,
        // Gender should be stored as text, not converted to integer
        gender: formData.gender || null,
        // Parent fields
        father_name: formData.father_name || null,
        father_email: formData.father_email || null,
        father_phone: formData.father_phone || null,
        father_occupation: formData.father_occupation || null,
        father_image_url: formData.father_image_url || null,
        father_person_id: formData.father_person_id ?? null,
        mother_name: formData.mother_name || null,
        mother_email: formData.mother_email || null,
        mother_phone: formData.mother_phone || null,
        mother_occupation: formData.mother_occupation || null,
        mother_image_url: formData.mother_image_url || null,
        mother_person_id: formData.mother_person_id ?? null,
        // Guardian, address, siblings, transport, hostel, bank, medical
        guardian_first_name: formData.guardian_first_name || null,
        guardian_last_name: formData.guardian_last_name || null,
        guardian_relation: formData.guardian_relation || null,
        guardian_phone: formData.guardian_phone || null,
        guardian_email: formData.guardian_email || null,
        guardian_occupation: formData.guardian_occupation || null,
        guardian_address: formData.guardian_address || null,
        guardian_person_id: formData.guardian_person_id ?? null,
        current_address: formData.current_address || null,
        permanent_address: formData.permanent_address || null,
        previous_school: formData.previous_school || null,
        previous_school_address: formData.previous_school_address || null,
        siblings: formData.siblings.map(s => ({
          is_in_same_school: s.is_in_same_school,
          name: s.name || null,
          class_name: s.class_name || null,
          section_name: s.section_name || null,
          roll_number: s.roll_number || null,
          admission_number: s.admission_number || null,
        })),
        is_transport_required: formData.is_transport_required || false,
        route_id: formData.route_id ? (typeof formData.route_id === 'string' ? parseInt(formData.route_id) : formData.route_id) : null,
        pickup_point_id: formData.pickup_point_id ? (typeof formData.pickup_point_id === 'string' ? parseInt(formData.pickup_point_id) : formData.pickup_point_id) : null,
        is_hostel_required: formData.is_hostel_required || false,
        hostel_id: formData.hostel_id ? (typeof formData.hostel_id === 'string' ? parseInt(formData.hostel_id) : formData.hostel_id) : null,
        hostel_room_id: formData.hostel_room_id ? (typeof formData.hostel_room_id === 'string' ? parseInt(formData.hostel_room_id) : formData.hostel_room_id) : null,
        bank_name: formData.bank_name || null,
        branch: formData.branch || null,
        ifsc: formData.ifsc || null,
        unique_student_ids: formData.unique_student_ids || null,
        pen_number: formData.pen_number || null,
        aadhaar_no: formData.aadhaar_no || null,
        gr_number: (formData.gr_number || '').trim() || null,
        known_allergies: Array.isArray(owner1) ? owner1 : (owner1 ? String(owner1).split(',').map(s => s.trim()).filter(Boolean) : []),
        medications: Array.isArray(owner2) ? owner2 : (owner2 ? String(owner2).split(',').map(s => s.trim()).filter(Boolean) : []),
        medical_condition: formData.medical_condition || null,
        other_information: formData.other_information || null,
        medical_document_path: formData.medical_document_path || null,
        transfer_certificate_path: formData.transfer_certificate_path || null,
        photo_url: formData.photo_url || null,
      };

      let response: { status?: string; warnings?: { message?: string }[] };
      if (isEdit && id) {
        // Update existing student
        response = await apiService.updateStudent(id, submitData);
      } else {
        response = await apiService.createStudent(submitData);
      }

      if (
        response?.status === "SUCCESS" &&
        Array.isArray(response.warnings) &&
        response.warnings.length > 0
      ) {
        // Backend returned warnings (e.g. email already in use by another account type).
        // Show the warning and STAY on the form — do NOT navigate — so the user can fix the email.
        const lines = response.warnings
          .map((w) => (w && typeof w.message === "string" ? w.message.trim() : ""))
          .filter(Boolean);
        await Swal.fire({
          icon: "error",
          title: "Email Already In Use",
          html: lines.length > 0
            ? lines.map(l => `<p>${l}</p>`).join('')
            : "<p>One or more emails are already registered to another account. Please use a different email.</p>",
          confirmButtonText: "Fix Emails",
        });
        // Do NOT navigate — stay on the form so the user can correct the emails
        setIsSubmitting(false);
        return;
      }

      // Navigate to student list only on clean success (no warnings)
      navigate(routes.studentList);
    } catch (error: any) {
      console.error('Error saving student:', error);
      // 409 = email conflict — show a clear modal and stay on the form
      if (error?.status === 409) {
        // Extract the message from the error (apiService sets error.message = "HTTP error! status: 409, message: <backend msg>")
        const raw: string = error.message || '';
        const match = raw.match(/message:\s*(.+)/);
        const userMsg = match ? match[1] : raw || 'An email address is already in use by another account.';
        await Swal.fire({
          icon: 'error',
          title: 'Duplicate Email',
          text: userMsg,
          confirmButtonText: 'Fix Emails',
        });
      } else {
        setSubmitError(error.message || `Failed to ${isEdit ? 'update' : 'create'} student`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    // Check if we're in edit mode by looking for the ID parameter
    const isEditMode = !!id;

    if (isEditMode) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0"); // Month is zero-based, so we add 1
      const day = String(today.getDate()).padStart(2, "0");
      const formattedDate = `${month}-${day}-${year}`;
      const defaultValue = dayjs(formattedDate);
      setIsEdit(true);
      setOwner(["English"]);
      setDefaultDate(defaultValue);

      if (id && fetchedStudentIdRef.current !== id && !loadingStudent) {
        fetchStudentData(id);
      } else if (!id) {
        setSubmitError('No student ID provided for editing');
      }
    } else {
      setIsEdit(false);
      setDefaultDate(null);
      setBaselineAdmission('');
      fetchedStudentIdRef.current = null; // Reset when not in edit mode
      setMedicalDocUploadStatus("idle");
      setTcDocUploadStatus("idle");
      setFormData((prev) => ({
        ...prev,
        admission_date: dayjs().startOf("day"),
        medical_document_path: null,
        transfer_certificate_path: null,
      }));
    }
  }, [id]); // Only depend on id to avoid unnecessary re-runs

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content content-two">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <Link
                to={id ? `${routes.studentDetail}/${id}` : routes.studentList}
                state={id ? { studentId: id } : undefined}
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </Link>
              <h3 className="mb-1">{isEdit ? "Edit" : "Add"} Student</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={routes.studentList}>Students</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {isEdit ? "Edit" : "Add"} Student
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          {/* /Page Header */}
          {submitError && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              <i className="ti ti-alert-circle me-2"></i>
              {submitError}
              <button type="button" className="btn-close" onClick={() => setSubmitError(null)}></button>
            </div>
          )}
          {loadingStudent && (
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">Loading student data...</p>
            </div>
          )}
          {!loadingStudent && (
            <div className="row">
              <div className="col-md-12">
                <form onSubmit={handleSubmit} noValidate>
                  {/* Personal Information */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-info-square-rounded fs-16" />
                        </span>
                        <h4 className="text-dark">Personal Information</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                            <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                              {photoPreview ? (
                                <img src={photoPreview} alt="Student" className="img-fluid h-100 w-100 object-fit-cover" />
                              ) : (
                                <i className="ti ti-photo-plus fs-16" />
                              )}
                            </div>
                            <div className="profile-upload">
                              <div className="profile-uploader d-flex align-items-center">
                                <div className="drag-upload-btn mb-3">
                                  {photoUploadStatus === "uploading" ? "Uploading..." : "Upload"}
                                  <input
                                    type="file"
                                    className="form-control image-sign"
                                    ref={photoInputRef}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) uploadStudentPhoto(file);
                                    }}
                                    accept=".jpg,.jpeg,.png,.svg"
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-primary mb-3 ms-2"
                                  onClick={() => {
                                    setFormData(prev => ({ ...prev, photo_url: null }));
                                    if (photoInputRef.current) photoInputRef.current.value = "";
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                              <p className="fs-12">
                                Upload image size 4MB, Format JPG, PNG, SVG
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="row row-cols-xxl-5 row-cols-md-6">
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            {isEdit ? (
                              <label className="form-label">Academic Year</label>
                            ) : (
                              <RequiredLabel>Academic Year</RequiredLabel>
                            )}
                            {academicYearsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading...
                              </div>
                            ) : academicYearsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {academicYearsError}
                              </div>
                            ) : (
                              <div
                                data-add-student-field="academic_year_id"
                                tabIndex={!isEdit ? -1 : undefined}
                                className={!isEdit ? "rounded" : undefined}
                              >
                                <input
                                  type="text"
                                  className={`form-control bg-light ${formControlInvalidClass(!isEdit && !!fieldErrors.academic_year_id)}`}
                                  value={academicYearsList.find(y => String(y.id) === formData.academic_year_id)?.year_name ?? formData.academic_year_id ?? '—'}
                                  readOnly
                                  disabled
                                  style={{ cursor: 'default' }}
                                />
                              </div>
                            )}
                            {!isEdit && <FieldError message={fieldErrors.academic_year_id} />}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="Admission Number"
                              isRequired
                              infoText={STUDENT_FIELD_HELP_TEXT.admissionNumber}
                              htmlFor="student-admission_number"
                            />
                            <div className="position-relative">
                              <input
                                id="student-admission_number"
                                type="text"
                                data-add-student-field="admission_number"
                                className={`form-control pe-4 ${formControlInvalidClass(
                                  !!(fieldErrors.admission_number || admissionUniqueness.duplicateMessage)
                                )}`}
                                value={formData.admission_number}
                                onChange={(e) => handleInputChange('admission_number', e.target.value)}
                                onBlur={() => {
                                  validateOnBlur('admission_number', formData);
                                  admissionUniqueness.flushOnBlur();
                                }}
                                autoComplete="off"
                                aria-busy={admissionUniqueness.checking}
                              />
                              {admissionUniqueness.checking && (
                                <span
                                  className="position-absolute top-50 end-0 translate-middle-y pe-2 text-primary"
                                  style={{ pointerEvents: 'none' }}
                                  aria-hidden
                                >
                                  <i className="ti ti-loader ti-spin" />
                                </span>
                              )}
                            </div>
                            <FieldError
                              message={
                                fieldErrors.admission_number ??
                                (formData.admission_number.trim()
                                  ? admissionUniqueness.duplicateMessage
                                  : undefined)
                              }
                            />
                            {admissionUniqueness.softWarning ? (
                              <p className="text-muted small mb-0 mt-1">{admissionUniqueness.softWarning}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="GR Number"
                              infoText={STUDENT_FIELD_HELP_TEXT.grNumber}
                              htmlFor="student-gr_number"
                            />
                            <input
                              id="student-gr_number"
                              type="text"
                              className="form-control"
                              value={formData.gr_number}
                              onChange={(e) => handleInputChange('gr_number', e.target.value)}
                              placeholder="Leave blank to auto-assign"
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Admission Date</label>
                            <div className="input-icon position-relative">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{
                                  format: "DD-MM-YYYY",
                                  type: "mask",
                                }}
                                value={formData.admission_date}
                                onChange={(date) => handleInputChange('admission_date', date)}
                                placeholder="Select Date"
                              />
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="Roll Number"
                              infoText={STUDENT_FIELD_HELP_TEXT.rollNumber}
                              htmlFor="student-roll_number"
                            />
                            <input
                              id="student-roll_number"
                              type="text"
                              className="form-control"
                              value={formData.roll_number}
                              onChange={(e) => handleInputChange('roll_number', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Status</label>
                            <CommonSelect
                              className="select"
                              options={status}
                              value={formData.status}
                              onChange={(value) => handleInputChange('status', value)}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <RequiredLabel>First Name</RequiredLabel>
                            <input
                              type="text"
                              data-add-student-field="first_name"
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.first_name)}`}
                              value={formData.first_name}
                              onChange={(e) => handleInputChange('first_name', e.target.value)}
                              onBlur={() => validateOnBlur('first_name', formData)}
                              autoComplete="given-name"
                            />
                            <FieldError message={fieldErrors.first_name} />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <RequiredLabel>Last Name</RequiredLabel>
                            <input
                              type="text"
                              data-add-student-field="last_name"
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.last_name)}`}
                              value={formData.last_name}
                              onChange={(e) => handleInputChange('last_name', e.target.value)}
                              onBlur={() => validateOnBlur('last_name', formData)}
                              autoComplete="family-name"
                            />
                            <FieldError message={fieldErrors.last_name} />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Class</label>
                            {classesLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading classes...
                              </div>
                            ) : classesError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {classesError}
                              </div>
                            ) : (
                              <>
                                <CommonSelect
                                  className="select"
                                  options={classesList.map(cls => ({
                                    value: String((cls as ClassItem).id),
                                    label: (cls as ClassItem).class_name ?? (cls as Record<string, unknown>).className ?? ''
                                  }))}
                                  value={formData.class_id}
                                  onChange={(value) => handleInputChange('class_id', value)}
                                />
                                {!classesLoading && !classesError && classesList.length === 0 && (
                                  <small className="text-muted d-block mt-1">No classes found. Add classes from Academic → Classes.</small>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Section</label>
                            {sectionsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading sections...
                              </div>
                            ) : sectionsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {sectionsError}
                              </div>
                            ) : (
                              <>
                                <CommonSelect
                                  className="select"
                                  options={sectionsList.map(section => ({
                                    value: String((section as SectionItem).id),
                                    label: (section as SectionItem).section_name ?? (section as Record<string, unknown>).sectionName ?? ''
                                  }))}
                                  value={formData.section_id}
                                  onChange={(value) => handleInputChange('section_id', value)}
                                />
                                {!sectionsLoading && !sectionsError && sectionsList.length === 0 && (
                                  <small className="text-muted d-block mt-1">No sections found. Add sections from Academic → Sections.</small>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Gender</label>
                            <CommonSelect
                              className="select"
                              options={gender}
                              value={formData.gender}
                              onChange={(value) => handleInputChange('gender', value)}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Date of Birth</label>
                            <div className="input-icon position-relative">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{
                                  format: "DD-MM-YYYY",
                                  type: "mask",
                                }}
                                value={formData.date_of_birth}
                                onChange={(date) => handleInputChange('date_of_birth', date)}
                                placeholder="Select Date"
                              />
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Blood Group</label>
                            {bloodGroupsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading blood groups...
                              </div>
                            ) : bloodGroupsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {bloodGroupsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={bloodGroupsList.map(bg => ({
                                  value: bg.id.toString(),
                                  label: bg.blood_group ?? ''
                                }))}
                                value={formData.blood_group_id}
                                onChange={(value) => handleInputChange('blood_group_id', value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">House</label>
                            {housesLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading houses...
                              </div>
                            ) : housesError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {housesError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={housesList.map(h => ({
                                  value: h.id.toString(),
                                  label: h.house_name ?? ''
                                }))}
                                value={formData.house_id}
                                onChange={(value) => handleInputChange('house_id', value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Religion</label>
                            {religionsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading religions...
                              </div>
                            ) : religionsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {religionsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={religionsList.map(religion => ({
                                  value: religion.id.toString(),
                                  label: religion.religion_name ?? ''
                                }))}
                                value={formData.religion_id}
                                onChange={(value) => handleInputChange('religion_id', value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Category</label>
                            {castsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading categories...
                              </div>
                            ) : castsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {castsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={castsList.map(cast => ({
                                  value: cast.id.toString(),
                                  label: cast.cast_name ?? ''
                                }))}
                                value={formData.cast_id}
                                onChange={(value) => handleInputChange('cast_id', value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="Primary Contact Number"
                              isRequired
                              infoText={STUDENT_FIELD_HELP_TEXT.studentContactPair}
                              htmlFor="student-phone"
                            />
                            <input
                              id="student-phone"
                              type="text"
                              inputMode="numeric"
                              data-add-student-field="phone"
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.phone)}`}
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              onBlur={() => validateOnBlur('phone', formData)}
                              autoComplete="tel"
                            />
                            <FieldError message={fieldErrors.phone} />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="Email Address"
                              isRequired
                              infoText={STUDENT_FIELD_HELP_TEXT.studentContactPair}
                              htmlFor="student-email"
                            />
                            <input
                              id="student-email"
                              type="email"
                              data-add-student-field="email"
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.email)}`}
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              onBlur={() => validateOnBlur('email', formData)}
                              autoComplete="email"
                            />
                            <FieldError message={fieldErrors.email} />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Mother Tongue</label>
                            {motherTonguesLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading mother tongues...
                              </div>
                            ) : motherTonguesError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {motherTonguesError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={motherTonguesList.map(mt => ({
                                  value: mt.id.toString(),
                                  label: mt.language_name ?? ''
                                }))}
                                value={formData.mother_tongue_id}
                                onChange={(value) => handleInputChange('mother_tongue_id', value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Language Known</label>
                            <TagInput
                              initialTags={owner}
                              onTagsChange={handleTagsChange2}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="Unique Student ID (Saral ID)"
                              infoText={STUDENT_FIELD_HELP_TEXT.uniqueStudentId}
                              htmlFor="student-unique_student_ids"
                            />
                            <input
                              id="student-unique_student_ids"
                              type="text"
                              data-add-student-field="unique_student_ids"
                              maxLength={50}
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.unique_student_ids)}`}
                              value={formData.unique_student_ids}
                              onChange={(e) => handleInputChange('unique_student_ids', e.target.value)}
                              onBlur={() => validateOnBlur('unique_student_ids', formData)}
                              autoComplete="off"
                            />
                            <FieldError message={fieldErrors.unique_student_ids} />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="PEN Number (UDISE ID)"
                              infoText={STUDENT_FIELD_HELP_TEXT.penNumber}
                              htmlFor="student-pen_number"
                            />
                            <input
                              id="student-pen_number"
                              type="text"
                              data-add-student-field="pen_number"
                              maxLength={20}
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.pen_number)}`}
                              value={formData.pen_number}
                              onChange={(e) => handleInputChange('pen_number', e.target.value)}
                              onBlur={() => validateOnBlur('pen_number', formData)}
                              autoComplete="off"
                            />
                            <FieldError message={fieldErrors.pen_number} />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <FormLabelWithInfo
                              label="Aadhaar Number"
                              infoText={STUDENT_FIELD_HELP_TEXT.aadhaarNumber}
                              htmlFor="student-aadhaar_no"
                            />
                            <input
                              id="student-aadhaar_no"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={12}
                              data-add-student-field="aadhaar_no"
                              className={`form-control ${formControlInvalidClass(!!fieldErrors.aadhaar_no)}`}
                              placeholder="12 digits, or leave blank"
                              value={formData.aadhaar_no}
                              onChange={(e) => handleInputChange('aadhaar_no', e.target.value)}
                              onBlur={() => validateOnBlur('aadhaar_no', formData)}
                              autoComplete="off"
                            />
                            <FieldError message={fieldErrors.aadhaar_no} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Personal Information */}
                  {/* Parents & Guardian Information */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-user-shield fs-16" />
                        </span>
                        <h4 className="text-dark">
                          Parents &amp; Guardian Information
                        </h4>
                      </div>
                    </div>
                    <div className="card-body pb-0">
                      <div className="border-bottom mb-3">
                        <h5 className="mb-3">Father’s Info</h5>
                        <div className="row">
                          <div className="col-12">
                            <ParentPersonPicker
                              label="Link existing father (search by mobile, email, or name)"
                              searchRole="father"
                              selectedId={formData.father_person_id}
                              matchedFromLegacy={formData.father_matched_from_legacy}
                              onSelectPerson={(p: ParentPersonRow) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  father_person_id: p.id ?? null,
                                  father_matched_from_legacy: Boolean(
                                    p.legacy_from_student_records
                                  ),
                                  father_name: p.full_name || "",
                                  father_phone: p.phone || "",
                                  father_email: p.email || "",
                                  father_occupation: p.occupation || "",
                                }));
                              }}
                              onClear={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  father_person_id: null,
                                  father_matched_from_legacy: false,
                                }))
                              }
                            />
                          </div>
                          <div className="col-md-12">
                            <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                                {fatherPhotoPreview ? (
                                  <img src={fatherPhotoPreview} alt="Father" className="img-fluid h-100 w-100 object-fit-cover" />
                                ) : (
                                  <i className="ti ti-photo-plus fs-16" />
                                )}
                              </div>
                              <div className="profile-upload">
                                <div className="profile-uploader d-flex align-items-center">
                                  <div className="drag-upload-btn mb-3">
                                    {fatherPhotoUploadStatus === "uploading" ? "Uploading..." : "Upload"}
                                    <input
                                      type="file"
                                      ref={fatherPhotoInputRef}
                                      className="form-control image-sign"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadContactPhoto(file, formData.father_person_id, "father_image_url", setFatherPhotoUploadStatus);
                                      }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-primary mb-3 ms-2"
                                    onClick={() => handleInputChange("father_image_url", "")}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <p className="fs-12">
                                  Upload image size 4MB, Format JPG, PNG, SVG
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Father Name</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.father_name}
                                onChange={(e) => handleInputChange('father_name', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <FormLabelWithInfo
                                label="Email"
                                isRequired
                                infoText={STUDENT_FIELD_HELP_TEXT.fatherContactPair}
                                htmlFor="student-father_email"
                              />
                              <input
                                id="student-father_email"
                                type="text"
                                data-add-student-field="father_email"
                                className={`form-control ${formControlInvalidClass(!!fieldErrors.father_email)}`}
                                value={formData.father_email}
                                onChange={(e) => handleInputChange('father_email', e.target.value)}
                                onBlur={() => validateOnBlur('father_email', formData)}
                                autoComplete="off"
                              />
                              <FieldError message={fieldErrors.father_email} />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <FormLabelWithInfo
                                label="Phone Number"
                                isRequired
                                infoText={STUDENT_FIELD_HELP_TEXT.fatherContactPair}
                                htmlFor="student-father_phone"
                              />
                              <input
                                id="student-father_phone"
                                type="text"
                                inputMode="numeric"
                                data-add-student-field="father_phone"
                                className={`form-control ${formControlInvalidClass(!!fieldErrors.father_phone)}`}
                                value={formData.father_phone}
                                onChange={(e) => handleInputChange('father_phone', e.target.value)}
                                onBlur={() => validateOnBlur('father_phone', formData)}
                                autoComplete="off"
                              />
                              <FieldError message={fieldErrors.father_phone} />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">
                                Father Occupation
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.father_occupation}
                                onChange={(e) => handleInputChange('father_occupation', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="border-bottom mb-3">
                        <h5 className="mb-3">Mother’s Info</h5>
                        <div className="row">
                          <div className="col-12">
                            <ParentPersonPicker
                              label="Link existing mother (search by mobile, email, or name)"
                              searchRole="mother"
                              selectedId={formData.mother_person_id}
                              matchedFromLegacy={formData.mother_matched_from_legacy}
                              onSelectPerson={(p: ParentPersonRow) => {
                                setFormData((prev) => ({
                                  ...prev,
                                  mother_person_id: p.id ?? null,
                                  mother_matched_from_legacy: Boolean(
                                    p.legacy_from_student_records
                                  ),
                                  mother_name: p.full_name || "",
                                  mother_phone: p.phone || "",
                                  mother_email: p.email || "",
                                  mother_occupation: p.occupation || "",
                                }));
                              }}
                              onClear={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  mother_person_id: null,
                                  mother_matched_from_legacy: false,
                                }))
                              }
                            />
                          </div>
                          <div className="col-md-12">
                            <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                                {motherPhotoPreview ? (
                                  <img src={motherPhotoPreview} alt="Mother" className="img-fluid h-100 w-100 object-fit-cover" />
                                ) : (
                                  <i className="ti ti-photo-plus fs-16" />
                                )}
                              </div>
                              <div className="profile-upload">
                                <div className="profile-uploader d-flex align-items-center">
                                  <div className="drag-upload-btn mb-3">
                                    {motherPhotoUploadStatus === "uploading" ? "Uploading..." : "Upload"}
                                    <input
                                      type="file"
                                      ref={motherPhotoInputRef}
                                      className="form-control image-sign"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadContactPhoto(file, formData.mother_person_id, "mother_image_url", setMotherPhotoUploadStatus);
                                      }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-primary mb-3 ms-2"
                                    onClick={() => handleInputChange("mother_image_url", "")}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <p className="fs-12">
                                  Upload image size 4MB, Format JPG, PNG, SVG
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Mother Name</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.mother_name}
                                onChange={(e) => handleInputChange('mother_name', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <FormLabelWithInfo
                                label="Email"
                                isRequired
                                infoText={STUDENT_FIELD_HELP_TEXT.motherContactPair}
                                htmlFor="student-mother_email"
                              />
                              <input
                                id="student-mother_email"
                                type="text"
                                data-add-student-field="mother_email"
                                className={`form-control ${formControlInvalidClass(!!fieldErrors.mother_email)}`}
                                value={formData.mother_email}
                                onChange={(e) => handleInputChange('mother_email', e.target.value)}
                                onBlur={() => validateOnBlur('mother_email', formData)}
                                autoComplete="off"
                              />
                              <FieldError message={fieldErrors.mother_email} />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <FormLabelWithInfo
                                label="Phone Number"
                                isRequired
                                infoText={STUDENT_FIELD_HELP_TEXT.motherContactPair}
                                htmlFor="student-mother_phone"
                              />
                              <input
                                id="student-mother_phone"
                                type="text"
                                inputMode="numeric"
                                data-add-student-field="mother_phone"
                                className={`form-control ${formControlInvalidClass(!!fieldErrors.mother_phone)}`}
                                value={formData.mother_phone}
                                onChange={(e) => handleInputChange('mother_phone', e.target.value)}
                                onBlur={() => validateOnBlur('mother_phone', formData)}
                                autoComplete="off"
                              />
                              <FieldError message={fieldErrors.mother_phone} />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">
                                Mother Occupation
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.mother_occupation}
                                onChange={(e) => handleInputChange('mother_occupation', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="mb-3">Guardian Details</h5>
                        <div className="row">
                          <div className="col-12">
                            <ParentPersonPicker
                              label="Link existing guardian (search by mobile, email, or name)"
                              searchRole="guardian"
                              selectedId={formData.guardian_person_id}
                              matchedFromLegacy={formData.guardian_matched_from_legacy}
                              onSelectPerson={(p: ParentPersonRow) => {
                                const parts = (p.full_name || "").trim().split(/\s+/);
                                setFormData((prev) => ({
                                  ...prev,
                                  guardian_person_id: p.id ?? null,
                                  guardian_matched_from_legacy: Boolean(
                                    p.legacy_from_student_records
                                  ),
                                  guardian_first_name: parts[0] || "",
                                  guardian_last_name: parts.slice(1).join(" ") || "",
                                  guardian_phone: p.phone || "",
                                  guardian_email: p.email || "",
                                  guardian_occupation: p.occupation || "",
                                  guardian_address: p.address || "",
                                }));
                              }}
                              onClear={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  guardian_person_id: null,
                                  guardian_matched_from_legacy: false,
                                }))
                              }
                            />
                          </div>
                          <div className="col-md-12">
                            <div className="mb-2">
                              <div className="d-flex align-items-center flex-wrap">
                                <label className="form-label text-dark fw-normal me-2">
                                  If Guardian Is
                                </label>
                                <div className="form-check me-3 mb-2">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="guardian"
                                    id="parents"
                                    defaultChecked
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="parents"
                                  >
                                    Parents
                                  </label>
                                </div>
                                <div className="form-check me-3 mb-2">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="guardian"
                                    id="guardian"
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="guardian"
                                  >
                                    Guardian
                                  </label>
                                </div>
                                <div className="form-check mb-2">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="guardian"
                                    id="other"
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="other"
                                  >
                                    Others
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                                {guardianPhotoPreview ? (
                                  <img src={guardianPhotoPreview} alt="Guardian" className="img-fluid h-100 w-100 object-fit-cover" />
                                ) : (
                                  <i className="ti ti-photo-plus fs-16" />
                                )}
                              </div>
                              <div className="profile-upload">
                                <div className="profile-uploader d-flex align-items-center">
                                  <div className="drag-upload-btn mb-3">
                                    {guardianPhotoUploadStatus === "uploading" ? "Uploading..." : "Upload"}
                                    <input
                                      type="file"
                                      ref={guardianPhotoInputRef}
                                      className="form-control image-sign"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) uploadContactPhoto(file, formData.guardian_person_id, "guardian_image_url", setGuardianPhotoUploadStatus);
                                      }}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    className="btn btn-primary mb-3 ms-2"
                                    onClick={() => handleInputChange("guardian_image_url", "")}
                                  >
                                    Remove
                                  </button>
                                </div>
                                <p className="fs-12">
                                  Upload image size 4MB, Format JPG, PNG, SVG
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Guardian Name</label>
                              <input
                                type="text"
                                className="form-control"
                                readOnly={formData.guardian_person_id != null}
                                value={[formData.guardian_first_name, formData.guardian_last_name].filter(Boolean).join(' ')}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const idx = v.trim().indexOf(' ');
                                  setFormData(prev => ({
                                    ...prev,
                                    guardian_first_name: idx >= 0 ? v.slice(0, idx).trim() : v.trim(),
                                    guardian_last_name: idx >= 0 ? v.slice(idx + 1).trim() : ''
                                  }));
                                }}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">
                                Guardian Relation
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.guardian_relation || ''}
                                onChange={(e) => handleInputChange('guardian_relation', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <FormLabelWithInfo
                                label="Phone Number"
                                isRequired
                                infoText={STUDENT_FIELD_HELP_TEXT.guardianContactPair}
                                htmlFor="student-guardian_phone"
                              />
                              <input
                                id="student-guardian_phone"
                                type="text"
                                inputMode="numeric"
                                data-add-student-field="guardian_phone"
                                className={`form-control ${formControlInvalidClass(!!fieldErrors.guardian_phone)}`}
                                value={formData.guardian_phone || ''}
                                onChange={(e) => handleInputChange('guardian_phone', e.target.value)}
                                onBlur={() => validateOnBlur('guardian_phone', formData)}
                                autoComplete="off"
                              />
                              <FieldError message={fieldErrors.guardian_phone} />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <FormLabelWithInfo
                                label="Email"
                                isRequired
                                infoText={STUDENT_FIELD_HELP_TEXT.guardianContactPair}
                                htmlFor="student-guardian_email"
                              />
                              <input
                                id="student-guardian_email"
                                type="email"
                                data-add-student-field="guardian_email"
                                className={`form-control ${formControlInvalidClass(!!fieldErrors.guardian_email)}`}
                                value={formData.guardian_email || ''}
                                onChange={(e) => handleInputChange('guardian_email', e.target.value)}
                                onBlur={() => validateOnBlur('guardian_email', formData)}
                                autoComplete="off"
                              />
                              <FieldError message={fieldErrors.guardian_email} />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Occupation</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.guardian_occupation || ''}
                                onChange={(e) => handleInputChange('guardian_occupation', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Address</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.guardian_address || ''}
                                onChange={(e) => handleInputChange('guardian_address', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Parents & Guardian Information */}
                  {/* Siblings */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-users fs-16" />
                        </span>
                        <h4 className="text-dark">Siblings</h4>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="addsibling-info">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-2">
                              <label className="form-label">Sibling Info</label>
                            </div>
                          </div>
                          {formData.siblings.map((sib, index) => {
                            const useRealData = true;
                            const isSameSchool = sib.is_in_same_school;
                            return (
                              <div key={index} className="col-lg-12">
                                <div className="row">
                                  <div className="col-md-12">
                                    <div className="mb-2 d-flex align-items-center flex-wrap">
                                      <label className="form-label text-dark fw-normal me-2 mb-0">
                                        {`Is Sibling ${index + 1} studying in the same school`}
                                      </label>
                                      <div className="form-check me-3 mb-2">
                                        <input
                                          className="form-check-input"
                                          type="radio"
                                          name={`sibling-${index}`}
                                          id={`sibling-${index}-yes`}
                                          checked={isSameSchool}
                                          onChange={() => updateSibling(index, { is_in_same_school: true })}
                                        />
                                        <label
                                          className="form-check-label"
                                          htmlFor={`sibling-${index}-yes`}
                                        >
                                          Yes
                                        </label>
                                      </div>
                                      <div className="form-check mb-2">
                                        <input
                                          className="form-check-input"
                                          type="radio"
                                          name={`sibling-${index}`}
                                          id={`sibling-${index}-no`}
                                          checked={!isSameSchool}
                                          onChange={() => updateSibling(index, { is_in_same_school: false })}
                                        />
                                        <label
                                          className="form-check-label"
                                          htmlFor={`sibling-${index}-no`}
                                        >
                                          No
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-lg-3 col-md-6">
                                    <div className="mb-3">
                                      <label className="form-label">Name</label>
                                      {useRealData ? (
                                        <input
                                          type="text"
                                          className="form-control"
                                          value={sib.name || ''}
                                          onChange={(e) => updateSibling(index, { name: e.target.value })}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          className="form-control"
                                          placeholder="Sibling Name"
                                          disabled
                                        />
                                      )}
                                    </div>
                                  </div>
                                  {isSameSchool && (
                                    <>
                                      <div className="col-lg-3 col-md-6">
                                        <div className="mb-3">
                                          <label className="form-label">Roll No</label>
                                          <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Roll No"
                                            value={sib.roll_number || ''}
                                            onChange={(e) => updateSibling(index, { roll_number: e.target.value })}
                                          />
                                        </div>
                                      </div>
                                      <div className="col-lg-3 col-md-6">
                                        <div className="mb-3">
                                          <label className="form-label">
                                            Admission No
                                          </label>
                                          <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Admission No"
                                            value={sib.admission_number || ''}
                                            onChange={(e) => updateSibling(index, { admission_number: e.target.value })}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  <div className="col-lg-3 col-md-6">
                                    <div className="mb-3">
                                      <label className="form-label">
                                        Class
                                      </label>
                                      {isSameSchool ? (
                                        <CommonSelect
                                          className="select"
                                          options={classesList.map(cls => ({
                                            value: (cls as ClassItem).class_name ?? (cls as any).className ?? '',
                                            label: (cls as ClassItem).class_name ?? (cls as any).className ?? '',
                                            original: cls
                                          }))}
                                          value={sib.class_name || ''}
                                          onChange={(value) => {
                                            updateSibling(index, { class_name: value, section_name: '' });
                                          }}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          className="form-control"
                                          placeholder="Class"
                                          value={sib.class_name || ''}
                                          onChange={(e) => updateSibling(index, { class_name: e.target.value })}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  {isSameSchool ? (
                                    <div className="col-lg-3 col-md-6">
                                      <div className="mb-3">
                                        <div className="d-flex align-items-center">
                                          <div className="w-100">
                                            <label className="form-label">
                                              Section
                                            </label>
                                            <CommonSelect
                                              className="select"
                                              options={(() => {
                                                const selectedCls = classesList.find(c => 
                                                  ((c as ClassItem).class_name ?? (c as any).className) === sib.class_name
                                                );
                                                const clsId = selectedCls?.id;
                                                return allSectionsList
                                                  .filter(sec => !clsId || Number(sec.class_id) === Number(clsId))
                                                  .map(sec => ({
                                                    value: sec.section_name ?? sec.sectionName ?? '',
                                                    label: sec.section_name ?? sec.sectionName ?? ''
                                                  }));
                                              })()}
                                              value={sib.section_name || ''}
                                              onChange={(value) => updateSibling(index, { section_name: value })}
                                            />
                                          </div>
                                          {formData.siblings.length > 1 && (
                                            <div className="ms-3 mt-4">
                                              <Link
                                                to="#"
                                                className="trash-icon"
                                                onClick={() => removeContent(index)}
                                              >
                                                <i className="ti ti-trash-x" />
                                              </Link>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    formData.siblings.length > 1 && (
                                      <div className="col-lg-1 col-md-1">
                                        <div className="mb-3">
                                          <label className="form-label">&nbsp;</label>
                                          <div className="mt-2">
                                            <Link
                                              to="#"
                                              className="trash-icon"
                                              onClick={() => removeContent(index)}
                                            >
                                              <i className="ti ti-trash-x" />
                                            </Link>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="border-top pt-3">
                        <Link
                          to="#"
                          onClick={addNewContent}
                          className="add-sibling btn btn-primary d-inline-flex align-items-center"
                        >
                          <i className="ti ti-circle-plus me-2" />
                          Add New
                        </Link>
                      </div>
                    </div>
                  </div>
                  {/* /Sibilings */}
                  {/* Address */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-map fs-16" />
                        </span>
                        <h4 className="text-dark">Address</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Current Address</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.current_address || ''}
                              onChange={(e) => handleInputChange('current_address', e.target.value)}
                              placeholder="Enter current address"
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Permanent Address
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.permanent_address || ''}
                              onChange={(e) => handleInputChange('permanent_address', e.target.value)}
                              placeholder="Enter permanent address"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Address */}
                  {/* Transport Information */}
                  <div className="card">
                    <div className="card-header bg-light d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-bus-stop fs-16" />
                        </span>
                        <h4 className="text-dark">Transport Information</h4>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={formData.is_transport_required}
                          onChange={(e) => handleInputChange('is_transport_required', e.target.checked)}
                        />
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Route</label>
                            {routesLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading routes...
                              </div>
                            ) : routesError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {routesError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={routeOptions.map(r => ({ value: r.value, label: r.label }))}
                                value={formData.route_id}
                                onChange={(v) => handleInputChange('route_id', v || null)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Vehicle Number</label>
                            {vehiclesLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading vehicles...
                              </div>
                            ) : vehiclesError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {vehiclesError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={vehicleOptions.map(v => ({ value: v.value, label: v.label }))}
                                value={formData.vehicle_number || null}
                                onChange={(v) => handleInputChange('vehicle_number', v || '')}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Pickup Point</label>
                            {pickupLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading pickup points...
                              </div>
                            ) : pickupError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {pickupError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={pickupPointOptions.map(p => ({ value: p.value, label: p.label }))}
                                value={formData.pickup_point_id}
                                onChange={(v) => handleInputChange('pickup_point_id', v || null)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Transport Information */}
                  {/* Hostel Information */}
                  <div className="card">
                    <div className="card-header bg-light d-flex align-items-center justify-content-between">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-building-fortress fs-16" />
                        </span>
                        <h4 className="text-dark">Hostel Information</h4>
                      </div>
                      <div className="form-check form-switch">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={formData.is_hostel_required}
                          onChange={(e) => handleInputChange('is_hostel_required', e.target.checked)}
                        />
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Hostel</label>
                            {hostelsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading hostels...
                              </div>
                            ) : hostelsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {hostelsError}
                              </div>
                            ) : (
                              <>
                                <CommonSelect
                                  className="select"
                                  options={
                                    formData.hostel_id && !hostelOptions.find(o => o.value === formData.hostel_id)
                                      ? [{ value: formData.hostel_id, label: formData.hostel_name || formData.hostel_id }, ...hostelOptions]
                                      : hostelOptions.length > 0 ? hostelOptions : [{ value: "", label: "No hostels" }]
                                  }
                                  value={formData.hostel_id || null}
                                  onChange={(v) => {
                                    const opt = hostelOptions.find(o => o.value === v);
                                    setFormData(prev => ({
                                      ...prev,
                                      hostel_id: v || null,
                                      hostel_name: opt?.label ?? "",
                                    }));
                                  }}
                                />
                                {!hostelsLoading && !hostelsError && hostelOptions.length === 0 && (
                                  <small className="text-muted d-block mt-1">No hostels found. Add hostels from Management → Hostel.</small>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Room No</label>
                            {hostelRoomsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading rooms...
                              </div>
                            ) : hostelRoomsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {hostelRoomsError}
                              </div>
                            ) : (
                              <>
                                <CommonSelect
                                  className="select"
                                  options={
                                    formData.hostel_room_id && !roomOptions.find(o => o.value === formData.hostel_room_id)
                                      ? [{ value: formData.hostel_room_id, label: formData.hostel_room_number || formData.hostel_room_id }, ...roomOptions]
                                      : roomOptions.length > 0 ? roomOptions : [{ value: "", label: "No rooms" }]
                                  }
                                  value={formData.hostel_room_id || null}
                                  onChange={(v) => {
                                    const opt = roomOptions.find(o => o.value === v);
                                    setFormData(prev => ({
                                      ...prev,
                                      hostel_room_id: v || null,
                                      hostel_room_number: opt?.label ?? "",
                                    }));
                                  }}
                                />
                                {!hostelRoomsLoading && !hostelRoomsError && roomOptions.length === 0 && (
                                  <small className="text-muted d-block mt-1">No rooms found. Add rooms from Management → Hostel.</small>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Hostel Information */}
                  {/* Documents */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-file fs-16" />
                        </span>
                        <h4 className="text-dark">Documents</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-6">
                          <div className="mb-3">
                            <label className="form-label mb-1">Medical condition (PDF)</label>
                            <p className="text-muted small mb-2">Max 4MB. PDF only.</p>
                            <input
                              ref={medicalDocInputRef}
                              type="file"
                              accept="application/pdf,.pdf"
                              className="d-none"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) void uploadStudentDoc(f, "medical_document_path", "medical", setMedicalDocUploadStatus);
                              }}
                            />
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={medicalDocUploadStatus === "uploading"}
                                onClick={() => medicalDocInputRef.current?.click()}
                              >
                                <i className="ti ti-upload me-1" />
                                {formData.medical_document_path ? "Replace PDF" : "Upload PDF"}
                              </button>
                              {formData.medical_document_path && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => void openStudentDocument(formData.medical_document_path)}
                                >
                                  <i className="ti ti-external-link me-1" />
                                  View medical document
                                </button>
                              )}
                            </div>
                            {formData.medical_document_path && (
                              <p className="small text-muted mb-1">
                                Uploaded:{" "}
                                <span className="text-dark">{fileNameFromStoragePath(formData.medical_document_path)}</span>
                              </p>
                            )}
                            <p className="small mb-0">
                              {medicalDocUploadStatus === "uploading" && (
                                <span className="text-primary">
                                  <i className="ti ti-loader ti-spin me-1" />
                                  Uploading…
                                </span>
                              )}
                              {medicalDocUploadStatus === "success" && (
                                <span className="text-success">
                                  <i className="ti ti-check me-1" />
                                  Uploaded
                                </span>
                              )}
                              {medicalDocUploadStatus === "error" && (
                                <span className="text-danger">
                                  <i className="ti ti-x me-1" />
                                  Failed
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="col-lg-6">
                          <div className="mb-3">
                            <label className="form-label mb-1">Transfer certificate (PDF)</label>
                            <p className="text-muted small mb-2">Max 4MB. PDF only.</p>
                            <input
                              ref={tcDocInputRef}
                              type="file"
                              accept="application/pdf,.pdf"
                              className="d-none"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                if (f) void uploadStudentDoc(f, "transfer_certificate_path", "transfer_certificate", setTcDocUploadStatus);
                              }}
                            />
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={tcDocUploadStatus === "uploading"}
                                onClick={() => tcDocInputRef.current?.click()}
                              >
                                <i className="ti ti-upload me-1" />
                                {formData.transfer_certificate_path ? "Replace PDF" : "Upload PDF"}
                              </button>
                              {formData.transfer_certificate_path && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => void openStudentDocument(formData.transfer_certificate_path)}
                                >
                                  <i className="ti ti-external-link me-1" />
                                  View transfer certificate
                                </button>
                              )}
                            </div>
                            {formData.transfer_certificate_path && (
                              <p className="small text-muted mb-1">
                                Uploaded:{" "}
                                <span className="text-dark">{fileNameFromStoragePath(formData.transfer_certificate_path)}</span>
                              </p>
                            )}
                            <p className="small mb-0">
                              {tcDocUploadStatus === "uploading" && (
                                <span className="text-primary">
                                  <i className="ti ti-loader ti-spin me-1" />
                                  Uploading…
                                </span>
                              )}
                              {tcDocUploadStatus === "success" && (
                                <span className="text-success">
                                  <i className="ti ti-check me-1" />
                                  Uploaded
                                </span>
                              )}
                              {tcDocUploadStatus === "error" && (
                                <span className="text-danger">
                                  <i className="ti ti-x me-1" />
                                  Failed
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Documents */}
                  {/* Medical History */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-medical-cross fs-16" />
                        </span>
                        <h4 className="text-dark">Medical History</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="mb-2">
                            <label className="form-label">
                              Medical Condition
                            </label>
                            <div className="d-flex align-items-center flex-wrap">
                              <label className="form-label text-dark fw-normal me-2">
                                Medical Condition of a Student
                              </label>
                              <div className="form-check me-3 mb-2">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="condition"
                                  id="good"
                                  checked={formData.medical_condition === 'Good'}
                                  onChange={() => handleInputChange('medical_condition', 'Good')}
                                />
                                <label
                                  className="form-check-label"
                                  htmlFor="good"
                                >
                                  Good
                                </label>
                              </div>
                              <div className="form-check me-3 mb-2">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="condition"
                                  id="bad"
                                  checked={formData.medical_condition === 'Bad'}
                                  onChange={() => handleInputChange('medical_condition', 'Bad')}
                                />
                                <label className="form-check-label" htmlFor="bad">
                                  Bad
                                </label>
                              </div>
                              <div className="form-check mb-2">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  name="condition"
                                  id="others"
                                  checked={formData.medical_condition === 'Others'}
                                  onChange={() => handleInputChange('medical_condition', 'Others')}
                                />
                                <label
                                  className="form-check-label"
                                  htmlFor="others"
                                >
                                  Others
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Allergies</label>

                          <TagInput
                            initialTags={owner1}
                            onTagsChange={handleTagsChange3}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Medications</label>
                          <TagInput
                            initialTags={owner2}
                            onTagsChange={handleTagsChange4}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Medical History */}
                  {/* Previous School details */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-building fs-16" />
                        </span>
                        <h4 className="text-dark">Previous School Details</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">School Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.previous_school || ''}
                              onChange={(e) => handleInputChange('previous_school', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Address</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.previous_school_address || ''}
                              onChange={(e) => handleInputChange('previous_school_address', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Previous School details */}
                  {/* Other Details */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-building-bank fs-16" />
                        </span>
                        <h4 className="text-dark">Other Details</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-5">
                          <div className="mb-3">
                            <label className="form-label">Bank Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.bank_name || ''}
                              onChange={(e) => handleInputChange('bank_name', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-2">
                          <div className="mb-3">
                            <label className="form-label">Branch</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.branch || ''}
                              onChange={(e) => handleInputChange('branch', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-5">
                          <div className="mb-3">
                            <label className="form-label">IFSC Number</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.ifsc || ''}
                              onChange={(e) => handleInputChange('ifsc', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">
                              Other Information
                            </label>
                            <textarea
                              className="form-control"
                              rows={3}
                              value={formData.other_information || ''}
                              onChange={(e) => handleInputChange('other_information', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Other Details */}
                  <div className="text-end">
                    <Link
                      to={id ? `${routes.studentList}` : routes.studentList}
                      state={id ? { studentId: id } : undefined}
                      className="btn btn-light me-3"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={
                        isSubmitting ||
                        admissionUniqueness.checking ||
                        admissionUniqueness.exists === true
                      }
                    >
                      {isSubmitting ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Student' : 'Add Student')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default AddStudent;





