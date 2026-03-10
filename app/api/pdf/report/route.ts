import { NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReportPdfDocument } from '@/lib/pdf/report-pdf'

function buildPdfResponse(geoName: string, period: string) {
  const pdfData = {
    title: `${geoName} Market Report`,
    geoName,
    period,
    metrics: {},
  }
  return { pdfData, filename: `report-${geoName.replace(/\s+/g, '-')}-${period.replace(/\s+/g, '-')}.pdf` }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const geoName = searchParams.get('geoName')?.trim() ?? 'Bend'
  const period = searchParams.get('period')?.trim() ?? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const { pdfData, filename } = buildPdfResponse(geoName, period)
  const doc = React.createElement(ReportPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function POST(request: Request) {
  let body: { reportType?: string; geoName?: string; period?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const geoName = body.geoName?.trim() ?? 'Bend'
  const period = body.period?.trim() ?? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const { pdfData, filename } = buildPdfResponse(geoName, period)
  const doc = React.createElement(ReportPdfDocument, { data: pdfData })
  type DocElement = Parameters<typeof renderToBuffer>[0]
  const buffer = await renderToBuffer(doc as DocElement)
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
