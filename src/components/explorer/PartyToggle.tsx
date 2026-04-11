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
        disabled
        aria-disabled="true"
        title="Partiernas skuggbudgetar är inte inlästa ännu — kommer i en senare version."
        className="cursor-not-allowed rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-60"
      >
        {t('explorer.partyComparison')}
        <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
          snart
        </span>
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
