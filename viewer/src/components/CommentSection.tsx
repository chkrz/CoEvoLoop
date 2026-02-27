import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { useToast } from '../hooks/use-toast';
import { apiService, Comment, CreateCommentRequest } from '../lib/api';
import { MessageCircle, User, Calendar, Plus, Loader2 } from 'lucide-react';

export const CommentSection: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState('');
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await apiService.getComments();
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
      toast({
        title: "错误",
        description: "无法加载评论，请检查后端服务是否运行",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !comment.trim()) {
      toast({
        title: "验证错误",
        description: "用户名和评论内容不能为空",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const newComment = await apiService.createComment({
        username: username.trim(),
        comment: comment.trim(),
      });
      
      setComments([newComment, ...comments]);
      setUsername('');
      setComment('');
      
      toast({
        title: "成功",
        description: "评论添加成功！",
      });
    } catch (error) {
      console.error('Failed to create comment:', error);
      toast({
        title: "错误",
        description: "添加评论失败，请重试",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    fetchComments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载评论中...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">评论系统</h1>
        <p className="text-muted-foreground">
          Django后端 + React前端集成演示
        </p>
      </div>

      {/* Add Comment Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            添加新评论
          </CardTitle>
          <CardDescription>
            分享你的想法和意见
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                用户名
              </label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="comment" className="block text-sm font-medium mb-1">
                评论内容
              </label>
              <Textarea
                id="comment"
                placeholder="请输入评论内容..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  提交评论
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Comments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            评论列表
            <Badge variant="secondary">{comments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无评论，成为第一个评论的人吧！
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((commentItem, index) => (
                <div key={commentItem.id}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {commentItem.username}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(commentItem.gmt_create)}
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed">
                        {commentItem.comment}
                      </p>
                    </div>
                  </div>
                  {index < comments.length - 1 && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            已连接到Django后端API (localhost:8000)
          </div>
        </CardContent>
      </Card>
    </div>
  );
}; 