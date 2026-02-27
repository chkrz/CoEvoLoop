import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvaluationScoreEditorProps {
  value: number;
  onChange: (value: number) => void;
  maxScore?: number;
  starCount?: number;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

const EvaluationScoreEditor: React.FC<EvaluationScoreEditorProps> = ({
  value,
  onChange,
  maxScore = 1,
  starCount = 5,
  label,
  disabled = false,
  size = 'md',
  showValue = true,
}) => {
  const normalizedValue = (value / maxScore) * starCount;

  const handleStarClick = (starIndex: number) => {
    if (disabled) return;
    
    const newValue = (starIndex / starCount) * maxScore;
    onChange(Math.round(newValue * 100) / 100); // 保留两位小数
  };

  const getStarSize = () => {
    switch (size) {
      case 'sm': return 'w-4 h-4';
      case 'md': return 'w-5 h-5';
      case 'lg': return 'w-6 h-6';
      default: return 'w-5 h-5';
    }
  };

  const getValueSize = () => {
    switch (size) {
      case 'sm': return 'text-xs';
      case 'md': return 'text-sm';
      case 'lg': return 'text-base';
      default: return 'text-sm';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {label && (
        <span className={cn("text-gray-700", getValueSize())}>
          {label}:
        </span>
      )}
      
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              getStarSize(),
              'cursor-pointer transition-colors',
              star <= normalizedValue
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 hover:text-gray-400',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            onClick={() => handleStarClick(star)}
          />
        ))}
        
        {showValue && (
          <span className={cn(
            "ml-2 font-medium text-gray-700",
            getValueSize()
          )}>
            {value.toFixed(2)}/{maxScore}
          </span>
        )}
      </div>
    </div>
  );
};

export default EvaluationScoreEditor;