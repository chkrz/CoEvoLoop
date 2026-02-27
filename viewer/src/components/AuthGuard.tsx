import { useUser } from "@/contexts/UserContext";
import { useIsInIframe } from "@/hooks/useIsInIframe";
import { UserLogin } from "@/components/UserLogin";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isLoggedIn, userId } = useUser();
  const isInIframe = useIsInIframe();

  // 如果在iframe中，跳过登录验证
  if (isInIframe) {
    return <>{children}</>;
  }

  // 如果用户未登录，显示登录页面
  if (!isLoggedIn || !userId) {
    return <UserLogin onLoginSuccess={() => {
      // 登录成功后，AuthGuard会自动重新渲染并显示子组件
      // 无需额外的跳转逻辑
    }} />;
  }

  // 如果用户已登录，显示子组件（受保护的内容）
  return <>{children}</>;
}
