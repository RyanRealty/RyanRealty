import { getBeaconReportData } from '@/app/actions/beacon-report'
import BeaconReportCarousel from '@/components/beacon-report/BeaconReportCarousel'

export default async function BeaconReportSection() {
  const data = await getBeaconReportData()
  return <BeaconReportCarousel data={data} />
}
