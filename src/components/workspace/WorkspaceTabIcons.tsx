import type { FC } from 'react'
import type { TabId } from './workspaceTabs'

const ic = { width: 18, height: 18, viewBox: '0 0 24 24' as const, fill: 'none' as const }

function IconNotepad() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M8 4h10a1 1 0 011 1v14l-3-2-3 2-3-2-3 2V5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconRequirements() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M9 5h6l1 2h3v14H5V7h3l1-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconEvaluations() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M4 6h16v12H4V6zm0 4h16M4 14h16M10 6v12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconRequirementsMatrix() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 11h7v7h-7v-7z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3 7h7M3 17h7M14 7h7M14 17h7M7 3v7M7 14v7M17 3v7M17 14v7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconWeightedVoting() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 2l3 6-3 6-3-6 3-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v6M8 14h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12l-2 4M19 12l2 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconBudget() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconModels() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconCompare() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M4 20V10M10 20V4M16 20v-6M22 20V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSmartCompare() {
  return (
    <svg {...ic} aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function IconReminders() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 22a2 2 0 002-2H10a2 2 0 002 2zM18 16V11a6 6 0 10-12 0v5l-2 2h16l-2-2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconActivity() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg {...ic} aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const MAP: Record<TabId, FC> = {
  notepad: IconNotepad,
  requirements: IconRequirements,
  requirementsMatrix: IconRequirementsMatrix,
  evaluations: IconEvaluations,
  weightedVoting: IconWeightedVoting,
  candidates: IconModels,
  compare: IconCompare,
  smartCompare: IconSmartCompare,
  reminders: IconReminders,
  budget: IconBudget,
  activity: IconActivity,
  settings: IconSettings,
}

export function WorkspaceTabIcon({ tabId }: { tabId: TabId }) {
  const Cmp = MAP[tabId]
  return <Cmp />
}
