// GridScreen.jsx — Optimized spreadsheet view

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTheme } from '../theme'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Paywall from '../components/Paywall'
import Cell from '../components/Cell'
import {
  getColumns, getRows, createColumn, updateColumn,
  deleteColumn, createRow, updateCell, deleteRow,
  duplicateRow, updateSheetName, canAddRow, db
} from '../db'
import { exportToCSV, exportToPDF, parseCSV } from '../utils/export'
import { syncToCloud } from '../sync'
import { getLimitMessage } from '../utils/limits'

export default function GridScreen({ sheet, onBack, onUpgrade, user }) {
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

  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState(null)

  const [confirm, setConfirm] = useState(null)
  const [paywall, setPaywall] = useState(null)

  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' })
  const [editColData, setEditColData] = useState(null)

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
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row
      return { ...row, cells: { ...row.cells, [colId]: value } }
    }))
    try {
      await updateCell(rowId, colId, value)
      if (user) syncToCloud(user.id, db)
    } catch (e) {
      loadData()
    }
  }, [user])

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

  function handleSort(colId) {
    setSortConfig(prev => {
      if (prev?.colId === colId) {
        return prev.dir === 'asc' ? { colId, dir: 'desc' } : null
      }
      return { colId, dir: 'asc' }
    })
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

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const gridHeaderBg = isDark ? 'bg-gray-900' : 'bg-gray-100'
  const cellBorder = isDark ? 'border-gray-900' : 'border-gray-200'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-3xl animate-pulse">◎</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${bg} ${text} flex flex-col`}>

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
            <div className={`${headerBg} border-b px-4 py-3`}>
                    <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-1 ml-2">
            <button
              onPointerDown={() => setShowSearch(s => !s)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base active:opacity-70 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >🔍</button>
            <button
              onPointerDown={() => exportToCSV(sheet, columns, rows)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold active:opacity-70 ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
            >CSV</button>
            <button
              onPointerDown={() => exportToPDF(sheet, columns, rows)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold bg-red-900 text-red-300 active:opacity-70"
            >PDF</button>
            <button
              onPointerDown={() => setPaywall('excelExport')}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold bg-green-900 text-green-300 active:opacity-70"
            >XLS</button>
            <label
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold active:opacity-70 cursor-pointer ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
              title="Import CSV"
            >↑<input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} /></label>
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

      {/* Grid */}
      <div className="flex-1 overflow-auto relative" style={{ height: 0 }}>
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead className={`sticky top-0 z-20 ${gridHeaderBg}`}>
            <tr className={`${gridHeaderBg}`}>
              <th
                className={`${subtext} text-xs px-3 py-3 text-left sticky top-0 left-0 ${gridHeaderBg} z-30 border-b ${cellBorder}`}
                style={{ minWidth: '48px' }}
              >#</th>

              {columns.map((col, colIndex) => (
                <th
                  key={col.id}
                  className={`text-xs font-semibold px-4 py-3 text-left border-l border-b ${cellBorder} ${gridHeaderBg}`}
                  style={{ minWidth: '140px' }}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onPointerDown={() => handleSort(col.id)}
                      className="flex items-center gap-1 flex-1 text-left"
                    >
                      <span className={text}>
                        {String.fromCharCode(65 + colIndex)} — {col.name}
                      </span>
                      <span className={subtext}>
                        {col.type === 'number' ? '123' : col.type === 'date' ? '📅' : 'Aa'}
                      </span>
                      {sortConfig?.colId === col.id && (
                        <span className="text-indigo-400">
                          {sortConfig.dir === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                    <button
                      onPointerDown={() => {
                        setEditingColumn(col)
                        setEditColData({ ...col })
                      }}
                      className="text-indigo-500 text-xs px-1 active:opacity-70"
                    >✏️</button>
                  </div>
                </th>
              ))}

              <th className={`border-l border-b ${cellBorder} px-3 ${gridHeaderBg}`} style={{ minWidth: '60px' }}>
                <button
                  onPointerDown={() => setShowAddColumn(true)}
                  className="text-indigo-400 text-xs py-2 whitespace-nowrap active:opacity-70"
                >+ Col</button>
              </th>
            </tr>
          </thead>

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
                <td
                  className={`${subtext} text-xs px-2 py-3 sticky left-0 ${isDark ? 'bg-gray-950' : 'bg-gray-50'} z-10`}
                  style={{ minWidth: '48px' }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span>{index + 1}</span>
                    <button
                      onPointerDown={() => handleDuplicateRow(row.id)}
                      className={`text-xs w-6 h-6 rounded flex items-center justify-center active:opacity-70 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'}`}
                      title="Duplicate row"
                    >⧉</button>
                    <button
                      onPointerDown={() => handleDeleteRow(row.id)}
                      className="bg-red-950 text-red-400 text-xs w-6 h-6 rounded flex items-center justify-center active:opacity-70"
                      title="Delete row"
                    >×</button>
                  </div>
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

                <td className={`border-l ${cellBorder}`} style={{ minWidth: '60px' }} />
              </tr>
            ))}
          </tbody>
        </table>
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

  async function handleSubmit() {
    const hasData = Object.values(formData).some(v => String(v).trim())
    if (!hasData) return
    await onAdd(formData)
    setFormData({})
  }

  return (
    <BottomSheet title="Add Row" onClose={onClose} tall>
      {columns.map((col, index) => (
        <div key={col.id}>
          <label className={`${subtext} text-sm font-medium block mb-2`}>{col.name}</label>
          <input
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
