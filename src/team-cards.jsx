import { createRoot } from 'react-dom/client';
import ProfileCard from './components/ProfileCard.jsx';

const profiles = [
  {
    name: 'Arthur Nunes Freitas',
    title: 'Desenvolvedor',
    email: 'arthurnunesfreitas7@gmail.com',
    socialUrl: 'https://www.instagram.com/a_nun.es/',
    avatarUrl: '/assets/team-arthur-cutout.webp',
    className: 'profile-card--team',
  },
  {
    name: 'Gleciane Mereles Nunes',
    title: 'Fundadora',
    email: 'setepassos.ag@gmail.com',
    socialUrl: 'https://www.instagram.com/glecianeestetica/',
    avatarUrl: '/assets/team-gleciane-cutout.webp',
    className: 'profile-card--team profile-card--gleciane',
  },
];

function TeamCards() {
  return (
    <div className="team-card-grid" role="list" aria-label="Nossa equipe">
      {profiles.map(profile => (
        <div className="team-card-item" role="listitem" key={profile.name}>
          <ProfileCard
            {...profile}
            handle=""
            status=""
            contactText="Enviar e-mail"
            showUserInfo
            onContactClick={() => {
              const composeUrl = new URL('https://mail.google.com/mail/');
              composeUrl.searchParams.set('view', 'cm');
              composeUrl.searchParams.set('fs', '1');
              composeUrl.searchParams.set('to', profile.email);
              window.open(composeUrl.toString(), '_blank', 'noopener,noreferrer');
            }}
            theme="dark"
            holo={0.8}
            glare={0.5}
            tiltStrength={12}
            parallax={8}
            radius={16}
            enableTilt
            intro
            enableMobileTilt={false}
          />
        </div>
      ))}
    </div>
  );
}

export function mountTeamCards(host) {
  const root = createRoot(host);
  root.render(<TeamCards />);
  return () => root.unmount();
}
