import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Cpu, TrendingUp } from 'lucide-react';

const HostMetricsChart = ({ data }) => {
  // Format data for recharts
  const chartData = data.map(metric => ({
    time: new Date(metric.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cpu: Number(metric.cpu_percent.toFixed(2)),
    memory: Number(metric.memory_percent.toFixed(2)),
  }));

  // Get latest values
  const latest = data.length > 0 ? data[data.length - 1] : null;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            Host System Metrics
          </h3>
          <p className="text-sm text-slate-400 mt-2 ml-14">Real-time CPU & Memory monitoring</p>
        </div>
        
        {latest && (
          <div className="flex gap-6">
            <div className="text-right bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl px-6 py-3">
              <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide">CPU Usage</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {latest.cpu_percent.toFixed(1)}%
              </div>
            </div>
            <div className="text-right bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl px-6 py-3">
              <div className="text-xs text-purple-400 font-semibold uppercase tracking-wide">Memory</div>
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {latest.memory_percent.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis 
            dataKey="time" 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
          />
          <YAxis 
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #334155',
              borderRadius: '12px',
              color: '#fff',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3)'
            }}
            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
          />
          <Legend 
            wrapperStyle={{ color: '#94a3b8', paddingTop: '20px' }}
            iconType="circle"
          />
          <Area
            type="monotone" 
            dataKey="cpu" 
            stroke="#3b82f6" 
            strokeWidth={3}
            fill="url(#cpuGradient)"
            name="CPU %"
          />
          <Area
            type="monotone" 
            dataKey="memory" 
            stroke="#a855f7" 
            strokeWidth={3}
            fill="url(#memoryGradient)"
            name="Memory %"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HostMetricsChart;
