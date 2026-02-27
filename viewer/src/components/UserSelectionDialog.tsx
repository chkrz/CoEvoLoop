import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Users, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiService, UserData } from "@/lib/api";

interface UserSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserSelect: (user: UserData) => void;
  currentUserId?: string;
}

interface DetailModalState {
  open: boolean;
  user: UserData | null;
  type: 'problem' | 'background' | 'knowledge';
  title: string;
  content: string;
}

export function UserSelectionDialog({
  open,
  onOpenChange,
  onUserSelect,
  currentUserId
}: UserSelectionDialogProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    user: null,
    type: 'problem',
    title: '',
    content: ''
  });

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await apiService.getUsers();
      setUsers(userData);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError(err instanceof Error ? err.message : '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: UserData) => {
    onUserSelect(user);
    onOpenChange(false);
  };

  const openDetailModal = (user: UserData, type: 'problem' | 'background' | 'knowledge') => {
    const titles = {
      problem: '用户问题详情',
      background: '背景信息详情',
      knowledge: '知识盲区详情'
    };
    
    const contentMap = {
      problem: user.portrait?.问题描述?.[0] || '暂无问题描述',
      background: user.portrait?.背景描述?.[0] || '暂无背景描述',
      knowledge: user.portrait?.知识盲区?.[0] || '暂无知识盲区'
    };

    setDetailModal({
      open: true,
      user,
      type,
      title: titles[type],
      content: contentMap[type]
    });
  };

  const closeDetailModal = () => {
    setDetailModal(prev => ({ ...prev, open: false }));
  };

  const renderUserInfo = (userInfo: UserData['user_info']) => {
    const levelColors: Record<string, string> = {
      'T1': 'bg-blue-100 text-blue-800 border-blue-200',
      'T2': 'bg-green-100 text-green-800 border-green-200',
      'T3': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'T4': 'bg-purple-100 text-purple-800 border-purple-200',
      'T5': 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge variant="outline" className={`text-xs ${levelColors[userInfo.客户层级] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
          客户层级: {userInfo.客户层级}
        </Badge>
        <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800 border-gray-200">
          认证等级: {userInfo.认证等级}
        </Badge>
        {userInfo.va账号数量 !== null && (
          <Badge variant="outline" className="text-xs bg-indigo-100 text-indigo-800 border-indigo-200">
            VA账号: {userInfo.va账号数量}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              选择用户角色
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">加载用户列表中...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="text-red-500 text-xl mb-4">⚠️ 加载失败</div>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={loadUsers}>重试</Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {users.map((user) => {
                  const problemText = user.portrait?.问题描述?.[0] || '暂无问题描述';
                  const backgroundText = user.portrait?.背景描述?.[0] || '暂无背景描述';
                  const knowledgeText = user.portrait?.知识盲区?.[0] || '暂无知识盲区';

                  return (
                    <Card
                      key={user.uuid}
                      className={`cursor-pointer card-hover-enhanced bg-gradient-to-br from-white to-gray-50 border-l-4 border-l-blue-500 ${
                        currentUserId === user.uuid ? 'ring-2 ring-primary shadow-md' : ''
                      }`}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('.expand-button')) {
                          return;
                        }
                        handleUserSelect(user);
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              用户 {(user.uid || '未知').substring(0, 8)}...
                            </span>
                          </div>
                          {currentUserId === user.uuid && (
                            <Badge variant="default" className="text-xs">
                              当前选择
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-sm leading-tight">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3 text-blue-500" />
                              <span className="text-blue-600 font-medium">用户问题</span>
                            </div>
                          <button
                            className="expand-button text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-1.5 py-1 rounded-full flex items-center font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailModal(user, 'problem');
                            }}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          </div>
                          <div className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {problemText}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-medium text-blue-700 flex items-center gap-1">
                                📋 背景信息
                              </h4>
                            <button
                              className="expand-button text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-1.5 py-1 rounded-full flex items-center font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal(user, 'background');
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            </div>
                            <div className="text-xs text-blue-800 leading-relaxed line-clamp-3">
                              {backgroundText}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1">
                              账户信息
                            </h4>
                            {renderUserInfo(user.user_info)}
                          </div>

                          <div className="bg-purple-50 border border-purple-200 rounded-md p-2">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-xs font-medium text-purple-700 flex items-center gap-1">
                                ❓ 知识盲区
                              </h4>
                            <button
                              className="expand-button text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-1.5 py-1 rounded-full flex items-center font-medium transition-all duration-200 hover:scale-105 shadow-sm hover:shadow"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetailModal(user, 'knowledge');
                              }}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            </div>
                            <div className="text-xs text-purple-800 leading-relaxed line-clamp-2">
                              {knowledgeText}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={detailModal.open} onOpenChange={closeDetailModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              {detailModal.title}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <div className="bg-muted/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  用户 {(detailModal.user?.uid || '未知').substring(0, 8)}...
                </span>
              </div>
              <ScrollArea className="max-h-[50vh]">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {detailModal.content}
                </div>
              </ScrollArea>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={closeDetailModal}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}