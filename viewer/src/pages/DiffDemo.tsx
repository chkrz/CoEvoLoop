import React, { useState } from 'react';
import { DiffHighlight } from '@/components/annotation/DiffHighlight';
import { computeDiff, getDiffSummary } from '@/lib/diffUtils';

const DiffDemo: React.FC = () => {
  const [originalText, setOriginalText] = useState(
    '用户：你好，我想查询我的账户余额\n助手：您好！请问您的账户号码是多少？\n用户：我的账户是1234567890'
  );
  
  const [modifiedText, setModifiedText] = useState(
    '用户：你好，我想查询我的账户余额\n助手：您好！请问您的账户号码是多少？\n用户：我的账户是1234567890，请帮我查询一下'
  );
  
  const [showDiff, setShowDiff] = useState(true);

  const diff = computeDiff(originalText, modifiedText);
  const summary = getDiffSummary(originalText, modifiedText);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Diff功能演示</h1>
      
      <div className="mb-6">
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showDiff ? '隐藏差异' : '显示差异'}
        </button>
        <span className="ml-4 text-sm text-gray-600">
          快捷键: Ctrl+D 切换差异显示
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">原始文本</h2>
          <textarea
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            className="w-full h-32 p-3 border rounded-md font-mono text-sm"
            placeholder="输入原始文本..."
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">修改后文本</h2>
          <textarea
            value={modifiedText}
            onChange={(e) => setModifiedText(e.target.value)}
            className="w-full h-32 p-3 border rounded-md font-mono text-sm"
            placeholder="输入修改后文本..."
          />
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">差异统计</h2>
        <div className="flex gap-4 text-sm">
          <span>相似度: {(diff.similarity * 100).toFixed(1)}%</span>
          <span>变化数: {diff.changes}</span>
          <span>摘要: {summary}</span>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">差异显示</h2>
        <DiffHighlight
          original={originalText}
          modified={modifiedText}
          showDiff={showDiff}
          className="border rounded-md p-4 bg-gray-50"
        />
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-md">
        <h3 className="font-semibold mb-2">使用说明</h3>
        <ul className="text-sm space-y-1">
          <li>• 绿色背景：新增内容</li>
          <li>• 红色背景：删除内容</li>
          <li>• 黄色背景：修改内容</li>
          <li>• 支持大文本优化和缓存机制</li>
        </ul>
      </div>
    </div>
  );
};

export default DiffDemo;