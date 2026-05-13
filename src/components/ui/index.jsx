// ============================================================
// UI PRIMITIVES
// Shared across all screens. Keep these minimal and consistent.
// ============================================================

import React from 'react'

/**
 * StatusBadge — colored pill showing checkpoint/trip status
 */
export function StatusBadge({ status, size = 'sm' }) {
  const labels = {
    ok:        'On track',
    tight:     'Getting tight',
    at_risk:   'At risk',
    missed:    'Missed',
    completed: 'Done',
    arrived:   'Here now',
    skipped:   'Skipped',
    pending:   'Planned',
  }

  const colors = {
    ok:        'bg-status-ok/20 text-status-ok border-status-ok/40',
    tight:     'bg-status-tight/20 text-status-tight border-status-tight/40',
    at_risk:   'bg-status-at_risk/20 text-status-at_risk border-status-at_risk/40',
    missed:    'bg-status-missed/20 text-status-missed border-status-missed/40',
    completed: 'bg-status-completed/20 text-status-completed border-status-completed/40',
    arrived:   'bg-accent/20 text-accent border-accent/40',
    skipped:   'bg-surface-600/20 text-surface-500 border-surface-600/40',
    pending:   'bg-surface-600/20 text-surface-500 border-surface-600/40',
  }

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
  }

  return (
    <span className={`
      inline-flex items-center rounded-full border font-medium
      ${colors[status] || colors.pending}
      ${sizes[size] || sizes.sm}
    `}>
      {labels[status] || status}
    </span>
  )
}

/**
 * StatusDot — small colored circle indicator
 */
export function StatusDot({ status, pulse = false }) {
  const colors = {
    ok:        'bg-status-ok',
    tight:     'bg-status-tight',
    at_risk:   'bg-status-at_risk',
    missed:    'bg-status-missed',
    completed: 'bg-status-completed',
    arrived:   'bg-accent',
    skipped:   'bg-surface-600',
    pending:   'bg-surface-500',
  }

  return (
    <span className={`
      inline-block w-2 h-2 rounded-full flex-shrink-0
      ${colors[status] || colors.pending}
      ${pulse && (status === 'at_risk' || status === 'arrived') ? 'animate-pulse' : ''}
    `} />
  )
}

/**
 * Card — standard surface container
 */
export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`bg-surface-700 rounded-xl border border-surface-600/50 ${className} ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

/**
 * Button — primary action button
 */
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }) {
  const variants = {
    primary:   'bg-accent text-surface-900 font-semibold hover:bg-accent/90 active:bg-accent/80',
    secondary: 'bg-surface-600 text-white hover:bg-surface-500 active:bg-surface-600',
    danger:    'bg-status-at_risk/20 text-status-at_risk border border-status-at_risk/40 hover:bg-status-at_risk/30',
    ghost:     'text-surface-500 hover:text-white hover:bg-surface-600/50',
    success:   'bg-status-ok/20 text-status-ok border border-status-ok/40 hover:bg-status-ok/30',
  }

  const sizes = {
    sm: 'text-sm px-3 py-1.5 rounded-lg',
    md: 'text-sm px-4 py-2.5 rounded-xl',
    lg: 'text-base px-5 py-3 rounded-xl',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2
        transition-all duration-150
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
        ${className}
      `}
    >
      {children}
    </button>
  )
}

/**
 * IconButton — circular icon button
 */
export function IconButton({ icon: Icon, onClick, variant = 'ghost', label, size = 'md' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }
  const iconSizes = { sm: 14, md: 16, lg: 20 }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`
        ${sizes[size]} rounded-xl flex items-center justify-center
        text-surface-500 hover:text-white hover:bg-surface-600
        transition-colors duration-150 active:scale-95
      `}
    >
      <Icon size={iconSizes[size]} />
    </button>
  )
}

/**
 * Section — labeled section container
 */
export function Section({ title, action, children }) {
  return (
    <div>
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * EmptyState — placeholder when list is empty
 */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-700 border border-surface-600/50 flex items-center justify-center mb-4">
          <Icon size={28} className="text-surface-500" />
        </div>
      )}
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      {description && <p className="text-surface-500 text-sm mb-6">{description}</p>}
      {action}
    </div>
  )
}

/**
 * TimeBig — large time display for dashboard
 */
export function TimeBig({ time, label, delta, className = '' }) {
  const deltaPositive = delta > 0
  const deltaStr = delta !== null && delta !== undefined && delta !== 0
    ? `${deltaPositive ? '+' : ''}${delta}m`
    : null

  return (
    <div className={`flex flex-col ${className}`}>
      {label && <span className="text-xs text-surface-500 uppercase tracking-wider mb-0.5">{label}</span>}
      <span className="font-mono text-2xl font-bold text-white leading-none">{time}</span>
      {deltaStr && (
        <span className={`text-xs font-mono mt-0.5 ${deltaPositive ? 'text-status-tight' : 'text-status-ok'}`}>
          {deltaStr}
        </span>
      )}
    </div>
  )
}

/**
 * BufferMeter — visual buffer indicator
 */
export function BufferMeter({ bufferMinutes, minBuffer = 5 }) {
  if (bufferMinutes === null || bufferMinutes === undefined) return null

  const isOver = bufferMinutes < 0
  const isRisky = bufferMinutes < minBuffer
  const isTight = bufferMinutes < 20

  const label = isOver
    ? `${Math.abs(bufferMinutes)}m over`
    : `+${bufferMinutes}m buffer`

  const color = isOver || isRisky
    ? 'text-status-at_risk'
    : isTight
    ? 'text-status-tight'
    : 'text-status-ok'

  return (
    <div className={`font-mono text-sm font-medium ${color}`}>
      {label}
    </div>
  )
}

/**
 * Divider
 */
export function Divider({ className = '' }) {
  return <div className={`border-t border-surface-600/50 ${className}`} />
}

/**
 * Toast-style alert banner
 */
export function AlertBanner({ message, status = 'at_risk', onDismiss }) {
  const colors = {
    at_risk: 'bg-status-at_risk/20 border-status-at_risk/50 text-status-at_risk',
    tight:   'bg-status-tight/20 border-status-tight/50 text-status-tight',
    ok:      'bg-status-ok/20 border-status-ok/50 text-status-ok',
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${colors[status] || colors.at_risk} animate-fade-in`}>
      <span className="text-sm flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
      )}
    </div>
  )
}

/**
 * CheckpointTypeIcon — emoji icon for a checkpoint kind.
 * Accepts `kind` (new model) or `type` (alias for backward compat).
 * For departure_deadline, also accepts `departureMode` for a specific icon.
 */
export function CheckpointTypeIcon({ kind, type, departureMode, className = '' }) {
  const k = kind || type

  if (k === 'departure_deadline') {
    const modeIcons = { ferry: '⛴️', train: '🚂', flight: '✈️', bus: '🚌', other: '⚓' }
    return <span className={`text-base ${className}`}>{modeIcons[departureMode] || '⚓'}</span>
  }

  const icons = {
    start:               '🚀',
    end:                 '🏁',
    normal_stop:         '📍',
    fuel_stop:           '⛽',
    opening_hours:       '🏛️',
    fixed_appointment:   '📅',
    // legacy values (kept for any stale data)
    stop:                '📍',
    fuel:                '⛽',
    fixed:               '⚓',
    open_hours:          '🏛️',
  }
  return <span className={`text-base ${className}`}>{icons[k] || '📍'}</span>
}
