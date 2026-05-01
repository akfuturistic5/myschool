-- Golden Seeder extracted from legacy data
-- Cleaned to match current schema
SET session_replication_role = 'replica';

COPY public.academic_years (id, year_name, start_date, end_date, is_current, is_active, created_at, created_by, modified_at) FROM stdin;
2	2023-24	2023-04-01	2024-03-31	f	t	2025-08-14 04:05:11.845903	\N	2025-08-14 04:05:11.845903
1	2024-25	2024-04-01	2025-03-31	f	t	2025-08-14 04:05:11.845903	\N	2025-08-14 04:05:11.845903
3	2025-26	2025-04-01	2026-03-31	t	t	2025-08-14 04:05:11.845903	\N	2025-08-14 04:05:11.845903
\.

COPY public.addresses (id, current_address, permanent_address, created_at, user_id, role_id, person_id) FROM stdin;
1	123 Green Street, City A	456 Oak Avenue, City A	2025-08-18 02:53:25.58864	9	3	1
2	789 Maple Road, City B	321 Pine Lane, City B	2025-08-18 02:53:25.58864	10	3	2
3	654 Elm Street, City C	987 Cedar Avenue, City C	2025-08-18 02:53:25.58864	11	3	3
4	111 Birch Boulevard, City D	222 Spruce Drive, City D	2025-08-18 02:53:25.58864	12	3	16
6	654 Elm Street, City C	987 Cedar Avenue, City C	2026-03-04 11:15:54.938815	11	2	3
7	111 Birch Boulevard, City D	222 Spruce Drive, City D	2026-03-08 12:43:04.015571	12	2	16
5	sector-5	sector-5	2026-02-25 16:45:40.502795	9	2	1
\.

COPY public.attendance (id, student_id, class_id, section_id, attendance_date, status, check_in_time, check_out_time, marked_by, remarks, academic_year_id, created_at, created_by, modified_at) FROM stdin;
1	1	1	1	2024-08-05	present	08:30:00	13:30:00	2	\N	1	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
2	2	2	2	2024-08-05	present	08:25:00	13:30:00	2	\N	1	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
3	3	3	3	2024-08-05	late	09:15:00	13:30:00	3	\N	1	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
\.

COPY public.blocked_users (id, user_id, blocked_user_id, created_at) FROM stdin;
\.

COPY public.calendar_events (id, user_id, title, description, start_date, end_date, event_color, is_all_day, location, created_at, updated_at) FROM stdin;
1	11	Team Meeting	Discuss project progress	2026-02-19 17:15:42.392318	2026-02-19 18:15:42.392318	bg-primary	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	School Event	Annual day celebration	2026-02-23 17:15:42.392318	2026-02-23 17:15:42.392318	bg-success	t	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	Parent-Teacher Meeting	Discuss student progress	2026-02-25 17:15:42.392318	2026-02-25 19:15:42.392318	bg-info	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.calls (id, user_id, recipient_id, call_type, phone_number, duration, call_date, created_at) FROM stdin;
\.

COPY public.chat_settings (id, user_id, recipient_id, is_muted, muted_until, cleared_at, disappearing_seconds, created_at, updated_at) FROM stdin;
1	13	12	f	\N	2026-02-19 16:41:06.747971	\N	2026-02-19 16:41:06.747971	2026-02-19 16:41:06.747971
\.

COPY public.chats (id, user_id, recipient_id, message, is_read, is_pinned, message_type, file_url, created_at, updated_at) FROM stdin;
9	13	12	helloo	f	f	text	\N	2026-02-19 16:55:51.360018	2026-02-19 16:55:51.360018
\.

COPY public.class_rooms (id, room_no, capacity, status, description, floor, building, created_at, modified_at) FROM stdin;
2	102	40	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
3	103	60	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
4	104	50	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
5	105	40	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
6	106	50	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
7	107	40	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
8	108	40	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
9	109	40	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
10	110	50	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:04:58.256769
1	101	50	Active	\N	\N	\N	2026-02-20 16:04:58.256769	2026-02-20 16:17:56.490241
\.

COPY public.class_schedules (id, class_id, section_id, subject_id, time_slot_id, day_of_week, academic_year_id, room_number, teacher_id, is_active, created_at, created_by, modified_at) FROM stdin;
1	1	1	1	1	1	1	R101	2	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
2	2	2	2	2	1	1	R201	2	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
3	3	3	3	1	2	1	R301	3	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
\.

COPY public.class_syllabus (id, class_id, section_id, class_name, section_name, subject_group, status, description, academic_year_id, created_at, modified_at) FROM stdin;
2	2	2	LKG	B	English	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
3	3	3	UKG	C	Mathematics	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
4	2	2	LKG	B	English	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
5	1	1	Nursary	A	Play Activities	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
6	3	3	UKG	C	Mathematics	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
7	2	2	LKG	B	English	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
8	3	3	UKG	C	Mathematics	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
9	1	1	Nursary	A	Play Activities	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
10	1	1	Nursary	A	Play Activities	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-20 16:46:09.167788
1	1	1	Nursery	A	Play Activiti	Active	\N	3	2026-02-20 16:46:09.167788	2026-02-21 10:36:31.096191
\.

COPY public.classes (id, class_name, class_code, academic_year_id, class_teacher_id, max_students, class_fee, description, is_active, created_at, created_by, modified_at) FROM stdin;
3	UKG	UKG	1	3	30	20000.00	Upper Kindergarten	t	2025-08-14 04:10:59.275289	\N	2025-08-14 04:10:59.275289
1	Nursery	NUR	1	2	25	15000.00	Nursery class for 3-4 years children	t	2025-08-14 04:10:59.275289	\N	2025-08-14 04:10:59.275289
2	LKG	LKG	1	2	25	18000.00	Lower Kindergarten	t	2025-08-14 04:10:59.275289	\N	2025-08-14 04:10:59.275289
\.

COPY public.document_types (id, document_type, description, is_mandatory, applicable_for, is_active, created_at, created_by, modified_at) FROM stdin;
1	Birth Certificate	Official birth certificate	t	student	t	2025-08-14 04:32:06.439895	\N	2025-08-14 04:32:06.439895
2	Aadhar Card	Aadhar card copy	t	both	t	2025-08-14 04:32:06.439895	\N	2025-08-14 04:32:06.439895
3	Medical Certificate	Health fitness certificate	t	student	t	2025-08-14 04:32:06.439895	\N	2025-08-14 04:32:06.439895
\.

COPY public.documents (id, document_type_id, student_id, staff_id, document_name, file_path, file_size, upload_date, expiry_date, is_verified, verified_by, verified_date, remarks, is_active, created_at, created_by, modified_at) FROM stdin;
1	1	1	\N	Aarav_Birth_Certificate.pdf	/documents/students/1/birth_cert.pdf	\N	2024-03-15	\N	t	1	2024-03-16	\N	t	2025-08-14 04:32:15.362948	\N	2025-08-14 04:32:15.362948
2	2	2	\N	Sara_Aadhar_Card.pdf	/documents/students/2/aadhar.pdf	\N	2024-03-16	\N	t	1	2024-03-17	\N	t	2025-08-14 04:32:15.362948	\N	2025-08-14 04:32:15.362948
3	3	3	\N	Arjun_Medical_Certificate.pdf	/documents/students/3/medical.pdf	\N	2024-03-17	\N	t	1	2024-03-18	\N	t	2025-08-14 04:32:15.362948	\N	2025-08-14 04:32:15.362948
\.

COPY public.drivers (id, driver_name, employee_code, phone, email, license_number, license_expiry, address, emergency_contact, joining_date, salary, is_active, created_at, created_by, modified_at) FROM stdin;
2	Suresh Patil	DRV002	9876541113	suresh.driver@school.com	MH31DL789012	2025-12-20	456 Transport Nagar, Nagpur	9876541114	2021-08-10	19000.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
3	Mahesh Kumar	DRV003	9876541115	mahesh.driver@school.com	MH31DL345678	2027-03-25	789 Driver Street, Nagpur	9876541116	2023-02-01	17500.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
1	Ramesh Yadav	DRV001	9876541111	ramesh.driver@school.com	MH31DL123456	2026-05-15	123 Driver Colony, Nagpur	9876541112	2022-01-15	18000.00	t	2025-08-14 04:12:16.81416	\N	2026-02-17 16:38:38.315512
\.

COPY public.emails (id, user_id, sender_id, sender_email, recipient_email, subject, body, is_read, is_starred, is_important, folder, has_attachment, attachment_url, sent_at, created_at, updated_at) FROM stdin;
1	11	9	sender@example.com	\N	Welcome to School Management System	This is a welcome email.	f	t	f	inbox	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	9	admin@example.com	\N	Important Notice	Please review the attached document.	f	f	f	inbox	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	\N	noreply@example.com	\N	System Update	The system will be updated tonight.	t	f	f	inbox	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.events (id, title, description, start_date, end_date, event_color, is_all_day, location, event_category, event_for, target_class_ids, target_section_ids, attachment_url, created_by, created_at, updated_at) FROM stdin;
1	Parents Teacher Meet	Meeting with parents and teachers	2026-03-05 13:12:07.744468	2026-03-05 15:12:07.744468	bg-primary	f	\N	Meeting	all	\N	\N	\N	\N	2026-02-26 13:12:07.744468	2026-02-26 13:12:07.744468
2	Summer Vacation	School summer break	2026-01-27 13:12:07.744468	2026-02-06 13:12:07.744468	bg-danger	t	\N	Holidays	all	\N	\N	\N	\N	2026-02-26 13:12:07.744468	2026-02-26 13:12:07.744468
\.

COPY public.exam_results (id, exam_id, student_id, subject_id, marks_obtained, grade, remarks, is_absent, is_active, created_at, created_by, modified_at) FROM stdin;
10	1	1	1	42.00	A	Excellent performance in play activities	f	t	2025-08-14 04:33:54.287649	\N	2025-08-14 04:33:54.287649
11	2	2	2	85.00	A	Outstanding performance in English	f	t	2025-08-14 04:33:54.287649	\N	2025-08-14 04:33:54.287649
12	3	3	3	78.00	A	Good mathematical understanding	f	t	2025-08-14 04:33:54.287649	\N	2025-08-14 04:33:54.287649
13	3	16	3	66.00	B	Good mathematical understanding	f	t	2025-08-14 04:33:54.287649	\N	2025-08-14 04:33:54.287649
\.

COPY public.exams (id, exam_name, exam_type, academic_year_id, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Unit Test 1	unit_test	1	First unit test for Nursery	t	2025-08-14 04:33:24.765849	\N	2025-08-14 04:33:24.765849
2	Unit Test 1	unit_test	1	First unit test for LKG	t	2025-08-14 04:33:24.765849	\N	2025-08-14 04:33:24.765849
3	Unit Test 1	unit_test	1	First unit test for UKG	t	2025-08-14 04:33:24.765849	\N	2025-08-14 04:33:24.765849
\.

COPY public.fee_collections (id, student_id, fee_structure_id, amount_paid, payment_date, payment_method, transaction_id, receipt_number, collected_by, remarks, is_active, created_at, created_by, modified_at) FROM stdin;
3	3	3	20000.00	2024-04-03	cash	CASH001	RCP2024003	1	\N	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
4	16	2	18000.00	2026-02-23	card	\N	\N	\N	\N	t	2026-02-23 13:00:57.900155	\N	2026-02-23 13:00:57.900155
1	1	1	15000.00	2024-04-01	card	TXN2024001	RCP2024001	1	\N	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
2	2	2	18000.00	2024-04-02	card	CHQ123456	RCP2024002	1	\N	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
7	16	3	20000.00	2026-02-23	upi	reference	reference	\N	\N	t	2026-02-23 13:23:29.204972	\N	2026-02-23 13:23:29.204972
\.

COPY public.fee_structures (id, fee_name, class_id, academic_year_id, amount, due_date, fee_type, is_mandatory, installment_allowed, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Annual Tuition Fee	1	1	15000.00	2024-04-30	tuition	t	f	Annual tuition fee for Nursery	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
2	Annual Tuition Fee	2	1	18000.00	2024-04-30	tuition	t	f	Annual tuition fee for LKG	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
3	Annual Tuition Fee	3	1	20000.00	2024-04-30	tuition	t	f	Annual tuition fee for UKG	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
\.

COPY public.files (id, user_id, name, file_type, mime_type, size, file_url, parent_folder_id, is_folder, is_shared, shared_with, created_at, updated_at) FROM stdin;
1	11	Documents	folder	\N	0	\N	\N	t	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	Assignments	folder	\N	0	\N	\N	t	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	Math Assignment.pdf	file	application/pdf	1024000	\N	\N	f	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
4	11	Science Project.docx	file	application/vnd.openxmlformats-officedocument.wordprocessingml.document	2048000	\N	\N	f	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.guardians (id, student_id, guardian_type, first_name, last_name, relation, occupation, phone, email, address, office_address, annual_income, is_primary_contact, is_emergency_contact, is_active, created_at, created_by, modified_at, user_id) FROM stdin;
2	2	father	Amit	Patel	Father	Doctor	9876501113	amit.guardian@email.com	456 Dharampeth, Near Medical College, Nagpur - 440010	Government Medical College, Nagpur	1500000.00	t	t	t	2025-08-14 04:19:49.243699	\N	2025-08-14 04:19:49.243699	\N
3	3	father	Vikash	Kumar	Father	Business Owner	9876501113	vikash.guardian@email.com	789 Civil Lines, Near Metro Station, Nagpur - 440001	Kumar Electronics, Sadar	800000.00	t	t	t	2025-08-14 04:19:49.243699	\N	2026-03-04 11:15:54.938815	\N
1	1	father	Rajesh	Sharma	Father	Software Engineer	9876501113	rajesh.guardian@email.com	sector-5	TCS, Hinjewadi, Pune	1200000.00	t	t	t	2025-08-14 04:19:49.243699	\N	2026-03-08 12:53:38.981468	\N
\.

COPY public.holidays (id, holiday_name, start_date, end_date, holiday_type, description, academic_year_id, is_active, created_at, created_by, modified_at) FROM stdin;
1	Independence Day	2024-08-15	2024-08-15	national	Indian Independence Day celebration	1	t	2025-08-14 04:32:36.757777	\N	2025-08-14 04:32:36.757777
2	Diwali Vacation	2024-11-01	2024-11-05	religious	Diwali festival holidays	1	t	2025-08-14 04:32:36.757777	\N	2025-08-14 04:32:36.757777
3	Republic Day	2025-01-26	2025-01-26	national	Indian Republic Day celebration	1	t	2025-08-14 04:32:36.757777	\N	2025-08-14 04:32:36.757777
\.

COPY public.hostel_rooms (id, room_number, hostel_id, room_type_id, floor_number, max_occupancy, current_occupancy, monthly_fee, facilities, is_active, created_at, created_by, modified_at) FROM stdin;
13	101	1	2	1	2	0	6000.00	Attached bathroom, Study table, Wardrobe	t	2025-08-14 04:13:55.835545	\N	2025-08-14 04:13:55.835545
14	201	2	2	2	2	0	6000.00	Attached bathroom, Study table, Wardrobe	t	2025-08-14 04:13:55.835545	\N	2025-08-14 04:13:55.835545
15	301	3	3	3	3	0	4500.00	Common bathroom, Study table, Wardrobe	t	2025-08-14 04:13:55.835545	\N	2025-08-14 04:13:55.835545
\.

COPY public.hostels (id, hostel_name, hostel_type, warden_id, total_rooms, address, contact_number, facilities, rules, is_active, created_at, created_by, modified_at) FROM stdin;
2	Girls Hostel Block B	girls	1	40	School Campus, Block B	0712-2345679	Wi-Fi, Mess, Recreation Room, Study Hall	No outside food, Lights out at 10 PM	t	2025-08-14 04:12:56.129802	\N	2025-08-14 04:12:56.129802
3	Mixed Hostel Block C	mixed	3	30	School Campus, Block C	0712-2345680	Wi-Fi, Mess, Recreation Room	Separate floors for boys and girls	t	2025-08-14 04:12:56.129802	\N	2025-08-14 04:12:56.129802
1	Boys Hostel Block A	boys	1	50	School Campus, Block A	0712-2345678	Wi-Fi, Mess, Recreation Room, Study Hall	No outside food, Lights out at 10 PM	t	2025-08-14 04:12:56.129802	\N	2025-08-14 04:12:56.129802
\.

COPY public.houses (id, house_name, house_color, house_captain, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Red House	Red	Captain Red	Red house for competitive activities	t	2025-08-14 04:11:37.32943	\N	2025-08-14 04:11:37.32943
2	Blue House	Blue	Captain Blue	Blue house for competitive activities	t	2025-08-14 04:11:37.32943	\N	2025-08-14 04:11:37.32943
3	Green House	Green	Captain Green	Green house for competitive activities	t	2025-08-14 04:11:37.32943	\N	2025-08-14 04:11:37.32943
\.

COPY public.languages (id, language_name, language_code, is_compulsory, description, is_active, created_at, created_by, modified_at) FROM stdin;
\.

COPY public.leave_applications (id, applicant_type, student_id, staff_id, leave_type_id, start_date, end_date, total_days, reason, status, approved_by, approved_date, rejection_reason, medical_certificate_path, emergency_contact, is_active, created_at, created_by, modified_at) FROM stdin;
1	student	1	\N	1	2024-08-10	2024-08-12	3	Fever and cold, doctor advised rest	approved	1	2024-08-09	\N	\N	\N	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
2	student	2	\N	2	2024-08-15	2024-08-15	1	Family function	approved	1	2024-08-14	\N	\N	\N	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
3	staff	\N	2	1	2024-08-20	2024-08-22	3	Personal health issues	pending	\N	\N	\N	\N	\N	t	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
4	student	16	\N	3	2026-02-22	2026-02-23	2	health issue	approved	\N	\N	\N	\N	\N	t	2026-02-22 13:08:57.096244	\N	2026-02-22 13:08:57.096244
\.

COPY public.leave_types (id, leave_type, max_days, description, applicable_for, requires_medical_certificate, is_active, created_at, created_by, modified_at) FROM stdin;
1	Sick Leave	10	\N	both	f	t	2025-08-14 03:23:28.784417	\N	2025-08-14 03:23:28.784417
2	Casual Leave	5	\N	both	f	t	2025-08-14 03:23:28.784417	\N	2025-08-14 03:23:28.784417
3	Medical Leave	30	\N	both	f	t	2025-08-14 03:23:28.784417	\N	2025-08-14 03:23:28.784417
4	Emergency Leave	3	\N	both	f	t	2025-08-14 03:23:28.784417	\N	2025-08-14 03:23:28.784417
5	Study Leave	15	\N	staff	f	t	2025-08-14 03:23:28.784417	\N	2025-08-14 03:23:28.784417
\.

COPY public.library_book_issues (id, book_id, student_id, staff_id, issue_date, due_date, return_date, fine_amount, status, issued_by, returned_to, remarks, is_active, created_at, created_by, modified_at) FROM stdin;
4	1	1	\N	2024-08-01	2024-08-15	\N	0.00	issued	1	\N	\N	t	2025-08-14 04:34:54.955265	\N	2025-08-14 04:34:54.955265
5	3	2	\N	2024-08-02	2024-08-16	\N	0.00	issued	1	\N	\N	t	2025-08-14 04:34:54.955265	\N	2025-08-14 04:34:54.955265
6	2	3	\N	2024-08-05	2024-08-19	\N	0.00	returned	1	\N	\N	t	2025-08-14 04:34:54.955265	\N	2025-08-14 04:34:54.955265
\.

COPY public.library_books (id, book_title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, book_price, book_location, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	The Very Hungry Caterpillar	Eric Carle	9780399226908	Penguin Books	2018	1	5	4	250.00	Shelf A1	Popular children picture book	t	2025-08-14 04:34:45.05493	\N	2025-08-14 04:34:45.05493
2	First Encyclopedia	DK Publishing	9781465454300	DK Children	2019	2	3	3	800.00	Shelf R1	Reference book for young learners	t	2025-08-14 04:34:45.05493	\N	2025-08-14 04:34:45.05493
3	Goodnight Moon	Margaret Wise Brown	9780064430173	Harper Collins	2017	3	3	2	200.00	Shelf A2	Classic bedtime story	t	2025-08-14 04:34:45.05493	\N	2025-08-14 04:34:45.05493
\.

COPY public.library_categories (id, category_name, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Fiction	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
2	Non-Fiction	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
3	Academic	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
4	Children Books	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
5	Reference	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
6	Magazines	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
\.

COPY public.medical_conditions (id, condition_name, description, severity_level, requires_medication, is_active, created_at, created_by, modified_at) FROM stdin;
1	Good	Healthy	low	f	t	2025-08-14 04:30:06.242301	1	2025-08-14 04:30:06.242301
2	Bad	Not healthy	medium	t	t	2025-08-14 04:30:57.930702	1	2025-08-14 04:30:57.930702
3	Other	Other	critical	t	t	2025-08-14 04:31:45.918016	1	2025-08-14 04:31:45.918016
\.

COPY public.notes (id, user_id, title, content, tag, priority, is_important, is_deleted, created_at, updated_at) FROM stdin;
1	11	Class Notes - Math	Today we learned about algebra and quadratic equations.	\N	medium	f	f	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	Important Reminders	Remember to bring lab coat tomorrow. Submit assignment by Friday.	pending	high	t	f	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	Study Plan	Study chapters 1-5 for the upcoming test.	inprogress	medium	f	f	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.notice_board (id, title, content, created_at, created_by, modified_at, message_to) FROM stdin;
1	Classes Preparation	Please ensure all class materials are ready for the new session. Teachers are requested to submit lesson plans by end of week.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
2	Fees Reminder	Kindly pay the pending fees before the due date to avoid late charges. Contact accounts office for any queries.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
3	Parents Teacher Meeting	PTM scheduled for this Saturday. All parents are requested to attend. Timings: 10:00 AM - 1:00 PM.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
4	New Academic Session For Admission (2024-25)	Admission for the new academic session is now open. Submit applications before the deadline.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
5	Staff Meeting	All staff meeting on Friday at 3:00 PM in the conference room. Attendance is mandatory.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
6	World Environment Day Program	Join us for World Environment Day celebration. Plantation drive and awareness programs planned.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
7	New Syllabus Instructions	Updated syllabus for all classes is available. Please review and align your teaching plans accordingly.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
8	Exam Preparation Notification	Final exams begin next month. Students are advised to complete revision and submit pending assignments.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
9	Online Classes Preparation	Technical setup for hybrid learning is complete. Teachers should familiarize themselves with the platform.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
10	Exam Time Table Release	Exam time table has been published. Students can collect hard copies from the office or check online.	2026-02-22 11:56:08.385267	\N	2026-02-22 11:56:08.385267	All
\.

COPY public.parents (id, student_id, father_name, father_email, father_phone, father_occupation, father_image_url, mother_name, mother_email, mother_phone, mother_occupation, mother_image_url, created_at, updated_at, user_id) FROM stdin;
2	2	Amit Singh	amit.parent@email.com	9898989898	Business Owner	\N	Sunita Singh	sunita.singh@email.com	+91-8765432108	Doctor	\N	2025-08-14 22:28:01.677019+00	2026-02-21 06:50:09.199602+00	\N
3	3	Vikram Patel	vikram.parent@email.com	9898989898	Bank Manager	\N	Meera Patel	meera.patel@email.com	+91-7654321097	Homemaker	\N	2025-08-14 22:28:01.677019+00	2026-03-04 05:45:54.938815+00	\N
4	16	Aamir Khan	aamir.parent@email.com	9898989898	Updated Test Job	\N	Haika Khan	haika@school.com	9898989898	test	\N	2025-08-16 23:12:14.216513+00	2026-03-08 07:20:28.302508+00	\N
1	1	Rajesh Kumar	rajesh.parent@email.com	9876501111	Software Engineer	\N	Priya Kumar	priya.kumar@email.com	+91-9876543211	School Principal	\N	2025-08-14 22:28:01.677019+00	2026-03-08 07:23:38.981468+00	\N
\.

COPY public.pickup_points (id, point_name, route_id, address, landmark, pickup_time, drop_time, distance_from_school, sequence_order, is_active, created_at, created_by, modified_at) FROM stdin;
2	Sadar Market	2	Sadar Bazaar, Nagpur	Near Main Market	07:10:00	14:20:00	12.30	1	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
3	Civil Lines Metro	3	Civil Lines Metro Station	Metro Station	07:20:00	14:10:00	8.70	1	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
1	Sitabuldi Square	1	Sitabuldi Square, Nagpur	Near GPO	07:00:00	14:30:00	15.50	1	t	2025-08-14 04:12:16.81416	\N	2026-02-17 16:20:50.785115
\.

COPY public.reports (id, user_id, reported_user_id, reason, created_at) FROM stdin;
\.

COPY public.room_types (id, room_type, description, max_occupancy, room_fee, is_active, created_at, created_by, modified_at) FROM stdin;
1	Single	Single occupancy room	1	8000.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
2	Double	Double occupancy room	2	6000.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
3	Triple	Triple occupancy room	3	4500.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
\.

COPY public.routes (id, route_name, route_code, start_point, end_point, total_distance, estimated_time, route_fee, description, is_active, created_at, created_by, modified_at) FROM stdin;
2	Route 2 - Sadar	RT002	Sadar Market	School	12.30	35	2200.00	Route covering Sadar area	t	2025-08-14 04:12:09.365493	\N	2025-08-14 04:12:09.365493
3	Route 3 - Civil Lines	RT003	Civil Lines	School	8.70	25	1800.00	Route covering Civil Lines area	t	2025-08-14 04:12:09.365493	\N	2025-08-14 04:12:09.365493
1	Route 1 - Sitabuldi	RT001	Sitabuldi Square	School	15.50	45	2500.00	Route covering Sitabuldi area	t	2025-08-14 04:12:09.365493	\N	2026-02-17 16:09:29.728471
\.

COPY public.sections (id, section_name, class_id, section_teacher_id, max_students, room_number, description, is_active, created_at, created_by, modified_at) FROM stdin;
3	C	3	3	30	R301	UKG Section A	t	2025-08-14 04:11:31.102661	\N	2025-08-14 04:11:31.102661
1	A	1	2	25	R101	Nursery Section A	t	2025-08-14 04:11:31.102661	\N	2026-02-20 12:38:48.367888
2	B	2	2	25	R201	LKG Section A	t	2025-08-14 04:11:31.102661	\N	2026-02-20 16:38:39.144937
\.

COPY public.staff (id, user_id, employee_code, first_name, last_name, gender, date_of_birth, blood_group_id, phone, email, address, emergency_contact_name, emergency_contact_phone, designation_id, department_id, joining_date, salary, qualification, experience_years, photo_url, is_active, created_at, created_by, modified_at) FROM stdin;
3	16	EMP003	Anil	Patil	male	1990-07-10	\N	9876543214	anil.patil@school.com	789 School Lane, Nagpur	Meera Patil	9876543215	3	1	2019-07-01	42000.00	M.A, B.Ed	10	\N	t	2025-08-14 04:09:01.488329	\N	2025-08-14 04:09:01.488329
2	14	EMP002	Priya	Sharma	female	1988-03-22	\N	9876543212	priya.sharma@school.com	House No. 45, Sector 23, Gurgaon, Haryana 122017	Amit Sharma	9876543213	2	1	2021-04-01	35000.00	B.Ed, B.A	8	\N	t	2025-08-14 04:09:01.488329	\N	2026-02-25 13:12:38.642
1	15	EMP001	Rajesh	Kumar	male	1985-05-15	\N	9876543210	rajesh.kumar@school.com	123 Main Street, Nagpur	Sunita Kumar	9876543211	2	2	2020-06-01	100000.00	M.Ed, B.Ed	15	\N	t	2025-08-14 04:09:01.488329	\N	2025-08-14 04:09:01.488329
\.

COPY public.student_medical_conditions (id, student_id, medical_condition_id, diagnosed_date, medication, special_instructions, doctor_name, doctor_contact, is_active, created_at, created_by, modified_at) FROM stdin;
4	1	1	2023-06-15	Inhaler as needed	Keep inhaler always available, avoid dust	Dr. Ashok Patil	9876555001	t	2025-08-14 04:31:59.758157	\N	2025-08-14 04:31:59.758157
5	2	2	2022-12-10	Antihistamines	Avoid nuts and dairy products	Dr. Meera Shah	9876555002	t	2025-08-14 04:31:59.758157	\N	2025-08-14 04:31:59.758157
6	3	3	2021-08-20	Insulin shots	Monitor blood sugar regularly, controlled diet	Dr. Rajesh Agrawal	9876555003	t	2025-08-14 04:31:59.758157	\N	2025-08-14 04:31:59.758157
\.

COPY public.student_promotions (id, student_id, from_class_id, to_class_id, from_section_id, to_section_id, from_academic_year_id, to_academic_year_id, promotion_date, status, remarks, promoted_by, is_active, created_at, created_by, modified_at) FROM stdin;
7	1	1	2	1	2	1	2	2025-04-01	promoted	Student promoted from Nursery to LKG	1	t	2025-08-14 04:35:45.600521	\N	2025-08-14 04:35:45.600521
8	2	2	3	2	3	1	2	2025-04-01	promoted	Student promoted from LKG to UKG	1	t	2025-08-14 04:35:45.600521	\N	2025-08-14 04:35:45.600521
\.

COPY public.students (id, user_id, admission_number, roll_number, first_name, last_name, gender, date_of_birth, place_of_birth, blood_group_id, religion_id, cast_id, mother_tongue_id, nationality, phone, email, address, academic_year_id, class_id, section_id, house_id, admission_date, previous_school, photo_url, is_transport_required, route_id, pickup_point_id, is_hostel_required, hostel_room_id, is_active, created_at, created_by, modified_at, guardian_id, address_id, bank_name, branch, ifsc, known_allergies, medications, hostel_id, previous_school_address, medical_condition, other_information, vehicle_number, current_address, permanent_address, unique_student_ids, pen_number, aadhar_no, gr_number) FROM stdin;
2	10	ADM2024002	LKG001	Sara	Patel	female	2019-08-22	Nagpur	2	1	2	2	Indian	9876501112	sara.patel@parent.com	456 Dharampeth, Near Medical College, Nagpur - 440010	3	2	2	2	2024-04-01	Little Angels Play School	\N	t	2	2	t	14	t	2025-08-14 04:18:39.176346	\N	2026-02-17 15:00:23.727298	2	2	BANK OF MAHARASHTRA	AREA NO.2	BOM123	N/A	HEADACHE	3	\N	\N	\N	\N	456 Dharampeth, Near Medical College, Nagpur - 440010	456 Dharampeth, Near Medical College, Nagpur - 440010	123456	TEMP_PEN2	222222222222	GR000002
3	11	ADM2024003	UKG001	Arjun	Kumar	male	2018-12-10	Mumbai	3	1	1	3	Indian	9876501113	arjun.kumar@parent.com	654 Elm Street, City C	2	3	3	3	2024-04-01	\N	\N	f	\N	\N	f	\N	t	2025-08-14 04:18:39.176346	\N	2026-03-04 11:15:54.938815	3	3	\N	\N	\N			\N	\N	Good	\N	\N	\N	\N	1234567	TEMP_PEN3	333333333333	GR000003
16	12	12	12	Haniaa	Amir	female	2025-08-06	\N	7	2	1	3	Indian	9898989898	hania@gmail.com	111 Birch Boulevard, City D	3	3	1	3	2025-08-18	\N	\N	f	\N	\N	f	\N	t	2025-08-16 02:02:53.49177	\N	2026-03-08 12:50:28.302508	\N	4	\N	\N	\N			\N	\N	Good	\N	\N	111 Birch Boulevard, City D	222 Spruce Drive, City D	12345678	TEMP_PEN4	444444444433	GR000004
1	9	ADM2024001	NUR001	Aarav	Sharma	male	2020-05-15	Nagpur	5	1	1	1	Indian	9876501111	aarav.sharma@parent.com	sector-5	2	1	1	1	2024-04-01	first school	\N	f	2	2	f	15	t	2025-08-14 04:18:39.176346	\N	2026-03-08 12:53:38.981468	1	1	bank Of india	sector-5	BOI123456	allergy	yes	1	first school	Good	no	2	sector-5	sector-5	12345	TEMP_PEN1	111111111111	GR000001
\.

COPY public.subjects (id, subject_name, subject_code, class_id, teacher_id, theory_hours, practical_hours, total_marks, passing_marks, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Play Activities	PLAY_N	1	2	5	10	50	25	Play-based learning activities	t	2025-08-14 04:32:23.173633	\N	2025-08-14 04:32:23.173633
3	Mathematics	MATH_U	3	3	8	2	100	40	Basic arithmetic operations	t	2025-08-14 04:32:23.173633	\N	2026-02-17 17:57:10.801132
2	English	ENG_L	2	2	6	4	100	40	Basic English letters and words	t	2025-08-14 04:32:23.173633	\N	2026-02-20 16:38:53.675363
\.

COPY public.teacher_routines (id, teacher_id, class_schedule_id, academic_year_id, is_active, created_at, created_by, modified_at) FROM stdin;
1	2	1	1	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
2	2	2	1	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
3	3	3	1	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
\.

COPY public.teachers (id, class_id, subject_id, father_name, mother_name, marital_status, languages_known, previous_school_name, previous_school_address, previous_school_phone, current_address, permanent_address, pan_number, id_number, status, created_at, updated_at, staff_id, bank_name, branch, ifsc, contract_type, shift, work_location, facebook, twitter, linkedin, youtube, instagram, blood_group) FROM stdin;
1	1	1	Rajesh Sharma	Sunita Sharma	Married	{Hindi,English,Marathi}	St. Xavier High School	MG Road, Mumbai, Maharashtra 400001	+91-22-26543210	Flat 204, Sunrise Apartments, Bandra West, Mumbai 400050	Flat 204, Sunrise Apartments, Bandra West, Mumbai 400050	ABCPS1234N	1234-5678-9012	Active	2025-08-15 17:19:34.970329	2025-08-15 17:19:34.970329	1	Bank Of India	Ring Road	BO1234	Temporary	Evening	1st Floor	https://www.facebook.com/	https://x.com/	https://www.linkedin.com/feed/	https://www.youtube.com/	https://www.instagram.com/	B+
3	3	3	Venkat Reddy	Lakshmi Reddy	Married	{English,Telugu,Hindi}	Narayana High School	Jubilee Hills, Hyderabad, Telangana 500033	+91-40-23456789	Plot 67, Madhapur, Hyderabad, Telangana 500081	H.No. 23-45, Begumpet, Hyderabad, Telangana 500016	IJKLM9012Q	3456-7890-1234	Active	2025-08-15 17:19:34.970329	2025-08-15 17:19:34.970329	3	HDFC bank	Tarsod	HDFC1234	Permanent	Evening	2nd Floor	https://www.facebook.com/	https://x.com/	https://www.linkedin.com/feed/	https://www.youtube.com/	https://www.instagram.com/	O-
2	2	2	Kiran Patel	Meera Patel	Single	{English}	Delhi Public School	Sector 45, Gurgaon, Haryana 122003	+91-124-4567890	House No. 45, Sector 23, Gurgaon, Haryana 122017	B-12, Patel Colony, Ahmedabad, Gujarat 380001	DEFGH5678P	2345-6789-0123	Active	2025-08-15 17:19:34.970329	2026-02-25 13:12:38.661175	2	Bank Of Maharashtra	sector-5 main road	BOM1234	Temporary	Morning	3rd Floor	https://www.facebook.com/	https://x.com/	https://www.linkedin.com/feed/	https://www.youtube.com/	https://www.instagram.com/	AB+
\.

COPY public.time_slots (id, slot_name, start_time, end_time, duration, is_break, is_active, created_at, created_by, modified_at) FROM stdin;
3	Break	09:30:00	09:45:00	15	t	t	2025-08-14 03:23:23.164536	\N	2025-08-14 03:23:23.164536
4	3rd Period	09:45:00	10:30:00	45	f	t	2025-08-14 03:23:23.164536	\N	2025-08-14 03:23:23.164536
5	4th Period	10:30:00	11:15:00	45	f	t	2025-08-14 03:23:23.164536	\N	2025-08-14 03:23:23.164536
6	Lunch Break	11:15:00	12:00:00	45	t	t	2025-08-14 03:23:23.164536	\N	2025-08-14 03:23:23.164536
7	5th Period	12:00:00	12:45:00	45	f	t	2025-08-14 03:23:23.164536	\N	2025-08-14 03:23:23.164536
8	6th Period	12:45:00	13:30:00	45	f	t	2025-08-14 03:23:23.164536	\N	2025-08-14 03:23:23.164536
1	1st Period	08:00:00	09:30:00	45	f	t	2025-08-14 03:23:23.164536	\N	2026-02-20 15:24:45.416856
2	2nd Period	08:45:00	09:30:00	45	f	t	2025-08-14 03:23:23.164536	\N	2026-02-20 15:25:20.168282
\.

COPY public.todos (id, user_id, title, description, due_date, priority, status, tag, is_important, assigned_to, created_at, updated_at) FROM stdin;
1	11	Complete Assignment	Finish the math homework	2026-02-19 17:15:42.392318	high	pending	pending	t	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	Review Notes	Review class notes for exam	2026-02-21 17:15:42.392318	medium	in_progress	inprogress	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	Submit Project	Submit the science project	2026-02-17 17:15:42.392318	high	done	done	t	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.users (id, username, email, password_hash, role_id, first_name, last_name, phone, last_login, is_active, created_at, created_by, modified_at, current_address, permanent_address, avatar) FROM stdin;
20	amit.parent	amit.parent@gmail.com	$2b$12$example_hash_3	4	Amit	Singh	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
18	vikram.parent	vikram.parent@gmail.com	$2b$12$example_hash_3	4	Vikram	Patel	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
23	amit.guardian	amit.guardian@gmail.com	$2b$12$example_hash_3	5	Amit	patel	9876501113	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
22	vikash.guardian	vikash.guardian@gmail.com	$2b$12$example_hash_3	5	Vikash	kumar	9876501113	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
12	hania.aamir	hania@gmail.com	$2a$10$bJw8cnOVpKhNsTsaVJFqLe52UcJW3q5MMcjs7g.LBWywyHLdoruBK	3	hani	aamir	9898989898	\N	t	2025-08-18 02:43:45.031947	\N	2025-08-18 02:43:45.031947	Not Provided	Not Provided	
14	priya.sharma	priya@gmail.com	$2a$10$qineXii7PwUJMOKLkucpk.GJBiYpiDZOCzAbbGpsz7kt/J0R0aywm	2	Priya	Sharma	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
16	anil.patil	anil@gmail.com	$2a$10$ARJZHqTlseAp4eLPu1w5AOcS./uEiEzj1t7ZEfAhdIHVSsLnuo6ny	2	Anil	Patil	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
21	rajesh.guardian	rajesh.guardian@gmail.com	$2a$10$ju8GbKP6rQC2JsdQbY87EOcoa5Mob4xP2p9Wpz6plY5Q6rBI0lCF.	5	Rajesh	Kumar	9876501113	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
19	aamir.parent	aamir.parent@gmail.com	$2a$10$ddJqLtKBApP6NGepP7R5I.s9DGmt7N1.Nvi75gNLoO/wMzx6lArmG	4	Aamir	Khan	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
9	aarav.sharma	aarav.sharma@parent.com	$2a$10$rAvDxrcqbFDc04oIMyABsO9or38pLjHhkPlV.7gRI6LZojlrS/yIC	3	Aarav	Sharma	9876501111	\N	t	2025-08-14 04:15:06.141517	\N	2025-08-14 04:15:06.141517	Not Provided	Not Provided	
15	rajesh.kumar	rajesh@gmail.com	$2a$10$joONX2LNcrJEOj8hHu7km.RU0lxfHwP/HLPtpQEuO0Cb07ofRz09G	2	Rajesh	Kumar	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
17	rajesh.parent	rajesh.parent@gmail.com	$2a$10$eVTosdHRXhYSZS5bvZOaeOJdUF71gw5ozQealXghvRGKW.B6lfS5i	4	Rajesh	Kumar	9876501111	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
11	arjun.kumar	arjun.kumar@parent.com	$2a$10$IVVZX8TDqdEUhUkRYp6CKuVJV/tx7g9i36x98CXS1kJ1WB9e/YwhS	3	Arjun	Kumar	9876501113	\N	t	2025-08-14 04:15:06.141517	\N	2025-08-14 04:15:06.141517	Not Provided	Not Provided	
10	sara.patel	sara.patel@parent.com	$2a$10$ywGj/vWGNSgo.QUyxxH8HOHg79tKi2KPzjMXrnm1/1rB4nK3oBQqO	3	Sara	Patel	9876501112	\N	t	2025-08-14 04:15:06.141517	\N	2025-08-14 04:15:06.141517	Not Provided	Not Provided	
13	Headmaster	headmaster@gmail.com	$2a$10$AdgMLLsnKvKy.g5As0co1.HsaLD7rPvbPlzePoTnAlqIiRAi7IsMC	1	Head	Master	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided	
\.

COPY public.vehicles (id, vehicle_number, vehicle_type, brand, model, seating_capacity, driver_id, route_id, insurance_expiry, fitness_certificate_expiry, permit_expiry, fuel_type, is_active, created_at, created_by, modified_at, made_of_year, registration_number, chassis_number, gps_device_id) FROM stdin;
2	MH31CD5678	bus	Ashok Leyland	Lynx	40	2	2	2025-08-20	2025-06-15	2025-12-31	diesel	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416	2021	2222	ch2222	gps2222
3	MH31EF9012	van	Mahindra	Bolero Maxi Truck	15	3	3	2025-05-10	2025-03-25	2025-12-31	diesel	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416	2019	3333	ch3333	gps3333
1	MH31AB1234	bus	Tata	LP 909	35	1	1	2025-06-15	2025-04-30	2025-12-31	diesel	t	2025-08-14 04:12:16.81416	\N	2026-02-17 16:45:47.113365	2020	1111	ch1111	gps1111
\.


-- Sync Sequences BEFORE Reseed
SELECT setval('academic_years_id_seq', COALESCE((SELECT MAX(id) FROM academic_years), 1));
SELECT setval('addresses_id_seq', COALESCE((SELECT MAX(id) FROM addresses), 1));
SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM attendance), 1));
SELECT setval('blocked_users_id_seq', COALESCE((SELECT MAX(id) FROM blocked_users), 1));
SELECT setval('blood_groups_id_seq', COALESCE((SELECT MAX(id) FROM blood_groups), 1));
SELECT setval('calendar_events_id_seq', COALESCE((SELECT MAX(id) FROM calendar_events), 1));
SELECT setval('calls_id_seq', COALESCE((SELECT MAX(id) FROM calls), 1));
SELECT setval('casts_id_seq', COALESCE((SELECT MAX(id) FROM casts), 1));
SELECT setval('chat_settings_id_seq', COALESCE((SELECT MAX(id) FROM chat_settings), 1));
SELECT setval('chats_id_seq', COALESCE((SELECT MAX(id) FROM chats), 1));
SELECT setval('class_rooms_id_seq', COALESCE((SELECT MAX(id) FROM class_rooms), 1));
SELECT setval('class_schedules_id_seq', COALESCE((SELECT MAX(id) FROM class_schedules), 1));
SELECT setval('class_syllabus_id_seq', COALESCE((SELECT MAX(id) FROM class_syllabus), 1));
SELECT setval('classes_id_seq', COALESCE((SELECT MAX(id) FROM classes), 1));
SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id) FROM departments), 1));
SELECT setval('designations_id_seq', COALESCE((SELECT MAX(id) FROM designations), 1));
SELECT setval('document_types_id_seq', COALESCE((SELECT MAX(id) FROM document_types), 1));
SELECT setval('documents_id_seq', COALESCE((SELECT MAX(id) FROM documents), 1));
SELECT setval('drivers_id_seq', COALESCE((SELECT MAX(id) FROM drivers), 1));
SELECT setval('emails_id_seq', COALESCE((SELECT MAX(id) FROM emails), 1));
SELECT setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 1));
SELECT setval('exam_results_id_seq', COALESCE((SELECT MAX(id) FROM exam_results), 1));
SELECT setval('exams_id_seq', COALESCE((SELECT MAX(id) FROM exams), 1));
SELECT setval('fee_collections_id_seq', COALESCE((SELECT MAX(id) FROM fee_collections), 1));
SELECT setval('fee_structures_id_seq', COALESCE((SELECT MAX(id) FROM fee_structures), 1));
SELECT setval('files_id_seq', COALESCE((SELECT MAX(id) FROM files), 1));
SELECT setval('guardians_id_seq', COALESCE((SELECT MAX(id) FROM guardians), 1));
SELECT setval('holidays_id_seq', COALESCE((SELECT MAX(id) FROM holidays), 1));
SELECT setval('hostel_rooms_id_seq', COALESCE((SELECT MAX(id) FROM hostel_rooms), 1));
SELECT setval('hostels_id_seq', COALESCE((SELECT MAX(id) FROM hostels), 1));
SELECT setval('houses_id_seq', COALESCE((SELECT MAX(id) FROM houses), 1));
SELECT setval('languages_id_seq', COALESCE((SELECT MAX(id) FROM languages), 1));
SELECT setval('leave_applications_id_seq', COALESCE((SELECT MAX(id) FROM leave_applications), 1));
SELECT setval('leave_types_id_seq', COALESCE((SELECT MAX(id) FROM leave_types), 1));
SELECT setval('library_book_issues_id_seq', COALESCE((SELECT MAX(id) FROM library_book_issues), 1));
SELECT setval('library_books_id_seq', COALESCE((SELECT MAX(id) FROM library_books), 1));
SELECT setval('library_categories_id_seq', COALESCE((SELECT MAX(id) FROM library_categories), 1));
SELECT setval('medical_conditions_id_seq', COALESCE((SELECT MAX(id) FROM medical_conditions), 1));
SELECT setval('mother_tongues_id_seq', COALESCE((SELECT MAX(id) FROM mother_tongues), 1));
SELECT setval('notes_id_seq', COALESCE((SELECT MAX(id) FROM notes), 1));
SELECT setval('notice_board_id_seq', COALESCE((SELECT MAX(id) FROM notice_board), 1));
SELECT setval('parents_id_seq', COALESCE((SELECT MAX(id) FROM parents), 1));
SELECT setval('pickup_points_id_seq', COALESCE((SELECT MAX(id) FROM pickup_points), 1));
SELECT setval('religions_id_seq', COALESCE((SELECT MAX(id) FROM religions), 1));
SELECT setval('reports_id_seq', COALESCE((SELECT MAX(id) FROM reports), 1));
SELECT setval('sections_id_seq', COALESCE((SELECT MAX(id) FROM sections), 1));
SELECT setval('staff_id_seq', COALESCE((SELECT MAX(id) FROM staff), 1));
SELECT setval('student_medical_conditions_id_seq', COALESCE((SELECT MAX(id) FROM student_medical_conditions), 1));
SELECT setval('student_promotions_id_seq', COALESCE((SELECT MAX(id) FROM student_promotions), 1));
SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM students), 1));
SELECT setval('subjects_id_seq', COALESCE((SELECT MAX(id) FROM subjects), 1));
SELECT setval('teacher_routines_id_seq', COALESCE((SELECT MAX(id) FROM teacher_routines), 1));
SELECT setval('teachers_id_seq', COALESCE((SELECT MAX(id) FROM teachers), 1));
SELECT setval('time_slots_id_seq', COALESCE((SELECT MAX(id) FROM time_slots), 1));
SELECT setval('todos_id_seq', COALESCE((SELECT MAX(id) FROM todos), 1));
SELECT setval('user_roles_id_seq', COALESCE((SELECT MAX(id) FROM user_roles), 1));
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

-- Dynamic Reseed Logic (Cleaned)
-- =============================================================================
-- Migration: 006_reseed_multi_academic_year_dummy_data.sql
-- Purpose:
--   1) Undo the previous seeded dummy dataset created by 005 migration.
--   2) Seed fresh data for EACH academic year:
--      - 3 classes per academic year
--      - 3 sections per class
--      - 5 students per section
--   3) Keep existing teachers and assign up to 2 sections per teacher per year.
--
-- This file is safe to run in pgAdmin.
-- =============================================================================

BEGIN;

DO $reseed$
DECLARE
  v_teacher_role_id INTEGER;
  v_student_role_id INTEGER;
  v_parent_role_id INTEGER;
  v_guardian_role_id INTEGER;
  v_blood_group_id INTEGER;
  v_religion_id INTEGER;
  v_cast_id INTEGER;
  v_mother_tongue_id INTEGER;
  v_house_id INTEGER;
  v_teacher_count INTEGER;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0) Resolve required ids
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_teacher_role_id FROM user_roles WHERE lower(role_name) = 'teacher' LIMIT 1;
  SELECT id INTO v_student_role_id FROM user_roles WHERE lower(role_name) = 'student' LIMIT 1;
  SELECT id INTO v_parent_role_id FROM user_roles WHERE lower(role_name) = 'parent' LIMIT 1;
  SELECT id INTO v_guardian_role_id FROM user_roles WHERE lower(role_name) = 'guardian' LIMIT 1;

  IF v_student_role_id IS NULL OR v_parent_role_id IS NULL THEN
    RAISE EXCEPTION 'Required role ids missing in user_roles (student/parent).';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1) Undo previously seeded dataset (from 005 and this naming convention)
  -- ---------------------------------------------------------------------------
  DELETE FROM guardians g
  USING students s
  WHERE g.student_id = s.id
    AND s.admission_number LIKE 'ADM-AY%';

  DELETE FROM parents p
  USING students s
  WHERE p.student_id = s.id
    AND s.admission_number LIKE 'ADM-AY%';

  DELETE FROM addresses a
  WHERE a.role_id = v_student_role_id
    AND a.user_id IN (
      SELECT u.id
      FROM users u
      WHERE u.username LIKE 'stu_ay%'
    );

  DELETE FROM students
  WHERE admission_number LIKE 'ADM-AY%';

  DELETE FROM users
  WHERE username LIKE 'stu_ay%'
     OR username LIKE 'father_adm_ay%'
     OR username LIKE 'mother_adm_ay%'
     OR username LIKE 'guardian_adm_ay%';

  UPDATE teachers
  SET class_id = NULL,
      subject_id = NULL
  WHERE class_id IN (
      SELECT id FROM classes WHERE class_code LIKE 'DMY-AY%-C_'
    )
     OR subject_id IN (
      SELECT id FROM subjects WHERE subject_code ~ '^D[0-9]+C[123](ENG|MTH|EVS|CSC|GK)$'
    );

  DELETE FROM subjects
  WHERE subject_code ~ '^D[0-9]+C[123](ENG|MTH|EVS|CSC|GK)$';

  DELETE FROM sections s
  USING classes c
  WHERE s.class_id = c.id
    AND c.class_code LIKE 'DMY-AY%-C_'
    AND s.section_name IN ('Aurum', 'Cedar', 'Maple');

  DELETE FROM classes
  WHERE class_code LIKE 'DMY-AY%-C_';

  -- ---------------------------------------------------------------------------
  -- 2) Ensure lookup rows required by students
  -- ---------------------------------------------------------------------------
  INSERT INTO blood_groups (blood_group, description, is_active)
  SELECT 'B+', 'B Positive', true
  WHERE NOT EXISTS (SELECT 1 FROM blood_groups WHERE blood_group = 'B+');

  INSERT INTO religions (religion_name, description, is_active)
  SELECT 'Islam', 'Islam religion', true
  WHERE NOT EXISTS (SELECT 1 FROM religions WHERE religion_name = 'Islam');

  SELECT id INTO v_religion_id FROM religions WHERE religion_name = 'Islam' LIMIT 1;

  INSERT INTO casts (cast_name, religion_id, description, is_active)
  SELECT 'Sunni', v_religion_id, 'Sunni community', true
  WHERE NOT EXISTS (SELECT 1 FROM casts WHERE cast_name = 'Sunni');

  INSERT INTO mother_tongues (language_name, language_code, description, is_active)
  SELECT 'Urdu', 'UR', 'Urdu language', true
  WHERE NOT EXISTS (SELECT 1 FROM mother_tongues WHERE language_name = 'Urdu');

  INSERT INTO houses (house_name, house_color, house_captain, description, is_active)
  SELECT 'Falcon House', '#1E3A8A', 'Ayaan Khan', 'Performance and discipline house', true
  WHERE NOT EXISTS (SELECT 1 FROM houses WHERE house_name = 'Falcon House');

  INSERT INTO languages (language_name, language_code, is_compulsory, description, is_active)
  SELECT 'English', 'EN', true, 'Instruction language', true
  WHERE NOT EXISTS (SELECT 1 FROM languages WHERE language_name = 'English');

  INSERT INTO languages (language_name, language_code, is_compulsory, description, is_active)
  SELECT 'Hindi', 'HI', true, 'Second language', true
  WHERE NOT EXISTS (SELECT 1 FROM languages WHERE language_name = 'Hindi');

  SELECT id INTO v_blood_group_id FROM blood_groups WHERE blood_group = 'B+' LIMIT 1;
  SELECT id INTO v_cast_id FROM casts WHERE cast_name = 'Sunni' LIMIT 1;
  SELECT id INTO v_mother_tongue_id FROM mother_tongues WHERE language_name = 'Urdu' LIMIT 1;
  SELECT id INTO v_house_id FROM houses WHERE house_name = 'Falcon House' LIMIT 1;

  -- ---------------------------------------------------------------------------
  -- 3) Create 3 classes for EACH academic year
  -- ---------------------------------------------------------------------------
  INSERT INTO classes (
    class_name, class_code, academic_year_id, class_teacher_id,
    max_students, class_fee, description, is_active
  )
  SELECT
    'Class ' || v.class_no,
    'DMY-AY' || ay.id || '-C' || v.class_no,
    ay.id,
    NULL,
    40,
    v.class_fee,
    'Dummy class for academic year ' || ay.year_name,
    true
  FROM academic_years ay
  CROSS JOIN (
    VALUES
      (1, 24000.00::numeric),
      (2, 26000.00::numeric),
      (3, 28000.00::numeric)
  ) AS v(class_no, class_fee)
  WHERE NOT EXISTS (
    SELECT 1
    FROM classes c
    WHERE c.class_code = 'DMY-AY' || ay.id || '-C' || v.class_no
  );

  -- ---------------------------------------------------------------------------
  -- 4) Create 3 sections per class
  -- ---------------------------------------------------------------------------
  INSERT INTO sections (
    section_name, class_id, section_teacher_id, max_students, room_number,
    description, is_active
  )
  SELECT
    sec.section_name,
    c.id,
    NULL,
    35,
    sec.room_number,
    sec.description,
    true
  FROM classes c
  CROSS JOIN (
    VALUES
      ('Aurum', 'R-101', 'Aurum learning section'),
      ('Cedar', 'R-102', 'Cedar learning section'),
      ('Maple', 'R-103', 'Maple learning section')
  ) AS sec(section_name, room_number, description)
  WHERE c.class_code LIKE 'DMY-AY%-C_'
    AND NOT EXISTS (
      SELECT 1
      FROM sections s
      WHERE s.class_id = c.id
        AND s.section_name = sec.section_name
    );

  -- ---------------------------------------------------------------------------
  -- 5) Create subjects per class
  -- ---------------------------------------------------------------------------
  WITH teacher_pool AS (
    SELECT
      t.staff_id,
      ROW_NUMBER() OVER (ORDER BY t.id) AS teacher_rank
    FROM teachers t
    WHERE t.staff_id IS NOT NULL
  ),
  teacher_meta AS (
    SELECT COUNT(*)::int AS teacher_count FROM teacher_pool
  ),
  src AS (
    SELECT
      c.id AS class_id,
      ay.id AS ay_id,
      RIGHT(c.class_code, 1) AS class_no,
      sub.subject_name,
      sub.subject_short,
      sub.theory_hours,
      sub.practical_hours,
      sub.description,
      tp.staff_id
    FROM classes c
    JOIN academic_years ay ON ay.id = c.academic_year_id
    CROSS JOIN (
      VALUES
        ('English', 'ENG', 5, 0, 'Language and communication'),
        ('Mathematics', 'MTH', 5, 0, 'Numerical and logical thinking'),
        ('Environmental Studies', 'EVS', 4, 1, 'Awareness of environment and society'),
        ('Computer Science', 'CSC', 3, 2, 'Digital literacy and computing basics'),
        ('General Knowledge', 'GK', 2, 0, 'Current affairs and broad awareness')
    ) AS sub(subject_name, subject_short, theory_hours, practical_hours, description)
    LEFT JOIN teacher_meta tm ON true
    LEFT JOIN teacher_pool tp
      ON tp.teacher_rank = CASE
        WHEN COALESCE(tm.teacher_count, 0) = 0 THEN NULL
        ELSE ((ASCII(sub.subject_short) % tm.teacher_count) + 1)
      END
    WHERE c.class_code LIKE 'DMY-AY%-C_'
  )
  INSERT INTO subjects (
    subject_name, subject_code, class_id, teacher_id,
    theory_hours, practical_hours, total_marks, passing_marks,
    description, is_active
  )
  SELECT
    src.subject_name,
    ('D' || src.ay_id || 'C' || src.class_no || src.subject_short),
    src.class_id,
    src.staff_id,
    src.theory_hours,
    src.practical_hours,
    100,
    35,
    src.description,
    true
  FROM src
  WHERE NOT EXISTS (
    SELECT 1
    FROM subjects s
    WHERE s.subject_code = ('D' || src.ay_id || 'C' || src.class_no || src.subject_short)
  );

  -- ---------------------------------------------------------------------------
  -- 6) Teacher-section allocation: each teacher gets max 2 sections per academic year
  -- ---------------------------------------------------------------------------
  SELECT COUNT(*)::int INTO v_teacher_count
  FROM teachers t
  WHERE t.staff_id IS NOT NULL;

  IF v_teacher_count > 0 THEN
    UPDATE sections s
    SET section_teacher_id = NULL
    FROM classes c
    WHERE s.class_id = c.id
      AND c.class_code LIKE 'DMY-AY%-C_';

    WITH teacher_pool AS (
      SELECT
        t.staff_id,
        ROW_NUMBER() OVER (ORDER BY t.id) AS teacher_rank
      FROM teachers t
      WHERE t.staff_id IS NOT NULL
    ),
    section_pool AS (
      SELECT
        s.id AS section_id,
        c.academic_year_id,
        ROW_NUMBER() OVER (
          PARTITION BY c.academic_year_id
          ORDER BY c.class_code, s.section_name
        ) AS section_rank
      FROM sections s
      JOIN classes c ON c.id = s.class_id
      WHERE c.class_code LIKE 'DMY-AY%-C_'
    ),
    mapped AS (
      SELECT
        sp.section_id,
        tp.staff_id
      FROM section_pool sp
      LEFT JOIN teacher_pool tp
        ON tp.teacher_rank = ((sp.section_rank - 1) / 2) + 1
      WHERE sp.section_rank <= (v_teacher_count * 2)
    )
    UPDATE sections s
    SET section_teacher_id = m.staff_id
    FROM mapped m
    WHERE s.id = m.section_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 7) Build student dataset: 5 students per section for each academic year
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE tmp_seed_students (
    seq_no INTEGER,
    ay_id INTEGER,
    class_id INTEGER,
    section_id INTEGER,
    first_name TEXT,
    last_name TEXT,
    gender TEXT,
    admission_number TEXT,
    roll_number TEXT,
    username TEXT,
    email TEXT,
    unique_student_ids TEXT,
    pen_number TEXT,
    aadhar_no TEXT,
    gr_number TEXT
  ) ON COMMIT DROP;

  WITH target_sections AS (
    SELECT
      ay.id AS ay_id,
      c.id AS class_id,
      s.id AS section_id,
      ROW_NUMBER() OVER (PARTITION BY ay.id ORDER BY c.class_code, s.section_name) AS sec_no
    FROM academic_years ay
    JOIN classes c ON c.academic_year_id = ay.id
    JOIN sections s ON s.class_id = c.id
    WHERE c.class_code LIKE 'DMY-AY%-C_'
  ),
  expanded AS (
    SELECT
      ts.ay_id,
      ts.class_id,
      ts.section_id,
      ts.sec_no,
      gs.slot_no,
      ((ts.sec_no - 1) * 5 + gs.slot_no) AS seq_in_year
    FROM target_sections ts
    CROSS JOIN LATERAL generate_series(1, 5) AS gs(slot_no)
  )
  INSERT INTO tmp_seed_students (
    seq_no, ay_id, class_id, section_id, first_name, last_name, gender,
    admission_number, roll_number, username, email, unique_student_ids,
    pen_number, aadhar_no, gr_number
  )
  SELECT
    e.seq_in_year,
    e.ay_id,
    e.class_id,
    e.section_id,
    (ARRAY[
      'Ayaan','Vihaan','Reyansh','Arjun','Ishaan','Kabir','Advik','Sai','Devansh','Rudra',
      'Zayan','Aarav','Laksh','Krish','Yuvraj','Anaya','Myra','Aadhya','Saanvi','Kiara',
      'Fatima','Aisha','Inaya','Sara','Zoya','Meher','Anvi','Riya','Naina','Tara',
      'Prisha','Siya','Pari','Navya','Riddhi','Hridya','Mahir','Shaurya','Dhruv','Rayan',
      'Arnav','Nivaan','Samaira','Misha','Alina'
    ])[e.seq_in_year],
    (ARRAY[
      'Khan','Sharma','Patel','Ansari','Mishra','Verma','Singh','Qureshi','Shaikh','Gupta',
      'Naqvi','Malik','Rao','Joshi','Kulkarni','Deshmukh','Chopra','Siddiqui','Nair','Menon',
      'Pathan','Bano','Rahman','Iqbal','Hussain','Tiwari','Yadav','Jain','Kapoor','Bhatt',
      'Pillai','Thomas','Dutta','Saxena','Trivedi','Chauhan','Bhardwaj','Srivastava','Farooqui','Kazi',
      'Gandhi','Parekh','Reddy','Lodhi','Basu'
    ])[e.seq_in_year],
    CASE WHEN (e.seq_in_year % 2) = 0 THEN 'female' ELSE 'male' END,
    ('ADM-AY' || e.ay_id || '-' || LPAD(e.seq_in_year::text, 3, '0')),
    ('R-' || LPAD(e.seq_in_year::text, 3, '0')),
    ('stu_ay' || e.ay_id || '_' || LPAD(e.seq_in_year::text, 3, '0')),
    ('student.ay' || e.ay_id || '.' || LPAD(e.seq_in_year::text, 3, '0') || '@myschool.local'),
    ('UID-AY' || e.ay_id || '-' || LPAD(e.seq_in_year::text, 5, '0')),
    ('PEN' || e.ay_id || LPAD(e.seq_in_year::text, 7, '0')),
    ('9' || LPAD(e.ay_id::text, 2, '0') || LPAD(e.seq_in_year::text, 9, '0')),
    ('GR-AY' || e.ay_id || '-' || LPAD(e.seq_in_year::text, 4, '0'))
  FROM expanded e
  ORDER BY e.ay_id, e.seq_in_year;

  -- ---------------------------------------------------------------------------
  -- 8) Insert student users
  -- ---------------------------------------------------------------------------
  INSERT INTO users (
    username, email, password_hash, role_id,
    first_name, last_name, phone, is_active,
    current_address, permanent_address, avatar
  )
  SELECT
    t.username,
    t.email,
    '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
    v_student_role_id,
    t.first_name,
    t.last_name,
    ('98' || LPAD((t.ay_id * 1000 + t.seq_no)::text, 8, '0')),
    true,
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    ('Village Road ' || t.seq_no || ', District Campus Area'),
    ('https://api.dicebear.com/8.x/adventurer/svg?seed=' || replace(t.first_name, ' ', '') || t.ay_id)
  FROM tmp_seed_students t
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = t.username);

  -- ---------------------------------------------------------------------------
  -- 9) Insert students
  -- ---------------------------------------------------------------------------
  INSERT INTO students (
    user_id, admission_number, roll_number, first_name, last_name, gender,
    date_of_birth, place_of_birth, blood_group_id, religion_id, cast_id, mother_tongue_id,
    nationality, phone, email, address, academic_year_id, class_id, section_id, house_id,
    admission_date, previous_school, photo_url, is_transport_required, is_hostel_required, is_active,
    bank_name, branch, ifsc, known_allergies, medications,  previous_school_address, medical_condition,
    other_information, vehicle_number, current_address, permanent_address,
    unique_student_ids, pen_number, aadhar_no, gr_number
  )
  SELECT
    u.id,
    t.admission_number,
    t.roll_number,
    t.first_name,
    t.last_name,
    t.gender,
    (DATE '2017-04-01' + ((t.seq_no % 120) * INTERVAL '1 day'))::date,
    'Mumbai',
    v_blood_group_id,
    v_religion_id,
    v_cast_id,
    v_mother_tongue_id,
    'Indian',
    ('98' || LPAD((t.ay_id * 1000 + t.seq_no)::text, 8, '0')),
    t.email,
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    t.ay_id,
    t.class_id,
    t.section_id,
    v_house_id,
    CURRENT_DATE - INTERVAL '45 days',
    'Bright Future Public School',
    ('https://api.dicebear.com/8.x/initials/svg?seed=' || replace(t.first_name || t.last_name, ' ', '') || t.ay_id),
    false,
    false,
    true,
    'State Bank of India',
    'Central Branch',
    'SBIN0001234',
    'None',
    'None',
    
    'Old Town Road, Mumbai',
    'No chronic condition',
    'Participates in co-curricular activities',
    ('MH01AB' || LPAD((t.ay_id * 1000 + t.seq_no)::text, 4, '0')),
    ('Flat ' || t.seq_no || ', Green Residency, Civil Lines'),
    ('Village Road ' || t.seq_no || ', District Campus Area'),
    t.unique_student_ids,
    t.pen_number,
    t.aadhar_no,
    t.gr_number
  FROM tmp_seed_students t
  JOIN users u ON u.username = t.username
  WHERE NOT EXISTS (
    SELECT 1 FROM students s WHERE s.admission_number = t.admission_number
  );

  -- ---------------------------------------------------------------------------
  -- 10) Student addresses
  -- ---------------------------------------------------------------------------
  INSERT INTO addresses (current_address, permanent_address, user_id, role_id, person_id)
  SELECT
    s.current_address,
    s.permanent_address,
    u.id,
    v_student_role_id,
    s.id
  FROM students s
  JOIN users u ON u.id = s.user_id
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (
      SELECT 1
      FROM addresses a
      WHERE a.user_id = u.id
        AND a.role_id = v_student_role_id
    );

  UPDATE students s
  SET address_id = a.id
  FROM addresses a
  WHERE s.user_id = a.user_id
    AND a.role_id = v_student_role_id
    AND s.admission_number LIKE 'ADM-AY%'
    AND (s.address_id IS NULL OR s.address_id <> a.id);

  -- ---------------------------------------------------------------------------
  -- 11) Parent users + parents rows
  -- ---------------------------------------------------------------------------
  INSERT INTO users (
    username, email, password_hash, role_id,
    first_name, last_name, phone, is_active,
    current_address, permanent_address, avatar
  )
  SELECT
    'father_' || lower(replace(s.admission_number, '-', '_')),
    lower(replace(s.admission_number, '-', '.')) || '.father@myschool.local',
    '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
    v_parent_role_id,
    'Imran',
    (s.last_name || ' Sr'),
    ('97' || LPAD(s.id::text, 8, '0')),
    true,
    s.current_address,
    s.permanent_address,
    'https://api.dicebear.com/8.x/avataaars/svg?seed=father' || s.id
  FROM students s
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.username = 'father_' || lower(replace(s.admission_number, '-', '_'))
    );

  INSERT INTO users (
    username, email, password_hash, role_id,
    first_name, last_name, phone, is_active,
    current_address, permanent_address, avatar
  )
  SELECT
    'mother_' || lower(replace(s.admission_number, '-', '_')),
    lower(replace(s.admission_number, '-', '.')) || '.mother@myschool.local',
    '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
    v_parent_role_id,
    'Sana',
    (s.last_name || ' Sr'),
    ('96' || LPAD(s.id::text, 8, '0')),
    true,
    s.current_address,
    s.permanent_address,
    'https://api.dicebear.com/8.x/avataaars/svg?seed=mother' || s.id
  FROM students s
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.username = 'mother_' || lower(replace(s.admission_number, '-', '_'))
    );

  INSERT INTO parents (
    student_id, father_name, father_email, father_phone, father_occupation, father_image_url,
    mother_name, mother_email, mother_phone, mother_occupation, mother_image_url,
    user_id
  )
  SELECT
    s.id,
    ('Imran ' || s.last_name),
    fu.email,
    fu.phone,
    'Business Owner',
    'https://api.dicebear.com/8.x/avataaars/svg?seed=imran' || s.id,
    ('Sana ' || s.last_name),
    mu.email,
    mu.phone,
    'Teacher',
    'https://api.dicebear.com/8.x/avataaars/svg?seed=sana' || s.id,
    fu.id
  FROM students s
  JOIN users fu ON fu.username = 'father_' || lower(replace(s.admission_number, '-', '_'))
  JOIN users mu ON mu.username = 'mother_' || lower(replace(s.admission_number, '-', '_'))
  WHERE s.admission_number LIKE 'ADM-AY%'
    AND NOT EXISTS (SELECT 1 FROM parents p WHERE p.student_id = s.id);

  -- Skipped parent_id update (schema change)

  -- ---------------------------------------------------------------------------
  -- 12) Guardian users + guardians rows
  -- ---------------------------------------------------------------------------
  IF v_guardian_role_id IS NOT NULL THEN
    INSERT INTO users (
      username, email, password_hash, role_id,
      first_name, last_name, phone, is_active,
      current_address, permanent_address, avatar
    )
    SELECT
      'guardian_' || lower(replace(s.admission_number, '-', '_')),
      lower(replace(s.admission_number, '-', '.')) || '.guardian@myschool.local',
      '$2a$10$4f8x7Qw5l8VvM1xJ8Nf2oOGS5YQ7s8XQ5QJfS2f4v9m5XvF2aR9VO',
      v_guardian_role_id,
      'Rafiq',
      (s.last_name || ' Uncle'),
      ('95' || LPAD(s.id::text, 8, '0')),
      true,
      s.current_address,
      s.permanent_address,
      'https://api.dicebear.com/8.x/avataaars/svg?seed=guardian' || s.id
    FROM students s
    WHERE s.admission_number LIKE 'ADM-AY%'
      AND NOT EXISTS (
        SELECT 1
        FROM users u
        WHERE u.username = 'guardian_' || lower(replace(s.admission_number, '-', '_'))
      );

    INSERT INTO guardians (
      student_id, guardian_type, first_name, last_name, relation, occupation,
      phone, email, address, office_address, annual_income,
      is_primary_contact, is_emergency_contact, is_active, user_id
    )
    SELECT
      s.id,
      'guardian',
      'Rafiq',
      s.last_name,
      'Uncle',
      'Supervisor',
      gu.phone,
      gu.email,
      s.current_address,
      'Industrial Area, Mumbai',
      420000.00,
      false,
      true,
      true,
      gu.id
    FROM students s
    JOIN users gu ON gu.username = 'guardian_' || lower(replace(s.admission_number, '-', '_'))
    WHERE s.admission_number LIKE 'ADM-AY%'
      AND NOT EXISTS (SELECT 1 FROM guardians g WHERE g.student_id = s.id);

    UPDATE students s
    SET guardian_id = g.id
    FROM guardians g
    WHERE g.student_id = s.id
      AND s.admission_number LIKE 'ADM-AY%'
      AND (s.guardian_id IS NULL OR s.guardian_id <> g.id);
  END IF;

  -- ---------------------------------------------------------------------------
    -- Counts skipped (schema change)
  END $reseed$;

COMMIT;



-- Sync Sequences AFTER Reseed
SELECT setval('academic_years_id_seq', COALESCE((SELECT MAX(id) FROM academic_years), 1));
SELECT setval('addresses_id_seq', COALESCE((SELECT MAX(id) FROM addresses), 1));
SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM attendance), 1));
SELECT setval('blocked_users_id_seq', COALESCE((SELECT MAX(id) FROM blocked_users), 1));
SELECT setval('blood_groups_id_seq', COALESCE((SELECT MAX(id) FROM blood_groups), 1));
SELECT setval('calendar_events_id_seq', COALESCE((SELECT MAX(id) FROM calendar_events), 1));
SELECT setval('calls_id_seq', COALESCE((SELECT MAX(id) FROM calls), 1));
SELECT setval('casts_id_seq', COALESCE((SELECT MAX(id) FROM casts), 1));
SELECT setval('chat_settings_id_seq', COALESCE((SELECT MAX(id) FROM chat_settings), 1));
SELECT setval('chats_id_seq', COALESCE((SELECT MAX(id) FROM chats), 1));
SELECT setval('class_rooms_id_seq', COALESCE((SELECT MAX(id) FROM class_rooms), 1));
SELECT setval('class_schedules_id_seq', COALESCE((SELECT MAX(id) FROM class_schedules), 1));
SELECT setval('class_syllabus_id_seq', COALESCE((SELECT MAX(id) FROM class_syllabus), 1));
SELECT setval('classes_id_seq', COALESCE((SELECT MAX(id) FROM classes), 1));
SELECT setval('departments_id_seq', COALESCE((SELECT MAX(id) FROM departments), 1));
SELECT setval('designations_id_seq', COALESCE((SELECT MAX(id) FROM designations), 1));
SELECT setval('document_types_id_seq', COALESCE((SELECT MAX(id) FROM document_types), 1));
SELECT setval('documents_id_seq', COALESCE((SELECT MAX(id) FROM documents), 1));
SELECT setval('drivers_id_seq', COALESCE((SELECT MAX(id) FROM drivers), 1));
SELECT setval('emails_id_seq', COALESCE((SELECT MAX(id) FROM emails), 1));
SELECT setval('events_id_seq', COALESCE((SELECT MAX(id) FROM events), 1));
SELECT setval('exam_results_id_seq', COALESCE((SELECT MAX(id) FROM exam_results), 1));
SELECT setval('exams_id_seq', COALESCE((SELECT MAX(id) FROM exams), 1));
SELECT setval('fee_collections_id_seq', COALESCE((SELECT MAX(id) FROM fee_collections), 1));
SELECT setval('fee_structures_id_seq', COALESCE((SELECT MAX(id) FROM fee_structures), 1));
SELECT setval('files_id_seq', COALESCE((SELECT MAX(id) FROM files), 1));
SELECT setval('guardians_id_seq', COALESCE((SELECT MAX(id) FROM guardians), 1));
SELECT setval('holidays_id_seq', COALESCE((SELECT MAX(id) FROM holidays), 1));
SELECT setval('hostel_rooms_id_seq', COALESCE((SELECT MAX(id) FROM hostel_rooms), 1));
SELECT setval('hostels_id_seq', COALESCE((SELECT MAX(id) FROM hostels), 1));
SELECT setval('houses_id_seq', COALESCE((SELECT MAX(id) FROM houses), 1));
SELECT setval('languages_id_seq', COALESCE((SELECT MAX(id) FROM languages), 1));
SELECT setval('leave_applications_id_seq', COALESCE((SELECT MAX(id) FROM leave_applications), 1));
SELECT setval('leave_types_id_seq', COALESCE((SELECT MAX(id) FROM leave_types), 1));
SELECT setval('library_book_issues_id_seq', COALESCE((SELECT MAX(id) FROM library_book_issues), 1));
SELECT setval('library_books_id_seq', COALESCE((SELECT MAX(id) FROM library_books), 1));
SELECT setval('library_categories_id_seq', COALESCE((SELECT MAX(id) FROM library_categories), 1));
SELECT setval('medical_conditions_id_seq', COALESCE((SELECT MAX(id) FROM medical_conditions), 1));
SELECT setval('mother_tongues_id_seq', COALESCE((SELECT MAX(id) FROM mother_tongues), 1));
SELECT setval('notes_id_seq', COALESCE((SELECT MAX(id) FROM notes), 1));
SELECT setval('notice_board_id_seq', COALESCE((SELECT MAX(id) FROM notice_board), 1));
SELECT setval('parents_id_seq', COALESCE((SELECT MAX(id) FROM parents), 1));
SELECT setval('pickup_points_id_seq', COALESCE((SELECT MAX(id) FROM pickup_points), 1));
SELECT setval('religions_id_seq', COALESCE((SELECT MAX(id) FROM religions), 1));
SELECT setval('reports_id_seq', COALESCE((SELECT MAX(id) FROM reports), 1));
SELECT setval('sections_id_seq', COALESCE((SELECT MAX(id) FROM sections), 1));
SELECT setval('staff_id_seq', COALESCE((SELECT MAX(id) FROM staff), 1));
SELECT setval('student_medical_conditions_id_seq', COALESCE((SELECT MAX(id) FROM student_medical_conditions), 1));
SELECT setval('student_promotions_id_seq', COALESCE((SELECT MAX(id) FROM student_promotions), 1));
SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM students), 1));
SELECT setval('subjects_id_seq', COALESCE((SELECT MAX(id) FROM subjects), 1));
SELECT setval('teacher_routines_id_seq', COALESCE((SELECT MAX(id) FROM teacher_routines), 1));
SELECT setval('teachers_id_seq', COALESCE((SELECT MAX(id) FROM teachers), 1));
SELECT setval('time_slots_id_seq', COALESCE((SELECT MAX(id) FROM time_slots), 1));
SELECT setval('todos_id_seq', COALESCE((SELECT MAX(id) FROM todos), 1));
SELECT setval('user_roles_id_seq', COALESCE((SELECT MAX(id) FROM user_roles), 1));
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1));

SET session_replication_role = 'origin';