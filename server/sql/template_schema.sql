-- ##############################################################################

-- ##############################################################################
-- TENANT TABLES — use npm run db:init or psql (NOT pgAdmin): COPY stdin below.
-- Connect to a school/tenant database (or school_template on Neon).
-- ##############################################################################

-- Dumped from database version 17.8 (6108b59)
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-16 14:18:13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4485 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS '';


--
-- TOC entry 337 (class 1255 OID 214513)
-- Name: get_academic_year_by_id(integer); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.get_academic_year_by_id(p_id integer) RETURNS TABLE(id integer, name character varying, start_date date, end_date date, is_active boolean, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              ay.id,
              ay.year_name as name,
              ay.start_date,
              ay.end_date,
              ay.is_active,
              ay.created_at
          FROM academic_years ay
          WHERE ay.id = p_id AND ay.is_active = true;
      END;
      $$;



--
-- TOC entry 338 (class 1255 OID 214514)
-- Name: get_academic_years(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.get_academic_years() RETURNS TABLE(id integer, name character varying, start_date date, end_date date, is_active boolean, created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
      BEGIN
          RETURN QUERY
          SELECT 
              ay.id,
              ay.year_name as name,
              ay.start_date,
              ay.end_date,
              ay.is_active,
              ay.created_at
          FROM academic_years ay
          WHERE ay.is_active = true 
          ORDER BY ay.start_date DESC;
      END;
      $$;



--
-- TOC entry 339 (class 1255 OID 214515)
-- Name: update_class_students_count(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_class_students_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE classes
    SET no_of_students = (
        SELECT COALESCE(SUM(no_of_students), 0)
        FROM sections
        WHERE class_id = NEW.class_id
    )
    WHERE id = NEW.class_id;
    RETURN NEW;
END;
$$;


--
-- TOC entry 340 (class 1255 OID 214516)
-- Name: update_notice_board_modified_at(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_notice_board_modified_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.modified_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;



--
-- TOC entry 341 (class 1255 OID 214517)
-- Name: update_parents_updated_at(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_parents_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;



--
-- TOC entry 342 (class 1255 OID 214518)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: neondb_owner
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 214519)
-- Name: academic_years; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.academic_years (
    id integer NOT NULL,
    year_name character varying(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 218 (class 1259 OID 214526)
-- Name: academic_years_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.academic_years_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4487 (class 0 OID 0)
-- Dependencies: 218
-- Name: academic_years_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.academic_years_id_seq OWNED BY public.academic_years.id;


--
-- TOC entry 219 (class 1259 OID 214527)
-- Name: addresses; Type: TABLE; Schema: public; Owner: neondb_owner
-- ====

CREATE TABLE public.addresses (
    id integer NOT NULL,
    current_address text NOT NULL,
    permanent_address text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    person_id integer
);



--
-- TOC entry 220 (class 1259 OID 214533)
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ============
-- TOC entry 4488 (class 0 OID 0)
-- Dependencies: 220
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- TOC entry 221 (class 1259 OID 214534)
-- Name: attendance; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.attendance (
    id integer NOT NULL,
    student_id integer,
    class_id integer,
    section_id integer,
    attendance_date date NOT NULL,
    status character varying(10) NOT NULL,
    check_in_time time without time zone,
    check_out_time time without time zone,
    marked_by integer,
    remarks text,
    academic_year_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT attendance_status_check CHECK (((status)::text = ANY (ARRAY[('present'::character varying)::text, ('absent'::character varying)::text, ('late'::character varying)::text, ('half_day'::character varying)::text])))
);



--
-- TOC entry 222 (class 1259 OID 214542)
-- Name: attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4489 (class 0 OID 0)
-- Dependencies: 222
-- Name: attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;


--
-- TOC entry 223 (class 1259 OID 214543)
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.blocked_users (
    id integer NOT NULL,
    user_id integer NOT NULL,
    blocked_user_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 224 (class 1259 OID 214547)
-- Name: blocked_users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.blocked_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4490 (class 0 OID 0)
-- Dependencies: 224
-- Name: blocked_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.blocked_users_id_seq OWNED BY public.blocked_users.id;


--
-- TOC entry 225 (class 1259 OID 214548)
-- Name: blood_groups; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.blood_groups (
    id integer NOT NULL,
    blood_group character varying(10) NOT NULL,
    description character varying(100),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 226 (class 1259 OID 214554)
-- Name: blood_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.blood_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4491 (class 0 OID 0)
-- Dependencies: 226
-- Name: blood_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.blood_groups_id_seq OWNED BY public.blood_groups.id;


--
-- TOC entry 227 (class 1259 OID 214555)
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.calendar_events (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    event_color character varying(20) DEFAULT 'bg-primary'::character varying,
    is_all_day boolean DEFAULT false,
    location character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 228 (class 1259 OID 214564)
-- Name: calendar_events_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.calendar_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4492 (class 0 OID 0)
-- Dependencies: 228
-- Name: calendar_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.calendar_events_id_seq OWNED BY public.calendar_events.id;


--
-- TOC entry 229 (class 1259 OID 214565)
-- Name: calls; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.calls (
    id integer NOT NULL,
    user_id integer NOT NULL,
    recipient_id integer,
    call_type character varying(20) NOT NULL,
    phone_number character varying(20),
    duration integer DEFAULT 0,
    call_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 230 (class 1259 OID 214571)
-- Name: calls_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.calls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4493 (class 0 OID 0)
-- Dependencies: 230
-- Name: calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.calls_id_seq OWNED BY public.calls.id;


--
-- TOC entry 231 (class 1259 OID 214572)
-- Name: casts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.casts (
    id integer NOT NULL,
    cast_name character varying(50) NOT NULL,
    religion_id integer,
    description character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 232 (class 1259 OID 214578)
-- Name: casts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.casts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4494 (class 0 OID 0)
-- Dependencies: 232
-- Name: casts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.casts_id_seq OWNED BY public.casts.id;


--
-- TOC entry 233 (class 1259 OID 214579)
-- Name: chat_settings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.chat_settings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    recipient_id integer NOT NULL,
    is_muted boolean DEFAULT false,
    muted_until timestamp without time zone,
    cleared_at timestamp without time zone,
    disappearing_seconds integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 234 (class 1259 OID 214585)
-- Name: chat_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.chat_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4495 (class 0 OID 0)
-- Dependencies: 234
-- Name: chat_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.chat_settings_id_seq OWNED BY public.chat_settings.id;


--
-- TOC entry 235 (class 1259 OID 214586)
-- Name: chats; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.chats (
    id integer NOT NULL,
    user_id integer NOT NULL,
    recipient_id integer,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    message_type character varying(20) DEFAULT 'text'::character varying,
    file_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 236 (class 1259 OID 214596)
-- Name: chats_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.chats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4496 (class 0 OID 0)
-- Dependencies: 236
-- Name: chats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.chats_id_seq OWNED BY public.chats.id;


--
-- TOC entry 237 (class 1259 OID 214597)
-- Name: class_rooms; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.class_rooms (
    id integer NOT NULL,
    room_no character varying(50) NOT NULL,
    capacity integer DEFAULT 50 NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying,
    description text,
    floor character varying(50),
    building character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 238 (class 1259 OID 214606)
-- Name: class_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.class_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4497 (class 0 OID 0)
-- Dependencies: 238
-- Name: class_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.class_rooms_id_seq OWNED BY public.class_rooms.id;


--
-- TOC entry 239 (class 1259 OID 214607)
-- Name: class_schedules; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.class_schedules (
    id integer NOT NULL,
    class_id integer,
    section_id integer,
    subject_id integer,
    time_slot_id integer,
    day_of_week integer,
    academic_year_id integer,
    room_number character varying(20),
    teacher_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT class_schedules_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7)))
);



--
-- TOC entry 240 (class 1259 OID 214614)
-- Name: class_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.class_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4498 (class 0 OID 0)
-- Dependencies: 240
-- Name: class_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.class_schedules_id_seq OWNED BY public.class_schedules.id;


--
-- TOC entry 241 (class 1259 OID 214615)
-- Name: class_syllabus; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.class_syllabus (
    id integer NOT NULL,
    class_id integer,
    section_id integer,
    class_name character varying(100),
    section_name character varying(100),
    subject_group character varying(500) NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying,
    description text,
    academic_year_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 242 (class 1259 OID 214623)
-- Name: class_syllabus_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.class_syllabus_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4499 (class 0 OID 0)
-- Dependencies: 242
-- Name: class_syllabus_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.class_syllabus_id_seq OWNED BY public.class_syllabus.id;


--
-- TOC entry 243 (class 1259 OID 214624)
-- Name: classes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    class_name character varying(50) NOT NULL,
    class_code character varying(10),
    academic_year_id integer,
    class_teacher_id integer,
    max_students integer DEFAULT 30,
    class_fee numeric(10,2),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    no_of_students integer DEFAULT 0
);



--
-- TOC entry 244 (class 1259 OID 214634)
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4500 (class 0 OID 0)
-- Dependencies: 244
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- TOC entry 245 (class 1259 OID 214635)
-- Name: departments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    department_name character varying(100) NOT NULL,
    department_code character varying(10),
    head_of_department integer,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 246 (class 1259 OID 214643)
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4501 (class 0 OID 0)
-- Dependencies: 246
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- TOC entry 247 (class 1259 OID 214644)
-- Name: designations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.designations (
    id integer NOT NULL,
    designation_name character varying(100) NOT NULL,
    department_id integer,
    salary_range_min numeric(10,2),
    salary_range_max numeric(10,2),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 248 (class 1259 OID 214652)
-- Name: designations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.designations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4502 (class 0 OID 0)
-- Dependencies: 248
-- Name: designations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.designations_id_seq OWNED BY public.designations.id;


--
-- TOC entry 249 (class 1259 OID 214653)
-- Name: document_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.document_types (
    id integer NOT NULL,
    document_type character varying(50) NOT NULL,
    description character varying(200),
    is_mandatory boolean DEFAULT false,
    applicable_for character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT document_types_applicable_for_check CHECK (((applicable_for)::text = ANY (ARRAY[('student'::character varying)::text, ('staff'::character varying)::text, ('both'::character varying)::text])))
);



--
-- TOC entry 250 (class 1259 OID 214661)
-- Name: document_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.document_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4503 (class 0 OID 0)
-- Dependencies: 250
-- Name: document_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.document_types_id_seq OWNED BY public.document_types.id;


--
-- TOC entry 251 (class 1259 OID 214662)
-- Name: documents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    document_type_id integer,
    student_id integer,
    staff_id integer,
    document_name character varying(200) NOT NULL,
    file_path character varying(500),
    file_size integer,
    upload_date date DEFAULT CURRENT_DATE,
    expiry_date date,
    is_verified boolean DEFAULT false,
    verified_by integer,
    verified_date date,
    remarks text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 252 (class 1259 OID 214672)
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4504 (class 0 OID 0)
-- Dependencies: 252
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- TOC entry 253 (class 1259 OID 214673)
-- Name: drivers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.drivers (
    id integer NOT NULL,
    driver_name character varying(100) NOT NULL,
    employee_code character varying(20),
    phone character varying(15) NOT NULL,
    email character varying(100),
    license_number character varying(50) NOT NULL,
    license_expiry date,
    address text,
    emergency_contact character varying(15),
    joining_date date,
    salary numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 254 (class 1259 OID 214681)
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4505 (class 0 OID 0)
-- Dependencies: 254
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- TOC entry 255 (class 1259 OID 214682)
-- Name: emails; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.emails (
    id integer NOT NULL,
    user_id integer NOT NULL,
    sender_id integer,
    sender_email character varying(255),
    recipient_email character varying(255),
    subject character varying(500) NOT NULL,
    body text NOT NULL,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    is_important boolean DEFAULT false,
    folder character varying(50) DEFAULT 'inbox'::character varying,
    has_attachment boolean DEFAULT false,
    attachment_url text,
    sent_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 256 (class 1259 OID 214695)
-- Name: emails_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.emails_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4506 (class 0 OID 0)
-- Dependencies: 256
-- Name: emails_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.emails_id_seq OWNED BY public.emails.id;


--
-- TOC entry 257 (class 1259 OID 214696)
-- Name: events; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.events (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone,
    event_color character varying(50) DEFAULT 'bg-primary'::character varying,
    is_all_day boolean DEFAULT false,
    location character varying(255),
    event_category character varying(50),
    event_for character varying(20) DEFAULT 'all'::character varying,
    target_class_ids jsonb,
    target_section_ids jsonb,
    attachment_url text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 258 (class 1259 OID 214706)
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4507 (class 0 OID 0)
-- Dependencies: 258
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- TOC entry 259 (class 1259 OID 214707)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exam_results (
    id integer NOT NULL,
    exam_id integer,
    student_id integer,
    subject_id integer,
    marks_obtained numeric(5,2),
    grade character varying(5),
    remarks text,
    is_absent boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 260 (class 1259 OID 214716)
-- Name: exam_results_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.exam_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4508 (class 0 OID 0)
-- Dependencies: 260
-- Name: exam_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.exam_results_id_seq OWNED BY public.exam_results.id;


--
-- TOC entry 261 (class 1259 OID 214717)
-- Name: exams; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.exams (
    id integer NOT NULL,
    exam_name character varying(100) NOT NULL,
    exam_type character varying(30),
    class_id integer,
    academic_year_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_marks integer DEFAULT 100,
    passing_marks integer DEFAULT 35,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY (ARRAY[('unit_test'::character varying)::text, ('monthly'::character varying)::text, ('quarterly'::character varying)::text, ('half_yearly'::character varying)::text, ('annual'::character varying)::text])))
);



--
-- TOC entry 262 (class 1259 OID 214728)
-- Name: exams_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4509 (class 0 OID 0)
-- Dependencies: 262
-- Name: exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.exams_id_seq OWNED BY public.exams.id;


--
-- TOC entry 263 (class 1259 OID 214729)
-- Name: fee_collections; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.fee_collections (
    id integer NOT NULL,
    student_id integer,
    fee_structure_id integer,
    amount_paid numeric(10,2) NOT NULL,
    payment_date date DEFAULT CURRENT_DATE,
    payment_method character varying(20),
    transaction_id character varying(100),
    receipt_number character varying(50),
    collected_by integer,
    remarks text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fee_collections_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('cash'::character varying)::text, ('upi'::character varying)::text, ('card'::character varying)::text])))
);



--
-- TOC entry 264 (class 1259 OID 214739)
-- Name: fee_collections_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.fee_collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4510 (class 0 OID 0)
-- Dependencies: 264
-- Name: fee_collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.fee_collections_id_seq OWNED BY public.fee_collections.id;


--
-- TOC entry 265 (class 1259 OID 214740)
-- Name: fee_structures; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.fee_structures (
    id integer NOT NULL,
    fee_name character varying(100) NOT NULL,
    class_id integer,
    academic_year_id integer,
    amount numeric(10,2) NOT NULL,
    due_date date,
    fee_type character varying(30),
    is_mandatory boolean DEFAULT true,
    installment_allowed boolean DEFAULT false,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fee_structures_fee_type_check CHECK (((fee_type)::text = ANY (ARRAY[('admission'::character varying)::text, ('tuition'::character varying)::text, ('transport'::character varying)::text, ('hostel'::character varying)::text, ('library'::character varying)::text, ('exam'::character varying)::text, ('other'::character varying)::text])))
);



--
-- TOC entry 266 (class 1259 OID 214751)
-- Name: fee_structures_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.fee_structures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4511 (class 0 OID 0)
-- Dependencies: 266
-- Name: fee_structures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.fee_structures_id_seq OWNED BY public.fee_structures.id;


--
-- TOC entry 267 (class 1259 OID 214752)
-- Name: files; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.files (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(255) NOT NULL,
    file_type character varying(50),
    mime_type character varying(100),
    size bigint DEFAULT 0,
    file_url text,
    parent_folder_id integer,
    is_folder boolean DEFAULT false,
    is_shared boolean DEFAULT false,
    shared_with integer[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 268 (class 1259 OID 214762)
-- Name: files_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4512 (class 0 OID 0)
-- Dependencies: 268
-- Name: files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.files_id_seq OWNED BY public.files.id;


--
-- TOC entry 269 (class 1259 OID 214763)
-- Name: guardians; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.guardians (
    id integer NOT NULL,
    student_id integer,
    guardian_type character varying(20),
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    relation character varying(30),
    occupation character varying(100),
    phone character varying(15) NOT NULL,
    email character varying(100),
    address text,
    office_address text,
    annual_income numeric(12,2),
    is_primary_contact boolean DEFAULT false,
    is_emergency_contact boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer,
    CONSTRAINT guardians_guardian_type_check CHECK (((guardian_type)::text = ANY (ARRAY[('father'::character varying)::text, ('mother'::character varying)::text, ('guardian'::character varying)::text, ('other'::character varying)::text])))
);



--
-- TOC entry 270 (class 1259 OID 214774)
-- Name: guardians_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.guardians_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4513 (class 0 OID 0)
-- Dependencies: 270
-- Name: guardians_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.guardians_id_seq OWNED BY public.guardians.id;


--
-- TOC entry 271 (class 1259 OID 214775)
-- Name: holidays; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.holidays (
    id integer NOT NULL,
    holiday_name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    holiday_type character varying(20),
    description text,
    academic_year_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT holidays_holiday_type_check CHECK (((holiday_type)::text = ANY (ARRAY[('national'::character varying)::text, ('religious'::character varying)::text, ('academic'::character varying)::text, ('optional'::character varying)::text])))
);



--
-- TOC entry 272 (class 1259 OID 214784)
-- Name: holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4514 (class 0 OID 0)
-- Dependencies: 272
-- Name: holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.holidays_id_seq OWNED BY public.holidays.id;


--
-- TOC entry 273 (class 1259 OID 214785)
-- Name: hostel_rooms; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.hostel_rooms (
    id integer NOT NULL,
    room_number character varying(20) NOT NULL,
    hostel_id integer,
    room_type_id integer,
    floor_number integer,
    max_occupancy integer,
    current_occupancy integer DEFAULT 0,
    monthly_fee numeric(10,2),
    facilities text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 274 (class 1259 OID 214794)
-- Name: hostel_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.hostel_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4515 (class 0 OID 0)
-- Dependencies: 274
-- Name: hostel_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.hostel_rooms_id_seq OWNED BY public.hostel_rooms.id;


--
-- TOC entry 275 (class 1259 OID 214795)
-- Name: hostels; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.hostels (
    id integer NOT NULL,
    hostel_name character varying(100) NOT NULL,
    hostel_type character varying(20),
    warden_id integer,
    total_rooms integer,
    address text,
    contact_number character varying(15),
    facilities text,
    rules text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT hostels_hostel_type_check CHECK (((hostel_type)::text = ANY (ARRAY[('boys'::character varying)::text, ('girls'::character varying)::text, ('mixed'::character varying)::text])))
);



--
-- TOC entry 276 (class 1259 OID 214804)
-- Name: hostels_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.hostels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4516 (class 0 OID 0)
-- Dependencies: 276
-- Name: hostels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.hostels_id_seq OWNED BY public.hostels.id;


--
-- TOC entry 277 (class 1259 OID 214805)
-- Name: houses; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.houses (
    id integer NOT NULL,
    house_name character varying(50) NOT NULL,
    house_color character varying(20),
    house_captain character varying(100),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 278 (class 1259 OID 214813)
-- Name: houses_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.houses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4517 (class 0 OID 0)
-- Dependencies: 278
-- Name: houses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.houses_id_seq OWNED BY public.houses.id;


--
-- TOC entry 279 (class 1259 OID 214814)
-- Name: languages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.languages (
    id integer NOT NULL,
    language_name character varying(50) NOT NULL,
    language_code character varying(10),
    is_compulsory boolean DEFAULT false,
    description character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 280 (class 1259 OID 214821)
-- Name: languages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.languages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4518 (class 0 OID 0)
-- Dependencies: 280
-- Name: languages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.languages_id_seq OWNED BY public.languages.id;


--
-- TOC entry 281 (class 1259 OID 214822)
-- Name: leave_applications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.leave_applications (
    id integer NOT NULL,
    applicant_type character varying(10),
    student_id integer,
    staff_id integer,
    leave_type_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_days integer,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by integer,
    approved_date date,
    rejection_reason text,
    medical_certificate_path character varying(500),
    emergency_contact character varying(15),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leave_applications_applicant_type_check CHECK (((applicant_type)::text = ANY (ARRAY[('student'::character varying)::text, ('staff'::character varying)::text]))),
    CONSTRAINT leave_applications_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('cancelled'::character varying)::text])))
);



--
-- TOC entry 282 (class 1259 OID 214833)
-- Name: leave_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.leave_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4519 (class 0 OID 0)
-- Dependencies: 282
-- Name: leave_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.leave_applications_id_seq OWNED BY public.leave_applications.id;


--
-- TOC entry 283 (class 1259 OID 214834)
-- Name: leave_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.leave_types (
    id integer NOT NULL,
    leave_type character varying(50) NOT NULL,
    max_days integer,
    description text,
    applicable_for character varying(20),
    requires_medical_certificate boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leave_types_applicable_for_check CHECK (((applicable_for)::text = ANY (ARRAY[('student'::character varying)::text, ('staff'::character varying)::text, ('both'::character varying)::text])))
);



--
-- TOC entry 284 (class 1259 OID 214844)
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4520 (class 0 OID 0)
-- Dependencies: 284
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- TOC entry 285 (class 1259 OID 214845)
-- Name: library_book_issues; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.library_book_issues (
    id integer NOT NULL,
    book_id integer,
    student_id integer,
    staff_id integer,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date NOT NULL,
    return_date date,
    fine_amount numeric(8,2) DEFAULT 0,
    status character varying(20) DEFAULT 'issued'::character varying,
    issued_by integer,
    returned_to integer,
    remarks text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT library_book_issues_status_check CHECK (((status)::text = ANY (ARRAY[('issued'::character varying)::text, ('returned'::character varying)::text, ('lost'::character varying)::text, ('damaged'::character varying)::text])))
);



--
-- TOC entry 286 (class 1259 OID 214857)
-- Name: library_book_issues_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.library_book_issues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4521 (class 0 OID 0)
-- Dependencies: 286
-- Name: library_book_issues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.library_book_issues_id_seq OWNED BY public.library_book_issues.id;


--
-- TOC entry 287 (class 1259 OID 214858)
-- Name: library_books; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.library_books (
    id integer NOT NULL,
    book_title character varying(200) NOT NULL,
    author character varying(200),
    isbn character varying(20),
    publisher character varying(100),
    publication_year integer,
    category_id integer,
    total_copies integer DEFAULT 1,
    available_copies integer DEFAULT 1,
    book_price numeric(10,2),
    book_location character varying(50),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 288 (class 1259 OID 214868)
-- Name: library_books_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.library_books_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4522 (class 0 OID 0)
-- Dependencies: 288
-- Name: library_books_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.library_books_id_seq OWNED BY public.library_books.id;


--
-- TOC entry 289 (class 1259 OID 214869)
-- Name: library_categories; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.library_categories (
    id integer NOT NULL,
    category_name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 290 (class 1259 OID 214877)
-- Name: library_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.library_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4523 (class 0 OID 0)
-- Dependencies: 290
-- Name: library_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.library_categories_id_seq OWNED BY public.library_categories.id;


--
-- TOC entry 291 (class 1259 OID 214878)
-- Name: medical_conditions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.medical_conditions (
    id integer NOT NULL,
    condition_name character varying(100) NOT NULL,
    description text,
    severity_level character varying(20),
    requires_medication boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medical_conditions_severity_level_check CHECK (((severity_level)::text = ANY (ARRAY[('low'::character varying)::text, ('medium'::character varying)::text, ('high'::character varying)::text, ('critical'::character varying)::text])))
);



--
-- TOC entry 292 (class 1259 OID 214888)
-- Name: medical_conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.medical_conditions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4524 (class 0 OID 0)
-- Dependencies: 292
-- Name: medical_conditions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.medical_conditions_id_seq OWNED BY public.medical_conditions.id;


--
-- TOC entry 293 (class 1259 OID 214889)
-- Name: mother_tongues; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.mother_tongues (
    id integer NOT NULL,
    language_name character varying(50) NOT NULL,
    language_code character varying(10),
    description character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 294 (class 1259 OID 214895)
-- Name: mother_tongues_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.mother_tongues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4525 (class 0 OID 0)
-- Dependencies: 294
-- Name: mother_tongues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.mother_tongues_id_seq OWNED BY public.mother_tongues.id;


--
-- TOC entry 295 (class 1259 OID 214896)
-- Name: notes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    tag character varying(50),
    priority character varying(20) DEFAULT 'medium'::character varying,
    is_important boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 296 (class 1259 OID 214906)
-- Name: notes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4526 (class 0 OID 0)
-- Dependencies: 296
-- Name: notes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notes_id_seq OWNED BY public.notes.id;


--
-- TOC entry 297 (class 1259 OID 214907)
-- Name: notice_board; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notice_board (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    message_to character varying(100) DEFAULT 'All'::character varying
);



--
-- TOC entry 298 (class 1259 OID 214915)
-- Name: notice_board_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notice_board_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4527 (class 0 OID 0)
-- Dependencies: 298
-- Name: notice_board_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notice_board_id_seq OWNED BY public.notice_board.id;


--
-- TOC entry 299 (class 1259 OID 214916)
-- Name: parents; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.parents (
    id integer NOT NULL,
    student_id integer NOT NULL,
    father_name character varying(100),
    father_email character varying(255),
    father_phone character varying(20),
    father_occupation character varying(100),
    father_image_url character varying(500),
    mother_name character varying(100),
    mother_email character varying(255),
    mother_phone character varying(20),
    mother_occupation character varying(100),
    mother_image_url character varying(500),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer
);



--
-- TOC entry 300 (class 1259 OID 214923)
-- Name: parents_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.parents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4528 (class 0 OID 0)
-- Dependencies: 300
-- Name: parents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.parents_id_seq OWNED BY public.parents.id;


--
-- TOC entry 301 (class 1259 OID 214924)
-- Name: pickup_points; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pickup_points (
    id integer NOT NULL,
    point_name character varying(100) NOT NULL,
    route_id integer,
    address text,
    landmark character varying(200),
    pickup_time time without time zone,
    drop_time time without time zone,
    distance_from_school numeric(8,2),
    sequence_order integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 302 (class 1259 OID 214932)
-- Name: pickup_points_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pickup_points_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4529 (class 0 OID 0)
-- Dependencies: 302
-- Name: pickup_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pickup_points_id_seq OWNED BY public.pickup_points.id;


--
-- TOC entry 303 (class 1259 OID 214933)
-- Name: religions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.religions (
    id integer NOT NULL,
    religion_name character varying(50) NOT NULL,
    description character varying(200),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 304 (class 1259 OID 214939)
-- Name: religions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.religions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4530 (class 0 OID 0)
-- Dependencies: 304
-- Name: religions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.religions_id_seq OWNED BY public.religions.id;


--
-- TOC entry 305 (class 1259 OID 214940)
-- Name: reports; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.reports (
    id integer NOT NULL,
    user_id integer NOT NULL,
    reported_user_id integer NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 306 (class 1259 OID 214946)
-- Name: reports_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4531 (class 0 OID 0)
-- Dependencies: 306
-- Name: reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.reports_id_seq OWNED BY public.reports.id;


--
-- TOC entry 307 (class 1259 OID 214947)
-- Name: room_types; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.room_types (
    id integer NOT NULL,
    room_type character varying(50) NOT NULL,
    description text,
    max_occupancy integer,
    room_fee numeric(10,2),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 308 (class 1259 OID 214955)
-- Name: room_types_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.room_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4532 (class 0 OID 0)
-- Dependencies: 308
-- Name: room_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.room_types_id_seq OWNED BY public.room_types.id;


--
-- TOC entry 309 (class 1259 OID 214956)
-- Name: routes; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.routes (
    id integer NOT NULL,
    route_name character varying(100) NOT NULL,
    route_code character varying(10),
    start_point character varying(200),
    end_point character varying(200),
    total_distance numeric(8,2),
    estimated_time integer,
    route_fee numeric(10,2),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 310 (class 1259 OID 214964)
-- Name: routes_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.routes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4533 (class 0 OID 0)
-- Dependencies: 310
-- Name: routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.routes_id_seq OWNED BY public.routes.id;


--
-- TOC entry 311 (class 1259 OID 214965)
-- Name: sections; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sections (
    id integer NOT NULL,
    section_name character varying(10) NOT NULL,
    class_id integer,
    section_teacher_id integer,
    max_students integer DEFAULT 30,
    room_number character varying(20),
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    no_of_students integer DEFAULT 0
);



--
-- TOC entry 312 (class 1259 OID 214975)
-- Name: sections_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4534 (class 0 OID 0)
-- Dependencies: 312
-- Name: sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sections_id_seq OWNED BY public.sections.id;


--
-- TOC entry 313 (class 1259 OID 214976)
-- Name: staff; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.staff (
    id integer NOT NULL,
    user_id integer,
    employee_code character varying(20) NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    gender character varying(10),
    date_of_birth date,
    blood_group_id integer,
    phone character varying(15),
    email character varying(100),
    address text,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(15),
    designation_id integer,
    department_id integer,
    joining_date date,
    salary numeric(12,2),
    qualification text,
    experience_years integer,
    photo_url character varying(500),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT staff_gender_check CHECK (((gender)::text = ANY (ARRAY[('male'::character varying)::text, ('female'::character varying)::text, ('other'::character varying)::text])))
);



--
-- TOC entry 314 (class 1259 OID 214985)
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4535 (class 0 OID 0)
-- Dependencies: 314
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- TOC entry 315 (class 1259 OID 214986)
-- Name: student_medical_conditions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.student_medical_conditions (
    id integer NOT NULL,
    student_id integer,
    medical_condition_id integer,
    diagnosed_date date,
    medication text,
    special_instructions text,
    doctor_name character varying(100),
    doctor_contact character varying(15),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 316 (class 1259 OID 214994)
-- Name: student_medical_conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.student_medical_conditions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4536 (class 0 OID 0)
-- Dependencies: 316
-- Name: student_medical_conditions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.student_medical_conditions_id_seq OWNED BY public.student_medical_conditions.id;


--
-- TOC entry 317 (class 1259 OID 214995)
-- Name: student_promotions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.student_promotions (
    id integer NOT NULL,
    student_id integer,
    from_class_id integer,
    to_class_id integer,
    from_section_id integer,
    to_section_id integer,
    from_academic_year_id integer,
    to_academic_year_id integer,
    promotion_date date DEFAULT CURRENT_DATE,
    status character varying(20) DEFAULT 'promoted'::character varying,
    remarks text,
    promoted_by integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT student_promotions_status_check CHECK (((status)::text = ANY (ARRAY[('promoted'::character varying)::text, ('detained'::character varying)::text, ('transferred'::character varying)::text])))
);



--
-- TOC entry 318 (class 1259 OID 215006)
-- Name: student_promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.student_promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4537 (class 0 OID 0)
-- Dependencies: 318
-- Name: student_promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.student_promotions_id_seq OWNED BY public.student_promotions.id;


--
-- TOC entry 319 (class 1259 OID 215007)
-- Name: students; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.students (
    id integer NOT NULL,
    user_id integer,
    admission_number character varying(20) NOT NULL,
    roll_number character varying(20),
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    gender character varying(10),
    date_of_birth date,
    place_of_birth character varying(100),
    blood_group_id integer,
    religion_id integer,
    cast_id integer,
    mother_tongue_id integer,
    nationality character varying(50) DEFAULT 'Indian'::character varying,
    phone character varying(15),
    email character varying(100),
    address text,
    academic_year_id integer,
    class_id integer,
    section_id integer,
    house_id integer,
    admission_date date,
    previous_school character varying(200),
    photo_url character varying(500),
    is_transport_required boolean DEFAULT false,
    route_id integer,
    pickup_point_id integer,
    is_hostel_required boolean DEFAULT false,
    hostel_room_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    parent_id integer,
    guardian_id integer,
    address_id integer,
    bank_name character varying(100),
    branch character varying(100),
    ifsc character varying(20),
    known_allergies text,
    medications text,
    hostel_id integer,
    sibiling_1 text,
    sibiling_2 text,
    sibiling_1_class text,
    sibiling_2_class text,
    previous_school_address text,
    medical_condition text,
    other_information text,
    vehicle_number text,
    current_address text,
    permanent_address text,
    unique_student_ids character varying(50) NOT NULL,
    pen_number character varying(20) NOT NULL,
    aadhar_no character varying(12) NOT NULL,
    gr_number character varying(30) NOT NULL,

    CONSTRAINT students_gender_check CHECK (((gender)::text = ANY (ARRAY[('male'::character varying)::text, ('female'::character varying)::text, ('other'::character varying)::text])))
);



--
-- TOC entry 4538 (class 0 OID 0)
-- Dependencies: 319
-- Name: COLUMN students.parent_id; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.students.parent_id IS 'Foreign key reference to parents table';


--
-- TOC entry 4539 (class 0 OID 0)
-- Dependencies: 319
-- Name: COLUMN students.guardian_id; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.students.guardian_id IS 'Foreign key reference to guardians table';


--
-- TOC entry 320 (class 1259 OID 215019)
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4540 (class 0 OID 0)
-- Dependencies: 320
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- TOC entry 321 (class 1259 OID 215020)
-- Name: subjects; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    subject_name character varying(100) NOT NULL,
    subject_code character varying(10),
    class_id integer,
    teacher_id integer,
    theory_hours integer DEFAULT 0,
    practical_hours integer DEFAULT 0,
    total_marks integer DEFAULT 100,
    passing_marks integer DEFAULT 35,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 322 (class 1259 OID 215032)
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4541 (class 0 OID 0)
-- Dependencies: 322
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- TOC entry 323 (class 1259 OID 215033)
-- Name: teacher_routines; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.teacher_routines (
    id integer NOT NULL,
    teacher_id integer,
    class_schedule_id integer,
    academic_year_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 324 (class 1259 OID 215039)
-- Name: teacher_routines_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.teacher_routines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4542 (class 0 OID 0)
-- Dependencies: 324
-- Name: teacher_routines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.teacher_routines_id_seq OWNED BY public.teacher_routines.id;


--
-- TOC entry 325 (class 1259 OID 215040)
-- Name: teachers; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.teachers (
    id integer NOT NULL,
    class_id integer,
    subject_id integer,
    father_name character varying(100),
    mother_name character varying(100),
    marital_status character varying(20),
    languages_known text[],
    previous_school_name character varying(200),
    previous_school_address text,
    previous_school_phone character varying(15),
    current_address text,
    permanent_address text,
    pan_number character varying(10),
    id_number character varying(50),
    status character varying(20) DEFAULT 'Active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    staff_id bigint,
    bank_name text,
    branch text,
    ifsc text,
    contract_type text,
    shift text,
    work_location text,
    facebook text,
    twitter text,
    linkedin text,
    youtube text,
    instagram text,
    blood_group text DEFAULT 'UNKNOWN'::text NOT NULL,
    CONSTRAINT teachers_marital_status_check CHECK (((marital_status)::text = ANY (ARRAY[('Single'::character varying)::text, ('Married'::character varying)::text, ('Divorced'::character varying)::text, ('Widowed'::character varying)::text]))),
    CONSTRAINT teachers_status_check CHECK (((status)::text = ANY (ARRAY[('Active'::character varying)::text, ('Inactive'::character varying)::text, ('On Leave'::character varying)::text, ('Terminated'::character varying)::text])))
);



--
-- TOC entry 326 (class 1259 OID 215051)
-- Name: teachers_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.teachers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4543 (class 0 OID 0)
-- Dependencies: 326
-- Name: teachers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.teachers_id_seq OWNED BY public.teachers.id;


--
-- TOC entry 327 (class 1259 OID 215052)
-- Name: time_slots; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.time_slots (
    id integer NOT NULL,
    slot_name character varying(50) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration integer,
    is_break boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 328 (class 1259 OID 215059)
-- Name: time_slots_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.time_slots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4544 (class 0 OID 0)
-- Dependencies: 328
-- Name: time_slots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.time_slots_id_seq OWNED BY public.time_slots.id;


--
-- TOC entry 329 (class 1259 OID 215060)
-- Name: todos; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.todos (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    due_date timestamp without time zone,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    tag character varying(50),
    is_important boolean DEFAULT false,
    assigned_to integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 330 (class 1259 OID 215070)
-- Name: todos_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.todos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4545 (class 0 OID 0)
-- Dependencies: 330
-- Name: todos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.todos_id_seq OWNED BY public.todos.id;


--
-- TOC entry 331 (class 1259 OID 215071)
-- Name: user_roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    role_name character varying(50) NOT NULL,
    description text,
    permissions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- TOC entry 332 (class 1259 OID 215079)
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4546 (class 0 OID 0)
-- Dependencies: 332
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- TOC entry 333 (class 1259 OID 215080)
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100),
    password_hash character varying(255) NOT NULL,
    role_id integer,
    first_name character varying(50),
    last_name character varying(50),
    phone character varying(15),
    last_login timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    current_address text DEFAULT 'Not Provided'::text NOT NULL,
    permanent_address text DEFAULT 'Not Provided'::text NOT NULL,
    avatar text DEFAULT ''::text NOT NULL
);



--
-- TOC entry 334 (class 1259 OID 215091)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4547 (class 0 OID 0)
-- Dependencies: 334
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 335 (class 1259 OID 215092)
-- Name: vehicles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    vehicle_number character varying(20) NOT NULL,
    vehicle_type character varying(20),
    brand character varying(50),
    model character varying(50),
    seating_capacity integer,
    driver_id integer,
    route_id integer,
    insurance_expiry date,
    fitness_certificate_expiry date,
    permit_expiry date,
    fuel_type character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by integer,
    modified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    made_of_year integer,
    registration_number text,
    chassis_number text,
    gps_device_id text,
    CONSTRAINT vehicles_fuel_type_check CHECK (((fuel_type)::text = ANY (ARRAY[('petrol'::character varying)::text, ('diesel'::character varying)::text, ('cng'::character varying)::text, ('electric'::character varying)::text]))),
    CONSTRAINT vehicles_vehicle_type_check CHECK (((vehicle_type)::text = ANY (ARRAY[('bus'::character varying)::text, ('van'::character varying)::text, ('car'::character varying)::text])))
);



--
-- TOC entry 336 (class 1259 OID 215102)
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- TOC entry 4548 (class 0 OID 0)
-- Dependencies: 336
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- TOC entry 3511 (class 2604 OID 215103)
-- Name: academic_years id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.academic_years ALTER COLUMN id SET DEFAULT nextval('public.academic_years_id_seq'::regclass);


--
-- TOC entry 3516 (class 2604 OID 215104)
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- TOC entry 3518 (class 2604 OID 215105)
-- Name: attendance id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);


--
-- TOC entry 3521 (class 2604 OID 215106)
-- Name: blocked_users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blocked_users ALTER COLUMN id SET DEFAULT nextval('public.blocked_users_id_seq'::regclass);


--
-- TOC entry 3523 (class 2604 OID 215107)
-- Name: blood_groups id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blood_groups ALTER COLUMN id SET DEFAULT nextval('public.blood_groups_id_seq'::regclass);


--
-- TOC entry 3527 (class 2604 OID 215108)
-- Name: calendar_events id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calendar_events ALTER COLUMN id SET DEFAULT nextval('public.calendar_events_id_seq'::regclass);


--
-- TOC entry 3532 (class 2604 OID 215110)
-- Name: calls id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calls ALTER COLUMN id SET DEFAULT nextval('public.calls_id_seq'::regclass);


--
-- TOC entry 3536 (class 2604 OID 215111)
-- Name: casts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casts ALTER COLUMN id SET DEFAULT nextval('public.casts_id_seq'::regclass);


--
-- TOC entry 3540 (class 2604 OID 215112)
-- Name: chat_settings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_settings ALTER COLUMN id SET DEFAULT nextval('public.chat_settings_id_seq'::regclass);


--
-- TOC entry 3544 (class 2604 OID 215113)
-- Name: chats id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chats ALTER COLUMN id SET DEFAULT nextval('public.chats_id_seq'::regclass);


--
-- TOC entry 3550 (class 2604 OID 215114)
-- Name: class_rooms id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_rooms ALTER COLUMN id SET DEFAULT nextval('public.class_rooms_id_seq'::regclass);


--
-- TOC entry 3555 (class 2604 OID 215115)
-- Name: class_schedules id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules ALTER COLUMN id SET DEFAULT nextval('public.class_schedules_id_seq'::regclass);


--
-- TOC entry 3559 (class 2604 OID 215116)
-- Name: class_syllabus id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_syllabus ALTER COLUMN id SET DEFAULT nextval('public.class_syllabus_id_seq'::regclass);


--
-- TOC entry 3563 (class 2604 OID 215117)
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- TOC entry 3569 (class 2604 OID 215118)
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- TOC entry 3573 (class 2604 OID 215119)
-- Name: designations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.designations ALTER COLUMN id SET DEFAULT nextval('public.designations_id_seq'::regclass);


--
-- TOC entry 3577 (class 2604 OID 215120)
-- Name: document_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_types ALTER COLUMN id SET DEFAULT nextval('public.document_types_id_seq'::regclass);


--
-- TOC entry 3582 (class 2604 OID 215121)
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- TOC entry 3588 (class 2604 OID 215122)
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- TOC entry 3592 (class 2604 OID 215123)
-- Name: emails id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emails ALTER COLUMN id SET DEFAULT nextval('public.emails_id_seq'::regclass);


--
-- TOC entry 3601 (class 2604 OID 215124)
-- Name: events id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- TOC entry 3607 (class 2604 OID 215125)
-- Name: exam_results id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN id SET DEFAULT nextval('public.exam_results_id_seq'::regclass);


--
-- TOC entry 3612 (class 2604 OID 215126)
-- Name: exams id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exams ALTER COLUMN id SET DEFAULT nextval('public.exams_id_seq'::regclass);


--
-- TOC entry 3618 (class 2604 OID 215127)
-- Name: fee_collections id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_collections ALTER COLUMN id SET DEFAULT nextval('public.fee_collections_id_seq'::regclass);


--
-- TOC entry 3623 (class 2604 OID 215128)
-- Name: fee_structures id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_structures ALTER COLUMN id SET DEFAULT nextval('public.fee_structures_id_seq'::regclass);


--
-- TOC entry 3629 (class 2604 OID 215129)
-- Name: files id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.files ALTER COLUMN id SET DEFAULT nextval('public.files_id_seq'::regclass);


--
-- TOC entry 3635 (class 2604 OID 215130)
-- Name: guardians id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.guardians ALTER COLUMN id SET DEFAULT nextval('public.guardians_id_seq'::regclass);


--
-- TOC entry 3641 (class 2604 OID 215131)
-- Name: holidays id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.holidays ALTER COLUMN id SET DEFAULT nextval('public.holidays_id_seq'::regclass);


--
-- TOC entry 3645 (class 2604 OID 215132)
-- Name: hostel_rooms id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostel_rooms ALTER COLUMN id SET DEFAULT nextval('public.hostel_rooms_id_seq'::regclass);


--
-- TOC entry 3650 (class 2604 OID 215133)
-- Name: hostels id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostels ALTER COLUMN id SET DEFAULT nextval('public.hostels_id_seq'::regclass);


--
-- TOC entry 3654 (class 2604 OID 215134)
-- Name: houses id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.houses ALTER COLUMN id SET DEFAULT nextval('public.houses_id_seq'::regclass);


--
-- TOC entry 3658 (class 2604 OID 215135)
-- Name: languages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.languages ALTER COLUMN id SET DEFAULT nextval('public.languages_id_seq'::regclass);


--
-- TOC entry 3663 (class 2604 OID 215136)
-- Name: leave_applications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_applications ALTER COLUMN id SET DEFAULT nextval('public.leave_applications_id_seq'::regclass);


--
-- TOC entry 3668 (class 2604 OID 215137)
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- TOC entry 3673 (class 2604 OID 215138)
-- Name: library_book_issues id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues ALTER COLUMN id SET DEFAULT nextval('public.library_book_issues_id_seq'::regclass);


--
-- TOC entry 3680 (class 2604 OID 215139)
-- Name: library_books id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_books ALTER COLUMN id SET DEFAULT nextval('public.library_books_id_seq'::regclass);


--
-- TOC entry 3686 (class 2604 OID 215140)
-- Name: library_categories id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_categories ALTER COLUMN id SET DEFAULT nextval('public.library_categories_id_seq'::regclass);


--
-- TOC entry 3690 (class 2604 OID 215141)
-- Name: medical_conditions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medical_conditions ALTER COLUMN id SET DEFAULT nextval('public.medical_conditions_id_seq'::regclass);


--
-- TOC entry 3695 (class 2604 OID 215142)
-- Name: mother_tongues id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mother_tongues ALTER COLUMN id SET DEFAULT nextval('public.mother_tongues_id_seq'::regclass);


--
-- TOC entry 3699 (class 2604 OID 215143)
-- Name: notes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notes ALTER COLUMN id SET DEFAULT nextval('public.notes_id_seq'::regclass);


--
-- TOC entry 3705 (class 2604 OID 215144)
-- Name: notice_board id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notice_board ALTER COLUMN id SET DEFAULT nextval('public.notice_board_id_seq'::regclass);


--
-- TOC entry 3709 (class 2604 OID 215145)
-- Name: parents id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.parents ALTER COLUMN id SET DEFAULT nextval('public.parents_id_seq'::regclass);


--
-- TOC entry 3712 (class 2604 OID 215146)
-- Name: pickup_points id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pickup_points ALTER COLUMN id SET DEFAULT nextval('public.pickup_points_id_seq'::regclass);


--
-- TOC entry 3716 (class 2604 OID 215147)
-- Name: religions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.religions ALTER COLUMN id SET DEFAULT nextval('public.religions_id_seq'::regclass);


--
-- TOC entry 3720 (class 2604 OID 215148)
-- Name: reports id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reports ALTER COLUMN id SET DEFAULT nextval('public.reports_id_seq'::regclass);


--
-- TOC entry 3722 (class 2604 OID 215149)
-- Name: room_types id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.room_types ALTER COLUMN id SET DEFAULT nextval('public.room_types_id_seq'::regclass);


--
-- TOC entry 3726 (class 2604 OID 215150)
-- Name: routes id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.routes ALTER COLUMN id SET DEFAULT nextval('public.routes_id_seq'::regclass);


--
-- TOC entry 3730 (class 2604 OID 215151)
-- Name: sections id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sections ALTER COLUMN id SET DEFAULT nextval('public.sections_id_seq'::regclass);


--
-- TOC entry 3736 (class 2604 OID 215152)
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- TOC entry 3740 (class 2604 OID 215153)
-- Name: student_medical_conditions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_medical_conditions ALTER COLUMN id SET DEFAULT nextval('public.student_medical_conditions_id_seq'::regclass);


--
-- TOC entry 3744 (class 2604 OID 215154)
-- Name: student_promotions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions ALTER COLUMN id SET DEFAULT nextval('public.student_promotions_id_seq'::regclass);


--
-- TOC entry 3750 (class 2604 OID 215155)
-- Name: students id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- TOC entry 3757 (class 2604 OID 215156)
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- TOC entry 3765 (class 2604 OID 215157)
-- Name: teacher_routines id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teacher_routines ALTER COLUMN id SET DEFAULT nextval('public.teacher_routines_id_seq'::regclass);


--
-- TOC entry 3769 (class 2604 OID 215158)
-- Name: teachers id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teachers ALTER COLUMN id SET DEFAULT nextval('public.teachers_id_seq'::regclass);


--
-- TOC entry 3774 (class 2604 OID 215159)
-- Name: time_slots id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.time_slots ALTER COLUMN id SET DEFAULT nextval('public.time_slots_id_seq'::regclass);


--
-- TOC entry 3779 (class 2604 OID 215160)
-- Name: todos id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.todos ALTER COLUMN id SET DEFAULT nextval('public.todos_id_seq'::regclass);


--
-- TOC entry 3785 (class 2604 OID 215161)
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- TOC entry 3789 (class 2604 OID 215162)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3796 (class 2604 OID 215163)
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- TOC entry 4360 (class 0 OID 214519)
-- Dependencies: 217
-- Data for Name: academic_years; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--
-- STOP: pgAdmin / GUI "Execute" — lines after COPY are DATA, not SQL. Use: npm run db:init
--



--
-- TOC entry 4362 (class 0 OID 214527)
-- Dependencies: 219
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4364 (class 0 OID 214534)
-- Dependencies: 221
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4366 (class 0 OID 214543)
-- Dependencies: 223
-- Data for Name: blocked_users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4368 (class 0 OID 214548)
-- Dependencies: 225
-- Data for Name: blood_groups; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

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


--
-- TOC entry 4370 (class 0 OID 214555)
-- Dependencies: 227
-- Data for Name: calendar_events; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4372 (class 0 OID 214565)
-- Dependencies: 229
-- Data for Name: calls; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4374 (class 0 OID 214572)
-- Dependencies: 231
-- Data for Name: casts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.casts (id, cast_name, religion_id, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	General	1	General category	t	2025-08-14 04:11:53.220564	\N	2025-08-14 04:11:53.220564
2	OBC	1	Other Backward Class	t	2025-08-14 04:11:53.220564	\N	2025-08-14 04:11:53.220564
3	SC	1	Scheduled Caste	t	2025-08-14 04:11:53.220564	\N	2025-08-14 04:11:53.220564
\.


--
-- TOC entry 4376 (class 0 OID 214579)
-- Dependencies: 233
-- Data for Name: chat_settings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4378 (class 0 OID 214586)
-- Dependencies: 235
-- Data for Name: chats; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4380 (class 0 OID 214597)
-- Dependencies: 237
-- Data for Name: class_rooms; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4382 (class 0 OID 214607)
-- Dependencies: 239
-- Data for Name: class_schedules; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4384 (class 0 OID 214615)
-- Dependencies: 241
-- Data for Name: class_syllabus; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4386 (class 0 OID 214624)
-- Dependencies: 243
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4388 (class 0 OID 214635)
-- Dependencies: 245
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.departments (id, department_name, department_code, head_of_department, description, is_active, created_at, created_by, modified_at) FROM stdin;
2	Administration	ADM	\N	Administrative department	t	2025-08-14 04:05:52.789248	\N	2025-08-14 04:05:52.789248
3	Support Staff	SUP	\N	Support staff department	t	2025-08-14 04:05:52.789248	\N	2025-08-14 04:05:52.789248
1	Primary Education	PED	\N	Primary level education department	t	2025-08-14 04:05:52.789248	\N	2026-02-17 19:39:35.248373
\.


--
-- TOC entry 4390 (class 0 OID 214644)
-- Dependencies: 247
-- Data for Name: designations; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.designations (id, designation_name, department_id, salary_range_min, salary_range_max, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Principal	2	80000.00	120000.00	School Principal	t	2025-08-14 04:06:46.769615	\N	2025-08-14 04:06:46.769615
2	Primary Teacher	1	25000.00	40000.00	Primary level teacher	t	2025-08-14 04:06:46.769615	\N	2025-08-14 04:06:46.769615
3	Class Teacher	1	30000.00	45000.00	Class teacher with additional responsibilities	t	2025-08-14 04:06:46.769615	\N	2025-08-14 04:06:46.769615
\.


--
-- TOC entry 4392 (class 0 OID 214653)
-- Dependencies: 249
-- Data for Name: document_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4394 (class 0 OID 214662)
-- Dependencies: 251
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4396 (class 0 OID 214673)
-- Dependencies: 253
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4398 (class 0 OID 214682)
-- Dependencies: 255
-- Data for Name: emails; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4400 (class 0 OID 214696)
-- Dependencies: 257
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4402 (class 0 OID 214707)
-- Dependencies: 259
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4404 (class 0 OID 214717)
-- Dependencies: 261
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4406 (class 0 OID 214729)
-- Dependencies: 263
-- Data for Name: fee_collections; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4408 (class 0 OID 214740)
-- Dependencies: 265
-- Data for Name: fee_structures; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4410 (class 0 OID 214752)
-- Dependencies: 267
-- Data for Name: files; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4412 (class 0 OID 214763)
-- Dependencies: 269
-- Data for Name: guardians; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4414 (class 0 OID 214775)
-- Dependencies: 271
-- Data for Name: holidays; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4416 (class 0 OID 214785)
-- Dependencies: 273
-- Data for Name: hostel_rooms; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4418 (class 0 OID 214795)
-- Dependencies: 275
-- Data for Name: hostels; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4420 (class 0 OID 214805)
-- Dependencies: 277
-- Data for Name: houses; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4422 (class 0 OID 214814)
-- Dependencies: 279
-- Data for Name: languages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4424 (class 0 OID 214822)
-- Dependencies: 281
-- Data for Name: leave_applications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4426 (class 0 OID 214834)
-- Dependencies: 283
-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4428 (class 0 OID 214845)
-- Dependencies: 285
-- Data for Name: library_book_issues; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4430 (class 0 OID 214858)
-- Dependencies: 287
-- Data for Name: library_books; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4432 (class 0 OID 214869)
-- Dependencies: 289
-- Data for Name: library_categories; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4434 (class 0 OID 214878)
-- Dependencies: 291
-- Data for Name: medical_conditions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4436 (class 0 OID 214889)
-- Dependencies: 293
-- Data for Name: mother_tongues; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.mother_tongues (id, language_name, language_code, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Hindi	HI	Hindi language	t	2025-08-14 04:12:04.350894	\N	2025-08-14 04:12:04.350894
2	Marathi	MR	Marathi language	t	2025-08-14 04:12:04.350894	\N	2025-08-14 04:12:04.350894
3	English	EN	English language	t	2025-08-14 04:12:04.350894	\N	2025-08-14 04:12:04.350894
\.


--
-- TOC entry 4438 (class 0 OID 214896)
-- Dependencies: 295
-- Data for Name: notes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4440 (class 0 OID 214907)
-- Dependencies: 297
-- Data for Name: notice_board; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4442 (class 0 OID 214916)
-- Dependencies: 299
-- Data for Name: parents; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4444 (class 0 OID 214924)
-- Dependencies: 301
-- Data for Name: pickup_points; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4446 (class 0 OID 214933)
-- Dependencies: 303
-- Data for Name: religions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.religions (id, religion_name, description, is_active, created_at, created_by, modified_at) FROM stdin;
1	Hinduism	Hindu religion	t	2025-08-14 04:11:49.000899	\N	2025-08-14 04:11:49.000899
2	Islam	Islamic religion	t	2025-08-14 04:11:49.000899	\N	2025-08-14 04:11:49.000899
3	Christianity	Christian religion	t	2025-08-14 04:11:49.000899	\N	2025-08-14 04:11:49.000899
\.


--
-- TOC entry 4448 (class 0 OID 214940)
-- Dependencies: 305
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4450 (class 0 OID 214947)
-- Dependencies: 307
-- Data for Name: room_types; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4452 (class 0 OID 214956)
-- Dependencies: 309
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4454 (class 0 OID 214965)
-- Dependencies: 311
-- Data for Name: sections; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4456 (class 0 OID 214976)
-- Dependencies: 313
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4458 (class 0 OID 214986)
-- Dependencies: 315
-- Data for Name: student_medical_conditions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4460 (class 0 OID 214995)
-- Dependencies: 317
-- Data for Name: student_promotions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4462 (class 0 OID 215007)
-- Dependencies: 319
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4464 (class 0 OID 215020)
-- Dependencies: 321
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4466 (class 0 OID 215033)
-- Dependencies: 323
-- Data for Name: teacher_routines; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4468 (class 0 OID 215040)
-- Dependencies: 325
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4470 (class 0 OID 215052)
-- Dependencies: 327
-- Data for Name: time_slots; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4472 (class 0 OID 215060)
-- Dependencies: 329
-- Data for Name: todos; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4474 (class 0 OID 215071)
-- Dependencies: 331
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_roles (id, role_name, description, permissions, is_active, created_at, created_by, modified_at) FROM stdin;
1	admin	System Administrator with full access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
2	teacher	Teaching staff with limited admin access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
3	student	Student user with restricted access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
4	parent	Parent with student information access	\N	t	2025-08-14 03:21:30.224811	\N	2025-08-14 03:21:30.224811
5	Guardian	Guardian with student information access	\N	t	2026-02-21 06:44:07.908872	\N	2026-02-21 06:44:07.908872
\.


--
-- TOC entry 4476 (class 0 OID 215080)
-- Dependencies: 333
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4478 (class 0 OID 215092)
-- Dependencies: 335
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4549 (class 0 OID 0)
-- Dependencies: 218
-- Name: academic_years_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4550 (class 0 OID 0)
-- Dependencies: 220
-- Name: addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4551 (class 0 OID 0)
-- Dependencies: 222
-- Name: attendance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4552 (class 0 OID 0)
-- Dependencies: 224
-- Name: blocked_users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4553 (class 0 OID 0)
-- Dependencies: 226
-- Name: blood_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4554 (class 0 OID 0)
-- Dependencies: 228
-- Name: calendar_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4555 (class 0 OID 0)
-- Dependencies: 230
-- Name: calls_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4556 (class 0 OID 0)
-- Dependencies: 232
-- Name: casts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4557 (class 0 OID 0)
-- Dependencies: 234
-- Name: chat_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4558 (class 0 OID 0)
-- Dependencies: 236
-- Name: chats_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4559 (class 0 OID 0)
-- Dependencies: 238
-- Name: class_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4560 (class 0 OID 0)
-- Dependencies: 240
-- Name: class_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4561 (class 0 OID 0)
-- Dependencies: 242
-- Name: class_syllabus_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4562 (class 0 OID 0)
-- Dependencies: 244
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4563 (class 0 OID 0)
-- Dependencies: 246
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4564 (class 0 OID 0)
-- Dependencies: 248
-- Name: designations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4565 (class 0 OID 0)
-- Dependencies: 250
-- Name: document_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4566 (class 0 OID 0)
-- Dependencies: 252
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4567 (class 0 OID 0)
-- Dependencies: 254
-- Name: drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4568 (class 0 OID 0)
-- Dependencies: 256
-- Name: emails_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4569 (class 0 OID 0)
-- Dependencies: 258
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4570 (class 0 OID 0)
-- Dependencies: 260
-- Name: exam_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4571 (class 0 OID 0)
-- Dependencies: 262
-- Name: exams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4572 (class 0 OID 0)
-- Dependencies: 264
-- Name: fee_collections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4573 (class 0 OID 0)
-- Dependencies: 266
-- Name: fee_structures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4574 (class 0 OID 0)
-- Dependencies: 268
-- Name: files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4575 (class 0 OID 0)
-- Dependencies: 270
-- Name: guardians_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4576 (class 0 OID 0)
-- Dependencies: 272
-- Name: holidays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4577 (class 0 OID 0)
-- Dependencies: 274
-- Name: hostel_rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4578 (class 0 OID 0)
-- Dependencies: 276
-- Name: hostels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4579 (class 0 OID 0)
-- Dependencies: 278
-- Name: houses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4580 (class 0 OID 0)
-- Dependencies: 280
-- Name: languages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4581 (class 0 OID 0)
-- Dependencies: 282
-- Name: leave_applications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4582 (class 0 OID 0)
-- Dependencies: 284
-- Name: leave_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4583 (class 0 OID 0)
-- Dependencies: 286
-- Name: library_book_issues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4584 (class 0 OID 0)
-- Dependencies: 288
-- Name: library_books_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4585 (class 0 OID 0)
-- Dependencies: 290
-- Name: library_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4586 (class 0 OID 0)
-- Dependencies: 292
-- Name: medical_conditions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4587 (class 0 OID 0)
-- Dependencies: 294
-- Name: mother_tongues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4588 (class 0 OID 0)
-- Dependencies: 296
-- Name: notes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4589 (class 0 OID 0)
-- Dependencies: 298
-- Name: notice_board_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4590 (class 0 OID 0)
-- Dependencies: 300
-- Name: parents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4591 (class 0 OID 0)
-- Dependencies: 302
-- Name: pickup_points_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4592 (class 0 OID 0)
-- Dependencies: 304
-- Name: religions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4593 (class 0 OID 0)
-- Dependencies: 306
-- Name: reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4594 (class 0 OID 0)
-- Dependencies: 308
-- Name: room_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4595 (class 0 OID 0)
-- Dependencies: 310
-- Name: routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4596 (class 0 OID 0)
-- Dependencies: 312
-- Name: sections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4597 (class 0 OID 0)
-- Dependencies: 314
-- Name: staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4598 (class 0 OID 0)
-- Dependencies: 316
-- Name: student_medical_conditions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4599 (class 0 OID 0)
-- Dependencies: 318
-- Name: student_promotions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4600 (class 0 OID 0)
-- Dependencies: 320
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4601 (class 0 OID 0)
-- Dependencies: 322
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4602 (class 0 OID 0)
-- Dependencies: 324
-- Name: teacher_routines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4603 (class 0 OID 0)
-- Dependencies: 326
-- Name: teachers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4604 (class 0 OID 0)
-- Dependencies: 328
-- Name: time_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4605 (class 0 OID 0)
-- Dependencies: 330
-- Name: todos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4606 (class 0 OID 0)
-- Dependencies: 332
-- Name: user_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4607 (class 0 OID 0)
-- Dependencies: 334
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4608 (class 0 OID 0)
-- Dependencies: 336
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--



--
-- TOC entry 4040 (class 2606 OID 215165)
-- Name: students aadhar_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT aadhar_unique UNIQUE (aadhar_no);


--
-- TOC entry 3822 (class 2606 OID 215167)
-- Name: academic_years academic_years_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_pkey PRIMARY KEY (id);


--
-- TOC entry 3824 (class 2606 OID 215169)
-- Name: academic_years academic_years_year_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.academic_years
    ADD CONSTRAINT academic_years_year_name_key UNIQUE (year_name);


--
-- TOC entry 3826 (class 2606 OID 215171)
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- TOC entry 3828 (class 2606 OID 215173)
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- TOC entry 3830 (class 2606 OID 215175)
-- Name: attendance attendance_student_id_attendance_date_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_student_id_attendance_date_key UNIQUE (student_id, attendance_date);


--
-- TOC entry 3834 (class 2606 OID 215177)
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (id);


--
-- TOC entry 3836 (class 2606 OID 215179)
-- Name: blocked_users blocked_users_user_id_blocked_user_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_user_id_blocked_user_id_key UNIQUE (user_id, blocked_user_id);


--
-- TOC entry 3840 (class 2606 OID 215181)
-- Name: blood_groups blood_groups_blood_group_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blood_groups
    ADD CONSTRAINT blood_groups_blood_group_key UNIQUE (blood_group);


--
-- TOC entry 3842 (class 2606 OID 215183)
-- Name: blood_groups blood_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blood_groups
    ADD CONSTRAINT blood_groups_pkey PRIMARY KEY (id);


--
-- TOC entry 3844 (class 2606 OID 215185)
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- TOC entry 3849 (class 2606 OID 215187)
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- TOC entry 3854 (class 2606 OID 215189)
-- Name: casts casts_cast_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casts
    ADD CONSTRAINT casts_cast_name_key UNIQUE (cast_name);


--
-- TOC entry 3856 (class 2606 OID 215191)
-- Name: casts casts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casts
    ADD CONSTRAINT casts_pkey PRIMARY KEY (id);


--
-- TOC entry 3858 (class 2606 OID 215193)
-- Name: chat_settings chat_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_settings
    ADD CONSTRAINT chat_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 3860 (class 2606 OID 215195)
-- Name: chat_settings chat_settings_user_id_recipient_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_settings
    ADD CONSTRAINT chat_settings_user_id_recipient_id_key UNIQUE (user_id, recipient_id);


--
-- TOC entry 3864 (class 2606 OID 215197)
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- TOC entry 3869 (class 2606 OID 215199)
-- Name: class_rooms class_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_rooms
    ADD CONSTRAINT class_rooms_pkey PRIMARY KEY (id);


--
-- TOC entry 3871 (class 2606 OID 215201)
-- Name: class_rooms class_rooms_room_no_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_rooms
    ADD CONSTRAINT class_rooms_room_no_key UNIQUE (room_no);


--
-- TOC entry 3875 (class 2606 OID 215203)
-- Name: class_schedules class_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_pkey PRIMARY KEY (id);


--
-- TOC entry 3877 (class 2606 OID 215205)
-- Name: class_syllabus class_syllabus_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_syllabus
    ADD CONSTRAINT class_syllabus_pkey PRIMARY KEY (id);


--
-- TOC entry 3884 (class 2606 OID 215207)
-- Name: classes classes_class_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);


--
-- TOC entry 3886 (class 2606 OID 215209)
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- TOC entry 3888 (class 2606 OID 215211)
-- Name: departments departments_department_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_department_code_key UNIQUE (department_code);


--
-- TOC entry 3890 (class 2606 OID 215213)
-- Name: departments departments_department_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_department_name_key UNIQUE (department_name);


--
-- TOC entry 3892 (class 2606 OID 215215)
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- TOC entry 3894 (class 2606 OID 215217)
-- Name: designations designations_designation_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_designation_name_key UNIQUE (designation_name);


--
-- TOC entry 3896 (class 2606 OID 215219)
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- TOC entry 3898 (class 2606 OID 215221)
-- Name: document_types document_types_document_type_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_document_type_key UNIQUE (document_type);


--
-- TOC entry 3900 (class 2606 OID 215223)
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3902 (class 2606 OID 215225)
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- TOC entry 3904 (class 2606 OID 215227)
-- Name: drivers drivers_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_employee_code_key UNIQUE (employee_code);


--
-- TOC entry 3906 (class 2606 OID 215229)
-- Name: drivers drivers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_license_number_key UNIQUE (license_number);


--
-- TOC entry 3908 (class 2606 OID 215231)
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- TOC entry 3910 (class 2606 OID 215233)
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- TOC entry 3916 (class 2606 OID 215235)
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- TOC entry 3923 (class 2606 OID 215237)
-- Name: exam_results exam_results_exam_id_student_id_subject_id_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_student_id_subject_id_key UNIQUE (exam_id, student_id, subject_id);


--
-- TOC entry 3925 (class 2606 OID 215239)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);


--
-- TOC entry 3928 (class 2606 OID 215241)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- TOC entry 3930 (class 2606 OID 215243)
-- Name: fee_collections fee_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_collections
    ADD CONSTRAINT fee_collections_pkey PRIMARY KEY (id);


--
-- TOC entry 3932 (class 2606 OID 215245)
-- Name: fee_collections fee_collections_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_collections
    ADD CONSTRAINT fee_collections_receipt_number_key UNIQUE (receipt_number);


--
-- TOC entry 3935 (class 2606 OID 215247)
-- Name: fee_structures fee_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_pkey PRIMARY KEY (id);


--
-- TOC entry 3937 (class 2606 OID 215249)
-- Name: files files_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_pkey PRIMARY KEY (id);


--
-- TOC entry 3944 (class 2606 OID 215251)
-- Name: guardians guardians_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.guardians
    ADD CONSTRAINT guardians_pkey PRIMARY KEY (id);


--
-- TOC entry 3947 (class 2606 OID 215253)
-- Name: holidays holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);


--
-- TOC entry 3949 (class 2606 OID 215255)
-- Name: hostel_rooms hostel_rooms_hostel_id_room_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostel_rooms
    ADD CONSTRAINT hostel_rooms_hostel_id_room_number_key UNIQUE (hostel_id, room_number);


--
-- TOC entry 3951 (class 2606 OID 215257)
-- Name: hostel_rooms hostel_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostel_rooms
    ADD CONSTRAINT hostel_rooms_pkey PRIMARY KEY (id);


--
-- TOC entry 3953 (class 2606 OID 215259)
-- Name: hostels hostels_hostel_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostels
    ADD CONSTRAINT hostels_hostel_name_key UNIQUE (hostel_name);


--
-- TOC entry 3955 (class 2606 OID 215261)
-- Name: hostels hostels_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostels
    ADD CONSTRAINT hostels_pkey PRIMARY KEY (id);


--
-- TOC entry 3957 (class 2606 OID 215263)
-- Name: houses houses_house_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.houses
    ADD CONSTRAINT houses_house_name_key UNIQUE (house_name);


--
-- TOC entry 3959 (class 2606 OID 215265)
-- Name: houses houses_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.houses
    ADD CONSTRAINT houses_pkey PRIMARY KEY (id);


--
-- TOC entry 3961 (class 2606 OID 215267)
-- Name: languages languages_language_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_language_name_key UNIQUE (language_name);


--
-- TOC entry 3963 (class 2606 OID 215269)
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (id);


--
-- TOC entry 3965 (class 2606 OID 215271)
-- Name: leave_applications leave_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_pkey PRIMARY KEY (id);


--
-- TOC entry 3967 (class 2606 OID 215273)
-- Name: leave_types leave_types_leave_type_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_leave_type_key UNIQUE (leave_type);


--
-- TOC entry 3969 (class 2606 OID 215275)
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- TOC entry 3972 (class 2606 OID 215277)
-- Name: library_book_issues library_book_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues
    ADD CONSTRAINT library_book_issues_pkey PRIMARY KEY (id);


--
-- TOC entry 3974 (class 2606 OID 215279)
-- Name: library_books library_books_isbn_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_books
    ADD CONSTRAINT library_books_isbn_key UNIQUE (isbn);


--
-- TOC entry 3976 (class 2606 OID 215281)
-- Name: library_books library_books_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_books
    ADD CONSTRAINT library_books_pkey PRIMARY KEY (id);


--
-- TOC entry 3978 (class 2606 OID 215283)
-- Name: library_categories library_categories_category_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_categories
    ADD CONSTRAINT library_categories_category_name_key UNIQUE (category_name);


--
-- TOC entry 3980 (class 2606 OID 215285)
-- Name: library_categories library_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_categories
    ADD CONSTRAINT library_categories_pkey PRIMARY KEY (id);


--
-- TOC entry 3982 (class 2606 OID 215287)
-- Name: medical_conditions medical_conditions_condition_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medical_conditions
    ADD CONSTRAINT medical_conditions_condition_name_key UNIQUE (condition_name);


--
-- TOC entry 3984 (class 2606 OID 215289)
-- Name: medical_conditions medical_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.medical_conditions
    ADD CONSTRAINT medical_conditions_pkey PRIMARY KEY (id);


--
-- TOC entry 3986 (class 2606 OID 215291)
-- Name: mother_tongues mother_tongues_language_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mother_tongues
    ADD CONSTRAINT mother_tongues_language_name_key UNIQUE (language_name);


--
-- TOC entry 3988 (class 2606 OID 215293)
-- Name: mother_tongues mother_tongues_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.mother_tongues
    ADD CONSTRAINT mother_tongues_pkey PRIMARY KEY (id);


--
-- TOC entry 3994 (class 2606 OID 215295)
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- TOC entry 3996 (class 2606 OID 215297)
-- Name: notice_board notice_board_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notice_board
    ADD CONSTRAINT notice_board_pkey PRIMARY KEY (id);


--
-- TOC entry 4002 (class 2606 OID 215299)
-- Name: parents parents_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_pkey PRIMARY KEY (id);


--
-- TOC entry 4046 (class 2606 OID 215301)
-- Name: students pen_number_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT pen_number_unique UNIQUE (pen_number);


--
-- TOC entry 4006 (class 2606 OID 215303)
-- Name: pickup_points pickup_points_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pickup_points
    ADD CONSTRAINT pickup_points_pkey PRIMARY KEY (id);


--
-- TOC entry 4008 (class 2606 OID 215305)
-- Name: religions religions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.religions
    ADD CONSTRAINT religions_pkey PRIMARY KEY (id);


--
-- TOC entry 4010 (class 2606 OID 215307)
-- Name: religions religions_religion_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.religions
    ADD CONSTRAINT religions_religion_name_key UNIQUE (religion_name);


--
-- TOC entry 4014 (class 2606 OID 215309)
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- TOC entry 4016 (class 2606 OID 215311)
-- Name: room_types room_types_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_pkey PRIMARY KEY (id);


--
-- TOC entry 4018 (class 2606 OID 215313)
-- Name: room_types room_types_room_type_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.room_types
    ADD CONSTRAINT room_types_room_type_key UNIQUE (room_type);


--
-- TOC entry 4020 (class 2606 OID 215315)
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- TOC entry 4022 (class 2606 OID 215317)
-- Name: routes routes_route_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_route_code_key UNIQUE (route_code);


--
-- TOC entry 4024 (class 2606 OID 215319)
-- Name: routes routes_route_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_route_name_key UNIQUE (route_name);


--
-- TOC entry 4026 (class 2606 OID 215321)
-- Name: sections sections_class_id_section_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_class_id_section_name_key UNIQUE (class_id, section_name);


--
-- TOC entry 4028 (class 2606 OID 215323)
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- TOC entry 4030 (class 2606 OID 215325)
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- TOC entry 4032 (class 2606 OID 215327)
-- Name: staff staff_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_employee_code_key UNIQUE (employee_code);


--
-- TOC entry 4034 (class 2606 OID 215329)
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- TOC entry 4036 (class 2606 OID 215331)
-- Name: student_medical_conditions student_medical_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_medical_conditions
    ADD CONSTRAINT student_medical_conditions_pkey PRIMARY KEY (id);


--
-- TOC entry 4038 (class 2606 OID 215333)
-- Name: student_promotions student_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_pkey PRIMARY KEY (id);


--
-- TOC entry 4048 (class 2606 OID 215335)
-- Name: students students_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_admission_number_key UNIQUE (admission_number);


--
-- TOC entry 4050 (class 2606 OID 215337)
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- TOC entry 4054 (class 2606 OID 215339)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- TOC entry 4056 (class 2606 OID 215341)
-- Name: subjects subjects_subject_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);


--
-- TOC entry 4058 (class 2606 OID 215343)
-- Name: teacher_routines teacher_routines_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teacher_routines
    ADD CONSTRAINT teacher_routines_pkey PRIMARY KEY (id);


--
-- TOC entry 4063 (class 2606 OID 215345)
-- Name: teachers teachers_pan_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pan_number_key UNIQUE (pan_number);


--
-- TOC entry 4065 (class 2606 OID 215347)
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- TOC entry 4067 (class 2606 OID 215349)
-- Name: time_slots time_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.time_slots
    ADD CONSTRAINT time_slots_pkey PRIMARY KEY (id);


--
-- TOC entry 4073 (class 2606 OID 215351)
-- Name: todos todos_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_pkey PRIMARY KEY (id);


--
-- TOC entry 4052 (class 2606 OID 215353)
-- Name: students unique_student_ids_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT unique_student_ids_unique UNIQUE (unique_student_ids);


--
-- TOC entry 4004 (class 2606 OID 215355)
-- Name: parents unique_student_parents; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT unique_student_parents UNIQUE (student_id);


--
-- TOC entry 4075 (class 2606 OID 215357)
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- TOC entry 4077 (class 2606 OID 215359)
-- Name: user_roles user_roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_name_key UNIQUE (role_name);


--
-- TOC entry 4079 (class 2606 OID 215361)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4081 (class 2606 OID 215363)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4083 (class 2606 OID 215365)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4085 (class 2606 OID 215367)
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- TOC entry 4087 (class 2606 OID 215369)
-- Name: vehicles vehicles_vehicle_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vehicle_number_key UNIQUE (vehicle_number);


--
-- TOC entry 3831 (class 1259 OID 215370)
-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_attendance_date ON public.attendance USING btree (attendance_date);


--
-- TOC entry 3832 (class 1259 OID 215371)
-- Name: idx_attendance_student; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_attendance_student ON public.attendance USING btree (student_id);


--
-- TOC entry 3837 (class 1259 OID 215372)
-- Name: idx_blocked_users_blocked_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_blocked_users_blocked_user_id ON public.blocked_users USING btree (blocked_user_id);


--
-- TOC entry 3838 (class 1259 OID 215373)
-- Name: idx_blocked_users_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_blocked_users_user_id ON public.blocked_users USING btree (user_id);


--
-- TOC entry 3845 (class 1259 OID 215374)
-- Name: idx_calendar_events_end_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_calendar_events_end_date ON public.calendar_events USING btree (end_date);


--
-- TOC entry 3846 (class 1259 OID 215375)
-- Name: idx_calendar_events_start_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_calendar_events_start_date ON public.calendar_events USING btree (start_date);


--
-- TOC entry 3847 (class 1259 OID 215376)
-- Name: idx_calendar_events_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_calendar_events_user_id ON public.calendar_events USING btree (user_id);


--
-- TOC entry 3850 (class 1259 OID 215377)
-- Name: idx_calls_call_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_calls_call_date ON public.calls USING btree (call_date DESC);


--
-- TOC entry 3851 (class 1259 OID 215378)
-- Name: idx_calls_recipient_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_calls_recipient_id ON public.calls USING btree (recipient_id);


--
-- TOC entry 3852 (class 1259 OID 215379)
-- Name: idx_calls_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_calls_user_id ON public.calls USING btree (user_id);


--
-- TOC entry 3861 (class 1259 OID 215380)
-- Name: idx_chat_settings_recipient_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_chat_settings_recipient_id ON public.chat_settings USING btree (recipient_id);


--
-- TOC entry 3862 (class 1259 OID 215381)
-- Name: idx_chat_settings_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_chat_settings_user_id ON public.chat_settings USING btree (user_id);


--
-- TOC entry 3865 (class 1259 OID 215382)
-- Name: idx_chats_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_chats_created_at ON public.chats USING btree (created_at DESC);


--
-- TOC entry 3866 (class 1259 OID 215383)
-- Name: idx_chats_recipient_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_chats_recipient_id ON public.chats USING btree (recipient_id);


--
-- TOC entry 3867 (class 1259 OID 215384)
-- Name: idx_chats_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_chats_user_id ON public.chats USING btree (user_id);


--
-- TOC entry 3872 (class 1259 OID 215385)
-- Name: idx_class_rooms_room_no; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_rooms_room_no ON public.class_rooms USING btree (room_no);


--
-- TOC entry 3873 (class 1259 OID 215386)
-- Name: idx_class_rooms_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_rooms_status ON public.class_rooms USING btree (status);


--
-- TOC entry 3878 (class 1259 OID 215387)
-- Name: idx_class_syllabus_academic_year; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_syllabus_academic_year ON public.class_syllabus USING btree (academic_year_id);


--
-- TOC entry 3879 (class 1259 OID 215388)
-- Name: idx_class_syllabus_class_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_syllabus_class_id ON public.class_syllabus USING btree (class_id);


--
-- TOC entry 3880 (class 1259 OID 215389)
-- Name: idx_class_syllabus_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_syllabus_created_at ON public.class_syllabus USING btree (created_at DESC);


--
-- TOC entry 3881 (class 1259 OID 215390)
-- Name: idx_class_syllabus_section_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_syllabus_section_id ON public.class_syllabus USING btree (section_id);


--
-- TOC entry 3882 (class 1259 OID 215391)
-- Name: idx_class_syllabus_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_class_syllabus_status ON public.class_syllabus USING btree (status);


--
-- TOC entry 3911 (class 1259 OID 215392)
-- Name: idx_emails_folder; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emails_folder ON public.emails USING btree (folder);


--
-- TOC entry 3912 (class 1259 OID 215393)
-- Name: idx_emails_sender_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emails_sender_id ON public.emails USING btree (sender_id);


--
-- TOC entry 3913 (class 1259 OID 215394)
-- Name: idx_emails_sent_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emails_sent_at ON public.emails USING btree (sent_at DESC);


--
-- TOC entry 3914 (class 1259 OID 215395)
-- Name: idx_emails_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_emails_user_id ON public.emails USING btree (user_id);


--
-- TOC entry 3917 (class 1259 OID 215396)
-- Name: idx_events_created_by; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_events_created_by ON public.events USING btree (created_by);


--
-- TOC entry 3918 (class 1259 OID 215397)
-- Name: idx_events_end_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_events_end_date ON public.events USING btree (end_date);


--
-- TOC entry 3919 (class 1259 OID 215398)
-- Name: idx_events_event_category; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_events_event_category ON public.events USING btree (event_category);


--
-- TOC entry 3920 (class 1259 OID 215399)
-- Name: idx_events_event_for; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_events_event_for ON public.events USING btree (event_for);


--
-- TOC entry 3921 (class 1259 OID 215400)
-- Name: idx_events_start_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);


--
-- TOC entry 3926 (class 1259 OID 215401)
-- Name: idx_exam_results_student; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_exam_results_student ON public.exam_results USING btree (student_id);


--
-- TOC entry 3933 (class 1259 OID 215402)
-- Name: idx_fee_collections_student; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_fee_collections_student ON public.fee_collections USING btree (student_id);


--
-- TOC entry 3938 (class 1259 OID 215403)
-- Name: idx_files_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_files_created_at ON public.files USING btree (created_at DESC);


--
-- TOC entry 3939 (class 1259 OID 215404)
-- Name: idx_files_file_type; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_files_file_type ON public.files USING btree (file_type);


--
-- TOC entry 3940 (class 1259 OID 215405)
-- Name: idx_files_is_folder; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_files_is_folder ON public.files USING btree (is_folder);


--
-- TOC entry 3941 (class 1259 OID 215406)
-- Name: idx_files_parent_folder_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_files_parent_folder_id ON public.files USING btree (parent_folder_id);


--
-- TOC entry 3942 (class 1259 OID 215407)
-- Name: idx_files_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_files_user_id ON public.files USING btree (user_id);


--
-- TOC entry 3945 (class 1259 OID 215408)
-- Name: idx_guardians_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_guardians_user_id ON public.guardians USING btree (user_id);


--
-- TOC entry 3970 (class 1259 OID 215409)
-- Name: idx_library_issues_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_library_issues_status ON public.library_book_issues USING btree (status);


--
-- TOC entry 3989 (class 1259 OID 215410)
-- Name: idx_notes_created_at; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notes_created_at ON public.notes USING btree (created_at DESC);


--
-- TOC entry 3990 (class 1259 OID 215411)
-- Name: idx_notes_is_deleted; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notes_is_deleted ON public.notes USING btree (is_deleted);


--
-- TOC entry 3991 (class 1259 OID 215412)
-- Name: idx_notes_priority; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notes_priority ON public.notes USING btree (priority);


--
-- TOC entry 3992 (class 1259 OID 215413)
-- Name: idx_notes_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_notes_user_id ON public.notes USING btree (user_id);


--
-- TOC entry 3997 (class 1259 OID 215414)
-- Name: idx_parents_father_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_parents_father_email ON public.parents USING btree (father_email);


--
-- TOC entry 3998 (class 1259 OID 215415)
-- Name: idx_parents_mother_email; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_parents_mother_email ON public.parents USING btree (mother_email);


--
-- TOC entry 3999 (class 1259 OID 215416)
-- Name: idx_parents_student_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_parents_student_id ON public.parents USING btree (student_id);


--
-- TOC entry 4000 (class 1259 OID 215417)
-- Name: idx_parents_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_parents_user_id ON public.parents USING btree (user_id);


--
-- TOC entry 4011 (class 1259 OID 215418)
-- Name: idx_reports_reported_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_reports_reported_user_id ON public.reports USING btree (reported_user_id);


--
-- TOC entry 4012 (class 1259 OID 215419)
-- Name: idx_reports_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_reports_user_id ON public.reports USING btree (user_id);


--
-- TOC entry 4041 (class 1259 OID 215420)
-- Name: idx_students_admission_number; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_students_admission_number ON public.students USING btree (admission_number);


--
-- TOC entry 4042 (class 1259 OID 215421)
-- Name: idx_students_class_section; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_students_class_section ON public.students USING btree (class_id, section_id);


--
-- TOC entry 4043 (class 1259 OID 215422)
-- Name: idx_students_guardian_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_students_guardian_id ON public.students USING btree (guardian_id);


--
-- TOC entry 4044 (class 1259 OID 215423)
-- Name: idx_students_parent_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_students_parent_id ON public.students USING btree (parent_id);


--
-- TOC entry 4059 (class 1259 OID 215424)
-- Name: idx_teachers_class_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_teachers_class_id ON public.teachers USING btree (class_id);


--
-- TOC entry 4060 (class 1259 OID 215425)
-- Name: idx_teachers_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_teachers_status ON public.teachers USING btree (status);


--
-- TOC entry 4061 (class 1259 OID 215426)
-- Name: idx_teachers_subject_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_teachers_subject_id ON public.teachers USING btree (subject_id);


--
-- TOC entry 4068 (class 1259 OID 215427)
-- Name: idx_todos_due_date; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_todos_due_date ON public.todos USING btree (due_date);


--
-- TOC entry 4069 (class 1259 OID 215428)
-- Name: idx_todos_priority; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_todos_priority ON public.todos USING btree (priority);


--
-- TOC entry 4070 (class 1259 OID 215429)
-- Name: idx_todos_status; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_todos_status ON public.todos USING btree (status);


--
-- TOC entry 4071 (class 1259 OID 215430)
-- Name: idx_todos_user_id; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX idx_todos_user_id ON public.todos USING btree (user_id);


--
-- TOC entry 4213 (class 2620 OID 215431)
-- Name: sections trg_update_class_students; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER trg_update_class_students AFTER INSERT OR DELETE OR UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.update_class_students_count();


--
-- TOC entry 4212 (class 2620 OID 215432)
-- Name: parents trigger_parents_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER trigger_parents_updated_at BEFORE UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION public.update_parents_updated_at();


--
-- TOC entry 4205 (class 2620 OID 215433)
-- Name: calendar_events update_calendar_events_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4206 (class 2620 OID 215434)
-- Name: chats update_chats_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4207 (class 2620 OID 215435)
-- Name: emails update_emails_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON public.emails FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4208 (class 2620 OID 215436)
-- Name: events update_events_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4209 (class 2620 OID 215437)
-- Name: files update_files_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4210 (class 2620 OID 215438)
-- Name: notes update_notes_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4211 (class 2620 OID 215439)
-- Name: notice_board update_notice_board_modified_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_notice_board_modified_at BEFORE UPDATE ON public.notice_board FOR EACH ROW EXECUTE FUNCTION public.update_notice_board_modified_at();


--
-- TOC entry 4214 (class 2620 OID 215440)
-- Name: todos update_todos_updated_at; Type: TRIGGER; Schema: public; Owner: neondb_owner
--

CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 4090 (class 2606 OID 215441)
-- Name: attendance attendance_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4091 (class 2606 OID 215446)
-- Name: attendance attendance_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4092 (class 2606 OID 215451)
-- Name: attendance attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.staff(id);


--
-- TOC entry 4093 (class 2606 OID 215456)
-- Name: attendance attendance_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id);


--
-- TOC entry 4094 (class 2606 OID 215461)
-- Name: attendance attendance_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4095 (class 2606 OID 215466)
-- Name: blocked_users blocked_users_blocked_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4096 (class 2606 OID 215471)
-- Name: blocked_users blocked_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4097 (class 2606 OID 215476)
-- Name: calendar_events calendar_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4098 (class 2606 OID 215481)
-- Name: calls calls_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4099 (class 2606 OID 215486)
-- Name: calls calls_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4100 (class 2606 OID 215491)
-- Name: casts casts_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.casts
    ADD CONSTRAINT casts_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(id);


--
-- TOC entry 4101 (class 2606 OID 215496)
-- Name: chat_settings chat_settings_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_settings
    ADD CONSTRAINT chat_settings_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4102 (class 2606 OID 215501)
-- Name: chat_settings chat_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chat_settings
    ADD CONSTRAINT chat_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4103 (class 2606 OID 215506)
-- Name: chats chats_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4104 (class 2606 OID 215511)
-- Name: chats chats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4105 (class 2606 OID 215516)
-- Name: class_schedules class_schedules_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4106 (class 2606 OID 215521)
-- Name: class_schedules class_schedules_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4107 (class 2606 OID 215526)
-- Name: class_schedules class_schedules_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id);


--
-- TOC entry 4108 (class 2606 OID 215531)
-- Name: class_schedules class_schedules_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- TOC entry 4109 (class 2606 OID 215536)
-- Name: class_schedules class_schedules_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.staff(id);


--
-- TOC entry 4110 (class 2606 OID 215541)
-- Name: class_schedules class_schedules_time_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_schedules
    ADD CONSTRAINT class_schedules_time_slot_id_fkey FOREIGN KEY (time_slot_id) REFERENCES public.time_slots(id);


--
-- TOC entry 4114 (class 2606 OID 215546)
-- Name: classes classes_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4117 (class 2606 OID 215551)
-- Name: designations designations_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4118 (class 2606 OID 215556)
-- Name: documents documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id);


--
-- TOC entry 4119 (class 2606 OID 215561)
-- Name: documents documents_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- TOC entry 4120 (class 2606 OID 215566)
-- Name: documents documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4121 (class 2606 OID 215571)
-- Name: documents documents_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.staff(id);


--
-- TOC entry 4122 (class 2606 OID 215576)
-- Name: emails emails_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4123 (class 2606 OID 215581)
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4124 (class 2606 OID 215586)
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4125 (class 2606 OID 215591)
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id);


--
-- TOC entry 4126 (class 2606 OID 215596)
-- Name: exam_results exam_results_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4127 (class 2606 OID 215601)
-- Name: exam_results exam_results_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- TOC entry 4128 (class 2606 OID 215606)
-- Name: exams exams_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4129 (class 2606 OID 215611)
-- Name: exams exams_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4130 (class 2606 OID 215616)
-- Name: fee_collections fee_collections_collected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_collections
    ADD CONSTRAINT fee_collections_collected_by_fkey FOREIGN KEY (collected_by) REFERENCES public.staff(id);


--
-- TOC entry 4131 (class 2606 OID 215621)
-- Name: fee_collections fee_collections_fee_structure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_collections
    ADD CONSTRAINT fee_collections_fee_structure_id_fkey FOREIGN KEY (fee_structure_id) REFERENCES public.fee_structures(id);


--
-- TOC entry 4132 (class 2606 OID 215626)
-- Name: fee_collections fee_collections_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_collections
    ADD CONSTRAINT fee_collections_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4133 (class 2606 OID 215631)
-- Name: fee_structures fee_structures_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4134 (class 2606 OID 215636)
-- Name: fee_structures fee_structures_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.fee_structures
    ADD CONSTRAINT fee_structures_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4135 (class 2606 OID 215641)
-- Name: files files_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.files(id) ON DELETE CASCADE;


--
-- TOC entry 4136 (class 2606 OID 215646)
-- Name: files files_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.files
    ADD CONSTRAINT files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4115 (class 2606 OID 215651)
-- Name: classes fk_classes_teacher; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT fk_classes_teacher FOREIGN KEY (class_teacher_id) REFERENCES public.staff(id);


--
-- TOC entry 4116 (class 2606 OID 215656)
-- Name: departments fk_departments_head; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_of_department) REFERENCES public.staff(id);


--
-- TOC entry 4142 (class 2606 OID 215661)
-- Name: hostels fk_hostels_warden; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostels
    ADD CONSTRAINT fk_hostels_warden FOREIGN KEY (warden_id) REFERENCES public.staff(id);


--
-- TOC entry 4155 (class 2606 OID 215666)
-- Name: parents fk_parents_student; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT fk_parents_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- TOC entry 4088 (class 2606 OID 215671)
-- Name: addresses fk_role; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- TOC entry 4160 (class 2606 OID 215676)
-- Name: sections fk_sections_teacher; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT fk_sections_teacher FOREIGN KEY (section_teacher_id) REFERENCES public.staff(id);


--
-- TOC entry 4176 (class 2606 OID 215681)
-- Name: students fk_student_address; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_student_address FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- TOC entry 4177 (class 2606 OID 215686)
-- Name: students fk_students_guardian; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_guardian FOREIGN KEY (guardian_id) REFERENCES public.guardians(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4178 (class 2606 OID 215691)
-- Name: students fk_students_hostel; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_hostel FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4179 (class 2606 OID 215696)
-- Name: students fk_students_parent; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT fk_students_parent FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- TOC entry 4111 (class 2606 OID 215701)
-- Name: class_syllabus fk_syllabus_academic_year; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_syllabus
    ADD CONSTRAINT fk_syllabus_academic_year FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;


--
-- TOC entry 4112 (class 2606 OID 215706)
-- Name: class_syllabus fk_syllabus_class; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_syllabus
    ADD CONSTRAINT fk_syllabus_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- TOC entry 4113 (class 2606 OID 215711)
-- Name: class_syllabus fk_syllabus_section; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.class_syllabus
    ADD CONSTRAINT fk_syllabus_section FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL;


--
-- TOC entry 4197 (class 2606 OID 215716)
-- Name: teachers fk_teachers_staff; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT fk_teachers_staff FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- TOC entry 4089 (class 2606 OID 215721)
-- Name: addresses fk_user; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4137 (class 2606 OID 215726)
-- Name: guardians guardians_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.guardians
    ADD CONSTRAINT guardians_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4138 (class 2606 OID 215731)
-- Name: guardians guardians_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.guardians
    ADD CONSTRAINT guardians_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4139 (class 2606 OID 215736)
-- Name: holidays holidays_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.holidays
    ADD CONSTRAINT holidays_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4140 (class 2606 OID 215741)
-- Name: hostel_rooms hostel_rooms_hostel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostel_rooms
    ADD CONSTRAINT hostel_rooms_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id);


--
-- TOC entry 4141 (class 2606 OID 215746)
-- Name: hostel_rooms hostel_rooms_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.hostel_rooms
    ADD CONSTRAINT hostel_rooms_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_types(id);


--
-- TOC entry 4143 (class 2606 OID 215751)
-- Name: leave_applications leave_applications_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id);


--
-- TOC entry 4144 (class 2606 OID 215756)
-- Name: leave_applications leave_applications_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- TOC entry 4145 (class 2606 OID 215761)
-- Name: leave_applications leave_applications_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- TOC entry 4146 (class 2606 OID 215766)
-- Name: leave_applications leave_applications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leave_applications
    ADD CONSTRAINT leave_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4147 (class 2606 OID 215771)
-- Name: library_book_issues library_book_issues_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues
    ADD CONSTRAINT library_book_issues_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.library_books(id);


--
-- TOC entry 4148 (class 2606 OID 215776)
-- Name: library_book_issues library_book_issues_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues
    ADD CONSTRAINT library_book_issues_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.staff(id);


--
-- TOC entry 4149 (class 2606 OID 215781)
-- Name: library_book_issues library_book_issues_returned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues
    ADD CONSTRAINT library_book_issues_returned_to_fkey FOREIGN KEY (returned_to) REFERENCES public.staff(id);


--
-- TOC entry 4150 (class 2606 OID 215786)
-- Name: library_book_issues library_book_issues_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues
    ADD CONSTRAINT library_book_issues_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- TOC entry 4151 (class 2606 OID 215791)
-- Name: library_book_issues library_book_issues_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_book_issues
    ADD CONSTRAINT library_book_issues_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4152 (class 2606 OID 215796)
-- Name: library_books library_books_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.library_books
    ADD CONSTRAINT library_books_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.library_categories(id);


--
-- TOC entry 4153 (class 2606 OID 215801)
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4154 (class 2606 OID 215806)
-- Name: notice_board notice_board_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notice_board
    ADD CONSTRAINT notice_board_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4156 (class 2606 OID 215811)
-- Name: parents parents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4157 (class 2606 OID 215816)
-- Name: pickup_points pickup_points_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pickup_points
    ADD CONSTRAINT pickup_points_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- TOC entry 4158 (class 2606 OID 215821)
-- Name: reports reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4159 (class 2606 OID 215826)
-- Name: reports reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4161 (class 2606 OID 215831)
-- Name: sections sections_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4162 (class 2606 OID 215836)
-- Name: staff staff_blood_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_blood_group_id_fkey FOREIGN KEY (blood_group_id) REFERENCES public.blood_groups(id);


--
-- TOC entry 4163 (class 2606 OID 215841)
-- Name: staff staff_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- TOC entry 4164 (class 2606 OID 215846)
-- Name: staff staff_designation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_designation_id_fkey FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- TOC entry 4165 (class 2606 OID 215851)
-- Name: staff staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4166 (class 2606 OID 215856)
-- Name: student_medical_conditions student_medical_conditions_medical_condition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_medical_conditions
    ADD CONSTRAINT student_medical_conditions_medical_condition_id_fkey FOREIGN KEY (medical_condition_id) REFERENCES public.medical_conditions(id);


--
-- TOC entry 4167 (class 2606 OID 215861)
-- Name: student_medical_conditions student_medical_conditions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_medical_conditions
    ADD CONSTRAINT student_medical_conditions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4168 (class 2606 OID 215866)
-- Name: student_promotions student_promotions_from_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_from_academic_year_id_fkey FOREIGN KEY (from_academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4169 (class 2606 OID 215871)
-- Name: student_promotions student_promotions_from_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_from_class_id_fkey FOREIGN KEY (from_class_id) REFERENCES public.classes(id);


--
-- TOC entry 4170 (class 2606 OID 215876)
-- Name: student_promotions student_promotions_from_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_from_section_id_fkey FOREIGN KEY (from_section_id) REFERENCES public.sections(id);


--
-- TOC entry 4171 (class 2606 OID 215881)
-- Name: student_promotions student_promotions_promoted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_promoted_by_fkey FOREIGN KEY (promoted_by) REFERENCES public.staff(id);


--
-- TOC entry 4172 (class 2606 OID 215886)
-- Name: student_promotions student_promotions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- TOC entry 4173 (class 2606 OID 215891)
-- Name: student_promotions student_promotions_to_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_to_academic_year_id_fkey FOREIGN KEY (to_academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4174 (class 2606 OID 215896)
-- Name: student_promotions student_promotions_to_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_to_class_id_fkey FOREIGN KEY (to_class_id) REFERENCES public.classes(id);


--
-- TOC entry 4175 (class 2606 OID 215901)
-- Name: student_promotions student_promotions_to_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_to_section_id_fkey FOREIGN KEY (to_section_id) REFERENCES public.sections(id);


--
-- TOC entry 4180 (class 2606 OID 215906)
-- Name: students students_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4181 (class 2606 OID 215911)
-- Name: students students_blood_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_blood_group_id_fkey FOREIGN KEY (blood_group_id) REFERENCES public.blood_groups(id);


--
-- TOC entry 4182 (class 2606 OID 215916)
-- Name: students students_cast_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_cast_id_fkey FOREIGN KEY (cast_id) REFERENCES public.casts(id);


--
-- TOC entry 4183 (class 2606 OID 215921)
-- Name: students students_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4184 (class 2606 OID 215926)
-- Name: students students_hostel_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_hostel_room_id_fkey FOREIGN KEY (hostel_room_id) REFERENCES public.hostel_rooms(id);


--
-- TOC entry 4185 (class 2606 OID 215931)
-- Name: students students_house_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_house_id_fkey FOREIGN KEY (house_id) REFERENCES public.houses(id);


--
-- TOC entry 4186 (class 2606 OID 215936)
-- Name: students students_mother_tongue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_mother_tongue_id_fkey FOREIGN KEY (mother_tongue_id) REFERENCES public.mother_tongues(id);


--
-- TOC entry 4187 (class 2606 OID 215941)
-- Name: students students_pickup_point_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pickup_point_id_fkey FOREIGN KEY (pickup_point_id) REFERENCES public.pickup_points(id);


--
-- TOC entry 4188 (class 2606 OID 215946)
-- Name: students students_religion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(id);


--
-- TOC entry 4189 (class 2606 OID 215951)
-- Name: students students_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- TOC entry 4190 (class 2606 OID 215956)
-- Name: students students_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id);


--
-- TOC entry 4191 (class 2606 OID 215961)
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4192 (class 2606 OID 215966)
-- Name: subjects subjects_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4193 (class 2606 OID 215971)
-- Name: subjects subjects_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.staff(id);


--
-- TOC entry 4194 (class 2606 OID 215976)
-- Name: teacher_routines teacher_routines_academic_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teacher_routines
    ADD CONSTRAINT teacher_routines_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id);


--
-- TOC entry 4195 (class 2606 OID 215981)
-- Name: teacher_routines teacher_routines_class_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teacher_routines
    ADD CONSTRAINT teacher_routines_class_schedule_id_fkey FOREIGN KEY (class_schedule_id) REFERENCES public.class_schedules(id);


--
-- TOC entry 4196 (class 2606 OID 215986)
-- Name: teacher_routines teacher_routines_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teacher_routines
    ADD CONSTRAINT teacher_routines_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.staff(id);


--
-- TOC entry 4198 (class 2606 OID 215991)
-- Name: teachers teachers_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id);


--
-- TOC entry 4199 (class 2606 OID 215996)
-- Name: teachers teachers_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id);


--
-- TOC entry 4200 (class 2606 OID 216001)
-- Name: todos todos_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4201 (class 2606 OID 216006)
-- Name: todos todos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.todos
    ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4202 (class 2606 OID 216011)
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id);


--
-- TOC entry 4203 (class 2606 OID 216016)
-- Name: vehicles vehicles_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- TOC entry 4204 (class 2606 OID 216021)
-- Name: vehicles vehicles_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- TOC entry 4486 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--



--
-- TOC entry 2346 (class 826 OID 214510)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--



--
-- TOC entry 2345 (class 826 OID 214509)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--



-- Completed on 2026-03-16 14:18:53

--
-- PostgreSQL database dump complete

-- -----------------------------------------------------------------------------
-- school_profile (per-tenant branding; runtime also ensures this table)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_profile (
    id SERIAL PRIMARY KEY,
    school_name VARCHAR(255) NOT NULL,
    logo_url TEXT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);










-- ##############################################################################
-- SEQUENCE SYNC (Calibrating core ID counters)
-- ##############################################################################
SELECT setval('public.user_roles_id_seq', COALESCE((SELECT MAX(id) FROM public.user_roles), 1), true);
SELECT setval('public.users_id_seq', COALESCE((SELECT MAX(id) FROM public.users), 1), true);
SELECT setval('public.students_id_seq', COALESCE((SELECT MAX(id) FROM public.students), 1), true);
SELECT setval('public.staff_id_seq', COALESCE((SELECT MAX(id) FROM public.staff), 1), true);
SELECT setval('public.teachers_id_seq', COALESCE((SELECT MAX(id) FROM public.teachers), 1), true);
SELECT setval('public.parents_id_seq', COALESCE((SELECT MAX(id) FROM public.parents), 1), true);
SELECT setval('public.guardians_id_seq', COALESCE((SELECT MAX(id) FROM public.guardians), 1), true);
SELECT setval('public.academic_years_id_seq', COALESCE((SELECT MAX(id) FROM public.academic_years), 1), true);
SELECT setval('public.classes_id_seq', COALESCE((SELECT MAX(id) FROM public.classes), 1), true);
SELECT setval('public.sections_id_seq', COALESCE((SELECT MAX(id) FROM public.sections), 1), true);
SELECT setval('public.subjects_id_seq', COALESCE((SELECT MAX(id) FROM public.subjects), 1), true);
SELECT setval('public.time_slots_id_seq', COALESCE((SELECT MAX(id) FROM public.time_slots), 1), true);
SELECT setval('public.vehicles_id_seq', COALESCE((SELECT MAX(id) FROM public.vehicles), 1), true);
SELECT setval('public.routes_id_seq', COALESCE((SELECT MAX(id) FROM public.routes), 1), true);
SELECT setval('public.pickup_points_id_seq', COALESCE((SELECT MAX(id) FROM public.pickup_points), 1), true);
SELECT setval('public.attendance_id_seq', COALESCE((SELECT MAX(id) FROM public.attendance), 1), true);
SELECT setval('public.notice_board_id_seq', COALESCE((SELECT MAX(id) FROM public.notice_board), 1), true);
SELECT setval('public.todos_id_seq', COALESCE((SELECT MAX(id) FROM public.todos), 1), true);
SELECT setval('public.departments_id_seq', COALESCE((SELECT MAX(id) FROM public.departments), 1), true);
SELECT setval('public.designations_id_seq', COALESCE((SELECT MAX(id) FROM public.designations), 1), true);
SELECT setval('public.blood_groups_id_seq', COALESCE((SELECT MAX(id) FROM public.blood_groups), 1), true);
SELECT setval('public.religions_id_seq', COALESCE((SELECT MAX(id) FROM public.religions), 1), true);
SELECT setval('public.casts_id_seq', COALESCE((SELECT MAX(id) FROM public.casts), 1), true);
SELECT setval('public.mother_tongues_id_seq', COALESCE((SELECT MAX(id) FROM public.mother_tongues), 1), true);