import React from "react";
import "./FormInput.scss";
import { AssetType } from "../../../store/types";

export type InputChangeProps = {
  validity: { valid: boolean; error?: string };
  inputName: string;
  event?: React.ChangeEvent<HTMLInputElement>;
  value?: number | string | boolean;
  tokenAddress?: string;
};

export type FormInputProps = {
  className?: string;
  label: string | React.ReactNode;
  name?: string;
  max?: number;
  min?: number;
  step?: number;
  error?: string;
  type?: string;
  units?: AssetType[];
  required?: boolean;
  disabled?: boolean;
  value?: string | number;
  autofocus?: boolean;
  change?: ((props: InputChangeProps) => void) | undefined;
};

export const errorStatus = (type?: string) => ({
  valid: { message: null },
  valueMissing: { message: "Please fill out this field." },
  typeMismatch: { message: `Please fill in a valid ${type}` },
  tooShort: { message: "Please lengthen this text." },
  tooLong: { message: "Please shorten this text." },
  badInput: { message: "Please enter a number." },
  stepMismatch: { message: "Please select a valid value." },
  rangeOverflow: { message: "Please select a smaller value." },
  rangeUnderflow: { message: "Please select a larger value." },
  patternMismatch: { message: "Please match the requested format." }
});

class FormInput extends React.Component<
  FormInputProps,
  {
    lastChangeEvent?: React.ChangeEvent<HTMLInputElement>;
    tokenAddress?: string;
    value?: string | number;
    error: string | undefined;
    valid: boolean;
  }
> {
  constructor(props: FormInputProps) {
    super(props);
    this.state = {
      tokenAddress:
        props.units && props.units.length > 0
          ? props.units[0].tokenAddress
          : undefined,
      lastChangeEvent: undefined,
      value: props.value || "",
      error: props.error,
      valid: !!(props.error || (props.required && props.value !== undefined))
    };
  }

  handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { type, disabled, error, change, name } = this.props;
    const { tokenAddress } = this.state;
    const inputError =
      error || this.getError(event.target.validity, type, disabled);
    if (change) {
      change({
        event,
        tokenAddress,
        validity: {
          error: error as string,
          valid: !inputError
        },
        inputName: name as string,
        value: event.target.value
      });
    }
    this.setState({
      lastChangeEvent: event,
      error: inputError,
      value: event.target.value,
      valid: !inputError
    });
  }

  getError(
    validity: ValidityState,
    type?: string,
    disabled?: boolean
  ): string | undefined {
    if (disabled || type === "file") return;
    for (const errorType in validity) {
      if (validity[errorType]) {
        return errorStatus(type)[errorType].message;
      }
    }
    return "The value you entered for this field is invalid.";
  }

  handleUnitChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const { error: propError, change, name } = this.props;
    const { lastChangeEvent, error: stateError, value, valid } = this.state;
    const error = propError || stateError;
    if (change) {
      change({
        value,
        event: lastChangeEvent,
        tokenAddress: event.target.value,
        validity: { error, valid },
        inputName: name as string
      });
    }
    this.setState({ ...this.state, tokenAddress: event.target.value });
  }

  render() {
    const {
      className,
      name,
      label,
      max,
      min,
      step,
      type,
      units,
      disabled,
      required,
      autofocus
    } = this.props as FormInputProps;
    const { value, error } = this.state;
    return (
      <label className={className}>
        <div className="label">{label}</div>
        {required}
        <div
          className={disabled ? "input-container disabled" : "input-container"}
        >
          <input
            data-test-selector={`${name || type}-input`}
            name={name || "input"}
            className="input"
            autoFocus={autofocus || false}
            disabled={disabled || false}
            required={required || false}
            type={type || "text"}
            value={value}
            max={max || Infinity}
            min={isNaN(min as number) ? -Infinity : min}
            step={step || 1}
            onBlur={event => this.handleChange(event)}
            onChange={event => this.handleChange(event)}
          />
          {Array.isArray(units) && units.length === 1 ? (
            <div className="unit">{units[0].name}</div>
          ) : Array.isArray(units) && units.length > 1 ? (
            <select
              className="unit-selector"
              onChange={event => this.handleUnitChange(event)}
            >
              {units.map(({ shortName, tokenAddress }) => (
                <option
                  key={shortName}
                  className="unit-selector-item"
                  value={tokenAddress}
                >
                  {shortName}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {error ? (
          <div
            className="error"
            data-test-selector={`error-${name || type}-input}`}
          >
            {error}
          </div>
        ) : null}
      </label>
    );
  }
}

export { FormInput };
