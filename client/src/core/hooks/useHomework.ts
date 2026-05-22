import { useCallback, useEffect, useState } from "react";
import { apiService } from "../services/apiService";
import { formatDateDMY } from "../utils/dateDisplay";
import { extractMessageFromApiError } from "../utils/apiErrorMessage";
import type { HomeworkListFilters, HomeworkListItem } from "../types/homework";

export const useHomework = (filters: HomeworkListFilters) => {
  const [rows, setRows] = useState<HomeworkListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchHomework = useCallback(async () => {
    if (filters.academic_year_id == null) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      setError("Select an academic year from the header to load homework.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = {
        academic_year_id: filters.academic_year_id,
        page: filters.page ?? 1,
        limit: filters.limit ?? 25,
      };
      if (filters.class_id != null) params.class_id = filters.class_id;
      if (filters.class_section_id != null) params.class_section_id = filters.class_section_id;
      if (filters.class_subject_id != null) params.class_subject_id = filters.class_subject_id;
      if (filters.status) params.status = filters.status;

      const response = await apiService.getHomeworkList(params);
      const raw = response?.data ?? (Array.isArray(response) ? response : []);
      const list = Array.isArray(raw) ? raw : [];

      const mapped: HomeworkListItem[] = list.map((row: Record<string, unknown>, index: number) => {
        const id = Number(row.id);
        return {
          key: String(id ?? index),
          id,
          title: String(row.title ?? ""),
          class: String(row.class_name ?? ""),
          section: String(row.section_name ?? ""),
          subject: String(row.subject_name ?? ""),
          homeworkDate: formatDateDMY(row.assign_date as string),
          submissionDate: formatDateDMY(row.due_date as string),
          status: String(row.status ?? ""),
          createdBy: String(row.teacher_name ?? "—"),
          homeworkType: String(row.homework_type ?? "Homework"),
          recipientCount: Number(row.recipient_count ?? 0),
          submittedCount: Number(row.submitted_count ?? 0),
          pendingEvaluationCount: Number(row.pending_evaluation_count ?? 0),
          originalData: row,
        };
      });

      setRows(mapped);
      setTotal(Number(response?.total ?? mapped.length));
    } catch (err) {
      console.error("useHomework:", err);
      setError(extractMessageFromApiError(err));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters.academic_year_id,
    filters.class_id,
    filters.class_section_id,
    filters.class_subject_id,
    filters.status,
    filters.page,
    filters.limit,
  ]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  return {
    rows,
    loading,
    error,
    total,
    refetch: fetchHomework,
  };
};
