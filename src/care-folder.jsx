import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Folder from './components/Folder.jsx';
import './care-folder.css';

const cards = [
  {
    title: 'Fisioterapia', eyebrow: '01 / MOVIMENTO', caption: 'O corpo encontra novos caminhos.',
    description: 'Um olhar para o movimento e para as possibilidades do seu corpo. O primeiro passo é entender suas necessidades com uma avaliação profissional.',
    image: '/assets/care-movement.svg', imageAlt: '', action: 'Conhecer essa área', contact: 'Fisioterapia',
  },
  {
    title: 'Estética avançada', eyebrow: '02 / AUTOESTIMA', caption: 'Um olhar gentil para sua própria beleza.',
    description: 'Espaço para conversar sobre autoestima, cuidado e suas expectativas. As possibilidades de atendimento devem ser definidas após uma avaliação individual.',
    image: '/assets/care-aesthetics.svg', imageAlt: '', action: 'Conhecer essa área', contact: 'Estética avançada',
  },
  {
    title: 'Escutar antes de tudo.', eyebrow: '03 / ESCUTA', caption: 'Presença em cada detalhe.',
    description: 'Seu momento, suas expectativas e sua história importam. Um convite para se ouvir e dar mais atenção ao que faz você se sentir bem.',
    image: '/assets/care-listening.svg', imageAlt: '', action: 'Nossa forma de cuidar', href: '#essencia',
  },
  {
    title: 'Respeitar o seu ritmo.', eyebrow: '04 / SEU TEMPO', caption: 'Cada cuidado, seu ponto de partida.',
    description: 'Cuidado sem comparações. Um caminho que faça sentido para você, dando espaço às pequenas mudanças e à sua relação com o próprio corpo.',
    image: '/assets/care-rhythm.svg', imageAlt: '', action: 'Conheça nossa essência', href: '#essencia',
  },
  {
    title: 'Avaliação individual', eyebrow: '05 / PRIMEIRO PASSO', caption: 'Cada pessoa chega com uma história.',
    description: 'A conversa inicial e a avaliação profissional ajudam a compreender suas necessidades e a pensar, junto com você, sobre possibilidades de cuidado.',
    symbol: '✳', action: 'Dar o primeiro passo', contact: 'Avaliação individual',
  },
];

function CareFolder() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const rootRef = useRef(null);
  const items = cards.map((card, index) => ({
    title: card.title,
    description: card.caption,
    content: <div className="care-folder-thumb">
      {card.image ? <img src={card.image} alt="" draggable="false" /> : <span className="care-folder-thumb-symbol" aria-hidden="true">{card.symbol}</span>}
      <span className="care-folder-thumb-index">{String(index + 1).padStart(2, '0')}</span>
      <strong>{card.title}</strong>
      <small>{card.caption}</small>
    </div>,
  }));
  const closeDetails = () => {
    const previous = selected;
    setSelected(null);
    requestAnimationFrame(() => rootRef.current?.querySelector(`[data-folder-item="${previous}"]`)?.focus());
  };
  const moveExpandedCard = event => {
    if (event.pointerType !== 'mouse'
      || !matchMedia('(hover: hover) and (pointer: fine)').matches
      || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100));
    const y = Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100));
    event.currentTarget.style.setProperty('--pointer-x', `${x}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y}%`);
    event.currentTarget.style.setProperty('--care-tilt-x', `${((x - 50) / 50 * 5.5).toFixed(2)}deg`);
    event.currentTarget.style.setProperty('--care-tilt-y', `${((50 - y) / 50 * 5.5).toFixed(2)}deg`);
  };
  const resetExpandedCard = event => {
    for (const property of ['--pointer-x', '--pointer-y', '--care-tilt-x', '--care-tilt-y']) {
      event.currentTarget.style.removeProperty(property);
    }
  };

  return <div className="care-folder-app" ref={rootRef}>
    <div className="care-folder-stage">
      <Folder
        label="Sete Passos"
        items={items}
        color="#071e3c"
        paperColor="#ffffff"
        size={1}
        draggable={false}
        open={open}
        onOpenChange={setOpen}
        onItemClick={(_, index) => setSelected(index)}
      />
    </div>
    <p className="care-folder-hint" aria-live="polite">{open ? 'Escolha uma miniatura para ampliar.' : 'Abra a pasta e explore nossos cuidados.'}</p>
    {selected !== null && <article
      className="care-expanded-card pointer-glow"
      aria-labelledby="care-expanded-title"
      aria-live="polite"
      key={selected}
      onPointerMove={moveExpandedCard}
      onPointerLeave={resetExpandedCard}
    >
      <div className="care-expanded-art">
        {cards[selected].image ? <img src={cards[selected].image} alt="" /> : <span aria-hidden="true">{cards[selected].symbol}</span>}
      </div>
      <div className="care-expanded-copy">
        <p className="care-expanded-eyebrow">{cards[selected].eyebrow}</p>
        <h3 id="care-expanded-title">{cards[selected].title}</h3>
        <p className="care-expanded-caption">{cards[selected].caption}</p>
        <p className="care-expanded-description">{cards[selected].description}</p>
        <div className="care-expanded-actions">
          <a className="area-link" href={cards[selected].href || '#contato'} {...(cards[selected].contact ? { 'data-contact': cards[selected].contact } : {})}>
            {cards[selected].action}<svg className="icon" aria-hidden="true"><use href="#arrow-up-right" /></svg>
          </a>
          <button type="button" className="care-expanded-close" onClick={closeDetails} aria-label={`Fechar detalhes de ${cards[selected].title}`}>Fechar detalhes</button>
        </div>
      </div>
    </article>}
  </div>;
}

export function mountCareFolder(host) {
  const root = createRoot(host);
  root.render(<CareFolder />);
  return () => root.unmount();
}
