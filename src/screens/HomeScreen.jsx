// — HOME SCREEN
import { supabase } from '../supabase'
import { useState, useEffect, useRef } from 'react'
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

// ── Design tokens matching landing page exactly
const D = {
  black:      '#080809',
  surface:    '#0f0f11',
  surface2:   '#16161a',
  surface3:   '#1e1e24',
  border:     '#2a2a35',
  white:      '#f8f8fc',
  white60:    'rgba(248,248,252,0.6)',
  white30:    'rgba(248,248,252,0.3)',
  white10:    'rgba(248,248,252,0.08)',
  indigo:     '#6366f1',
  indigoBright:'#818cf8',
  indigoDim:  '#3730a3',
  green:      '#34d399',
  red:        '#f87171',
  redDim:     'rgba(248,113,113,0.1)',
}

const TEMPLATES = [
  { id: 'blank', name: 'Blank Sheet', icon: '□', columns: [{ name: 'Item', type: 'text' }] },
  { id: 'budget', name: 'Monthly Budget', icon: '◎', columns: [
    { name: 'Date', type: 'date' }, { name: 'Item', type: 'text' },
    { name: 'Category', type: 'text' }, { name: 'Amount', type: 'number' }
  ]},
  { id: 'expense', name: 'Expense Tracker', icon: '◈', columns: [
    { name: 'Date', type: 'date' }, { name: 'Description', type: 'text' },
    { name: 'Amount', type: 'number' }, { name: 'Paid By', type: 'text' }
  ]},
  { id: 'inventory', name: 'Inventory', icon: '◉', columns: [
    { name: 'Item', type: 'text' }, { name: 'Quantity', type: 'number' },
    { name: 'Buying Price', type: 'number' }, { name: 'Selling Price', type: 'number' }
  ]},
  { id: 'sales', name: 'Sales Log', icon: '◆', columns: [
    { name: 'Date', type: 'date' }, { name: 'Customer', type: 'text' },
    { name: 'Item', type: 'text' }, { name: 'Amount', type: 'number' },
    { name: 'Status', type: 'text' }
  ]},
  { id: 'todo', name: 'To-Do List', icon: '◇', columns: [
    { name: 'Task', type: 'text' }, { name: 'Priority', type: 'text' },
    { name: 'Due Date', type: 'date' }, { name: 'Status', type: 'text' }
  ]}
]

export default function HomeScreen({ user, onOpenSheet, onUpgrade, isPro }) {
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
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => { initData() }, [])

  async function initData() {
    setLoading(true)
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
    const [data, bin] = await Promise.all([getSheets(), getBinSheets()])
    setSheets(data)
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

  function getDaysRemaining(deletedAt) {
    const days = Math.ceil((deletedAt + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))
    return Math.max(0, days)
  }

  async function handleCreateSheet() {
    if (creating) return
    const finalName = newSheetName.trim() || 'New Sheet'
    if (hasReachedSheetLimit(sheets.length, isPro)) {
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
      const sheetId = await createSheet(finalName)
      for (let i = 0; i < validColumns.length; i++) {
        await createColumn(sheetId, validColumns[i].name, validColumns[i].type, i)
      }
      if (user) syncToCloud(user.id, db)
      await loadSheets()
      setNewSheetName('')
      setColumns([{ id: 1, name: 'Item', type: 'text' }])
      setSelectedTemplate(null)
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteSheet(sheetId, sheetName) {
    if (deleting) return
    setConfirm({
      message: `Move "${sheetName}" to Bin?\nIt will be permanently deleted after 30 days.`,
      confirmLabel: 'Move to Bin',
      onConfirm: async () => {
        setDeleting(true)
        setConfirm(null)
        setSheets(prev => prev.filter(s => s.id !== sheetId))
        try {
          await softDeleteSheet(sheetId)
          if (user) syncToCloud(user.id, db)
          await loadSheets()
        } catch (e) { await loadSheets() }
        finally { setDeleting(false) }
      },
      onCancel: () => setConfirm(null)
    })
  }

  async function handleRestoreSheet(sheetId) {
    if (hasReachedSheetLimit(sheets.length, isPro)) { setPaywall('sheets'); return }
    setDeleting(true)
    try {
      await restoreSheet(sheetId)
      if (user) syncToCloud(user.id, db)
      await loadSheets()
    } catch (e) { await loadSheets() }
    finally { setDeleting(false) }
  }

  async function handlePermanentDelete(sheetId, sheetName) {
    setConfirm({
      message: `Permanently delete "${sheetName}"?\nThis cannot be undone.`,
      confirmLabel: 'Delete Forever',
      onConfirm: async () => {
        setDeleting(true)
        setConfirm(null)
        setBinSheets(prev => prev.filter(s => s.id !== sheetId))
        try {
          await permanentlyDeleteSheet(sheetId)
          if (user) syncToCloud(user.id, db)
          await loadSheets()
        } catch (e) { await loadSheets() }
        finally { setDeleting(false) }
      },
      onCancel: () => setConfirm(null)
    })
  }

  async function handleManualSync() {
      if (!user) return
        setSyncing(true)
          const localSheets = await getSheets()
            const { data: cloudSheets } = await supabase
                .from('sheets')
                    .select('id')
                        .eq('user_id', user.id)
                          
                            if (localSheets.length > 0 && (!cloudSheets || cloudSheets.length === 0)) {
                                // Local has data but cloud is empty — push up
                                    await syncToCloud(user.id, db)
                                        setSyncing(false)
                                            return
                                              }
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
    } catch (e) { console.error('Feedback error:', e) }
    setFeedbackSent(true)
    setTimeout(() => { setShowFeedback(false); setFeedbackText(''); setFeedbackSent(false) }, 2000)
  }

  async function handleReferFriend() {
    const message = `Hey! I've been using Onyx Sheets — a mobile spreadsheet that actually works great on phones. Check it out: https://onyx-sheets.vercel.app`
    if (navigator.share) {
      try { await navigator.share({ title: 'Onyx Sheets', text: message }) }
      catch (e) { if (e.name !== 'AbortError') console.error(e) }
    } else {
      navigator.clipboard?.writeText(message)
      alert('Link copied to clipboard!')
    }
  }

  function handleVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice input is not supported on this browser. Try Chrome.')
      return
    }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = navigator.language || 'en-IN'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onstart = () => setIsListening(true)
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join(' ')
      setFeedbackText(prev => prev ? prev + ' ' + transcript : transcript)
    }
    recognition.onerror = (e) => {
      setIsListening(false)
      if (e.error === 'not-allowed') alert('Microphone access denied.')
    }
    recognition.onend = () => setIsListening(false)
    recognition.start()
  }

  // Light theme uses system colors, dark uses landing page tokens
  const dark = isDark

  return (
    <div style={{
      minHeight: '100vh',
      background: dark ? D.black : '#f4f4f8',
      color: dark ? D.white : '#111',
      fontFamily: "'DM Sans', sans-serif"
    }}>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
          onSecondary={confirm.onSecondary}
          confirmLabel={confirm.confirmLabel}
          secondaryLabel={confirm.secondaryLabel}
        />
      )}

      {paywall && (
        <Paywall
          message={getLimitMessage(paywall)}
          onClose={() => setPaywall(null)}
          onUpgrade={() => { setPaywall(null); onUpgrade() }}
          userEmail={user?.email}
          userId={user?.id}
        />
      )}

      {/* ── Header */}
      <div style={{
        background: dark ? D.surface : '#fff',
        borderBottom: `1px solid ${dark ? D.border : '#e5e5ea'}`,
        padding: '16px'
      }}>
        {/* Row 1 — Logo + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, letterSpacing: '-0.02em', color: dark ? D.white : '#111' }}>
              ◈ Onyx Sheets
            </div>
            {user && (
              <div style={{ fontSize: '0.7rem', color: dark ? D.white60 : '#888', marginTop: '2px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Theme toggle */}
            <ActionBtn dark={dark} onPointerDown={toggleTheme} title="Toggle theme">
              {isDark ? '☀' : '☾'}
            </ActionBtn>

            {/* Sync */}
            {user && (
              <ActionBtn dark={dark} onPointerDown={handleManualSync} title="Sync">
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>{syncing ? '···' : 'SYNC'}</span>
              </ActionBtn>
            )}

            {/* Refer */}
            <ActionBtn dark={dark} onPointerDown={handleReferFriend} title="Refer a friend">
              <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>SHARE</span>
            </ActionBtn>

            {/* Feedback */}
            <ActionBtn dark={dark} onPointerDown={() => setShowFeedback(true)} title="Send feedback">
              <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>HELP</span>
            </ActionBtn>

            {/* Sign out */}
            {user && (
              <ActionBtn dark={dark} onPointerDown={handleSignOut} title="Sign out" danger>
                <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>OUT</span>
              </ActionBtn>
            )}
          </div>
        </div>

        {/* Row 2 — Usage bar + New button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.7rem', color: dark ? D.white60 : '#888' }}>
                {sheets.length} / 5 sheets
              </span>
              <button
                onPointerDown={onUpgrade}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '0.7rem', fontWeight: 600,
                  color: D.indigoBright, cursor: 'pointer'
                }}
              >Upgrade to Pro →</button>
            </div>
            <div style={{
              height: '2px', borderRadius: '2px',
              background: dark ? D.border : '#e5e5ea',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                background: `linear-gradient(90deg, ${D.indigo}, ${D.indigoBright})`,
                width: `${Math.min((sheets.length / 5) * 100, 100)}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          <button
            onPointerDown={() => setShowCreate(true)}
            style={{
              background: D.indigo,
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.01em',
              flexShrink: 0,
              boxShadow: `0 4px 16px rgba(99,102,241,0.3)`
            }}
          >+ New</button>
        </div>
      </div>

      {/* ── Sheet list */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '2rem', opacity: 0.4 }}>◎</div>
            <div style={{ fontSize: '0.8rem', color: dark ? D.white60 : '#888', marginTop: '8px' }}>
              {syncing ? 'Syncing from cloud...' : 'Loading...'}
            </div>
          </div>
        )}

        {!loading && sheets.length === 0 && binSheets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.3 }}>◈</div>
            <div style={{ fontSize: '0.9rem', color: dark ? D.white60 : '#888' }}>No sheets yet</div>
            <div style={{ fontSize: '0.75rem', color: dark ? D.white30 : '#aaa', marginTop: '4px' }}>Tap + New to get started</div>
          </div>
        )}

        {sheets.map(sheet => (
          <div
            key={sheet.id}
            style={{
              background: dark ? D.surface2 : '#fff',
              border: `1px solid ${dark ? D.border : '#e5e5ea'}`,
              borderLeft: `3px solid ${D.indigo}`,
              borderRadius: '12px',
              padding: '14px 14px 14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div
              style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
              onPointerDown={() => onOpenSheet(sheet)}
            >
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: dark ? D.white : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sheet.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: dark ? D.white60 : '#888', marginTop: '2px' }}>
                Tap to open
              </div>
            </div>
            <button
              onPointerDown={() => handleDeleteSheet(sheet.id, sheet.name)}
              disabled={deleting}
              style={{
                background: dark ? D.redDim : '#fff0f0',
                color: D.red,
                border: `1px solid ${dark ? 'rgba(248,113,113,0.2)' : '#fecaca'}`,
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >Delete</button>
          </div>
        ))}

        {/* Bin section */}
        {!loading && binSheets.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <button
              onPointerDown={() => setShowBin(b => !b)}
              style={{
                background: 'none', border: 'none', padding: '8px 0',
                display: 'flex', alignItems: 'center', gap: '6px',
                color: dark ? D.white60 : '#888',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', width: '100%'
              }}
            >
              <span>Bin ({binSheets.length})</span>
              <span style={{ marginLeft: 'auto' }}>{showBin ? '▲' : '▼'}</span>
            </button>

            {showBin && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <div style={{ fontSize: '0.7rem', color: dark ? D.white30 : '#aaa' }}>
                  Permanently deleted after 30 days
                </div>
                {binSheets.map(sheet => (
                  <div key={sheet.id} style={{
                    background: dark ? D.surface : '#fafafa',
                    border: `1px solid ${dark ? D.border : '#e5e5ea'}`,
                    borderRadius: '10px',
                    padding: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem', color: dark ? D.white60 : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sheet.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: dark ? D.white30 : '#aaa', marginTop: '2px' }}>
                          {getDaysRemaining(sheet.deletedAt)} days left
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onPointerDown={() => handleRestoreSheet(sheet.id)}
                          disabled={deleting}
                          style={{
                            background: dark ? 'rgba(99,102,241,0.12)' : '#eef',
                            color: D.indigoBright,
                            border: `1px solid rgba(99,102,241,0.3)`,
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >Restore</button>
                        <button
                          onPointerDown={() => handlePermanentDelete(sheet.id, sheet.name)}
                          disabled={deleting}
                          style={{
                            background: dark ? D.redDim : '#fff0f0',
                            color: D.red,
                            border: `1px solid rgba(248,113,113,0.2)`,
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
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

      {/* ── Create Sheet */}
      {showCreate && (
        <BottomSheet title="New Sheet" onClose={() => { setShowCreate(false); setSelectedTemplate(null); setNewSheetName('') }} tall>
          <input
            autoFocus
            type="text"
            placeholder="Sheet name (default: New Sheet)"
            value={newSheetName}
            onChange={e => setNewSheetName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateSheet()}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '1rem',
              color: dark ? D.white : '#111',
              outline: 'none',
              fontFamily: "'DM Sans', sans-serif"
            }}
          />

          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: dark ? D.white60 : '#555', marginBottom: '2px' }}>
            Choose a template
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {TEMPLATES.map(template => {
              const selected = (template.id === 'blank' && !selectedTemplate) || selectedTemplate?.id === template.id
              return (
                <button
                  key={template.id}
                  onPointerDown={() => {
                    setSelectedTemplate(template.id === 'blank' ? null : template)
                    setColumns(template.id === 'blank'
                      ? [{ id: 1, name: 'Item', type: 'text' }]
                      : template.columns.map((c, i) => ({ ...c, id: i + 1 }))
                    )
                  }}
                  style={{
                    background: selected ? 'rgba(99,102,241,0.12)' : dark ? D.surface3 : '#f4f4f8',
                    border: `1px solid ${selected ? 'rgba(99,102,241,0.4)' : dark ? D.border : '#ddd'}`,
                    borderRadius: '10px',
                    padding: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{template.icon}</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: dark ? D.white : '#111' }}>{template.name}</div>
                  <div style={{ fontSize: '0.68rem', color: dark ? D.white60 : '#888', marginTop: '2px' }}>
                    {template.columns.length} columns
                  </div>
                </button>
              )
            })}
          </div>

          {!selectedTemplate && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: dark ? D.white60 : '#555' }}>Columns</span>
                <button
                  onPointerDown={addColumn}
                  style={{ background: 'none', border: 'none', color: D.indigoBright, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >+ Add column</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {columns.map(col => (
                  <div key={col.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Column name"
                      value={col.name}
                      onChange={e => updateColumn(col.id, 'name', e.target.value)}
                      style={{
                        flex: 1,
                        background: dark ? D.surface3 : '#f4f4f8',
                        border: `1px solid ${dark ? D.border : '#ddd'}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '0.85rem',
                        color: dark ? D.white : '#111',
                        outline: 'none',
                        fontFamily: "'DM Sans', sans-serif"
                      }}
                    />
                    <select
                      value={col.type}
                      onChange={e => updateColumn(col.id, 'type', e.target.value)}
                      style={{
                        background: dark ? D.surface3 : '#f4f4f8',
                        border: `1px solid ${dark ? D.border : '#ddd'}`,
                        borderRadius: '8px',
                        padding: '10px 8px',
                        fontSize: '0.8rem',
                        color: dark ? D.white : '#111',
                        outline: 'none',
                        fontFamily: "'DM Sans', sans-serif"
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                    <button
                      onPointerDown={() => removeColumn(col.id)}
                      style={{
                        background: 'none', border: 'none',
                        color: D.red, fontSize: '1.2rem',
                        cursor: 'pointer', padding: '4px 8px'
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div style={{
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px',
              padding: '12px'
            }}>
              <div style={{ fontSize: '0.72rem', color: dark ? D.white60 : '#888', marginBottom: '8px' }}>Columns in this template:</div>
              {selectedTemplate.columns.map(col => (
                <div key={col.name} style={{ fontSize: '0.8rem', color: dark ? D.white : '#333', padding: '3px 0' }}>
                  {col.type === 'date' ? '◷' : col.type === 'number' ? '#' : 'A'} {col.name}
                </div>
              ))}
            </div>
          )}

          <button
            onPointerDown={handleCreateSheet}
            disabled={creating}
            style={{
              width: '100%',
              background: creating ? D.indigoDim : D.indigo,
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '16px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              boxShadow: creating ? 'none' : `0 4px 20px rgba(99,102,241,0.35)`,
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            {creating ? 'Creating...' : 'Create Sheet'}
          </button>
        </BottomSheet>
      )}

      {/* ── Feedback */}
      {showFeedback && (
        <BottomSheet title="Send Feedback" onClose={() => setShowFeedback(false)}>
          {feedbackSent ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✓</div>
              <div style={{ fontWeight: 600, color: dark ? D.white : '#111' }}>Thank you!</div>
              <div style={{ fontSize: '0.8rem', color: dark ? D.white60 : '#888', marginTop: '4px' }}>Your feedback has been received.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.82rem', color: dark ? D.white60 : '#888', marginBottom: '10px' }}>
                Found a bug? Have a suggestion? We read everything.
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  autoFocus
                  rows={5}
                  placeholder="Tell us what's on your mind..."
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: dark ? D.surface3 : '#f4f4f8',
                    border: `1px solid ${dark ? D.border : '#ddd'}`,
                    borderRadius: '10px',
                    padding: '14px 44px 14px 16px',
                    fontSize: '0.9rem',
                    color: dark ? D.white : '#111',
                    outline: 'none',
                    resize: 'none',
                    fontFamily: "'DM Sans', sans-serif"
                  }}
                />
                <button
                  onPointerDown={handleVoiceInput}
                  style={{
                    position: 'absolute', right: '10px', bottom: '10px',
                    width: '32px', height: '32px',
                    background: isListening ? '#ef4444' : dark ? D.surface3 : '#e5e5ea',
                    border: 'none', borderRadius: '8px',
                    color: isListening ? '#fff' : dark ? D.white60 : '#666',
                    cursor: 'pointer', fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >🎤</button>
              </div>
              {isListening && (
                <div style={{ fontSize: '0.72rem', color: D.indigoBright, textAlign: 'center' }}>
                  Listening... tap mic to stop · Beta
                </div>
              )}
              <button
                onPointerDown={handleFeedbackSubmit}
                style={{
                  width: '100%',
                  background: D.indigo,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px rgba(99,102,241,0.35)`,
                  fontFamily: "'DM Sans', sans-serif"
                }}
              >Send Feedback</button>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  )
// ── Reusable action button component
function ActionBtn({ dark, children, onPointerDown, title, danger }) {
  return (
    <button
      onPointerDown={onPointerDown}
      title={title}
      style={{
        minWidth: '44px',
        height: '36px',
        padding: '0 10px',
        background: danger
          ? (dark ? 'rgba(248,113,113,0.08)' : '#fff0f0')
          : (dark ? D.surface3 : '#f4f4f8'),
        border: `1px solid ${danger
          ? 'rgba(248,113,113,0.2)'
          : dark ? D.border : '#e5e5ea'}`,
        borderRadius: '8px',
        color: danger ? D.red : dark ? D.white60 : '#555',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      {children}
    </button>
  )
}
}
