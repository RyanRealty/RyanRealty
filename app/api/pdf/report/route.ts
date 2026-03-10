import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReportPdfDocument } from '@/lib/pdf/report-pdf'

export async function POST(request: Request) {
  let body: { reportType?: string; geoName?: string; period?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const reportType = body.reportType?.trim() ?? 'City Market Report'
  const geoName = body.geoName?.trim() ?? 'Bend'
  const period = body.period?.trim() ?? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const pdfData = {
    title: `${geoName} Market Report`,
    geoName,
    period,
    metrics: {},
  }
  const doc = React.createElement(ReportPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${geoName.replace(/\s+/g, '-')}-${period.replace(/\s+/g, '-')}.pdf"`,
    },
  })
}
