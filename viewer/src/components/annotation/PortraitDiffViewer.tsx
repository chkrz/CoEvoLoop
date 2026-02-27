import React, { useState, useMemo } from 'react';
import { DiffResult, UserPortraitData, calculatePortraitDiff, getDiffStats } from '../../utils/diffUtils';
import DiffDisplay from './DiffDisplay';

interface PortraitDiffViewerProps {
  originalData: UserPortraitData;
  modifiedData: UserPortraitData;
  className?: string;
  showRealTime?: boolean;
  onDiffChange?: (diffs: DiffResult[]) => void;
}

interface FieldConfig {
  key: keyof UserPortraitData;
  label: string;
  type: 'text' | 'array' | 'object';
  description?: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'background_description',
    label: '背景描述',
    type: 'array',
    description: '用户的背景信息和上下文'
  },
  {
    key: 'knowledge_blind_spots',
    label: '知识盲区',
    type: 'array',
    description: '用户知识体系的空白区域'
  },
  {
    key: 'operation_history',
    label: '操作历史',
    type: 'object',
    description: '用户的操作记录和时间线'
  },
  {
    key: 'problem_description',
    label: '问题描述',
    type: 'array',
    description: '用户遇到的问题和挑战'
  }
];

const PortraitDiffViewer: React.FC<PortraitDiffViewerProps> = ({
  originalData,
  modifiedData,
  className = '',
  showRealTime = false,
  onDiffChange
}) => {
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'inline'>('summary');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const diffs = useMemo(() => {
    const calculatedDiffs = calculatePortraitDiff(originalData, modifiedData);
    if (onDiffChange) {
      onDiffChange(calculatedDiffs);
    }
    return calculatedDiffs;
  }, [originalData, modifiedData, onDiffChange]);

  const stats = useMemo(() => getDiffStats(diffs), [diffs]);

  const fieldDiffs = useMemo(() => {
    const grouped: Record<string, DiffResult[]> = {};
    for (const diff of diffs) {
      const field = diff.field;
      if (!grouped[field]) {
        grouped[field] = [];
      }
      grouped[field].push(diff);
    }
    return grouped;
  }, [diffs]);

  const renderFieldSummary = (field: FieldConfig) => {
    const fieldDiffsList = fieldDiffs[field.key] || [];
    const hasChanges = fieldDiffsList.some(diff => diff.type !== 'unchanged');

    if (!hasChanges && !showUnchanged) {
      return null;
    }

    return (
      <div key={field.key} className="border rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="font-medium text-gray-900">{field.label}</h4>
            {field.description && (
              <p className="text-sm text-gray-600">{field.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                有变化
              </span>
            )}
            <button
              onClick={() => setSelectedField(selectedField === field.key ? null : field.key)}
              className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              {selectedField === field.key ? '收起' : '展开'}
            </button>
          </div>
        </div>

        {selectedField === field.key && (
          <div className="mt-3 space-y-2">
            {renderFieldChanges(field, fieldDiffsList)}
          </div>
        )}
      </div>
    );
  };

  const renderFieldChanges = (field: FieldConfig, fieldDiffsList: DiffResult[]) => {
    const originalValue = originalData[field.key];
    const modifiedValue = modifiedData[field.key];

    if (field.type === 'array') {
      return renderArrayChanges(originalValue as string[], modifiedValue as string[], field.label);
    }

    if (field.type === 'object') {
      return renderObjectChanges(originalValue, modifiedValue, field.label);
    }

    return renderTextChanges(originalValue, modifiedValue, field.label);
  };

  const renderArrayChanges = (original: string[], modified: string[], fieldName: string) => {
    const maxLength = Math.max(original?.length || 0, modified?.length || 0);
    const changes = [];

    for (let i = 0; i < maxLength; i++) {
      const orig = original?.[i];
      const mod = modified?.[i];

      if (i >= (original?.length || 0)) {
        changes.push(
          <div key={i} className="flex items-start space-x-2">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
              + {mod}
            </span>
          </div>
        );
      } else if (i >= (modified?.length || 0)) {
        changes.push(
          <div key={i} className="flex items-start space-x-2">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm line-through">
              - {orig}
            </span>
          </div>
        );
      } else if (orig !== mod) {
        changes.push(
          <div key={i} className="flex items-start space-x-2">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <div className="flex-1 space-y-1">
              <div className="bg-red-50 p-2 rounded text-sm line-through">
                - {orig}
              </div>
              <div className="bg-green-50 p-2 rounded text-sm">
                + {mod}
              </div>
            </div>
          </div>
        );
      } else if (showUnchanged) {
        changes.push(
          <div key={i} className="flex items-start space-x-2 text-gray-600">
            <span className="text-xs text-gray-500 mt-1">[{i}]</span>
            <span className="text-sm">{orig}</span>
          </div>
        );
      }
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {changes}
      </div>
    );
  };

  const renderObjectChanges = (original: any, modified: any, fieldName: string) => {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">原始内容:</div>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-48">
              {JSON.stringify(original, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-600 mb-1">修改后内容:</div>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-48">
              {JSON.stringify(modified, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const renderTextChanges = (original: any, modified: any, fieldName: string) => {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">原始内容:</div>
          <div className="bg-red-50 p-3 rounded text-sm">
            {original || <span className="text-gray-400">空</span>}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-600 mb-1">修改后内容:</div>
          <div className="bg-green-50 p-3 rounded text-sm">
            {modified || <span className="text-gray-400">空</span>}
          </div>
        </div>
      </div>
    );
  };

  const renderSummary = () => {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h3 className="font-medium text-blue-900 mb-2">差异统计</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.added}</div>
            <div className="text-green-700">新增</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.removed}</div>
            <div className="text-red-700">删除</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.modified}</div>
            <div className="text-yellow-700">修改</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
            <div className="text-gray-700">总计</div>
          </div>
        </div>
      </div>
    );
  };

  const renderInlineView = () => {
    return (
      <DiffDisplay
        diffs={diffs}
        originalData={originalData}
        modifiedData={modifiedData}
        mode="inline"
        showUnchanged={showUnchanged}
      />
    );
  };

  if (diffs.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-green-600 text-4xl mb-2">✓</div>
        <div className="text-gray-600">无变化</div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          用户画像差异对比
          {showRealTime && (
            <span className="ml-2 text-sm text-green-600">(实时更新)</span>
          )}
        </h3>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">显示模式:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="summary">摘要模式</option>
              <option value="detailed">详细模式</option>
              <option value="inline">行内模式</option>
            </select>
          </div>
          
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
              className="rounded"
            />
            <span>显示未变化</span>
          </label>
        </div>
      </div>

      {viewMode === 'summary' && (
        <>
          {renderSummary()}
          <div>
            {FIELD_CONFIGS.map(field => renderFieldSummary(field))}
          </div>
        </>
      )}

      {viewMode === 'detailed' && (
        <DiffDisplay
          diffs={diffs}
          originalData={originalData}
          modifiedData={modifiedData}
          mode="detailed"
          showUnchanged={showUnchanged}
        />
      )}

      {viewMode === 'inline' && renderInlineView()}
    </div>
  );
};

export default PortraitDiffViewer;