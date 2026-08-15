import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
}

function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.2em] text-[#999999]" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-md border border-[#222222] bg-[#111111] px-3 py-2.5 text-sm text-white outline-none transition-all placeholder:text-[#666666] focus:border-[#666666] ${className}`}
        {...props}
      />
      {error ? <p className="text-xs text-[#cfcfcf]">{error}</p> : null}
    </div>
  )
}

export default Input
