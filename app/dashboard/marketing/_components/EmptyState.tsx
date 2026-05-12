import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  message: string
  command?: string
  className?: string
}

export function EmptyState({ title, message, command, className }: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        {command && (
          <div className="rounded-md bg-muted p-3">
            <code className="text-xs text-foreground break-all font-mono">{command}</code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
