'use client'
import { useId } from 'react'
import { cn } from '@/lib/utils'

interface AdCraftLogoMarkProps {
  size?: number
  className?: string
}

export function AdCraftLogoMark({ size = 24, className }: AdCraftLogoMarkProps) {
  const uid = useId()
  const gId = `acg-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gId} x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F5A623" />
          <stop offset="1" stopColor="#D96900" />
        </linearGradient>
      </defs>

      {/* Badge background */}
      <rect x="1" y="1" width="26" height="26" rx="7" fill={`url(#${gId})`} />

      {/* "A" mark — white strokes */}
      <path
        d="M14 7L7.5 21H20.5L14 7Z"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <line
        x1="10.2"
        y1="16.5"
        x2="17.8"
        y2="16.5"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
