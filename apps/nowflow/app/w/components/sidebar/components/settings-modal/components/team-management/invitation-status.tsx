import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'

export function getInvitationStatus(status: string) {
  switch (status) {
    case 'pending':
      return (
        <div className="flex items-center text-amber-500">
          <RefreshCw className="w-4 h-4 mr-1" strokeWidth={1.5} />
          <span>Pending</span>
        </div>
      )
    case 'accepted':
      return (
        <div className="flex items-center text-green-500">
          <CheckCircle className="w-4 h-4 mr-1" strokeWidth={1.5} />
          <span>Accepted</span>
        </div>
      )
    case 'canceled':
      return (
        <div className="flex items-center text-red-500">
          <XCircle className="w-4 h-4 mr-1" strokeWidth={1.5} />
          <span>Canceled</span>
        </div>
      )
    default:
      return status
  }
}
