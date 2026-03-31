// — HOME SCREEN
import { useState, useEffect } from 'react'
import { useTheme } from '../theme'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Paywall from '../components/Paywall'
import {
  createSheet, getSheets, getBinSheets, softDeleteSheet,
  restoreSheet, permanentlyDeleteSheet, cleanupExpiredBinSheets,
  createColumn, db
} from '../db'
import { syncFromCloud, syncToCloud } from '../sync'
import { signOut } from '../auth'
import { hasReachedSheetLimit, getLimitMessage } from '../utils/limits'

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Sheet',
    icon: '📄',
    columns: [{ name: 'Item', type: 'text' }]
  },
  {
    id: 'budget',
    name: 'Monthly Budget',
    icon: '💰',
    columns: [
      { name: 'Date', type: 'date' },
      { name: 'Item', type: 'text' },
      { name: 'Category', type: 'text' },
      { name: 'Amount', type: 'number' }
    ]
  },
  {
    id: 'expense',
    name: 'Expense Tracker',
    icon: '🧾',
    columns: [
      { name: 'Date', type: 'date' },
      { name: 'Description', type: 'text' },
      { name: 'Amount', type: 'number' },
      { name: 'Paid By', type: 'text' }
    ]
  },
  {
    id: 'inventory',
    name: 'Inventory',
    icon: '📦',
    columns: [
      { name: 'Item', type: 'text' },
      { name: 'Quantity', type: 'number' },
      { name: 'Buying Price', type: 'number' },
      { name: 'Selling Price', type: 'number' }
    ]
  },
  {
    id: 'sales',
    name: 'Sales Log',
    icon: '📈',
    columns: [
      { name: 'Date', type: 'date' },
      { name: 'Customer', type: 'text' },
      { name: 'Item', type: 'text' },
      { name: 'Amount', type: 'number' },
      { name: 'Status', type: 'text' }
    ]
  },
  {
    id: 'todo',
    name: 'To-Do List',
    icon: '✅',
    columns: [
      { name: 'Task', type: 'text' },
      { name: 'Priority', type: 'text' },
      { name: 'Due Date', type: 'date' },
      { name: 'Status', type: 'text' }
    ]
  }
]

export default function HomeScreen({ user, onOpenSheet, onUpgrade }) {
  const { isDark, toggleTheme } = useTheme()
  const [sheets, setSheets] = useState([])
  const [binSheets, setBinSheets] = useState([])
  const [showBin, setShowBin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [columns, setColumns] = useState([{ id: 1, name: 'Item', type: 'text' }])
  const [confirm, setConfirm] = useState(null)
  const [paywall, setPaywall] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { initData() }, [])

  async function initData() {
    setLoading(true)
    // Auto-cleanup bin sheets older than 30 days
    await cleanupExpiredBinSheets()
    if (user) {
      setSyncing(true)
      const pulled = await syncFromCloud(user.id, db)
      setSyncing(false)
      if (pulled) { await loadSheets(); setLoading(false); return }
    }
    await loadSheets()
    setLoading(false)
  }

  async function loadSheets() {
    const data = await getSheets()
    setSheets(data)
    const bin = await getBinSheets()
    setBinSheets(bin)
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
    if (creating) return
    if (!newSheetName.trim()) setNewSheetName('New Sheet')
    if (hasReachedSheetLimit(sheets.length, false)) {
      setShowCreate(false)
      setPaywall('sheets')
      return
    }
    const validColumns = selectedTemplate
      ? selectedTemplate.columns
      : columns.filter(c => c.name.trim())
    if (validColumns.length === 0) return
    setCreating(true)
    try {
      const sheetId = await createSheet(newSheetName.trim() || 'New Sheet')
      for (let i = 0; i < validColumns.length; i++) {
        await createColumn(sheetId, validColumns[i].name, validColumns[i].type, i)
      }
      if (user) syncToCloud(user.id, db)
      await loadSheets()
      setNewSheetName('')
      setColumns([{ id: 1, name: 'Item', type: 'text' }])
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteSheet(sheetId, sheetName) {
    if (deleting) return
    setConfirm({
      message: `Move "${sheetName}" to Bin? It will be permanently deleted after 30 days.`,
      onConfirm: async () => {
        setDeleting(true)
        setConfirm(null)
        setSheets(prev => prev.filter(s => s.id !== sheetId))
        try {
          await softDeleteSheet(sheetId)
          if (user) syncToCloud(user.id, db)
          await loadSheets()
        } catch (e) {
          await loadSheets()
        } finally {
          setDeleting(false)
        }
      }
    })
  }

  async function handleRestoreSheet(sheetId, sheetName) {
    if (hasReachedSheetLimit(sheets.length, false)) {
      setPaywall('sheets')
      return
    }
    setDeleting(true)
    try {
      await restoreSheet(sheetId)
      if (user) syncToCloud(user.id, db)
      await loadSheets()
    } catch (e) {
      await loadSheets()
    } finally {
      setDeleting(false)
    }
  }

  async function handlePermanentDelete(sheetId, sheetName) {
    setConfirm({
      message: `Permanently delete "${sheetName}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleting(true)
        setConfirm(null)
        setBinSheets(prev => prev.filter(s => s.id !== sheetId))
        try {
          await permanentlyDeleteSheet(sheetId)
          if (user) syncToCloud(user.id, db)
          await loadSheets()
        } catch (e) {
          await loadSheets()
        } finally {
          setDeleting(false)
        }
      }
    })
  }

  async function handleManualSync() {
    if (!user) return
    setSyncing(true)
    await syncToCloud(user.id, db)
    setSyncing(false)
  }

  async function handleSignOut() {
    await signOut()
    window.location.reload()
  }

  async function handleFeedbackSubmit() {
    if (!feedbackText.trim()) return
    try {
      await fetch('https://formspree.io/f/xdapeark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: feedbackText,
          email: user?.email || 'anonymous',
          _subject: 'Onyx Sheets Feedback'
        })
      })
    } catch (e) {
      console.error('Feedback error:', e)
    }
    setFeedbackSent(true)
    setTimeout(() => {
      setShowFeedback(false)
      setFeedbackText('')
      setFeedbackSent(false)
    }, 2000)
  }

  function getDaysRemaining(deletedAt) {
    const days = Math.ceil((deletedAt + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
    return Math.max(0, days)
  }

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'
  const btnBg = isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'

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
      <div className={`${headerBg} border-b px-4 pt-4 pb-3`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">◈ Onyx Sheets</h1>
            {user && (
              <p className={`text-xs ${subtext} mt-0.5 truncate max-w-48`}>{user.email}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onPointerDown={toggleTheme}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${btnBg} active:opacity-70`}
              title="Toggle theme"
            >{isDark ? '☀️' : '🌙'}</button>

            {user && (
              <button
                onPointerDown={handleManualSync}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${btnBg} active:opacity-70`}
                title="Sync to cloud"
              >{syncing ? '⏳' : '☁️'}</button>
            )}

            <button
              onPointerDown={() => setShowFeedback(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${btnBg} active:opacity-70`}
              title="Send feedback"
            >💬</button>

            {user && (
              <button
                onPointerDown={handleSignOut}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${btnBg} active:opacity-70`}
                title="Sign out"
              >🚪</button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs ${subtext}`}>{sheets.length} / 5 free sheets</span>
              <button
                onPointerDown={onUpgrade}
                className="text-indigo-400 text-xs font-semibold active:opacity-70"
              >Upgrade →</button>
            </div>
            <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${Math.min((sheets.length / 5) * 100, 100)}%` }}
              />
            </div>
          </div>

          <button
            onPointerDown={() => setShowCreate(true)}
            className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-indigo-700 shrink-0"
          >+ New</button>
        </div>
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

        {!loading && sheets.length === 0 && binSheets.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📊</div>
            <p className={`${subtext} text-sm`}>No sheets yet</p>
            <p className={`${subtext} text-xs mt-1 opacity-60`}>Tap + New to get started</p>
          </div>
        )}

        {!loading && sheets.length === 0 && binSheets.length > 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📊</div>
            <p className={`${subtext} text-sm`}>No active sheets</p>
            <p className={`${subtext} text-xs mt-1 opacity-60`}>Check the Bin below to restore sheets</p>
          </div>
        )}

        {sheets.map(sheet => (
          <div key={sheet.id} className={`${cardBg} border rounded-2xl p-4 flex items-center justify-between`}>
            <div className="flex-1 py-1 min-w-0" onPointerDown={() => onOpenSheet(sheet)}>
              <h2 className="font-semibold text-base truncate">{sheet.name}</h2>
              <p className={`${subtext} text-xs mt-0.5`}>Tap to open</p>
            </div>
            <button
              onPointerDown={() => handleDeleteSheet(sheet.id, sheet.name)}
              className="bg-red-950 text-red-400 text-xs font-semibold px-3 py-2 rounded-xl ml-3 active:bg-red-900 shrink-0"
              disabled={deleting}
            >Delete</button>
          </div>
        ))}

        {/* Bin Section */}
        {!loading && binSheets.length > 0 && (
          <div className="pt-4">
            <button
              onPointerDown={() => setShowBin(!showBin)}
              className={`flex items-center gap-2 w-full py-2 ${subtext}`}
            >
              <span className="text-sm">🗑️</span>
              <span className="text-sm font-medium">Bin ({binSheets.length})</span>
              <span className="text-xs ml-auto">{showBin ? '▲' : '▼'}</span>
            </button>

            {showBin && (
              <div className="space-y-2 mt-2">
                <p className={`text-xs ${subtext} opacity-60 mb-3`}>
                  Deleted sheets are permanently removed after 30 days
                </p>
                {binSheets.map(sheet => (
                  <div key={sheet.id} className={`${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-gray-100 border-gray-200'} border rounded-2xl p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-medium text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{sheet.name}</h3>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {getDaysRemaining(sheet.deletedAt)} days remaining
                        </p>
                      </div>
                      <div className="flex gap-2 ml-3 shrink-0">
                        <button
                          onPointerDown={() => handleRestoreSheet(sheet.id, sheet.name)}
                          className={`text-xs font-semibold px-3 py-2 rounded-xl active:opacity-70 ${isDark ? 'bg-indigo-950 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}
                          disabled={deleting}
                        >Restore</button>
                        <button
                          onPointerDown={() => handlePermanentDelete(sheet.id, sheet.name)}
                          className={`text-xs font-semibold px-3 py-2 rounded-xl active:opacity-70 ${isDark ? 'bg-red-950 text-red-400' : 'bg-red-50 text-red-600'}`}
                          disabled={deleting}
                        >Delete Forever</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Sheet */}
      {showCreate && (
        <BottomSheet title="New Sheet" onClose={() => { setShowCreate(false); setSelectedTemplate(null) }} tall>
          <input
            autoFocus
            type="text"
            placeholder="Sheet name e.g. Jan Sales"
            value={newSheetName}
            onChange={e => setNewSheetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateSheet()}
            className={`w-full ${inputBg} rounded-xl px-4 py-3 text-base outline-none border focus:border-indigo-500`}
          />

          <p className={`${subtext} text-sm font-medium`}>Choose a template</p>

          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map(template => (
              <button
                key={template.id}
                onPointerDown={() => {
                  setSelectedTemplate(template.id === 'blank' ? null : template)
                  if (template.id !== 'blank') {
                    setColumns(template.columns.map((c, i) => ({ ...c, id: i + 1 })))
                  } else {
                    setColumns([{ id: 1, name: 'Item', type: 'text' }])
                  }
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  (template.id === 'blank' && !selectedTemplate) ||
                  selectedTemplate?.id === template.id
                    ? isDark ? 'border-indigo-500 bg-indigo-950' : 'border-indigo-500 bg-indigo-100'
                    : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="text-xl mb-1">{template.icon}</div>
                <div className={`text-xs font-semibold ${text}`}>{template.name}</div>
                <div className={`text-xs ${subtext} mt-0.5`}>
                  {template.columns.length} cols
                </div>
              </button>
            ))}
          </div>

          {!selectedTemplate && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className={`${subtext} text-sm font-medium`}>Columns</p>
                <button onPointerDown={addColumn} className="text-indigo-400 text-sm py-2 px-3 active:opacity-70">+ Add</button>
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
                      className={`${isDark ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-700 border-gray-300'} rounded-xl px-3 py-3 text-sm outline-none border`}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                    <button onPointerDown={() => removeColumn(col.id)} className="text-red-400 text-xl w-10 h-10 flex items-center justify-center active:opacity-70">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-xl p-3`}>
              <p className={`text-xs ${subtext} mb-2`}>Columns in this template:</p>
              {selectedTemplate.columns.map(col => (
                <div key={col.name} className={`text-xs ${text} py-1`}>
                  {col.type === 'date' ? '📅' : col.type === 'number' ? '123' : 'Aa'} {col.name}
                </div>
              ))}
            </div>
          )}

          <button
            onPointerDown={handleCreateSheet}
            disabled={creating}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Sheet'}
          </button>
        </BottomSheet>
      )}

      {/* Feedback */}
      {showFeedback && (
        <BottomSheet title="Send Feedback" onClose={() => setShowFeedback(false)}>
          {feedbackSent ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <p className={`${text} font-semibold`}>Thank you!</p>
              <p className={`${subtext} text-sm mt-1`}>Your feedback has been received.</p>
            </div>
          ) : (
            <>
              <p className={`${subtext} text-sm mb-3`}>Found a bug? Have a suggestion? We read everything.</p>
              <textarea
                autoFocus
                rows={5}
                placeholder="Tell us what's on your mind..."
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                className={`w-full ${inputBg} rounded-xl px-4 py-3 text-base outline-none border focus:border-indigo-500 resize-none`}
              />
              <button
                onPointerDown={handleFeedbackSubmit}
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
              >Send Feedback</button>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  )
}
