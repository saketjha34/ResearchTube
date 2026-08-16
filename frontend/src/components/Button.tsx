import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  loading?: boolean
  variant?: ButtonVariant
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-white text-black border border-white hover:bg-black hover:text-white transition-all duration-200',
  secondary:
    'bg-[#111111] text-white border border-[#222222] hover:border-[#666666] hover:bg-[#181818] transition-all duration-200',
  ghost:
    'bg-transparent text-white border border-[#222222] hover:border-[#666666] hover:bg-[#111111] transition-all duration-200',
}

function Button({
  children,
  loading = false,
  variant = 'primary',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center px-5 py-2.5 text-sm tracking-wide rounded-md ${variantClasses[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
