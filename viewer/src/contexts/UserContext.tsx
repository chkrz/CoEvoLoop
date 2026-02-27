import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserContextType {
  userId: string | null;
  userName: string | null;
  isLoggedIn: boolean;
  login: (workNumber: string, name?: string) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

// 检测是否在iframe中的辅助函数
const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  // 检查iframe环境并设置默认用户
  useEffect(() => {
    if (isInIframe()) {
      // 在iframe中使用默认用户
      setUserId('default_user');
      setUserName('默认用户');
      setIsLoggedIn(true);
      console.log('🔓 iframe环境：使用默认用户 default_user');
      return; // 跳过本地存储检查
    }

    // 从本地存储恢复用户状态（非iframe环境）
    const savedUserId = localStorage.getItem('fintl_user_id');
    const savedUserName = localStorage.getItem('fintl_user_name');
    
    if (savedUserId) {
      setUserId(savedUserId);
      setUserName(savedUserName);
      setIsLoggedIn(true);
    }
  }, []);

  const login = (workNumber: string, name?: string) => {
    const trimmedWorkNumber = workNumber.trim();
    
    if (!trimmedWorkNumber) {
      throw new Error('工号不能为空');
    }

    // 工号格式验证（可以根据实际需求调整）
    if (!/^[0-9]{6,6}$/.test(trimmedWorkNumber)) {
      throw new Error('工号格式不正确：应为 6 位数字');
    }

    // 检查是否包含不安全字符
    if (/[<>\"'&]/.test(trimmedWorkNumber)) {
      throw new Error('工号包含不支持的特殊字符');
    }

    setUserId(trimmedWorkNumber);
    setUserName(name || trimmedWorkNumber);
    setIsLoggedIn(true);

    // 保存到本地存储
    localStorage.setItem('fintl_user_id', trimmedWorkNumber);
    if (name) {
      localStorage.setItem('fintl_user_name', name);
    }

    console.log('🔐 用户登录成功:', { userId: trimmedWorkNumber, userName: name });
  };

  const logout = () => {
    // 在iframe中不允许登出操作
    if (isInIframe()) {
      console.log('🚫 iframe环境：不允许登出操作');
      return;
    }

    setUserId(null);
    setUserName(null);
    setIsLoggedIn(false);

    // 清除本地存储
    localStorage.removeItem('fintl_user_id');
    localStorage.removeItem('fintl_user_name');

    console.log('🔓 用户已登出');
  };

  return (
    <UserContext.Provider value={{
      userId,
      userName,
      isLoggedIn,
      login,
      logout
    }}>
      {children}
    </UserContext.Provider>
  );
};
