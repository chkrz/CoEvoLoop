import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit3, RotateCcw, EyeOff, Check, X, ArrowLeftRight } from 'lucide-react';
import EvaluationDiffField from './EvaluationDiffField';
import EvaluationScoreEditor from './EvaluationScoreEditor';

interface EvaluationDiffViewerProps {
  originalData: Record<string, any>;
  editedData: Record<string, any>;
  onDataChange: (fieldName: string, newValue: string | number) => void;
  onResetAll: () => void;
}

// 深度比较两个值是否相等
const isEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => isEqual(item, b[index]));
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => isEqual(a[key], b[key]));
};

const EvaluationDiffViewer: React.FC<EvaluationDiffViewerProps> = ({
  originalData,
  editedData,
  onDataChange,
  onResetAll,
}) => {
  const [isEditingMode, setIsEditingMode] = useState(true);
  const [activeEditField, setActiveEditField] = useState<string | null>(null);
  const [showOriginalValues, setShowOriginalValues] = useState(true);
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  const changeSummary = useMemo(() => {
    // 过滤掉undefined值的editedData
    const filteredEditedData = Object.fromEntries(
      Object.entries(editedData).filter(([_, value]) => value !== undefined)
    );
    
    // 如果filteredEditedData为空对象，认为没有变更
    const hasEditedContent = Object.keys(filteredEditedData).length > 0;
    if (!hasEditedContent) {
      return {
        totalFields: Object.keys(originalData).length,
        changedFields: 0,
        additions: [],
        deletions: [],
        modifications: [],
        additionsCount: 0,
        deletionsCount: 0,
        modificationsCount: 0,
      };
    }

    const allKeys = new Set([...Object.keys(originalData), ...Object.keys(filteredEditedData)]);
    const additions = [];
    const deletions = [];
    const modifications = [];

    for (const key of allKeys) {
      const hasOriginal = key in originalData;
      const hasEdited = key in filteredEditedData;
      const originalVal = originalData[key];
      const editedVal = filteredEditedData[key];
      const valuesEqual = isEqual(originalVal, editedVal);

      if (!hasOriginal && hasEdited) {
        additions.push(key);
      } else if (hasOriginal && !hasEdited) {
        deletions.push(key);
      } else if (hasOriginal && hasEdited && !valuesEqual) {
        modifications.push(key);
      }
    }

    return {
      totalFields: allKeys.size,
      changedFields: additions.length + deletions.length + modifications.length,
      additions,
      deletions,
      modifications,
      additionsCount: additions.length,
      deletionsCount: deletions.length,
      modificationsCount: modifications.length,
    };
  }, [originalData, editedData]);

  const hasChanges = changeSummary.changedFields > 0 && Object.keys(editedData).length > 0;
  const displayFields = useMemo(() => {
    // 过滤掉undefined值的editedData
    const filteredEditedData = Object.fromEntries(
      Object.entries(editedData).filter(([_, value]) => value !== undefined)
    );
    
    // 如果filteredEditedData为空，只显示originalData的字段
    const hasEditedContent = Object.keys(filteredEditedData).length > 0;
    if (!hasEditedContent) {
      return Object.keys(originalData);
    }

    const allKeys = new Set([...Object.keys(originalData), ...Object.keys(filteredEditedData)]);
    
    if (showOnlyChanges) {
      return [
        ...changeSummary.additions,
        ...changeSummary.deletions,
        ...changeSummary.modifications
      ];
    }
    
    return Array.from(allKeys);
  }, [originalData, editedData, showOnlyChanges, changeSummary]);

  const handleFieldEditToggle = (fieldName: string) => {
    if (activeEditField === fieldName) {
      setActiveEditField(null);
    } else {
      setActiveEditField(fieldName);
    }
  };

  const handleFieldChange = (fieldName: string, newValue: string | number) => {
    onDataChange(fieldName, newValue);
  };

  const handleResetField = (fieldName: string) => {
    onDataChange(fieldName, originalData[fieldName]);
  };

  const renderField = (key: string, value: any) => {
    const isScoreField = typeof originalData[key] === 'number' && key.toLowerCase().includes('score');
    const isEditingThisField = activeEditField === key;
    
    const hasOriginal = key in originalData;
    const editedValue = editedData[key];
    const hasEdited = key in editedData && editedValue !== undefined;
    const valuesEqual = isEqual(originalData[key], editedValue);
    
    let changeType: 'addition' | 'deletion' | 'modification' | 'none' = 'none';
    const filteredEditedData = Object.fromEntries(
      Object.entries(editedData).filter(([_, v]) => v !== undefined)
    );
    const hasEditedContent = Object.keys(filteredEditedData).length > 0;
    
    // 只有当有编辑内容时才计算变更类型
    if (hasEditedContent) {
      if (!hasOriginal && hasEdited) {
        changeType = 'addition';
      } else if (hasOriginal && !hasEdited) {
        changeType = 'deletion';
      } else if (hasOriginal && hasEdited && !valuesEqual) {
        changeType = 'modification';
      }
    }

    if (isEditingMode) {
      return (
        <EvaluationDiffField
          key={key}
          fieldName={key}
          originalValue={originalData[key]}
          editedValue={editedData[key]}
          onValueChange={(newValue) => handleFieldChange(key, newValue)}
          isEditing={isEditingThisField}
          onEditToggle={() => handleFieldEditToggle(key)}
          type={isScoreField ? 'score' : typeof value === 'number' ? 'number' : 'text'}
          maxScore={1}
          changeType={changeType}
        />
      );
    }

    // 只读模式下的展示
    const borderColor = {
      addition: 'border-l-4 border-l-green-400 bg-green-50',
      deletion: 'border-l-4 border-l-red-400 bg-red-50',
      modification: 'border-l-4 border-l-yellow-400 bg-yellow-50',
      none: ''
    }[changeType];

    const badgeColor = {
      addition: 'bg-green-100 text-green-800',
      deletion: 'bg-red-100 text-red-800',
      modification: 'bg-yellow-100 text-yellow-800',
      none: ''
    }[changeType];

    const badgeText = {
      addition: '新增',
      deletion: '删除',
      modification: '修改',
      none: ''
    }[changeType];

    return (
      <Card key={key} className={`p-3 ${borderColor}`}>
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</h4>
          <div className="flex items-center space-x-2">
            {changeType !== 'none' && (
              <Badge variant="outline" className={`text-xs ${badgeColor}`}>
                {badgeText}
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleResetField(key)}
              className="h-6 px-2"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </div>
        
        <div className="space-y-2">
          {showOriginalValues && hasOriginal && changeType !== 'addition' && (
            <div className="text-xs">
              <div className="flex items-center mb-1">
                <ArrowLeftRight className="w-3 h-3 text-gray-400 mr-1" />
                <span className="text-gray-500 font-medium">原始值:</span>
              </div>
              <div className={`${changeType === 'modification' ? 'line-through text-red-600' : 'text-gray-600'}`}>
                {isScoreField ? (
                  <EvaluationScoreEditor
                    value={originalData[key]}
                    onChange={() => {}}
                    disabled
                    size="sm"
                    showValue={true}
                  />
                ) : (
                  <span className="font-mono text-xs">
                    {String(originalData[key])}
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="text-sm">
            <div className="flex items-center mb-1">
              <span className="text-gray-500 font-medium">
                {changeType === 'addition' ? '新增值:' : '当前值:'}
              </span>
            </div>
            {isScoreField ? (
              <EvaluationScoreEditor
                value={editedData[key]}
                onChange={() => {}}
                disabled
                size="sm"
                showValue={true}
              />
            ) : (
              <span className={`font-mono text-xs ${
                changeType === 'modification' ? 'text-green-600 font-semibold' : 
                changeType === 'addition' ? 'text-green-600' : 
                changeType === 'deletion' ? 'text-red-600 line-through' : ''
              }`}>
                {String(editedData[key] ?? 'N/A')}
              </span>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>

        
        <CardContent>
          <div className="space-y-3">
            {displayFields.map(key => renderField(key, editedData[key]))}
          </div>
          
          {displayFields.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              {showOnlyChanges ? '暂无变更数据' : '暂无评估数据'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EvaluationDiffViewer;