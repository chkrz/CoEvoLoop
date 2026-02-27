import React, { useState, useEffect } from 'react';
import { format, startOfDay, endOfDay, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DateRangePickerProps {
  dateRange: { start?: Date; end?: Date };
  onDateRangeChange: (range: { start?: Date; end?: Date }) => void;
  quickDate: string;
  onQuickDateChange: (value: string) => void;
  placeholder?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateRange,
  onDateRangeChange,
  quickDate,
  onQuickDateChange,
  placeholder = "选择日期范围"
}) => {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 快速日期选项
  const quickDateOptions = [
    { value: 'custom', label: '自定义范围' },
    { value: 'today', label: '今天' },
    { value: 'yesterday', label: '昨天' },
    { value: 'last7days', label: '最近7天' },
    { value: 'thisWeek', label: '本周' },
    { value: 'lastWeek', label: '上周' },
    { value: 'thisMonth', label: '本月' },
    { value: 'lastMonth', label: '上月' },
    { value: 'last30days', label: '最近30天' },
    { value: 'last90days', label: '最近90天' }
  ];

  // 处理快速日期选择
  useEffect(() => {
    const now = new Date();
    let start: Date | undefined;
    let end: Date | undefined;

    switch (quickDate) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday':
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case 'last7days':
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
        break;
      case 'thisWeek':
        const startOfThisWeek = addDays(now, -now.getDay());
        start = startOfDay(startOfThisWeek);
        end = endOfDay(addDays(startOfThisWeek, 6));
        break;
      case 'lastWeek':
        const startOfLastWeek = addDays(subWeeks(now, 1), -now.getDay());
        start = startOfDay(startOfLastWeek);
        end = endOfDay(addDays(startOfLastWeek, 6));
        break;
      case 'thisMonth':
        start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
        end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case 'lastMonth':
        start = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        break;
      case 'last30days':
        start = startOfDay(subDays(now, 30));
        end = endOfDay(now);
        break;
      case 'last90days':
        start = startOfDay(subDays(now, 90));
        end = endOfDay(now);
        break;
      default:
        break;
    }

    if (start && end) {
      onDateRangeChange({ start, end });
    }
  }, [quickDate, onDateRangeChange]);

  // 处理日历选择
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    if (!dateRange.start || (dateRange.start && dateRange.end)) {
      // 开始新的选择或重置
      onDateRangeChange({ start: date, end: undefined });
    } else if (date < dateRange.start) {
      // 选择的日期在开始日期之前，互换
      onDateRangeChange({ start: date, end: dateRange.start });
    } else {
      // 正常完成选择
      onDateRangeChange({ start: dateRange.start, end: date });
    }
  };

  // 准备显示文本
  const getDisplayText = () => {
    if (quickDate && quickDate.options.find(opt => opt.value === quickDate)) {
      return quickDate.options.find(opt => opt.value === quickDate).label;
    }
    if (dateRange.start && dateRange.end) {
      const formatStr = 'yyyy-MM-dd';
      return `${format(dateRange.start, formatStr)} 至 ${format(dateRange.end, formatStr)}`;
    }
    if (dateRange.start) {
      return format(dateRange.start, 'yyyy-MM-dd');
    }
    return placeholder;
  };

  // 检查是否为有效的日期范围
  const isValidRange = dateRange.start && dateRange.end;

  return (
    <div className="space-y-2">
      <Label>日期范围</Label>
      <div className="space-y-2">
        {/* 快速选择 */}
        <Select value={quickDate} onValueChange={onQuickDateChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择快速日期" />
          </SelectTrigger>
          <SelectContent>
            {quickDateOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 日历选择器 */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="truncate">{getDisplayText()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4">
              <Calendar
                mode="range"
                selected={{
                  from: dateRange.start,
                  to: dateRange.end
                }}
                onSelect={(range) => {
                  onDateRangeChange(range?.from && range?.to ?
                    { start: range.from, end: range.to } :
                    { start: range?.from, end: undefined }
                  );
                }}
                locale={zhCN}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                numberOfMonths={2}
              />
              <div className="flex justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDateRangeChange({});
                    onQuickDateChange('');
                    setOpen(false);
                  }}
                >
                  清除选择
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 显示当前选择 */}
        {isValidRange && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {format(dateRange.start!, 'MM/dd')} - {format(dateRange.end!, 'MM/dd')}
            </Badge>
            {!quickDate && (
              <span className="text-xs text-gray-600">
                ({Math.ceil((dateRange.end!.getTime() - dateRange.start!.getTime()) / (1000 * 3600 * 24))} 天)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangePicker;