import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import ScorePage from './pages/ScorePage';
import SichuanPage from './pages/SichuanPage';
import TutorialPage from './pages/TutorialPage';
import SettingsPage from './pages/SettingsPage';

const TABS = [
  { to: '/', label: '日麻计分', mark: '日', end: true },
  { to: '/sichuan', label: '川麻积分', mark: '川', end: false },
  { to: '/tutorial', label: '教学馆', mark: '学', end: false },
  { to: '/settings', label: '设置', mark: '设', end: false }
];

export default function App() {
  return (
    <HashRouter>
      <div className="app-main">
        <Routes>
          <Route path="/" element={<ScorePage />} />
          <Route path="/sichuan" element={<SichuanPage />} />
          <Route path="/tutorial" element={<TutorialPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => 'tab-item' + (isActive ? ' selected' : '')}
          >
            <span className="tab-mark">{tab.mark}</span>
            <span className="tab-text">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </HashRouter>
  );
}
