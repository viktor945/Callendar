import type { ReactNode } from 'react';
import { inviteTemplates } from './templates';
import nightImage from './assets/almaty-night.png';
import './themes.css';

const decor: Record<string, [string, string, string]> = {
  adrenaline: ['⚡', '01 / GO', '↗'], 'pink-dream': ['✿', 'с любовью', '❀'], 'city-night': ['✦', 'ALMATY / NIGHT', '☾'],
  'cozy-home': ['🕯️', 'наш маленький мир', '⌂'], gourmet: ['✧', 'MENU POUR DEUX', '🍽️'], nature: ['△', 'выше городской суеты', '🌿'],
  retro: ['📼', 'SIDE A · SIDE B', '♫'], quest: ['◎', 'ДЕЛО ДЛЯ ДВОИХ', '⌕'], art: ['✹', 'создаём нашу историю', '🎨'], luxury: ['✧', 'PERSONAL INVITATION', '✧'],
};
export function ThemeShell({ theme, children, small = false }: { theme: string; children: ReactNode; small?: boolean }) {
  const template = inviteTemplates.find(item => item.key === theme)!;
  const elements = decor[theme];
  return <div className={`date-theme theme-${theme} ${small ? 'theme-small' : ''}`} data-theme={theme}>
    {theme === 'city-night' && <img className="night-backdrop" src={nightImage} alt="" aria-hidden="true" />}
    <div className="scene-decoration" aria-hidden="true"><span>{elements[0]}</span><span>{elements[2]}</span></div>
    <div className="theme-masthead"><span>{elements[1]}</span><span>{template.emoji} {template.name}</span></div>
    <div className="theme-content">{children}</div>
  </div>;
}
