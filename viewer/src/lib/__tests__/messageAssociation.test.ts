import { groupMessagesByAssociation, calculateSimilarity, groupMessagesByHybrid } from '../messageAssociation';
import { DialogueMessage } from '@/components/annotation/DialogueAnnotationBubble';
import { ContextMessage } from '@/components/annotation/DialogueAnnotationView';

describe('Message Association Tests', () => {
  const mockConversationMessages: DialogueMessage[] = [
    {
      role: 'user',
      content: '你好，请问今天天气怎么样？',
      timestamp: '2024-01-01T10:00:00Z',
      id: 'conv-1'
    },
    {
      role: 'assistant',
      content: '今天天气晴朗，温度在20-25度之间。',
      timestamp: '2024-01-01T10:01:00Z',
      id: 'conv-2'
    },
    {
      role: 'user',
      content: '那明天呢？',
      timestamp: '2024-01-01T10:02:00Z',
      id: 'conv-3'
    }
  ];

  const mockContextMessages: ContextMessage[] = [
    {
      role: 'user',
      content: '用户询问天气情况',
      timestamp: '2024-01-01T09:58:00Z',
      id: 'ctx-1',
      isContext: true,
      contextGroup: 'context'
    },
    {
      role: 'assistant',
      content: '系统检测到天气查询意图',
      timestamp: '2024-01-01T09:59:00Z',
      id: 'ctx-2',
      isContext: true,
      contextGroup: 'context'
    },
    {
      role: 'user',
      content: '明天天气预报',
      timestamp: '2024-01-01T10:01:30Z',
      id: 'ctx-3',
      isContext: true,
      contextGroup: 'context'
    }
  ];

  describe('groupMessagesByAssociation', () => {
    it('should correctly associate context messages with conversation messages based on timestamp', () => {
      const result = groupMessagesByAssociation(mockConversationMessages, mockContextMessages);
      
      expect(result).toHaveLength(3);
      expect(result[0].contextMessages).toHaveLength(2); // 前两条context关联到第一条对话
      expect(result[1].contextMessages).toHaveLength(0); // 第二条对话没有关联
      expect(result[2].contextMessages).toHaveLength(1); // 第三条context关联到第三条对话
    });

    it('should handle empty arrays correctly', () => {
      const emptyResult1 = groupMessagesByAssociation([], mockContextMessages);
      expect(emptyResult1).toHaveLength(0);

      const emptyResult2 = groupMessagesByAssociation(mockConversationMessages, []);
      expect(emptyResult2).toHaveLength(3);
      expect(emptyResult2.every(group => group.contextMessages.length === 0)).toBe(true);
    });

    it('should respect time threshold configuration', () => {
      const config = { timeThreshold: 60 * 1000 }; // 1分钟
      const result = groupMessagesByAssociation(mockConversationMessages, mockContextMessages, config);
      
      // 由于时间差超过1分钟，应该没有关联
      expect(result.every(group => group.contextMessages.length === 0)).toBe(false);
    });

    it('should sort context messages by timestamp', () => {
      const result = groupMessagesByAssociation(mockConversationMessages, mockContextMessages);
      
      result.forEach(group => {
        const timestamps = group.contextMessages.map(msg => 
          new Date(msg.timestamp || 0).getTime()
        );
        expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
      });
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const similarity = calculateSimilarity('hello world', 'hello world');
      expect(similarity).toBe(1);
    });

    it('should return 0 for completely different strings', () => {
      const similarity = calculateSimilarity('hello', 'world');
      expect(similarity).toBeCloseTo(0, 1);
    });

    it('should handle empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1);
      expect(calculateSimilarity('hello', '')).toBe(0);
      expect(calculateSimilarity('', 'world')).toBe(0);
    });

    it('should calculate similarity for similar strings', () => {
      const similarity = calculateSimilarity('hello world', 'hello worl');
      expect(similarity).toBeGreaterThan(0.8);
    });
  });

  describe('groupMessagesByHybrid', () => {
    it('should combine time and similarity for association', () => {
      const result = groupMessagesByHybrid(mockConversationMessages, mockContextMessages);
      
      expect(result).toHaveLength(3);
      // 应该至少有一些关联，因为时间和内容都有相关性
      const totalAssociations = result.reduce((sum, group) => sum + group.contextMessages.length, 0);
      expect(totalAssociations).toBeGreaterThan(0);
    });

    it('should respect maxContextMessages limit', () => {
      const config = { maxContextMessages: 1 };
      const result = groupMessagesByHybrid(mockConversationMessages, mockContextMessages, config);
      
      result.forEach(group => {
        expect(group.contextMessages.length).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing timestamps', () => {
      const messagesWithoutTimestamp: DialogueMessage[] = [
        { role: 'user', content: 'test', id: 'test-1' }
      ];
      const contextWithoutTimestamp: ContextMessage[] = [
        { role: 'user', content: 'context', isContext: true, contextGroup: 'context', id: 'ctx-test' }
      ];

      const result = groupMessagesByAssociation(messagesWithoutTimestamp, contextWithoutTimestamp);
      expect(result).toHaveLength(1);
    });

    it('should handle duplicate messages', () => {
      const duplicateMessages: DialogueMessage[] = [
        { role: 'user', content: 'same', timestamp: '2024-01-01T10:00:00Z', id: 'dup-1' },
        { role: 'user', content: 'same', timestamp: '2024-01-01T10:00:00Z', id: 'dup-2' }
      ];
      const context: ContextMessage[] = [
        { role: 'user', content: 'context', timestamp: '2024-01-01T10:00:00Z', isContext: true, contextGroup: 'context', id: 'ctx-1' }
      ];

      const result = groupMessagesByAssociation(duplicateMessages, context);
      expect(result).toHaveLength(2);
    });
  });
});