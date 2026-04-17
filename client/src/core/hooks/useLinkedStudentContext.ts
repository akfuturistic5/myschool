import { useEffect, useMemo, useState } from "react";
import { apiService } from "../services/apiService";
import { useCurrentStudent } from "./useCurrentStudent";
import { useCurrentUser } from "./useCurrentUser";
import { useParents } from "./useParents";

interface LinkedStudentLocationState {
  studentId?: number;
  student?: any;
}

interface UseLinkedStudentContextOptions {
  locationState?: LinkedStudentLocationState | null;
  routeStudentId?: string | number | null;
}

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
  const roleTokens = [
    currentUser?.role,
    (currentUser as any)?.role_name,
    (currentUser as any)?.display_role,
  ]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
  const role = roleTokens[0] || "";
  const isStudentRole = roleTokens.some((r) => r === "student" || r.includes("student"));
  const isParentRole = roleTokens.some(
    (r) => r === "parent" || r === "guardian" || r === "father" || r === "mother" || r.includes("parent") || r.includes("guardian")
  );

  const {
    parents,
    loading: parentChildrenLoading,
  } = useParents({ forCurrentUser: isParentRole, enabled: isParentRole });

  const fallbackParentStudentId = useMemo(() => {
    if (!isParentRole || !Array.isArray(parents) || parents.length === 0) return null;
    return parseStudentId(parents[0]?.student_id);
  }, [isParentRole, parents]);

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

  return {
    role,
    student,
    studentId: resolvedStudentId,
    loading,
    loadError,
    parentChildrenLoading,
  };
};
