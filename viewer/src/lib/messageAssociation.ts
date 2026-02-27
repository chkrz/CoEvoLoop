import { DialogueMessage } from '@/components/annotation/DialogueAnnotationBubble';
import { ContextMessage } from '@/components/annotation/DialogueAnnotationView';

export interface MessageGroup {
  conversationMessage: DialogueMessage;
  contextMessages: ContextMessage[];
  isExpanded: boolean;
}

export interface AssociationConfig {
  timeThreshold?: number; // 时间阈值（毫秒），默认5分钟
  similarityThreshold?: number; // 内容相似度阈值，默认0.8
  maxContextMessages?: number; // 每个对话消息最多关联的context消息数量，默认10
}

/**
 * 根据消息顺序将context消息与对话消息一一对应关联
 * @param conversationMessages 对话消息数组
 * @param contextMessages context消息数组
 * @param config 关联配置（不再使用，保留参数以保持兼容性）
 * @returns 关联后的消息分组
 */
export function groupMessagesByAssociation(
  conversationMessages: DialogueMessage[],
  contextMessages: ContextMessage[],
  config: AssociationConfig = {}
): MessageGroup[] {
  if (!conversationMessages.length) {
    return conversationMessages.map(msg => ({
      conversationMessage: msg,
      contextMessages: [],
      isExpanded: false
    }));
  }

  // 创建消息分组，保持原始顺序
  const messageGroups: MessageGroup[] = conversationMessages.map(msg => ({
    conversationMessage: msg,
    contextMessages: [],
    isExpanded: false
  }));

  // 按消息顺序一一对应关联context消息
  if (contextMessages.length > 0) {
    contextMessages.forEach((contextMsg, index) => {
      if (index < messageGroups.length) {
        messageGroups[index].contextMessages.push(contextMsg);
      }
    });
  }

  return messageGroups;
}

/**
 * 计算两个字符串的相似度（使用简单的编辑距离算法）
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 相似度（0-1之间）
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / parseFloat(longer.length.toString());
}

/**
 * 计算两个字符串的编辑距离（Levenshtein距离）
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 编辑距离
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 基于内容相似度进行智能匹配
 * @param conversationMessages 对话消息数组
 * @param contextMessages context消息数组
 * @param config 关联配置
 * @returns 关联后的消息分组
 */
export function groupMessagesBySimilarity(
  conversationMessages: DialogueMessage[],
  contextMessages: ContextMessage[],
  config: AssociationConfig = {}
): MessageGroup[] {
  const { similarityThreshold = 0.8, maxContextMessages = 5 } = config;

  if (!conversationMessages.length || !contextMessages.length) {
    return conversationMessages.map(msg => ({
      conversationMessage: msg,
      contextMessages: [],
      isExpanded: false
    }));
  }

  const messageGroups: MessageGroup[] = conversationMessages.map(msg => ({
    conversationMessage: msg,
    contextMessages: [],
    isExpanded: false
  }));

  // 为每个context消息找到最相似的对话消息
  contextMessages.forEach(contextMsg => {
    let bestMatch: MessageGroup | null = null;
    let maxSimilarity = 0;

    messageGroups.forEach(group => {
      const similarity = calculateSimilarity(
        contextMsg.content,
        group.conversationMessage.content
      );
      
      if (similarity > maxSimilarity && similarity >= similarityThreshold) {
        maxSimilarity = similarity;
        bestMatch = group;
      }
    });

    // 如果找到相似的对话消息，且未达到最大关联数量限制
    if (bestMatch && bestMatch.contextMessages.length < maxContextMessages) {
      bestMatch.contextMessages.push(contextMsg);
    }
  });

  return messageGroups;
}

/**
 * 混合模式：结合时间戳和内容相似度进行关联
 * @param conversationMessages 对话消息数组
 * @param contextMessages context消息数组
 * @param config 关联配置
 * @returns 关联后的消息分组
 */
export function groupMessagesByHybrid(
  conversationMessages: DialogueMessage[],
  contextMessages: ContextMessage[],
  config: AssociationConfig = {}
): MessageGroup[] {
  const {
    timeThreshold = 5 * 60 * 1000,
    similarityThreshold = 0.7,
    maxContextMessages = 5
  } = config;

  if (!conversationMessages.length || !contextMessages.length) {
    return conversationMessages.map(msg => ({
      conversationMessage: msg,
      contextMessages: [],
      isExpanded: false
    }));
  }

  const messageGroups: MessageGroup[] = conversationMessages.map(msg => ({
    conversationMessage: msg,
    contextMessages: [],
    isExpanded: false
  }));

  contextMessages.forEach(contextMsg => {
    const contextTime = new Date(contextMsg.timestamp || 0).getTime();
    let bestMatch: MessageGroup | null = null;
    let bestScore = 0;

    messageGroups.forEach(group => {
      const convTime = new Date(group.conversationMessage.timestamp || 0).getTime();
      const timeDiff = Math.abs(contextTime - convTime);
      
      // 时间权重（越接近权重越高）
      const timeWeight = timeDiff <= timeThreshold ? 1 - (timeDiff / timeThreshold) : 0;
      
      // 内容相似度权重
      const similarity = calculateSimilarity(
        contextMsg.content,
        group.conversationMessage.content
      );
      
      // 综合评分
      const score = (timeWeight * 0.6) + (similarity * 0.4);
      
      if (score > bestScore && (timeWeight > 0 || similarity >= similarityThreshold)) {
        bestScore = score;
        bestMatch = group;
      }
    });

    if (bestMatch && bestMatch.contextMessages.length < maxContextMessages) {
      bestMatch.contextMessages.push(contextMsg);
    }
  });

  // 对每个分组的context消息按时间排序
  messageGroups.forEach(group => {
    group.contextMessages.sort((a, b) => 
      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );
  });

  return messageGroups;
}