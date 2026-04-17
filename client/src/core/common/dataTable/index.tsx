// index.tsx
import { useEffect, useMemo, useState } from "react";
import { Table } from "antd";
import type { DatatableProps } from "../../data/interface"; // Ensure correct path
// Ensure correct path


const Datatable: React.FC<DatatableProps> = ({
  columns,
  dataSource,
  loading = false,
  Selection,
  selectedRowKeys: controlledSelectedKeys,
  onSelectionChange,
  pagination: paginationProp,
  showSearch = true,
  onTableChange,
}) => {
  const safeData = Array.isArray(dataSource) ? dataSource : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  const [internalSelectedRowKeys, setInternalSelectedRowKeys] = useState<any[]>([]);
  const [searchText, setSearchText] = useState<string>("");
  const [filteredDataSource, setFilteredDataSource] = useState(safeData);
  const isSelectionEnabled = Selection !== false;

  const selectionControlled =
    controlledSelectedKeys !== undefined && typeof onSelectionChange === "function";
  const selectedRowKeys = selectionControlled
    ? controlledSelectedKeys
    : internalSelectedRowKeys;

  const onSelectChange = (newSelectedRowKeys: any[], selectedRows: any[]) => {
    if (selectionControlled) {
      onSelectionChange!(newSelectedRowKeys, selectedRows);
    } else {
      setInternalSelectedRowKeys(newSelectedRowKeys);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    const filteredData = safeData.filter((record) =>
      Object.values(record).some((field) =>
        String(field).toLowerCase().includes(value.toLowerCase())
      )
    );
    setFilteredDataSource(filteredData);
  };

  const rowSelection = useMemo(
    () =>
      isSelectionEnabled
        ? {
            selectedRowKeys,
            onChange: onSelectChange,
            getCheckboxProps: (_record: any) => ({ disabled: false }),
          }
        : undefined,
    [isSelectionEnabled, selectedRowKeys]
  );

  useEffect(() => {
    setFilteredDataSource(safeData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource]);

  const defaultPagination = {
    locale: { items_per_page: "" },
    nextIcon: <span>Next</span>,
    prevIcon: <span>Prev</span>,
    defaultPageSize: 10,
    showSizeChanger: true,
    pageSizeOptions: ["10", "20", "30"],
    showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total} items`,
  };

  const paginationConfig =
    paginationProp !== undefined
      ? paginationProp === false
        ? false
        : { ...defaultPagination, ...paginationProp }
      : defaultPagination;


  return (
    <>
      {showSearch ? (
        <div className="table-top-data d-flex px-3 justify-content-between">
          <div className="page-range">
          </div>
          <div className="serch-global text-right">
            <input type="search" className="form-control form-control-sm mb-3 w-auto float-end" value={searchText} placeholder="Search" onChange={(e) => handleSearch(e.target.value)} aria-controls="DataTables_Table_0"></input>
          </div>
        </div>
      ) : null}
      {!Selections ?
        <Table
          className="table datanew dataTable no-footer"
          rowKey={(record) => record?.key ?? record?.id ?? Math.random().toString()}
          columns={safeColumns}
          rowHoverable={false}
          loading={loading}
          dataSource={filteredDataSource ?? safeData}
          pagination={paginationConfig}
          onChange={onTableChange}
        /> :
        <Table
          className="table datanew dataTable no-footer"
          rowKey={(record) => record?.key ?? record?.id ?? Math.random().toString()}
          rowSelection={rowSelection}
          columns={safeColumns}
          rowHoverable={false}
          loading={loading}
          dataSource={filteredDataSource ?? safeData}
          pagination={paginationConfig}
          onChange={onTableChange}
        />}

      <Table
        className="table datanew dataTable no-footer"
        rowKey={(record) => record?.key ?? record?.id ?? Math.random().toString()}
        rowSelection={rowSelection}
        columns={safeColumns}
        rowHoverable={false}
        loading={loading}
        dataSource={filteredDataSource ?? safeData}
        pagination={paginationConfig}
        onChange={onTableChange}
      />
    </>
  );
};

export default Datatable;
