// 测试页面 - 用于验证V2 API集成
import React from 'react';
import { runCompatibilityTests } from './test-v2-compatibility';

const TestAnnotationPage: React.FC = () => {
  const handleTest = () => {
    console.log('开始兼容性测试...');
    runCompatibilityTests();
    console.log('测试完成！');
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">V2 API 兼容性测试</h1>
      <div className="space-y-4">
        <button 
          onClick={handleTest}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          运行兼容性测试
        </button>
        
        <div className="border rounded p-4">
          <h2 className="text-lg font-semibold mb-2">测试说明</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>V1 API: 使用 original_data, sample_index, quality_score 等字段</li>
            <li>V2 API: 使用 original_content, line_number, quality_rating 等字段</li>
            <li>数据转换确保向后兼容性</li>
            <li>工作副本机制通过V2 API实现</li>
          </ul>
        </div>
        
        <div className="border rounded p-4">
          <h2 className="text-lg font-semibold mb-2">关键变更</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>API端点从 /annotations/ 改为 /v2/</li>
            <li>数据结构从 original_data → original_content</li>
            <li>edited_data → edited_content</li>
            <li>quality_score → quality_rating</li>
            <li>sample_index → line_number (从1开始)</li>
            <li>支持工作副本和多人协作</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestAnnotationPage;