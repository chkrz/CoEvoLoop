import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, User, AlertCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useNavigate } from "react-router-dom";

interface UserLoginProps {
  onLoginSuccess?: () => void;
}

export function UserLogin({ onLoginSuccess }: UserLoginProps) {
  const { login } = useUser();
  const navigate = useNavigate();
  const [workNumber, setWorkNumber] = useState("");
  const [userName, setUserName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!workNumber.trim()) {
      setError("请输入工号");
      return;
    }

    try {
      setIsLoading(true);
      login(workNumber, userName.trim() || undefined);
      
      // 如果有回调函数，执行回调（通常由AuthGuard提供）
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">用户登录</CardTitle>
            <p className="text-muted-foreground mt-2">
              请输入您的工号以访问研究报告和 AI 对话功能
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="workNumber">工号 *</Label>
              <Input
                id="workNumber"
                type="text"
                placeholder="请输入您的工号"
                value={workNumber}
                onChange={(e) => setWorkNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full"
                disabled={isLoading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                工号一般为 6 位数字
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="userName">姓名（可选）</Label>
              <Input
                id="userName"
                type="text"
                placeholder="请输入您的姓名"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                用于个性化显示，不填写将使用工号
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading || !workNumber.trim()}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>登录中...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  <span>进入系统</span>
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>您的工号将用于标识和隔离对话数据</p>
            <p className="mt-1">请确保工号输入正确</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
