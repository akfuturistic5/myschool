SET session_replication_role = 'replica';

COPY public.schools (id, school_name, institute_number, db_name, status, type, logo, deleted_at, created_at) FROM stdin;
1	Existing School	1111	school_db	active	\N	assets/img/logo-small.svg	\N	2026-04-24 17:37:44.882215
2	Millat	2222	millat_db	active	High school and junior college	assets/img/icons/millat-logo.png	\N	2026-04-24 17:37:44.882215
3	Iqra	3333	iqra_db	active	College arts and science	assets/img/icons/iqra-logo.bmp	\N	2026-04-24 17:37:44.882215
\.

COPY public.super_admin_audit_log (id, super_admin_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at) FROM stdin;
\.

COPY public.super_admin_users (id, username, email, password_hash, role, is_active, created_at, updated_at) FROM stdin;
\.

COPY public.tenant_sessions (id, session_hash, school_id, institute_number, db_name, tenant_user_id, created_at, expires_at, revoked_at, user_agent, ip_address) FROM stdin;
1	8e99b5b981803a107a8445c18c7774481749bfc6cbc9f9d113112fac5d2f8da0	1	1111	school_db	13	2026-04-24 17:38:02.140593	2026-05-01 17:38:02.139	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36	127.0.0.1
\.

SELECT pg_catalog.setval('public.schools_id_seq', 3, true);
SELECT pg_catalog.setval('public.super_admin_audit_log_id_seq', 1, false);
SELECT pg_catalog.setval('public.super_admin_users_id_seq', 1, false);
SELECT pg_catalog.setval('public.tenant_sessions_id_seq', 1, true);

SET session_replication_role = 'origin';
