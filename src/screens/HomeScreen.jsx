// — HOME SCREEN
// Lists all sheets
// Create, open, delete sheets
// Shows free tier usage

import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Paywall from '../components/Paywall'
import {
  createSheet,
  getSheets,
  deleteSheet,
  createColumn,
  db
} from '../db'
import { syncFromCloud, syncToCloud } from '../sync'
import { signOut } from '../auth'
import {
  hasReachedSheetLimit,
  getLimitMessage
} from '../utils/limits'

export default function HomeScreen({ user, onOpenSheet, onUpgrade }) {
  const { isDark, toggleTheme } = useTheme()
  const [sheets, setSheets] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [columns, setColumns] = useState([
    { id: 1, name: 'Item', type: 'text' }
  ])
  const [confirm, setConfirm] = useState(null)
  const [paywall, setPaywall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    initData()
  }, [])

  async function initData() {
    setLoading(true)
    // Try to pull from cloud first
    if (user) {
      setSyncing(true)
      const pulled = await syncFromCloud(user.id, db)
      setSyncing(false)
      if (pulled) {
        await loadSheets()
        setLoading(false)
        return
      }
    }
    await loadSheets()
    setLoading(false)
  }

  async function loadSheets() {
    const data = await getSheets()
    setSheets(data)
  }

  function addColumn() {
    setColumns([...columns, { id: Date.now(), name: '', type: 'text' }])
  }

  function updateColumn(id, field, value) {
    setColumns(columns.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function removeColumn(id) {
    if (columns.length === 1) return
    setColumns(columns.filter(c => c.id !== id))
  }

  async function handleCreateSheet() {
    if (!newSheetName.trim()) return

    if (hasReachedSheetLimit(sheets.length, false)) {
      setShowCreate(false)
      setPaywall('sheets')
      return
    }

    const validColumns = columns.filter(c => c.name.trim())
    if (validColumns.length === 0) return

    const sheetId = await createSheet(newSheetName.trim())
    for (let i = 0; i < validColumns.length; i++) {
      await createColumn(sheetId, validColumns[i].name, validColumns[i].type, i)
    }

    // Sync to cloud after creating
    if (user) await syncToCloud(user.id, db)

    await loadSheets()
    setNewSheetName('')
    setColumns([{ id: 1, name: 'Item', type: 'text' }])
    setShowCreate(false)
  }

  async function handleDeleteSheet(sheetId, sheetName) {
    setConfirm({
      message: `Delete "${sheetName}"? This cannot be undone.`,
      onConfirm: async () => {
        await deleteSheet(sheetId)
        // Sync to cloud after deleting
        if (user) await syncToCloud(user.id, db)
        await loadSheets()
        setConfirm(null)
      }
    })
  }

  // Manual sync trigger
  async function handleManualSync() {
    if (!user) return
    setSyncing(true)
    await syncToCloud(user.id, db)
    setSyncing(false)
  }

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'

  return (
    <div className={`min-h-screen ${bg} ${text}`}>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {paywall && (
        <Paywall
          message={getLimitMessage(paywall)}
          onClose={() => setPaywall(null)}
          onUpgrade={() => { setPaywall(null); onUpgrade() }}
        />
      )}

      {/* Header */}
      <div className={`${headerBg} border-b px-4 py-4`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">◈ Onyx</h1>
            <p className={`text-xs ${subtext} mt-0.5`}>Sheets</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync button */}
            {user && (
  <button
    onPointerDown={async () => { await signOut(); window.location.reload() }}
    className={`w-10 h-10 rounded-xl flex items-center justify-center text-base active:opacity-70 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
    title="Sign out"
  >🚪</button>
)}
{user && (
  <button
    onPointerDown={handleManualSync}
    className={`w-10 h-10 rounded-xl flex items-center justify-center text-base active:opacity-70 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
    title="Sync to cloud"
  >
    {syncing ? '⏳' : '☁️'}
  </button>
)}
            {/* Theme toggle */}
            <button
              onPointerDown={toggleTheme}
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              {isDark ? '🌤' : '🌙'}
            </button>
            <button
              onPointerDown={() => setShowCreate(true)}
              className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-indigo-700"
            >+ New Sheet</button>
          </div>
        </div>

        {/* Free tier usage */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs ${subtext}`}>
              {sheets.length} of 5 free sheets used
            </span>
            <button
              onPointerDown={onUpgrade}
              className="text-indigo-400 text-xs font-semibold"
            >Upgrade →</button>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{ width: `${Math.min((sheets.length / 5) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* User info */}
        {user && (
          <p className={`text-xs ${subtext} mt-2`}>
            ☁️ Synced as {user.email}
          </p>
        )}
      </div>

      {/* Sheet list */}
      <div className="px-4 py-4 space-y-3">
        {loading && (
          <div className="text-center py-20">
            <div className="text-3xl animate-pulse">◎</div>
            <p className={`${subtext} text-sm mt-2`}>
              {syncing ? 'Syncing from cloud...' : 'Loading...'}
            </p>
          </div>
        )}

        {!loading && sheets.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📊</div>
            <p className={`${subtext} text-sm`}>No sheets yet</p>
            <p className={`${subtext} text-xs mt-1 opacity-60`}>
              Tap New Sheet to get started
            </p>
          </div>
        )}

        {sheets.map(sheet => (
          <div
            key={sheet.id}
            className={`${cardBg} border rounded-2xl p-4`}
          >
            <div className="flex items-center justify-between">
              <div
                className="flex-1 py-1"
                onPointerDown={() => onOpenSheet(sheet)}
              >
                <h2 className="font-semibold text-base">{sheet.name}</h2>
                <p className={`${subtext} text-xs mt-1`}>Tap to open</p>
              </div>
              <button
                onPointerDown={() => handleDeleteSheet(sheet.id, sheet.name)}
                className="bg-red-950 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl ml-3 active:bg-red-900"
              >Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Create sheet bottom sheet */}
      {showCreate && (
        <BottomSheet
          title="New Sheet"
          onClose={() => setShowCreate(false)}
          tall
        >
          <input
            autoFocus
            type="text"
            placeholder="Sheet name e.g. Jan Sales"
            value={newSheetName}
            onChange={e => setNewSheetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateSheet()}
            className={`w-full ${inputBg} rounded-xl px-4 py-3 text-base outline-none border focus:border-indigo-500`}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 text-sm font-medium">Columns</p>
              <button
                onPointerDown={addColumn}
                className="text-indigo-400 text-sm py-2 px-3"
              >+ Add</button>
            </div>
            <div className="space-y-2">
              {columns.map(col => (
                <div key={col.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Column name"
                    value={col.name}
                    onChange={e => updateColumn(col.id, 'name', e.target.value)}
                    className={`flex-1 ${inputBg} rounded-xl px-3 py-3 text-sm outline-none border focus:border-indigo-500`}
                  />
                  <select
                    value={col.type}
                    onChange={e => updateColumn(col.id, 'type', e.target.value)}
                    className="bg-gray-800 text-gray-300 rounded-xl px-3 py-3 text-sm outline-none border border-gray-700"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                  <button
                    onPointerDown={() => removeColumn(col.id)}
                    className="text-red-400 text-xl w-10 h-10 flex items-center justify-center"
                  >×</button>
                </div>
              ))}
            </div>
          </div>

          <button
            onPointerDown={handleCreateSheet}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
          >Create Sheet</button>
        </BottomSheet>
      )}

    </div>
  )
}
