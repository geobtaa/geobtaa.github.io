import { parseContainedLinkCards, updateContainedLinkCard } from './containedLinkCards.ts';
import { LinkCardPreview, LinkCardProperties } from './LinkCardBlock.ts';

export function ContainedLinkCardsEditor({ source, onChange, readOnly = false }: { source: string; onChange?: (source: string) => void; readOnly?: boolean }) {
  const parsed = parseContainedLinkCards(source);
  return <div className="contained-link-cards">
    {!readOnly && <p>These Link Cards are inside an existing layout. Edit their fields here; the surrounding layout stays read-only.</p>}
    {parsed?.cards.map((card, index) => readOnly
      ? <LinkCardPreview key={index} {...card.fields} />
      : <fieldset key={index}><legend>Link Card {index + 1}</legend>
        <LinkCardProperties value={card.fields} onChange={fields => onChange?.(updateContainedLinkCard(source, index, fields))} />
      </fieldset>)}
    <details className="protected-block"><summary>Surrounding layout source (preserved, read-only)</summary><pre>{source}</pre></details>
  </div>;
}
