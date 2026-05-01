import React, { useEffect, useRef, useState } from 'react';
import type { Dayjs } from 'dayjs';
import { DatePicker, Dropdown, Input } from 'antd';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(customParseFormat);
dayjs.extend(localeData);

const { RangePicker } = DatePicker;
const dateFormat = 'YYYY/MM/DD';

interface PredefinedDatePickerProps {
  /** When set, the component is controlled (e.g. sync with list filters / API). */
  value?: [Dayjs, Dayjs];
  onChange?: (dates: [Dayjs, Dayjs]) => void;
}

/** Default range: last 7 days (matches “Last 7 Days” in the menu). */
export const defaultDateRange = (): [Dayjs, Dayjs] => [dayjs().subtract(6, 'days'), dayjs()];

const PredefinedDatePicker: React.FC<PredefinedDatePickerProps> = ({ onChange, value: valueFromParent }) => {
  const isControlled = valueFromParent != null;
  const [uncontrolled, setUncontrolled] = useState<[Dayjs, Dayjs]>(defaultDateRange);
  const dates = isControlled ? valueFromParent! : uncontrolled;
  const setDateRange = (next: [Dayjs, Dayjs]) => {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  };
  const [customVisible, setCustomVisible] = useState(false);
  const rangeRef = useRef<any>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  const predefinedRanges: Record<string, [Dayjs, Dayjs]> = {
    Today: [dayjs(), dayjs()],
    Yesterday: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')],
    'Last 7 Days': [dayjs().subtract(6, 'days'), dayjs()],
    'Last 30 Days': [dayjs().subtract(29, 'day'), dayjs()],
    'This Month': [dayjs().startOf('month'), dayjs().endOf('month')],
    'Last Month': [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'Custom Range') {
      setCustomVisible(true);
      // Trigger calendar popup manually
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
      focusTimeoutRef.current = setTimeout(() => {
        rangeRef.current?.focus();
      }, 0);
    } else {
      const newDates = predefinedRanges[key];
      setDateRange(newDates);
      setCustomVisible(false);
    }
  };

  const handleCustomChange = (value: any) => {
    if (value) {
      setDateRange(value);
      setCustomVisible(false);
    }
  };

  const menuItems = [
    ...Object.keys(predefinedRanges).map(label => ({
      key: label,
      label,
    })),
    { type: 'divider' as const },
    { key: 'Custom Range', label: 'Custom Range' },
  ];

  const displayValue = `${dates[0].format(dateFormat)} - ${dates[1].format(dateFormat)}`;

  return (
    <div className='custome-range-picker'>
      <i className='ti ti-calendar'></i>
      <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['click']}>
        <Input
          readOnly
          value={displayValue}
          className=""
        />
      </Dropdown>

      {/* Hidden RangePicker - purely for calendar popup */}
      {customVisible && (
        <RangePicker
          open
          ref={rangeRef}
          onChange={handleCustomChange}
          format={dateFormat}
          value={dates}
          allowClear={false}
          style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
          onOpenChange={(open) => {
            if (!open) setCustomVisible(false);
          }}
        />
      )}
    </div>
  );
};

export default PredefinedDatePicker;

