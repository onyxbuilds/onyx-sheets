import { useState } from 'react'

function HomeScreen({ sheets, setSheets, onOpenSheet }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')
  const [columns, setColumns] = useState([
    { id: 1, name: 'Item', type: 'text' }
  ])

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
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
          <div
            key={sheet.id}
            onClick={() => onOpenSheet(sheet)}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-base">{sheet.name}</h2>
                <p className="text-gray-500 text-xs mt-1">
                  {sheet.rows.length} rows · {sheet.columns.length} columns
                </p>
              </div>
              <div className="text-gray-600 text-xl">›</div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">New Sheet</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 text-2xl">×</button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Sheet name e.g. Jan Sales"
              value={newSheetName}
              onChange={e => setNewSheetName(e.target.value)}
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-base outline-none border border-gray-700 focus:border-indigo-500"
            />
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-400 text-sm font-medium">Columns</p>
                <button onClick={addColumn} className="text-indigo-400 text-sm">+ Add</button>
              </div>
              <div className="space-y-2">
                {columns.map(col => (
                  <div key={col.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Column name"
                      value={col.name}
                      onChange={e => updateColumn(col.id, 'name', e.target.value)}
                      className="flex-1 bg-gray-800 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm outline-none border border-gray-700 focus:border-indigo-500"
                    />
                    <select
                      value={col.type}
                      onChange={e => updateColumn(col.id, 'type', e.target.value)}
                      className="bg-gray-800 text-gray-300 rounded-xl px-3 py-2 text-sm outline-none border border-gray-700"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                    <button onClick={() => removeColumn(col.id)} className="text-red-400 text-lg px-1">×</button>
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

  function submitRow() {
    const hasData = Object.values(formData).some(v => String(v).trim())
    if (!hasData) return
    const newRow = { id: Date.now(), cells: { ...formData } }
    onUpdateSheet({ ...sheet, rows: [...sheet.rows, newRow] })
    setFormData({})
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 text-lg">←</button>
          <h1 className="text-white font-bold text-base">{sheet.name}</h1>
        </div>
        <p className="text-gray-500 text-xs">{sheet.rows.length} rows</p>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-900 border-b border-gray-800">
              <th className="text-gray-500 text-xs px-3 py-3 text-left w-10">#</th>
              {sheet.columns.map(col => (
                <th key={col.id} className="text-gray-300 text-xs font-semibold px-4 py-3 text-left min-w-32 border-l border-gray-800">
                  {col.name} <span className="text-gray-600 font-normal">{col.type === 'number' ? '123' : col.type === 'date' ? '📅' : 'Aa'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.length === 0 && (
              <tr>
                <td colSpan={sheet.columns.length + 1} className="text-center py-20 text-gray-600 text-sm">
                  No rows yet. Tap + to add data.
                </td>
              </tr>
            )}
            {sheet.rows.map((row, index) => (
              <tr key={row.id} className="border-b border-gray-900">
                <td className="text-gray-600 text-xs px-3 py-4">{index + 1}</td>
                {sheet.columns.map(col => (
                  <td key={col.id} className="text-white text-sm px-4 py-4 border-l border-gray-900">
                    {row.cells[col.id] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setShowAddRow(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 text-white w-14 h-14 rounded-full text-2xl shadow-lg flex items-center justify-center"
      >+</button>

      {showAddRow && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Add Row</h2>
              <button
                onClick={() => { setShowAddRow(false); setFormData({}) }}
                className="text-gray-400 text-2xl"
              >×</button>
            </div>
            {sheet.columns.map((col, index) => (
              <div key={col.id}>
                <label className="text-gray-400 text-xs font-medium block mb-1">{col.name}</label>
                <input
                  type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                  placeholder={`Enter ${col.name.toLowerCase()}`}
                  value={formData[col.id] || ''}
                  onChange={e => setFormData({ ...formData, [col.id]: e.target.value })}
                  autoFocus={index === 0}
                  className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-base outline-none border border-gray-700 focus:border-indigo-500"
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