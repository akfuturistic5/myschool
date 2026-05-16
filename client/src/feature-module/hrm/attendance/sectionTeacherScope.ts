/** Section-teacher assignments only (class_teachers with a class_section_id). */
export type SectionTeacherAssignment = {
  classId?: number;
  classSectionId?: number | null;
  sectionId?: number | null;
  className?: string;
  sectionName?: string;
};

export function filterSectionTeacherAssignments(
  assignments: SectionTeacherAssignment[] | null | undefined
): SectionTeacherAssignment[] {
  return (assignments || []).filter(
    (a) =>
      a?.classSectionId != null &&
      Number(a.classSectionId) > 0 &&
      Number.isFinite(Number(a?.sectionId)) &&
      Number(a.sectionId) > 0 &&
      Number.isFinite(Number(a?.classId)) &&
      Number(a.classId) > 0
  );
}

export function buildClassOptionsFromSectionAssignments(
  assignments: SectionTeacherAssignment[]
): { id: number; class_name: string; class_code: string }[] {
  const map = new Map<number, { id: number; class_name: string; class_code: string }>();
  assignments.forEach((a) => {
    const cid = Number(a.classId);
    if (!Number.isFinite(cid) || map.has(cid)) return;
    map.set(cid, {
      id: cid,
      class_name: a.className || `Class ${cid}`,
      class_code: "",
    });
  });
  return Array.from(map.values());
}

export function buildSectionOptionsFromSectionAssignments(
  assignments: SectionTeacherAssignment[],
  classId: number | null
): { id: number; section_name: string }[] {
  const map = new Map<number, { id: number; section_name: string }>();
  assignments
    .filter((a) => classId == null || Number(a.classId) === Number(classId))
    .forEach((a) => {
      const sid = Number(a.sectionId);
      if (!Number.isFinite(sid) || map.has(sid)) return;
      map.set(sid, {
        id: sid,
        section_name: a.sectionName || `Section ${sid}`,
      });
    });
  return Array.from(map.values());
}
