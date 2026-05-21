import { ForceDark } from '../force-dark'

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ForceDark />
      {children}
    </>
  )
}
