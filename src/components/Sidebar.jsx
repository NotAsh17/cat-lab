import { 
  LayoutDashboard, 
  CalendarDays, 
  BookOpen, 
  Calculator, 
  Bookmark, 
  BarChart3, 
  Flame, 
  Sun, 
  Moon, 
  UserCheck,
  Layers,
  Cloud,
  FileText
} from 'lucide-react';
import { Storage } from '../services/storage';

export default function Sidebar({ 
  currentView, 
  setView, 
  theme, 
  toggleTheme, 
  streak, 
  profile, 
  setProfile,
  syncStatus,
}) {
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'dailies', name: 'Dailies', icon: CalendarDays },
    { id: 'practice', name: 'Practice by Type', icon: Layers },
    { id: 'mocks', name: 'Full Mocks', icon: FileText },
    { id: 'varc_sectional', name: 'VARC Sectional', icon: BookOpen },
    { id: 'qa_sectional', name: 'QA Sectional', icon: Calculator },
    { id: 'bookmarks', name: 'Bookmarks', icon: Bookmark },
    { id: 'analytics', name: 'Analytics', icon: BarChart3 },
    { id: 'profile_sync', name: 'Profile & Sync', icon: Cloud },
  ];

  // Render a GitHub-style Mon-Sun grid representing the current week
  const renderWeeklyGrid = () => {
    const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const completedDays = Storage.getCompletedDays();
    
    // Check which days have practice logged in the last 7 days
    const today = new Date();
    const currentDayIndex = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    return (
      <div className="mt-6 border-t border-border-subtle pt-4 px-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 font-mono">
          Weekly Grid
        </h4>
        <div className="grid grid-cols-7 gap-1.5 justify-center">
          {daysOfWeek.map((day, idx) => {
            // Map Mon-Sun to correct day number indices
            // Mon = 1, Tue = 2... Sat = 6, Sun = 0
            const dayNum = idx === 6 ? 0 : idx + 1;
            const isCompleted = Object.values(completedDays).some(dateStr => {
              const d = new Date(dateStr);
              return d.getDay() === dayNum;
            });
            const isToday = currentDayIndex === dayNum;

            return (
              <div key={idx} className="flex flex-col items-center">
                <span className="text-[10px] text-text-faint font-mono mb-1">{day}</span>
                <div 
                  className={`w-5 h-5 rounded-sm transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-brand-gold shadow-[0_0_8px_rgba(201,150,74,0.3)]' 
                      : isToday 
                        ? 'border border-dashed border-brand-gold' 
                        : 'bg-bg-card border border-border-subtle'
                  }`}
                  title={isCompleted ? "Practice Completed!" : isToday ? "Today (Pending)" : "No Practice"}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-64 bg-bg-surface border-r border-border-subtle flex flex-col justify-between h-screen sticky top-0 font-sans select-none">
      <div className="flex flex-col overflow-y-auto flex-1 py-6 px-4">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 px-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-gold to-brand-gold-hover flex items-center justify-center font-bold text-bg-base font-serif text-lg shadow-[0_0_12px_rgba(201,150,74,0.2)]">
            C
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-text-main font-mono">
              CAT Catalyst
            </h1>
            <p className="text-[10px] text-text-muted font-mono tracking-wider">
              SECTIONAL & PRACTICE
            </p>
          </div>
        </div>

        {/* Streak Badge */}
        <div className="mb-6 px-2">
          <div className="flex items-center space-x-2.5 px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm">
            <Flame className="w-4 h-4 text-brand-gold animate-pulse" />
            <span className="text-text-main font-medium">
              {streak?.current || 0} Day Streak
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id || 
              (item.id === 'varc_sectional' && currentView === 'test_runner_varc') ||
              (item.id === 'qa_sectional' && currentView === 'test_runner_qa') ||
              (item.id === 'mocks' && currentView === 'test_runner_mock') ||
              (item.id === 'dailies' && currentView === 'test_runner_daily') ||
              (item.id === 'practice' && currentView === 'test_runner_practice');

            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-gold/10 text-brand-gold border-l-2 border-brand-gold font-semibold'
                    : 'text-text-muted hover:text-text-main hover:bg-bg-card'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-gold' : ''}`} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Weekly Progress Grid */}
        {renderWeeklyGrid()}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-border-subtle bg-bg-card/50 flex flex-col space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-card px-3 py-2 text-xs">
          <div className="flex items-center space-x-2">
            <Cloud className={`h-3.5 w-3.5 ${
              syncStatus?.state === 'synced' ? 'text-brand-green' :
              syncStatus?.state === 'syncing' ? 'text-brand-gold animate-pulse' :
              syncStatus?.state === 'error' ? 'text-brand-red' :
              'text-text-faint'
            }`} />
            <span className="font-mono text-text-muted">{syncStatus?.label || 'Local only'}</span>
          </div>
          {Storage.getLastSync() && <span className="font-mono text-[10px] text-text-faint">cloud</span>}
        </div>

        {/* Profile Selector */}
        <div className="flex items-center justify-between px-2 text-xs">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-text-muted font-mono">Profile:</span>
            <select 
              value={profile} 
              onChange={(e) => setProfile(e.target.value)}
              className="bg-transparent text-text-main font-semibold font-mono border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="User" className="bg-bg-surface text-text-main">User</option>
              <option value="Friend" className="bg-bg-surface text-text-main">Friend</option>
            </select>
          </div>
        </div>

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-bg-card border border-border-subtle text-xs hover:border-text-faint transition"
        >
          <span className="text-text-muted font-mono uppercase tracking-wider">
            Theme: {theme === 'dark' ? 'Graphite' : 'Paper'}
          </span>
          {theme === 'dark' ? (
            <Moon className="w-3.5 h-3.5 text-brand-gold" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-amber-500" />
          )}
        </button>
      </div>
    </aside>
  );
}
