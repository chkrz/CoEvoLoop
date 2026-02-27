import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EnhancedContextInlinePanel } from './EnhancedContextInlinePanel';
import { ContextMessage } from './DialogueAnnotationView';

const meta: Meta<typeof EnhancedContextInlinePanel> = {
  title: 'Components/EnhancedContextInlinePanel',
  component: EnhancedContextInlinePanel,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl mx-auto p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// 模拟数据
const mockMessages: ContextMessage[] = [
  {
    id: '1',
    role: 'user',
    content: '你好，我想了解一下人工智能在医疗领域的应用。\n\n特别是关于诊断辅助系统的最新进展。',
    timestamp: new Date('2024-01-15T10:30:00').toISOString(),
  },
  {
    id: '2',
    role: 'assistant',
    content: '您好！人工智能在医疗领域的应用确实非常广泛，特别是在诊断辅助方面。\n\n最新的进展包括：\n1. 医学影像AI诊断系统\n2. 智能问诊系统\n3. 药物研发辅助\n4. 个性化治疗方案推荐',
    timestamp: new Date('2024-01-15T10:31:00').toISOString(),
  },
  {
    id: '3',
    role: 'user',
    content: '这些技术在实际医院中的应用情况如何？有哪些成功案例？',
    timestamp: new Date('2024-01-15T10:32:00').toISOString(),
  },
  {
    id: '4',
    role: 'assistant',
    content: '在实际应用中，AI医疗诊断系统已经取得了显著成效：\n\n🏥 成功案例：\n- 某三甲医院使用AI影像诊断系统，肺结节检出率提升35%\n- 智能问诊系统减少患者等待时间60%\n- AI辅助药物发现缩短研发周期40%',
    timestamp: new Date('2024-01-15T10:33:00').toISOString(),
  },
];

// 基础示例
export const Default: Story = {
  args: {
    contextMessages: mockMessages,
    isExpanded: true,
    onToggle: () => {},
    onEdit: (index: number, content: string) => {
      console.log(`编辑消息 ${index}:`, content);
    },
  },
};

// 收起状态
export const Collapsed: Story = {
  args: {
    ...Default.args,
    isExpanded: false,
  },
};

// 空状态
export const Empty: Story = {
  args: {
    contextMessages: [],
    isExpanded: true,
    onToggle: () => {},
    onEdit: () => {},
  },
};

// 单条消息
export const SingleMessage: Story = {
  args: {
    contextMessages: [mockMessages[0]],
    isExpanded: true,
    onToggle: () => {},
    onEdit: () => {},
  },
};

// 长消息内容
export const LongMessages: Story = {
  args: {
    contextMessages: [
      {
        id: '1',
        role: 'user',
        content: `这是一个很长的用户消息，用于测试组件在处理大量文本时的表现。

包含多个段落：
第一段：介绍背景信息，说明用户的需求和期望。

第二段：详细描述具体的使用场景，包括各种技术细节和要求。

第三段：总结用户的期望结果，以及对系统性能的要求。

这是一个很长的用户消息，用于测试组件在处理大量文本时的表现。包含多个段落，每个段落都有特定的格式和内容。`,
        timestamp: new Date('2024-01-15T10:30:00').toISOString(),
      },
      {
        id: '2',
        role: 'assistant',
        content: `这是一个很长的AI回复消息，同样用于测试组件在处理大量文本时的表现。

回复结构：
1. 首先确认理解用户需求
2. 然后提供详细的解决方案
3. 最后给出实施建议

技术细节：
- 使用最新的React技术栈
- 集成TypeScript提供类型安全
- 采用Tailwind CSS实现响应式设计
- 使用Framer Motion添加动画效果

总结：
这个回复展示了组件如何处理长文本内容，包括格式化和可读性方面的考虑。`,
        timestamp: new Date('2024-01-15T10:31:00').toISOString(),
      },
    ],
    isExpanded: true,
    onToggle: () => {},
    onEdit: () => {},
  },
};

// 交互式示例
const InteractiveExample: React.FC = () => {
  const [messages, setMessages] = useState<ContextMessage[]>(mockMessages);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleEdit = (index: number, content: string) => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], content };
    setMessages(newMessages);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        <p>💡 交互提示：</p>
        <ul className="list-disc list-inside ml-4">
          <li>双击消息内容直接编辑</li>
          <li>按 Escape 取消编辑</li>
          <li>按 Ctrl+Enter 保存编辑</li>
          <li>悬停显示操作按钮</li>
          <li>点击复制按钮复制消息</li>
        </ul>
      </div>
      
      <EnhancedContextInlinePanel
        contextMessages={messages}
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        onEdit={handleEdit}
      />
    </div>
  );
};

export const Interactive: Story = {
  render: () => <InteractiveExample />,
};

// 移动端视图
export const MobileView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  args: {
    ...Default.args,
  },
};

// 平板视图
export const TabletView: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
  args: {
    ...Default.args,
  },
};