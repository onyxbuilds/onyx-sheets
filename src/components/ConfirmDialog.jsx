// ConfirmDialog — Reusable confirmation dialog
// X button top right to cancel, no separate cancel button

export default function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  onSecondary,
  confirmLabel = 'Confirm',
  secondaryLabel,
  children
}) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] px-6">
      <div className="bg-gray-800 rounded-2xl p-6 w-full space-y-4 shadow-2xl relative">

        {/* X close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 text-xl w-8 h-8 flex items-center justify-center rounded-lg active:opacity-70 hover:bg-gray-700"
        >×</button>

        <p className="text-white text-base text-center leading-relaxed whitespace-pre-line pr-6">
          {message}
        </p>

        {/* Optional children — e.g. row number input */}
        {children}

        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl text-base active:bg-indigo-700"
          >{confirmLabel}</button>

          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="w-full bg-red-600 text-white font-semibold py-3 rounded-xl text-base active:bg-red-700"
            >{secondaryLabel}</button>
          )}
        </div>
      </div>
    </div>
  )
}
