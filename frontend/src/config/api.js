// API Configuration
// Automatically detect if running in Docker (port 3000) or local dev (port 5173)
const isDocker = window.location.port === '3000';
const isLocalDev = window.location.port === '5173' || window.location.hostname === 'localhost';

export const API_BASE_URL = isDocker 
  ? 'http://localhost:8000'  // Docker: backend on same host, port 8000
  : isLocalDev 
    ? 'http://localhost:8000'  // Local dev: backend on localhost:8000
    : '';  // Production: use relative URLs

export default API_BASE_URL;
