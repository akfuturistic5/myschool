import { Select } from "antd";

export type LibrarySelectOption = { value: string; label: string };

/**
 * Ant dropdown for Bootstrap modals / dropdown filters: render to body so options are not clipped,
 * and stack above modal (Bootstrap ~1055).
 */
export function librarySelectGetPopupContainer(node: HTMLElement): HTMLElement {
  const modal = node.closest(".modal");
  if (modal) return document.body;
  const menu = node.closest(".dropdown-menu");
  if (menu) return menu as HTMLElement;
  return document.body;
}

/** Searchable replacement for long book / member / student / staff dropdowns in the library module. */
export function LibrarySearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  allowClear,
  id,
  disabled,
}: {
  options: LibrarySelectOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      id={id}
      showSearch
      allowClear={allowClear}
      disabled={disabled}
      className="w-100 library-searchable-select"
      style={{ width: "100%" }}
      placeholder={placeholder}
      optionFilterProp="label"
      options={options}
      value={value ? value : undefined}
      onChange={(v) => onChange(v ?? "")}
      getPopupContainer={librarySelectGetPopupContainer}
      dropdownStyle={{ zIndex: 2100 }}
      virtual={false}
      filterOption={(input, opt) =>
        String(opt?.label ?? "")
          .toLowerCase()
          .includes(String(input).toLowerCase())
      }
    />
  );
}
