import { useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { sexCatalog, catalogTags } from './catalog';

export function SexCatalog({ selected, onToggle, compact = false }: { selected: string[]; onToggle: (tag: string) => void; compact?: boolean }) {
  const [categoryId, setCategoryId] = useState<string | null>(compact ? 'atmosphere' : null);
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('ru');
  const categories = sexCatalog.filter(category => query ? `${category.title} ${category.groups.map(group => `${group.title} ${group.options.join(' ')}`).join(' ')}`.toLocaleLowerCase('ru').includes(query) : category.id === categoryId);
  return <div className={`sex-catalog ${compact ? 'catalog-compact' : ''}`}>
    <div className="catalog-search"><Search size={17} /><input aria-label="Поиск настроений и вариантов" placeholder="Свет, массаж, утро, сюрприз…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button type="button" aria-label="Очистить поиск" onClick={() => setSearch('')}><X size={17} /></button>}<span>{catalogTags.length} вариантов</span></div>
    {!query && <div className="catalog-categories" role="group" aria-label="Сферы настроений">{sexCatalog.map(category => {
      const count = category.groups.flatMap(group => group.options).filter(option => selected.includes(option)).length;
      return <button type="button" key={category.id} aria-pressed={categoryId === category.id} className={`catalog-category tone-${category.color} ${categoryId === category.id ? 'chosen' : ''}`} onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}><span className="catalog-emoji">{category.emoji}</span><strong>{category.title}</strong><span>{compact ? '12 вариантов' : category.description}</span>{count > 0 && <i>{count} выбрано</i>}</button>;
    })}</div>}
    <div className="catalog-results">{categories.map(category => <section className={`catalog-sphere tone-${category.color}`} key={category.id}><div className="catalog-sphere-heading"><span>{category.emoji}</span><h4>{category.title}</h4></div>{category.groups.map(group => {
      const options = group.options.filter(option => !query || `${category.title} ${group.title} ${option}`.toLocaleLowerCase('ru').includes(query));
      if (!options.length) return null;
      return <div className="catalog-group" key={group.title}><h5>{group.title}</h5><div className="tag-picker">{options.map(option => <button type="button" aria-pressed={selected.includes(option)} className={selected.includes(option) ? 'chosen' : ''} key={option} onClick={() => onToggle(option)}>{selected.includes(option) && <Check size={13} />}{option}</button>)}</div></div>;
    })}</section>)}</div>
    {query && !categories.length && <p className="catalog-empty">Такого варианта пока нет. Можно добавить свой в форме встречи.</p>}
  </div>;
}
