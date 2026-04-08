type SorterLike = {
  columnKey?: string | number;
  order?: "ascend" | "descend" | null;
};

/** Ant Design Table onChange — wires server pagination + sort (column `key` = API sort_by field). */
export function createAccountsTableChangeHandler(opts: {
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
  setSortBy: (s: string) => void;
  setSortDir: (s: "asc" | "desc") => void;
}): (...args: unknown[]) => void {
  return (pag: unknown, _filters: unknown, sorter: unknown) => {
    if (pag && typeof pag === "object") {
      const p = pag as { current?: number; pageSize?: number };
      if (p.current != null) opts.setPage(p.current);
      if (p.pageSize != null) opts.setPageSize(p.pageSize);
    }
    const s = (Array.isArray(sorter) ? sorter[0] : sorter) as SorterLike | undefined;
    if (s?.columnKey != null && s.order) {
      opts.setSortBy(String(s.columnKey));
      opts.setSortDir(s.order === "ascend" ? "asc" : "desc");
      opts.setPage(1);
    } else if (s && s.columnKey != null && !s.order) {
      opts.setSortBy("");
      opts.setSortDir("desc");
      opts.setPage(1);
    }
  };
}
