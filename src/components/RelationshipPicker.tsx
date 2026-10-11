import { Heart, Sparkles } from 'lucide-react';
import type { PairProfile } from '../model';

export function RelationshipPicker({ value, onChange }: { value: PairProfile['relationshipMode']; onChange: (mode: PairProfile['relationshipMode']) => void }) {
  return <div className="relationship-picker" role="group" aria-label="Формат отношений">
    <button type="button" aria-pressed={value === 'dating'} className={value === 'dating' ? 'chosen' : ''} onClick={() => onChange('dating')}><Heart size={22} /><strong>Встречаемся</strong><span>Свидания, впечатления и шаги навстречу</span></button>
    <button type="button" aria-pressed={value === 'couple'} className={value === 'couple' ? 'chosen' : ''} onClick={() => onChange('couple')}><Sparkles size={22} /><strong>Мы пара / в браке</strong><span>Секс, наши ритуалы и разнообразие</span></button>
  </div>;
}
