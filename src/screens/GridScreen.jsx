// GridScreen.jsx — Optimized spreadsheet view

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTheme } from '../theme'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Paywall from '../components/Paywall'
import Cell from '../components/Cell'
import {
  getColumns, getRows, createColumn, updateColumn,
  deleteColumn, createRow, insertRow, updateCell, deleteRow,
  duplicateRow, updateSheetName, canAddRow, db
} from '../db'
import { exportToCSV, exportToPDF, parseCSV } from '../utils/export'
import { syncToCloud } from '../sync'
import { getLimitMessage } from '../utils/limits'

const MAX_HISTORY = 50

export default function GridScreen({ sheet, onBack, onUpgrade, user, isPro }) {
  const { isDark } = useTheme()

  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [sheetName, setSheetName] = useState(sheet.name)

  const [showAddRow, setShowAddRow] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingColumn, setEditingColumn] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [rowMenu, setRowMenu] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState(null)

  const [confirm, setConfirm] = useState(null)
  const [paywall, setPaywall] = useState(null)

  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' })
  const [editColData, setEditColData] = useState(null)

  // Undo/Redo history
  const [history, setHistory] = useState([]) // [{rowId, colId, oldValue, newValue}]
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoing = useRef(false)

  const headerRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [cols, rws] = await Promise.all([
      getColumns(sheet.id),
      getRows(sheet.id)
    ])
    setColumns(cols)
    setRows(rws)
    setLoading(false)
  }

  async function saveSheetName() {
    if (sheetName.trim()) await updateSheetName(sheet.id, sheetName.trim())
    setEditingName(false)
  }

  const handleCellSave = useCallback(async (rowId, colId, value) => {
    // Get old value for undo history
    const oldValue = rows.find(r => r.id === rowId)?.cells?.[colId] || ''

    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row
      return { ...row, cells: { ...row.cells, [colId]: value } }
    }))

    try {
      await updateCell(rowId, colId, value)
      if (user) syncToCloud(user.id, db)

      // Push to history only if value actually changed and not from undo/redo
      if (!isUndoRedoing.current && value !== oldValue) {
        setHistory(prev => {
          // Truncate any redo history ahead of current index
          const newHistory = prev.slice(0, historyIndex + 1)
          newHistory.push({ rowId, colId, oldValue, newValue: value })
          // Cap at MAX_HISTORY
          if (newHistory.length > MAX_HISTORY) newHistory.shift()
          return newHistory
        })
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1))
      }
    } catch (e) {
      loadData()
    }
  }, [user, rows, historyIndex])

  async function handleUndo() {
    if (historyIndex < 0) return
    const entry = history[historyIndex]
    isUndoRedoing.current = true
    await updateCell(entry.rowId, entry.colId, entry.oldValue)
    setRows(prev => prev.map(row => {
      if (row.id !== entry.rowId) return row
      return { ...row, cells: { ...row.cells, [entry.colId]: entry.oldValue } }
    }))
    setHistoryIndex(prev => prev - 1)
    if (user) syncToCloud(user.id, db)
    isUndoRedoing.current = false
  }

  async function handleRedo() {
    if (historyIndex >= history.length - 1) return
    const entry = history[historyIndex + 1]
    isUndoRedoing.current = true
    await updateCell(entry.rowId, entry.colId, entry.newValue)
    setRows(prev => prev.map(row => {
      if (row.id !== entry.rowId) return row
      return { ...row, cells: { ...row.cells, [entry.colId]: entry.newValue } }
    }))
    setHistoryIndex(prev => prev + 1)
    if (user) syncToCloud(user.id, db)
    isUndoRedoing.current = false
  }

  async function handleAddRow(formData) {
    const ok = await canAddRow(sheet.id)
    if (!ok) {
      setShowAddRow(false)
      setPaywall('rows')
      return
    }
    await createRow(sheet.id, formData)
    if (user) syncToCloud(user.id, db)
    await loadData()
  }

  async function handleDeleteRow(rowId) {
    setConfirm({
      message: 'Delete this row?',
      onConfirm: async () => {
        setRows(prev => prev.filter(r => r.id !== rowId))
        setConfirm(null)
        await deleteRow(rowId, sheet.id)
        if (user) syncToCloud(user.id, db)
      }
    })
  }

  async function handleDuplicateRow(rowId) {
    const ok = await canAddRow(sheet.id)
    if (!ok) { setPaywall('rows'); return }
    await duplicateRow(rowId, sheet.id)
    if (user) syncToCloud(user.id, db)
    await loadData()
  }

  async function handleInsertRow(rowId, position) {
    const ok = await canAddRow(sheet.id)
    if (!ok) { setPaywall('rows'); return }
    const allRows = [...rows].sort((a, b) => a.createdAt - b.createdAt)
    const idx = allRows.findIndex(r => r.id === rowId)
    if (position === 'above') {
      const afterRowId = idx > 0 ? allRows[idx - 1].id : null
      await insertRow(sheet.id, afterRowId, rowId)
    } else {
      const beforeRowId = idx < allRows.length - 1 ? allRows[idx + 1].id : null
      await insertRow(sheet.id, rowId, beforeRowId)
    }
    if (user) syncToCloud(user.id, db)
    await loadData()
    setRowMenu(null)
  }

  async function handleUpdateColumn() {
    if (!editColData?.name.trim()) return
    await updateColumn(editColData.id, { name: editColData.name, type: editColData.type })
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  async function handleDeleteColumn(colId) {
    if (columns.length === 1) return
    setConfirm({
      message: `Delete column "${editColData?.name}"? All data will be lost.`,
      onConfirm: async () => {
        await deleteColumn(colId, sheet.id)
        await loadData()
        setEditingColumn(null)
        setEditColData(null)
        setConfirm(null)
      }
    })
  }

  async function handleInsertColumnLeft() {
    const idx = columns.findIndex(c => c.id === editColData.id)
    for (let i = columns.length - 1; i >= idx; i--) {
      await updateColumn(columns[i].id, { position: i + 1 })
    }
    await createColumn(sheet.id, 'New Column', 'text', idx)
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  async function handleInsertColumnRight() {
    const idx = columns.findIndex(c => c.id === editColData.id)
    for (let i = columns.length - 1; i > idx; i--) {
      await updateColumn(columns[i].id, { position: i + 1 })
    }
    await createColumn(sheet.id, 'New Column', 'text', idx + 1)
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  function handleSort(colId) {
    setSortConfig(prev => {
      if (prev?.colId === colId) {
        return prev.dir === 'asc' ? { colId, dir: 'desc' } : null
      }
      return { colId, dir: 'asc' }
    })
  }

  function handleBodyScroll(e) {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.target.scrollLeft
    }
  }

  async function handleCSVImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCSV(text)
    if (!parsed) return
    const { headers, rows: csvRows } = parsed
    const newColIds = []
    for (let i = 0; i < headers.length; i++) {
      const colId = await createColumn(sheet.id, headers[i], 'text', i)
      newColIds.push(colId)
    }
    for (const csvRow of csvRows) {
      const cellData = {}
      headers.forEach((header, i) => {
        cellData[newColIds[i]] = csvRow[header] || ''
      })
      await createRow(sheet.id, cellData)
    }
    if (user) syncToCloud(user.id, db)
    await loadData()
    setShowMoreMenu(false)
  }

  async function handleShare() {
    const csvContent = columns.map(c => c.name).join(',') + '\n' +
      rows.map(row =>
        columns.map(col => {
          const val = String(row.cells?.[col.id] || '')
          return val.includes(',') ? `"${val}"` : val
        }).join(',')
      ).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const file = new File([blob], `${sheet.name}.csv`, { type: 'text/csv' })
    if (navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: sheet.name, text: `Sharing: ${sheet.name}`, files: [file] })
      } catch (e) {
        if (e.name !== 'AbortError') exportToCSV(sheet, columns, rows)
      }
    } else if (navigator.share) {
      try {
        await navigator.share({ title: sheet.name, text: `${sheet.name} — ${rows.length} rows` })
      } catch (e) {
        if (e.name !== 'AbortError') exportToCSV(sheet, columns, rows)
      }
    } else {
      exportToCSV(sheet, columns, rows)
    }
  }

  const displayRows = useMemo(() => {
    let result = [...rows]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(row =>
        columns.some(col =>
          String(row.cells?.[col.id] || '').toLowerCase().includes(q)
        )
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a.cells?.[sortConfig.colId] || ''
        const bVal = b.cells?.[sortConfig.colId] || ''
        const aNum = parseFloat(aVal)
        const bNum = parseFloat(bVal)
        const isNumeric = !isNaN(aNum) && !isNaN(bNum)
        if (isNumeric) return sortConfig.dir === 'asc' ? aNum - bNum : bNum - aNum
        return sortConfig.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }
    return result
  }, [rows, columns, searchQuery, sortConfig])

  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const gridHeaderBg = isDark ? 'bg-gray-900' : 'bg-gray-100'
  const cellBorder = isDark ? 'border-gray-900' : 'border-gray-200'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'
  const btnBg = isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'

  if (loading) {
    return (
      <div className={`h-screen ${bg} flex items-center justify-center`}>
        <div className="text-3xl animate-pulse">◎</div>
      </div>
    )
  }

  return (
    <div className={`h-screen ${bg} ${text} flex flex-col overflow-hidden`} style={{ height: '100dvh' }}>

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
          userEmail={user?.email}
          userId={user?.id}
        />
      )}

      {/* Header */}
      <div className={`${headerBg} border-b px-4 py-3 shrink-0`}>
        <div className="flex items-center justify-between">

          {/* Left — back + sheet name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onPointerDown={onBack}
              className={`${isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'} text-xl font-bold w-10 h-10 flex items-center justify-center rounded-xl shrink-0 active:opacity-70`}
            >←</button>

            {editingName ? (
              <input
                autoFocus
                type="text"
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                onBlur={saveSheetName}
                onKeyDown={e => e.key === 'Enter' && saveSheetName()}
                className={`${inputBg} rounded-lg px-3 py-2 text-base outline-none border border-indigo-500 flex-1 min-w-0`}
              />
            ) : (
              <button
                onPointerDown={() => setEditingName(true)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="font-bold text-base truncate">{sheetName}</span>
                <span className="text-indigo-400 text-xs border border-indigo-800 bg-indigo-950 px-2 py-0.5 rounded-lg shrink-0">✏️</span>
              </button>
            )}
          </div>

          {/* Right — action buttons */}
          <div className="flex items-center gap-1 ml-2">

            {/* Undo */}
            <button
              onPointerDown={handleUndo}
              disabled={!canUndo}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70 ${
                canUndo ? btnBg : isDark ? 'bg-gray-900 text-gray-700' : 'bg-gray-50 text-gray-300'
              }`}
              title="Undo"
            >↩</button>

            {/* Redo */}
            <button
              onPointerDown={handleRedo}
              disabled={!canRedo}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70 ${
                canRedo ? btnBg : isDark ? 'bg-gray-900 text-gray-700' : 'bg-gray-50 text-gray-300'
              }`}
              title="Redo"
            >↪</button>

            {/* Search */}
            <button
              onPointerDown={() => { setShowSearch(s => !s); setShowMoreMenu(false) }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70 ${btnBg}`}
            >🔍</button>

            {/* Share */}
            <button
              onPointerDown={handleShare}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70 ${btnBg}`}
            >↗️</button>

            {/* More ⋮ */}
            <div className="relative">
              <button
                onPointerDown={() => { setShowMoreMenu(m => !m); setShowSearch(false) }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70 ${showMoreMenu ? 'bg-indigo-600 text-white' : btnBg}`}
              >⋮</button>

              {showMoreMenu && (
                <div
                  className={`absolute right-0 top-11 z-50 rounded-2xl overflow-hidden shadow-2xl border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
                  style={{ minWidth: '180px' }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  {[
                    { label: '📄 Export CSV', action: () => { exportToCSV(sheet, columns, rows); setShowMoreMenu(false) } },
                    { label: '📕 Export PDF', action: () => { exportToPDF(sheet, columns, rows); setShowMoreMenu(false) } },
                    { label: '📗 Export Excel', action: () => { setPaywall('excelExport'); setShowMoreMenu(false) }, pro: true },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onPointerDown={item.action}
                      className={`w-full text-left px-4 py-3 text-sm active:opacity-70 flex items-center justify-between ${
                        i < 2 ? isDark ? 'border-b border-gray-800' : 'border-b border-gray-100' : ''
                      } ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                    >
                      {item.label}
                      {item.pro && <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-lg">Pro</span>}
                    </button>
                  ))}
                  <label
                    className={`w-full text-left px-4 py-3 text-sm flex items-center cursor-pointer ${isDark ? 'text-gray-300 border-t border-gray-800' : 'text-gray-700 border-t border-gray-100'}`}
                  >
                    📥 Import CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {showSearch && (
          <div className="mt-3 relative">
            <input
              autoFocus
              type="text"
              placeholder="Search in sheet..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full ${inputBg} rounded-xl px-4 py-2.5 pr-10 text-sm outline-none border focus:border-indigo-500`}
            />
            {searchQuery.length > 0 && (
              <button
                onPointerDown={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl w-6 h-6 flex items-center justify-center"
              >×</button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className={`${subtext} text-xs`}>
            {displayRows.length} {searchQuery ? 'results' : 'rows'}
            {rows.length >= 100 && <span className="text-yellow-500 ml-2">· 100 row limit</span>}
          </p>
          {sortConfig && (
            <button onPointerDown={() => setSortConfig(null)} className="text-indigo-400 text-xs">
              Clear sort ×
            </button>
          )}
        </div>
      </div>

      {/* Grid — frozen header + scrollable body */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onPointerDown={() => { setShowMoreMenu(false); setRowMenu(null) }}
      >

        {/* Frozen header */}
        <div ref={headerRef} className={`${gridHeaderBg} shrink-0 overflow-x-hidden`}>
          <table className="border-collapse" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '48px', minWidth: '48px' }} />
              {columns.map(col => <col key={col.id} style={{ width: '140px', minWidth: '140px' }} />)}
              <col style={{ width: '60px', minWidth: '60px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className={`${subtext} text-xs px-3 py-3 text-left border-b ${cellBorder} ${gridHeaderBg}`}>#</th>
                {columns.map((col, colIndex) => (
                  <th key={col.id} className={`text-xs font-semibold px-4 py-3 text-left border-l border-b ${cellBorder} ${gridHeaderBg}`}>
                    <div className="flex items-center gap-1">
                      <button
                        onPointerDown={() => handleSort(col.id)}
                        className="flex items-center gap-1 flex-1 text-left truncate"
                      >
                        <span className={`${text} truncate`}>{String.fromCharCode(65 + colIndex)} — {col.name}</span>
                        <span className={`${subtext} shrink-0`}>
                          {col.type === 'number' ? '123' : col.type === 'date' ? '📅' : 'Aa'}
                        </span>
                        {sortConfig?.colId === col.id && (
                          <span className="text-indigo-400 shrink-0">{sortConfig.dir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                      <button
                        onPointerDown={() => { setEditingColumn(col); setEditColData({ ...col }) }}
                        className="text-indigo-500 text-xs px-1 active:opacity-70 shrink-0"
                      >✏️</button>
                    </div>
                  </th>
                ))}
                <th className={`border-l border-b ${cellBorder} px-3 ${gridHeaderBg}`}>
                  <button
                    onPointerDown={() => setShowAddColumn(true)}
                    className="text-indigo-400 text-xs py-2 whitespace-nowrap active:opacity-70"
                  >+ Col</button>
                </th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-auto"
          onScroll={handleBodyScroll}
        >
          <table className="border-collapse" style={{ minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '48px', minWidth: '48px' }} />
              {columns.map(col => <col key={col.id} style={{ width: '140px', minWidth: '140px' }} />)}
              <col style={{ width: '60px', minWidth: '60px' }} />
            </colgroup>
            <tbody>
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className={`text-center py-20 ${subtext} text-sm`}>
                    {searchQuery ? 'No results found' : 'No rows yet. Tap + to add data.'}
                  </td>
                </tr>
              )}

              {displayRows.map((row, index) => (
                <tr key={row.id} className={`border-b ${cellBorder}`}>
                  <td className={`${subtext} text-xs px-2 py-3 ${isDark ? 'bg-gray-950' : 'bg-gray-50'} relative sticky left-0 z-10`}>
                    <div className="flex flex-col items-center gap-1.5">
                      <span>{index + 1}</span>
                      <button
                        onPointerDown={e => {
                          e.stopPropagation()
                          setRowMenu(rowMenu?.rowId === row.id ? null : { rowId: row.id, index })
                        }}
                        className={`text-xs w-6 h-6 rounded flex items-center justify-center active:opacity-70 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'}`}
                      >⋮</button>
                    </div>

                    {rowMenu?.rowId === row.id && (
                      <div
                        className={`absolute left-8 z-50 rounded-xl overflow-hidden shadow-2xl border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
                        style={{ minWidth: '160px', top: index < 3 ? '0' : 'auto', bottom: index < 3 ? 'auto' : '0' }}
                        onPointerDown={e => e.stopPropagation()}
                      >
                        {[
                          { label: '↑ Insert Above', action: () => handleInsertRow(row.id, 'above') },
                          { label: '↓ Insert Below', action: () => handleInsertRow(row.id, 'below') },
                          { label: '⧉ Duplicate', action: () => { handleDuplicateRow(row.id); setRowMenu(null) } },
                          { label: '× Delete', action: () => { handleDeleteRow(row.id); setRowMenu(null) }, danger: true },
                        ].map((item, i) => (
                          <button
                            key={i}
                            onPointerDown={item.action}
                            className={`w-full text-left px-4 py-3 text-sm active:opacity-70 ${
                              i < 3 ? isDark ? 'border-b border-gray-800' : 'border-b border-gray-100' : ''
                            } ${item.danger ? 'text-red-400' : isDark ? 'text-gray-300' : 'text-gray-700'}`}
                          >{item.label}</button>
                        ))}
                      </div>
                    )}
                  </td>

                  {columns.map(col => (
                    <Cell
                      key={col.id}
                      row={row}
                      col={col}
                      rows={rows}
                      columns={columns}
                      onSave={handleCellSave}
                      isDark={isDark}
                    />
                  ))}

                  <td className={`border-l ${cellBorder}`} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAB */}
      <button
        onPointerDown={() => setShowAddRow(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white w-12 h-12 rounded-full text-xl shadow-lg shadow-indigo-900 flex items-center justify-center active:bg-indigo-700 z-40"
      >+</button>

      {/* Add Row */}
      {showAddRow && (
        <AddRowSheet
          columns={columns}
          inputBg={inputBg}
          subtext={subtext}
          onClose={() => setShowAddRow(false)}
          onAdd={handleAddRow}
        />
      )}

      {/* Add Column */}
      {showAddColumn && (
        <BottomSheet title="Add Column" onClose={() => setShowAddColumn(false)}>
          <input
            autoFocus
            type="text"
            placeholder="Column name"
            value={newColumn.name}
            onChange={e => setNewColumn({ ...newColumn, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && (async () => {
              if (!newColumn.name.trim()) return
              await createColumn(sheet.id, newColumn.name.trim(), newColumn.type, columns.length)
              await loadData()
              setNewColumn({ name: '', type: 'text' })
              setShowAddColumn(false)
            })()}
            className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border focus:border-indigo-500`}
          />
          <select
            value={newColumn.type}
            onChange={e => setNewColumn({ ...newColumn, type: e.target.value })}
            className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border`}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
          <button
            onPointerDown={async () => {
              if (!newColumn.name.trim()) return
              await createColumn(sheet.id, newColumn.name.trim(), newColumn.type, columns.length)
              await loadData()
              setNewColumn({ name: '', type: 'text' })
              setShowAddColumn(false)
            }}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
          >Add Column</button>
        </BottomSheet>
      )}

      {/* Edit Column */}
      {editingColumn && editColData && (
        <BottomSheet
          title="Edit Column"
          onClose={() => { setEditingColumn(null); setEditColData(null) }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Column name"
            value={editColData.name}
            onChange={e => setEditColData({ ...editColData, name: e.target.value })}
            className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border focus:border-indigo-500`}
          />
          <select
            value={editColData.type}
            onChange={e => setEditColData({ ...editColData, type: e.target.value })}
            className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border`}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
          <button
            onPointerDown={handleInsertColumnLeft}
            className={`w-full font-semibold py-3 rounded-xl text-sm active:opacity-70 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
          >← Insert Column Left</button>
          <button
            onPointerDown={handleInsertColumnRight}
            className={`w-full font-semibold py-3 rounded-xl text-sm active:opacity-70 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}
          >Insert Column Right →</button>
          <button
            onPointerDown={handleUpdateColumn}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
          >Save Changes</button>
          <button
            onPointerDown={() => handleDeleteColumn(editColData.id)}
            className="w-full bg-red-950 text-red-400 font-bold py-4 rounded-xl text-base active:bg-red-900"
          >Delete Column</button>
        </BottomSheet>
      )}

    </div>
  )
}

function AddRowSheet({ columns, inputBg, subtext, onClose, onAdd }) {
  const [formData, setFormData] = useState({})
  const firstInputRef = useRef(null)

  async function handleSubmit() {
    const hasData = Object.values(formData).some(v => String(v).trim())
    if (!hasData) return
    await onAdd(formData)
    setFormData({})
    setTimeout(() => firstInputRef.current?.focus(), 50)
  }

  return (
    <BottomSheet title="Add Row" onClose={onClose} tall>
      {columns.map((col, index) => (
        <div key={col.id}>
          <label className={`${subtext} text-sm font-medium block mb-2`}>{col.name}</label>
          <input
            ref={index === 0 ? firstInputRef : null}
            type={col.type === 'date' ? 'date' : 'text'}
            inputMode={col.type === 'number' ? 'decimal' : 'text'}
            placeholder={col.type === 'number' ? `Enter ${col.name.toLowerCase()} or =formula` : `Enter ${col.name.toLowerCase()}`}
            value={formData[col.id] || ''}
            onChange={e => setFormData(prev => ({ ...prev, [col.id]: e.target.value }))}
            autoFocus={index === 0}
            className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border focus:border-indigo-500`}
          />
        </div>
      ))}
      <button
        onPointerDown={handleSubmit}
        className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
      >Add & Next</button>
    </BottomSheet>
  )
}
