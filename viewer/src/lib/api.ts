// // 动态获取API基础URL，适配不同的部署环境
// const getApiBaseUrl = () => {
//   // 如果是开发环境，使用localhost
//   if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
//     return 'http://localhost:8000';
//   }
//   // 生产环境，使用当前主机的IP，但端口改为8000
//   return `http://${window.location.hostname}:8000`;
// };
//
// const API_BASE_URL = getApiBaseUrl();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
// 调试信息：输出当前使用的API URL
console.log('🔗 API Base URL:', API_BASE_URL);

export interface Comment {
  id: number;
  username: string;
  comment: string;
  gmt_create: string;
  gmt_modified: string;
}

export interface CreateCommentRequest {
  username: string;
  comment: string;
}

// Dialogue System Interfaces
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// 简化的PlannerRecord结构，与planner context分离
export interface PlannerRecord {
  timestamp: string;
  action: string;                                    // execute_agent, execute_tool, response
  thought: string;
  user_goal: string;
  selected_executor?: string | null;
  executor_parameters: Record<string, any>;
  response?: string | null;
  finished: boolean;
  agent_result?: AgentResult;
  tool_result?: ToolResult;
}

export interface AgentResult {
  success: boolean;
  result: any;
  error?: string | null;
}

export interface ToolResult {
  success: boolean;
  result: any;
  error?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model: string;
  message_count: number;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
}

export interface CreateConversationRequest {
  user_id?: string;
  title?: string;
  model?: string;
}

export interface SendMessageRequest {
  user_id?: string;
  content: string;
  turn?: number;
  service?: string;
  score_model?: string;
  user_simulator_model?: string;
  outer_user_goal?: string;
}

export interface SendMessageResponse {
  success: boolean;
  messages: Message[];
  conversation_title?: string;  // 可能更新的会话标题
}

export interface UserData {
  uid: string;
  dialogue: string[];
  user_info: {
    va账号数量: number | null;
    客户层级: string;
    登陆状态: string;
    认证等级: string;
    账号类型: string;
    b2x: string;
    identity: string;
  };
  portrait: {
    背景描述: string[];
    知识盲区: string[];
    操作历史: any[];
    问题描述: string[];
  };
  uuid: string;
}

export interface ScoreDetailResponse {
  score_detail: {
    [key: string]: number | string;
  };
  scorer_version?: string;
}

class ApiService {
  private readonly REQUEST_TIMEOUT = 5 * 60 * 1000; // 5分钟超时时间（毫秒）

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);
    
    const config: RequestInit = {
      credentials: 'include', // 包含cookie
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId); // 清除超时定时器
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId); // 确保清除超时定时器
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时：${this.REQUEST_TIMEOUT / 1000}秒内未收到响应`);
      }
      throw error;
    }
  }

  async getComments(): Promise<Comment[]> {
    return this.request<Comment[]>('/api/comments-simple/');
  }

  async createComment(commentData: CreateCommentRequest): Promise<Comment> {
    return this.request<Comment>('/api/comments-simple/', {
      method: 'POST',
      body: JSON.stringify(commentData),
    });
  }

  async deleteComment(id: number): Promise<void> {
    await this.request(`/api/comments/${id}/`, {
      method: 'DELETE',
    });
  }

  async updateComment(id: number, commentData: Partial<CreateCommentRequest>): Promise<Comment> {
    return this.request<Comment>(`/api/comments/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(commentData),
    });
  }



  // Dialogue System API
  async getConversations(userId: string): Promise<ConversationsResponse> {
    return this.request<ConversationsResponse>(`/api/conversations/?user_id=${userId}`);
  }

  async createConversation(userId: string, data: CreateConversationRequest): Promise<Conversation> {
    const payload = {
      user_id: userId,
      ...data
    };
    return this.request<Conversation>('/api/conversations/create/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getConversationDetail(conversationId: string, userId: string): Promise<ConversationDetail> {
    return this.request<ConversationDetail>(`/api/conversations/${conversationId}/?user_id=${userId}`);
  }

  async sendMessage(conversationId: string, userId: string, data: SendMessageRequest): Promise<SendMessageResponse> {
    const payload = {
      user_id: userId,
      ...data
    };
    return this.request<SendMessageResponse>(`/api/conversations/${conversationId}/send/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 流式发送消息
  async sendMessageStream(
    conversationId: string, 
    userId: string, 
    data: SendMessageRequest,
    onMessageStart: () => void,
    onChunk: (content: string) => void,
    onMessageEnd: () => void,
    onError?: (error: string) => void,
    onDone?: () => void
  ): Promise<void> {
    const url = `${API_BASE_URL}/api/conversations/${conversationId}/send/`;
    const payload = {
      user_id: userId,
      ...data
    };

    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include', // 包含cookie
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      clearTimeout(timeoutId); // 清除超时定时器

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'message_start') {
                onMessageStart();
              } else if (data.type === 'content' && data.content) {
                onChunk(data.content);
              } else if (data.type === 'message_end') {
                onMessageEnd();
              } else if (data.type === 'error' && data.error) {
                onError?.(data.error);
                return;
              } else if (data.type === 'done') {
                onDone?.();
                return;
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId); // 确保清除超时定时器
      if (error instanceof Error && error.name === 'AbortError') {
        onError?.(`请求超时：${this.REQUEST_TIMEOUT / 1000}秒内未收到响应`);
      } else {
        onError?.(error instanceof Error ? error.message : '发送消息失败');
      }
    }
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    await this.request(`/api/conversations/${conversationId}/delete/?user_id=${userId}`, {
      method: 'DELETE',
    });
  }

  // 获取用户记忆
  async getUserMemory(userId: string): Promise<string> {
    const params = new URLSearchParams({ user_id: userId });
    return this.request<string>(`/api/user-memory/?${params.toString()}`);
  }

  // 获取用户数据（通过API）
  async getUsers(): Promise<UserData[]> {
    const response = await this.request<{ users: UserData[] }>('/api/users/');
    return response.users;
  }

  // 获取规划器记录详情
  async getPlannerRecord(conversationId: string, userId: string, turn: number): Promise<any> {
    const params = new URLSearchParams({ user_id: userId, turn: turn.toString() });
    return this.request<any>(`/api/conversations/${conversationId}/planner-record/?${params.toString()}`);
  }

  // 获取评分详情
  async getScoreDetail(conversationId: string, userId: string, turn: number, userInfo?: any): Promise<ScoreDetailResponse> {
    const params = new URLSearchParams({ user_id: userId, turn: turn.toString() });
    if (userInfo) {
      params.append('user_info', JSON.stringify(userInfo));
    }
    return this.request<ScoreDetailResponse>(`/api/conversations/${conversationId}/score-detail/?${params.toString()}`);
  }

  // 生成用户输入
  async generateUserInput(userId: string, conversationId: string, currentUserData, turn: number): Promise<{ user_input: string; end: boolean }> {
    const payload = {
      user_id: userId,
      conversation_id: conversationId,
      user_data: currentUserData,
      turn: turn
    };
    return this.request<{ user_input: string; end: boolean }>('/api/generate_user_input/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }


}

export const apiService = new ApiService();