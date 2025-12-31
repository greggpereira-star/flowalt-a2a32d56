import * as React from "react";
import { useState, useEffect } from "react";
import { parse, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled = false,
  className,
}: DateInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Sync input value with external value
  useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "dd/MM/yyyy"));
    } else {
      setInputValue("");
    }
  }, [value]);

  // Apply mask as user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, ""); // Remove non-digits
    
    // Apply mask DD/MM/AAAA
    if (input.length > 0) {
      if (input.length <= 2) {
        input = input;
      } else if (input.length <= 4) {
        input = `${input.slice(0, 2)}/${input.slice(2)}`;
      } else {
        input = `${input.slice(0, 2)}/${input.slice(2, 4)}/${input.slice(4, 8)}`;
      }
    }
    
    setInputValue(input);

    // Try to parse the date when complete
    if (input.length === 10) {
      const parsedDate = parse(input, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        onChange?.(parsedDate);
      }
    } else if (input.length === 0) {
      onChange?.(undefined);
    }
  };

  // Handle blur to validate and format
  const handleBlur = () => {
    if (inputValue.length === 10) {
      const parsedDate = parse(inputValue, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        onChange?.(parsedDate);
        setInputValue(format(parsedDate, "dd/MM/yyyy"));
      } else {
        // Invalid date, reset to previous value or empty
        if (value && isValid(value)) {
          setInputValue(format(value, "dd/MM/yyyy"));
        } else {
          setInputValue("");
        }
      }
    } else if (inputValue.length > 0 && inputValue.length < 10) {
      // Incomplete date, reset
      if (value && isValid(value)) {
        setInputValue(format(value, "dd/MM/yyyy"));
      } else {
        setInputValue("");
      }
    }
  };

  // Handle calendar selection
  const handleCalendarSelect = (date: Date | undefined) => {
    onChange?.(date);
    setIsCalendarOpen(false);
    if (date) {
      setInputValue(format(date, "dd/MM/yyyy"));
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
        maxLength={10}
      />
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-0 h-full px-3 hover:bg-transparent"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 bg-popover border shadow-lg z-50" 
          align="end"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
