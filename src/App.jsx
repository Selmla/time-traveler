import React, { useEffect } from 'react'
import { Navigation, List, Map, Sun, Moon } from 'lucide-react'
import { useUIStore, useSessionStore } from './stores/index.js'
import NowScreen from './screens/NowScreen.jsx'
import TripsScreen from './screens/TripsScreen.jsx'
import PlanScreen from './screens/PlanScreen.jsx'

// ============================================================
// ROOT APP
// Simple tab-based navigation. No router library needed.
// The three tabs cover the entire MVP surface area.
// ============================================================

export default function App() {
  const activeTab   = useUIStore(s => s.activeTab)
  const setTab      = useUIStore(s => s.setTab)
  const isRunning   = useSessionStore(s => s.isRunning)
  const theme       = useUIStore(s => s.theme)
  const toggleTheme = useUIStore(s => s.toggleTheme)

  // Sync theme to <html> so CSS variable selectors and color-scheme apply globally.
  // Also runs on first mount to match any value rehydrated from localStorage.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme === 'day' ? 'light' : 'dark'
  }, [theme])

  return (
    <div className="flex flex-col h-dvh bg-surface-900 text-white select-none overflow-hidden">

      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {/* All screens are mounted, only the active one is visible.
            This avoids state loss when switching tabs. */}
        <div className={`h-full overflow-hidden ${activeTab === 'now' ? 'block' : 'hidden'}`}>
          <NowScreen />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === 'trips' ? 'block' : 'hidden'}`}>
          <TripsScreen />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === 'plan' ? 'block' : 'hidden'}`}>
          <PlanScreen />
        </div>
      </main>

      {/* Bottom navigation */}
      <nav className="flex-shrink-0 bg-surface-800 border-t border-surface-600/50 pb-safe">
        <div className="flex items-stretch">
          <NavTab
            id="now"
            icon={Navigation}
            label="Now"
            active={activeTab === 'now'}
            onPress={() => setTab('now')}
            badge={isRunning}
          />
          <NavTab
            id="trips"
            icon={List}
            label="Trips"
            active={activeTab === 'trips'}
            onPress={() => setTab('trips')}
          />
          <NavTab
            id="plan"
            icon={Map}
            label="Plan"
            active={activeTab === 'plan'}
            onPress={() => setTab('plan')}
          />

          {/* Theme toggle — day/night switching */}
          <button
            onClick={toggleTheme}
            title={theme === 'night' ? 'Switch to day mode' : 'Switch to night mode'}
            className="flex flex-col items-center justify-center gap-1 px-4 border-l border-surface-600/50 text-surface-400 hover:text-surface-300 transition-colors"
          >
            {theme === 'night'
              ? <Sun size={18} strokeWidth={1.5} />
              : <Moon size={18} strokeWidth={1.5} />
            }
            <span className="text-[10px] font-medium">
              {theme === 'night' ? 'Day' : 'Night'}
            </span>
          </button>
        </div>
      </nav>
    </div>
  )
}

function NavTab({ id, icon: Icon, label, active, onPress, badge }) {
  return (
    <button
      onClick={onPress}
      className={`
        flex-1 flex flex-col items-center gap-1 py-3 px-2
        transition-colors duration-150 relative
        ${active ? 'text-accent' : 'text-surface-500 hover:text-surface-400'}
      `}
    >
      <div className="relative">
        <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-status-ok rounded-full" />
        )}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
