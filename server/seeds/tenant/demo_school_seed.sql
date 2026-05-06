/*
=============================================================================
EXTREME EXHAUSTIVE DEMO SEEDER - 96 TABLES
=============================================================================
This script provides sample data for every single table in the schema 
to ensure a 100% complete demonstration of the system.
=============================================================================
*/

DO $$
DECLARE
    -- ID Capture Variables
    v_year_id INT;
    v_admin_role_id INT; v_teacher_role_id INT; v_student_role_id INT; v_parent_role_id INT;
    v_teacher_1_user_id INT; v_teacher_2_user_id INT; v_student_1_user_id INT; v_guardian_1_user_id INT;
    v_staff_1_id INT; v_staff_2_id INT;
    v_student_1_id INT; v_guardian_1_id INT;
    v_dept_acad_id INT; v_dept_admin_id INT;
    v_desig_teacher_id INT; v_desig_principal_id INT;
    v_class_10_id INT; v_class_12_id INT;
    v_sec_a_id INT; v_sec_b_id INT;
    v_sub_math_id INT; v_sub_sci_id INT;
    v_cs_10a_id INT; v_cs_12b_id INT;
    v_csub_math_id INT; v_csub_sci_id INT;
    v_lifecycle_1_id INT;
    v_fee_type_tuition INT; v_fee_id INT; v_fee_installment_id INT;
    v_route_id INT; v_point_id INT; v_vehicle_id INT;
    v_lib_cat_id INT; v_book_id INT; v_book_copy_id INT;
    v_room_id INT; v_slot_id INT;
    v_exam_id INT; v_exam_sched_id INT;
    v_leave_type_id INT;
    v_house_id INT; v_religion_id INT; v_cast_id INT; v_mt_id INT;
    v_sal_comp_basic INT; v_sal_comp_tax INT;
    v_sal_assign_id INT;
    v_fees_paid_id INT;
    v_hw_id INT;
    v_enquiry_id INT;
    v_event_id INT;
    v_folder_id INT;
    v_acc_cat_id INT;
    v_doc_type_id INT;
BEGIN

    -- [1] SYSTEM & ACADEMIC YEAR
    INSERT INTO public.academic_years (year_name, start_date, end_date, is_current) 
    VALUES ('2024-25', '2024-04-01', '2025-03-31', true) RETURNING id INTO v_year_id;

    -- [2] DEMOGRAPHIC LOOKUPS
    INSERT INTO public.religions (religion_name) VALUES ('Hinduism') RETURNING id INTO v_religion_id;
    INSERT INTO public.casts (cast_name, religion_id) VALUES ('General', v_religion_id) RETURNING id INTO v_cast_id;
    INSERT INTO public.blood_groups (blood_group_name) VALUES ('B+') ON CONFLICT DO NOTHING;
    INSERT INTO public.mother_tongues (language_name) VALUES ('English') RETURNING id INTO v_mt_id;
    INSERT INTO public.houses (house_name) VALUES ('Horizon Red') RETURNING id INTO v_house_id;
    INSERT INTO public.languages (language_name, language_code, is_compulsory) VALUES ('English', 'EN', true);

    -- [3] ROLES & PERMISSIONS
    INSERT INTO public.user_roles (role_name) VALUES ('Admin') RETURNING id INTO v_admin_role_id;
    INSERT INTO public.user_roles (role_name) VALUES ('Teacher') RETURNING id INTO v_teacher_role_id;
    INSERT INTO public.user_roles (role_name) VALUES ('Student') RETURNING id INTO v_student_role_id;
    INSERT INTO public.user_roles (role_name) VALUES ('Parent') RETURNING id INTO v_parent_role_id;

    -- [3.1] SCHOOL ADMIN USER
    INSERT INTO public.users (username, password_hash, role_id, first_name, last_name, gender) 
    VALUES ('schooladmin', '$2a$10$P8mgayf0xJP/tSa4mpl12elRzDbDTY1chWlsvU4xHGL1gdQZnFSy.', v_admin_role_id, 'School', 'Admin', 'male');

    -- [4] ACADEMIC STRUCTURE
    INSERT INTO public.classes (class_name, class_code) VALUES ('Grade 10', 'G10') RETURNING id INTO v_class_10_id;
    INSERT INTO public.classes (class_name, class_code) VALUES ('Grade 12', 'G12') RETURNING id INTO v_class_12_id;
    INSERT INTO public.sections (section_name) VALUES ('Section A') RETURNING id INTO v_sec_a_id;
    INSERT INTO public.sections (section_name) VALUES ('Section B') RETURNING id INTO v_sec_b_id;
    INSERT INTO public.subjects (subject_name, subject_code) VALUES ('Mathematics', 'MATH01') RETURNING id INTO v_sub_math_id;
    INSERT INTO public.subjects (subject_name, subject_code) VALUES ('General Science', 'SCI01') RETURNING id INTO v_sub_sci_id;

    -- [5] CLASS-SECTION-SUBJECT ANCHORS
    INSERT INTO public.class_sections (class_id, section_id, academic_year_id, room_number) 
    VALUES (v_class_10_id, v_sec_a_id, v_year_id, 'Room 101') RETURNING id INTO v_cs_10a_id;
    INSERT INTO public.class_sections (class_id, section_id, academic_year_id, room_number) 
    VALUES (v_class_12_id, v_sec_b_id, v_year_id, 'Room 202') RETURNING id INTO v_cs_12b_id;
    INSERT INTO public.class_subjects (class_id, subject_id, academic_year_id) 
    VALUES (v_class_10_id, v_sub_math_id, v_year_id) RETURNING id INTO v_csub_math_id;
    INSERT INTO public.class_subjects (class_id, subject_id, academic_year_id) 
    VALUES (v_class_10_id, v_sub_sci_id, v_year_id) RETURNING id INTO v_csub_sci_id;

    -- [6] HR & STAFF
    INSERT INTO public.departments (department_name) VALUES ('Academic') RETURNING id INTO v_dept_acad_id;
    INSERT INTO public.designations (designation_name, department_id) VALUES ('Senior Teacher', v_dept_acad_id) RETURNING id INTO v_desig_teacher_id;

    INSERT INTO public.users (username, password_hash, role_id, first_name, last_name, gender) 
    VALUES ('teacher_john', 'hash', v_teacher_role_id, 'John', 'Doe', 'male') RETURNING id INTO v_teacher_1_user_id;
    INSERT INTO public.users (username, password_hash, role_id, first_name, last_name, gender) 
    VALUES ('teacher_sarah', 'hash', v_teacher_role_id, 'Sarah', 'Smith', 'female') RETURNING id INTO v_teacher_2_user_id;

    INSERT INTO public.staff (user_id, employee_code, designation_id, department_id, joining_date) 
    VALUES (v_teacher_1_user_id, 'EMP001', v_desig_teacher_id, v_dept_acad_id, '2023-01-01') RETURNING id INTO v_staff_1_id;
    INSERT INTO public.staff (user_id, employee_code, designation_id, department_id, joining_date) 
    VALUES (v_teacher_2_user_id, 'EMP002', v_desig_teacher_id, v_dept_acad_id, '2023-01-01') RETURNING id INTO v_staff_2_id;

    -- [7] PAYROLL MASTERS
    INSERT INTO public.salary_components (component_name, type) VALUES ('Basic Salary', 'allowance') RETURNING id INTO v_sal_comp_basic;
    INSERT INTO public.salary_components (component_name, type) VALUES ('PF Tax', 'deduction') RETURNING id INTO v_sal_comp_tax;
    INSERT INTO public.staff_salary_assignments (staff_id, basic_salary, valid_period) 
    VALUES (v_staff_1_id, 45000, daterange('2024-04-01', '2025-03-31')) RETURNING id INTO v_sal_assign_id;
    INSERT INTO public.staff_salary_component_values (salary_assignment_id, component_id, amount) 
    VALUES (v_sal_assign_id, v_sal_comp_basic, 45000), (v_sal_assign_id, v_sal_comp_tax, 2000);
    INSERT INTO public.staff_payslips (staff_id, salary_assignment_id, salary_period, basic_salary_snapshot, gross_amount, net_amount, status) 
    VALUES (v_staff_1_id, v_sal_assign_id, daterange('2024-04-01', '2024-04-30'), 45000, 45000, 43000, 'Paid');

    -- [8] STAFF ASSIGNMENTS
    INSERT INTO public.class_teachers (class_id, class_section_id, staff_id, academic_year_id, role) 
    VALUES (v_class_10_id, v_cs_10a_id, v_staff_1_id, v_year_id, 'primary');
    INSERT INTO public.subject_teacher_assignments (class_id, class_section_id, class_subject_id, staff_id, academic_year_id) 
    VALUES (v_class_10_id, v_cs_10a_id, v_csub_math_id, v_staff_1_id, v_year_id);

    -- [9] STUDENTS & GUARDIANS
    INSERT INTO public.users (username, password_hash, role_id, first_name, last_name, gender) 
    VALUES ('guardian_mark', 'hash', v_parent_role_id, 'Mark', 'Evans', 'male') RETURNING id INTO v_guardian_1_user_id;
    INSERT INTO public.guardians (user_id) VALUES (v_guardian_1_user_id) RETURNING id INTO v_guardian_1_id;
    INSERT INTO public.users (username, password_hash, role_id, first_name, last_name, gender) 
    VALUES ('student_ethan', 'hash', v_student_role_id, 'Ethan', 'Evans', 'male') RETURNING id INTO v_student_1_user_id;
    INSERT INTO public.students (user_id, admission_number, gr_number, pen_number, aadhar_no, house_id, religion_id, cast_id, mother_tongue_id) 
    VALUES (v_student_1_user_id, 'ADM202401', 'GR1001', 'PEN7788', '123456789012', v_house_id, v_religion_id, v_cast_id, v_mt_id) RETURNING id INTO v_student_1_id;
    INSERT INTO public.student_guardian_links (student_id, guardian_id, relation, is_primary_contact) 
    VALUES (v_student_1_id, v_guardian_1_id, 'Father', true);

    -- [10] STUDENT LIFECYCLE & RECORDS
    INSERT INTO public.student_lifecycle_ledger (student_id, event_type, to_academic_year_id, to_class_id, to_section_id) 
    VALUES (v_student_1_id, 'ADMISSION', v_year_id, v_class_10_id, v_sec_a_id) RETURNING id INTO v_lifecycle_1_id;
    INSERT INTO public.student_medical_records (student_id, record_type, condition_name) VALUES (v_student_1_id, 'Allergy', 'Peanuts');
    INSERT INTO public.student_siblings (student_id, name) VALUES (v_student_1_id, 'Jessica Evans');
    INSERT INTO public.student_subject_choices (student_id, class_id, class_subject_id, academic_year_id) 
    VALUES (v_student_1_id, v_class_10_id, v_csub_sci_id, v_year_id);

    -- [11] ATTENDANCE & LEAVES
    INSERT INTO public.student_attendance (student_id, academic_year_id, class_id, class_section_id, lifecycle_id, attendance_date, status) 
    VALUES (v_student_1_id, v_year_id, v_class_10_id, v_cs_10a_id, v_lifecycle_1_id, '2024-04-10', 'Present');
    INSERT INTO public.staff_attendance (staff_id, academic_year_id, salary_assignment_id, attendance_date, status) 
    VALUES (v_staff_1_id, v_year_id, v_sal_assign_id, '2024-04-10', 'Present');
    INSERT INTO public.leave_types (leave_type, max_days, applicable_for) VALUES ('Casual Leave', 12, 'staff') RETURNING id INTO v_leave_type_id;
    INSERT INTO public.leave_applications (applicant_staff_id, leave_type_id, valid_period, status) 
    VALUES (v_staff_1_id, v_leave_type_id, daterange('2024-05-01', '2024-05-03'), 'Approved');
    INSERT INTO public.school_holidays (academic_year_id, holiday_name, holiday_period) 
    VALUES (v_year_id, 'Summer Break', daterange('2024-05-15', '2024-06-15'));

    -- [12] EXAMS & GRADES
    INSERT INTO public.exam_grades (grade_name, min_percentage, max_percentage) VALUES ('A', 80, 100);
    INSERT INTO public.exams (exam_name, exam_type, academic_year_id) VALUES ('Unit Test 1', 'unit_test', v_year_id) RETURNING id INTO v_exam_id;
    INSERT INTO public.exam_classes (exam_id, class_id) VALUES (v_exam_id, v_class_10_id);
    INSERT INTO public.exam_schedules (exam_id, academic_year_id, class_id, class_subject_id, exam_date, max_marks, passing_marks) 
    VALUES (v_exam_id, v_year_id, v_class_10_id, v_csub_math_id, '2024-06-15', 50, 17.5) RETURNING id INTO v_exam_sched_id;
    INSERT INTO public.exam_results (exam_schedule_id, student_id, marks_obtained) VALUES (v_exam_sched_id, v_student_1_id, 42);

    -- [13] INFRASTRUCTURE & TIMETABLE
    INSERT INTO public.class_rooms (room_number) VALUES ('101-A');
    INSERT INTO public.timetable_time_slots (slot_name, start_time, end_time) VALUES ('Period 1', '08:00:00', '08:45:00') RETURNING id INTO v_slot_id;
    INSERT INTO public.class_schedules (academic_year_id, class_id, class_section_id, class_subject_id, teacher_id, class_room_id, time_slot_id, day_of_week, valid_from) 
    VALUES (v_year_id, v_class_10_id, v_cs_10a_id, v_csub_math_id, v_staff_1_id, 1, v_slot_id, 1, '2024-04-01');

    -- [14] FINANCIALS & ACCOUNTS
    INSERT INTO public.fees_types (name, code) VALUES ('Tuition Fee', 'TUI') RETURNING id INTO v_fee_type_tuition;
    INSERT INTO public.fees (class_id, academic_year_id, due_date) VALUES (v_class_10_id, v_year_id, '2024-05-01') RETURNING id INTO v_fee_id;
    INSERT INTO public.fees_class_types (fee_id, class_id, academic_year_id, fee_type_id, amount) 
    VALUES (v_fee_id, v_class_10_id, v_year_id, v_fee_type_tuition, 5000);
    INSERT INTO public.fees_installments (fee_id, class_id, academic_year_id, installment_name, due_date, amount) 
    VALUES (v_fee_id, v_class_10_id, v_year_id, 'Term 1', '2024-05-01', 2500) RETURNING id INTO v_fee_installment_id;
    INSERT INTO public.fees_paids (student_id, academic_year_id, class_id, total_payable, total_paid) 
    VALUES (v_student_1_id, v_year_id, v_class_10_id, 5000, 2500) RETURNING id INTO v_fees_paid_id;
    INSERT INTO public.compulsory_fees (student_id, academic_year_id, fee_id, fee_installment_id, amount_paid) 
    VALUES (v_student_1_id, v_year_id, v_fee_id, v_fee_installment_id, 2500);
    INSERT INTO public.fees_advance (student_id, academic_year_id, amount) VALUES (v_student_1_id, v_year_id, 500);
    INSERT INTO public.account_categories (category_name, category_type) VALUES ('School Fees', 'Income') RETURNING id INTO v_acc_cat_id;
    INSERT INTO public.financial_ledger (academic_year_id, category_id, title, amount, transaction_type) 
    VALUES (v_year_id, v_acc_cat_id, 'Quarterly Fee Collection', 250000, 'Income');
    INSERT INTO public.accounts_invoices (academic_year_id, invoice_number, invoice_date, due_date, amount) 
    VALUES (v_year_id, 'INV-2024-001', '2024-04-05', '2024-04-20', 15000);

    -- [15] LOGISTICS & TRANSPORT
    INSERT INTO public.routes (route_name, route_code) VALUES ('Downtown North', 'R01') RETURNING id INTO v_route_id;
    INSERT INTO public.pickup_points (route_id, point_name, sequence_order) VALUES (v_route_id, 'Main Square', 1) RETURNING id INTO v_point_id;
    INSERT INTO public.transport_vehicles (vehicle_number, vehicle_type) VALUES ('MH-01-AB-1234', 'Bus') RETURNING id INTO v_vehicle_id;
    INSERT INTO public.vehicle_route_assignments (academic_year_id, route_id, vehicle_id, staff_id, valid_period) 
    VALUES (v_year_id, v_route_id, v_vehicle_id, v_staff_1_id, daterange('2024-04-01', '2025-03-31'));
    INSERT INTO public.transport_fee_master (academic_year_id, pickup_point_id, plan_name, student_amount) 
    VALUES (v_year_id, v_point_id, 'North Monthly', 1200);
    INSERT INTO public.transport_allocations (academic_year_id, student_id, student_lifecycle_id, route_id, pickup_point_id, vehicle_id) 
    VALUES (v_year_id, v_student_1_id, v_lifecycle_1_id, v_route_id, v_point_id, v_vehicle_id);
    INSERT INTO public.student_transport_assignments (student_id, academic_year_id, route_id, pickup_point_id) 
    VALUES (v_student_1_id, v_year_id, v_route_id, v_point_id);
    INSERT INTO public.student_hostel_assignments (student_id, academic_year_id, bed_number) 
    VALUES (v_student_1_id, v_year_id, 'B101');

    -- [16] LIBRARY SYSTEM
    INSERT INTO public.library_categories (category_name) VALUES ('Academic') RETURNING id INTO v_lib_cat_id;
    INSERT INTO public.library_books (category_id, book_title, author, isbn) VALUES (v_lib_cat_id, 'Calculus Vol 1', 'Newton', '978-01') RETURNING id INTO v_book_id;
    INSERT INTO public.library_book_copies (book_id, accession_number) VALUES (v_book_id, 'LIB-001') RETURNING id INTO v_book_copy_id;
    INSERT INTO public.library_policies (policy_name, issue_duration_days) VALUES ('Student Standard', 14);
    INSERT INTO public.library_members (card_number, student_id, academic_year_id) VALUES ('LM001', v_student_1_id, v_year_id);
    INSERT INTO public.library_book_issues (academic_year_id, book_copy_id, student_id, student_lifecycle_id, issue_date, due_date) 
    VALUES (v_year_id, v_book_copy_id, v_student_1_id, v_lifecycle_1_id, '2024-04-10', '2024-04-24');
    INSERT INTO public.library_book_reservations (academic_year_id, book_id, student_id, student_lifecycle_id) 
    VALUES (v_year_id, v_book_id, v_student_1_id, v_lifecycle_1_id);

    -- [17] PRODUCTION (HOMEWORK & ENQUIRY)
    INSERT INTO public.homework (academic_year_id, class_id, class_section_id, class_subject_id, teacher_id, teacher_assignment_id, title, assign_date, due_date) 
    SELECT v_year_id, v_class_10_id, v_cs_10a_id, v_csub_math_id, v_staff_1_id, id, 'Math Homework 1', '2024-04-01', '2024-04-15' 
    FROM public.subject_teacher_assignments LIMIT 1 RETURNING id INTO v_hw_id;
    INSERT INTO public.homework_submissions (homework_id, student_id, student_lifecycle_id, academic_year_id, class_id, submission_text) 
    VALUES (v_hw_id, v_student_1_id, v_lifecycle_1_id, v_year_id, v_class_10_id, 'Solved all problems.');
    INSERT INTO public.admission_enquiries (academic_year_id, student_name, mobile_number) 
    VALUES (v_year_id, 'Alice Green', '9876543210') RETURNING id INTO v_enquiry_id;
    INSERT INTO public.enquiry_follow_ups (enquiry_id, remarks) VALUES (v_enquiry_id, 'Parent called for fee details.');

    -- [18] COMMUNICATION & ASSETS
    INSERT INTO public.school_profile (school_name, email) VALUES ('Horizon Public School', 'info@horizon.edu');
    INSERT INTO public.notice_board (title, content) VALUES ('Exams Postponed', 'The unit test will now start from June 15.');
    INSERT INTO public.events (title, start_date) VALUES ('Sports Day', '2024-11-20') RETURNING id INTO v_event_id;
    INSERT INTO public.event_attachments (event_id, file_url, file_name) VALUES (v_event_id, 'http://files.com/rules.pdf', 'Rules.pdf');
    INSERT INTO public.chats (user_id, recipient_id, message) VALUES (v_teacher_1_user_id, v_teacher_2_user_id, 'Meeting at 10 AM?');
    INSERT INTO public.chat_settings (user_id, recipient_id) VALUES (v_teacher_1_user_id, v_teacher_2_user_id);
    INSERT INTO public.emails (user_id, subject, body) VALUES (v_teacher_1_user_id, 'Lesson Plan', 'Please find the plan attached.');
    INSERT INTO public.notes (user_id, title, content) VALUES (v_teacher_1_user_id, 'Meeting Agenda', 'Discuss grades.');
    INSERT INTO public.todos (user_id, title) VALUES (v_teacher_1_user_id, 'Check Math Homework');
    INSERT INTO public.calls (user_id, call_type) VALUES (v_teacher_1_user_id, 'Audio');

    -- [19] PRIVACY & DOCUMENTS
    INSERT INTO public.blocked_users (user_id, blocked_user_id) VALUES (v_teacher_1_user_id, v_student_1_user_id);
    INSERT INTO public.account_delete_requests (user_id, reason) VALUES (v_student_1_user_id, 'Transferring to another city.');
    INSERT INTO public.document_types (document_type, applicable_for) VALUES ('Aadhar Card', 'both') RETURNING id INTO v_doc_type_id;
    INSERT INTO public.documents (document_type_id, student_id, document_name, file_path) VALUES (v_doc_type_id, v_student_1_id, 'My Aadhar', '/docs/aadhar.jpg');
    INSERT INTO public.files (user_id, name, is_folder) VALUES (v_teacher_1_user_id, 'Curriculum', true) RETURNING id INTO v_folder_id;
    INSERT INTO public.files (user_id, name, parent_folder_id, file_url) VALUES (v_teacher_1_user_id, 'Math_Notes.pdf', v_folder_id, 'http://cdn/notes.pdf');
    INSERT INTO public.calendar_events (user_id, title, start_date) VALUES (v_teacher_1_user_id, 'HOD Meeting', '2024-04-12 10:00:00');
    INSERT INTO public.reports (user_id, reported_user_id, reason) VALUES (v_teacher_1_user_id, v_student_1_user_id, 'Repeated late submission.');
    INSERT INTO public.settings (setting_key, setting_value) VALUES ('academic_year_lock', 'false');
    INSERT INTO public.migration_history (migration_name, batch) VALUES ('002_demo_data_injection', 2);

END $$;
