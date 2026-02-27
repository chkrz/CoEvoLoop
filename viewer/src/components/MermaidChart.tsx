import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidChartProps {
  chart: string;
  id?: string;
}

export function MermaidChart({ chart, id }: MermaidChartProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const chartId = id || `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    // Initialize mermaid with configuration
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      themeVariables: {
        primaryColor: '#3b82f6',
        primaryTextColor: '#1f2937',
        primaryBorderColor: '#1d4ed8',
        lineColor: '#6b7280',
        sectionBkgColor: '#f3f4f6',
        altSectionBkgColor: '#ffffff',
        gridColor: '#e5e7eb',
        secondaryColor: '#f59e0b',
        tertiaryColor: '#10b981',
      }
    });

    const renderChart = async () => {
      if (mermaidRef.current) {
        try {
          // Clear previous content
          mermaidRef.current.innerHTML = '';
          
          // Render the mermaid chart
          const { svg } = await mermaid.render(chartId, chart);
          mermaidRef.current.innerHTML = svg;
        } catch (error) {
          console.error('Error rendering mermaid chart:', error);
          mermaidRef.current.innerHTML = `
            <div class="p-4 border border-red-200 bg-red-50 rounded-md">
              <p class="text-red-600 text-sm">无法渲染 Mermaid 图表</p>
              <pre class="text-xs text-red-500 mt-2 overflow-x-auto">${chart}</pre>
            </div>
          `;
        }
      }
    };

    renderChart();
  }, [chart, chartId]);

  return (
    <div className="my-4 overflow-x-auto">
      <div 
        ref={mermaidRef} 
        className="flex justify-center items-center min-h-[200px]"
      />
    </div>
  );
}
