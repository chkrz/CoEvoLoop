import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit3, Save, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EvaluationDiffFieldProps {
  fieldName: string;
  originalValue: string | number;
  editedValue: string | number;
  onValueChange: (newValue: string | number) => void;
  isEditing: boolean;
  onEditToggle: () => void;
  type?: 'text' | 'number' | 'score';
  maxScore?: number;
}

const EvaluationDiffField: React.FC<EvaluationDiffFieldProps> = ({
  fieldName,
  originalValue,
  editedValue,
  onValueChange,
  isEditing,
  onEditToggle,
  type = 'text',
  maxScore = 1,
}) => {
  const [localValue, setLocalValue] = useState(editedValue);

  // 计算差异
  const diffResult = useMemo(() => {
    // 如果editedValue为undefined或null，认为没有修改
    if (editedValue === undefined || editedValue === null) {
      return { hasChanges: false, displayValue: originalValue };
    }
    
    if (originalValue === editedValue) {
      return { hasChanges: false, displayValue: editedValue };
    }

    const originalStr = String(originalValue);
    const editedStr = String(editedValue);

    if (type === 'score') {
      return {
        hasChanges: true,
        displayValue: editedValue,
        originalScore: Number(originalValue),
        editedScore: Number(editedValue),
      };
    }

    // 文本差异高亮
    const isTextChanged = originalStr !== editedStr;
    return {
      hasChanges: isTextChanged,
      displayValue: editedValue,
      originalText: originalStr,
      editedText: editedStr,
    };
  }, [originalValue, editedValue, type]);

  const handleSave = () => {
    onValueChange(localValue);
    onEditToggle();
  };

  const handleCancel = () => {
    setLocalValue(editedValue);
    onEditToggle();
  };

  const handleReset = () => {
    setLocalValue(originalValue);
    onValueChange(originalValue);
  };

  const renderScoreStars = (score: number, maxScore: number) => {
    const starCount = 5;
    const normalizedScore = (score / maxScore) * starCount;
    
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <div
            key={star}
            className={`w-4 h-4 rounded-full ${
              star <= normalizedScore ? 'bg-yellow-400' : 'bg-gray-300'
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {score}/{maxScore}
        </span>
      </div>
    );
  };

  const renderDiffContent = () => {
    if (!diffResult.hasChanges) {
      return (
        <div className="text-sm text-gray-700">
          {type === 'score' ? (
            renderScoreStars(Number(originalValue), maxScore)
          ) : (
            <span>{originalValue || '无内容'}</span>
          )}
        </div>
      );
    }

    if (type === 'score') {
      return (
        <div className="space-y-2">
          <div className="text-sm">
            <span className="text-gray-500">原始: </span>
            <span className="line-through text-red-600">
              {renderScoreStars(diffResult.originalScore!, maxScore)}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">修改: </span>
            <span className="text-green-600 font-medium">
              {renderScoreStars(diffResult.editedScore!, maxScore)}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-gray-500">原始: </span>
          <span className="line-through text-red-600 bg-red-50 px-1 rounded">
            {diffResult.originalText}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-gray-500">修改: </span>
          <span className="text-green-600 bg-green-50 px-1 rounded font-medium">
            {diffResult.editedText}
          </span>
        </div>
      </div>
    );
  };

  const renderEditor = () => {
    if (type === 'score') {
      return (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((score) => (
              <Button
                key={score}
                size="sm"
                variant={localValue === score ? "default" : "outline"}
                onClick={() => setLocalValue(score)}
                className="px-2 py-1 text-xs"
              >
                {score}
              </Button>
            ))}
          </div>
          <div className="text-xs text-gray-500">
            当前选择: {localValue}/{maxScore}
          </div>
        </div>
      );
    }

    if (type === 'number') {
      return (
        <Input
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(Number(e.target.value))}
          className="text-sm"
          step="0.1"
          min="0"
          max={maxScore}
        />
      );
    }

    return (
      <Textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="text-sm min-h-[60px]"
        placeholder={`输入${fieldName}...`}
      />
    );
  };

  return (
    <Card className={cn(
      "p-4 transition-all",
      isEditing && "ring-2 ring-blue-500",
      diffResult.hasChanges && !isEditing && "border-l-4 border-l-yellow-400"
    )}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2">
          <h4 className="text-sm font-medium">{fieldName}</h4>
          {diffResult.hasChanges && (
            <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">
              已修改
            </Badge>
          )}
        </div>
        <div className="flex space-x-1">
          {!isEditing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={onEditToggle}
                className="h-7 px-2"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              {diffResult.hasChanges && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleReset}
                  className="h-7 px-2"
                  title="撤销修改"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSave}
                className="h-7 px-2 text-green-600 hover:text-green-700"
              >
                <Save className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="h-7 px-2 text-red-600 hover:text-red-700"
              >
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {renderEditor()}
          <div className="text-xs text-gray-500">
            原始值: {String(originalValue)}
          </div>
        </div>
      ) : (
        renderDiffContent()
      )}
    </Card>
  );
};

export default EvaluationDiffField;