import { Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import "./FormLabelWithInfo.scss";

export interface FormLabelWithInfoProps {
  /** Visible label text */
  label: string;
  /** Show red asterisk after label */
  isRequired?: boolean;
  /** Tooltip body (also used as native title fallback on the info control) */
  infoText: string;
  /** Associate label with an input id */
  htmlFor?: string;
  className?: string;
}

/**
 * Form label with optional required marker and an accessible info tooltip.
 */
export function FormLabelWithInfo({
  label,
  isRequired = false,
  infoText,
  htmlFor,
  className = "",
}: FormLabelWithInfoProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`form-label mb-1 d-flex align-items-start flex-wrap gap-1 ${className}`.trim()}
    >
      <span className="d-inline-flex align-items-center flex-wrap gap-1">
        <span>{label}</span>
        {isRequired ? (
          <span className="text-danger ms-0" style={{ color: "red" }} aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <Tooltip
        title={infoText}
        placement="topLeft"
        mouseEnterDelay={0.1}
        overlayClassName="form-label-info-tooltip"
        destroyTooltipOnHide
        trigger={["hover", "focus", "click"]}
        getPopupContainer={() => document.body}
      >
        <button
          type="button"
          className="btn btn-link p-0 ms-1 align-middle text-secondary border-0 d-inline-flex rounded-1"
          style={{ lineHeight: 1, minWidth: "1.25rem", minHeight: "1.25rem" }}
          aria-label={`More information about ${label}`}
          title={infoText}
        >
          <InfoCircleOutlined style={{ fontSize: 15 }} aria-hidden />
        </button>
      </Tooltip>
    </label>
  );
}
