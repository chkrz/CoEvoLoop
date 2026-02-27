// 测试对话标注组件的示例数据
import { DialogueMessage } from './DialogueAnnotationBubble';
import { SystemMessage } from './SystemContextPanel';

// 示例对话数据
export const sampleDialogueData = {
  conversation: [
    {
      role: 'system' as const,
      content: '你是一个专业的客服助手，请帮助用户解决账户相关问题。',
      timestamp: '2024-01-15T10:00:00Z',
      id: 'sys-1'
    },
    {
      role: 'user' as const,
      content: '你好，我想查询我的账户余额。',
      timestamp: '2024-01-15T10:01:00Z',
      id: 'user-1'
    },
    {
      role: 'assistant' as const,
      content: '您好！我可以帮您查询账户余额。请问您的账户号码是多少？',
      timestamp: '2024-01-15T10:01:30Z',
      id: 'assistant-1'
    },
    {
      role: 'user' as const,
      content: '我的账户号码是 1234567890',
      timestamp: '2024-01-15T10:02:00Z',
      id: 'user-2'
    },
    {
      role: 'assistant' as const,
      content: '好的，我已经为您查询到账户余额。您的当前余额为：¥5,280.50',
      timestamp: '2024-01-15T10:02:15Z',
      id: 'assistant-2'
    }
  ],
  systemContext: [
    {
      role: 'system' as const,
      content: '系统提示：请确保在查询账户信息时验证用户身份，不要泄露敏感信息。',
      timestamp: '2024-01-15T09:59:00Z',
      id: 'sys-context-1'
    }
  ]
};

// 测试用例
export const testCases = {
  // 测试空数据
  emptyData: {
    conversation: [],
    systemContext: []
  },
  
  // 测试只有系统消息
  systemOnly: {
    conversation: [],
    systemContext: [
      {
        role: 'system' as const,
        content: '系统初始化完成',
        timestamp: '2024-01-15T09:00:00Z'
      }
    ]
  },
  
  // 测试只有对话
  conversationOnly: {
    conversation: [
      {
        role: 'user' as const,
        content: '测试消息',
        timestamp: '2024-01-15T10:00:00Z'
      }
    ],
    systemContext: []
  },
  
  // 测试长消息
  longMessages: {
    conversation: [
      {
        role: 'user' as const,
        content: '这是一条非常长的测试消息，用于测试消息气泡在显示长文本时的表现。这条消息包含了多个段落和换行符，\n\n第二段开始，这里继续添加更多的文本内容，确保能够测试到各种边界情况。',
        timestamp: '2024-01-15T10:00:00Z'
      }
    ],
    systemContext: []
  }
};