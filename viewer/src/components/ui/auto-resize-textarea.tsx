import React, { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minHeight?: number;
  maxHeight?: number;
  onSave?: () => void;
  onCancel?: () => void;
}

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ 
    className,
    minHeight = 80,
    maxHeight = 400,
    onSave,
    onCancel,
    onKeyDown,
    ...props 
  }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // 响应式高度配置
    const responsiveMinHeight = isMobile ? 60 : minHeight;
    const responsiveMaxHeight = isMobile ? 200 : maxHeight;

    const adjustHeight = useCallback(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(
          Math.max(textareaRef.current.scrollHeight + 2, responsiveMinHeight),
          responsiveMaxHeight
        );
        textareaRef.current.style.height = `${newHeight}px`;
      }
    }, [responsiveMinHeight, responsiveMaxHeight]);

    useEffect(() => {
      adjustHeight();
    }, [props.value, adjustHeight]);

    useEffect(() => {
      // 自动聚焦到文本末尾
      if (textareaRef.current && props.autoFocus) {
        const textarea = textareaRef.current;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, [props.autoFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 快捷键处理
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onSave?.();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
      
      onKeyDown?.(e);
    };

    return (
      <textarea
        ref={(el) => {
          textareaRef.current = el;
          if (typeof ref === 'function') {
            ref(el);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
          }
        }}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-200 ease-in-out',
          'resize-none overflow-y-auto',
          className
        )}
        onKeyDown={handleKeyDown}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export { AutoResizeTextarea };