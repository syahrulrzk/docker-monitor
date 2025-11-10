import { TrendingUp, HardDrive, Cpu, Menu, X, Shield, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className={`border-r border-dashed border-slate-700 flex flex-col transition-all duration-300 relative z-10 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <div className="p-6">
        {/* Header with Toggle */}
        <div className="flex items-center justify-between mb-8">
          {!isCollapsed && (
            <h1 className="text-xl font-semibold text-slate-100">
              DockerWatch
            </h1>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-slate-700/50 rounded-md transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
      </div>
      
      <nav className="flex-1 px-3">
        <div className="space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              activeTab === 'dashboard' 
                ? 'bg-sky-500 text-white' 
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
            }`}
            title={isCollapsed ? 'Overview' : ''}
          >
            <TrendingUp className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Overview</span>}
          </button>
          <button 
            onClick={() => setActiveTab('host')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              activeTab === 'host' 
                ? 'bg-sky-500 text-white' 
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
            }`}
            title={isCollapsed ? 'System' : ''}
          >
            <Cpu className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">System</span>}
          </button>
          <button 
            onClick={() => setActiveTab('containers')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              activeTab === 'containers' 
                ? 'bg-sky-500 text-white' 
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
            }`}
            title={isCollapsed ? 'Containers' : ''}
          >
            <HardDrive className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Containers</span>}
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              activeTab === 'security' 
                ? 'bg-sky-500 text-white' 
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100'
            }`}
            title={isCollapsed ? 'Vulnerabilities' : ''}
          >
            <Shield className="w-5 h-5" />
            {!isCollapsed && <span className="text-sm font-medium">Vulnerabilities</span>}
          </button>
        </div>
      </nav>
      
      {!isCollapsed && (
        <div className="mt-auto p-4 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            <p>FastAPI + React</p>
            <p className="mt-1">v1.0.0</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
