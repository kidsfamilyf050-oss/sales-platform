import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { useT } from '../i18n'
import { usePeriodStore, buildPeriodParams } from '../components/ui/PeriodSelector'
import { ExternalLink, Phone } from 'lucide-react'

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function LiderNotHappenedPage() {
  const { t } = useT()
  const periodStore = usePeriodStore()
  const params = buildPeriodParams(periodStore)

  const { data, isLoading } = useQuery<any>({
    queryKey: ['lider-not-happened', params],
    queryFn: () =>
      api.get(`/leads/lider-report?${params}&consultationStatus=not_happened`).then(r => r.data),
    refetchInterval: 60000,
  })

  const leads: any[] = data?.leads || []

  return (
    <div className="space-y-5 max-w-[900px] mx-auto px-4 md:px-8 py-4 md:py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dash.lider.notHappened')}</h1>
        <p className="text-gray-500 text-sm mt-0.5">{t('dash.lider.notHappenedSubtitle')}</p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40 text-gray-400">{t('common.loading')}</div>
      )}

      {!isLoading && leads.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-sm">{t('dash.lider.notHappenedEmpty')}</p>
        </div>
      )}

      {!isLoading && leads.length > 0 && (
        <div className="space-y-2">
          {leads.map((lead: any) => (
            <div key={lead.id} className="card border-l-4 border-orange-400">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{lead.clientName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                      {t('dash.lider.notHappenedBadge')}
                    </span>
                    {lead.salesChannel?.name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {lead.salesChannel.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-500">
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {lead.phone}
                      </span>
                    )}
                    {lead.date && (
                      <span>{t('lider.notHappened.leadLabel')} {lead.date}</span>
                    )}
                    {lead.appointmentDate && (
                      <span className="text-orange-600 font-medium">
                        {t('lider.notHappened.meetingWas')} {lead.appointmentDate}
                        {lead.appointmentTime ? ` ${lead.appointmentTime}` : ''}
                      </span>
                    )}
                  </div>

                  {lead.assignedTo && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t('lider.notHappened.closerLabel')} <span className="font-medium text-gray-600">{lead.assignedTo.name}</span>
                    </p>
                  )}

                  {lead.comment && (
                    <p className="text-xs text-gray-500 mt-1 italic">"{lead.comment}"</p>
                  )}
                </div>

                {lead.leadLink && (
                  <a
                    href={lead.leadLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-500 hover:underline shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    CRM
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        {leads.length > 0 ? `${leads.length} ${t('dash.lider.notHappenedCount')}` : ''}
      </p>
    </div>
  )
}
