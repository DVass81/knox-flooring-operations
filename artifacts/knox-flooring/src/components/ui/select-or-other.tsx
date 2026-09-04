import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const OTHER_VALUE = "__other__";

interface SelectOrOtherProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * A dropdown that lists a fixed set of options plus an "Other…" choice. When
 * "Other…" is picked (or the current value isn't in the list, e.g. previously
 * saved data), a text input appears so a custom value can still be entered.
 *
 * Selecting "Other…" never clears the current value — it only switches to text
 * entry mode and keeps whatever was there so it can be edited rather than lost.
 */
export function SelectOrOther({
  value,
  onChange,
  options,
  placeholder = "Select…",
  otherLabel = "Other…",
  otherPlaceholder = "Enter a custom value",
  disabled,
  className,
  id,
}: SelectOrOtherProps) {
  const isKnown = (v: string) => v !== "" && options.includes(v);

  const [manualOther, setManualOther] = useState(value !== "" && !isKnown(value));
  // Tracks the last value this component is aware of so we can tell an external
  // change (form load / reset / switching records) apart from our own edits.
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      setManualOther(value !== "" && !isKnown(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next: string) => {
    lastValueRef.current = next;
    onChange(next);
  };

  const isOther = manualOther || (value !== "" && !isKnown(value));
  const selectValue = isOther ? OTHER_VALUE : value;

  const handleSelect = (next: string) => {
    if (next === OTHER_VALUE) {
      setManualOther(true);
    } else {
      setManualOther(false);
      emit(next);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Select value={selectValue} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_VALUE}>{otherLabel}</SelectItem>
        </SelectContent>
      </Select>
      {isOther && (
        <Input
          value={value}
          disabled={disabled}
          placeholder={otherPlaceholder}
          onChange={(e) => emit(e.target.value)}
        />
      )}
    </div>
  );
}
