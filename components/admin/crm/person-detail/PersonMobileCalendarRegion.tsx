/**
 * Streamed mobile Calendar tab — appointments + type/outcome vocabulary.
 * Tasks come from the identity-core timeline (already fetched); appointments
 * are secondary and stream independently.
 */

import { MobileCalendarTab } from '@/components/admin/shared/mobile/MobileCalendarTab'
import type { MobileTask } from '@/components/admin/shared/mobile/MobileCalendarTab'
import {
  getAppointmentsForPerson,
  getAppointmentTypes,
  getAppointmentOutcomes,
} from '@/lib/data/crm/getAppointments'
import { CRM_BROKERS } from '@/lib/crm/constants'
import { createAppointmentAction, updateAppointmentAction } from '@/app/actions/appointments'

export async function PersonMobileCalendarRegion({
  personId,
  displayName,
  tasks,
  currentBrokerSlug,
  isSuperuser,
  addTaskAction,
}: {
  personId: number
  displayName: string
  tasks: MobileTask[]
  currentBrokerSlug: string
  isSuperuser: boolean
  addTaskAction: (formData: FormData) => Promise<void>
}) {
  const [personAppointments, apptTypes, apptOutcomes] = await Promise.all([
    getAppointmentsForPerson(personId),
    getAppointmentTypes(),
    getAppointmentOutcomes(),
  ])

  return (
    <MobileCalendarTab
      personId={personId}
      personName={displayName}
      tasks={tasks}
      appointments={{
        rows: personAppointments,
        types: apptTypes,
        outcomes: apptOutcomes,
        brokerSlugs: [...CRM_BROKERS],
        currentBrokerSlug,
        isSuperuser,
      }}
      addTaskAction={addTaskAction}
      createAppointmentAction={createAppointmentAction}
      updateAppointmentAction={updateAppointmentAction}
    />
  )
}
