import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Container, Cpu, MemoryStick } from 'lucide-react';
import { useMemo } from 'react';

const ContainerMetricsChart = ({ data }) => {
  // Prepare data for bar chart - latest metrics per container
  const barChartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const latest = {};
    data.forEach(metric => {
      if (!latest[metric.container_name] || 
          new Date(metric.timestamp) > new Date(latest[metric.container_name].timestamp)) {
        latest[metric.container_name] = metric;
      }
    });

    return Object.values(latest).map(metric => ({
      name: metric.container_name,
      cpu: Number(metric.cpu_percent.toFixed(2)),
      memory: Number(metric.memory_percent.toFixed(2)),
    }));
  }, [data]);

  // Get unique containers and colors
  const containers = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...new Set(data.map(m => m.container_name))];
  }, [data]);

  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // orange
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange-alt
    '#6366f1', // indigo
  ];

  // Get latest metrics per container
  const latestMetrics = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const latest = {};
    data.forEach(metric => {
      const existing = latest[metric.container_name];
      if (!existing || new Date(metric.timestamp) > new Date(existing.timestamp)) {
        latest[metric.container_name] = metric;
      }
    });
    
    return Object.values(latest);
  }, [data]);

  return null;
};

export default ContainerMetricsChart;
