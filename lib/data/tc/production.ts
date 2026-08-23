import { getClosingsBoard, type ClosingDealRow } from './closings'

export type BrokerProduction = {
  broker: string
  listings: number
  pending: number
  closed: number
  dead: number
  incompleteRequired: number
  inReview: number
}

export function productionByBroker(deals: readonly ClosingDealRow[]): BrokerProduction[] {
  const map = new Map<string, BrokerProduction>()
  const row = (name: string): BrokerProduction => {
    const cur = map.get(name) ?? {
      broker: name,
      listings: 0,
      pending: 0,
      closed: 0,
      dead: 0,
      incompleteRequired: 0,
      inReview: 0,
    }
    map.set(name, cur)
    return cur
  }
  for (const d of deals) {
    const r = row(d.brokerName?.trim() || 'Unassigned')
    if (d.stage === 'active_listing') r.listings++
    else if (d.stage === 'pending' || d.stage === 'pre_contract') r.pending++
    else if (d.stage === 'closed') r.closed++
    else if (d.stage === 'dead') r.dead++
    if (d.stage === 'pending' || d.stage === 'pre_contract' || d.stage === 'active_listing') {
      r.incompleteRequired += d.itemsRequired
      r.inReview += d.itemsInReview
    }
  }
  return [...map.values()].sort((a, b) => a.broker.localeCompare(b.broker))
}

export async function getProductionReport(): Promise<{ brokers: BrokerProduction[]; deals: number }> {
  const board = await getClosingsBoard()
  return { brokers: productionByBroker(board.deals), deals: board.deals.length }
}
