/**
 * Right-now strip: last activity, last message, next step.
 * Pure. PersonWorkspace feeds it the merged timeline plus open tasks.
 */
import { agoLabel } from '@/lib/format/relative-ago'
import type { PersonTimelineItem } from './person-timeline'

export type PersonRightNowTask = {
  id: number
  name: string
  type: string | null
  due_at: string | null
  completed_at: string | null
}

export type PersonRightNow = {
  lastActivity: { title: string; ago: string; detail: string }
  lastMessage: {
    channel: 'sms' | 'email' | 'call'
    direction: 'in' | 'out'
    preview: string
    detail: string
  } | null
  nextStep: { title: string; detail: string; closeTaskIds: number[] }
}

const MESSAGE_CHANNELS = new Set(['sms', 'email', 'call'])

function isReplyTask(task: PersonRightNowTask): boolean {
  const hay = `${task.name} ${task.type ?? ''}`.toLowerCase()
  return hay.includes('reply')
}

function ptStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

function channelWord(channel: string): string {
  if (channel === 'sms') return 'SMS'
  if (channel === 'email') return 'Email'
  if (channel === 'call') return 'Call'
  return channel
}

export function derivePersonRightNow(input: {
  timeline: PersonTimelineItem[]
  tasks: PersonRightNowTask[]
  nowLine?: string | null
  nowMs?: number
}): PersonRightNow {
  const nowMs = input.nowMs ?? Date.now()
  const visible = input.timeline.filter((item) => !item.system)
  const last = visible[0] ?? null
  const lastMessage =
    visible.find(
      (item): item is PersonTimelineItem & { channel: 'sms' | 'email' | 'call'; direction: 'in' | 'out' } =>
        MESSAGE_CHANNELS.has(item.channel) && (item.direction === 'in' || item.direction === 'out'),
    ) ?? null

  const open = input.tasks.filter((t) => !t.completed_at)
  const replyTasks = open.filter(isReplyTask)
  const replied = Boolean(lastMessage && lastMessage.direction === 'out')

  let nextTitle = 'No next step'
  let nextDetail = open.length === 0 ? 'No open tasks' : `${open.length} open task${open.length === 1 ? '' : 's'}`
  if (replied && replyTasks.length > 0) {
    nextTitle = 'Replied'
    nextDetail = `${replyTasks.length} reply task${replyTasks.length === 1 ? '' : 's'} can close`
  } else if (replyTasks.length > 0) {
    nextTitle = replyTasks[0]!.name
    nextDetail = replyTasks[0]!.due_at ? `due ${ptStamp(replyTasks[0]!.due_at)}` : 'Open reply task'
  } else if (open[0]) {
    nextTitle = open[0].name
    nextDetail = open[0].due_at ? `due ${ptStamp(open[0].due_at)}` : 'Open task'
  }

  const siteBit = (input.nowLine ?? '').trim() || 'Not on the site.'

  return {
    lastActivity: last
      ? {
          title: `${last.title} · ${agoLabel(last.ts, nowMs)}`,
          ago: agoLabel(last.ts, nowMs),
          detail: [`${ptStamp(last.ts)}${last.actor ? ` by ${last.actor}` : ''}`, siteBit]
            .filter(Boolean)
            .join(' · '),
        }
      : { title: 'No activity yet', ago: '', detail: siteBit },
    lastMessage: lastMessage
      ? {
          channel: lastMessage.channel,
          direction: lastMessage.direction,
          preview: lastMessage.body ?? lastMessage.title,
          detail: `${channelWord(lastMessage.channel)} · ${lastMessage.direction === 'out' ? 'outbound' : 'inbound'} · ${ptStamp(lastMessage.ts)}`,
        }
      : null,
    nextStep: {
      title: nextTitle,
      detail: nextDetail,
      closeTaskIds: replied ? replyTasks.map((t) => t.id) : [],
    },
  }
}
