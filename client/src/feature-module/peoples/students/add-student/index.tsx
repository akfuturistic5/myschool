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

/** Email + phone must appear together for app login (matches server create/update student). */
const contactPairValid = (email: string, phone: string) => {
  const e = (email || "").trim();
  const p = (phone || "").trim();
  if (!e && !p) return true;
  return Boolean(e && p);
};

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
    mother_name: string;
    mother_email: string;
    mother_phone: string;
    mother_occupation: string;
    mother_image_url: string;
    // Guardian
    guardian_first_name: string;
    guardian_last_name: string;
    guardian_relation: string;
    guardian_phone: string;
    guardian_email: string;
    guardian_occupation: string;
    guardian_address: string;
    // Siblings (API uses sibiling_1, sibiling_2, sibiling_1_class, sibiling_2_class)
    sibiling_1: string;
    sibiling_2: string;
    sibiling_1_class: string;
    sibiling_2_class: string;
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
  }>({
    academic_year_id: null,
    unique_student_ids: '',
    pen_number: '',
    aadhaar_no: '',
    admission_number: '',
    gr_number: '',
    admission_date: null,
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
    mother_name: '',
    mother_email: '',
    mother_phone: '',
    mother_occupation: '',
    mother_image_url: '',
    guardian_first_name: '',
    guardian_last_name: '',
    guardian_relation: '',
    guardian_phone: '',
    guardian_email: '',
    guardian_occupation: '',
    guardian_address: '',
    sibiling_1: '',
    sibiling_2: '',
    sibiling_1_class: '',
    sibiling_2_class: '',
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
    other_information: ''
  });

  // Fetch academic years from API
  const { academicYears, loading: academicYearsLoading, error: academicYearsError } = useAcademicYears();

  // Fetch classes from API
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading, error: classesError } = useClasses(academicYearId);

  // Fetch sections from API
  const { sections, loading: sectionsLoading, error: sectionsError } = useSections();

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
  const { data: transportRoutes, loading: routesLoading, error: routesError } = useTransportRoutes();
  const { data: pickupPoints, loading: pickupLoading, error: pickupError } = useTransportPickupPoints();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError } = useTransportVehicles();
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
        current_address: raw.current_address || raw.address || '',
        permanent_address: raw.permanent_address || '',
        father_name: raw.father_name || '',
        father_email: raw.father_email || '',
        father_phone: raw.father_phone || '',
        father_occupation: raw.father_occupation || '',
        father_image_url: raw.father_image_url || '',
        mother_name: raw.mother_name || '',
        mother_email: raw.mother_email || '',
        mother_phone: raw.mother_phone || '',
        mother_occupation: raw.mother_occupation || '',
        mother_image_url: raw.mother_image_url || '',
        guardian_first_name: raw.guardian_first_name || '',
        guardian_last_name: raw.guardian_last_name || '',
        guardian_relation: raw.guardian_relation || '',
        guardian_phone: raw.guardian_phone || '',
        guardian_email: raw.guardian_email || '',
        guardian_occupation: raw.guardian_occupation || '',
        guardian_address: raw.guardian_address || '',
        sibiling_1: raw.sibiling_1 || '',
        sibiling_2: raw.sibiling_2 || '',
        sibiling_1_class: raw.sibiling_1_class || '',
        sibiling_2_class: raw.sibiling_2_class || '',
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
        other_information: raw.other_information || ''
      });
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
  const [newContents, setNewContents] = useState<number[]>([0]);
  // Siblings: per-row Yes/No (UI-only, controls which fields are visible)
  const [siblingInSameSchool, setSiblingInSameSchool] = useState<boolean[]>([true]);
  const [siblingRollNos, setSiblingRollNos] = useState<string[]>(['']);
  const [siblingAdmissionNos, setSiblingAdmissionNos] = useState<string[]>(['']);
  const location = useLocation();

  const addNewContent = () => {
    setNewContents(prev => {
      const nextIndex = prev.length;
      setSiblingInSameSchool(prevFlags => [...prevFlags, true]);
      setSiblingRollNos(prevRolls => [...prevRolls, '']);
      setSiblingAdmissionNos(prevAdmissions => [...prevAdmissions, '']);
      return [...prev, nextIndex];
    });
  };

  const removeContent = (index: number) => {
    setNewContents(prev => prev.filter((_, i) => i !== index));
    setSiblingInSameSchool(prev => prev.filter((_, i) => i !== index));
    setSiblingRollNos(prev => prev.filter((_, i) => i !== index));
    setSiblingAdmissionNos(prev => prev.filter((_, i) => i !== index));
  };

  // Handle form field changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!contactPairValid(formData.email, formData.phone)) {
        setSubmitError(
          "Student: enter both email and phone for login, or leave both empty."
        );
        setIsSubmitting(false);
        return;
      }
      if (!contactPairValid(formData.father_email, formData.father_phone)) {
        setSubmitError(
          "Father: enter both email and phone, or leave both empty."
        );
        setIsSubmitting(false);
        return;
      }
      if (!contactPairValid(formData.mother_email, formData.mother_phone)) {
        setSubmitError(
          "Mother: enter both email and phone, or leave both empty."
        );
        setIsSubmitting(false);
        return;
      }
      if (!contactPairValid(formData.guardian_email, formData.guardian_phone)) {
        setSubmitError(
          "Guardian: enter both email and phone, or leave both empty."
        );
        setIsSubmitting(false);
        return;
      }

      // Prepare data for submission
      const submitData = {
        ...formData,
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
        mother_name: formData.mother_name || null,
        mother_email: formData.mother_email || null,
        mother_phone: formData.mother_phone || null,
        mother_occupation: formData.mother_occupation || null,
        mother_image_url: formData.mother_image_url || null,
        // Guardian, address, siblings, transport, hostel, bank, medical
        guardian_first_name: formData.guardian_first_name || null,
        guardian_last_name: formData.guardian_last_name || null,
        guardian_relation: formData.guardian_relation || null,
        guardian_phone: formData.guardian_phone || null,
        guardian_email: formData.guardian_email || null,
        guardian_occupation: formData.guardian_occupation || null,
        guardian_address: formData.guardian_address || null,
        current_address: formData.current_address || null,
        permanent_address: formData.permanent_address || null,
        previous_school: formData.previous_school || null,
        previous_school_address: formData.previous_school_address || null,
        sibiling_1: formData.sibiling_1 || null,
        sibiling_2: formData.sibiling_2 || null,
        sibiling_1_class: formData.sibiling_1_class || null,
        sibiling_2_class: formData.sibiling_2_class || null,
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
        medications: Array.isArray(owner2) ? owner2 : (owner2 ? String(owner2).split(',').map(s => s.trim()).filter(Boolean) : [])
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
        const lines = response.warnings
          .map((w) => (w && typeof w.message === "string" ? w.message.trim() : ""))
          .filter(Boolean);
        await Swal.fire({
          icon: "warning",
          title: "Email already in use",
          text:
            lines.length > 0
              ? lines.join("\n\n")
              : "One or more emails are already registered to another account.",
          confirmButtonText: "OK",
        });
      }

      // Navigate to student list on success
      navigate(routes.studentList);
    } catch (error: any) {
      console.error('Error saving student:', error);
      setSubmitError(error.message || `Failed to ${isEdit ? 'update' : 'create'} student`);
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
      fetchedStudentIdRef.current = null; // Reset when not in edit mode
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
                <form onSubmit={handleSubmit}>
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
                            <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                              <i className="ti ti-photo-plus fs-16" />
                            </div>
                            <div className="profile-upload">
                              <div className="profile-uploader d-flex align-items-center">
                                <div className="drag-upload-btn mb-3">
                                  Upload
                                  <input
                                    type="file"
                                    className="form-control image-sign"
                                    multiple
                                  />
                                </div>
                                <Link to="#" className="btn btn-primary mb-3">
                                  Remove
                                </Link>
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
                            <label className="form-label">Academic Year</label>
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
                              <input
                                type="text"
                                className="form-control bg-light"
                                value={academicYearsList.find(y => String(y.id) === formData.academic_year_id)?.year_name ?? formData.academic_year_id ?? '—'}
                                readOnly
                                disabled
                                style={{ cursor: 'default' }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Admission Number</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.admission_number}
                              onChange={(e) => handleInputChange('admission_number', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">GR Number</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.gr_number}
                              onChange={(e) => handleInputChange('gr_number', e.target.value)}
                              required
                              placeholder="General Register number (unique in this school)"
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
                            <label className="form-label">Roll Number</label>
                            <input
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
                            <label className="form-label">First Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.first_name}
                              onChange={(e) => handleInputChange('first_name', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Last Name</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.last_name}
                              onChange={(e) => handleInputChange('last_name', e.target.value)}
                              required
                            />
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
                            <label className="form-label">
                              Primary Contact Number
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Email Address</label>
                            <input
                              type="email"
                              className="form-control"
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                            />
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
                            <label className="form-label">Unique Student ids (Saral id)</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.unique_student_ids}
                              onChange={(e) => handleInputChange('unique_student_ids', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Pen Number (UDISE id)</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.pen_number}
                              onChange={(e) => handleInputChange('pen_number', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Aadhar Number</label>
                            <input
                              type="text"
                              className="form-control"
                              value={formData.aadhaar_no}
                              onChange={(e) => handleInputChange('aadhaar_no', e.target.value)}
                            />
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
                          <div className="col-md-12">
                            <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                                <i className="ti ti-photo-plus fs-16" />
                              </div>
                              <div className="profile-upload">
                                <div className="profile-uploader d-flex align-items-center">
                                  <div className="drag-upload-btn mb-3">
                                    Upload
                                    <input
                                      type="file"
                                      className="form-control image-sign"
                                      multiple
                                    />
                                  </div>
                                  <Link to="#" className="btn btn-primary mb-3">
                                    Remove
                                  </Link>
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
                              <label className="form-label">Email</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.father_email}
                                onChange={(e) => handleInputChange('father_email', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Phone Number</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.father_phone}
                                onChange={(e) => handleInputChange('father_phone', e.target.value)}
                              />
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
                          <div className="col-md-12">
                            <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                                <i className="ti ti-photo-plus fs-16" />
                              </div>
                              <div className="profile-upload">
                                <div className="profile-uploader d-flex align-items-center">
                                  <div className="drag-upload-btn mb-3">
                                    Upload
                                    <input
                                      type="file"
                                      className="form-control image-sign"
                                      multiple
                                    />
                                  </div>
                                  <Link to="#" className="btn btn-primary mb-3">
                                    Remove
                                  </Link>
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
                              <label className="form-label">Email</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.mother_email}
                                onChange={(e) => handleInputChange('mother_email', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Phone Number</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.mother_phone}
                                onChange={(e) => handleInputChange('mother_phone', e.target.value)}
                              />
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
                              <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                                <i className="ti ti-photo-plus fs-16" />
                              </div>
                              <div className="profile-upload">
                                <div className="profile-uploader d-flex align-items-center">
                                  <div className="drag-upload-btn mb-3">
                                    Upload
                                    <input
                                      type="file"
                                      className="form-control image-sign"
                                      multiple
                                    />
                                  </div>
                                  <Link to="#" className="btn btn-primary mb-3">
                                    Remove
                                  </Link>
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
                              <label className="form-label">Phone Number</label>
                              <input
                                type="text"
                                className="form-control"
                                value={formData.guardian_phone || ''}
                                onChange={(e) => handleInputChange('guardian_phone', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-lg-3 col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Email</label>
                              <input
                                type="email"
                                className="form-control"
                                value={formData.guardian_email || ''}
                                onChange={(e) => handleInputChange('guardian_email', e.target.value)}
                              />
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
                  {/* Sibilings */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-users fs-16" />
                        </span>
                        <h4 className="text-dark">Sibilings</h4>
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
                          {newContents.map((_, index) => {
                            const useRealData = true;
                            const isSameSchool = siblingInSameSchool[index] ?? true;
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
                                          onChange={() => {
                                            setSiblingInSameSchool(prev => {
                                              const next = [...prev];
                                              next[index] = true;
                                              return next;
                                            });
                                          }}
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
                                          onChange={() => {
                                            setSiblingInSameSchool(prev => {
                                              const next = [...prev];
                                              next[index] = false;
                                              return next;
                                            });
                                          }}
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
                                          value={index === 0 ? (formData.sibiling_1 || '') : (formData.sibiling_2 || '')}
                                          onChange={(e) => handleInputChange(index === 0 ? 'sibiling_1' : 'sibiling_2', e.target.value)}
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
                                            value={(siblingRollNos[index] ?? '')}
                                            onChange={(e) => {
                                              const next = [...siblingRollNos];
                                              next[index] = e.target.value;
                                              setSiblingRollNos(next);
                                            }}
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
                                            value={(siblingAdmissionNos[index] ?? '')}
                                            onChange={(e) => {
                                              const next = [...siblingAdmissionNos];
                                              next[index] = e.target.value;
                                              setSiblingAdmissionNos(next);
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </>
                                  )}
                                  <div className="col-lg-3 col-md-6">
                                    <div className="mb-3">
                                      <div className="d-flex align-items-center">
                                        <div className="w-100">
                                          <label className="form-label">
                                            Class
                                          </label>
                                          {useRealData ? (
                                            <input
                                              type="text"
                                              className="form-control"
                                              value={index === 0 ? (formData.sibiling_1_class || '') : (formData.sibiling_2_class || '')}
                                              onChange={(e) => handleInputChange(index === 0 ? 'sibiling_1_class' : 'sibiling_2_class', e.target.value)}
                                            />
                                          ) : (
                                            <CommonSelect
                                              className="select"
                                              options={allClass}
                                              defaultValue={undefined}
                                            />
                                          )}
                                        </div>
                                        {newContents.length > 1 && (
                                          <div>
                                            <label className="form-label">
                                              &nbsp;
                                            </label>
                                            <Link
                                              to="#"
                                              className="trash-icon ms-3"
                                              onClick={() => removeContent(index)}
                                            >
                                              <i className="ti ti-trash-x" />
                                            </Link>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
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
                          <div className="mb-2">
                            <div className="mb-3">
                              <label className="form-label mb-1">
                                Medical Condition
                              </label>
                              <p>Upload image size of 4MB, Accepted Format PDF</p>
                            </div>
                            <div className="d-flex align-items-center flex-wrap">
                              <div className="btn btn-primary drag-upload-btn mb-2 me-2">
                                <i className="ti ti-file-upload me-1" />
                                Change
                                <input
                                  type="file"
                                  className="form-control image_sign"
                                  multiple
                                />
                              </div>
                              {isEdit ? (
                                <p className="mb-2">BirthCertificate.pdf</p>
                              ) : (
                                <></>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-6">
                          <div className="mb-2">
                            <div className="mb-3">
                              <label className="form-label mb-1">
                                Upload Transfer Certificate
                              </label>
                              <p>Upload image size of 4MB, Accepted Format PDF</p>
                            </div>
                            <div className="d-flex align-items-center flex-wrap">
                              <div className="btn btn-primary drag-upload-btn mb-2">
                                <i className="ti ti-file-upload me-1" />
                                Upload Document
                                <input
                                  type="file"
                                  className="form-control image_sign"
                                  multiple
                                />
                              </div>
                            </div>
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
                    <button type="button" className="btn btn-light me-3">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
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
