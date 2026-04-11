import { useTranslation } from 'react-i18next';
import type { DimParty } from '@/lib/supabase-types';

interface PartyToggleProps {
  enabled: boolean;
  onToggle: () => void;
  parties: DimParty[];
  selectedPartyIds: number[];
  onPartiesChange: (ids: number[]) => void;
}

const PartyToggle = ({ enabled, onToggle, parties, selectedPartyIds, onPartiesChange }: PartyToggleProps) => {
  const { t } = useTranslation();

  const toggleParty = (id: number) => {
    if (selectedPartyIds.includes(id)) {
      onPartiesChange(selectedPartyIds.filter(p => p !== id));
    } else {
      onPartiesChange([...selectedPartyIds, id]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onToggle}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
          enabled
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-secondary text-muted-foreground hover:text-foreground'
        }`}
        aria-pressed={enabled}
      >
        {t('explorer.partyComparison')}
      </button>
      {enabled && (
        <div className="flex flex-wrap gap-1.5">
          {parties.filter(p => p.code !== 'GOV').map(party => (
            <button
              key={party.party_id}
              onClick={() => toggleParty(party.party_id)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all border ${
                selectedPartyIds.includes(party.party_id)
                  ? 'border-transparent shadow-sm'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
              style={selectedPartyIds.includes(party.party_id) ? {
                backgroundColor: party.color_hex,
                color: '#fff',
              } : undefined}
            >
              {party.code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PartyToggle;
