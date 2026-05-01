import { useEffect, useMemo, useState } from "react";
import { apiService } from "../services/apiService";
import { useCurrentStudent } from "./useCurrentStudent";
import { useCurrentUser } from "./useCurrentUser";
import { useParents } from "./useParents";
import { normalizeAuthRole } from "../utils/roleUtils";

interface LinkedStudentLocationState {
  studentId?: number;
  student?: any;
}

interface UseLinkedStudentContextOptions {
  locationState?: LinkedStudentLocationState | null;
  routeStudentId?: string | number | null;
}

/** Mirrors server/src/config/roles.js ROLES — used when JWT/display strings are missing or still "User". */
const ROLE_IDS = {
  TEACHER: 2,
  STUDENT: 3,
  PARENT: 4,
  GUARDIAN: 5,
  ADMINISTRATIVE: 6,
} as const;

/** Written by Parent Dashboard when switching children; read when sidebar opens student pages without navigation state. */
export const PARENT_PORTAL_SELECTED_STUDENT_STORAGE_KEY = "myschool_parent_selected_student_id";

const parseStudentId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const useLinkedStudentContext = ({
  locationState,
  routeStudentId,
}: UseLinkedStudentContextOptions = {}) => {
  const { user: currentUser } = useCurrentUser();
  const { student: currentStudent, loading: currentStudentLoading } = useCurrentStudent();
  const rawRoleId = Number((currentUser as any)?.user_role_id ?? (currentUser as any)?.role_id);
  const roleId = Number.isFinite(rawRoleId) && rawRoleId > 0 ? rawRoleId : null;

  const canonicalRole = normalizeAuthRole(
    (currentUser as any)?.role_name ?? currentUser?.role,
    (currentUser as any)?.user_role_id ?? (currentUser as any)?.role_id
  )
    .toString()
    .trim()
    .toLowerCase();
  const roleTokens = [canonicalRole].filter(Boolean);

  const isStudentRole =
    roleTokens.some((r) => r === "student" || r.includes("student")) || roleId === ROLE_IDS.STUDENT;

  const isParentRole =
    roleTokens.some(
      (r) =>
        r === "parent" ||
        r === "guardian" ||
        r === "father" ||
        r === "mother" ||
        r.includes("parent") ||
        r.includes("guardian")
    ) ||
    roleId === ROLE_IDS.PARENT ||
    roleId === ROLE_IDS.GUARDIAN;

  /** Guardian portal: ward leaves use /guardian-wards (not parent-children). */
  const isGuardianViewer = roleTokens.some((r) => r === "guardian") || roleId === ROLE_IDS.GUARDIAN;

  /**
   * Parent portal (father/mother/parent role_name) — used for leave list + child scoping.
   * Excludes guardian so guardian flow keeps using guardian endpoints only.
   */
  const isParentLeaveViewer =
    !isGuardianViewer &&
    (roleTokens.some((r) => ["parent", "father", "mother"].includes(r)) || roleId === ROLE_IDS.PARENT);

  /**
   * Normalized role string for legacy `role === "student"` checks.
   * When /auth/me falls back to display_role "User", derive from role_id so parent/student pages still work.
   */
  const role = useMemo(() => {
    const primary = roleTokens[0] || "";
    if (primary && primary !== "user") return primary;
    if (roleId === ROLE_IDS.STUDENT) return "student";
    if (roleId === ROLE_IDS.PARENT) return "parent";
    if (roleId === ROLE_IDS.GUARDIAN) return "guardian";
    if (roleId === ROLE_IDS.TEACHER) return "teacher";
    if (roleId === ROLE_IDS.ADMINISTRATIVE) return "administrative";
    if (roleId === 1) return "admin";
    return primary;
  }, [roleTokens, roleId]);

  const {
    parents,
    loading: parentChildrenLoading,
  } = useParents({ forCurrentUser: isParentRole, enabled: isParentRole });

  const persistedParentStudentId = useMemo(() => {
    if (typeof window === "undefined" || !isParentRole) return null;
    try {
      return parseStudentId(sessionStorage.getItem(PARENT_PORTAL_SELECTED_STUDENT_STORAGE_KEY));
    } catch {
      return null;
    }
  }, [isParentRole]);

  const fallbackParentStudentId = useMemo(() => {
    if (!isParentRole || !Array.isArray(parents) || parents.length === 0) {
      return persistedParentStudentId;
    }
    const fromParents = parseStudentId(parents[0]?.student_id);
    if (persistedParentStudentId != null) {
      const match = parents.some((p: any) => parseStudentId(p?.student_id) === persistedParentStudentId);
      if (match) return persistedParentStudentId;
    }
    return fromParents ?? persistedParentStudentId;
  }, [isParentRole, parents, persistedParentStudentId]);

  const queryStudentId = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const search = new URLSearchParams(window.location.search || "");
      return parseStudentId(search.get("studentId"));
    } catch {
      return null;
    }
  }, [routeStudentId, locationState]);

  const resolvedStudentId = useMemo(() => {
    return (
      parseStudentId(routeStudentId) ??
      queryStudentId ??
      parseStudentId(locationState?.studentId) ??
      parseStudentId(locationState?.student?.id) ??
      (isStudentRole ? parseStudentId(currentStudent?.id) : null) ??
      fallbackParentStudentId
    );
  }, [routeStudentId, queryStudentId, locationState, isStudentRole, currentStudent, fallbackParentStudentId]);

  /** Ward class/section/year from /parents/me — fills timetable when GET /students/:id omits or fails to load these fields. */
  const parentPlacementForWard = useMemo(() => {
    if (!isParentRole || resolvedStudentId == null || !Array.isArray(parents) || parents.length === 0) {
      return null;
    }
    const row = parents.find((p: any) => parseStudentId(p?.student_id) === resolvedStudentId) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      class_id: parseStudentId(row.class_id),
      section_id: parseStudentId(row.section_id),
      academic_year_id: parseStudentId(row.academic_year_id),
    };
  }, [isParentRole, resolvedStudentId, parents]);

  const [student, setStudent] = useState<any>(() => {
    if (locationState?.student) return locationState.student;
    if (isStudentRole && currentStudent) return currentStudent;
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isParentRole && parentChildrenLoading && !resolvedStudentId) {
      setLoading(true);
      return;
    }

    if (!resolvedStudentId) {
      setStudent(locationState?.student ?? (isStudentRole ? currentStudent : null));
      setLoadError(null);
      setLoading(isStudentRole && currentStudentLoading);
      return;
    }

    if (locationState?.student && parseStudentId(locationState.student.id) === resolvedStudentId) {
      setStudent(locationState.student);
    }

    if (isStudentRole && parseStudentId(currentStudent?.id) === resolvedStudentId) {
      // Pre-fill quickly for UX, then continue and fetch full student details (class teacher, lookups, etc.)
      // from /students/:id, which applies ownership checks server-side.
      setStudent(currentStudent);
      setLoadError(null);
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiService
      .getStudentById(resolvedStudentId)
      .then((res: any) => {
        if (cancelled) return;
        const nextStudent = res?.data ?? null;
        setStudent(nextStudent && typeof nextStudent === "object" ? nextStudent : null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError((err as Error)?.message ?? "Failed to load student");
        setStudent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    resolvedStudentId,
    locationState,
    isStudentRole,
    isParentRole,
    currentStudent,
    currentStudentLoading,
    parentChildrenLoading,
  ]);

  useEffect(() => {
    if (!parentPlacementForWard || !resolvedStudentId) return;
    const { class_id: pC, section_id: pS, academic_year_id: pAy } = parentPlacementForWard;
    if (pC == null && pS == null && pAy == null) return;

    setStudent((prev) => {
      const base =
        prev && typeof prev === "object" && parseStudentId((prev as { id?: unknown }).id) === resolvedStudentId
          ? { ...(prev as Record<string, unknown>) }
          : { id: resolvedStudentId };
      const o = base as Record<string, unknown>;
      let changed = false;
      const fill = (key: string, v: number | null) => {
        if (v == null) return;
        if (parseStudentId(o[key]) != null) return;
        o[key] = v;
        changed = true;
      };
      fill("class_id", pC);
      fill("section_id", pS);
      fill("academic_year_id", pAy);
      if (!changed) return prev;
      return base as any;
    });
  }, [parentPlacementForWard, resolvedStudentId]);

  return {
    role,
    isStudentRole,
    isParentLeaveViewer,
    isGuardianViewer,
    student,
    studentId: resolvedStudentId,
    loading,
    loadError,
    parentChildrenLoading,
  };
};
