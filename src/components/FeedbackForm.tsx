import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'wrong_number', label: 'Felaktig siffra' },
  { value: 'missing_source', label: 'Saknad källa' },
  { value: 'bug', label: 'Bugg på hemsidan' },
  { value: 'suggestion', label: 'Förslag' },
  { value: 'other', label: 'Annat' },
];

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ok'; url: string } | { kind: 'error'; message: string };

const FeedbackForm = () => {
  const [category, setCategory] = useState<string>('wrong_number');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const disabled = status.kind === 'loading';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setStatus({ kind: 'error', message: 'Fyll i rubrik och beskrivning.' });
      return;
    }
    setStatus({ kind: 'loading' });
    try {
      const { data, error } = await supabase.functions.invoke('submit-issue', {
        body: {
          category,
          title: title.trim(),
          description: description.trim(),
          contactEmail: contactEmail.trim() || undefined,
          sourceUrl: window.location.href,
          website,
        },
      });
      if (error) throw error;
      if (!data?.ok || !data.issueUrl) throw new Error('Oväntat svar från servern.');
      setStatus({ kind: 'ok', url: data.issueUrl });
      toast.success('Tack! Din rapport har skickats.');
      setTitle('');
      setDescription('');
      setContactEmail('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Något gick fel. Försök igen om en stund.';
      setStatus({ kind: 'error', message });
      toast.error('Kunde inte skicka rapporten.');
    }
  };

  if (status.kind === 'ok') {
    return (
      <div className="rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-medium text-emerald-900">Tack för din rapport!</p>
            <p className="mt-1 text-sm text-emerald-800">
              Vi tittar på den så snart vi kan. Du kan följa ärendet här:
            </p>
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-900 underline"
            >
              {status.url}
            </a>
            <button
              type="button"
              onClick={() => setStatus({ kind: 'idle' })}
              className="mt-4 block text-xs text-emerald-900/70 underline hover:text-emerald-900"
            >
              Skicka en till
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="fb-category" className="mb-1.5 block text-sm font-medium text-foreground">
          Typ av feedback
        </label>
        <select
          id="fb-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="fb-title" className="mb-1.5 block text-sm font-medium text-foreground">
          Rubrik
        </label>
        <input
          id="fb-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          disabled={disabled}
          placeholder="Kort sammanfattning"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="fb-description" className="mb-1.5 block text-sm font-medium text-foreground">
          Beskrivning
        </label>
        <textarea
          id="fb-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          required
          rows={6}
          disabled={disabled}
          placeholder="Vad såg du? Vilken sida? Hur kom du fram till att siffran var fel?"
          className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {description.length}/4000 tecken
        </p>
      </div>

      <div>
        <label htmlFor="fb-email" className="mb-1.5 block text-sm font-medium text-foreground">
          E-post <span className="font-normal text-muted-foreground">(valfritt — om du vill att vi svarar)</span>
        </label>
        <input
          id="fb-email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          maxLength={200}
          disabled={disabled}
          placeholder="du@exempel.se"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Honeypot — hidden from humans, bots will fill it */}
      <div className="hidden" aria-hidden="true">
        <label>
          Lämna tom
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        Din rapport skickas till vårt öppna feedback-repo på GitHub och blir synlig offentligt.
        Undvik att skriva känslig information.
      </p>

      {status.kind === 'error' && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60',
        )}
      >
        {disabled ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {disabled ? 'Skickar…' : 'Skicka rapport'}
      </button>
    </form>
  );
};

export default FeedbackForm;
