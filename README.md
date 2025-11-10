# 🐳 DockerWatch - Real-time Docker Monitoring Dashboard

A modern, professional Docker monitoring dashboard with real-time metrics visualization, alerts, and container management. Built with FastAPI backend and React frontend with a sleek dark theme.

![Dashboard Preview](https://img.shields.io/badge/Status-Production%20Ready-success)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 📊 **Overview Dashboard**
- **Host Summary Cards** with donut charts
  - CPU Usage (real-time donut visualization)
  - RAM Usage (real-time donut visualization)
  - Network I/O monitoring (upload/download)
  - System Uptime tracking
- **Container Summary**
  - Total containers count
  - Top CPU consuming container
  - Top RAM consuming container
  - Active alerts counter
- **Top Resource Consumers** (Top 3)
- **Trend Charts** with sparklines

### 🖥️ **System Monitoring**
Detailed host system monitoring with sub-tabs:
- **Overview**: System information and key metrics
- **CPU**: Per-core CPU usage, load average, detailed charts
- **Memory**: RAM usage breakdown, swap memory, detailed stats
- **Disk**: Disk usage per mount point, I/O statistics
- **Network**: Network interfaces, traffic statistics, bandwidth

### 🐋 **Container Management**
- **Interactive Table** with filters (All/Running/Stopped)
- **Real-time Container List**
  - All containers (running + stopped)
  - Accurate uptime (from StartedAt, resets on restart)
  - Real CPU/Memory metrics
  - Container status badges
  - Automatic 5-second refresh
- **Container Logs Viewer**
  - Real-time log streaming (3-second updates)
  - Date-based filtering (last 10 days)
  - Log level filters (All/Errors/Warnings/Info)
  - Color-coded log entries (Errors: red, Warnings: amber, Info: green)
  - Auto-scroll to newest logs (top)
  - Live/Pause toggle for auto-refresh
  - Timezone conversion (UTC → WIB)
  - Expandable log details
  - Log statistics (Total lines, Errors, Warnings, Info)
- **Container Actions**
  - View Logs button (opens logs sidebar)
  - Disabled for stopped containers
  - Per-container log management

### 🔒 **Security Dashboard**
- **Container Security Issues**
  - Root user detection
  - Latest tag warnings
  - Privileged mode alerts
- **Vulnerability Scanning** (Trivy integration ready)
- **Audit Logs** tracking
- **Firewall & Network Info**
- **Security Recommendations** with code examples

### 🔔 **Alert System**
- Real-time notification bell icon
- Threshold-based alerts (75% CPU/RAM)
- Host and container metrics monitoring
- Visual badge counter
- Dropdown alert list with details

### 🎨 **Modern UI/UX**
- **Dark Theme** with animated gradient background
- **Glass Morphism** effect on navbar and topbar
- **Donut Charts** for CPU/RAM visualization
- **Smooth Animations** and transitions
- **Responsive Design** for all screen sizes
- **Color Palette**: Slate dark theme with sky-blue accents

## 🛠️ Technology Stack

### **Backend**
- **Framework**: FastAPI
- **Server**: Uvicorn (ASGI)
- **Database**: SQLAlchemy ORM
- **Docker Integration**: Docker SDK for Python
- **System Metrics**: psutil
- **Environment**: python-dotenv
- **Validation**: Pydantic v2

### **Frontend**
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Axios (via custom hooks)
- **State Management**: React Hooks (useState, useEffect)

### **Development**
- **Language**: JavaScript (ES6+)
- **Package Manager**: npm/yarn/pnpm
- **Hot Reload**: Vite HMR
- **Code Quality**: ESLint

## 📋 Prerequisites

Before installation, ensure you have:

- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend)
- **Docker** (for container monitoring)
- **Git** (for cloning repository)

## 🚀 Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/docker-monitor.git
cd docker-monitor
```

### 2. Backend Setup

#### Create Virtual Environment (Required on Kali Linux)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### Install Dependencies

```bash
pip install fastapi uvicorn[standard] sqlalchemy python-dotenv psutil docker pydantic pydantic-settings
```

#### Configure Environment (Optional)

```bash
cp .env.example .env
# Edit .env with your configuration
```

#### Run Backend Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will run on: `http://localhost:8000`

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

#### Run Frontend Development Server

```bash
npm run dev
```

Frontend will run on: `http://localhost:5173`

## 🎯 Usage

1. **Start Backend**: Navigate to `backend/` and run `uvicorn main:app --reload`
2. **Start Frontend**: Navigate to `frontend/` and run `npm run dev`
3. **Open Browser**: Go to `http://localhost:5173`
4. **Navigate Tabs**:
   - **Overview**: Dashboard with real-time metrics
   - **System**: Deep host monitoring
   - **Containers**: Container management with real-time logs
   - **Vulnerabilities**: Security monitoring
5. **View Container Logs**:
   - Click "View Logs" button on any container
   - Logs sidebar opens with real-time streaming
   - Use date selector to view historical logs (last 10 days)
   - Filter by log level (All/Errors/Warnings/Info)
   - Toggle Live/Pause for auto-refresh control
   - Logs display in WIB timezone with newest on top

## 📊 API Endpoints

### Container Management
- `GET /api/containers/all` - List all containers (running + stopped) with metrics
- `GET /api/containers/{container_name}/logs?tail=500&date=YYYY-MM-DD` - Get container logs with date filter
- `GET /api/containers/stats` - Container statistics (total size, count)

### Metrics
- `GET /api/metrics/host` - Host system metrics (CPU, RAM, Network, Disk)
- `GET /api/metrics/containers` - Container metrics with historical data

### Log Management
- `GET /api/logs/files?container_name={name}` - List log files per container
- `GET /api/logs/read?path={path}` - Read specific log file with pagination

## 🎨 Theme Customization

The application uses a custom dark theme with:

- **Background**: `#0f172a` (slate-900)
- **Cards**: `rgba(30, 41, 59, 0.7)` (slate-800 with transparency)
- **Borders**: `#334155` (slate-700)
- **Text Primary**: `#f8fafc` (slate-100)
- **Text Secondary**: `#94a3b8` (slate-400)
- **Accent**: `#38bdf8` (sky-500)

Edit `frontend/src/index.css` to customize colors.

## 📁 Project Structure

```
docker-monitor/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── database.py          # Database setup
│   ├── collector.py         # Metrics collector
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main application
│   │   ├── components/      # React components
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopBar.jsx
│   │   │   └── ContainerMetricsChart.jsx
│   │   ├── hooks/           # Custom hooks
│   │   │   └── useMetrics.js
│   │   └── index.css        # Global styles
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🔧 Configuration

### Backend Configuration

Edit `backend/.env`:

```env
DATABASE_URL=sqlite:///./metrics.db
METRICS_INTERVAL=30  # Seconds between metric collection
DATA_RETENTION_DAYS=30
```

### Frontend Configuration

Edit `frontend/vite.config.js` for proxy settings:

```javascript
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

## 🐛 Troubleshooting

### Backend Issues

**Error: externally-managed-environment**
- Solution: Use virtual environment (see Installation step 2)

**Error: Docker connection refused**
- Solution: Ensure Docker daemon is running
- Check: `docker ps`

**Error: Pydantic compatibility**
- Solution: `pip install --upgrade pydantic pydantic-core`

### Frontend Issues

**Error: Cannot connect to backend**
- Check backend is running on port 8000
- Verify proxy settings in `vite.config.js`

**Error: Module not found**
- Solution: `npm install`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- FastAPI for the amazing backend framework
- React and Vite for modern frontend development
- Lucide React for beautiful icons
- Tailwind CSS for utility-first styling
- Docker for containerization

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Made with ❤️ for Docker monitoring**
# docker-monitor
