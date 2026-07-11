"use client";

import { FC } from "react";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

interface DateRangePickerProps {
  range: DateRange | undefined;
  setRange: (range: DateRange | undefined) => void;
  placeholder?: string;
}

export const DateRangePicker: FC<DateRangePickerProps> = ({
  range,
  setRange,
  placeholder = "Select date range",
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-9 justify-start text-left font-normal text-xs bg-black/40 border-white/10 hover:bg-white/2 text-white hover:text-white! rounded-lg cursor-pointer"
        >
          <CalendarIcon className="mr-2 size-3.5 animate-pulse" />
          {range?.from ? (
            range.to ? (
              <span className="truncate">
                {formatDate(range.from)} - {formatDate(range.to)}
              </span>
            ) : (
              <span>{formatDate(range.from)}</span>
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-white/10 bg-[#0e0a1c] z-50 shadow-2xl"
        align="start"
      >
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={1}
          className="rounded-lg border-white/5"
        />
      </PopoverContent>
    </Popover>
  );
};
