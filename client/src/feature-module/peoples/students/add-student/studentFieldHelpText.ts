/** Exact help copy for student form fields (tooltips). */
export const STUDENT_FIELD_HELP_TEXT = {
  admissionNumber:
    "Application/Form number. Required only during admission.",
  grNumber: "Permanent and unique student number. Important for records.",
  rollNumber: "Class-wise number. Can change yearly.",
  uniqueStudentId:
    "Government-issued student ID (Maharashtra). Optional — leave blank to auto-assign (max 50 characters).",
  penNumber:
    "National unique student ID across India. Optional — leave blank to auto-assign (max 20 characters).",
  aadhaarNumber:
    "Indian Aadhaar UID: exactly 12 digits if you enter it. Leave blank to auto-assign.",
  /** API rejects one without the other for login / parent accounts */
  studentContactPair:
    "API rule: enter both phone and email for student login, or leave both empty.",
  fatherContactPair:
    "API rule: enter both father email and phone, or leave both empty.",
  motherContactPair:
    "API rule: enter both mother email and phone, or leave both empty.",
  guardianContactPair:
    "API rule: enter both guardian email and phone, or leave both empty.",
} as const;
