import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnnotationPanel, Annotation } from "./AnnotationPanel";
import { MessageSquare, Edit3, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageAnnotationButtonProps {
  messageId: string;
  content: string;
  onSaveAnnotation: (annotation: Annotation) => void;
  annotations: Record<string, Annotation>;
  className?: string;
}

export function MessageAnnotationButton({ 
  messageId, 
  content, 
  onSaveAnnotation, 
  annotations,
  className 
}: MessageAnnotationButtonProps) {
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const existingAnnotation = annotations[messageId];

  const getAnnotationIcon = (type: Annotation['type']) => {
    switch (type) {
      case 'positive': return <ThumbsUp className="w-3 h-3" />;
      case 'negative': return <ThumbsDown className="w-3 h-3" />;
      case 'improvement': return <Edit3 className="w-3 h-3" />;
      default: return <MessageSquare className="w-3 h-3" />;
    }
  };

  const getAnnotationColor = (type: Annotation['type']) => {
    switch (type) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      case 'improvement': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAnnotationLabel = (type: Annotation['type']) => {
    switch (type) {
      case 'positive': return '好评';
      case 'negative': return '差评';
      case 'improvement': return '改进';
      default: return '标注';
    }
  };

  return (
    <>
      <Button
        variant={existingAnnotation ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-2.5 text-xs font-medium rounded-full transition-all duration-200",
          existingAnnotation ? getAnnotationColor(existingAnnotation.type) : "text-muted-foreground hover:bg-gray-100",
          className
        )}
        onClick={() => setShowAnnotationPanel(true)}
      >
        {existingAnnotation ? (
          <>
            {getAnnotationIcon(existingAnnotation.type)}
            <span className="ml-1.5">{getAnnotationLabel(existingAnnotation.type)}</span>
            {existingAnnotation.modifiedContent && (
              <div className="ml-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            )}
          </>
        ) : (
          <>
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="ml-1.5">标注</span>
          </>
        )}
      </Button>

      {showAnnotationPanel && (
        <AnnotationPanel
          messageId={messageId}
          originalContent={content}
          onSaveAnnotation={onSaveAnnotation}
          onClose={() => setShowAnnotationPanel(false)}
          existingAnnotation={existingAnnotation}
        />
      )}
    </>
  );
}