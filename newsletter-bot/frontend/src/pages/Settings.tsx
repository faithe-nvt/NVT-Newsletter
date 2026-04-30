import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSettings, saveSettings } from '../api/client'
import { Save, Key, Mail, Globe, Rss } from 'lucide-react'
import toast from 'react-hot-toast'

function Section({ icon: Icon, title, children }: any) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <Icon size={16} className="text-brand-400" />
        <h2 className="font-semibold text-slate-200">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, name, value, onChange, type = 'text', placeholder = '', hint = '' }: any) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input"
      />
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const { data: serverSettings } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (serverSettings) {
      setForm({
        anthropic_api_key: '',
        newsapi_key: serverSettings.newsapi_key || '',
        smtp_host: serverSettings.smtp_host || '',
        smtp_port: serverSettings.smtp_port || '587',
        smtp_user: serverSettings.smtp_user || '',
        smtp_pass: '',
        from_name: serverSettings.from_name || 'Neta Virtual Team',
        from_email: serverSettings.from_email || '',
        base_url: serverSettings.base_url || 'http://localhost:8000',
      })
    }
  }, [serverSettings])

  const saveMut = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => toast.success('Settings saved'),
    onError: () => toast.error('Save failed'),
  })

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(form)) {
      if (v.trim()) cleaned[k] = v.trim()
    }
    saveMut.mutate(cleaned)
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Configure API keys, email provider, and app settings</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">

        <Section icon={Key} title="AI & News APIs">
          <Field
            label="Anthropic API Key (Claude)"
            name="anthropic_api_key"
            type="password"
            value={form.anthropic_api_key || ''}
            onChange={onChange}
            placeholder={serverSettings?.anthropic_api_key === '***' ? '●●●●●●●●● (saved)' : 'sk-ant-...'}
            hint="Get your key at console.anthropic.com — required for newsletter generation"
          />
          <Field
            label="NewsAPI Key (optional)"
            name="newsapi_key"
            type="password"
            value={form.newsapi_key || ''}
            onChange={onChange}
            placeholder="Optional — free tier at newsapi.org"
            hint="Without this key, the app uses free RSS feeds from ATO, CPA Australia, and ABC Business"
          />
        </Section>

        <Section icon={Mail} title="Email / SMTP">
          <p className="text-xs text-slate-500">
            Works with Gmail (use App Password), Outlook, SendGrid SMTP, or any SMTP provider.
            Leave blank to use stub mode (emails are logged, not sent).
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="SMTP Host" name="smtp_host" value={form.smtp_host || ''} onChange={onChange} placeholder="smtp.gmail.com" />
            <Field label="SMTP Port" name="smtp_port" value={form.smtp_port || ''} onChange={onChange} placeholder="587" />
            <Field label="SMTP Username" name="smtp_user" value={form.smtp_user || ''} onChange={onChange} placeholder="you@gmail.com" />
            <Field label="SMTP Password / App Password" name="smtp_pass" type="password" value={form.smtp_pass || ''} onChange={onChange}
              placeholder={serverSettings?.smtp_pass === '***' ? '●●●●●●● (saved)' : ''} />
            <Field label="From Name" name="from_name" value={form.from_name || ''} onChange={onChange} placeholder="Neta Virtual Team" />
            <Field label="From Email" name="from_email" value={form.from_email || ''} onChange={onChange} placeholder="newsletter@yourcompany.com.au" />
          </div>
        </Section>

        <Section icon={Globe} title="App Configuration">
          <Field
            label="Base URL (for tracking links)"
            name="base_url"
            value={form.base_url || ''}
            onChange={onChange}
            placeholder="https://your-domain.com or http://localhost:8000"
            hint="The public URL of this app's backend — used in email tracking pixels and unsubscribe links"
          />
        </Section>

        <Section icon={Rss} title="Content Settings">
          <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400 space-y-2">
            <p className="font-medium text-slate-300">Current News Sources (AU Accounting Focus)</p>
            <ul className="space-y-1 text-xs">
              <li>• Australian Tax Office — ato.gov.au</li>
              <li>• Accountants Daily — accountantsdaily.com.au</li>
              <li>• CPA Australia — cpaaustralia.com.au</li>
              <li>• ABC News Business — abc.net.au/news/business</li>
              <li>• Smart Company AU — smartcompany.com.au</li>
              <li>• MYOB Blog AU — myob.com/au/blog</li>
              {form.newsapi_key && <li>• NewsAPI (active) — real-time AU finance/accounting results</li>}
            </ul>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400">
            <p className="font-medium text-slate-300 mb-1">Writing Profile — AU Accountants & CFOs</p>
            <p className="text-xs">Analytical tone · Data-first · ROI framing · Short paragraphs · Australian English · Content sandwich structure with subtle Neta CTA</p>
          </div>
        </Section>

        <button type="submit" disabled={saveMut.isPending} className="btn-primary flex items-center gap-2">
          <Save size={15} />
          {saveMut.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
