import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  helperText?: string
}

function Input({ label, error, helperText, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-[0.24em] text-[#b0b0b0]" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-lg border border-[#2a2a2a] bg-[#121212] px-3.5 py-3 text-sm text-white outline-none transition-all placeholder:text-[#666666] focus:border-[#767676] focus:bg-[#141414] ${className}`}
        {...props}
      />
      {helperText ? <p className="text-[11px] text-[#7a7a7a]">{helperText}</p> : null}
      {error ? <p className="text-xs text-[#d7d7d7]">{error}</p> : null}
    </div>
  )
}

export default Input
