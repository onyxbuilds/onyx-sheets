// ── CONFIRM DIALOG ────────────────────────────────────────
// Reusable delete confirmation dialog
// Replaces window.confirm which doesn't work reliably on mobile

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = 'Delete', cancelLabel = 'Cancel' }) {
          return (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-6">
                    <div className="bg-gray-800 rounded-2xl p-6 w-full space-y-4 shadow-2xl">
                            <p className="text-white text-base text-center leading-relaxed whitespace-pre-line">{message}</p>
                                    <div className="flex gap-3">
                                              <button
                                                          onClick={onCancel}
                                                                      className="flex-1 bg-gray-700 text-white font-semibold py-3 rounded-xl text-base active:bg-gray-600"
                                                                                >{cancelLabel}</button>
                                                                                          <button
                                                                                                      onClick={onConfirm}
                                                                                                                  className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-xl text-base active:bg-red-700"
                                                                                                                            >{confirmLabel}</button>
                                                                                                                                    </div>
                                                                                                                                          </div>
                                                                                                                                              </div>
                                                                                                                                                )
                                                                                                                                                }