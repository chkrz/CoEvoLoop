import { useState, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2, AlertCircle } from "lucide-react";

interface SharedMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  isSending: boolean;
  disabled?: boolean;
  placeholder?: string;
  serviceCount?: number;
  readyServices?: number;
  totalServices?: number;
}

export function SharedMessageInput({
  value,
  onChange,
  onSend,
  isSending,
  disabled = false,
  placeholder = "输入消息...",
  serviceCount = 0,
  readyServices = 0,
  totalServices = 0
}: SharedMessageInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (value.trim() && !isSending) {
      onSend(value.trim());
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStatusText = () => {
    if (isSending) return '正在发送到所有服务...';
    if (readyServices < totalServices) return `等待 ${totalServices - readyServices} 个服务准备就绪...`;
    if (totalServices === 0) return '请先选择服务';
    return `共享输入 - Shift+Enter 换行，Enter 发送到 ${serviceCount} 个服务`;
  };

  return (
    <div className={`
      border rounded-lg transition-all
      ${isFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}>
      <div className="flex gap-2 p-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isSending}
          className="flex-1 min-h-[60px] max-h-[120px] resize-none border-0 shadow-none focus-visible:ring-0 p-2"
          rows={1}
        />
        
        <div className="flex flex-col justify-end">
          <Button
            onClick={handleSend}
            disabled={disabled || isSending || !value.trim() || readyServices < totalServices}
            size="lg"
            className="h-10 px-4"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 状态提示 */}
      <div className="px-3 pb-2 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          {readyServices < totalServices && !isSending && (
            <AlertCircle className="w-3 h-3 text-yellow-500" />
          )}
          {getStatusText()}
        </span>
        <span className="text-xs">
          {value.length}/1000
        </span>
      </div>
    </div>
  );
}