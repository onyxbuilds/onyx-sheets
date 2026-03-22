// ── GRID SCREEN ───────────────────────────────────────────
// The main spreadsheet view
// Inline cell editing, sort, search, formulas

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../theme'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Paywall from '../components/Paywall'
import {
  getColumns,
  getRows,
  createColumn,
  updateColumn,
  deleteColumn,
  createRow,
  updateCell,
  deleteRow,
  duplicateRow,
  updateSheetName,
  canAddRow
} from '../db'
import { getDisplayValue, isFormula } from '../utils/formulas'
import { exportToCSV, exportToExcel } from '../utils/export'
import { getLimitMessage, hasReachedRowLimit } from '../utils/limits'

export default function GridScreen({ sheet, onBack, onUpgrade }) {
  const { isDark } = useTheme()
  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // Editing states
  const [activeCell, setActiveCell] = useState(null)
  const [activeCellValue, setActiveCellValue] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [sheetName, setSheetName] = useState(sheet.name)

  // UI states
  const [showAddRow, setShowAddRow] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingColumn, setEditingColumn] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [paywall, setPaywall] = useState(null)

  // Form states
  const [formData, setFormData] = useState({})
  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' })
  const [editColData, setEditColData] = useState(null)

  const searchRef = useRef(null)

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [cols, rws] = await Promise.all([
      getColumns(sheet.id),
      getRows(sheet.id)
    ])
    setColumns(cols)
    setRows(rws)
    setLoading(false)
  }

  // ── SHEET NAME ─────────────────────────────────────────

  async function saveSheetName() {
    if (sheetName.trim()) {
      await updateSheetName(sheet.id, sheetName.trim())
    }
    setEditingName(false)
  }

  // ── CELL EDITING ───────────────────────────────────────

  function openCell(rowId, colId, currentValue) {
    setActiveCell({ rowId, colId })
    setActiveCellValue(currentValue || '')
  }

  async function saveCell() {
    if (!activeCell) return
    await updateCell(activeCell.rowId, activeCell.colId, activeCellValue)
    await loadData()
    setActiveCell(null)
    setActiveCellValue('')
  }

  // ── ROW OPERATIONS ─────────────────────────────────────

  async function handleAddRow() {
    const ok = await canAddRow(sheet.id)
    if (!ok) {
      setShowAddRow(false)
      setPaywall('rows')
      return
    }

    const hasData = Object.values(formData).some(v => String(v).trim())
    if (!hasData) return

    await createRow(sheet.id, formData)
setFormData({})
await loadData()
  }

  async function handleDeleteRow(rowId) {
    setConfirm({
      message: 'Delete this row?',
      onConfirm: async () => {
        await deleteRow(rowId, sheet.id)
        await loadData()
        setConfirm(null)
      }
    })
  }

  async function handleDuplicateRow(rowId) {
    const ok = await canAddRow(sheet.id)
    if (!ok) {
      setPaywall('rows')
      return
    }
    await duplicateRow(rowId, sheet.id)
    await loadData()
  }

  // ── COLUMN OPERATIONS ──────────────────────────────────

  async function handleAddColumn() {
    if (!newColumn.name.trim()) return
    const position = columns.length
    await createColumn(sheet.id, newColumn.name.trim(), newColumn.type, position)
    await loadData()
    setNewColumn({ name: '', type: 'text' })
    setShowAddColumn(false)
  }

  async function handleUpdateColumn() {
    if (!editColData?.name.trim()) return
    await updateColumn(editColData.id, {
      name: editColData.name,
      type: editColData.type
    })
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  async function handleDeleteColumn(colId) {
    if (columns.length === 1) return
    setConfirm({
      message: `Delete column "${editColData?.name}"? All data in this column will be lost.`,
      onConfirm: async () => {
        await deleteColumn(colId, sheet.id)
        await loadData()
        setEditingColumn(null)
        setEditColData(null)
        setConfirm(null)
      }
    })
  }

  // ── SORT ───────────────────────────────────────────────

  function handleSort(colId) {
    setSortConfig(prev => {
      if (prev?.colId === colId) {
        return prev.dir === 'asc'
          ? { colId, dir: 'desc' }
          : null
      }
      return { colId, dir: 'asc' }
    })
  }

  // ── SEARCH & SORT DERIVED DATA ─────────────────────────

  let displayRows = [...rows]

  // Apply search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    displayRows = displayRows.filter(row =>
      columns.some(col => {
        const val = String(row.cells?.[col.id] || '').toLowerCase()
        return val.includes(q)
      })
    )
  }

  // Apply sort
  if (sortConfig) {
    displayRows.sort((a, b) => {
      const aVal = a.cells?.[sortConfig.colId] || ''
      const bVal = b.cells?.[sortConfig.colId] || ''
      const aNum = parseFloat(aVal)
      const bNum = parseFloat(bVal)
      const isNumeric = !isNaN(aNum) && !isNaN(bNum)

      if (isNumeric) {
        return sortConfig.dir === 'asc' ? aNum - bNum : bNum - aNum
      }
      return sortConfig.dir === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    })
  }

  // ── EXPORT ─────────────────────────────────────────────

  function handleCSVExport() {
    exportToCSV(sheet, columns, rows)
  }

  async function handleExcelExport() {
    setPaywall('excelExport')
  }

  // ── THEME ──────────────────────────────────────────────

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50'
  const headerBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
  const gridHeaderBg = isDark ? 'bg-gray-900' : 'bg-gray-100'
  const cellBorder = isDark ? 'border-gray-900' : 'border-gray-200'
  const text = isDark ? 'text-white' : 'text-gray-900'
  const subtext = isDark ? 'text-gray-400' : 'text-gray-500'
  const inputBg = isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'

  if (loading) {
    return (
      <div className={`min-h-screen ${bg} flex items-center justify-center`}>
        <div className="text-3xl animate-pulse">⬡</div>
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
          onUpgrade={() => {
            setPaywall(null)
            onUpgrade()
          }}
        />
      )}

      {/* Header */}
      <div className={`${headerBg} border-b px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={onBack}
              className={`${subtext} text-2xl w-10 h-10 flex items-center justify-center shrink-0`}
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
                onClick={() => setEditingName(true)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span className="font-bold text-base truncate">{sheetName}</span>
                <span className="text-indigo-400 text-xs border border-indigo-800 bg-indigo-950 px-2 py-0.5 rounded-lg shrink-0">✏️</span>
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => {
                setShowSearch(!showSearch)
                setTimeout(() => searchRef.current?.focus(), 100)
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}
            >🔍</button>
            <button
              onClick={handleCSVExport}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
            >CSV</button>
            <button
              onClick={handleExcelExport}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold bg-green-900 text-green-300"
            >XLS</button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
            <div className="mt-3 relative">
                <input
                      ref={searchRef}
                            type="text"
                                  placeholder="Search in sheet..."
                                        value={searchQuery}
                                              onChange={e => setSearchQuery(e.target.value)}
                                                    className={`w-full ${inputBg} rounded-xl px-4 py-2.5 pr-10 text-sm outline-none border focus:border-indigo-500`}
                                                        />
                                                            {searchQuery.length > 0 && (
                                                                  <button
                                                                          onClick={() => setSearchQuery('')}
                                                                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl w-6 h-6 flex items-center justify-center"
                                                                                        >×</button>
                                                                                            )}
                                                                                              </div>
                                                                                              )}

        {/* Row count */}
        <div className="flex items-center justify-between mt-2">
          <p className={`${subtext} text-xs`}>
            {displayRows.length} {searchQuery ? 'results' : 'rows'}
            {rows.length >= 100 && !false && (
              <span className="text-yellow-500 ml-2">· 100 row limit</span>
            )}
          </p>
          {sortConfig && (
            <button
              onClick={() => setSortConfig(null)}
              className="text-indigo-400 text-xs"
            >Clear sort ×</button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto hide-scrollbar relative">
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead className={`sticky top-0 z-20 ${gridHeaderBg}`}>
              <tr className={`${gridHeaderBg} border-b ${cellBorder}`}>
              {/* Row number header */}
              <th className={`${subtext} text-xs px-3 py-3 text-left sticky left-0 ${gridHeaderBg} z-10`}
                style={{ minWidth: '48px' }}>
                #
              </th>

              {columns.map(col => (
                <th
                  key={col.id}
                  className={`text-xs font-semibold px-4 py-3 text-left border-l ${cellBorder}`}
                  style={{ minWidth: '140px' }}
                >
                  <div className="flex items-center gap-1">
                    {/* Sort button */}
                    <button
                      onClick={() => handleSort(col.id)}
                      className="flex items-center gap-1 flex-1 text-left"
                    >
                      <span className={text}>
  {String.fromCharCode(65 + columns.indexOf(col))} — {col.name}
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

                    {/* Edit column button */}
                    <button
                      onClick={() => {
                        setEditingColumn(col)
                        setEditColData({ ...col })
                      }}
                      className="text-indigo-500 text-xs px-1"
                    >✏️</button>
                  </div>
                </th>
              ))}

              {/* Add column header */}
              <th className={`border-l ${cellBorder} px-3`} style={{ minWidth: '60px' }}>
                <button
                  onClick={() => setShowAddColumn(true)}
                  className="text-indigo-400 text-xs py-2 whitespace-nowrap"
                >+ Col</button>
              </th>
            </tr>
          </thead>

          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className={`text-center py-20 ${subtext} text-sm`}
                >
                  {searchQuery ? 'No results found' : 'No rows yet. Tap + to add data.'}
                </td>
              </tr>
            )}

            {displayRows.map((row, index) => (
              <tr
                key={row.id}
                className={`border-b ${cellBorder}`}
              >
                {/* Row number + actions */}
                <td
                  className={`${subtext} text-xs px-2 py-3 sticky left-0 ${isDark ? 'bg-gray-950' : 'bg-gray-50'} z-10`}
                  style={{ minWidth: '48px' }}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <span>{index + 1}</span>
                    <button
                      onClick={() => handleDuplicateRow(row.id)}
                      className={`text-xs w-6 h-6 rounded flex items-center justify-center ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-500'}`}
                      title="Duplicate row"
                    >⧉</button>
                    <button
                      onClick={() => handleDeleteRow(row.id)}
                      className="bg-red-950 text-red-400 text-xs w-6 h-6 rounded flex items-center justify-center"
                      title="Delete row"
                    >✕</button>
                  </div>
                </td>

                {columns.map(col => {
                  const isActive = activeCell?.rowId === row.id && activeCell?.colId === col.id
                  const rawValue = row.cells?.[col.id] || ''
                  const displayValue = getDisplayValue(rawValue, rows, columns)

                  return (
                    <td
                      key={col.id}
                      className={`border-l ${cellBorder} p-0`}
                      style={{ minWidth: '140px' }}
                    >
                      {isActive ? (
  <input
    autoFocus
    type={!activeCellValue.startsWith('=') && col.type === 'date' ? 'date' : 'text'}
inputMode={activeCellValue.startsWith('=') ? 'text' : col.type === 'number' ? 'decimal' : 'text'}
                          value={activeCellValue}
                          onChange={e => setActiveCellValue(e.target.value)}
                          onBlur={saveCell}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCell()
                            if (e.key === 'Escape') setActiveCell(null)
                          }}
                          className="w-full h-full bg-indigo-950 text-white px-4 py-4 text-sm outline-none border-2 border-indigo-500"
                          style={{ minWidth: '140px' }}
                        />
                      ) : (
                        <div
                          onClick={() => openCell(row.id, col.id, rawValue)}
                          className={`px-4 py-4 text-sm cursor-pointer min-h-14 ${
                            isDark ? 'hover:bg-gray-900' : 'hover:bg-gray-100'
                          } ${isFormula(rawValue) ? 'text-indigo-400' : text}`}
                          style={{ minWidth: '140px' }}
                        >
                          {displayValue || (
                            <span className={`${isDark ? 'text-gray-700' : 'text-gray-300'} text-xs`}>
                              tap to edit
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  )
                })}

                <td className={`border-l ${cellBorder}`} style={{ minWidth: '60px' }} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddRow(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white w-16 h-16 rounded-full text-3xl shadow-2xl shadow-indigo-900 flex items-center justify-center active:bg-indigo-700 z-40"
      >+</button>

      {/* Add Row */}
      {showAddRow && (
        <BottomSheet
          title="Add Row"
          onClose={() => { setShowAddRow(false); setFormData({}) }}
          tall
        >
          {columns.map((col, index) => (
            <div key={col.id}>
              <label className={`${subtext} text-sm font-medium block mb-2`}>
                {col.name}
              </label>
              <input
                type={activeCellValue.startsWith('=') ? 'text' : col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                placeholder={`Enter ${col.name.toLowerCase()}`}
                value={formData[col.id] || ''}
                onChange={e => setFormData({ ...formData, [col.id]: e.target.value })}
                autoFocus={index === 0}
                className={`w-full ${inputBg} rounded-xl px-4 py-4 text-base outline-none border focus:border-indigo-500`}
              />
            </div>
          ))}
          <button
            onClick={handleAddRow}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
          >Add & Next</button>
        </BottomSheet>
      )}

      {/* Add Column */}
      {showAddColumn && (
        <BottomSheet
          title="Add Column"
          onClose={() => setShowAddColumn(false)}
        >
          <input
            autoFocus
            type="text"
            placeholder="Column name"
            value={newColumn.name}
            onChange={e => setNewColumn({ ...newColumn, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
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
            onClick={handleAddColumn}
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
            onClick={handleUpdateColumn}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
          >Save Changes</button>
          <button
            onClick={() => handleDeleteColumn(editColData.id)}
            className="w-full bg-red-950 text-red-400 font-bold py-4 rounded-xl text-base active:bg-red-900"
          >Delete Column</button>
        </BottomSheet>
      )}
    </div>
  )
}