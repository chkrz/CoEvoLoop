import { useState, useEffect } from 'react';

/**
 * 检测当前页面是否在iframe中运行
 * @returns 是否在iframe中的布尔值
 */
export function useIsInIframe(): boolean {
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // 检查当前窗口是否是顶层窗口
    const checkIframe = () => {
      try {
        // 如果window.top和window.self不同，说明在iframe中
        setIsInIframe(window.self !== window.top);
      } catch (e) {
        // 如果因为跨域问题无法访问window.top，也认为是iframe
        setIsInIframe(true);
      }
    };

    checkIframe();

    // 监听窗口变化，处理动态iframe情况
    window.addEventListener('load', checkIframe);
    
    return () => {
      window.removeEventListener('load', checkIframe);
    };
  }, []);

  return isInIframe;
}