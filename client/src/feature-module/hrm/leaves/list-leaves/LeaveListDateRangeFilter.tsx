import { useState, useRef, useCallback } from "react";
import { DatePicker, Dropdown, Input, type MenuProps } from "antd";
import type { Dayjs } from "dayjs";
import {
  getLeaveListDateInputLabel,
  type LeaveListDatePreset,
} from "./leaveListDateRangeUtils";

const { RangePicker } = DatePicker;
const PICKER_FMT = "YYYY/MM/DD";

const MENU_KEYS: { key: LeaveListDatePreset; label: string }[] = [
  { key: "all", label: "All" },
  { key: "current_week", label: "Current Week" },
  { key: "current_month", label: "Current Month" },
  { key: "last_2_weeks", label: "Last 2 Weeks" },
  { key: "last_2_months", label: "Last 2 Months" },
];

export interface LeaveListDateRangeFilterProps {
  preset: LeaveListDatePreset;
  onPresetChange: (p: LeaveListDatePreset) => void;
  customRange: [Dayjs, Dayjs];
  onCustomRangeChange: (r: [Dayjs, Dayjs]) => void;
}

/**
 * List-of-leaves only: date presets + custom range. Does not alter shared `datePicker.tsx`.
 */
const LeaveListDateRangeFilter = ({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
}: LeaveListDateRangeFilterProps) => {
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const rangeRef = useRef<any>(null);

  const display = getLeaveListDateInputLabel(preset, customRange);

  const applyPreset = useCallback(
    (key: string) => {
      const k = key as LeaveListDatePreset;
      if (k === "custom") {
        onPresetChange("custom");
        setCustomPickerOpen(true);
        setTimeout(() => rangeRef.current?.focus?.(), 0);
        return;
      }
      setCustomPickerOpen(false);
      onPresetChange(k);
    },
    [onPresetChange]
  );

  const menuItems: MenuProps["items"] = [
    ...MENU_KEYS.map((item) => ({ key: item.key, label: item.label })),
    { type: "divider" },
    { key: "custom", label: "Custom Date" },
  ];

  const handleMenuClick: MenuProps["onClick"] = (info) => {
    applyPreset(String(info.key));
  };

  const handleRangeChange = (value: null | (Dayjs | null)[]) => {
    if (value?.[0] && value[1]) {
      onCustomRangeChange([value[0], value[1]]);
    }
  };

  const onRangeOpenChange = (open: boolean) => {
    if (!open) setCustomPickerOpen(false);
  };

  return (
    <div className="custome-range-picker position-relative">
      <i className="ti ti-calendar" />
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenuClick }}
        trigger={["click"]}
      >
        <Input
          readOnly
          value={display}
          className=""
          aria-label="Date range for leave list"
        />
      </Dropdown>

      <RangePicker
        open={customPickerOpen}
        ref={rangeRef}
        onChange={handleRangeChange as any}
        onOpenChange={onRangeOpenChange}
        format={PICKER_FMT}
        value={customRange}
        allowClear={false}
        getPopupContainer={() => document.body}
        className="leave-list-range-picker__hidden"
        style={{
          position: "fixed",
          width: 0,
          height: 0,
          top: 0,
          left: 0,
          margin: 0,
          padding: 0,
          border: 0,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export default LeaveListDateRangeFilter;
