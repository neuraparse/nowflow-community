import { NextResponse } from 'next/server'
import { GET as getSyncedWorkflows } from './sync/route'

export async function GET(request: Request) {
  const response = await getSyncedWorkflows(request)

  if (!response.ok) {
    return response
  }

  const body = await response.json()
  const workflows = Array.isArray(body.data) ? body.data : []

  return NextResponse.json({ workflows, data: workflows }, { status: response.status })
}
