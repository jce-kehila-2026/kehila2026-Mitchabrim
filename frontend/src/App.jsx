
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './admin/Dashboard';
import Elderly from './admin/Elderly';
import Volunteers from './admin/Volunteers';
import Projects from './admin/Projects';
import Parliaments from './admin/Parliaments';
import Media from './admin/Media';
import Links from './admin/Links';
import Financial from './admin/Financial';
import Reports from './admin/Reports';
import Settings from './admin/Settings';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/elderly" element={<Elderly />} />
        <Route path="/admin/volunteers" element={<Volunteers />} />
        <Route path="/admin/projects" element={<Projects />} />
        <Route path="/admin/parliaments" element={<Parliaments />} />
        <Route path="/admin/media" element={<Media />} />
        <Route path="/admin/links" element={<Links />} />
        <Route path="/admin/financial" element={<Financial />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;
