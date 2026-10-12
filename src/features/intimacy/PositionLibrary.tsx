import { useEffect, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import type { DateEvent } from '../../model';
import { sexTypes, type SexType } from './sexTypes';

export function PositionLibrary({ events, sexType, selected, onToggle }: { events: DateEvent[]; sexType: SexType | null | undefined; selected: string[]; onToggle: (name: string) => void }) {
  const [filter, setFilter] = useState<SexType | 'all'>(sexType || 'all');
  const [query, setQuery] = useState('');
  useEffect(() => { setFilter(sexType || 'all'); }, [sexType]);
  const groups = sexTypes.map(type => ({ ...type, names: [...new Set(events.filter(event => event.kind === 'intimacy' && (event.sexType || 'unspecified') === type.id).flatMap(event => event.positions || []))] }));
  const results = groups.filter(group => filter === 'all' || group.id === filter).map(group => ({ ...group, names: group.names.filter(name => name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))) })).filter(group => group.names.length);
  return <div className="position-library">
    <label>Показать позы по типу<select value={filter} onChange={event => setFilter(event.target.value as SexType | 'all')}><option value="all">Все типы</option>{groups.map(group => <option key={group.id} value={group.id}>{group.label} · {group.names.length}</option>)}</select></label>
    <div className="catalog-search"><Search size={16} /><input aria-label="Поиск своих поз" placeholder="Найти по названию" value={query} onChange={event => setQuery(event.target.value)} /></div>
    {results.length ? results.map(group => <section key={group.id} className="position-group"><h4>{group.label}</h4><div className="position-grid">{group.names.map(name => <button type="button" key={name} aria-pressed={selected.includes(name)} className={`position-choice ${selected.includes(name) ? 'chosen' : ''}`} onClick={() => onToggle(name)}><span className="position-monogram" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><span>{name}</span>{selected.includes(name) ? <Check size={17} /> : <Plus size={17} />}</button>)}</div></section>) : <p className="microcopy">Для этого типа пока нет сохранённых названий. Добавьте своё ниже — после сохранения записи его можно будет выбрать снова.</p>}
  </div>;
}
