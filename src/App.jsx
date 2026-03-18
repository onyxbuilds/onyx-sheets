import { useState } from 'react'

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-6">
      <div className="bg-gray-800 rounded-2xl p-6 w-full space-y-4">
        <p className="text-white text-base text-center">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-700 text-white font-semibold py-3 rounded-xl"
          >Cancel</button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-xl"
          >Delete</button>
        </div>
      </div>
    </div>
  )
}

function HomeScreen({ sheets, setSheets, onOpenSheet }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [columns, setColumns] = useState([
    { id: 1, name: 'Item', type: 'text' }
  ])
  const [confirm, setConfirm] = useState(null)

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

  function createSheet() {
    if (!newSheetName.trim()) return
    const sheet = {
      id: Date.now(),
      name: newSheetName.trim(),
      columns: columns.filter(c => c.name.trim()),
      rows: []
    }
    setSheets([sheet, ...sheets])
    setNewSheetName('')
    setColumns([{ id: 1, name: 'Item', type: 'text' }])
    setShowCreate(false)
  }

  function deleteSheet(id) {
    setSheets(sheets.filter(s => s.id !== id))
    setConfirm(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">⬡ Onyx</h1>
            <p className="text-xs text-gray-400 mt-0.5">Sheets</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >+ New Sheet</button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {sheets.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-400 text-sm">No sheets yet</p>
            <p className="text-gray-600 text-xs mt-1">Tap New Sheet to get started</p>
          </div>
        )}
        {sheets.map(sheet => (
          <div key={sheet.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 py-2" onClick={() => onOpenSheet(sheet)}>
                <h2 className="text-white font-semibold text-base">{sheet.name}</h2>
                <p className="text-gray-500 text-xs mt-1">
                  {sheet.rows.length} rows · {sheet.columns.length} columns
                </p>
              </div>
              <button
                onClick={() => setConfirm({
                  message: `Delete "${sheet.name}"?`,
                  onConfirm: () => deleteSheet(sheet.id)
                })}
                className="bg-red-950 text-red-400 text-sm font-semibold px-4 py-3 rounded-xl ml-3"
              >Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">New Sheet</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-3xl w-10 h-10 flex items-center justify-center">×</button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Sheet name e.g. Jan Sales"
              value={newSheetName}
              onChange={e => setNewSheetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSheet()}
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-base outline-none border border-gray-700 focus:border-indigo-500"
            />
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-sm font-medium">Columns</p>
                <button onClick={addColumn} className="text-indigo-400 text-sm py-2 px-3">+ Add</button>
              </div>
              <div className="space-y-2">
                {columns.map(col => (
                  <div key={col.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Column name"
                      value={col.name}
                      onChange={e => updateColumn(col.id, 'name', e.target.value)}
                      className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-3 py-3 text-sm outline-none border border-gray-700 focus:border-indigo-500"
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
                      onClick={() => removeColumn(col.id)}
                      className="text-red-400 text-2xl w-10 h-10 flex items-center justify-center"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={createSheet}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base"
            >Create Sheet</button>
          </div>
        </div>
      )}
    </div>
  )
}

function GridScreen({ sheet, onBack, onUpdateSheet }) {
  const [showAddRow, setShowAddRow] = useState(false)
  const [formData, setFormData] = useState({})
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState(sheet.name)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' })
  const [editingColumn, setEditingColumn] = useState(null)
  const [confirm, setConfirm] = useState(null)

  function submitRow() {
    const hasData = Object.values(formData).some(v => String(v).trim())
    if (!hasData) return
    const newRow = { id: Date.now(), cells: { ...formData } }
    onUpdateSheet({ ...sheet, rows: [...sheet.rows, newRow] })
    setFormData({})
  }

  function deleteRow(rowId) {
    onUpdateSheet({ ...sheet, rows: sheet.rows.filter(r => r.id !== rowId) })
    setConfirm(null)
  }

  function saveSheetName() {
    if (newName.trim()) {
      onUpdateSheet({ ...sheet, name: newName.trim() })
    }
    setEditingName(false)
  }

  function addColumn() {
    if (!newColumn.name.trim()) return
    const col = { id: Date.now(), name: newColumn.name.trim(), type: newColumn.type }
    onUpdateSheet({ ...sheet, columns: [...sheet.columns, col] })
    setNewColumn({ name: '', type: 'text' })
    setShowAddColumn(false)
  }

  function saveEditColumn() {
    if (!editingColumn.name.trim()) return
    onUpdateSheet({
      ...sheet,
      columns: sheet.columns.map(c =>
        c.id === editingColumn.id
          ? { ...c, name: editingColumn.name, type: editingColumn.type }
          : c
      )
    })
    setEditingColumn(null)
  }

  function deleteColumn(colId) {
    if (sheet.columns.length === 1) return
    onUpdateSheet({
      ...sheet,
      columns: sheet.columns.filter(c => c.id !== colId),
      rows: sheet.rows.map(r => {
        const cells = { ...r.cells }
        delete cells[colId]
        return { ...r, cells }
      })
    })
    setEditingColumn(null)
    setConfirm(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={onBack}
              className="text-gray-400 text-2xl w-10 h-10 flex items-center justify-center"
            >←</button>
            {editingName ? (
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={saveSheetName}
                onKeyDown={e => e.key === 'Enter' && saveSheetName()}
                className="bg-gray-800 text-white rounded-lg px-3 py-2 text-base outline-none border border-indigo-500 flex-1"
              />
            ) : (
              <button
                className="text-white font-bold text-base flex-1 text-left flex items-center gap-2"
                onClick={() => {
                  setNewName(sheet.name)
                  setEditingName(true)
                }}
              >
                {sheet.name}
                <span className="text-indigo-400 text-xs border border-indigo-800 bg-indigo-950 px-2 py-1 rounded-lg">Rename</span>
              </button>
            )}
          </div>
          <p className="text-gray-500 text-xs ml-2">{sheet.rows.length} rows</p>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-800">
              <th className="text-gray-500 text-xs px-3 py-3 text-left w-12">#</th>
              {sheet.columns.map(col => (
                <th
                  key={col.id}
                  className="text-gray-300 text-xs font-semibold px-4 py-3 text-left min-w-32 border-l border-gray-800"
                >
                  <button
                    onClick={() => setEditingColumn({ ...col })}
                    className="flex items-center gap-1 w-full text-left"
                  >
                    {col.name}
                    <span className="text-gray-600 font-normal">
                      {col.type === 'number' ? '123' : col.type === 'date' ? '📅' : 'Aa'}
                    </span>
                    <span className="text-indigo-500 text-xs ml-1">✏️</span>
                  </button>
                </th>
              ))}
              <th className="border-l border-gray-800 px-3 min-w-16">
                <button
                  onClick={() => setShowAddColumn(true)}
                  className="text-indigo-400 text-xs py-2 px-1 whitespace-nowrap"
                >+ Col</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.length === 0 && (
              <tr>
                <td colSpan={sheet.columns.length + 2} className="text-center py-20 text-gray-600 text-sm">
                  No rows yet. Tap + to add data.
                </td>
              </tr>
            )}
            {sheet.rows.map((row, index) => (
              <tr key={row.id} className="border-b border-gray-900">
                <td className="text-gray-600 text-xs px-3 py-4 w-12">
                  <div className="flex flex-col items-center gap-2">
                    <span>{index + 1}</span>
                    <button
                      onClick={() => setConfirm({
                        message: 'Delete this row?',
                        onConfirm: () => deleteRow(row.id)
                      })}
                      className="bg-red-950 text-red-400 text-xs w-6 h-6 rounded flex items-center justify-center"
                    >✕</button>
                  </div>
                </td>
                {sheet.columns.map(col => (
                  <td key={col.id} className="text-white text-sm px-4 py-4 border-l border-gray-900">
                    {row.cells[col.id] || ''}
                  </td>
                ))}
                <td className="border-l border-gray-900"></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddRow(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white w-16 h-16 rounded-full text-3xl shadow-lg flex items-center justify-center"
      >+</button>

      {/* Add Row */}
      {showAddRow && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Add Row</h2>
              <button
                onClick={() => { setShowAddRow(false); setFormData({}) }}
                className="text-gray-400 text-3xl w-10 h-10 flex items-center justify-center"
              >×</button>
            </div>
            {sheet.columns.map((col, index) => (
              <div key={col.id}>
                <label className="text-gray-400 text-sm font-medium block mb-2">{col.name}</label>
                <input
                  type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                  placeholder={`Enter ${col.name.toLowerCase()}`}
                  value={formData[col.id] || ''}
                  onChange={e => setFormData({ ...formData, [col.id]: e.target.value })}
                  autoFocus={index === 0}
                  className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-4 text-base outline-none border border-gray-700 focus:border-indigo-500"
                />
              </div>
            ))}
            <button
              onClick={submitRow}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base"
            >Add & Next</button>
          </div>
        </div>
      )}

      {/* Add Column */}
      {showAddColumn && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Add Column</h2>
              <button onClick={() => setShowAddColumn(false)} className="text-gray-400 text-3xl w-10 h-10 flex items-center justify-center">×</button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Column name"
              value={newColumn.name}
              onChange={e => setNewColumn({ ...newColumn, name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && addColumn()}
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-4 text-base outline-none border border-gray-700 focus:border-indigo-500"
            />
            <select
              value={newColumn.type}
              onChange={e => setNewColumn({ ...newColumn, type: e.target.value })}
              className="w-full bg-gray-800 text-gray-300 rounded-xl px-4 py-4 text-base outline-none border border-gray-700"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
            <button
              onClick={addColumn}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base"
            >Add Column</button>
          </div>
        </div>
      )}

      {/* Edit Column */}
      {editingColumn && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Edit Column</h2>
              <button onClick={() => setEditingColumn(null)} className="text-gray-400 text-3xl w-10 h-10 flex items-center justify-center">×</button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Column name"
              value={editingColumn.name}
              onChange={e => setEditingColumn({ ...editingColumn, name: e.target.value })}
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-4 text-base outline-none border border-gray-700 focus:border-indigo-500"
            />
            <select
              value={editingColumn.type}
              onChange={e => setEditingColumn({ ...editingColumn, type: e.target.value })}
              className="w-full bg-gray-800 text-gray-300 rounded-xl px-4 py-4 text-base outline-none border border-gray-700"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
            </select>
            <button
              onClick={saveEditColumn}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base"
            >Save Changes</button>
            <button
              onClick={() => setConfirm({
                message: `Delete column "${editingColumn.name}"?`,
                onConfirm: () => deleteColumn(editingColumn.id)
              })}
              className="w-full bg-red-950 text-red-400 font-bold py-4 rounded-xl text-base"
            >Delete Column</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [sheets, setSheets] = useState([])
  const [currentSheet, setCurrentSheet] = useState(null)

  function handleUpdateSheet(updatedSheet) {
    setSheets(prev => prev.map(s => s.id === updatedSheet.id ? updatedSheet : s))
    setCurrentSheet(updatedSheet)
  }

  return currentSheet ? (
    <GridScreen
      sheet={currentSheet}
      onBack={() => setCurrentSheet(null)}
      onUpdateSheet={handleUpdateSheet}
    />
  ) : (
    <HomeScreen
      sheets={sheets}
      setSheets={setSheets}
      onOpenSheet={setCurrentSheet}
    />
  )
}