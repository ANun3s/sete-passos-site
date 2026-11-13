import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import DriftWall from './components/DriftWall.jsx';

const items = [
  { image: '/assets/about-aesthetics-480.webp', title: 'Cuidado estético — imagem ilustrativa' },
  { image: '/assets/story-facial-care.jpg', title: 'Procedimento facial — imagem ilustrativa' },
  { image: '/assets/story-light-therapy.jpg', title: 'Aparelho de terapia com luz — imagem ilustrativa' },
  { image: '/assets/about-physiotherapy-480.webp', title: 'Atendimento de fisioterapia — imagem ilustrativa' },
  { image: '/assets/story-facial-care.jpg', title: 'Cuidado facial — imagem ilustrativa' }
];

export function mountStoriesDriftWall(host) {
  const root = createRoot(host);
  root.render(createElement(DriftWall, {
    items,
    columns: 5,
    tileWidth: 190,
    tileHeight: 126,
    gap: 18,
    tilt: 16,
    turn: -14,
    perspective: 1200,
    depth: 120,
    speed: 24,
    direction: 'up',
    variance: 0.45,
    parallax: 0.6,
    lift: 64,
    fade: 0.68,
    dim: 0.78,
    overlayColor: 'rgba(244, 247, 251, 0.12)',
    className: 'stories-drift-wall'
  }));
  return () => root.unmount();
}
