import React, { useState, useMemo } from 'react';
import { DiffResult, TextDiff, ArrayDiff } from '../../utils/diffUtils';

interface DiffDisplayProps {
  diffs: DiffResult[];
  originalData: any;
  modifiedData: any;
  mode?: 'inline' | 'side-by-side' | 'compact';
  showUnchanged?: boolean;
  className?: string;
}

interface TextDiffDisplayProps {
  textDiffs: TextDiff[];
  className?: string;
}

interface ArrayDiffDisplayProps {
  arrayDiffs: ArrayDiff[];
  fieldName: string;
  className?: string;
}

const TextDiffDisplay: React.FC<TextDiffDisplayProps> = ({ textDiffs, className = '' }) => {
  return (
    <span className={`inline ${className}`}>
      {textDiffs.map((diff, index) => {
        if (diff.type === 'added') {
          return (
            <span
              key={index}
              className="bg-green-100 text-green-800 px-1 rounded"
              title="新增内容"
            >
              {diff.text}
            </span>
          );
        } else if (diff.type === 'removed') {
          return (
            <span
              key={index}
              className="bg-red-100 text-red-800 px-1 rounded line-through"
              title="删除内容"
            >
              {diff.text}
            </span>
          );
        } else {
          return <span key={index}>{diff.text}</span>;
        }
      })}
    </span>
  );
};

const ArrayDiffDisplay: React.FC<ArrayDiffDisplayProps> = ({ arrayDiffs, fieldName, className = '' }) => {
  const [expanded, setExpanded] = useState(false);
  const changedItems = arrayDiffs.filter(diff => diff.type !== 'unchanged');
  
  if (changedItems.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        无变化 ({arrayDiffs.length} 项)
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div 
        className="flex items-center cursor-pointer text-sm text-blue-600 hover:text-blue-800"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="mr-1">
          {expanded ? '▼' : '▶'}
        </span>
        {changedItems.length} 项变化 (共 {arrayDiffs.length} 项)
      </div>
      
      {expanded && (
        <div className="mt-2 space-y-1 pl-4 border-l-2 border-gray-200">
          {arrayDiffs.map((diff, index) => {
            if (diff.type === 'unchanged' && changedItems.length > 0) return null;
            
            return (
              <div key={index} className="text-sm">
                <span className="font-medium">[{diff.index}]</span>
                {diff.type === 'added' && (
                  <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded">
                    + {JSON.stringify(diff.modified)}
                  </span>
                )}
                {diff.type === 'removed' && (
                  <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded line-through">
                    - {JSON.stringify(diff.original)}
                  </span>
                )}
                {diff.type === 'modified' && (
                  <div className="ml-2">
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded line-through mr-2">
                      - {JSON.stringify(diff.original)}
                    </span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                      + {JSON.stringify(diff.modified)}
                    </span>
                    {diff.textDiff && (
                      <div className="mt-1">
                        <TextDiffDisplay textDiffs={diff.textDiff} />
                      </div>
                    )}
                  </div>
                )}
                {diff.type === 'unchanged' && (
                  <span className="ml-2 text-gray-600">
                    {JSON.stringify(diff.original)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const DiffDisplay: React.FC<DiffDisplayProps> = ({
  diffs,
  originalData,
  modifiedData,
  mode = 'inline',
  showUnchanged = false,
  className = ''
}) => {
  const [selectedField, setSelectedField] = useState<string | null>(null);
  
  const visibleDiffs = useMemo(() => {
    return showUnchanged ? diffs : diffs.filter(diff => diff.type !== 'unchanged');
  }, [diffs, showUnchanged]);

  const groupedDiffs = useMemo(() => {
    const groups: Record<string, DiffResult[]> = {};
    for (const diff of visibleDiffs) {
      if (!groups[diff.field]) {
        groups[diff.field] = [];
      }
      groups[diff.field].push(diff);
    }
    return groups;
  }, [visibleDiffs]);

  const renderFieldDiff = (fieldName: string, fieldDiffs: DiffResult[]) => {
    const diff = fieldDiffs[0]; // 每个字段通常只有一个差异
    
    if (mode === 'compact') {
      return (
        <div key={fieldName} className="text-sm">
          <span className="font-medium">{fieldName}:</span>
          {diff.type === 'added' && (
            <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded">
              +新增
            </span>
          )}
          {diff.type === 'removed' && (
            <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded">
              -删除
            </span>
          )}
          {diff.type === 'modified' && (
            <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              ~修改
            </span>
          )}
        </div>
      );
    }

    return (
      <div key={fieldName} className="border rounded-lg p-3 mb-3">
        <div 
          className="font-medium text-gray-700 mb-2 cursor-pointer hover:text-blue-600"
          onClick={() => setSelectedField(selectedField === fieldName ? null : fieldName)}
        >
          {fieldName}
          <span className="ml-2 text-xs text-gray-500">
            {selectedField === fieldName ? '▼' : '▶'}
          </span>
        </div>
        
        {selectedField === fieldName && (
          <div className="space-y-2">
            {diff.type === 'added' && (
              <div>
                <div className="text-sm text-gray-600 mb-1">新增内容:</div>
                <div className="bg-green-50 p-2 rounded text-sm">
                  {typeof diff.modified === 'string' ? diff.modified : JSON.stringify(diff.modified, null, 2)}
                </div>
              </div>
            )}
            
            {diff.type === 'removed' && (
              <div>
                <div className="text-sm text-gray-600 mb-1">删除内容:</div>
                <div className="bg-red-50 p-2 rounded text-sm line-through">
                  {typeof diff.original === 'string' ? diff.original : JSON.stringify(diff.original, null, 2)}
                </div>
              </div>
            )}
            
            {diff.type === 'modified' && (
              <div className="space-y-2">
                <div>
                  <div className="text-sm text-gray-600 mb-1">原始内容:</div>
                  <div className="bg-red-50 p-2 rounded text-sm">
                    {typeof diff.original === 'string' ? (
                      diff.textDiff ? (
                        <TextDiffDisplay textDiffs={diff.textDiff} />
                      ) : (
                        diff.original
                      )
                    ) : (
                      JSON.stringify(diff.original, null, 2)
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-gray-600 mb-1">修改后内容:</div>
                  <div className="bg-green-50 p-2 rounded text-sm">
                    {typeof diff.modified === 'string' ? (
                      diff.textDiff ? (
                        <TextDiffDisplay textDiffs={diff.textDiff} />
                      ) : (
                        diff.modified
                      )
                    ) : (
                      JSON.stringify(diff.modified, null, 2)
                    )}
                  </div>
                </div>
                
                {diff.arrayDiff && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">数组变化:</div>
                    <ArrayDiffDisplay 
                      arrayDiffs={diff.arrayDiff} 
                      fieldName={fieldName}
                    />
                  </div>
                )}
              </div>
            )}
            
            {diff.type === 'unchanged' && (
              <div>
                <div className="text-sm text-gray-600 mb-1">内容:</div>
                <div className="bg-gray-50 p-2 rounded text-sm">
                  {typeof diff.original === 'string' ? diff.original : JSON.stringify(diff.original, null, 2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (visibleDiffs.length === 0) {
    return (
      <div className={`text-center text-gray-500 py-8 ${className}`}>
        <div className="text-lg mb-2">✓</div>
        <div>无变化</div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          共 {visibleDiffs.length} 项变化
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setSelectedField(null)}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            全部收起
          </button>
          <button
            onClick={() => setSelectedField('all')}
            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
          >
            全部展开
          </button>
        </div>
      </div>
      
      <div>
        {Object.entries(groupedDiffs).map(([fieldName, fieldDiffs]) => 
          renderFieldDiff(fieldName, fieldDiffs)
        )}
      </div>
    </div>
  );
};

export default DiffDisplay;