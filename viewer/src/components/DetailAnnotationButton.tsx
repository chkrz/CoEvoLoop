import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnnotationPanel, Annotation } from "./AnnotationPanel";
import { MessageSquare, Brain, Star, Edit3, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailAnnotationButtonProps {
  contentId: string;
  content: string;
  title: string;
  type: 'planner' | 'score';
  onSaveAnnotation: (annotation: Annotation) => void;
  annotations: Record<string, Annotation>;
  className?: string;
}

export function DetailAnnotationButton({ 
  contentId, 
  content, 
  title,
  type,
  onSaveAnnotation, 
  annotations,
  className 
}: DetailAnnotationButtonProps) {
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false);
  const existingAnnotation = annotations[contentId];

  const getTypeIcon = (annotationType: Annotation['type']) => {
    switch (annotationType) {
      case 'positive': return <ThumbsUp className="w-3 h-3" />;
      case 'negative': return <ThumbsDown className="w-3 h-3" />;
      case 'improvement': return <Edit3 className="w-3 h-3" />;
      default: return <MessageSquare className="w-3 h-3" />;
    }
  };

  const getTypeColor = (annotationType: Annotation['type']) => {
    switch (annotationType) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      case 'improvement': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeLabel = (annotationType: Annotation['type']) => {
    switch (annotationType) {
      case 'positive': return '好评';
      case 'negative': return '差评';
      case 'improvement': return '改进';
      default: return '备注';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'planner': return <Brain className="w-3 h-3" />;
      case 'score': return <Star className="w-3 h-3" />;
      default: return <MessageSquare className="w-3 h-3" />;
    }
  };

  return (
    <>
      <Button
        variant={existingAnnotation ? "default" : "ghost"}
        size="sm"
        className={cn(
          "h-7 px-2.5 text-xs font-medium rounded-full transition-all duration-200",
          existingAnnotation ? getTypeColor(existingAnnotation.type) : "text-muted-foreground hover:bg-gray-100",
          className
        )}
        onClick={() => setShowAnnotationPanel(true)}
      >
        {existingAnnotation ? (
          <>
            {getTypeIcon(existingAnnotation.type)}
            <span className="ml-1.5">{getTypeLabel(existingAnnotation.type)}</span>
            {existingAnnotation.modifiedContent && (
              <div className="ml-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            )}
          </>
        ) : (
          <>
            {getIcon()}
            <span className="ml-1.5">标注</span>
          </>
        )}
      </Button>

      {showAnnotationPanel && (
        <AnnotationPanel
          messageId={contentId}
          originalContent={content}
          onSaveAnnotation={onSaveAnnotation}
          onClose={() => setShowAnnotationPanel(false)}
          existingAnnotation={existingAnnotation}
        />
      )}
    </>
  );
}