import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // 自定义代码块样式
          code: ({ node, className, children, ...props }: any) => {
            const inline = !className;
            if (inline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          // 自定义链接样式
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              {...props}
            >
              {children}
            </a>
          ),
          // 自定义表格样式
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-border" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-border px-4 py-2 bg-muted font-medium text-left" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-border px-4 py-2" {...props}>
              {children}
            </td>
          ),
          // 自定义引用块样式
          blockquote: ({ children, ...props }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground" {...props}>
              {children}
            </blockquote>
          ),
          // 自定义列表样式
          ul: ({ children, ...props }) => (
            <ul className="list-disc pl-6 space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal pl-6 space-y-1" {...props}>
              {children}
            </ol>
          ),
          // 自定义标题样式
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 first:mt-0" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-semibold mt-5 mb-3 first:mt-0" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-medium mt-4 mb-2 first:mt-0" {...props}>
              {children}
            </h3>
          ),
          // 自定义段落样式
          p: ({ children, ...props }) => (
            <p className="mb-3 last:mb-0" {...props}>
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
