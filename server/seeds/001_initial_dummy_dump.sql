-- Generated from school_db.sql
SET session_replication_role = 'replica';

COPY public.academic_years (id, year_name, start_date, end_date, is_current, is_active, created_at, created_by, modified_at) FROM stdin;
2	2023-24	2023-04-01	2024-03-31	f	t	2025-08-14 04:05:11.845903	\N	2025-08-14 04:05:11.845903
1	2024-25	2024-04-01	2025-03-31	f	t	2025-08-14 04:05:11.845903	\N	2025-08-14 04:05:11.845903
3	2025-26	2025-04-01	2026-03-31	t	t	2025-08-14 04:05:11.845903	\N	2025-08-14 04:05:11.845903
\.

COPY public.account_delete_requests (id, user_id, requisition_date, delete_request_date, status, reason, requested_by, reviewed_by, reviewed_at, created_at, updated_at) FROM stdin;
\.

COPY public.accounts_expense_categories (id, academic_year_id, category_name, description, is_active, created_at, modified_at) FROM stdin;
\.

COPY public.accounts_expenses (id, academic_year_id, category_id, expense_name, description, expense_date, amount, invoice_no, payment_method, status, created_at, modified_at) FROM stdin;
\.

COPY public.accounts_income (id, academic_year_id, income_name, description, source, income_date, amount, invoice_no, payment_method, created_at, modified_at) FROM stdin;
\.

COPY public.accounts_invoices (id, academic_year_id, invoice_number, invoice_date, description, amount, payment_method, due_date, status, created_at, modified_at) FROM stdin;
\.

COPY public.accounts_transactions (id, academic_year_id, description, transaction_date, amount, payment_method, transaction_type, status, income_id, created_at, modified_at, expense_id) FROM stdin;
\.

COPY public.addresses (id, current_address, permanent_address, created_at, user_id, role_id, person_id) FROM stdin;
1	123 Green Street, City A	456 Oak Avenue, City A	2025-08-18 02:53:25.58864	9	3	1
2	789 Maple Road, City B	321 Pine Lane, City B	2025-08-18 02:53:25.58864	10	3	2
3	654 Elm Street, City C	987 Cedar Avenue, City C	2025-08-18 02:53:25.58864	11	3	3
4	111 Birch Boulevard, City D	222 Spruce Drive, City D	2025-08-18 02:53:25.58864	12	3	16
6	654 Elm Street, City C	987 Cedar Avenue, City C	2026-03-04 11:15:54.938815	11	2	3
7	111 Birch Boulevard, City D	222 Spruce Drive, City D	2026-03-08 12:43:04.015571	12	2	16
5	sector-5	sector-5	2026-02-25 16:45:40.502795	9	2	1
53	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	2026-04-24 17:36:31.826133	194	3	73
54	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	2026-04-24 17:36:31.826133	183	3	74
55	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	2026-04-24 17:36:31.826133	208	3	75
56	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	2026-04-24 17:36:31.826133	141	3	76
57	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	2026-04-24 17:36:31.826133	220	3	77
58	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	2026-04-24 17:36:31.826133	124	3	78
59	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	2026-04-24 17:36:31.826133	140	3	79
60	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	2026-04-24 17:36:31.826133	188	3	80
61	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	2026-04-24 17:36:31.826133	234	3	81
62	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	2026-04-24 17:36:31.826133	147	3	82
63	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	2026-04-24 17:36:31.826133	161	3	83
64	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	2026-04-24 17:36:31.826133	228	3	84
65	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	2026-04-24 17:36:31.826133	216	3	85
66	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	2026-04-24 17:36:31.826133	203	3	86
67	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	2026-04-24 17:36:31.826133	221	3	87
68	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	2026-04-24 17:36:31.826133	172	3	88
69	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	2026-04-24 17:36:31.826133	185	3	89
70	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	2026-04-24 17:36:31.826133	175	3	90
71	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	2026-04-24 17:36:31.826133	224	3	91
72	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	2026-04-24 17:36:31.826133	195	3	92
73	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	2026-04-24 17:36:31.826133	151	3	93
74	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	2026-04-24 17:36:31.826133	235	3	94
75	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	2026-04-24 17:36:31.826133	199	3	95
76	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	2026-04-24 17:36:31.826133	178	3	96
77	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	2026-04-24 17:36:31.826133	256	3	97
78	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	2026-04-24 17:36:31.826133	136	3	98
79	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	2026-04-24 17:36:31.826133	184	3	99
80	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	2026-04-24 17:36:31.826133	131	3	100
81	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	2026-04-24 17:36:31.826133	187	3	101
82	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	2026-04-24 17:36:31.826133	154	3	102
83	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	2026-04-24 17:36:31.826133	159	3	103
84	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	2026-04-24 17:36:31.826133	163	3	104
85	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	2026-04-24 17:36:31.826133	138	3	105
86	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	2026-04-24 17:36:31.826133	219	3	106
87	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	2026-04-24 17:36:31.826133	127	3	107
88	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	2026-04-24 17:36:31.826133	253	3	108
89	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	2026-04-24 17:36:31.826133	142	3	109
90	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	2026-04-24 17:36:31.826133	139	3	110
91	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	2026-04-24 17:36:31.826133	196	3	111
92	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	2026-04-24 17:36:31.826133	146	3	112
93	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	2026-04-24 17:36:31.826133	243	3	113
94	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	2026-04-24 17:36:31.826133	166	3	114
95	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	2026-04-24 17:36:31.826133	129	3	115
96	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	2026-04-24 17:36:31.826133	157	3	116
97	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	2026-04-24 17:36:31.826133	210	3	117
98	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	2026-04-24 17:36:31.826133	169	3	118
99	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	2026-04-24 17:36:31.826133	212	3	119
100	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	2026-04-24 17:36:31.826133	204	3	120
101	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	2026-04-24 17:36:31.826133	227	3	121
102	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	2026-04-24 17:36:31.826133	135	3	122
103	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	2026-04-24 17:36:31.826133	200	3	123
104	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	2026-04-24 17:36:31.826133	144	3	124
105	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	2026-04-24 17:36:31.826133	170	3	125
106	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	2026-04-24 17:36:31.826133	145	3	126
107	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	2026-04-24 17:36:31.826133	123	3	127
108	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	2026-04-24 17:36:31.826133	213	3	128
109	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	2026-04-24 17:36:31.826133	132	3	129
110	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	2026-04-24 17:36:31.826133	190	3	130
111	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	2026-04-24 17:36:31.826133	192	3	131
112	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	2026-04-24 17:36:31.826133	197	3	132
113	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	2026-04-24 17:36:31.826133	218	3	133
114	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	2026-04-24 17:36:31.826133	165	3	134
115	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	2026-04-24 17:36:31.826133	179	3	135
116	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	2026-04-24 17:36:31.826133	249	3	136
117	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	2026-04-24 17:36:31.826133	202	3	137
118	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	2026-04-24 17:36:31.826133	217	3	138
119	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	2026-04-24 17:36:31.826133	128	3	139
120	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	2026-04-24 17:36:31.826133	238	3	140
121	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	2026-04-24 17:36:31.826133	173	3	141
122	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	2026-04-24 17:36:31.826133	160	3	142
123	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	2026-04-24 17:36:31.826133	201	3	143
124	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	2026-04-24 17:36:31.826133	156	3	144
125	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	2026-04-24 17:36:31.826133	150	3	145
126	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	2026-04-24 17:36:31.826133	222	3	146
127	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	2026-04-24 17:36:31.826133	223	3	147
128	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	2026-04-24 17:36:31.826133	148	3	148
129	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	2026-04-24 17:36:31.826133	189	3	149
130	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	2026-04-24 17:36:31.826133	215	3	150
131	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	2026-04-24 17:36:31.826133	251	3	151
132	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	2026-04-24 17:36:31.826133	246	3	152
133	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	2026-04-24 17:36:31.826133	143	3	153
134	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	2026-04-24 17:36:31.826133	167	3	154
135	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	2026-04-24 17:36:31.826133	155	3	155
136	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	2026-04-24 17:36:31.826133	239	3	156
137	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	2026-04-24 17:36:31.826133	225	3	157
138	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	2026-04-24 17:36:31.826133	214	3	158
139	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	2026-04-24 17:36:31.826133	153	3	159
140	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	2026-04-24 17:36:31.826133	231	3	160
141	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	2026-04-24 17:36:31.826133	247	3	161
142	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	2026-04-24 17:36:31.826133	122	3	162
143	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	2026-04-24 17:36:31.826133	149	3	163
144	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	2026-04-24 17:36:31.826133	245	3	164
145	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	2026-04-24 17:36:31.826133	206	3	165
146	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	2026-04-24 17:36:31.826133	229	3	166
147	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	2026-04-24 17:36:31.826133	254	3	167
148	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	2026-04-24 17:36:31.826133	126	3	168
149	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	2026-04-24 17:36:31.826133	191	3	169
150	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	2026-04-24 17:36:31.826133	177	3	170
151	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	2026-04-24 17:36:31.826133	232	3	171
152	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	2026-04-24 17:36:31.826133	241	3	172
153	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	2026-04-24 17:36:31.826133	236	3	173
154	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	2026-04-24 17:36:31.826133	193	3	174
155	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	2026-04-24 17:36:31.826133	250	3	175
156	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	2026-04-24 17:36:31.826133	162	3	176
157	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	2026-04-24 17:36:31.826133	181	3	177
158	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	2026-04-24 17:36:31.826133	134	3	178
159	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	2026-04-24 17:36:31.826133	168	3	179
160	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	2026-04-24 17:36:31.826133	240	3	180
161	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	2026-04-24 17:36:31.826133	230	3	181
162	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	2026-04-24 17:36:31.826133	209	3	182
163	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	2026-04-24 17:36:31.826133	176	3	183
164	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	2026-04-24 17:36:31.826133	252	3	184
165	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	2026-04-24 17:36:31.826133	244	3	185
166	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	2026-04-24 17:36:31.826133	125	3	186
167	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	2026-04-24 17:36:31.826133	198	3	187
168	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	2026-04-24 17:36:31.826133	130	3	188
169	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	2026-04-24 17:36:31.826133	242	3	189
170	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	2026-04-24 17:36:31.826133	152	3	190
171	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	2026-04-24 17:36:31.826133	182	3	191
172	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	2026-04-24 17:36:31.826133	211	3	192
173	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	2026-04-24 17:36:31.826133	137	3	193
174	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	2026-04-24 17:36:31.826133	226	3	194
175	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	2026-04-24 17:36:31.826133	248	3	195
176	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	2026-04-24 17:36:31.826133	164	3	196
177	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	2026-04-24 17:36:31.826133	171	3	197
178	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	2026-04-24 17:36:31.826133	233	3	198
179	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	2026-04-24 17:36:31.826133	207	3	199
180	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	2026-04-24 17:36:31.826133	174	3	200
181	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	2026-04-24 17:36:31.826133	186	3	201
182	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	2026-04-24 17:36:31.826133	180	3	202
183	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	2026-04-24 17:36:31.826133	133	3	203
184	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	2026-04-24 17:36:31.826133	158	3	204
185	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	2026-04-24 17:36:31.826133	237	3	205
186	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	2026-04-24 17:36:31.826133	255	3	206
187	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	2026-04-24 17:36:31.826133	205	3	207
\.

COPY public.attendance (id, student_id, class_id, section_id, attendance_date, status, check_in_time, check_out_time, marked_by, remarks, academic_year_id, created_at, created_by, modified_at) FROM stdin;
1	1	1	1	2024-08-05	present	08:30:00	13:30:00	2	\N	1	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
2	2	2	2	2024-08-05	present	08:25:00	13:30:00	2	\N	1	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
3	3	3	3	2024-08-05	late	09:15:00	13:30:00	3	\N	1	2025-08-14 04:32:45.108182	\N	2025-08-14 04:32:45.108182
\.

COPY public.blocked_users (id, user_id, blocked_user_id, created_at) FROM stdin;
\.

COPY public.blood_groups (id, blood_group, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	A+	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
2	A-	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
3	B+	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
4	B-	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
5	AB+	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
6	AB-	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
7	O+	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
8	O-	\N	t	2025-08-14 03:21:40.574751	\N	2025-08-14 03:21:40.574751
\.

COPY public.calendar_events (id, user_id, title, description, start_date, end_date, event_color, is_all_day, location, created_at, updated_at) FROM stdin;
1	11	Team Meeting	Discuss project progress	2026-02-19 17:15:42.392318	2026-02-19 18:15:42.392318	bg-primary	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	School Event	Annual day celebration	2026-02-23 17:15:42.392318	2026-02-23 17:15:42.392318	bg-success	t	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	Parent-Teacher Meeting	Discuss student progress	2026-02-25 17:15:42.392318	2026-02-25 19:15:42.392318	bg-info	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.calls (id, user_id, recipient_id, call_type, phone_number, duration, call_date, created_at) FROM stdin;
\.

COPY public.casts (id, cast_name, religion_id, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	General	1	General category	t	2025-08-14 04:11:53.220564	\N	2025-08-14 04:11:53.220564
2	OBC	1	Other Backward Class	t	2025-08-14 04:11:53.220564	\N	2025-08-14 04:11:53.220564
3	SC	1	Scheduled Caste	t	2025-08-14 04:11:53.220564	\N	2025-08-14 04:11:53.220564
5	Sunni	2	Sunni community	t	2026-04-24 17:36:28.458143	\N	2026-04-24 17:36:28.458143
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

COPY public.class_schedules (id, class_id, section_id, subject_id, time_slot_id, day_of_week, academic_year_id, room_number, teacher_id, is_active, created_at, created_by, modified_at, class_room_id) FROM stdin;
1	1	1	1	1	1	1	R101	2	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596	\N
2	2	2	2	2	1	1	R201	2	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596	\N
3	3	3	3	1	2	1	R301	3	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596	\N
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

COPY public.classes (id, class_name, class_code, academic_year_id, class_teacher_id, max_students, class_fee, description, is_active, created_at, created_by, modified_at, has_sections) FROM stdin;
3	UKG	UKG	1	3	30	20000.00	Upper Kindergarten	t	2025-08-14 04:10:59.275289	\N	2026-04-24 17:36:26.807515	t
1	Nursery	NUR	1	2	25	15000.00	Nursery class for 3-4 years children	t	2025-08-14 04:10:59.275289	\N	2026-04-24 17:36:26.807515	t
2	LKG	LKG	1	2	25	18000.00	Lower Kindergarten	t	2025-08-14 04:10:59.275289	\N	2026-04-24 17:36:26.807515	t
27	Class 1	DMY-AY2-C1	2	\N	40	24000.00	Dummy class for academic year 2023-24	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
28	Class 2	DMY-AY2-C2	2	\N	40	26000.00	Dummy class for academic year 2023-24	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
29	Class 3	DMY-AY2-C3	2	\N	40	28000.00	Dummy class for academic year 2023-24	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
30	Class 1	DMY-AY1-C1	1	\N	40	24000.00	Dummy class for academic year 2024-25	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
31	Class 2	DMY-AY1-C2	1	\N	40	26000.00	Dummy class for academic year 2024-25	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
32	Class 3	DMY-AY1-C3	1	\N	40	28000.00	Dummy class for academic year 2024-25	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
33	Class 1	DMY-AY3-C1	3	\N	40	24000.00	Dummy class for academic year 2025-26	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
34	Class 2	DMY-AY3-C2	3	\N	40	26000.00	Dummy class for academic year 2025-26	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
35	Class 3	DMY-AY3-C3	3	\N	40	28000.00	Dummy class for academic year 2025-26	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	t
\.

COPY public.departments (id, department_name, department_code, head_of_department, description, is_active, created_at, created_by, modified_at) FROM stdin;
2	Administration	ADM	\N	Administrative department	t	2025-08-14 04:05:52.789248	\N	2025-08-14 04:05:52.789248
3	Support Staff	SUP	\N	Support staff department	t	2025-08-14 04:05:52.789248	\N	2025-08-14 04:05:52.789248
1	Primary Education	PED	\N	Primary level education department	t	2025-08-14 04:05:52.789248	\N	2026-02-17 19:39:35.248373
\.

COPY public.designations (id, designation_name, department_id, salary_range_min, salary_range_max, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Principal	2	80000.00	120000.00	School Principal	t	2025-08-14 04:06:46.769615	\N	2025-08-14 04:06:46.769615
2	Primary Teacher	1	25000.00	40000.00	Primary level teacher	t	2025-08-14 04:06:46.769615	\N	2025-08-14 04:06:46.769615
3	Class Teacher	1	30000.00	45000.00	Class teacher with additional responsibilities	t	2025-08-14 04:06:46.769615	\N	2025-08-14 04:06:46.769615
23	Driver	3	\N	\N	School vehicle driver	t	2026-04-24 17:36:26.829728	\N	2026-04-24 17:36:26.829728
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

COPY public.drivers (id, driver_name, employee_code, phone, email, license_number, license_expiry, address, emergency_contact, joining_date, salary, is_active, created_at, created_by, modified_at, staff_id, role, user_id, deleted_at, updated_at) FROM stdin;
1	Ramesh Yadav	DRV001	9876541111	ramesh.driver@school.com	MH31DL123456	2026-05-15	123 Driver Colony, Nagpur	9876541112	2022-01-15	18000.00	t	2025-08-14 04:12:16.81416	\N	2026-04-24 17:36:26.841215	56	driver	\N	\N	2026-04-24 17:36:28.145919+05:30
2	Suresh Patil	DRV002	9876541113	suresh.driver@school.com	MH31DL789012	2025-12-20	456 Transport Nagar, Nagpur	9876541114	2021-08-10	19000.00	t	2025-08-14 04:12:16.81416	\N	2026-04-24 17:36:26.841215	57	driver	\N	\N	2026-04-24 17:36:28.145919+05:30
3	Mahesh Kumar	DRV003	9876541115	mahesh.driver@school.com	MH31DL345678	2027-03-25	789 Driver Street, Nagpur	9876541116	2023-02-01	17500.00	t	2025-08-14 04:12:16.81416	\N	2026-04-24 17:36:26.841215	58	driver	\N	\N	2026-04-24 17:36:28.145919+05:30
\.

COPY public.emails (id, user_id, sender_id, sender_email, recipient_email, subject, body, is_read, is_starred, is_important, folder, has_attachment, attachment_url, sent_at, created_at, updated_at) FROM stdin;
1	11	9	sender@example.com	\N	Welcome to School Management System	This is a welcome email.	f	t	f	inbox	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	9	admin@example.com	\N	Important Notice	Please review the attached document.	f	f	f	inbox	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	\N	noreply@example.com	\N	System Update	The system will be updated tonight.	t	f	f	inbox	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.enquiries (id, enquiry_date, name, mobile_number, address, enquiry_about, description, email, status, academic_year_id, created_by, created_at, updated_at) FROM stdin;
\.

COPY public.event_attachments (id, event_id, file_url, file_name, file_type, file_size, relative_path, uploaded_by, created_at) FROM stdin;
\.

COPY public.events (id, title, description, start_date, end_date, event_color, is_all_day, location, event_category, event_for, target_class_ids, target_section_ids, attachment_url, created_by, created_at, updated_at, target_department_ids, target_designation_ids) FROM stdin;
1	Parents Teacher Meet	Meeting with parents and teachers	2026-03-05 13:12:07.744468	2026-03-05 15:12:07.744468	bg-primary	f	\N	Meeting	all	\N	\N	\N	\N	2026-02-26 13:12:07.744468	2026-02-26 13:12:07.744468	\N	\N
2	Summer Vacation	School summer break	2026-01-27 13:12:07.744468	2026-02-06 13:12:07.744468	bg-danger	t	\N	Holidays	all	\N	\N	\N	\N	2026-02-26 13:12:07.744468	2026-02-26 13:12:07.744468	\N	\N
\.

COPY public.exam_classes (exam_id, class_id) FROM stdin;
\.

COPY public.exam_grade (id, grad, min_precentage, max_precentage, is_active, created_at, modified_at) FROM stdin;
1	A+	91.00	100.00	t	2026-04-24 17:36:28.055399	2026-04-24 17:36:28.055399
2	A	86.00	90.99	t	2026-04-24 17:36:28.055399	2026-04-24 17:36:28.055399
3	B+	76.00	85.99	t	2026-04-24 17:36:28.055399	2026-04-24 17:36:28.055399
4	B	66.00	75.99	t	2026-04-24 17:36:28.055399	2026-04-24 17:36:28.055399
5	C	50.00	65.99	t	2026-04-24 17:36:28.055399	2026-04-24 17:36:28.055399
6	D	0.00	49.99	t	2026-04-24 17:36:28.055399	2026-04-24 17:36:28.055399
\.

COPY public.exam_results (id, exam_id, student_id, subject_id, exam_subject_id, marks_obtained, grade, remarks, is_absent, is_active, created_at, created_by, modified_at, entered_by) FROM stdin;
\.

COPY public.exam_subjects (id, exam_id, class_id, section_id, subject_id, max_marks, passing_marks, exam_date, start_time, end_time, is_active, created_at, created_by, modified_at) FROM stdin;
\.

COPY public.exams (id, exam_name, exam_type, academic_year_id, description, is_active, created_at, created_by, modified_at, is_finalized, finalized_at, finalized_by) FROM stdin;
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

COPY public.fees_assign (id, student_id, class_id, fees_group_id, academic_year_id, status, created_at, modified_at) FROM stdin;
\.

COPY public.fees_assign_details (id, fees_assign_id, fees_master_id, amount, academic_year_id, status, created_at, modified_at) FROM stdin;
\.

COPY public.fees_collect (id, student_id, total_paid, receipt_no, academic_year_id, payment_date, payment_mode, remarks, created_at, modified_at) FROM stdin;
\.

COPY public.fees_collect_details (id, fees_collect_id, fees_assign_details_id, paid_amount, created_at) FROM stdin;
\.

COPY public.fees_groups (id, name, description, academic_year_id, status, created_at, modified_at) FROM stdin;
\.

COPY public.fees_master (id, fees_group_id, fees_type_id, amount, academic_year_id, status, created_at, modified_at, due_date, fine_type, fine_amount, fine_percentage) FROM stdin;
\.

COPY public.fees_types (id, name, description, created_at, modified_at, status, code) FROM stdin;
\.

COPY public.files (id, user_id, name, file_type, mime_type, size, file_url, parent_folder_id, is_folder, is_shared, shared_with, created_at, updated_at) FROM stdin;
1	11	Documents	folder	\N	0	\N	\N	t	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
2	11	Assignments	folder	\N	0	\N	\N	t	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
3	11	Math Assignment.pdf	file	application/pdf	1024000	\N	\N	f	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
4	11	Science Project.docx	file	application/vnd.openxmlformats-officedocument.wordprocessingml.document	2048000	\N	\N	f	f	\N	2026-02-18 17:15:42.392318	2026-02-18 17:15:42.392318
\.

COPY public.guardians (id, student_id, guardian_type, first_name, last_name, relation, occupation, phone, email, address, office_address, annual_income, is_primary_contact, is_emergency_contact, is_active, created_at, created_by, modified_at, user_id) FROM stdin;
2	2	father	Amit	Patel	Father	Doctor	9876501113	amit.guardian@email.com	456 Dharampeth, Near Medical College, Nagpur - 440010	Government Medical College, Nagpur	1500000.00	t	t	t	2025-08-14 04:19:49.243699	\N	2026-04-24 17:36:26.719907	23
3	3	father	Vikash	Kumar	Father	Business Owner	9876501113	vikash.guardian@email.com	789 Civil Lines, Near Metro Station, Nagpur - 440001	Kumar Electronics, Sadar	800000.00	t	t	t	2025-08-14 04:19:49.243699	\N	2026-04-24 17:36:26.719907	23
1	1	father	Rajesh	Sharma	Father	Software Engineer	9876501113	rajesh.guardian@email.com	sector-5	TCS, Hinjewadi, Pune	1200000.00	t	t	t	2025-08-14 04:19:49.243699	\N	2026-04-24 17:36:26.719907	23
\.

COPY public.holidays (id, holiday_name, start_date, end_date, holiday_type, description, academic_year_id, is_active, created_at, created_by, modified_at, title, updated_at) FROM stdin;
1	Independence Day	2024-08-15	2024-08-15	national	Indian Independence Day celebration	1	t	2025-08-14 04:32:36.757777	\N	2025-08-14 04:32:36.757777	Independence Day	2026-04-24 17:36:27.888374
2	Diwali Vacation	2024-11-01	2024-11-05	religious	Diwali festival holidays	1	t	2025-08-14 04:32:36.757777	\N	2025-08-14 04:32:36.757777	Diwali Vacation	2026-04-24 17:36:27.888374
3	Republic Day	2025-01-26	2025-01-26	national	Indian Republic Day celebration	1	t	2025-08-14 04:32:36.757777	\N	2025-08-14 04:32:36.757777	Republic Day	2026-04-24 17:36:27.888374
\.

COPY public.hostel_rooms (id, room_number, hostel_id, room_type_id, floor_number, max_occupancy, current_occupancy, monthly_fee, facilities, is_active, created_at, created_by, modified_at) FROM stdin;
13	101	1	2	1	2	0	6000.00	Attached bathroom, Study table, Wardrobe	t	2025-08-14 04:13:55.835545	\N	2025-08-14 04:13:55.835545
14	201	2	2	2	2	0	6000.00	Attached bathroom, Study table, Wardrobe	t	2025-08-14 04:13:55.835545	\N	2025-08-14 04:13:55.835545
15	301	3	3	3	3	0	4500.00	Common bathroom, Study table, Wardrobe	t	2025-08-14 04:13:55.835545	\N	2025-08-14 04:13:55.835545
\.

COPY public.hostels (id, hostel_name, hostel_type, warden_id, total_rooms, address, contact_number, facilities, rules, is_active, created_at, created_by, modified_at, academic_year_id, intake_capacity, description) FROM stdin;
2	Girls Hostel Block B	girls	1	40	School Campus, Block B	0712-2345679	Wi-Fi, Mess, Recreation Room, Study Hall	No outside food, Lights out at 10 PM	t	2025-08-14 04:12:56.129802	\N	2025-08-14 04:12:56.129802	3	160	\N
3	Mixed Hostel Block C	mixed	3	30	School Campus, Block C	0712-2345680	Wi-Fi, Mess, Recreation Room	Separate floors for boys and girls	t	2025-08-14 04:12:56.129802	\N	2025-08-14 04:12:56.129802	3	120	\N
1	Boys Hostel Block A	boys	1	50	School Campus, Block A	0712-2345678	Wi-Fi, Mess, Recreation Room, Study Hall	No outside food, Lights out at 10 PM	t	2025-08-14 04:12:56.129802	\N	2025-08-14 04:12:56.129802	3	200	\N
\.

COPY public.houses (id, house_name, house_color, house_captain, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Red House	Red	Captain Red	Red house for competitive activities	t	2025-08-14 04:11:37.32943	\N	2025-08-14 04:11:37.32943
2	Blue House	Blue	Captain Blue	Blue house for competitive activities	t	2025-08-14 04:11:37.32943	\N	2025-08-14 04:11:37.32943
3	Green House	Green	Captain Green	Green house for competitive activities	t	2025-08-14 04:11:37.32943	\N	2025-08-14 04:11:37.32943
4	Falcon House	#1E3A8A	Ayaan Khan	Performance and discipline house	t	2026-04-24 17:36:28.458143	\N	2026-04-24 17:36:28.458143
\.

COPY public.languages (id, language_name, language_code, is_compulsory, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	English	EN	t	Instruction language	t	2026-04-24 17:36:28.458143	\N	2026-04-24 17:36:28.458143
2	Hindi	HI	t	Second language	t	2026-04-24 17:36:28.458143	\N	2026-04-24 17:36:28.458143
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

COPY public.leaving_students (id, student_id, admission_number, student_first_name, student_last_name, joining_class_id, joining_section_id, joining_academic_year_id, joining_date, last_class_id, last_section_id, last_academic_year_id, leaving_date, last_class_result, reason, remarks, left_by, is_active, created_at, created_by, modified_at) FROM stdin;
\.

COPY public.library_book_issues (id, book_id, student_id, staff_id, issue_date, due_date, return_date, fine_amount, status, issued_by, returned_to, remarks, is_active, created_at, created_by, modified_at) FROM stdin;
4	1	1	\N	2024-08-01	2024-08-15	\N	0.00	issued	1	\N	\N	t	2025-08-14 04:34:54.955265	\N	2025-08-14 04:34:54.955265
5	3	2	\N	2024-08-02	2024-08-16	\N	0.00	issued	1	\N	\N	t	2025-08-14 04:34:54.955265	\N	2025-08-14 04:34:54.955265
6	2	3	\N	2024-08-05	2024-08-19	\N	0.00	returned	1	\N	\N	t	2025-08-14 04:34:54.955265	\N	2025-08-14 04:34:54.955265
\.

COPY public.library_books (id, book_title, author, isbn, publisher, publication_year, category_id, total_copies, available_copies, book_price, book_location, description, is_active, created_at, created_by, modified_at, book_code, academic_year_id) FROM stdin;
1	The Very Hungry Caterpillar	Eric Carle	9780399226908	Penguin Books	2018	1	5	4	250.00	Shelf A1	Popular children picture book	t	2025-08-14 04:34:45.05493	\N	2025-08-14 04:34:45.05493	\N	3
2	First Encyclopedia	DK Publishing	9781465454300	DK Children	2019	2	3	3	800.00	Shelf R1	Reference book for young learners	t	2025-08-14 04:34:45.05493	\N	2025-08-14 04:34:45.05493	\N	3
3	Goodnight Moon	Margaret Wise Brown	9780064430173	Harper Collins	2017	3	3	2	200.00	Shelf A2	Classic bedtime story	t	2025-08-14 04:34:45.05493	\N	2025-08-14 04:34:45.05493	\N	3
\.

COPY public.library_categories (id, category_name, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Fiction	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
2	Non-Fiction	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
3	Academic	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
4	Children Books	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
5	Reference	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
6	Magazines	\N	t	2025-08-14 03:23:36.183628	\N	2025-08-14 03:23:36.183628
\.

COPY public.library_members (id, member_type, student_id, staff_id, card_number, date_joined, is_active, created_at, created_by, modified_at, academic_year_id) FROM stdin;
\.

COPY public.medical_conditions (id, condition_name, description, severity_level, requires_medication, is_active, created_at, created_by, modified_at) FROM stdin;
1	Good	Healthy	low	f	t	2025-08-14 04:30:06.242301	1	2025-08-14 04:30:06.242301
2	Bad	Not healthy	medium	t	t	2025-08-14 04:30:57.930702	1	2025-08-14 04:30:57.930702
3	Other	Other	critical	t	t	2025-08-14 04:31:45.918016	1	2025-08-14 04:31:45.918016
\.

COPY public.mother_tongues (id, language_name, language_code, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Hindi	HI	Hindi language	t	2025-08-14 04:12:04.350894	\N	2025-08-14 04:12:04.350894
2	Marathi	MR	Marathi language	t	2025-08-14 04:12:04.350894	\N	2025-08-14 04:12:04.350894
3	English	EN	English language	t	2025-08-14 04:12:04.350894	\N	2025-08-14 04:12:04.350894
4	Urdu	UR	Urdu language	t	2026-04-24 17:36:28.458143	\N	2026-04-24 17:36:28.458143
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

COPY public.parent_persons (id, full_name, phone, email, address, occupation, created_at, updated_at) FROM stdin;
1	Imran Khan	9700000028	adm.ay3.001.father@myschool.local	Flat 1, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
2	Imran Sharma	9700000029	adm.ay3.002.father@myschool.local	Flat 2, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
3	Imran Patel	9700000030	adm.ay3.003.father@myschool.local	Flat 3, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
4	Imran Ansari	9700000031	adm.ay3.004.father@myschool.local	Flat 4, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
5	Imran Mishra	9700000032	adm.ay3.005.father@myschool.local	Flat 5, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
6	Imran Verma	9700000033	adm.ay3.006.father@myschool.local	Flat 6, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
7	Imran Singh	9700000034	adm.ay3.007.father@myschool.local	Flat 7, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
8	Imran Qureshi	9700000035	adm.ay3.008.father@myschool.local	Flat 8, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
9	Imran Shaikh	9700000036	adm.ay3.009.father@myschool.local	Flat 9, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
10	Imran Gupta	9700000037	adm.ay3.010.father@myschool.local	Flat 10, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
11	Imran Naqvi	9700000038	adm.ay3.011.father@myschool.local	Flat 11, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
12	Imran Malik	9700000039	adm.ay3.012.father@myschool.local	Flat 12, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
13	Imran Rao	9700000040	adm.ay3.013.father@myschool.local	Flat 13, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
14	Imran Joshi	9700000041	adm.ay3.014.father@myschool.local	Flat 14, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
15	Imran Kulkarni	9700000042	adm.ay3.015.father@myschool.local	Flat 15, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
16	Imran Deshmukh	9700000043	adm.ay3.016.father@myschool.local	Flat 16, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
17	Imran Chopra	9700000044	adm.ay3.017.father@myschool.local	Flat 17, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
18	Imran Siddiqui	9700000045	adm.ay3.018.father@myschool.local	Flat 18, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
19	Imran Nair	9700000046	adm.ay3.019.father@myschool.local	Flat 19, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
20	Imran Menon	9700000047	adm.ay3.020.father@myschool.local	Flat 20, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
21	Imran Pathan	9700000048	adm.ay3.021.father@myschool.local	Flat 21, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
22	Imran Bano	9700000049	adm.ay3.022.father@myschool.local	Flat 22, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
23	Imran Rahman	9700000050	adm.ay3.023.father@myschool.local	Flat 23, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
24	Imran Iqbal	9700000051	adm.ay3.024.father@myschool.local	Flat 24, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
25	Imran Hussain	9700000052	adm.ay3.025.father@myschool.local	Flat 25, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
26	Imran Tiwari	9700000053	adm.ay3.026.father@myschool.local	Flat 26, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
27	Imran Yadav	9700000054	adm.ay3.027.father@myschool.local	Flat 27, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
28	Imran Jain	9700000055	adm.ay3.028.father@myschool.local	Flat 28, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
29	Imran Kapoor	9700000056	adm.ay3.029.father@myschool.local	Flat 29, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
30	Imran Bhatt	9700000057	adm.ay3.030.father@myschool.local	Flat 30, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
31	Imran Pillai	9700000058	adm.ay3.031.father@myschool.local	Flat 31, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
32	Imran Thomas	9700000059	adm.ay3.032.father@myschool.local	Flat 32, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
33	Imran Dutta	9700000060	adm.ay3.033.father@myschool.local	Flat 33, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
34	Imran Saxena	9700000061	adm.ay3.034.father@myschool.local	Flat 34, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
35	Imran Trivedi	9700000062	adm.ay3.035.father@myschool.local	Flat 35, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
36	Imran Chauhan	9700000063	adm.ay3.036.father@myschool.local	Flat 36, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
37	Imran Bhardwaj	9700000064	adm.ay3.037.father@myschool.local	Flat 37, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
38	Imran Srivastava	9700000065	adm.ay3.038.father@myschool.local	Flat 38, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
39	Imran Farooqui	9700000066	adm.ay3.039.father@myschool.local	Flat 39, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
40	Imran Kazi	9700000067	adm.ay3.040.father@myschool.local	Flat 40, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
41	Imran Gandhi	9700000068	adm.ay3.041.father@myschool.local	Flat 41, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
42	Imran Parekh	9700000069	adm.ay3.042.father@myschool.local	Flat 42, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
43	Imran Reddy	9700000070	adm.ay3.043.father@myschool.local	Flat 43, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
44	Imran Lodhi	9700000071	adm.ay3.044.father@myschool.local	Flat 44, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
45	Imran Basu	9700000072	adm.ay3.045.father@myschool.local	Flat 45, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
46	Sana Khan	9600000028	adm.ay3.001.mother@myschool.local	Flat 1, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
47	Sana Sharma	9600000029	adm.ay3.002.mother@myschool.local	Flat 2, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
48	Sana Patel	9600000030	adm.ay3.003.mother@myschool.local	Flat 3, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
49	Sana Ansari	9600000031	adm.ay3.004.mother@myschool.local	Flat 4, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
50	Sana Mishra	9600000032	adm.ay3.005.mother@myschool.local	Flat 5, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
51	Sana Verma	9600000033	adm.ay3.006.mother@myschool.local	Flat 6, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
52	Sana Singh	9600000034	adm.ay3.007.mother@myschool.local	Flat 7, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
53	Sana Qureshi	9600000035	adm.ay3.008.mother@myschool.local	Flat 8, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
54	Sana Shaikh	9600000036	adm.ay3.009.mother@myschool.local	Flat 9, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
55	Sana Gupta	9600000037	adm.ay3.010.mother@myschool.local	Flat 10, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
56	Sana Naqvi	9600000038	adm.ay3.011.mother@myschool.local	Flat 11, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
57	Sana Malik	9600000039	adm.ay3.012.mother@myschool.local	Flat 12, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
58	Sana Rao	9600000040	adm.ay3.013.mother@myschool.local	Flat 13, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
59	Sana Joshi	9600000041	adm.ay3.014.mother@myschool.local	Flat 14, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
60	Sana Kulkarni	9600000042	adm.ay3.015.mother@myschool.local	Flat 15, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
61	Sana Deshmukh	9600000043	adm.ay3.016.mother@myschool.local	Flat 16, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
62	Sana Chopra	9600000044	adm.ay3.017.mother@myschool.local	Flat 17, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
63	Sana Siddiqui	9600000045	adm.ay3.018.mother@myschool.local	Flat 18, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
64	Sana Nair	9600000046	adm.ay3.019.mother@myschool.local	Flat 19, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
65	Sana Menon	9600000047	adm.ay3.020.mother@myschool.local	Flat 20, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
66	Sana Pathan	9600000048	adm.ay3.021.mother@myschool.local	Flat 21, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
67	Sana Bano	9600000049	adm.ay3.022.mother@myschool.local	Flat 22, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
68	Sana Rahman	9600000050	adm.ay3.023.mother@myschool.local	Flat 23, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
69	Sana Iqbal	9600000051	adm.ay3.024.mother@myschool.local	Flat 24, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
70	Sana Hussain	9600000052	adm.ay3.025.mother@myschool.local	Flat 25, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
71	Sana Tiwari	9600000053	adm.ay3.026.mother@myschool.local	Flat 26, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
72	Sana Yadav	9600000054	adm.ay3.027.mother@myschool.local	Flat 27, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
73	Sana Jain	9600000055	adm.ay3.028.mother@myschool.local	Flat 28, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
74	Sana Kapoor	9600000056	adm.ay3.029.mother@myschool.local	Flat 29, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
75	Sana Bhatt	9600000057	adm.ay3.030.mother@myschool.local	Flat 30, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
76	Sana Pillai	9600000058	adm.ay3.031.mother@myschool.local	Flat 31, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
77	Sana Thomas	9600000059	adm.ay3.032.mother@myschool.local	Flat 32, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
78	Sana Dutta	9600000060	adm.ay3.033.mother@myschool.local	Flat 33, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
79	Sana Saxena	9600000061	adm.ay3.034.mother@myschool.local	Flat 34, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
80	Sana Trivedi	9600000062	adm.ay3.035.mother@myschool.local	Flat 35, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
81	Sana Chauhan	9600000063	adm.ay3.036.mother@myschool.local	Flat 36, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
82	Sana Bhardwaj	9600000064	adm.ay3.037.mother@myschool.local	Flat 37, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
83	Sana Srivastava	9600000065	adm.ay3.038.mother@myschool.local	Flat 38, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
84	Sana Farooqui	9600000066	adm.ay3.039.mother@myschool.local	Flat 39, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
85	Sana Kazi	9600000067	adm.ay3.040.mother@myschool.local	Flat 40, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
86	Sana Gandhi	9600000068	adm.ay3.041.mother@myschool.local	Flat 41, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
87	Sana Parekh	9600000069	adm.ay3.042.mother@myschool.local	Flat 42, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
88	Sana Reddy	9600000070	adm.ay3.043.mother@myschool.local	Flat 43, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
89	Sana Lodhi	9600000071	adm.ay3.044.mother@myschool.local	Flat 44, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
90	Sana Basu	9600000072	adm.ay3.045.mother@myschool.local	Flat 45, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
91	Rafiq Khan	9500000028	adm.ay3.001.guardian@myschool.local	Flat 1, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
92	Rafiq Sharma	9500000029	adm.ay3.002.guardian@myschool.local	Flat 2, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
93	Rafiq Patel	9500000030	adm.ay3.003.guardian@myschool.local	Flat 3, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
94	Rafiq Ansari	9500000031	adm.ay3.004.guardian@myschool.local	Flat 4, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
95	Rafiq Mishra	9500000032	adm.ay3.005.guardian@myschool.local	Flat 5, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
96	Rafiq Verma	9500000033	adm.ay3.006.guardian@myschool.local	Flat 6, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
97	Rafiq Singh	9500000034	adm.ay3.007.guardian@myschool.local	Flat 7, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
98	Rafiq Qureshi	9500000035	adm.ay3.008.guardian@myschool.local	Flat 8, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
99	Rafiq Shaikh	9500000036	adm.ay3.009.guardian@myschool.local	Flat 9, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
100	Rafiq Gupta	9500000037	adm.ay3.010.guardian@myschool.local	Flat 10, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
101	Rafiq Naqvi	9500000038	adm.ay3.011.guardian@myschool.local	Flat 11, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
102	Rafiq Malik	9500000039	adm.ay3.012.guardian@myschool.local	Flat 12, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
103	Rafiq Rao	9500000040	adm.ay3.013.guardian@myschool.local	Flat 13, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
104	Rafiq Joshi	9500000041	adm.ay3.014.guardian@myschool.local	Flat 14, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
105	Rafiq Kulkarni	9500000042	adm.ay3.015.guardian@myschool.local	Flat 15, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
106	Rafiq Deshmukh	9500000043	adm.ay3.016.guardian@myschool.local	Flat 16, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
107	Rafiq Chopra	9500000044	adm.ay3.017.guardian@myschool.local	Flat 17, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
108	Rafiq Siddiqui	9500000045	adm.ay3.018.guardian@myschool.local	Flat 18, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
109	Rafiq Nair	9500000046	adm.ay3.019.guardian@myschool.local	Flat 19, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
110	Rafiq Menon	9500000047	adm.ay3.020.guardian@myschool.local	Flat 20, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
111	Rafiq Pathan	9500000048	adm.ay3.021.guardian@myschool.local	Flat 21, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
112	Rafiq Bano	9500000049	adm.ay3.022.guardian@myschool.local	Flat 22, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
113	Rafiq Rahman	9500000050	adm.ay3.023.guardian@myschool.local	Flat 23, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
114	Rafiq Iqbal	9500000051	adm.ay3.024.guardian@myschool.local	Flat 24, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
115	Rafiq Hussain	9500000052	adm.ay3.025.guardian@myschool.local	Flat 25, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
116	Rafiq Tiwari	9500000053	adm.ay3.026.guardian@myschool.local	Flat 26, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
117	Rafiq Yadav	9500000054	adm.ay3.027.guardian@myschool.local	Flat 27, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
118	Rafiq Jain	9500000055	adm.ay3.028.guardian@myschool.local	Flat 28, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
119	Rafiq Kapoor	9500000056	adm.ay3.029.guardian@myschool.local	Flat 29, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
120	Rafiq Bhatt	9500000057	adm.ay3.030.guardian@myschool.local	Flat 30, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
121	Rafiq Pillai	9500000058	adm.ay3.031.guardian@myschool.local	Flat 31, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
122	Rafiq Thomas	9500000059	adm.ay3.032.guardian@myschool.local	Flat 32, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
123	Rafiq Dutta	9500000060	adm.ay3.033.guardian@myschool.local	Flat 33, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
124	Rafiq Saxena	9500000061	adm.ay3.034.guardian@myschool.local	Flat 34, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
125	Rafiq Trivedi	9500000062	adm.ay3.035.guardian@myschool.local	Flat 35, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
126	Rafiq Chauhan	9500000063	adm.ay3.036.guardian@myschool.local	Flat 36, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
127	Rafiq Bhardwaj	9500000064	adm.ay3.037.guardian@myschool.local	Flat 37, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
128	Rafiq Srivastava	9500000065	adm.ay3.038.guardian@myschool.local	Flat 38, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
129	Rafiq Farooqui	9500000066	adm.ay3.039.guardian@myschool.local	Flat 39, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
130	Rafiq Kazi	9500000067	adm.ay3.040.guardian@myschool.local	Flat 40, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
131	Rafiq Gandhi	9500000068	adm.ay3.041.guardian@myschool.local	Flat 41, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
132	Rafiq Parekh	9500000069	adm.ay3.042.guardian@myschool.local	Flat 42, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
133	Rafiq Reddy	9500000070	adm.ay3.043.guardian@myschool.local	Flat 43, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
134	Rafiq Lodhi	9500000071	adm.ay3.044.guardian@myschool.local	Flat 44, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
135	Rafiq Basu	9500000072	adm.ay3.045.guardian@myschool.local	Flat 45, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:28.458143+05:30	2026-04-24 17:36:28.458143+05:30
136	Imran Jain	9700000073	adm.ay2.028.father@myschool.local	Flat 28, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
137	Imran Chopra	9700000074	adm.ay2.017.father@myschool.local	Flat 17, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
138	Imran Parekh	9700000075	adm.ay2.042.father@myschool.local	Flat 42, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
139	Imran Menon	9700000076	adm.ay1.020.father@myschool.local	Flat 20, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
141	Imran Patel	9700000078	adm.ay1.003.father@myschool.local	Flat 3, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
142	Imran Nair	9700000079	adm.ay1.019.father@myschool.local	Flat 19, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
143	Imran Bano	9700000080	adm.ay2.022.father@myschool.local	Flat 22, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
145	Imran Tiwari	9700000082	adm.ay1.026.father@myschool.local	Flat 26, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
146	Imran Kazi	9700000083	adm.ay1.040.father@myschool.local	Flat 40, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
149	Imran Bhardwaj	9700000086	adm.ay2.037.father@myschool.local	Flat 37, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
151	Imran Verma	9700000088	adm.ay2.006.father@myschool.local	Flat 6, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
152	Imran Nair	9700000089	adm.ay2.019.father@myschool.local	Flat 19, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
153	Imran Shaikh	9700000090	adm.ay2.009.father@myschool.local	Flat 9, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
155	Imran Kapoor	9700000092	adm.ay2.029.father@myschool.local	Flat 29, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
156	Imran Bhatt	9700000093	adm.ay1.030.father@myschool.local	Flat 30, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
158	Imran Dutta	9700000095	adm.ay2.033.father@myschool.local	Flat 33, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
159	Imran Malik	9700000096	adm.ay2.012.father@myschool.local	Flat 12, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
161	Imran Kulkarni	9700000098	adm.ay1.015.father@myschool.local	Flat 15, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
162	Imran Siddiqui	9700000099	adm.ay2.018.father@myschool.local	Flat 18, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
163	Imran Gupta	9700000100	adm.ay1.010.father@myschool.local	Flat 10, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
164	Imran Pathan	9700000101	adm.ay2.021.father@myschool.local	Flat 21, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
165	Imran Dutta	9700000102	adm.ay1.033.father@myschool.local	Flat 33, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
166	Imran Srivastava	9700000103	adm.ay1.038.father@myschool.local	Flat 38, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
167	Imran Parekh	9700000104	adm.ay1.042.father@myschool.local	Flat 42, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
168	Imran Chopra	9700000105	adm.ay1.017.father@myschool.local	Flat 17, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
170	Imran Verma	9700000107	adm.ay1.006.father@myschool.local	Flat 6, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
172	Imran Pathan	9700000109	adm.ay1.021.father@myschool.local	Flat 21, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
173	Imran Siddiqui	9700000110	adm.ay1.018.father@myschool.local	Flat 18, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
174	Imran Bhatt	9700000111	adm.ay2.030.father@myschool.local	Flat 30, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
175	Imran Hussain	9700000112	adm.ay1.025.father@myschool.local	Flat 25, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
177	Imran Basu	9700000114	adm.ay1.045.father@myschool.local	Flat 45, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
178	Imran Qureshi	9700000115	adm.ay1.008.father@myschool.local	Flat 8, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
179	Imran Chauhan	9700000116	adm.ay1.036.father@myschool.local	Flat 36, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
180	Imran Lodhi	9700000117	adm.ay2.044.father@myschool.local	Flat 44, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
181	Imran Patel	9700000118	adm.ay2.003.father@myschool.local	Flat 3, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
183	Imran Srivastava	9700000120	adm.ay2.038.father@myschool.local	Flat 38, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
185	Imran Joshi	9700000122	adm.ay1.014.father@myschool.local	Flat 14, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
186	Imran Saxena	9700000123	adm.ay2.034.father@myschool.local	Flat 34, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
187	Imran Rahman	9700000124	adm.ay1.023.father@myschool.local	Flat 23, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
188	Imran Ansari	9700000125	adm.ay2.004.father@myschool.local	Flat 4, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
189	Imran Iqbal	9700000126	adm.ay1.024.father@myschool.local	Flat 24, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
190	Imran Sharma	9700000127	adm.ay1.002.father@myschool.local	Flat 2, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
192	Imran Naqvi	9700000129	adm.ay1.011.father@myschool.local	Flat 11, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
193	Imran Iqbal	9700000130	adm.ay2.024.father@myschool.local	Flat 24, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
194	Imran Tiwari	9700000131	adm.ay2.026.father@myschool.local	Flat 26, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
195	Imran Pillai	9700000132	adm.ay2.031.father@myschool.local	Flat 31, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
197	Imran Lodhi	9700000134	adm.ay1.044.father@myschool.local	Flat 44, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
198	Imran Rao	9700000135	adm.ay2.013.father@myschool.local	Flat 13, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
200	Imran Chauhan	9700000137	adm.ay2.036.father@myschool.local	Flat 36, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
202	Imran Singh	9700000139	adm.ay1.007.father@myschool.local	Flat 7, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
204	Imran Singh	9700000141	adm.ay2.007.father@myschool.local	Flat 7, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
205	Imran Farooqui	9700000142	adm.ay1.039.father@myschool.local	Flat 39, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
206	Imran Trivedi	9700000143	adm.ay2.035.father@myschool.local	Flat 35, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
207	Imran Trivedi	9700000144	adm.ay1.035.father@myschool.local	Flat 35, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
208	Imran Kapoor	9700000145	adm.ay1.029.father@myschool.local	Flat 29, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
211	Imran Yadav	9700000148	adm.ay1.027.father@myschool.local	Flat 27, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
212	Imran Rahman	9700000149	adm.ay2.023.father@myschool.local	Flat 23, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
216	Imran Bano	9700000153	adm.ay1.022.father@myschool.local	Flat 22, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
217	Imran Khan	9700000154	adm.ay2.001.father@myschool.local	Flat 1, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
218	Imran Saxena	9700000155	adm.ay1.034.father@myschool.local	Flat 34, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
222	Imran Thomas	9700000159	adm.ay1.032.father@myschool.local	Flat 32, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
225	Imran Khan	9700000162	adm.ay1.001.father@myschool.local	Flat 1, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
226	Imran Jain	9700000163	adm.ay1.028.father@myschool.local	Flat 28, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
228	Imran Kazi	9700000165	adm.ay2.040.father@myschool.local	Flat 40, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
231	Imran Mishra	9700000168	adm.ay1.005.father@myschool.local	Flat 5, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
232	Imran Hussain	9700000169	adm.ay2.025.father@myschool.local	Flat 25, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
233	Imran Naqvi	9700000170	adm.ay2.011.father@myschool.local	Flat 11, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
237	Imran Yadav	9700000174	adm.ay2.027.father@myschool.local	Flat 27, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
239	Imran Gandhi	9700000176	adm.ay1.041.father@myschool.local	Flat 41, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
240	Imran Kulkarni	9700000177	adm.ay2.015.father@myschool.local	Flat 15, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
241	Imran Rao	9700000178	adm.ay1.013.father@myschool.local	Flat 13, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
242	Imran Sharma	9700000179	adm.ay2.002.father@myschool.local	Flat 2, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
245	Imran Reddy	9700000182	adm.ay2.043.father@myschool.local	Flat 43, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
246	Imran Gupta	9700000183	adm.ay2.010.father@myschool.local	Flat 10, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
249	Imran Ansari	9700000186	adm.ay1.004.father@myschool.local	Flat 4, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
250	Imran Thomas	9700000187	adm.ay2.032.father@myschool.local	Flat 32, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
251	Imran Shaikh	9700000188	adm.ay1.009.father@myschool.local	Flat 9, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
253	Imran Pillai	9700000190	adm.ay1.031.father@myschool.local	Flat 31, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
254	Imran Deshmukh	9700000191	adm.ay2.016.father@myschool.local	Flat 16, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
255	Imran Basu	9700000192	adm.ay2.045.father@myschool.local	Flat 45, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
256	Imran Deshmukh	9700000193	adm.ay1.016.father@myschool.local	Flat 16, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
259	Imran Reddy	9700000196	adm.ay1.043.father@myschool.local	Flat 43, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
260	Imran Mishra	9700000197	adm.ay2.005.father@myschool.local	Flat 5, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
262	Imran Gandhi	9700000199	adm.ay2.041.father@myschool.local	Flat 41, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
263	Imran Qureshi	9700000200	adm.ay2.008.father@myschool.local	Flat 8, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
264	Imran Menon	9700000201	adm.ay2.020.father@myschool.local	Flat 20, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
265	Imran Joshi	9700000202	adm.ay2.014.father@myschool.local	Flat 14, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
266	Imran Malik	9700000203	adm.ay1.012.father@myschool.local	Flat 12, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
267	Imran Bhardwaj	9700000204	adm.ay1.037.father@myschool.local	Flat 37, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
270	Imran Farooqui	9700000207	adm.ay2.039.father@myschool.local	Flat 39, Green Residency, Civil Lines	Business Owner	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
271	Sana Jain	9600000073	adm.ay2.028.mother@myschool.local	Flat 28, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
272	Sana Chopra	9600000074	adm.ay2.017.mother@myschool.local	Flat 17, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
273	Sana Parekh	9600000075	adm.ay2.042.mother@myschool.local	Flat 42, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
274	Sana Menon	9600000076	adm.ay1.020.mother@myschool.local	Flat 20, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
276	Sana Patel	9600000078	adm.ay1.003.mother@myschool.local	Flat 3, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
277	Sana Nair	9600000079	adm.ay1.019.mother@myschool.local	Flat 19, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
278	Sana Bano	9600000080	adm.ay2.022.mother@myschool.local	Flat 22, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
280	Sana Tiwari	9600000082	adm.ay1.026.mother@myschool.local	Flat 26, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
281	Sana Kazi	9600000083	adm.ay1.040.mother@myschool.local	Flat 40, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
284	Sana Bhardwaj	9600000086	adm.ay2.037.mother@myschool.local	Flat 37, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
286	Sana Verma	9600000088	adm.ay2.006.mother@myschool.local	Flat 6, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
287	Sana Nair	9600000089	adm.ay2.019.mother@myschool.local	Flat 19, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
288	Sana Shaikh	9600000090	adm.ay2.009.mother@myschool.local	Flat 9, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
290	Sana Kapoor	9600000092	adm.ay2.029.mother@myschool.local	Flat 29, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
291	Sana Bhatt	9600000093	adm.ay1.030.mother@myschool.local	Flat 30, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
293	Sana Dutta	9600000095	adm.ay2.033.mother@myschool.local	Flat 33, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
294	Sana Malik	9600000096	adm.ay2.012.mother@myschool.local	Flat 12, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
296	Sana Kulkarni	9600000098	adm.ay1.015.mother@myschool.local	Flat 15, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
297	Sana Siddiqui	9600000099	adm.ay2.018.mother@myschool.local	Flat 18, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
298	Sana Gupta	9600000100	adm.ay1.010.mother@myschool.local	Flat 10, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
299	Sana Pathan	9600000101	adm.ay2.021.mother@myschool.local	Flat 21, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
300	Sana Dutta	9600000102	adm.ay1.033.mother@myschool.local	Flat 33, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
301	Sana Srivastava	9600000103	adm.ay1.038.mother@myschool.local	Flat 38, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
302	Sana Parekh	9600000104	adm.ay1.042.mother@myschool.local	Flat 42, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
303	Sana Chopra	9600000105	adm.ay1.017.mother@myschool.local	Flat 17, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
305	Sana Verma	9600000107	adm.ay1.006.mother@myschool.local	Flat 6, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
307	Sana Pathan	9600000109	adm.ay1.021.mother@myschool.local	Flat 21, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
308	Sana Siddiqui	9600000110	adm.ay1.018.mother@myschool.local	Flat 18, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
309	Sana Bhatt	9600000111	adm.ay2.030.mother@myschool.local	Flat 30, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
310	Sana Hussain	9600000112	adm.ay1.025.mother@myschool.local	Flat 25, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
312	Sana Basu	9600000114	adm.ay1.045.mother@myschool.local	Flat 45, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
313	Sana Qureshi	9600000115	adm.ay1.008.mother@myschool.local	Flat 8, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
314	Sana Chauhan	9600000116	adm.ay1.036.mother@myschool.local	Flat 36, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
315	Sana Lodhi	9600000117	adm.ay2.044.mother@myschool.local	Flat 44, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
316	Sana Patel	9600000118	adm.ay2.003.mother@myschool.local	Flat 3, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
318	Sana Srivastava	9600000120	adm.ay2.038.mother@myschool.local	Flat 38, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
320	Sana Joshi	9600000122	adm.ay1.014.mother@myschool.local	Flat 14, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
321	Sana Saxena	9600000123	adm.ay2.034.mother@myschool.local	Flat 34, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
322	Sana Rahman	9600000124	adm.ay1.023.mother@myschool.local	Flat 23, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
323	Sana Ansari	9600000125	adm.ay2.004.mother@myschool.local	Flat 4, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
324	Sana Iqbal	9600000126	adm.ay1.024.mother@myschool.local	Flat 24, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
325	Sana Sharma	9600000127	adm.ay1.002.mother@myschool.local	Flat 2, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
327	Sana Naqvi	9600000129	adm.ay1.011.mother@myschool.local	Flat 11, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
328	Sana Iqbal	9600000130	adm.ay2.024.mother@myschool.local	Flat 24, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
329	Sana Tiwari	9600000131	adm.ay2.026.mother@myschool.local	Flat 26, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
330	Sana Pillai	9600000132	adm.ay2.031.mother@myschool.local	Flat 31, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
332	Sana Lodhi	9600000134	adm.ay1.044.mother@myschool.local	Flat 44, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
333	Sana Rao	9600000135	adm.ay2.013.mother@myschool.local	Flat 13, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
335	Sana Chauhan	9600000137	adm.ay2.036.mother@myschool.local	Flat 36, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
337	Sana Singh	9600000139	adm.ay1.007.mother@myschool.local	Flat 7, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
339	Sana Singh	9600000141	adm.ay2.007.mother@myschool.local	Flat 7, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
340	Sana Farooqui	9600000142	adm.ay1.039.mother@myschool.local	Flat 39, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
341	Sana Trivedi	9600000143	adm.ay2.035.mother@myschool.local	Flat 35, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
342	Sana Trivedi	9600000144	adm.ay1.035.mother@myschool.local	Flat 35, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
343	Sana Kapoor	9600000145	adm.ay1.029.mother@myschool.local	Flat 29, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
346	Sana Yadav	9600000148	adm.ay1.027.mother@myschool.local	Flat 27, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
347	Sana Rahman	9600000149	adm.ay2.023.mother@myschool.local	Flat 23, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
351	Sana Bano	9600000153	adm.ay1.022.mother@myschool.local	Flat 22, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
352	Sana Khan	9600000154	adm.ay2.001.mother@myschool.local	Flat 1, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
353	Sana Saxena	9600000155	adm.ay1.034.mother@myschool.local	Flat 34, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
357	Sana Thomas	9600000159	adm.ay1.032.mother@myschool.local	Flat 32, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
360	Sana Khan	9600000162	adm.ay1.001.mother@myschool.local	Flat 1, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
361	Sana Jain	9600000163	adm.ay1.028.mother@myschool.local	Flat 28, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
363	Sana Kazi	9600000165	adm.ay2.040.mother@myschool.local	Flat 40, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
366	Sana Mishra	9600000168	adm.ay1.005.mother@myschool.local	Flat 5, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
367	Sana Hussain	9600000169	adm.ay2.025.mother@myschool.local	Flat 25, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
368	Sana Naqvi	9600000170	adm.ay2.011.mother@myschool.local	Flat 11, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
372	Sana Yadav	9600000174	adm.ay2.027.mother@myschool.local	Flat 27, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
374	Sana Gandhi	9600000176	adm.ay1.041.mother@myschool.local	Flat 41, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
375	Sana Kulkarni	9600000177	adm.ay2.015.mother@myschool.local	Flat 15, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
376	Sana Rao	9600000178	adm.ay1.013.mother@myschool.local	Flat 13, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
377	Sana Sharma	9600000179	adm.ay2.002.mother@myschool.local	Flat 2, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
380	Sana Reddy	9600000182	adm.ay2.043.mother@myschool.local	Flat 43, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
381	Sana Gupta	9600000183	adm.ay2.010.mother@myschool.local	Flat 10, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
384	Sana Ansari	9600000186	adm.ay1.004.mother@myschool.local	Flat 4, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
385	Sana Thomas	9600000187	adm.ay2.032.mother@myschool.local	Flat 32, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
386	Sana Shaikh	9600000188	adm.ay1.009.mother@myschool.local	Flat 9, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
388	Sana Pillai	9600000190	adm.ay1.031.mother@myschool.local	Flat 31, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
389	Sana Deshmukh	9600000191	adm.ay2.016.mother@myschool.local	Flat 16, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
390	Sana Basu	9600000192	adm.ay2.045.mother@myschool.local	Flat 45, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
391	Sana Deshmukh	9600000193	adm.ay1.016.mother@myschool.local	Flat 16, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
394	Sana Reddy	9600000196	adm.ay1.043.mother@myschool.local	Flat 43, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
395	Sana Mishra	9600000197	adm.ay2.005.mother@myschool.local	Flat 5, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
397	Sana Gandhi	9600000199	adm.ay2.041.mother@myschool.local	Flat 41, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
398	Sana Qureshi	9600000200	adm.ay2.008.mother@myschool.local	Flat 8, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
399	Sana Menon	9600000201	adm.ay2.020.mother@myschool.local	Flat 20, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
400	Sana Joshi	9600000202	adm.ay2.014.mother@myschool.local	Flat 14, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
401	Sana Malik	9600000203	adm.ay1.012.mother@myschool.local	Flat 12, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
402	Sana Bhardwaj	9600000204	adm.ay1.037.mother@myschool.local	Flat 37, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
405	Sana Farooqui	9600000207	adm.ay2.039.mother@myschool.local	Flat 39, Green Residency, Civil Lines	Teacher	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
451	Rafiq Jain	9500000073	adm.ay2.028.guardian@myschool.local	Flat 28, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
452	Rafiq Chopra	9500000074	adm.ay2.017.guardian@myschool.local	Flat 17, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
453	Rafiq Parekh	9500000075	adm.ay2.042.guardian@myschool.local	Flat 42, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
454	Rafiq Menon	9500000076	adm.ay1.020.guardian@myschool.local	Flat 20, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
455	Rafiq Patel	9500000078	adm.ay1.003.guardian@myschool.local	Flat 3, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
456	Rafiq Nair	9500000079	adm.ay1.019.guardian@myschool.local	Flat 19, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
457	Rafiq Bano	9500000080	adm.ay2.022.guardian@myschool.local	Flat 22, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
458	Rafiq Tiwari	9500000082	adm.ay1.026.guardian@myschool.local	Flat 26, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
459	Rafiq Kazi	9500000083	adm.ay1.040.guardian@myschool.local	Flat 40, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
460	Rafiq Bhardwaj	9500000086	adm.ay2.037.guardian@myschool.local	Flat 37, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
461	Rafiq Verma	9500000088	adm.ay2.006.guardian@myschool.local	Flat 6, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
462	Rafiq Nair	9500000089	adm.ay2.019.guardian@myschool.local	Flat 19, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
463	Rafiq Shaikh	9500000090	adm.ay2.009.guardian@myschool.local	Flat 9, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
464	Rafiq Kapoor	9500000092	adm.ay2.029.guardian@myschool.local	Flat 29, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
465	Rafiq Bhatt	9500000093	adm.ay1.030.guardian@myschool.local	Flat 30, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
466	Rafiq Dutta	9500000095	adm.ay2.033.guardian@myschool.local	Flat 33, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
467	Rafiq Malik	9500000096	adm.ay2.012.guardian@myschool.local	Flat 12, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
468	Rafiq Kulkarni	9500000098	adm.ay1.015.guardian@myschool.local	Flat 15, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
469	Rafiq Siddiqui	9500000099	adm.ay2.018.guardian@myschool.local	Flat 18, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
470	Rafiq Gupta	9500000100	adm.ay1.010.guardian@myschool.local	Flat 10, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
471	Rafiq Pathan	9500000101	adm.ay2.021.guardian@myschool.local	Flat 21, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
472	Rafiq Dutta	9500000102	adm.ay1.033.guardian@myschool.local	Flat 33, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
473	Rafiq Srivastava	9500000103	adm.ay1.038.guardian@myschool.local	Flat 38, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
474	Rafiq Parekh	9500000104	adm.ay1.042.guardian@myschool.local	Flat 42, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
475	Rafiq Chopra	9500000105	adm.ay1.017.guardian@myschool.local	Flat 17, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
476	Rafiq Verma	9500000107	adm.ay1.006.guardian@myschool.local	Flat 6, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
477	Rafiq Pathan	9500000109	adm.ay1.021.guardian@myschool.local	Flat 21, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
478	Rafiq Siddiqui	9500000110	adm.ay1.018.guardian@myschool.local	Flat 18, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
479	Rafiq Bhatt	9500000111	adm.ay2.030.guardian@myschool.local	Flat 30, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
480	Rafiq Hussain	9500000112	adm.ay1.025.guardian@myschool.local	Flat 25, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
481	Rafiq Basu	9500000114	adm.ay1.045.guardian@myschool.local	Flat 45, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
482	Rafiq Qureshi	9500000115	adm.ay1.008.guardian@myschool.local	Flat 8, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
483	Rafiq Chauhan	9500000116	adm.ay1.036.guardian@myschool.local	Flat 36, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
484	Rafiq Lodhi	9500000117	adm.ay2.044.guardian@myschool.local	Flat 44, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
485	Rafiq Patel	9500000118	adm.ay2.003.guardian@myschool.local	Flat 3, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
486	Rafiq Srivastava	9500000120	adm.ay2.038.guardian@myschool.local	Flat 38, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
487	Rafiq Joshi	9500000122	adm.ay1.014.guardian@myschool.local	Flat 14, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
488	Rafiq Saxena	9500000123	adm.ay2.034.guardian@myschool.local	Flat 34, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
489	Rafiq Rahman	9500000124	adm.ay1.023.guardian@myschool.local	Flat 23, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
490	Rafiq Ansari	9500000125	adm.ay2.004.guardian@myschool.local	Flat 4, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
491	Rafiq Iqbal	9500000126	adm.ay1.024.guardian@myschool.local	Flat 24, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
492	Rafiq Sharma	9500000127	adm.ay1.002.guardian@myschool.local	Flat 2, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
493	Rafiq Naqvi	9500000129	adm.ay1.011.guardian@myschool.local	Flat 11, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
494	Rafiq Iqbal	9500000130	adm.ay2.024.guardian@myschool.local	Flat 24, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
495	Rafiq Tiwari	9500000131	adm.ay2.026.guardian@myschool.local	Flat 26, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
496	Rafiq Pillai	9500000132	adm.ay2.031.guardian@myschool.local	Flat 31, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
497	Rafiq Lodhi	9500000134	adm.ay1.044.guardian@myschool.local	Flat 44, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
498	Rafiq Rao	9500000135	adm.ay2.013.guardian@myschool.local	Flat 13, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
499	Rafiq Chauhan	9500000137	adm.ay2.036.guardian@myschool.local	Flat 36, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
500	Rafiq Singh	9500000139	adm.ay1.007.guardian@myschool.local	Flat 7, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
501	Rafiq Singh	9500000141	adm.ay2.007.guardian@myschool.local	Flat 7, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
502	Rafiq Farooqui	9500000142	adm.ay1.039.guardian@myschool.local	Flat 39, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
503	Rafiq Trivedi	9500000143	adm.ay2.035.guardian@myschool.local	Flat 35, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
504	Rafiq Trivedi	9500000144	adm.ay1.035.guardian@myschool.local	Flat 35, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
505	Rafiq Kapoor	9500000145	adm.ay1.029.guardian@myschool.local	Flat 29, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
506	Rafiq Yadav	9500000148	adm.ay1.027.guardian@myschool.local	Flat 27, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
507	Rafiq Rahman	9500000149	adm.ay2.023.guardian@myschool.local	Flat 23, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
508	Rafiq Bano	9500000153	adm.ay1.022.guardian@myschool.local	Flat 22, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
509	Rafiq Khan	9500000154	adm.ay2.001.guardian@myschool.local	Flat 1, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
510	Rafiq Saxena	9500000155	adm.ay1.034.guardian@myschool.local	Flat 34, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
511	Rafiq Thomas	9500000159	adm.ay1.032.guardian@myschool.local	Flat 32, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
512	Rafiq Khan	9500000162	adm.ay1.001.guardian@myschool.local	Flat 1, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
513	Rafiq Jain	9500000163	adm.ay1.028.guardian@myschool.local	Flat 28, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
514	Rafiq Kazi	9500000165	adm.ay2.040.guardian@myschool.local	Flat 40, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
515	Rafiq Mishra	9500000168	adm.ay1.005.guardian@myschool.local	Flat 5, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
516	Rafiq Hussain	9500000169	adm.ay2.025.guardian@myschool.local	Flat 25, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
517	Rafiq Naqvi	9500000170	adm.ay2.011.guardian@myschool.local	Flat 11, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
518	Rafiq Yadav	9500000174	adm.ay2.027.guardian@myschool.local	Flat 27, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
519	Rafiq Gandhi	9500000176	adm.ay1.041.guardian@myschool.local	Flat 41, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
520	Rafiq Kulkarni	9500000177	adm.ay2.015.guardian@myschool.local	Flat 15, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
521	Rafiq Rao	9500000178	adm.ay1.013.guardian@myschool.local	Flat 13, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
522	Rafiq Sharma	9500000179	adm.ay2.002.guardian@myschool.local	Flat 2, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
523	Rafiq Reddy	9500000182	adm.ay2.043.guardian@myschool.local	Flat 43, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
524	Rafiq Gupta	9500000183	adm.ay2.010.guardian@myschool.local	Flat 10, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
525	Rafiq Ansari	9500000186	adm.ay1.004.guardian@myschool.local	Flat 4, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
526	Rafiq Thomas	9500000187	adm.ay2.032.guardian@myschool.local	Flat 32, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
527	Rafiq Shaikh	9500000188	adm.ay1.009.guardian@myschool.local	Flat 9, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
528	Rafiq Pillai	9500000190	adm.ay1.031.guardian@myschool.local	Flat 31, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
529	Rafiq Deshmukh	9500000191	adm.ay2.016.guardian@myschool.local	Flat 16, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
530	Rafiq Basu	9500000192	adm.ay2.045.guardian@myschool.local	Flat 45, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
531	Rafiq Deshmukh	9500000193	adm.ay1.016.guardian@myschool.local	Flat 16, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
532	Rafiq Reddy	9500000196	adm.ay1.043.guardian@myschool.local	Flat 43, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
533	Rafiq Mishra	9500000197	adm.ay2.005.guardian@myschool.local	Flat 5, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
534	Rafiq Gandhi	9500000199	adm.ay2.041.guardian@myschool.local	Flat 41, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
535	Rafiq Qureshi	9500000200	adm.ay2.008.guardian@myschool.local	Flat 8, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
536	Rafiq Menon	9500000201	adm.ay2.020.guardian@myschool.local	Flat 20, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
537	Rafiq Joshi	9500000202	adm.ay2.014.guardian@myschool.local	Flat 14, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
538	Rafiq Malik	9500000203	adm.ay1.012.guardian@myschool.local	Flat 12, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
539	Rafiq Bhardwaj	9500000204	adm.ay1.037.guardian@myschool.local	Flat 37, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
540	Rafiq Farooqui	9500000207	adm.ay2.039.guardian@myschool.local	Flat 39, Green Residency, Civil Lines	Supervisor	2026-04-24 17:36:31.826133+05:30	2026-04-24 17:36:31.826133+05:30
\.

COPY public.parents (id, student_id, father_name, father_email, father_phone, father_occupation, father_image_url, mother_name, mother_email, mother_phone, mother_occupation, mother_image_url, created_at, updated_at, user_id, father_user_id, mother_user_id) FROM stdin;
2	2	Amit Singh	amit.parent@email.com	9898989898	Business Owner	\N	Sunita Singh	sunita.singh@email.com	+91-8765432108	Doctor	\N	2025-08-15 03:58:01.677019+05:30	2026-02-21 12:20:09.199602+05:30	\N	\N	\N
3	3	Vikram Patel	vikram.parent@email.com	9898989898	Bank Manager	\N	Meera Patel	meera.patel@email.com	+91-7654321097	Homemaker	\N	2025-08-15 03:58:01.677019+05:30	2026-03-04 11:15:54.938815+05:30	\N	\N	\N
4	16	Aamir Khan	aamir.parent@email.com	9898989898	Updated Test Job	\N	Haika Khan	haika@school.com	9898989898	test	\N	2025-08-17 04:42:14.216513+05:30	2026-03-08 12:50:28.302508+05:30	\N	\N	\N
1	1	Rajesh Kumar	rajesh.parent@email.com	9876501111	Software Engineer	\N	Priya Kumar	priya.kumar@email.com	+91-9876543211	School Principal	\N	2025-08-15 03:58:01.677019+05:30	2026-03-08 12:53:38.981468+05:30	\N	\N	\N
\.

COPY public.pickup_points (id, point_name, route_id, address, landmark, pickup_time, drop_time, distance_from_school, sequence_order, is_active, created_at, created_by, modified_at, deleted_at, updated_at) FROM stdin;
2	Sadar Market	2	Sadar Bazaar, Nagpur	Near Main Market	07:10:00	14:20:00	12.30	1	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416	\N	2026-04-24 17:36:28.145919+05:30
3	Civil Lines Metro	3	Civil Lines Metro Station	Metro Station	07:20:00	14:10:00	8.70	1	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416	\N	2026-04-24 17:36:28.145919+05:30
1	Sitabuldi Square	1	Sitabuldi Square, Nagpur	Near GPO	07:00:00	14:30:00	15.50	1	t	2025-08-14 04:12:16.81416	\N	2026-02-17 16:20:50.785115	\N	2026-04-24 17:36:28.145919+05:30
\.

COPY public.religions (id, religion_name, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Hinduism	Hindu religion	t	2025-08-14 04:11:49.000899	\N	2025-08-14 04:11:49.000899
2	Islam	Islamic religion	t	2025-08-14 04:11:49.000899	\N	2025-08-14 04:11:49.000899
3	Christianity	Christian religion	t	2025-08-14 04:11:49.000899	\N	2025-08-14 04:11:49.000899
\.

COPY public.reports (id, user_id, reported_user_id, reason, created_at) FROM stdin;
\.

COPY public.room_types (id, room_type, description, max_occupancy, room_fee, is_active, created_at, created_by, modified_at) FROM stdin;
1	Single	Single occupancy room	1	8000.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
2	Double	Double occupancy room	2	6000.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
3	Triple	Triple occupancy room	3	4500.00	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416
\.

COPY public.route_stops (id, route_id, pickup_point_id, pickup_time, drop_time, order_index, academic_year_id, created_at, updated_at, deleted_at) FROM stdin;
\.

COPY public.routes (id, route_name, route_code, start_point, end_point, total_distance, estimated_time, route_fee, description, is_active, created_at, created_by, modified_at, deleted_at, updated_at) FROM stdin;
2	Route 2 - Sadar	RT002	Sadar Market	School	12.30	35	2200.00	Route covering Sadar area	t	2025-08-14 04:12:09.365493	\N	2025-08-14 04:12:09.365493	\N	2026-04-24 17:36:28.145919+05:30
3	Route 3 - Civil Lines	RT003	Civil Lines	School	8.70	25	1800.00	Route covering Civil Lines area	t	2025-08-14 04:12:09.365493	\N	2025-08-14 04:12:09.365493	\N	2026-04-24 17:36:28.145919+05:30
1	Route 1 - Sitabuldi	RT001	Sitabuldi Square	School	15.50	45	2500.00	Route covering Sitabuldi area	t	2025-08-14 04:12:09.365493	\N	2026-02-17 16:09:29.728471	\N	2026-04-24 17:36:28.145919+05:30
\.

COPY public.school_profile (id, school_name, logo_url, created_at, updated_at, phone, email, fax, address) FROM stdin;
\.

COPY public.sections (id, section_name, class_id, section_teacher_id, max_students, room_number, description, is_active, created_at, created_by, modified_at, academic_year_id) FROM stdin;
20	Aurum	27	1	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
21	Cedar	27	1	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
22	Maple	27	2	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
23	Aurum	28	2	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
24	Cedar	28	3	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
25	Maple	28	3	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
3	C	3	\N	30	R301	UKG Section A	t	2025-08-14 04:11:31.102661	\N	2026-04-24 17:36:26.807515	1
1	A	1	\N	25	R101	Nursery Section A	t	2025-08-14 04:11:31.102661	\N	2026-04-24 17:36:26.807515	1
2	B	2	\N	25	R201	LKG Section A	t	2025-08-14 04:11:31.102661	\N	2026-04-24 17:36:26.807515	1
26	Aurum	29	\N	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
27	Cedar	29	\N	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
28	Maple	29	\N	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
35	Aurum	32	\N	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
36	Cedar	32	\N	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
37	Maple	32	\N	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
29	Aurum	30	1	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
30	Cedar	30	1	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
31	Maple	30	2	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
32	Aurum	31	2	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
33	Cedar	31	3	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
34	Maple	31	3	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
38	Aurum	33	1	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
39	Cedar	33	1	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
44	Aurum	35	\N	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
45	Cedar	35	\N	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
46	Maple	35	\N	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
40	Maple	33	2	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
41	Aurum	34	2	35	R-101	Aurum learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
42	Cedar	34	3	35	R-102	Cedar learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
43	Maple	34	3	35	R-103	Maple learning section	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
\.

COPY public.settings (id, setting_key, setting_value, setting_group, created_at, updated_at) FROM stdin;
\.

COPY public.staff (id, user_id, employee_code, first_name, last_name, gender, date_of_birth, blood_group_id, phone, email, address, emergency_contact_name, emergency_contact_phone, designation_id, department_id, joining_date, salary, qualification, experience_years, photo_url, is_active, created_at, created_by, modified_at) FROM stdin;
3	16	EMP003	Anil	Patil	male	1990-07-10	\N	9876543214	anil.patil@school.com	789 School Lane, Nagpur	Meera Patil	9876543215	3	1	2019-07-01	42000.00	M.A, B.Ed	10	\N	t	2025-08-14 04:09:01.488329	\N	2025-08-14 04:09:01.488329
2	14	EMP002	Priya	Sharma	female	1988-03-22	\N	9876543212	priya.sharma@school.com	House No. 45, Sector 23, Gurgaon, Haryana 122017	Amit Sharma	9876543213	2	1	2021-04-01	35000.00	B.Ed, B.A	8	\N	t	2025-08-14 04:09:01.488329	\N	2026-02-25 13:12:38.642
1	15	EMP001	Rajesh	Kumar	male	1985-05-15	\N	9876543210	rajesh.kumar@school.com	123 Main Street, Nagpur	Sunita Kumar	9876543211	2	2	2020-06-01	100000.00	M.Ed, B.Ed	15	\N	t	2025-08-14 04:09:01.488329	\N	2025-08-14 04:09:01.488329
56	74	DRV001	Ramesh	Yadav	\N	\N	\N	9876541111	ramesh.driver@school.com	123 Driver Colony, Nagpur	\N	\N	23	3	2022-01-15	18000.00	\N	\N	\N	t	2026-04-24 17:36:26.841215	\N	2026-04-24 17:36:26.841215
57	75	DRV002	Suresh	Patil	\N	\N	\N	9876541113	suresh.driver@school.com	456 Transport Nagar, Nagpur	\N	\N	23	3	2021-08-10	19000.00	\N	\N	\N	t	2026-04-24 17:36:26.841215	\N	2026-04-24 17:36:26.841215
58	76	DRV003	Mahesh	Kumar	\N	\N	\N	9876541115	mahesh.driver@school.com	789 Driver Street, Nagpur	\N	\N	23	3	2023-02-01	17500.00	\N	\N	\N	t	2026-04-24 17:36:26.841215	\N	2026-04-24 17:36:26.841215
\.

COPY public.staff_attendance (id, staff_id, attendance_date, status, check_in_time, check_out_time, remark, marked_by, academic_year_id, created_at, updated_at) FROM stdin;
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

COPY public.student_rejoins (id, student_id, leaving_student_id, admission_number, student_first_name, student_last_name, from_class_id, from_section_id, from_academic_year_id, leaving_date, to_class_id, to_section_id, to_academic_year_id, rejoin_date, reason, remarks, rejoined_by, is_active, created_at, created_by, modified_at) FROM stdin;
\.

COPY public.student_siblings (id, student_id, is_in_same_school, name, class_name, section_name, roll_number, admission_number, is_active, created_at, modified_at) FROM stdin;
1	2	f	manoj	2nd, C	\N	\N	\N	t	2026-04-24 17:36:28.245126	2026-04-24 17:36:28.245126
2	2	f	rekha	1st, B	\N	\N	\N	t	2026-04-24 17:36:28.245126	2026-04-24 17:36:28.245126
\.

COPY public.students (id, user_id, admission_number, roll_number, first_name, last_name, gender, date_of_birth, place_of_birth, blood_group_id, religion_id, cast_id, mother_tongue_id, nationality, phone, email, address, academic_year_id, class_id, section_id, house_id, admission_date, previous_school, photo_url, is_transport_required, route_id, pickup_point_id, is_hostel_required, hostel_room_id, is_active, created_at, created_by, modified_at, parent_id, guardian_id, address_id, bank_name, branch, ifsc, known_allergies, medications, hostel_id, previous_school_address, medical_condition, other_information, vehicle_number, current_address, permanent_address, unique_student_ids, pen_number, aadhar_no, gr_number, father_person_id, mother_person_id, guardian_person_id, deleted_at) FROM stdin;
3	11	ADM2024003	UKG001	Arjun	Kumar	male	2018-12-10	Mumbai	3	1	1	3	Indian	9876501113	arjun.kumar@parent.com	654 Elm Street, City C	2	3	3	3	2024-04-01	\N	\N	f	\N	\N	f	\N	t	2025-08-14 04:18:39.176346	\N	2026-03-04 11:15:54.938815	3	3	3	\N	\N	\N			\N	\N	Good	\N	\N	\N	\N	1234567	TEMP_PEN3	333333333333	GR000003	\N	\N	\N	\N
16	12	12	12	Haniaa	Amir	female	2025-08-06	\N	7	2	1	3	Indian	9898989898	hania@gmail.com	111 Birch Boulevard, City D	3	3	1	3	2025-08-18	\N	\N	f	\N	\N	f	\N	t	2025-08-16 02:02:53.49177	\N	2026-03-08 12:50:28.302508	4	\N	4	\N	\N	\N			\N	\N	Good	\N	\N	111 Birch Boulevard, City D	222 Spruce Drive, City D	12345678	TEMP_PEN4	444444444433	GR000004	\N	\N	\N	\N
2	10	ADM2024002	LKG001	Sara	Patel	female	2019-08-22	Nagpur	2	1	2	2	Indian	9876501112	sara.patel@parent.com	456 Dharampeth, Near Medical College, Nagpur - 440010	2	3	3	2	2024-04-01	Little Angels Play School	\N	t	2	2	t	14	t	2025-08-14 04:18:39.176346	\N	2026-04-24 17:36:26.807515	2	2	2	BANK OF MAHARASHTRA	AREA NO.2	BOM123	N/A	HEADACHE	3	\N	\N	\N	\N	456 Dharampeth, Near Medical College, Nagpur - 440010	456 Dharampeth, Near Medical College, Nagpur - 440010	123456	TEMP_PEN2	222222222222	GR000002	\N	\N	\N	\N
1	9	ADM2024001	NUR001	Aarav	Sharma	male	2020-05-15	Nagpur	5	1	1	1	Indian	9876501111	aarav.sharma@parent.com	sector-5	2	2	2	1	2024-04-01	first school	\N	f	2	2	f	15	t	2025-08-14 04:18:39.176346	\N	2026-04-24 17:36:26.807515	1	1	1	bank Of india	sector-5	BOI123456	allergy	yes	1	first school	Good	no	2	sector-5	sector-5	12345	TEMP_PEN1	111111111111	GR000001	\N	\N	\N	\N
119	212	ADM-AY3-001	R-001	Ayaan	Khan	male	2017-04-02	Mumbai	3	2	5	4	Indian	9800003001	student.ay3.001@myschool.local	Flat 1, Green Residency, Civil Lines	3	33	38	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AyaanKhan3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	99	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3001	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	UID-AY3-00001	PEN30000001	903000000001	GR-AY3-0001	1	46	91	\N
128	213	ADM-AY3-002	R-002	Vihaan	Sharma	female	2017-04-03	Mumbai	3	2	5	4	Indian	9800003002	student.ay3.002@myschool.local	Flat 2, Green Residency, Civil Lines	3	33	38	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=VihaanSharma3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	108	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3002	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	UID-AY3-00002	PEN30000002	903000000002	GR-AY3-0002	2	47	92	\N
158	214	ADM-AY3-003	R-003	Reyansh	Patel	male	2017-04-04	Mumbai	3	2	5	4	Indian	9800003003	student.ay3.003@myschool.local	Flat 3, Green Residency, Civil Lines	3	33	38	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ReyanshPatel3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	138	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3003	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	UID-AY3-00003	PEN30000003	903000000003	GR-AY3-0003	3	48	93	\N
150	215	ADM-AY3-004	R-004	Arjun	Ansari	female	2017-04-05	Mumbai	3	2	5	4	Indian	9800003004	student.ay3.004@myschool.local	Flat 4, Green Residency, Civil Lines	3	33	38	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ArjunAnsari3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	130	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3004	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	UID-AY3-00004	PEN30000004	903000000004	GR-AY3-0004	4	49	94	\N
85	216	ADM-AY3-005	R-005	Ishaan	Mishra	male	2017-04-06	Mumbai	3	2	5	4	Indian	9800003005	student.ay3.005@myschool.local	Flat 5, Green Residency, Civil Lines	3	33	38	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=IshaanMishra3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	65	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3005	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	UID-AY3-00005	PEN30000005	903000000005	GR-AY3-0005	5	50	95	\N
138	217	ADM-AY3-006	R-006	Kabir	Verma	female	2017-04-07	Mumbai	3	2	5	4	Indian	9800003006	student.ay3.006@myschool.local	Flat 6, Green Residency, Civil Lines	3	33	39	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KabirVerma3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	118	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3006	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	UID-AY3-00006	PEN30000006	903000000006	GR-AY3-0006	6	51	96	\N
133	218	ADM-AY3-007	R-007	Advik	Singh	male	2017-04-08	Mumbai	3	2	5	4	Indian	9800003007	student.ay3.007@myschool.local	Flat 7, Green Residency, Civil Lines	3	33	39	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AdvikSingh3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	113	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3007	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	UID-AY3-00007	PEN30000007	903000000007	GR-AY3-0007	7	52	97	\N
106	219	ADM-AY3-008	R-008	Sai	Qureshi	female	2017-04-09	Mumbai	3	2	5	4	Indian	9800003008	student.ay3.008@myschool.local	Flat 8, Green Residency, Civil Lines	3	33	39	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaiQureshi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	86	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3008	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	UID-AY3-00008	PEN30000008	903000000008	GR-AY3-0008	8	53	98	\N
77	220	ADM-AY3-009	R-009	Devansh	Shaikh	male	2017-04-10	Mumbai	3	2	5	4	Indian	9800003009	student.ay3.009@myschool.local	Flat 9, Green Residency, Civil Lines	3	33	39	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=DevanshShaikh3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	57	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3009	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	UID-AY3-00009	PEN30000009	903000000009	GR-AY3-0009	9	54	99	\N
87	221	ADM-AY3-010	R-010	Rudra	Gupta	female	2017-04-11	Mumbai	3	2	5	4	Indian	9800003010	student.ay3.010@myschool.local	Flat 10, Green Residency, Civil Lines	3	33	39	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RudraGupta3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	67	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3010	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	UID-AY3-00010	PEN30000010	903000000010	GR-AY3-0010	10	55	100	\N
146	222	ADM-AY3-011	R-011	Zayan	Naqvi	male	2017-04-12	Mumbai	3	2	5	4	Indian	9800003011	student.ay3.011@myschool.local	Flat 11, Green Residency, Civil Lines	3	33	40	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ZayanNaqvi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	126	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3011	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	UID-AY3-00011	PEN30000011	903000000011	GR-AY3-0011	11	56	101	\N
147	223	ADM-AY3-012	R-012	Aarav	Malik	female	2017-04-13	Mumbai	3	2	5	4	Indian	9800003012	student.ay3.012@myschool.local	Flat 12, Green Residency, Civil Lines	3	33	40	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AaravMalik3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	127	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3012	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	UID-AY3-00012	PEN30000012	903000000012	GR-AY3-0012	12	57	102	\N
91	224	ADM-AY3-013	R-013	Laksh	Rao	male	2017-04-14	Mumbai	3	2	5	4	Indian	9800003013	student.ay3.013@myschool.local	Flat 13, Green Residency, Civil Lines	3	33	40	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=LakshRao3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	71	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3013	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	UID-AY3-00013	PEN30000013	903000000013	GR-AY3-0013	13	58	103	\N
157	225	ADM-AY3-014	R-014	Krish	Joshi	female	2017-04-15	Mumbai	3	2	5	4	Indian	9800003014	student.ay3.014@myschool.local	Flat 14, Green Residency, Civil Lines	3	33	40	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KrishJoshi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	137	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3014	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	UID-AY3-00014	PEN30000014	903000000014	GR-AY3-0014	14	59	104	\N
194	226	ADM-AY3-015	R-015	Yuvraj	Kulkarni	male	2017-04-16	Mumbai	3	2	5	4	Indian	9800003015	student.ay3.015@myschool.local	Flat 15, Green Residency, Civil Lines	3	33	40	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=YuvrajKulkarni3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	174	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3015	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	UID-AY3-00015	PEN30000015	903000000015	GR-AY3-0015	15	60	105	\N
121	227	ADM-AY3-016	R-016	Anaya	Deshmukh	female	2017-04-17	Mumbai	3	2	5	4	Indian	9800003016	student.ay3.016@myschool.local	Flat 16, Green Residency, Civil Lines	3	34	41	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AnayaDeshmukh3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	101	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3016	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	UID-AY3-00016	PEN30000016	903000000016	GR-AY3-0016	16	61	106	\N
84	228	ADM-AY3-017	R-017	Myra	Chopra	male	2017-04-18	Mumbai	3	2	5	4	Indian	9800003017	student.ay3.017@myschool.local	Flat 17, Green Residency, Civil Lines	3	34	41	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MyraChopra3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	64	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3017	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	UID-AY3-00017	PEN30000017	903000000017	GR-AY3-0017	17	62	107	\N
166	229	ADM-AY3-018	R-018	Aadhya	Siddiqui	female	2017-04-19	Mumbai	3	2	5	4	Indian	9800003018	student.ay3.018@myschool.local	Flat 18, Green Residency, Civil Lines	3	34	41	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AadhyaSiddiqui3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	146	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3018	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	UID-AY3-00018	PEN30000018	903000000018	GR-AY3-0018	18	63	108	\N
181	230	ADM-AY3-019	R-019	Saanvi	Nair	male	2017-04-20	Mumbai	3	2	5	4	Indian	9800003019	student.ay3.019@myschool.local	Flat 19, Green Residency, Civil Lines	3	34	41	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaanviNair3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	161	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3019	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	UID-AY3-00019	PEN30000019	903000000019	GR-AY3-0019	19	64	109	\N
160	231	ADM-AY3-020	R-020	Kiara	Menon	female	2017-04-21	Mumbai	3	2	5	4	Indian	9800003020	student.ay3.020@myschool.local	Flat 20, Green Residency, Civil Lines	3	34	41	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KiaraMenon3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	140	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3020	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	UID-AY3-00020	PEN30000020	903000000020	GR-AY3-0020	20	65	110	\N
171	232	ADM-AY3-021	R-021	Fatima	Pathan	male	2017-04-22	Mumbai	3	2	5	4	Indian	9800003021	student.ay3.021@myschool.local	Flat 21, Green Residency, Civil Lines	3	34	42	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=FatimaPathan3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	151	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3021	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	UID-AY3-00021	PEN30000021	903000000021	GR-AY3-0021	21	66	111	\N
198	233	ADM-AY3-022	R-022	Aisha	Bano	female	2017-04-23	Mumbai	3	2	5	4	Indian	9800003022	student.ay3.022@myschool.local	Flat 22, Green Residency, Civil Lines	3	34	42	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AishaBano3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	178	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3022	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	UID-AY3-00022	PEN30000022	903000000022	GR-AY3-0022	22	67	112	\N
81	234	ADM-AY3-023	R-023	Inaya	Rahman	male	2017-04-24	Mumbai	3	2	5	4	Indian	9800003023	student.ay3.023@myschool.local	Flat 23, Green Residency, Civil Lines	3	34	42	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=InayaRahman3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	61	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3023	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	UID-AY3-00023	PEN30000023	903000000023	GR-AY3-0023	23	68	113	\N
94	235	ADM-AY3-024	R-024	Sara	Iqbal	female	2017-04-25	Mumbai	3	2	5	4	Indian	9800003024	student.ay3.024@myschool.local	Flat 24, Green Residency, Civil Lines	3	34	42	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaraIqbal3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	74	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3024	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	UID-AY3-00024	PEN30000024	903000000024	GR-AY3-0024	24	69	114	\N
173	236	ADM-AY3-025	R-025	Zoya	Hussain	male	2017-04-26	Mumbai	3	2	5	4	Indian	9800003025	student.ay3.025@myschool.local	Flat 25, Green Residency, Civil Lines	3	34	42	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ZoyaHussain3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	153	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3025	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	UID-AY3-00025	PEN30000025	903000000025	GR-AY3-0025	25	70	115	\N
205	237	ADM-AY3-026	R-026	Meher	Tiwari	female	2017-04-27	Mumbai	3	2	5	4	Indian	9800003026	student.ay3.026@myschool.local	Flat 26, Green Residency, Civil Lines	3	34	43	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MeherTiwari3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	185	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3026	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	UID-AY3-00026	PEN30000026	903000000026	GR-AY3-0026	26	71	116	\N
140	238	ADM-AY3-027	R-027	Anvi	Yadav	male	2017-04-28	Mumbai	3	2	5	4	Indian	9800003027	student.ay3.027@myschool.local	Flat 27, Green Residency, Civil Lines	3	34	43	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AnviYadav3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	120	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3027	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	UID-AY3-00027	PEN30000027	903000000027	GR-AY3-0027	27	72	117	\N
156	239	ADM-AY3-028	R-028	Riya	Jain	female	2017-04-29	Mumbai	3	2	5	4	Indian	9800003028	student.ay3.028@myschool.local	Flat 28, Green Residency, Civil Lines	3	34	43	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RiyaJain3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	136	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3028	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	UID-AY3-00028	PEN30000028	903000000028	GR-AY3-0028	28	73	118	\N
180	240	ADM-AY3-029	R-029	Naina	Kapoor	male	2017-04-30	Mumbai	3	2	5	4	Indian	9800003029	student.ay3.029@myschool.local	Flat 29, Green Residency, Civil Lines	3	34	43	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NainaKapoor3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	160	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3029	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	UID-AY3-00029	PEN30000029	903000000029	GR-AY3-0029	29	74	119	\N
172	241	ADM-AY3-030	R-030	Tara	Bhatt	female	2017-05-01	Mumbai	3	2	5	4	Indian	9800003030	student.ay3.030@myschool.local	Flat 30, Green Residency, Civil Lines	3	34	43	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=TaraBhatt3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	152	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3030	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	UID-AY3-00030	PEN30000030	903000000030	GR-AY3-0030	30	75	120	\N
189	242	ADM-AY3-031	R-031	Prisha	Pillai	male	2017-05-02	Mumbai	3	2	5	4	Indian	9800003031	student.ay3.031@myschool.local	Flat 31, Green Residency, Civil Lines	3	35	44	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=PrishaPillai3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	169	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3031	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	UID-AY3-00031	PEN30000031	903000000031	GR-AY3-0031	31	76	121	\N
113	243	ADM-AY3-032	R-032	Siya	Thomas	female	2017-05-03	Mumbai	3	2	5	4	Indian	9800003032	student.ay3.032@myschool.local	Flat 32, Green Residency, Civil Lines	3	35	44	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SiyaThomas3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	93	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3032	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	UID-AY3-00032	PEN30000032	903000000032	GR-AY3-0032	32	77	122	\N
185	244	ADM-AY3-033	R-033	Pari	Dutta	male	2017-05-04	Mumbai	3	2	5	4	Indian	9800003033	student.ay3.033@myschool.local	Flat 33, Green Residency, Civil Lines	3	35	44	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=PariDutta3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	165	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3033	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	UID-AY3-00033	PEN30000033	903000000033	GR-AY3-0033	33	78	123	\N
164	245	ADM-AY3-034	R-034	Navya	Saxena	female	2017-05-05	Mumbai	3	2	5	4	Indian	9800003034	student.ay3.034@myschool.local	Flat 34, Green Residency, Civil Lines	3	35	44	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NavyaSaxena3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	144	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3034	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	UID-AY3-00034	PEN30000034	903000000034	GR-AY3-0034	34	79	124	\N
152	246	ADM-AY3-035	R-035	Riddhi	Trivedi	male	2017-05-06	Mumbai	3	2	5	4	Indian	9800003035	student.ay3.035@myschool.local	Flat 35, Green Residency, Civil Lines	3	35	44	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RiddhiTrivedi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	132	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3035	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	UID-AY3-00035	PEN30000035	903000000035	GR-AY3-0035	35	80	125	\N
161	247	ADM-AY3-036	R-036	Hridya	Chauhan	female	2017-05-07	Mumbai	3	2	5	4	Indian	9800003036	student.ay3.036@myschool.local	Flat 36, Green Residency, Civil Lines	3	35	45	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=HridyaChauhan3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	141	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3036	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	UID-AY3-00036	PEN30000036	903000000036	GR-AY3-0036	36	81	126	\N
195	248	ADM-AY3-037	R-037	Mahir	Bhardwaj	male	2017-05-08	Mumbai	3	2	5	4	Indian	9800003037	student.ay3.037@myschool.local	Flat 37, Green Residency, Civil Lines	3	35	45	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MahirBhardwaj3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	175	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3037	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	UID-AY3-00037	PEN30000037	903000000037	GR-AY3-0037	37	82	127	\N
136	249	ADM-AY3-038	R-038	Shaurya	Srivastava	female	2017-05-09	Mumbai	3	2	5	4	Indian	9800003038	student.ay3.038@myschool.local	Flat 38, Green Residency, Civil Lines	3	35	45	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ShauryaSrivastava3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	116	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3038	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	UID-AY3-00038	PEN30000038	903000000038	GR-AY3-0038	38	83	128	\N
175	250	ADM-AY3-039	R-039	Dhruv	Farooqui	male	2017-05-10	Mumbai	3	2	5	4	Indian	9800003039	student.ay3.039@myschool.local	Flat 39, Green Residency, Civil Lines	3	35	45	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=DhruvFarooqui3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	155	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3039	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	UID-AY3-00039	PEN30000039	903000000039	GR-AY3-0039	39	84	129	\N
151	251	ADM-AY3-040	R-040	Rayan	Kazi	female	2017-05-11	Mumbai	3	2	5	4	Indian	9800003040	student.ay3.040@myschool.local	Flat 40, Green Residency, Civil Lines	3	35	45	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RayanKazi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	131	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3040	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	UID-AY3-00040	PEN30000040	903000000040	GR-AY3-0040	40	85	130	\N
184	252	ADM-AY3-041	R-041	Arnav	Gandhi	male	2017-05-12	Mumbai	3	2	5	4	Indian	9800003041	student.ay3.041@myschool.local	Flat 41, Green Residency, Civil Lines	3	35	46	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ArnavGandhi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	164	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3041	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	UID-AY3-00041	PEN30000041	903000000041	GR-AY3-0041	41	86	131	\N
108	253	ADM-AY3-042	R-042	Nivaan	Parekh	female	2017-05-13	Mumbai	3	2	5	4	Indian	9800003042	student.ay3.042@myschool.local	Flat 42, Green Residency, Civil Lines	3	35	46	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NivaanParekh3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	88	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3042	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	UID-AY3-00042	PEN30000042	903000000042	GR-AY3-0042	42	87	132	\N
167	254	ADM-AY3-043	R-043	Samaira	Reddy	male	2017-05-14	Mumbai	3	2	5	4	Indian	9800003043	student.ay3.043@myschool.local	Flat 43, Green Residency, Civil Lines	3	35	46	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SamairaReddy3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	147	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3043	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	UID-AY3-00043	PEN30000043	903000000043	GR-AY3-0043	43	88	133	\N
206	255	ADM-AY3-044	R-044	Misha	Lodhi	female	2017-05-15	Mumbai	3	2	5	4	Indian	9800003044	student.ay3.044@myschool.local	Flat 44, Green Residency, Civil Lines	3	35	46	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MishaLodhi3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	186	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3044	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	UID-AY3-00044	PEN30000044	903000000044	GR-AY3-0044	44	89	134	\N
97	256	ADM-AY3-045	R-045	Alina	Basu	male	2017-05-16	Mumbai	3	2	5	4	Indian	9800003045	student.ay3.045@myschool.local	Flat 45, Green Residency, Civil Lines	3	35	46	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AlinaBasu3	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	77	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB3045	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	UID-AY3-00045	PEN30000045	903000000045	GR-AY3-0045	45	90	135	\N
73	194	ADM-AY2-028	R-028	Riya	Jain	female	2017-04-29	Mumbai	3	2	5	4	Indian	9800002028	student.ay2.028@myschool.local	Flat 28, Green Residency, Civil Lines	2	28	25	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RiyaJain2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	53	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2028	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	UID-AY2-00028	PEN20000028	902000000028	GR-AY2-0028	136	271	451	\N
74	183	ADM-AY2-017	R-017	Myra	Chopra	male	2017-04-18	Mumbai	3	2	5	4	Indian	9800002017	student.ay2.017@myschool.local	Flat 17, Green Residency, Civil Lines	2	28	23	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MyraChopra2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	54	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2017	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	UID-AY2-00017	PEN20000017	902000000017	GR-AY2-0017	137	272	452	\N
75	208	ADM-AY2-042	R-042	Nivaan	Parekh	female	2017-05-13	Mumbai	3	2	5	4	Indian	9800002042	student.ay2.042@myschool.local	Flat 42, Green Residency, Civil Lines	2	29	28	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NivaanParekh2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	55	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2042	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	UID-AY2-00042	PEN20000042	902000000042	GR-AY2-0042	138	273	453	\N
76	141	ADM-AY1-020	R-020	Kiara	Menon	female	2017-04-21	Mumbai	3	2	5	4	Indian	9800001020	student.ay1.020@myschool.local	Flat 20, Green Residency, Civil Lines	1	31	32	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KiaraMenon1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	56	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1020	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	UID-AY1-00020	PEN10000020	901000000020	GR-AY1-0020	139	274	454	\N
78	124	ADM-AY1-003	R-003	Reyansh	Patel	male	2017-04-04	Mumbai	3	2	5	4	Indian	9800001003	student.ay1.003@myschool.local	Flat 3, Green Residency, Civil Lines	1	30	29	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ReyanshPatel1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	58	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1003	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	UID-AY1-00003	PEN10000003	901000000003	GR-AY1-0003	141	276	455	\N
79	140	ADM-AY1-019	R-019	Saanvi	Nair	male	2017-04-20	Mumbai	3	2	5	4	Indian	9800001019	student.ay1.019@myschool.local	Flat 19, Green Residency, Civil Lines	1	31	32	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaanviNair1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	59	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1019	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	UID-AY1-00019	PEN10000019	901000000019	GR-AY1-0019	142	277	456	\N
80	188	ADM-AY2-022	R-022	Aisha	Bano	female	2017-04-23	Mumbai	3	2	5	4	Indian	9800002022	student.ay2.022@myschool.local	Flat 22, Green Residency, Civil Lines	2	28	24	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AishaBano2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	60	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2022	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	UID-AY2-00022	PEN20000022	902000000022	GR-AY2-0022	143	278	457	\N
82	147	ADM-AY1-026	R-026	Meher	Tiwari	female	2017-04-27	Mumbai	3	2	5	4	Indian	9800001026	student.ay1.026@myschool.local	Flat 26, Green Residency, Civil Lines	1	31	34	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MeherTiwari1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	62	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1026	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	UID-AY1-00026	PEN10000026	901000000026	GR-AY1-0026	145	280	458	\N
83	161	ADM-AY1-040	R-040	Rayan	Kazi	female	2017-05-11	Mumbai	3	2	5	4	Indian	9800001040	student.ay1.040@myschool.local	Flat 40, Green Residency, Civil Lines	1	32	36	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RayanKazi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	63	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1040	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	UID-AY1-00040	PEN10000040	901000000040	GR-AY1-0040	146	281	459	\N
86	203	ADM-AY2-037	R-037	Mahir	Bhardwaj	male	2017-05-08	Mumbai	3	2	5	4	Indian	9800002037	student.ay2.037@myschool.local	Flat 37, Green Residency, Civil Lines	2	29	27	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MahirBhardwaj2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	66	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2037	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	UID-AY2-00037	PEN20000037	902000000037	GR-AY2-0037	149	284	460	\N
88	172	ADM-AY2-006	R-006	Kabir	Verma	female	2017-04-07	Mumbai	3	2	5	4	Indian	9800002006	student.ay2.006@myschool.local	Flat 6, Green Residency, Civil Lines	2	27	21	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KabirVerma2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	68	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2006	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	UID-AY2-00006	PEN20000006	902000000006	GR-AY2-0006	151	286	461	\N
89	185	ADM-AY2-019	R-019	Saanvi	Nair	male	2017-04-20	Mumbai	3	2	5	4	Indian	9800002019	student.ay2.019@myschool.local	Flat 19, Green Residency, Civil Lines	2	28	23	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaanviNair2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	69	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2019	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	UID-AY2-00019	PEN20000019	902000000019	GR-AY2-0019	152	287	462	\N
90	175	ADM-AY2-009	R-009	Devansh	Shaikh	male	2017-04-10	Mumbai	3	2	5	4	Indian	9800002009	student.ay2.009@myschool.local	Flat 9, Green Residency, Civil Lines	2	27	21	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=DevanshShaikh2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	70	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2009	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	UID-AY2-00009	PEN20000009	902000000009	GR-AY2-0009	153	288	463	\N
92	195	ADM-AY2-029	R-029	Naina	Kapoor	male	2017-04-30	Mumbai	3	2	5	4	Indian	9800002029	student.ay2.029@myschool.local	Flat 29, Green Residency, Civil Lines	2	28	25	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NainaKapoor2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	72	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2029	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	UID-AY2-00029	PEN20000029	902000000029	GR-AY2-0029	155	290	464	\N
93	151	ADM-AY1-030	R-030	Tara	Bhatt	female	2017-05-01	Mumbai	3	2	5	4	Indian	9800001030	student.ay1.030@myschool.local	Flat 30, Green Residency, Civil Lines	1	31	34	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=TaraBhatt1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	73	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1030	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	UID-AY1-00030	PEN10000030	901000000030	GR-AY1-0030	156	291	465	\N
95	199	ADM-AY2-033	R-033	Pari	Dutta	male	2017-05-04	Mumbai	3	2	5	4	Indian	9800002033	student.ay2.033@myschool.local	Flat 33, Green Residency, Civil Lines	2	29	26	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=PariDutta2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	75	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2033	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	UID-AY2-00033	PEN20000033	902000000033	GR-AY2-0033	158	293	466	\N
96	178	ADM-AY2-012	R-012	Aarav	Malik	female	2017-04-13	Mumbai	3	2	5	4	Indian	9800002012	student.ay2.012@myschool.local	Flat 12, Green Residency, Civil Lines	2	27	22	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AaravMalik2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	76	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2012	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	UID-AY2-00012	PEN20000012	902000000012	GR-AY2-0012	159	294	467	\N
98	136	ADM-AY1-015	R-015	Yuvraj	Kulkarni	male	2017-04-16	Mumbai	3	2	5	4	Indian	9800001015	student.ay1.015@myschool.local	Flat 15, Green Residency, Civil Lines	1	30	31	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=YuvrajKulkarni1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	78	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1015	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	UID-AY1-00015	PEN10000015	901000000015	GR-AY1-0015	161	296	468	\N
99	184	ADM-AY2-018	R-018	Aadhya	Siddiqui	female	2017-04-19	Mumbai	3	2	5	4	Indian	9800002018	student.ay2.018@myschool.local	Flat 18, Green Residency, Civil Lines	2	28	23	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AadhyaSiddiqui2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	79	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2018	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	UID-AY2-00018	PEN20000018	902000000018	GR-AY2-0018	162	297	469	\N
100	131	ADM-AY1-010	R-010	Rudra	Gupta	female	2017-04-11	Mumbai	3	2	5	4	Indian	9800001010	student.ay1.010@myschool.local	Flat 10, Green Residency, Civil Lines	1	30	30	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RudraGupta1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	80	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1010	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	UID-AY1-00010	PEN10000010	901000000010	GR-AY1-0010	163	298	470	\N
101	187	ADM-AY2-021	R-021	Fatima	Pathan	male	2017-04-22	Mumbai	3	2	5	4	Indian	9800002021	student.ay2.021@myschool.local	Flat 21, Green Residency, Civil Lines	2	28	24	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=FatimaPathan2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	81	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2021	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	UID-AY2-00021	PEN20000021	902000000021	GR-AY2-0021	164	299	471	\N
102	154	ADM-AY1-033	R-033	Pari	Dutta	male	2017-05-04	Mumbai	3	2	5	4	Indian	9800001033	student.ay1.033@myschool.local	Flat 33, Green Residency, Civil Lines	1	32	35	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=PariDutta1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	82	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1033	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	UID-AY1-00033	PEN10000033	901000000033	GR-AY1-0033	165	300	472	\N
103	159	ADM-AY1-038	R-038	Shaurya	Srivastava	female	2017-05-09	Mumbai	3	2	5	4	Indian	9800001038	student.ay1.038@myschool.local	Flat 38, Green Residency, Civil Lines	1	32	36	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ShauryaSrivastava1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	83	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1038	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	UID-AY1-00038	PEN10000038	901000000038	GR-AY1-0038	166	301	473	\N
104	163	ADM-AY1-042	R-042	Nivaan	Parekh	female	2017-05-13	Mumbai	3	2	5	4	Indian	9800001042	student.ay1.042@myschool.local	Flat 42, Green Residency, Civil Lines	1	32	37	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NivaanParekh1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	84	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1042	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	UID-AY1-00042	PEN10000042	901000000042	GR-AY1-0042	167	302	474	\N
105	138	ADM-AY1-017	R-017	Myra	Chopra	male	2017-04-18	Mumbai	3	2	5	4	Indian	9800001017	student.ay1.017@myschool.local	Flat 17, Green Residency, Civil Lines	1	31	32	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MyraChopra1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	85	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1017	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	UID-AY1-00017	PEN10000017	901000000017	GR-AY1-0017	168	303	475	\N
107	127	ADM-AY1-006	R-006	Kabir	Verma	female	2017-04-07	Mumbai	3	2	5	4	Indian	9800001006	student.ay1.006@myschool.local	Flat 6, Green Residency, Civil Lines	1	30	30	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KabirVerma1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	87	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1006	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	UID-AY1-00006	PEN10000006	901000000006	GR-AY1-0006	170	305	476	\N
109	142	ADM-AY1-021	R-021	Fatima	Pathan	male	2017-04-22	Mumbai	3	2	5	4	Indian	9800001021	student.ay1.021@myschool.local	Flat 21, Green Residency, Civil Lines	1	31	33	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=FatimaPathan1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	89	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1021	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	UID-AY1-00021	PEN10000021	901000000021	GR-AY1-0021	172	307	477	\N
110	139	ADM-AY1-018	R-018	Aadhya	Siddiqui	female	2017-04-19	Mumbai	3	2	5	4	Indian	9800001018	student.ay1.018@myschool.local	Flat 18, Green Residency, Civil Lines	1	31	32	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AadhyaSiddiqui1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	90	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1018	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	UID-AY1-00018	PEN10000018	901000000018	GR-AY1-0018	173	308	478	\N
111	196	ADM-AY2-030	R-030	Tara	Bhatt	female	2017-05-01	Mumbai	3	2	5	4	Indian	9800002030	student.ay2.030@myschool.local	Flat 30, Green Residency, Civil Lines	2	28	25	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=TaraBhatt2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	91	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2030	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	UID-AY2-00030	PEN20000030	902000000030	GR-AY2-0030	174	309	479	\N
112	146	ADM-AY1-025	R-025	Zoya	Hussain	male	2017-04-26	Mumbai	3	2	5	4	Indian	9800001025	student.ay1.025@myschool.local	Flat 25, Green Residency, Civil Lines	1	31	33	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ZoyaHussain1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	92	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1025	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	UID-AY1-00025	PEN10000025	901000000025	GR-AY1-0025	175	310	480	\N
114	166	ADM-AY1-045	R-045	Alina	Basu	male	2017-05-16	Mumbai	3	2	5	4	Indian	9800001045	student.ay1.045@myschool.local	Flat 45, Green Residency, Civil Lines	1	32	37	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AlinaBasu1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	94	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1045	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	UID-AY1-00045	PEN10000045	901000000045	GR-AY1-0045	177	312	481	\N
115	129	ADM-AY1-008	R-008	Sai	Qureshi	female	2017-04-09	Mumbai	3	2	5	4	Indian	9800001008	student.ay1.008@myschool.local	Flat 8, Green Residency, Civil Lines	1	30	30	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaiQureshi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	95	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1008	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	UID-AY1-00008	PEN10000008	901000000008	GR-AY1-0008	178	313	482	\N
116	157	ADM-AY1-036	R-036	Hridya	Chauhan	female	2017-05-07	Mumbai	3	2	5	4	Indian	9800001036	student.ay1.036@myschool.local	Flat 36, Green Residency, Civil Lines	1	32	36	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=HridyaChauhan1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	96	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1036	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	UID-AY1-00036	PEN10000036	901000000036	GR-AY1-0036	179	314	483	\N
117	210	ADM-AY2-044	R-044	Misha	Lodhi	female	2017-05-15	Mumbai	3	2	5	4	Indian	9800002044	student.ay2.044@myschool.local	Flat 44, Green Residency, Civil Lines	2	29	28	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MishaLodhi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	97	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2044	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	UID-AY2-00044	PEN20000044	902000000044	GR-AY2-0044	180	315	484	\N
118	169	ADM-AY2-003	R-003	Reyansh	Patel	male	2017-04-04	Mumbai	3	2	5	4	Indian	9800002003	student.ay2.003@myschool.local	Flat 3, Green Residency, Civil Lines	2	27	20	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ReyanshPatel2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	98	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2003	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	UID-AY2-00003	PEN20000003	902000000003	GR-AY2-0003	181	316	485	\N
120	204	ADM-AY2-038	R-038	Shaurya	Srivastava	female	2017-05-09	Mumbai	3	2	5	4	Indian	9800002038	student.ay2.038@myschool.local	Flat 38, Green Residency, Civil Lines	2	29	27	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ShauryaSrivastava2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	100	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2038	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	UID-AY2-00038	PEN20000038	902000000038	GR-AY2-0038	183	318	486	\N
122	135	ADM-AY1-014	R-014	Krish	Joshi	female	2017-04-15	Mumbai	3	2	5	4	Indian	9800001014	student.ay1.014@myschool.local	Flat 14, Green Residency, Civil Lines	1	30	31	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KrishJoshi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	102	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1014	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	UID-AY1-00014	PEN10000014	901000000014	GR-AY1-0014	185	320	487	\N
123	200	ADM-AY2-034	R-034	Navya	Saxena	female	2017-05-05	Mumbai	3	2	5	4	Indian	9800002034	student.ay2.034@myschool.local	Flat 34, Green Residency, Civil Lines	2	29	26	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NavyaSaxena2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	103	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2034	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	UID-AY2-00034	PEN20000034	902000000034	GR-AY2-0034	186	321	488	\N
124	144	ADM-AY1-023	R-023	Inaya	Rahman	male	2017-04-24	Mumbai	3	2	5	4	Indian	9800001023	student.ay1.023@myschool.local	Flat 23, Green Residency, Civil Lines	1	31	33	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=InayaRahman1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	104	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1023	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	UID-AY1-00023	PEN10000023	901000000023	GR-AY1-0023	187	322	489	\N
125	170	ADM-AY2-004	R-004	Arjun	Ansari	female	2017-04-05	Mumbai	3	2	5	4	Indian	9800002004	student.ay2.004@myschool.local	Flat 4, Green Residency, Civil Lines	2	27	20	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ArjunAnsari2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	105	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2004	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	UID-AY2-00004	PEN20000004	902000000004	GR-AY2-0004	188	323	490	\N
126	145	ADM-AY1-024	R-024	Sara	Iqbal	female	2017-04-25	Mumbai	3	2	5	4	Indian	9800001024	student.ay1.024@myschool.local	Flat 24, Green Residency, Civil Lines	1	31	33	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaraIqbal1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	106	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1024	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	UID-AY1-00024	PEN10000024	901000000024	GR-AY1-0024	189	324	491	\N
127	123	ADM-AY1-002	R-002	Vihaan	Sharma	female	2017-04-03	Mumbai	3	2	5	4	Indian	9800001002	student.ay1.002@myschool.local	Flat 2, Green Residency, Civil Lines	1	30	29	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=VihaanSharma1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	107	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1002	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	UID-AY1-00002	PEN10000002	901000000002	GR-AY1-0002	190	325	492	\N
129	132	ADM-AY1-011	R-011	Zayan	Naqvi	male	2017-04-12	Mumbai	3	2	5	4	Indian	9800001011	student.ay1.011@myschool.local	Flat 11, Green Residency, Civil Lines	1	30	31	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ZayanNaqvi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	109	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1011	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	UID-AY1-00011	PEN10000011	901000000011	GR-AY1-0011	192	327	493	\N
130	190	ADM-AY2-024	R-024	Sara	Iqbal	female	2017-04-25	Mumbai	3	2	5	4	Indian	9800002024	student.ay2.024@myschool.local	Flat 24, Green Residency, Civil Lines	2	28	24	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaraIqbal2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	110	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2024	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	UID-AY2-00024	PEN20000024	902000000024	GR-AY2-0024	193	328	494	\N
131	192	ADM-AY2-026	R-026	Meher	Tiwari	female	2017-04-27	Mumbai	3	2	5	4	Indian	9800002026	student.ay2.026@myschool.local	Flat 26, Green Residency, Civil Lines	2	28	25	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MeherTiwari2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	111	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2026	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	UID-AY2-00026	PEN20000026	902000000026	GR-AY2-0026	194	329	495	\N
132	197	ADM-AY2-031	R-031	Prisha	Pillai	male	2017-05-02	Mumbai	3	2	5	4	Indian	9800002031	student.ay2.031@myschool.local	Flat 31, Green Residency, Civil Lines	2	29	26	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=PrishaPillai2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	112	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2031	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	UID-AY2-00031	PEN20000031	902000000031	GR-AY2-0031	195	330	496	\N
134	165	ADM-AY1-044	R-044	Misha	Lodhi	female	2017-05-15	Mumbai	3	2	5	4	Indian	9800001044	student.ay1.044@myschool.local	Flat 44, Green Residency, Civil Lines	1	32	37	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MishaLodhi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	114	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1044	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	UID-AY1-00044	PEN10000044	901000000044	GR-AY1-0044	197	332	497	\N
135	179	ADM-AY2-013	R-013	Laksh	Rao	male	2017-04-14	Mumbai	3	2	5	4	Indian	9800002013	student.ay2.013@myschool.local	Flat 13, Green Residency, Civil Lines	2	27	22	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=LakshRao2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	115	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2013	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	UID-AY2-00013	PEN20000013	902000000013	GR-AY2-0013	198	333	498	\N
137	202	ADM-AY2-036	R-036	Hridya	Chauhan	female	2017-05-07	Mumbai	3	2	5	4	Indian	9800002036	student.ay2.036@myschool.local	Flat 36, Green Residency, Civil Lines	2	29	27	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=HridyaChauhan2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	117	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2036	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	UID-AY2-00036	PEN20000036	902000000036	GR-AY2-0036	200	335	499	\N
139	128	ADM-AY1-007	R-007	Advik	Singh	male	2017-04-08	Mumbai	3	2	5	4	Indian	9800001007	student.ay1.007@myschool.local	Flat 7, Green Residency, Civil Lines	1	30	30	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AdvikSingh1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	119	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1007	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	UID-AY1-00007	PEN10000007	901000000007	GR-AY1-0007	202	337	500	\N
141	173	ADM-AY2-007	R-007	Advik	Singh	male	2017-04-08	Mumbai	3	2	5	4	Indian	9800002007	student.ay2.007@myschool.local	Flat 7, Green Residency, Civil Lines	2	27	21	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AdvikSingh2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	121	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2007	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	UID-AY2-00007	PEN20000007	902000000007	GR-AY2-0007	204	339	501	\N
142	160	ADM-AY1-039	R-039	Dhruv	Farooqui	male	2017-05-10	Mumbai	3	2	5	4	Indian	9800001039	student.ay1.039@myschool.local	Flat 39, Green Residency, Civil Lines	1	32	36	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=DhruvFarooqui1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	122	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1039	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	UID-AY1-00039	PEN10000039	901000000039	GR-AY1-0039	205	340	502	\N
143	201	ADM-AY2-035	R-035	Riddhi	Trivedi	male	2017-05-06	Mumbai	3	2	5	4	Indian	9800002035	student.ay2.035@myschool.local	Flat 35, Green Residency, Civil Lines	2	29	26	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RiddhiTrivedi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	123	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2035	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	UID-AY2-00035	PEN20000035	902000000035	GR-AY2-0035	206	341	503	\N
144	156	ADM-AY1-035	R-035	Riddhi	Trivedi	male	2017-05-06	Mumbai	3	2	5	4	Indian	9800001035	student.ay1.035@myschool.local	Flat 35, Green Residency, Civil Lines	1	32	35	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RiddhiTrivedi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	124	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1035	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	UID-AY1-00035	PEN10000035	901000000035	GR-AY1-0035	207	342	504	\N
145	150	ADM-AY1-029	R-029	Naina	Kapoor	male	2017-04-30	Mumbai	3	2	5	4	Indian	9800001029	student.ay1.029@myschool.local	Flat 29, Green Residency, Civil Lines	1	31	34	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NainaKapoor1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	125	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1029	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	UID-AY1-00029	PEN10000029	901000000029	GR-AY1-0029	208	343	505	\N
148	148	ADM-AY1-027	R-027	Anvi	Yadav	male	2017-04-28	Mumbai	3	2	5	4	Indian	9800001027	student.ay1.027@myschool.local	Flat 27, Green Residency, Civil Lines	1	31	34	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AnviYadav1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	128	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1027	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	UID-AY1-00027	PEN10000027	901000000027	GR-AY1-0027	211	346	506	\N
149	189	ADM-AY2-023	R-023	Inaya	Rahman	male	2017-04-24	Mumbai	3	2	5	4	Indian	9800002023	student.ay2.023@myschool.local	Flat 23, Green Residency, Civil Lines	2	28	24	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=InayaRahman2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	129	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2023	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	UID-AY2-00023	PEN20000023	902000000023	GR-AY2-0023	212	347	507	\N
153	143	ADM-AY1-022	R-022	Aisha	Bano	female	2017-04-23	Mumbai	3	2	5	4	Indian	9800001022	student.ay1.022@myschool.local	Flat 22, Green Residency, Civil Lines	1	31	33	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AishaBano1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	133	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1022	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	UID-AY1-00022	PEN10000022	901000000022	GR-AY1-0022	216	351	508	\N
154	167	ADM-AY2-001	R-001	Ayaan	Khan	male	2017-04-02	Mumbai	3	2	5	4	Indian	9800002001	student.ay2.001@myschool.local	Flat 1, Green Residency, Civil Lines	2	27	20	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AyaanKhan2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	134	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2001	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	UID-AY2-00001	PEN20000001	902000000001	GR-AY2-0001	217	352	509	\N
155	155	ADM-AY1-034	R-034	Navya	Saxena	female	2017-05-05	Mumbai	3	2	5	4	Indian	9800001034	student.ay1.034@myschool.local	Flat 34, Green Residency, Civil Lines	1	32	35	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=NavyaSaxena1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	135	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1034	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	UID-AY1-00034	PEN10000034	901000000034	GR-AY1-0034	218	353	510	\N
159	153	ADM-AY1-032	R-032	Siya	Thomas	female	2017-05-03	Mumbai	3	2	5	4	Indian	9800001032	student.ay1.032@myschool.local	Flat 32, Green Residency, Civil Lines	1	32	35	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SiyaThomas1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	139	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1032	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	UID-AY1-00032	PEN10000032	901000000032	GR-AY1-0032	222	357	511	\N
162	122	ADM-AY1-001	R-001	Ayaan	Khan	male	2017-04-02	Mumbai	3	2	5	4	Indian	9800001001	student.ay1.001@myschool.local	Flat 1, Green Residency, Civil Lines	1	30	29	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AyaanKhan1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	142	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1001	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	UID-AY1-00001	PEN10000001	901000000001	GR-AY1-0001	225	360	512	\N
163	149	ADM-AY1-028	R-028	Riya	Jain	female	2017-04-29	Mumbai	3	2	5	4	Indian	9800001028	student.ay1.028@myschool.local	Flat 28, Green Residency, Civil Lines	1	31	34	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RiyaJain1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	143	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1028	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	UID-AY1-00028	PEN10000028	901000000028	GR-AY1-0028	226	361	513	\N
165	206	ADM-AY2-040	R-040	Rayan	Kazi	female	2017-05-11	Mumbai	3	2	5	4	Indian	9800002040	student.ay2.040@myschool.local	Flat 40, Green Residency, Civil Lines	2	29	27	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RayanKazi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	145	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2040	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	UID-AY2-00040	PEN20000040	902000000040	GR-AY2-0040	228	363	514	\N
168	126	ADM-AY1-005	R-005	Ishaan	Mishra	male	2017-04-06	Mumbai	3	2	5	4	Indian	9800001005	student.ay1.005@myschool.local	Flat 5, Green Residency, Civil Lines	1	30	29	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=IshaanMishra1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	148	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1005	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	UID-AY1-00005	PEN10000005	901000000005	GR-AY1-0005	231	366	515	\N
169	191	ADM-AY2-025	R-025	Zoya	Hussain	male	2017-04-26	Mumbai	3	2	5	4	Indian	9800002025	student.ay2.025@myschool.local	Flat 25, Green Residency, Civil Lines	2	28	24	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ZoyaHussain2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	149	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2025	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	UID-AY2-00025	PEN20000025	902000000025	GR-AY2-0025	232	367	516	\N
170	177	ADM-AY2-011	R-011	Zayan	Naqvi	male	2017-04-12	Mumbai	3	2	5	4	Indian	9800002011	student.ay2.011@myschool.local	Flat 11, Green Residency, Civil Lines	2	27	22	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ZayanNaqvi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	150	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2011	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	UID-AY2-00011	PEN20000011	902000000011	GR-AY2-0011	233	368	517	\N
174	193	ADM-AY2-027	R-027	Anvi	Yadav	male	2017-04-28	Mumbai	3	2	5	4	Indian	9800002027	student.ay2.027@myschool.local	Flat 27, Green Residency, Civil Lines	2	28	25	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AnviYadav2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	154	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2027	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	UID-AY2-00027	PEN20000027	902000000027	GR-AY2-0027	237	372	518	\N
176	162	ADM-AY1-041	R-041	Arnav	Gandhi	male	2017-05-12	Mumbai	3	2	5	4	Indian	9800001041	student.ay1.041@myschool.local	Flat 41, Green Residency, Civil Lines	1	32	37	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ArnavGandhi1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	156	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1041	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	UID-AY1-00041	PEN10000041	901000000041	GR-AY1-0041	239	374	519	\N
177	181	ADM-AY2-015	R-015	Yuvraj	Kulkarni	male	2017-04-16	Mumbai	3	2	5	4	Indian	9800002015	student.ay2.015@myschool.local	Flat 15, Green Residency, Civil Lines	2	27	22	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=YuvrajKulkarni2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	157	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2015	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	UID-AY2-00015	PEN20000015	902000000015	GR-AY2-0015	240	375	520	\N
178	134	ADM-AY1-013	R-013	Laksh	Rao	male	2017-04-14	Mumbai	3	2	5	4	Indian	9800001013	student.ay1.013@myschool.local	Flat 13, Green Residency, Civil Lines	1	30	31	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=LakshRao1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	158	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1013	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	UID-AY1-00013	PEN10000013	901000000013	GR-AY1-0013	241	376	521	\N
179	168	ADM-AY2-002	R-002	Vihaan	Sharma	female	2017-04-03	Mumbai	3	2	5	4	Indian	9800002002	student.ay2.002@myschool.local	Flat 2, Green Residency, Civil Lines	2	27	20	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=VihaanSharma2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	159	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2002	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	UID-AY2-00002	PEN20000002	902000000002	GR-AY2-0002	242	377	522	\N
182	209	ADM-AY2-043	R-043	Samaira	Reddy	male	2017-05-14	Mumbai	3	2	5	4	Indian	9800002043	student.ay2.043@myschool.local	Flat 43, Green Residency, Civil Lines	2	29	28	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SamairaReddy2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	162	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2043	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	UID-AY2-00043	PEN20000043	902000000043	GR-AY2-0043	245	380	523	\N
183	176	ADM-AY2-010	R-010	Rudra	Gupta	female	2017-04-11	Mumbai	3	2	5	4	Indian	9800002010	student.ay2.010@myschool.local	Flat 10, Green Residency, Civil Lines	2	27	21	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=RudraGupta2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	163	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2010	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	UID-AY2-00010	PEN20000010	902000000010	GR-AY2-0010	246	381	524	\N
186	125	ADM-AY1-004	R-004	Arjun	Ansari	female	2017-04-05	Mumbai	3	2	5	4	Indian	9800001004	student.ay1.004@myschool.local	Flat 4, Green Residency, Civil Lines	1	30	29	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ArjunAnsari1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	166	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1004	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	UID-AY1-00004	PEN10000004	901000000004	GR-AY1-0004	249	384	525	\N
187	198	ADM-AY2-032	R-032	Siya	Thomas	female	2017-05-03	Mumbai	3	2	5	4	Indian	9800002032	student.ay2.032@myschool.local	Flat 32, Green Residency, Civil Lines	2	29	26	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SiyaThomas2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	167	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2032	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	UID-AY2-00032	PEN20000032	902000000032	GR-AY2-0032	250	385	526	\N
188	130	ADM-AY1-009	R-009	Devansh	Shaikh	male	2017-04-10	Mumbai	3	2	5	4	Indian	9800001009	student.ay1.009@myschool.local	Flat 9, Green Residency, Civil Lines	1	30	30	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=DevanshShaikh1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	168	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1009	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	UID-AY1-00009	PEN10000009	901000000009	GR-AY1-0009	251	386	527	\N
190	152	ADM-AY1-031	R-031	Prisha	Pillai	male	2017-05-02	Mumbai	3	2	5	4	Indian	9800001031	student.ay1.031@myschool.local	Flat 31, Green Residency, Civil Lines	1	32	35	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=PrishaPillai1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	170	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1031	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	UID-AY1-00031	PEN10000031	901000000031	GR-AY1-0031	253	388	528	\N
191	182	ADM-AY2-016	R-016	Anaya	Deshmukh	female	2017-04-17	Mumbai	3	2	5	4	Indian	9800002016	student.ay2.016@myschool.local	Flat 16, Green Residency, Civil Lines	2	28	23	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AnayaDeshmukh2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	171	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2016	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	UID-AY2-00016	PEN20000016	902000000016	GR-AY2-0016	254	389	529	\N
192	211	ADM-AY2-045	R-045	Alina	Basu	male	2017-05-16	Mumbai	3	2	5	4	Indian	9800002045	student.ay2.045@myschool.local	Flat 45, Green Residency, Civil Lines	2	29	28	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AlinaBasu2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	172	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2045	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	UID-AY2-00045	PEN20000045	902000000045	GR-AY2-0045	255	390	530	\N
193	137	ADM-AY1-016	R-016	Anaya	Deshmukh	female	2017-04-17	Mumbai	3	2	5	4	Indian	9800001016	student.ay1.016@myschool.local	Flat 16, Green Residency, Civil Lines	1	31	32	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AnayaDeshmukh1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	173	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1016	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	UID-AY1-00016	PEN10000016	901000000016	GR-AY1-0016	256	391	531	\N
196	164	ADM-AY1-043	R-043	Samaira	Reddy	male	2017-05-14	Mumbai	3	2	5	4	Indian	9800001043	student.ay1.043@myschool.local	Flat 43, Green Residency, Civil Lines	1	32	37	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SamairaReddy1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	176	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1043	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	UID-AY1-00043	PEN10000043	901000000043	GR-AY1-0043	259	394	532	\N
197	171	ADM-AY2-005	R-005	Ishaan	Mishra	male	2017-04-06	Mumbai	3	2	5	4	Indian	9800002005	student.ay2.005@myschool.local	Flat 5, Green Residency, Civil Lines	2	27	20	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=IshaanMishra2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	177	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2005	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	UID-AY2-00005	PEN20000005	902000000005	GR-AY2-0005	260	395	533	\N
199	207	ADM-AY2-041	R-041	Arnav	Gandhi	male	2017-05-12	Mumbai	3	2	5	4	Indian	9800002041	student.ay2.041@myschool.local	Flat 41, Green Residency, Civil Lines	2	29	28	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=ArnavGandhi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	179	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2041	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	UID-AY2-00041	PEN20000041	902000000041	GR-AY2-0041	262	397	534	\N
200	174	ADM-AY2-008	R-008	Sai	Qureshi	female	2017-04-09	Mumbai	3	2	5	4	Indian	9800002008	student.ay2.008@myschool.local	Flat 8, Green Residency, Civil Lines	2	27	21	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=SaiQureshi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	180	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2008	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	UID-AY2-00008	PEN20000008	902000000008	GR-AY2-0008	263	398	535	\N
201	186	ADM-AY2-020	R-020	Kiara	Menon	female	2017-04-21	Mumbai	3	2	5	4	Indian	9800002020	student.ay2.020@myschool.local	Flat 20, Green Residency, Civil Lines	2	28	23	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KiaraMenon2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	181	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2020	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	UID-AY2-00020	PEN20000020	902000000020	GR-AY2-0020	264	399	536	\N
202	180	ADM-AY2-014	R-014	Krish	Joshi	female	2017-04-15	Mumbai	3	2	5	4	Indian	9800002014	student.ay2.014@myschool.local	Flat 14, Green Residency, Civil Lines	2	27	22	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=KrishJoshi2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	182	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2014	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	UID-AY2-00014	PEN20000014	902000000014	GR-AY2-0014	265	400	537	\N
203	133	ADM-AY1-012	R-012	Aarav	Malik	female	2017-04-13	Mumbai	3	2	5	4	Indian	9800001012	student.ay1.012@myschool.local	Flat 12, Green Residency, Civil Lines	1	30	31	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=AaravMalik1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	183	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1012	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	UID-AY1-00012	PEN10000012	901000000012	GR-AY1-0012	266	401	538	\N
204	158	ADM-AY1-037	R-037	Mahir	Bhardwaj	male	2017-05-08	Mumbai	3	2	5	4	Indian	9800001037	student.ay1.037@myschool.local	Flat 37, Green Residency, Civil Lines	1	32	36	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=MahirBhardwaj1	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	184	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB1037	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	UID-AY1-00037	PEN10000037	901000000037	GR-AY1-0037	267	402	539	\N
207	205	ADM-AY2-039	R-039	Dhruv	Farooqui	male	2017-05-10	Mumbai	3	2	5	4	Indian	9800002039	student.ay2.039@myschool.local	Flat 39, Green Residency, Civil Lines	2	29	27	4	2026-03-10	Bright Future Public School	https://api.dicebear.com/8.x/initials/svg?seed=DhruvFarooqui2	f	\N	\N	f	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N	\N	187	State Bank of India	Central Branch	SBIN0001234	None	None	\N	Old Town Road, Mumbai	No chronic condition	Participates in co-curricular activities	MH01AB2039	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	UID-AY2-00039	PEN20000039	902000000039	GR-AY2-0039	270	405	540	\N
\.

COPY public.subjects (id, subject_name, subject_code, class_id, teacher_id, theory_hours, practical_hours, total_marks, passing_marks, description, is_active, created_at, created_by, modified_at, academic_year_id) FROM stdin;
1	Play Activities	PLAY_N	1	2	5	10	50	25	Play-based learning activities	t	2025-08-14 04:32:23.173633	\N	2025-08-14 04:32:23.173633	1
3	Mathematics	MATH_U	3	3	8	2	100	40	Basic arithmetic operations	t	2025-08-14 04:32:23.173633	\N	2026-02-17 17:57:10.801132	1
2	English	ENG_L	2	2	6	4	100	40	Basic English letters and words	t	2025-08-14 04:32:23.173633	\N	2026-02-20 16:38:53.675363	1
8	Play Activities	PLAY010003	3	\N	5	10	50	25	Play-based learning activities	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
9	Play Activities	PLAY010001	1	\N	5	10	50	25	Play-based learning activities	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
10	Play Activities	PLAY010002	2	\N	5	10	50	25	Play-based learning activities	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
11	English	ENG_020003	3	\N	6	4	100	40	Basic English letters and words	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
12	English	ENG_020001	1	\N	6	4	100	40	Basic English letters and words	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
13	English	ENG_020002	2	\N	6	4	100	40	Basic English letters and words	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
14	Mathematics	MATH030003	3	\N	8	2	100	40	Basic arithmetic operations	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
15	Mathematics	MATH030001	1	\N	8	2	100	40	Basic arithmetic operations	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
16	Mathematics	MATH030002	2	\N	8	2	100	40	Basic arithmetic operations	t	2026-04-24 17:36:27.972693	\N	2026-04-24 17:36:27.972693	1
32	English	D2C1ENG	27	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
33	Mathematics	D2C1MTH	27	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
34	Environmental Studies	D2C1EVS	27	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
35	Computer Science	D2C1CSC	27	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
36	General Knowledge	D2C1GK	27	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
37	English	D2C2ENG	28	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
38	Mathematics	D2C2MTH	28	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
39	Environmental Studies	D2C2EVS	28	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
40	Computer Science	D2C2CSC	28	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
41	General Knowledge	D2C2GK	28	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
42	English	D2C3ENG	29	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
43	Mathematics	D2C3MTH	29	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
44	Environmental Studies	D2C3EVS	29	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
45	Computer Science	D2C3CSC	29	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
46	General Knowledge	D2C3GK	29	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
47	English	D1C1ENG	30	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
48	Mathematics	D1C1MTH	30	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
49	Environmental Studies	D1C1EVS	30	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
50	Computer Science	D1C1CSC	30	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
51	General Knowledge	D1C1GK	30	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
52	English	D1C2ENG	31	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
53	Mathematics	D1C2MTH	31	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
54	Environmental Studies	D1C2EVS	31	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
55	Computer Science	D1C2CSC	31	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
56	General Knowledge	D1C2GK	31	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
57	English	D1C3ENG	32	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
58	Mathematics	D1C3MTH	32	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
59	Environmental Studies	D1C3EVS	32	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
60	Computer Science	D1C3CSC	32	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
61	General Knowledge	D1C3GK	32	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
62	English	D3C1ENG	33	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
63	Mathematics	D3C1MTH	33	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
64	Environmental Studies	D3C1EVS	33	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
65	Computer Science	D3C1CSC	33	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
66	General Knowledge	D3C1GK	33	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
67	English	D3C2ENG	34	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
68	Mathematics	D3C2MTH	34	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
69	Environmental Studies	D3C2EVS	34	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
70	Computer Science	D3C2CSC	34	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
71	General Knowledge	D3C2GK	34	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
72	English	D3C3ENG	35	1	5	0	100	35	Language and communication	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
73	Mathematics	D3C3MTH	35	3	5	0	100	35	Numerical and logical thinking	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
74	Environmental Studies	D3C3EVS	35	1	4	1	100	35	Awareness of environment and society	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
75	Computer Science	D3C3CSC	35	2	3	2	100	35	Digital literacy and computing basics	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
76	General Knowledge	D3C3GK	35	3	2	0	100	35	Current affairs and broad awareness	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	\N
\.

COPY public.teacher_assignments (id, teacher_id, class_id, section_id, subject_id, created_at, updated_at, academic_year_id) FROM stdin;
\.

COPY public.teacher_routines (id, teacher_id, class_schedule_id, academic_year_id, is_active, created_at, created_by, modified_at) FROM stdin;
1	2	1	1	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
2	2	2	1	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
3	3	3	1	t	2025-08-14 04:32:29.847596	\N	2025-08-14 04:32:29.847596
\.

COPY public.teachers (id, class_id, subject_id, father_name, mother_name, marital_status, languages_known, previous_school_name, previous_school_address, previous_school_phone, current_address, permanent_address, pan_number, id_number, status, created_at, updated_at, staff_id, bank_name, branch, ifsc, contract_type, shift, work_location, facebook, twitter, linkedin, youtube, instagram, blood_group, resume, joining_letter, modified_at, account_name, account_number, epf_no, other_info) FROM stdin;
1	33	62	Rajesh Sharma	Sunita Sharma	Married	{Hindi,English,Marathi}	St. Xavier High School	MG Road, Mumbai, Maharashtra 400001	+91-22-26543210	Flat 204, Sunrise Apartments, Bandra West, Mumbai 400050	Flat 204, Sunrise Apartments, Bandra West, Mumbai 400050	ABCPS1234N	1234-5678-9012	Active	2025-08-15 17:19:34.970329	2026-04-24 17:36:31.826133	1	Bank Of India	Ring Road	BO1234	Temporary	Evening	1st Floor	https://www.facebook.com/	https://x.com/	https://www.linkedin.com/feed/	https://www.youtube.com/	https://www.instagram.com/	B+	\N	\N	2026-04-24 17:36:28.458143+05:30	\N	\N	\N	\N
2	33	62	Kiran Patel	Meera Patel	Single	{English}	Delhi Public School	Sector 45, Gurgaon, Haryana 122003	+91-124-4567890	House No. 45, Sector 23, Gurgaon, Haryana 122017	B-12, Patel Colony, Ahmedabad, Gujarat 380001	DEFGH5678P	2345-6789-0123	Active	2025-08-15 17:19:34.970329	2026-04-24 17:36:31.826133	2	Bank Of Maharashtra	sector-5 main road	BOM1234	Temporary	Morning	3rd Floor	https://www.facebook.com/	https://x.com/	https://www.linkedin.com/feed/	https://www.youtube.com/	https://www.instagram.com/	AB+	\N	\N	2026-04-24 17:36:28.458143+05:30	\N	\N	\N	\N
3	34	67	Venkat Reddy	Lakshmi Reddy	Married	{English,Telugu,Hindi}	Narayana High School	Jubilee Hills, Hyderabad, Telangana 500033	+91-40-23456789	Plot 67, Madhapur, Hyderabad, Telangana 500081	H.No. 23-45, Begumpet, Hyderabad, Telangana 500016	IJKLM9012Q	3456-7890-1234	Active	2025-08-15 17:19:34.970329	2026-04-24 17:36:31.826133	3	HDFC bank	Tarsod	HDFC1234	Permanent	Evening	2nd Floor	https://www.facebook.com/	https://x.com/	https://www.linkedin.com/feed/	https://www.youtube.com/	https://www.instagram.com/	O-	\N	\N	2026-04-24 17:36:28.458143+05:30	\N	\N	\N	\N
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

COPY public.transport_allocations (id, user_id, user_type, route_id, pickup_point_id, vehicle_id, assigned_fee_id, assigned_fee_amount, is_free, start_date, end_date, status, created_at, updated_at) FROM stdin;
\.

COPY public.transport_assignments (id, vehicle_id, route_id, driver_id, is_active, created_at, updated_at, deleted_at, academic_year_id) FROM stdin;
1	1	1	1	t	2026-04-24 17:36:27.770806+05:30	2026-04-24 17:36:27.808268+05:30	\N	3
2	2	2	2	t	2026-04-24 17:36:27.770806+05:30	2026-04-24 17:36:27.808268+05:30	\N	3
3	3	3	3	t	2026-04-24 17:36:27.770806+05:30	2026-04-24 17:36:27.808268+05:30	\N	3
\.

COPY public.transport_fee_master (id, pickup_point_id, plan_name, duration_days, amount, status, created_at, updated_at, staff_amount) FROM stdin;
\.

COPY public.user_roles (id, role_name, description, permissions, is_active, created_at, created_by, modified_at) FROM stdin;
1	admin	System Administrator with full access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
2	teacher	Teaching staff with limited admin access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
3	student	Student user with restricted access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
4	parent	Parent with student information access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
5	Guardian	Guardian with student information access	\N	t	2026-02-21 06:44:07.908872	\N	2026-02-21 06:44:07.908872
9	driver	School transport driver ΓÇö access limited to own vehicle, route, and assigned passengers	\N	t	2026-04-24 17:36:26.836908	\N	2026-04-24 17:36:26.836908
10	conductor	Transport Conductor with limited access	\N	t	2026-04-24 17:36:27.770806	\N	2026-04-24 17:36:27.770806
\.

COPY public.users (id, username, email, password_hash, role_id, first_name, last_name, phone, last_login, is_active, created_at, created_by, modified_at, current_address, permanent_address, avatar, occupation, deleted_at) FROM stdin;
20	amit.parent	amit.parent@gmail.com	$2b$12$example_hash_3	4	Amit	Singh	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
18	vikram.parent	vikram.parent@gmail.com	$2b$12$example_hash_3	4	Vikram	Patel	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
22	vikash.guardian	vikash.guardian@gmail.com	$2b$12$example_hash_3	5	Vikash	kumar	9876501113	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
12	hania.aamir	hania@gmail.com	$2a$10$bJw8cnOVpKhNsTsaVJFqLe52UcJW3q5MMcjs7g.LBWywyHLdoruBK	3	hani	aamir	9898989898	\N	t	2025-08-18 02:43:45.031947	\N	2025-08-18 02:43:45.031947	Not Provided	Not Provided		\N	\N
14	priya.sharma	priya@gmail.com	$2a$10$qineXii7PwUJMOKLkucpk.GJBiYpiDZOCzAbbGpsz7kt/J0R0aywm	2	Priya	Sharma	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
16	anil.patil	anil@gmail.com	$2a$10$ARJZHqTlseAp4eLPu1w5AOcS./uEiEzj1t7ZEfAhdIHVSsLnuo6ny	2	Anil	Patil	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
21	rajesh.guardian	rajesh.guardian@gmail.com	$2a$10$ju8GbKP6rQC2JsdQbY87EOcoa5Mob4xP2p9Wpz6plY5Q6rBI0lCF.	5	Rajesh	Kumar	9876501113	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
19	aamir.parent	aamir.parent@gmail.com	$2a$10$ddJqLtKBApP6NGepP7R5I.s9DGmt7N1.Nvi75gNLoO/wMzx6lArmG	4	Aamir	Khan	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
9	aarav.sharma	aarav.sharma@parent.com	$2a$10$rAvDxrcqbFDc04oIMyABsO9or38pLjHhkPlV.7gRI6LZojlrS/yIC	3	Aarav	Sharma	9876501111	\N	t	2025-08-14 04:15:06.141517	\N	2025-08-14 04:15:06.141517	Not Provided	Not Provided		\N	\N
15	rajesh.kumar	rajesh@gmail.com	$2a$10$joONX2LNcrJEOj8hHu7km.RU0lxfHwP/HLPtpQEuO0Cb07ofRz09G	2	Rajesh	Kumar	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
17	rajesh.parent	rajesh.parent@gmail.com	$2a$10$eVTosdHRXhYSZS5bvZOaeOJdUF71gw5ozQealXghvRGKW.B6lfS5i	4	Rajesh	Kumar	9876501111	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
11	arjun.kumar	arjun.kumar@parent.com	$2a$10$IVVZX8TDqdEUhUkRYp6CKuVJV/tx7g9i36x98CXS1kJ1WB9e/YwhS	3	Arjun	Kumar	9876501113	\N	t	2025-08-14 04:15:06.141517	\N	2025-08-14 04:15:06.141517	Not Provided	Not Provided		\N	\N
10	sara.patel	sara.patel@parent.com	$2a$10$ywGj/vWGNSgo.QUyxxH8HOHg79tKi2KPzjMXrnm1/1rB4nK3oBQqO	3	Sara	Patel	9876501112	\N	t	2025-08-14 04:15:06.141517	\N	2025-08-14 04:15:06.141517	Not Provided	Not Provided		\N	\N
13	Headmaster	headmaster@gmail.com	$2a$10$AdgMLLsnKvKy.g5As0co1.HsaLD7rPvbPlzePoTnAlqIiRAi7IsMC	1	Head	Master	9898989898	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		\N	\N
74	ramesh.driver@school.com	ramesh.driver@school.com	$2a$12$UC0ALDkp.RVPwX.rQcgNIuklF7FXFkdsLx4oKHJddTo1INCbWvFD.	9	Ramesh	Yadav	9876541111	\N	t	2026-04-24 17:36:26.841215	\N	2026-04-24 17:36:26.841215	Not Provided	Not Provided		\N	\N
75	suresh.driver@school.com	suresh.driver@school.com	$2a$12$xpBvyVnN6hPd3EvfAvfD2uVl2AI4oJwXUwfMkweeTZqVuyifY0tTe	9	Suresh	Patil	9876541113	\N	t	2026-04-24 17:36:26.841215	\N	2026-04-24 17:36:26.841215	Not Provided	Not Provided		\N	\N
76	mahesh.driver@school.com	mahesh.driver@school.com	$2a$12$gduCNkf5GI4Hb0Ro40yRh.2vlKSjPF8yZLOruPQgwKZr8FK0X2/5y	9	Mahesh	Kumar	9876541115	\N	t	2026-04-24 17:36:26.841215	\N	2026-04-24 17:36:26.841215	Not Provided	Not Provided		\N	\N
23	amit.guardian	amit.guardian@gmail.com	$2b$12$example_hash_3	5	Amit	patel	9876501113	\N	t	2026-02-05 18:06:39.689454	\N	2026-02-05 18:06:39.689454	Not Provided	Not Provided		Doctor	\N
122	stu_ay1_001	student.ay1.001@myschool.local	$2a$10$g1NWD.Lloht9OmKVQyV5je2/5Hd8zjh9PG8CmkRpZ8b9tpEvkLTXq	3	Ayaan	Khan	9800001001	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Ayaan1	\N	\N
123	stu_ay1_002	student.ay1.002@myschool.local	$2a$10$kIFAcTnglycBGF8WVlLWAeucbJKcYf1SkME9bsTwcHE8JduLDkKH2	3	Vihaan	Sharma	9800001002	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Vihaan1	\N	\N
124	stu_ay1_003	student.ay1.003@myschool.local	$2a$10$a8Maqj6n13Kp5duiLRTah.irjFPovRnXTXkoSlljMIHTsu3KgRkCG	3	Reyansh	Patel	9800001003	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Reyansh1	\N	\N
125	stu_ay1_004	student.ay1.004@myschool.local	$2a$10$DyUvULOB2rAV84kLg77IwOrNBDYnnyfc4VxnVWlnj1eWd3RWUAOai	3	Arjun	Ansari	9800001004	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Arjun1	\N	\N
126	stu_ay1_005	student.ay1.005@myschool.local	$2a$10$aFK5Hk.LtIYVYq7xwyCDpebYq6JYqxp/W.mxtlTWqfMWeKbb1VoaW	3	Ishaan	Mishra	9800001005	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Ishaan1	\N	\N
127	stu_ay1_006	student.ay1.006@myschool.local	$2a$10$mL3bVYuk0pHA6X7UzNQAH.KDYScTxGCYZJdpW6NZ0AC8uyokKqfFm	3	Kabir	Verma	9800001006	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Kabir1	\N	\N
128	stu_ay1_007	student.ay1.007@myschool.local	$2a$10$pqegRGPQc0JsiSTKmJBjPelYaJHaqauDnVPHMTiwF3RcxZZDL/K8W	3	Advik	Singh	9800001007	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Advik1	\N	\N
129	stu_ay1_008	student.ay1.008@myschool.local	$2a$10$IPpQHiSy7pcKbTFdLilCruxBZZFY8phF9xrQL3gsqMNpUZrvpI4ri	3	Sai	Qureshi	9800001008	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Sai1	\N	\N
130	stu_ay1_009	student.ay1.009@myschool.local	$2a$10$xjOgD4ssMLB6.1TbDmJI4OszeY/6CUhWOAhpgum9..cqa05ZnGH2y	3	Devansh	Shaikh	9800001009	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Devansh1	\N	\N
131	stu_ay1_010	student.ay1.010@myschool.local	$2a$10$r5o5EQ3O9eDPFg2azl9zm.jrYtQWBryM3EFAEMvh.QxWaiQv8JnIm	3	Rudra	Gupta	9800001010	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Rudra1	\N	\N
132	stu_ay1_011	student.ay1.011@myschool.local	$2a$10$tFVKKOd8ssCyzlKfAoDhk.hmtg.19Fj.M2eYbJjKqa/dS8KD4/RNS	3	Zayan	Naqvi	9800001011	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Zayan1	\N	\N
133	stu_ay1_012	student.ay1.012@myschool.local	$2a$10$5/OrAvrx3fdjgodaRoKyPeFKbdwGdS1DPPZy4nYeSRnE/mBsbj6fi	3	Aarav	Malik	9800001012	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aarav1	\N	\N
134	stu_ay1_013	student.ay1.013@myschool.local	$2a$10$xVDu4E4fV55n0vaXI/ZwuOdapQ.VnzXJ1FZ6/DKjYGIDumY0f1kdG	3	Laksh	Rao	9800001013	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Laksh1	\N	\N
135	stu_ay1_014	student.ay1.014@myschool.local	$2a$10$jNiSyTEbsYGeaD4dBjRS.e4AXJdzJ5c7vsuM0FZQHhmEV1UFkmmcO	3	Krish	Joshi	9800001014	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Krish1	\N	\N
136	stu_ay1_015	student.ay1.015@myschool.local	$2a$10$PewzjgK5DpZfnNRmfrXPz.bs.no69qhjaDuZwIfJ2fyYE36b.V/JC	3	Yuvraj	Kulkarni	9800001015	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Yuvraj1	\N	\N
137	stu_ay1_016	student.ay1.016@myschool.local	$2a$10$UgxfOt3.DEnpIMbectqPdOEv8Aa6wAD5UrLPP62rGLe4bZEu1N6Ni	3	Anaya	Deshmukh	9800001016	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Anaya1	\N	\N
138	stu_ay1_017	student.ay1.017@myschool.local	$2a$10$Gv1l1LsjD0V6Dr9DjkwQY.yr1jWFmJwjaLkP1rWDFL7HaiUqIOnZK	3	Myra	Chopra	9800001017	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Myra1	\N	\N
139	stu_ay1_018	student.ay1.018@myschool.local	$2a$10$AgdDYcdYtl0tlH2S9X7egO.D.icXSqhZmX28iJStJIEVdK4X7Z6DG	3	Aadhya	Siddiqui	9800001018	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aadhya1	\N	\N
140	stu_ay1_019	student.ay1.019@myschool.local	$2a$10$O2jna8GhPDC959GL2S7JEugZejcWoBp/IqySsUswpRav9aNHPxavW	3	Saanvi	Nair	9800001019	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Saanvi1	\N	\N
141	stu_ay1_020	student.ay1.020@myschool.local	$2a$10$QO8WhoI5iDsfCQBAciEG0OAZrG4CTZUF21XBm8RXHlO/i1LYnOwsS	3	Kiara	Menon	9800001020	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Kiara1	\N	\N
142	stu_ay1_021	student.ay1.021@myschool.local	$2a$10$J4hXEMik/UaqoJqIjlztP.qz6Ua4x89gs1A1YS4T.c8CBb0/aLeQi	3	Fatima	Pathan	9800001021	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Fatima1	\N	\N
143	stu_ay1_022	student.ay1.022@myschool.local	$2a$10$3l0GMlnkbtmHQxIoiLsBleXMEPDjLDnjSK.uREMRYqLHU0780kMlG	3	Aisha	Bano	9800001022	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aisha1	\N	\N
144	stu_ay1_023	student.ay1.023@myschool.local	$2a$10$zNpp78oyU4EE0kBTTdCJM.DdAW.ERUZoOa486hvP3DV3k6iM.CRvi	3	Inaya	Rahman	9800001023	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Inaya1	\N	\N
145	stu_ay1_024	student.ay1.024@myschool.local	$2a$10$8WjKAK5j334RRKoOTS6nZuke2aGLOgxYfCypzzvsMrI0XigJEwcne	3	Sara	Iqbal	9800001024	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Sara1	\N	\N
146	stu_ay1_025	student.ay1.025@myschool.local	$2a$10$Fk/i1Yj3j8Xnaqi3f80k0eI78GslC9XtWGf53Ep/1nqlZDz9DytMu	3	Zoya	Hussain	9800001025	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Zoya1	\N	\N
147	stu_ay1_026	student.ay1.026@myschool.local	$2a$10$e8R5mUHsuTRTTuawXYS/NOz7PR4ES2BQG5RyIBKGbmTlesG34C/vO	3	Meher	Tiwari	9800001026	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Meher1	\N	\N
148	stu_ay1_027	student.ay1.027@myschool.local	$2a$10$PK4rF3CpfWYsQJ4/jR5Dr.rpIsG50fBrjATIxUGE2rftLX0KPDmtW	3	Anvi	Yadav	9800001027	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Anvi1	\N	\N
149	stu_ay1_028	student.ay1.028@myschool.local	$2a$10$ePNVYgUNjRGjlVy8FNuIveTTnaFD0yYGe4AmNr8nGj6V93P7t4mEm	3	Riya	Jain	9800001028	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Riya1	\N	\N
150	stu_ay1_029	student.ay1.029@myschool.local	$2a$10$v5cNRTWl32lEdl1D2nqmGeQEa82snBbaEn5skIJ1nKFfF0hROPwJW	3	Naina	Kapoor	9800001029	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Naina1	\N	\N
151	stu_ay1_030	student.ay1.030@myschool.local	$2a$10$sRenQk4lYo.xSk5Jl.XwZ.GDefk1ANakqXOaWthI3DUdyuLaJay6S	3	Tara	Bhatt	9800001030	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Tara1	\N	\N
152	stu_ay1_031	student.ay1.031@myschool.local	$2a$10$UY9eXBXc/k5ifgJZCA.E4.AUYLSeQFllkP.BVIJ.4/AfTvaF/ccnW	3	Prisha	Pillai	9800001031	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Prisha1	\N	\N
153	stu_ay1_032	student.ay1.032@myschool.local	$2a$10$UoUVVHBuXzkXLu6qkp2WAOcPFSBVqQ3ZMGie5tp7BVF.UbQTqZ/Fi	3	Siya	Thomas	9800001032	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Siya1	\N	\N
154	stu_ay1_033	student.ay1.033@myschool.local	$2a$10$bQk5uM2ZxKwKAk0YTrIivODPtPx1Mj.CGyUubeVc7PgKlmOAJE0W6	3	Pari	Dutta	9800001033	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Pari1	\N	\N
155	stu_ay1_034	student.ay1.034@myschool.local	$2a$10$yrkWJMHnB/sS47gzXyJJJOGAH8tbegL4NrHmlEkbDfl/l39R3Ukh2	3	Navya	Saxena	9800001034	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Navya1	\N	\N
156	stu_ay1_035	student.ay1.035@myschool.local	$2a$10$sV6CPJaVq5kFUJ7FkF9SLOmgo.BtmxXh3eJVz9yLvpAgTB0Wh4niS	3	Riddhi	Trivedi	9800001035	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Riddhi1	\N	\N
157	stu_ay1_036	student.ay1.036@myschool.local	$2a$10$fwEWP5270hdydqBBWVOhr.EmSVUZiWo/JVidncFY8adMHv52loZe2	3	Hridya	Chauhan	9800001036	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Hridya1	\N	\N
158	stu_ay1_037	student.ay1.037@myschool.local	$2a$10$0WtX5Ojp/D/M4ekYcxcnkOuvYjKaKS.Lh6qMksoWpwPim6r46JFjG	3	Mahir	Bhardwaj	9800001037	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Mahir1	\N	\N
159	stu_ay1_038	student.ay1.038@myschool.local	$2a$10$WGEHhrcNspZiREPaGjT6ausSdXB1/rSthSouOOqo3UXlI1sWdr7Uu	3	Shaurya	Srivastava	9800001038	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Shaurya1	\N	\N
160	stu_ay1_039	student.ay1.039@myschool.local	$2a$10$IdykvosZa803cbi7JuGECOWnuck8hHK8rq9KO7zlsqOZYh4qIy9/G	3	Dhruv	Farooqui	9800001039	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Dhruv1	\N	\N
161	stu_ay1_040	student.ay1.040@myschool.local	$2a$10$dXid5jJs4Vb06n//9S23ce8pciPgSAlu2yGTEoTRZN.0gvsPk/RnO	3	Rayan	Kazi	9800001040	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Rayan1	\N	\N
162	stu_ay1_041	student.ay1.041@myschool.local	$2a$10$EDR8b0WKSRJfklMxjYyZbu0E7HPLY6a.xWl5ctbHLC2WForFUOw5i	3	Arnav	Gandhi	9800001041	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Arnav1	\N	\N
163	stu_ay1_042	student.ay1.042@myschool.local	$2a$10$ZnwS/M1vlSfPHqnbh.2xduwD1SevY1uChLdMFf7DypTYX6iNCnp9.	3	Nivaan	Parekh	9800001042	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Nivaan1	\N	\N
164	stu_ay1_043	student.ay1.043@myschool.local	$2a$10$rV25w9LeXIiX6wAQHXOlMeT/QFxUiQZTrJHBpQb87PpAVyIvY/IwC	3	Samaira	Reddy	9800001043	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Samaira1	\N	\N
165	stu_ay1_044	student.ay1.044@myschool.local	$2a$10$38qJRK6O25UlZ/LwBjVJYOh11X54Ccydyu.Uww5gyAs.NrnGZohBK	3	Misha	Lodhi	9800001044	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Misha1	\N	\N
166	stu_ay1_045	student.ay1.045@myschool.local	$2a$10$8vzWZcTHGB2SZ0MTKK3PBejkDlUhShkd4kmHt.r/zs0b6PvzBtgs6	3	Alina	Basu	9800001045	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Alina1	\N	\N
167	stu_ay2_001	student.ay2.001@myschool.local	$2a$10$JJforRx9YhJfdXXUyeNc3evRRCDzar2./vB9cvFN8SY9ZeSKBHUQi	3	Ayaan	Khan	9800002001	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Ayaan2	\N	\N
168	stu_ay2_002	student.ay2.002@myschool.local	$2a$10$2ydrDjG.EDuMfG4XE.m/beF4Z5NfjRfIJnsXFjv7m0gbysvT1x2PG	3	Vihaan	Sharma	9800002002	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Vihaan2	\N	\N
169	stu_ay2_003	student.ay2.003@myschool.local	$2a$10$wGh.FGlFWwopO1WpCEAkzunJFqfqteYuXRT9Q1u36QVF6oquXq.G6	3	Reyansh	Patel	9800002003	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Reyansh2	\N	\N
170	stu_ay2_004	student.ay2.004@myschool.local	$2a$10$gUYiFW1riUulFinC1J9XGOc61LCaffUBOdw0dFPSldzytG.W8YA82	3	Arjun	Ansari	9800002004	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Arjun2	\N	\N
171	stu_ay2_005	student.ay2.005@myschool.local	$2a$10$AwTSwrILVhdn0ebIknvTpuIhXvBkcdxgJX1uYqojF/ZNkU/8K6tZm	3	Ishaan	Mishra	9800002005	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Ishaan2	\N	\N
172	stu_ay2_006	student.ay2.006@myschool.local	$2a$10$QSumbjxBApJXyS6Rb85Wh.wNGlYycjMC9/nHPjX30RxRYZt2..wSG	3	Kabir	Verma	9800002006	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Kabir2	\N	\N
173	stu_ay2_007	student.ay2.007@myschool.local	$2a$10$r07vZLEfNBiGH17NP2GDvelsVHO9slI.WQ1tKDYmBxQtaEm63eQ9u	3	Advik	Singh	9800002007	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Advik2	\N	\N
174	stu_ay2_008	student.ay2.008@myschool.local	$2a$10$T09oWs6yyZYlkk3w7UEjN.8HO6AR3luG6xdWpTfKe1FlMRt6dunHy	3	Sai	Qureshi	9800002008	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Sai2	\N	\N
175	stu_ay2_009	student.ay2.009@myschool.local	$2a$10$8YJzYjrLsX/c.QLK66LNrONiljtygMVYNmIxtdQifydMsQCiSh8sG	3	Devansh	Shaikh	9800002009	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Devansh2	\N	\N
176	stu_ay2_010	student.ay2.010@myschool.local	$2a$10$xlRyV/Jr1CvOSMcV18MxUe4jEM0fZBMDWfzIYmaDWWECikhBdeorG	3	Rudra	Gupta	9800002010	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Rudra2	\N	\N
177	stu_ay2_011	student.ay2.011@myschool.local	$2a$10$gfZNa1Ze9/rh4MRF0Jvbgu9jr2cJY62POFrlJptBcXmy3/m0GUohW	3	Zayan	Naqvi	9800002011	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Zayan2	\N	\N
178	stu_ay2_012	student.ay2.012@myschool.local	$2a$10$kYYBygOM0E.8BPUF0eixF.8.M6nIP.Q/TsAtnnNAu7PcayqkmiOcC	3	Aarav	Malik	9800002012	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aarav2	\N	\N
179	stu_ay2_013	student.ay2.013@myschool.local	$2a$10$r2lWPcEz2uc2JjRio0NRwu4Gvim9jLOp967S.widx1Oiji5Unf41e	3	Laksh	Rao	9800002013	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Laksh2	\N	\N
180	stu_ay2_014	student.ay2.014@myschool.local	$2a$10$f2OJ1cLGQXriiWZ4shoq1eVKyLgF.H4p/SoeyTA/FlBcc.Rb8J/Gy	3	Krish	Joshi	9800002014	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Krish2	\N	\N
181	stu_ay2_015	student.ay2.015@myschool.local	$2a$10$2sHriD2.rKUujmmCl8VQD.uJzEABl3tdIG/roogXZnok9xmEaC4He	3	Yuvraj	Kulkarni	9800002015	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Yuvraj2	\N	\N
182	stu_ay2_016	student.ay2.016@myschool.local	$2a$10$q7JGMfSbYLnPl0ovYU2Z8uI820rkIlvsdIhy6GT3RyZhUzn0YAZE2	3	Anaya	Deshmukh	9800002016	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Anaya2	\N	\N
183	stu_ay2_017	student.ay2.017@myschool.local	$2a$10$kS65c4ZjKHqByo1EBE5cTuUL9aAWSWpMINBUVQ.B3Cfs8.ZvZGfS6	3	Myra	Chopra	9800002017	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Myra2	\N	\N
184	stu_ay2_018	student.ay2.018@myschool.local	$2a$10$3rsLTaRHtNkWHeQoG3aIUOF96ozpbJl0SEvdxJ7xorDpPrFGViX3m	3	Aadhya	Siddiqui	9800002018	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aadhya2	\N	\N
185	stu_ay2_019	student.ay2.019@myschool.local	$2a$10$F1XyQcUhnkM/b8/qXPzbSua4TBXrl78J15497Jvvae5SWKnB15W26	3	Saanvi	Nair	9800002019	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Saanvi2	\N	\N
186	stu_ay2_020	student.ay2.020@myschool.local	$2a$10$J.IX7NE0rwUcSa/i8Qk.Kucup3a2hSwneqFdNChQHjC1mKN6RGRxG	3	Kiara	Menon	9800002020	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Kiara2	\N	\N
187	stu_ay2_021	student.ay2.021@myschool.local	$2a$10$fo.cA1EqMI3zmTbopjuq5uq6KA9dTo8inIsuz.zaYd/wuYtHnL4kq	3	Fatima	Pathan	9800002021	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Fatima2	\N	\N
188	stu_ay2_022	student.ay2.022@myschool.local	$2a$10$XR1NO7AKgOG7BivppFHkyup80PV34nAKkFiNXjMYaXkZdcYlcGcIu	3	Aisha	Bano	9800002022	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aisha2	\N	\N
189	stu_ay2_023	student.ay2.023@myschool.local	$2a$10$GB/R3dLrLLMyhN.6gZP3IuE4Z06S9RhNQ/KRWL/271reZEJ9JCyG2	3	Inaya	Rahman	9800002023	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Inaya2	\N	\N
190	stu_ay2_024	student.ay2.024@myschool.local	$2a$10$smPtmqn7OGj6ML5zO5jRiO22M.pE.Z.Y/AMpz3LQEl.WbWpAJY6mW	3	Sara	Iqbal	9800002024	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Sara2	\N	\N
191	stu_ay2_025	student.ay2.025@myschool.local	$2a$10$AM1yV0P8NEcGWOLhBQRVUOGxcCLM3mc90TLiysssLAtmxUjSwndsC	3	Zoya	Hussain	9800002025	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Zoya2	\N	\N
192	stu_ay2_026	student.ay2.026@myschool.local	$2a$10$nFd1qvEwHUB1EeIBZlbB2.0YFIwXwGMs5zMBvYyA8QaNn/0q78V7K	3	Meher	Tiwari	9800002026	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Meher2	\N	\N
193	stu_ay2_027	student.ay2.027@myschool.local	$2a$10$XV/F6wL245o2dcy.S8AuVeI6VRmr1zvQqWnRFxGnt2fezkK1itJ22	3	Anvi	Yadav	9800002027	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Anvi2	\N	\N
194	stu_ay2_028	student.ay2.028@myschool.local	$2a$10$iTb0f/RufMGeC6R0axhbr.MwhwRpRvzloyk1Ka2H903Pd3j5ypDKW	3	Riya	Jain	9800002028	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Riya2	\N	\N
195	stu_ay2_029	student.ay2.029@myschool.local	$2a$10$zcfLOYPCnukgc5/VWfL.9.BphDWVje.CJqxCMOEbQd.k/8ZUoslae	3	Naina	Kapoor	9800002029	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Naina2	\N	\N
196	stu_ay2_030	student.ay2.030@myschool.local	$2a$10$qZYKJTyTEzNQsR6egEbRq.vWp/BGZgzGD.4bf/QHUZ173hlPD8SqO	3	Tara	Bhatt	9800002030	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Tara2	\N	\N
197	stu_ay2_031	student.ay2.031@myschool.local	$2a$10$dMZ//BDQblQOLlZ.eLlN/OZYSf781xf3.wEAwyRw4gyqh1EAmbhW6	3	Prisha	Pillai	9800002031	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Prisha2	\N	\N
198	stu_ay2_032	student.ay2.032@myschool.local	$2a$10$5W6f6rYvwr9vXPyuSS4hmutRA1MicIautAuPuAYz/XxcojfEztM76	3	Siya	Thomas	9800002032	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Siya2	\N	\N
199	stu_ay2_033	student.ay2.033@myschool.local	$2a$10$o.32JOOEHFfGRnRGnFwz8udNZMKQB6LHX.mdbWUQtPww.nMobiYRi	3	Pari	Dutta	9800002033	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Pari2	\N	\N
200	stu_ay2_034	student.ay2.034@myschool.local	$2a$10$Fq2UlcNf5q/tN7krF3QE8O4M1NmEAwhrCOfjWrbvu.K5edhf8GeaS	3	Navya	Saxena	9800002034	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Navya2	\N	\N
201	stu_ay2_035	student.ay2.035@myschool.local	$2a$10$rZpp.80.90CqbVo2CuExGOsQI6QxEADL6g5JvuhxhUrrfhbMh.n/i	3	Riddhi	Trivedi	9800002035	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Riddhi2	\N	\N
202	stu_ay2_036	student.ay2.036@myschool.local	$2a$10$oZhunjWW7Su1Omfm68Sx1eGxhvO6bvT7Iymf2KP9XYAW4VQcsRKZe	3	Hridya	Chauhan	9800002036	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Hridya2	\N	\N
203	stu_ay2_037	student.ay2.037@myschool.local	$2a$10$2ET4tEJboVwNy8pw6YYdvu5PkkqTZ0IsZksdJo1qPRbTRiaHZKq3C	3	Mahir	Bhardwaj	9800002037	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Mahir2	\N	\N
204	stu_ay2_038	student.ay2.038@myschool.local	$2a$10$ds0Qaf/cjr5Qh5LxXcsENO78zaBE4U4X3UbJfS8IHGXPcoUXHAZKK	3	Shaurya	Srivastava	9800002038	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Shaurya2	\N	\N
205	stu_ay2_039	student.ay2.039@myschool.local	$2a$10$PILJ9zadZttJcowpw3lT5OKO0KYVTXKpQJgVgNhoSp3l9foq2D7WS	3	Dhruv	Farooqui	9800002039	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Dhruv2	\N	\N
206	stu_ay2_040	student.ay2.040@myschool.local	$2a$10$vPRv8QhIuxHAt6OcHc9gpOOI3m6ZmpEUhNGJVo2m6MjkuWcEt4XWK	3	Rayan	Kazi	9800002040	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Rayan2	\N	\N
207	stu_ay2_041	student.ay2.041@myschool.local	$2a$10$OhTWDomtrjCblyFiR6Hc7.8q6HN3Dl7TgFlfOuaLx.4p9bCGkWO2y	3	Arnav	Gandhi	9800002041	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Arnav2	\N	\N
208	stu_ay2_042	student.ay2.042@myschool.local	$2a$10$qTdqi5Rz5RUlixTg/VoF6O4OIJWCaIf6Gr4veyxXLZko4DAAxlfAq	3	Nivaan	Parekh	9800002042	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Nivaan2	\N	\N
209	stu_ay2_043	student.ay2.043@myschool.local	$2a$10$9Qe5SQY/floIT9loUNCSrOMCUX278Ub8E/ILpzYAVIjmzeA07vtVy	3	Samaira	Reddy	9800002043	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Samaira2	\N	\N
210	stu_ay2_044	student.ay2.044@myschool.local	$2a$10$9FK91MH91N694zeVY8qeXO3DQzCs07aShKrlOV80cqhqINeqzchhe	3	Misha	Lodhi	9800002044	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Misha2	\N	\N
211	stu_ay2_045	student.ay2.045@myschool.local	$2a$10$zLgKgxkR..BVScsf/t3YD.4OmHYlpIEnJJHP0LNhbDq0PDDfQLNIy	3	Alina	Basu	9800002045	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Alina2	\N	\N
212	stu_ay3_001	student.ay3.001@myschool.local	$2a$10$qxp90/rxUsrQZsVqHZ1PDu/vRrZ4hrmZ6TB5Kkh0skQl0ZdFmMvt6	3	Ayaan	Khan	9800003001	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 1, Green Residency, Civil Lines	Village Road 1, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Ayaan3	\N	\N
213	stu_ay3_002	student.ay3.002@myschool.local	$2a$10$12DYbSlqN0l3sEoidRkI3.NhclT4u9IEFfogw9WmtRQ7vWBHlW3.S	3	Vihaan	Sharma	9800003002	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 2, Green Residency, Civil Lines	Village Road 2, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Vihaan3	\N	\N
214	stu_ay3_003	student.ay3.003@myschool.local	$2a$10$zBwNwzIJvIP9LOYFwkcMQuINE50aZz7EUz9z5sXhXBaceifHhNVee	3	Reyansh	Patel	9800003003	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 3, Green Residency, Civil Lines	Village Road 3, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Reyansh3	\N	\N
215	stu_ay3_004	student.ay3.004@myschool.local	$2a$10$uBxNPEL0e/Bk1wVAp5o9m.QUnQgMJOLY5TsfcmaqeiDHaHeyutmA.	3	Arjun	Ansari	9800003004	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 4, Green Residency, Civil Lines	Village Road 4, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Arjun3	\N	\N
216	stu_ay3_005	student.ay3.005@myschool.local	$2a$10$tmlUSW9rxfsYcpd5aQ2h5uiSXfEvwmhwVW8VMj19r8l/RWoyRhPRi	3	Ishaan	Mishra	9800003005	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 5, Green Residency, Civil Lines	Village Road 5, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Ishaan3	\N	\N
217	stu_ay3_006	student.ay3.006@myschool.local	$2a$10$lKdcVcIi/yuPDpxnLWy.O.vvleX69Qjs5wKyIKG/KosY5PPDMx/66	3	Kabir	Verma	9800003006	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 6, Green Residency, Civil Lines	Village Road 6, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Kabir3	\N	\N
218	stu_ay3_007	student.ay3.007@myschool.local	$2a$10$ExjNWx7CBvxSn4o2T69XZ.zkFPzfCyKo.jD9i75clJTlZUpr23sSG	3	Advik	Singh	9800003007	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 7, Green Residency, Civil Lines	Village Road 7, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Advik3	\N	\N
219	stu_ay3_008	student.ay3.008@myschool.local	$2a$10$bvanVM/6nrJ2hd958CvsduCPBbwDmX8P2.72V7rm3pL8mLXMzul9y	3	Sai	Qureshi	9800003008	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 8, Green Residency, Civil Lines	Village Road 8, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Sai3	\N	\N
220	stu_ay3_009	student.ay3.009@myschool.local	$2a$10$7lwM085rZROouEiVJNdc6Oum1Ebva3Voh7Y9wAy4.s19Z2D4QRane	3	Devansh	Shaikh	9800003009	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 9, Green Residency, Civil Lines	Village Road 9, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Devansh3	\N	\N
221	stu_ay3_010	student.ay3.010@myschool.local	$2a$10$KqsPoqjFaa9qUzBhx/bfMu7QboZfubSXzriF0.vrbhDLCK8N85yDG	3	Rudra	Gupta	9800003010	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 10, Green Residency, Civil Lines	Village Road 10, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Rudra3	\N	\N
222	stu_ay3_011	student.ay3.011@myschool.local	$2a$10$HUuMYzk./LhI0bYNjB2sl.Fts0wm42WUYW/L8HcPkdnMzkQxGQvm2	3	Zayan	Naqvi	9800003011	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 11, Green Residency, Civil Lines	Village Road 11, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Zayan3	\N	\N
223	stu_ay3_012	student.ay3.012@myschool.local	$2a$10$UT/3LLLibl9r.XsKdwTuf.EqQa2ipj8N8Vnr1zr4LrgSj576dK0t.	3	Aarav	Malik	9800003012	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 12, Green Residency, Civil Lines	Village Road 12, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aarav3	\N	\N
224	stu_ay3_013	student.ay3.013@myschool.local	$2a$10$7SDYg7aJKcL27NZKp3GzCOVmXv/p6fDN.S6zMNaZ2Mze1OEvDwjVi	3	Laksh	Rao	9800003013	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 13, Green Residency, Civil Lines	Village Road 13, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Laksh3	\N	\N
225	stu_ay3_014	student.ay3.014@myschool.local	$2a$10$UoNYVyy.gu6GN25dr/dSr.3fwb1EFkpWSfeVektHQQXf77O5ymYS.	3	Krish	Joshi	9800003014	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 14, Green Residency, Civil Lines	Village Road 14, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Krish3	\N	\N
226	stu_ay3_015	student.ay3.015@myschool.local	$2a$10$UOieOz76ce3GJDS7zAkoV.WqoDpE05tL8eQPTAyzecvyVVw0b4UNS	3	Yuvraj	Kulkarni	9800003015	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 15, Green Residency, Civil Lines	Village Road 15, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Yuvraj3	\N	\N
227	stu_ay3_016	student.ay3.016@myschool.local	$2a$10$r7vKXGkaCUUms4EkCknA9ed/r5A3uLpwZBlrz9OYj4UpuIy41h3Dy	3	Anaya	Deshmukh	9800003016	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 16, Green Residency, Civil Lines	Village Road 16, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Anaya3	\N	\N
228	stu_ay3_017	student.ay3.017@myschool.local	$2a$10$R76bvSEqFklBMkVOEzKy/eCLMkPYOQGNaarfG64icnROaBj5W3/lG	3	Myra	Chopra	9800003017	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 17, Green Residency, Civil Lines	Village Road 17, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Myra3	\N	\N
229	stu_ay3_018	student.ay3.018@myschool.local	$2a$10$rKPbPpZerXWTDDIk5I7Ka.WitZ6m.Vxa.nEPGIZzuqlIi9/X8PMxK	3	Aadhya	Siddiqui	9800003018	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 18, Green Residency, Civil Lines	Village Road 18, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aadhya3	\N	\N
230	stu_ay3_019	student.ay3.019@myschool.local	$2a$10$Z6KOe4tKeS572yoWQsXOxuChmRErU8tKN79THsi6bJsPZFeDuxl9C	3	Saanvi	Nair	9800003019	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 19, Green Residency, Civil Lines	Village Road 19, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Saanvi3	\N	\N
231	stu_ay3_020	student.ay3.020@myschool.local	$2a$10$ZbTl9L6F9snV7LzEakPoX.vlBu1S2fC3SQbwNmfPE.vxog.XN01L.	3	Kiara	Menon	9800003020	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 20, Green Residency, Civil Lines	Village Road 20, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Kiara3	\N	\N
232	stu_ay3_021	student.ay3.021@myschool.local	$2a$10$2AdT81Yptdi6EIspyD7rNOJASZXAWsfZS7T6hl3lQmJ5FB/Kyft3i	3	Fatima	Pathan	9800003021	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 21, Green Residency, Civil Lines	Village Road 21, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Fatima3	\N	\N
233	stu_ay3_022	student.ay3.022@myschool.local	$2a$10$g/xVkiaFdmyxXLgv3dlNvetjALm0283VOS.xpNd./eEgajOSSibZ.	3	Aisha	Bano	9800003022	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 22, Green Residency, Civil Lines	Village Road 22, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Aisha3	\N	\N
234	stu_ay3_023	student.ay3.023@myschool.local	$2a$10$muCloj2AobYO1HfmIDVniObli2K6wmqkQshEp0uwUxkSeuhtKUWSW	3	Inaya	Rahman	9800003023	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 23, Green Residency, Civil Lines	Village Road 23, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Inaya3	\N	\N
235	stu_ay3_024	student.ay3.024@myschool.local	$2a$10$jh95TOp/WFp.fYLiT8onBeagqvRl1PCF/BK595qAzwi8OJYcLSAty	3	Sara	Iqbal	9800003024	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 24, Green Residency, Civil Lines	Village Road 24, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Sara3	\N	\N
236	stu_ay3_025	student.ay3.025@myschool.local	$2a$10$qd.03NXHdjJGwBWJLFdNV.HA5fTSdeJAIiOx4GHCwKAZMF0OM6GES	3	Zoya	Hussain	9800003025	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 25, Green Residency, Civil Lines	Village Road 25, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Zoya3	\N	\N
237	stu_ay3_026	student.ay3.026@myschool.local	$2a$10$wQtKaeA7WIFk5r3HlvWoK.F4WXAqReolk9yRbsMlIEV1pz2ZbPzmm	3	Meher	Tiwari	9800003026	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 26, Green Residency, Civil Lines	Village Road 26, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Meher3	\N	\N
238	stu_ay3_027	student.ay3.027@myschool.local	$2a$10$0b5sVah0ZPCJvhvVKWY/hu9ls55iEMSupK.7X8d/1tP9wtJq9gdsC	3	Anvi	Yadav	9800003027	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 27, Green Residency, Civil Lines	Village Road 27, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Anvi3	\N	\N
239	stu_ay3_028	student.ay3.028@myschool.local	$2a$10$5.Nse2Ved0NzkbPFMzftRuavsrSy8vF9LAiqe2EClJXBHbVoe/yZC	3	Riya	Jain	9800003028	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 28, Green Residency, Civil Lines	Village Road 28, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Riya3	\N	\N
240	stu_ay3_029	student.ay3.029@myschool.local	$2a$10$tCj7WGXod7xluiqKWhyr8O/CBFroP.MJ6eZFJYAmkjZxZB3/MHiBq	3	Naina	Kapoor	9800003029	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 29, Green Residency, Civil Lines	Village Road 29, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Naina3	\N	\N
241	stu_ay3_030	student.ay3.030@myschool.local	$2a$10$5Jcc/vcDL0lmnNyZha1wUe5SHnmLfWkoCE1xyPWSI3U7gvGabuu/K	3	Tara	Bhatt	9800003030	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 30, Green Residency, Civil Lines	Village Road 30, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Tara3	\N	\N
242	stu_ay3_031	student.ay3.031@myschool.local	$2a$10$bt/M940DQNGFTg6W1E1qauzYAYZCe5z3MEh7yCJuLh/CrOaUmcKVC	3	Prisha	Pillai	9800003031	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 31, Green Residency, Civil Lines	Village Road 31, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Prisha3	\N	\N
243	stu_ay3_032	student.ay3.032@myschool.local	$2a$10$A.CaNktpR9MaKDF6CFrX1.6OIJQVNrwq1KAOhi81o/D59x6W8rVcW	3	Siya	Thomas	9800003032	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 32, Green Residency, Civil Lines	Village Road 32, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Siya3	\N	\N
244	stu_ay3_033	student.ay3.033@myschool.local	$2a$10$68lAPG/1zzQR7zxI.Mlkkeoh7V7AeW3i50Vtb889BoP4SA/758C5G	3	Pari	Dutta	9800003033	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 33, Green Residency, Civil Lines	Village Road 33, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Pari3	\N	\N
245	stu_ay3_034	student.ay3.034@myschool.local	$2a$10$5iK0sQGiODMYI7qBA30nkO/k7b29ZNo7E3MYHGnIYEyw2UXt/4Reu	3	Navya	Saxena	9800003034	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 34, Green Residency, Civil Lines	Village Road 34, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Navya3	\N	\N
246	stu_ay3_035	student.ay3.035@myschool.local	$2a$10$SAefkcwI73/xf/4kLQYIHeg1fPVtQU9VIsz4eaiiSEZ08k/XxJQnu	3	Riddhi	Trivedi	9800003035	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 35, Green Residency, Civil Lines	Village Road 35, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Riddhi3	\N	\N
247	stu_ay3_036	student.ay3.036@myschool.local	$2a$10$XnsUZEd7SrVvOWuA3RhuX.lzC.JI5FAA1kcDXlo7Jpka9L5J6dxja	3	Hridya	Chauhan	9800003036	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 36, Green Residency, Civil Lines	Village Road 36, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Hridya3	\N	\N
248	stu_ay3_037	student.ay3.037@myschool.local	$2a$10$Dw7qVdfGhtnKqtcqQrUkO.10Db.mibTGtViP6rv0D/Esi2ESZzXFq	3	Mahir	Bhardwaj	9800003037	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 37, Green Residency, Civil Lines	Village Road 37, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Mahir3	\N	\N
249	stu_ay3_038	student.ay3.038@myschool.local	$2a$10$G0ngV/WqXQV1KLgIeMHZbui1AX5KAkRdEvSEDTB.e/LHXOKNCWBNO	3	Shaurya	Srivastava	9800003038	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 38, Green Residency, Civil Lines	Village Road 38, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Shaurya3	\N	\N
250	stu_ay3_039	student.ay3.039@myschool.local	$2a$10$TECQSvBMyDKsi2YAyDU8UOquHuxDkeg5Ernj2gMXj9xTW/z4rIZlO	3	Dhruv	Farooqui	9800003039	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 39, Green Residency, Civil Lines	Village Road 39, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Dhruv3	\N	\N
251	stu_ay3_040	student.ay3.040@myschool.local	$2a$10$ClNPsk8vM621wkoaWyDFMeh4IMercZc.tvKgXVbtsduOVsZiPBT9m	3	Rayan	Kazi	9800003040	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 40, Green Residency, Civil Lines	Village Road 40, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Rayan3	\N	\N
252	stu_ay3_041	student.ay3.041@myschool.local	$2a$10$JUGb25InArZqLpEfQISZneq4EKqU89sI1reZcWBxcMApT7o0LfCi6	3	Arnav	Gandhi	9800003041	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 41, Green Residency, Civil Lines	Village Road 41, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Arnav3	\N	\N
253	stu_ay3_042	student.ay3.042@myschool.local	$2a$10$m4WvDhtkLf1MrDqGQDymi.Jelg5VGYAm6DnT3c0SzfDELqU.55wQa	3	Nivaan	Parekh	9800003042	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 42, Green Residency, Civil Lines	Village Road 42, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Nivaan3	\N	\N
254	stu_ay3_043	student.ay3.043@myschool.local	$2a$10$mlglXeHPLpFneDEkwClcsuF9MzTJZFHeSHmuLIhSugRZ93p0T33I2	3	Samaira	Reddy	9800003043	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 43, Green Residency, Civil Lines	Village Road 43, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Samaira3	\N	\N
255	stu_ay3_044	student.ay3.044@myschool.local	$2a$10$LTryeKNFFNeJvQwntxqG4Obu18PLQqKc8OR2achPbb1WSMe/2QBSC	3	Misha	Lodhi	9800003044	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 44, Green Residency, Civil Lines	Village Road 44, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Misha3	\N	\N
256	stu_ay3_045	student.ay3.045@myschool.local	$2a$10$voHq/EiMAVttNWXaTArv7uKIZM2z8HvztRDwU72RBsqXBPs.nqX3i	3	Alina	Basu	9800003045	\N	t	2026-04-24 17:36:31.826133	\N	2026-04-24 17:36:31.826133	Flat 45, Green Residency, Civil Lines	Village Road 45, District Campus Area	https://api.dicebear.com/8.x/adventurer/svg?seed=Alina3	\N	\N
\.

COPY public.vehicles (id, vehicle_number, vehicle_type, brand, model, seating_capacity, driver_id, route_id, insurance_expiry, fitness_certificate_expiry, permit_expiry, fuel_type, is_active, created_at, created_by, modified_at, made_of_year, registration_number, chassis_number, gps_device_id, academic_year_id, deleted_at, updated_at) FROM stdin;
2	MH31CD5678	bus	Ashok Leyland	Lynx	40	2	2	2025-08-20	2025-06-15	2025-12-31	diesel	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416	2021	2222	ch2222	gps2222	3	\N	2026-04-24 17:36:28.145919+05:30
3	MH31EF9012	van	Mahindra	Bolero Maxi Truck	15	3	3	2025-05-10	2025-03-25	2025-12-31	diesel	t	2025-08-14 04:12:16.81416	\N	2025-08-14 04:12:16.81416	2019	3333	ch3333	gps3333	3	\N	2026-04-24 17:36:28.145919+05:30
1	MH31AB1234	bus	Tata	LP 909	35	1	1	2025-06-15	2025-04-30	2025-12-31	diesel	t	2025-08-14 04:12:16.81416	\N	2026-02-17 16:45:47.113365	2020	1111	ch1111	gps1111	3	\N	2026-04-24 17:36:28.145919+05:30
\.

SELECT pg_catalog.setval('public.academic_years_id_seq', 39, true);
SELECT pg_catalog.setval('public.account_delete_requests_id_seq', 1, false);
SELECT pg_catalog.setval('public.accounts_expense_categories_id_seq', 1, false);
SELECT pg_catalog.setval('public.accounts_expenses_id_seq', 1, false);
SELECT pg_catalog.setval('public.accounts_income_id_seq', 1, false);
SELECT pg_catalog.setval('public.accounts_invoices_id_seq', 1, false);
SELECT pg_catalog.setval('public.accounts_transactions_id_seq', 1, false);
SELECT pg_catalog.setval('public.addresses_id_seq', 187, true);
SELECT pg_catalog.setval('public.attendance_id_seq', 3, true);
SELECT pg_catalog.setval('public.blocked_users_id_seq', 1, false);
SELECT pg_catalog.setval('public.blood_groups_id_seq', 25, true);
SELECT pg_catalog.setval('public.calendar_events_id_seq', 3, true);
SELECT pg_catalog.setval('public.calls_id_seq', 3, true);
SELECT pg_catalog.setval('public.casts_id_seq', 5, true);
SELECT pg_catalog.setval('public.chat_settings_id_seq', 1, true);
SELECT pg_catalog.setval('public.chats_id_seq', 9, true);
SELECT pg_catalog.setval('public.class_rooms_id_seq', 10, true);
SELECT pg_catalog.setval('public.class_schedules_id_seq', 3, true);
SELECT pg_catalog.setval('public.class_syllabus_id_seq', 10, true);
SELECT pg_catalog.setval('public.classes_id_seq', 35, true);
SELECT pg_catalog.setval('public.departments_id_seq', 11, true);
SELECT pg_catalog.setval('public.designations_id_seq', 23, true);
SELECT pg_catalog.setval('public.document_types_id_seq', 3, true);
SELECT pg_catalog.setval('public.documents_id_seq', 3, true);
SELECT pg_catalog.setval('public.drivers_id_seq', 3, true);
SELECT pg_catalog.setval('public.emails_id_seq', 3, true);
SELECT pg_catalog.setval('public.enquiries_id_seq', 1, false);
SELECT pg_catalog.setval('public.event_attachments_id_seq', 1, false);
SELECT pg_catalog.setval('public.events_id_seq', 2, true);
SELECT pg_catalog.setval('public.exam_grade_id_seq', 6, true);
SELECT pg_catalog.setval('public.exam_results_id_seq', 1, false);
SELECT pg_catalog.setval('public.exam_subjects_id_seq', 1, false);
SELECT pg_catalog.setval('public.exams_id_seq', 1, false);
SELECT pg_catalog.setval('public.fee_collections_id_seq', 7, true);
SELECT pg_catalog.setval('public.fee_structures_id_seq', 3, true);
SELECT pg_catalog.setval('public.fees_assign_details_id_seq', 1, false);
SELECT pg_catalog.setval('public.fees_assign_id_seq', 1, false);
SELECT pg_catalog.setval('public.fees_collect_details_id_seq', 1, false);
SELECT pg_catalog.setval('public.fees_collect_id_seq', 1, false);
SELECT pg_catalog.setval('public.fees_groups_id_seq', 1, false);
SELECT pg_catalog.setval('public.fees_master_id_seq', 1, false);
SELECT pg_catalog.setval('public.fees_types_id_seq', 1, false);
SELECT pg_catalog.setval('public.files_id_seq', 4, true);
SELECT pg_catalog.setval('public.guardians_id_seq', 12, true);
SELECT pg_catalog.setval('public.holidays_id_seq', 3, true);
SELECT pg_catalog.setval('public.hostel_rooms_id_seq', 15, true);
SELECT pg_catalog.setval('public.hostels_id_seq', 9, true);
SELECT pg_catalog.setval('public.houses_id_seq', 4, true);
SELECT pg_catalog.setval('public.languages_id_seq', 2, true);
SELECT pg_catalog.setval('public.leave_applications_id_seq', 4, true);
SELECT pg_catalog.setval('public.leave_types_id_seq', 5, true);
SELECT pg_catalog.setval('public.leaving_students_id_seq', 1, false);
SELECT pg_catalog.setval('public.library_book_issues_id_seq', 6, true);
SELECT pg_catalog.setval('public.library_books_id_seq', 3, true);
SELECT pg_catalog.setval('public.library_categories_id_seq', 8, true);
SELECT pg_catalog.setval('public.library_members_id_seq', 1, false);
SELECT pg_catalog.setval('public.medical_conditions_id_seq', 1, false);
SELECT pg_catalog.setval('public.mother_tongues_id_seq', 4, true);
SELECT pg_catalog.setval('public.notes_id_seq', 3, true);
SELECT pg_catalog.setval('public.notice_board_id_seq', 10, true);
SELECT pg_catalog.setval('public.parent_persons_id_seq', 540, true);
SELECT pg_catalog.setval('public.parents_id_seq', 10, true);
SELECT pg_catalog.setval('public.pickup_points_id_seq', 3, true);
SELECT pg_catalog.setval('public.religions_id_seq', 3, true);
SELECT pg_catalog.setval('public.reports_id_seq', 1, false);
SELECT pg_catalog.setval('public.room_types_id_seq', 3, true);
SELECT pg_catalog.setval('public.route_stops_id_seq', 1, false);
SELECT pg_catalog.setval('public.routes_id_seq', 3, true);
SELECT pg_catalog.setval('public.school_profile_id_seq', 1, false);
SELECT pg_catalog.setval('public.sections_id_seq', 46, true);
SELECT pg_catalog.setval('public.settings_id_seq', 1, false);
SELECT pg_catalog.setval('public.staff_attendance_id_seq', 1, false);
SELECT pg_catalog.setval('public.staff_id_seq', 58, true);
SELECT pg_catalog.setval('public.student_medical_conditions_id_seq', 6, true);
SELECT pg_catalog.setval('public.student_promotions_id_seq', 8, true);
SELECT pg_catalog.setval('public.student_rejoins_id_seq', 1, false);
SELECT pg_catalog.setval('public.student_siblings_id_seq', 2, true);
SELECT pg_catalog.setval('public.students_id_seq', 207, true);
SELECT pg_catalog.setval('public.subjects_id_seq', 76, true);
SELECT pg_catalog.setval('public.teacher_assignments_id_seq', 1, false);
SELECT pg_catalog.setval('public.teacher_routines_id_seq', 3, true);
SELECT pg_catalog.setval('public.teachers_id_seq', 9, true);
SELECT pg_catalog.setval('public.time_slots_id_seq', 8, true);
SELECT pg_catalog.setval('public.todos_id_seq', 3, true);
SELECT pg_catalog.setval('public.transport_allocations_id_seq', 1, false);
SELECT pg_catalog.setval('public.transport_assignments_id_seq', 3, true);
SELECT pg_catalog.setval('public.transport_fee_master_id_seq', 1, false);
SELECT pg_catalog.setval('public.user_roles_id_seq', 10, true);
SELECT pg_catalog.setval('public.users_id_seq', 256, true);
SELECT pg_catalog.setval('public.vehicles_id_seq', 3, true);

SET session_replication_role = 'origin';
