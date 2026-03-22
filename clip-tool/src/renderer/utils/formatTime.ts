/**
 * 相对时间格式化
 */
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatRelativeTime(dateStr: string): string {
  return dayjs(dateStr).fromNow()
}

export function formatTime(dateStr: string): string {
  const d = dayjs(dateStr)
  const now = dayjs()

  if (d.isSame(now, 'day')) {
    return `今天 ${d.format('HH:mm')}`
  }
  if (d.isSame(now.subtract(1, 'day'), 'day')) {
    return `昨天 ${d.format('HH:mm')}`
  }
  if (d.isSame(now, 'year')) {
    return d.format('MM/DD HH:mm')
  }
  return d.format('YYYY/MM/DD HH:mm')
}
