import { useState, useEffect } from 'react'

const sampleSheets = []

export default function App() {
  const [sheets, setSheets] = useState(sampleSheets)
  const [showCreate, setShowCreate] = useState(false)
  const [newSheetName, setNewSheetName] = useState('')

  function createSheet() {
    if (!newSheetName.trim()) return
    const sheet = {
      id: Date.now(),
      name: newSheetName.trim(),
      rows: 0,
      updated: 'Just now'
    }
    setSheets([sheet, ...sheets])
    setNewSheetName('')
    setShowCreate(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              ⬡ Onyx
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Sheets</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-indigo-700"
          >
            + New Sheet
          </button>
        </div>
      </div>

      {/* Sheet List */}
      <div className="px-4 py-4 space-y-3">
        {sheets.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-400 text-sm">No sheets yet</p>
            <p className="text-gray-600 text-xs mt-1">
              Tap New Sheet to get started
            </p>
          </div>
        )}
        {sheets.map(sheet => (
          <div
            key={sheet.id}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-4 active:bg-gray-800"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-base">
                  {sheet.name}
                </h2>
                <p className="text-gray-500 text-xs mt-1">
                  {sheet.rows} rows · {sheet.updated}
                </p>
              </div>
              <div className="text-gray-600 text-xl">›</div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Sheet Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-end z-50">
          <div className="bg-gray-900 w-full rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">New Sheet</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 text-2xl leading-none"
              >
                ×
              </button>
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
            <button
              onClick={createSheet}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl text-base active:bg-indigo-700"
            >
              Create Sheet
            </button>
          </div>
        </div>
      )}

    </div>
  )
}