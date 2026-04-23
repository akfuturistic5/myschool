import { useCallback, useState } from "react";
import { AutoComplete, Button, Input, Tag } from "antd";
import { apiService } from "../../../../core/services/apiService";

export interface ParentPersonRow {
  id: number | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  address?: string | null;
  occupation?: string | null;
  /** True when row comes from `parents` / `guardians` only (not yet in parent_persons). */
  legacy_from_student_records?: boolean;
}

interface ParentPersonPickerProps {
  label: string;
  selectedId: number | null;
  /** Restrict legacy search to father/mother/guardian columns; still searches parent_persons fully. */
  searchRole?: "father" | "mother" | "guardian" | "any";
  /** Show tag when user picked a legacy row (no parent_persons id yet). */
  matchedFromLegacy?: boolean;
  onSelectPerson: (person: ParentPersonRow) => void;
  onClear: () => void;
}

function optionValue(p: ParentPersonRow, index: number): string {
  if (p.id != null) return String(p.id);
  const tail = [p.phone, p.email, p.full_name].filter(Boolean).join("|");
  return `legacy-${index}-${tail.slice(0, 120)}`;
}

/**
 * Search existing parent/guardian by mobile, email, or name; select to autofill form fields.
 */
export function ParentPersonPicker({
  label,
  selectedId,
  searchRole = "any",
  matchedFromLegacy = false,
  onSelectPerson,
  onClear,
}: ParentPersonPickerProps) {
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<
    { value: string; label: React.ReactNode; person: ParentPersonRow }[]
  >([]);

  const runSearch = useCallback(
    async (q: string) => {
      const t = q.trim();
      setSearchText(q);
      if (t.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = (await apiService.searchParentPersons(t, 20, searchRole ?? "any")) as {
          data?: ParentPersonRow[];
          status?: string;
        };
        const rows = Array.isArray(res?.data) ? res.data : [];
        setOptions(
          rows.map((p, index) => ({
            value: optionValue(p, index),
            label: (
              <div className="py-1">
                <div className="fw-medium text-dark">{p.full_name || "—"}</div>
                <small className="text-muted">
                  {[p.phone || "—", p.email || "—"].join(" · ")}
                  {p.legacy_from_student_records ? (
                    <span className="ms-1 text-info">· from student records</span>
                  ) : null}
                </small>
              </div>
            ),
            person: p,
          }))
        );
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [searchRole]
  );

  const showLinkedTag = selectedId != null || matchedFromLegacy;

  return (
    <div className="mb-3 pb-2 border-bottom">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="form-label mb-0">{label}</span>
        {selectedId != null ? (
          <Tag color="blue">Existing parent selected</Tag>
        ) : null}
        {matchedFromLegacy ? (
          <Tag color="cyan">Matched from student records</Tag>
        ) : null}
        {showLinkedTag ? (
          <Button type="link" size="small" className="p-0" onClick={onClear}>
            Change parent
          </Button>
        ) : null}
      </div>
      <AutoComplete
        className="w-100"
        options={options}
        onSearch={runSearch}
        onSelect={(value) => {
          const hit = options.find((o) => o.value === value);
          if (hit?.person) onSelectPerson(hit.person);
        }}
        notFoundContent={
          loading
            ? "Searching…"
            : searchText.trim().length < 2
              ? "Type at least 2 characters"
              : "No matches"
        }
      >
        <Input
          placeholder="Search by mobile, email, or name…"
          allowClear
          onChange={(e) => setSearchText(e.target.value)}
        />
      </AutoComplete>
      <small className="text-muted d-block mt-1">
        Matches reuse the same parent record when saving (no duplicate contacts).
      </small>
    </div>
  );
}

