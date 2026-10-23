import { AppProvider, useApp } from './state';
import { go, useRoute } from './lib/router';
import { BookIcon, ChartIcon, GearIcon, HomeIcon, ReadIcon } from './components/Icons';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Browse } from './screens/Browse';
import { WordPage } from './screens/WordPage';
import { SettingsPage } from './screens/SettingsPage';
import { Stats } from './screens/Stats';
import { Reading } from './screens/Reading';
import { ENABLED_FEATURES } from './features';

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

const TABS = [
  { key: '', label: 'Today', Icon: HomeIcon },
  { key: 'browse', label: 'Words', Icon: BookIcon },
  { key: 'read', label: 'Read', Icon: ReadIcon, feature: 'reading' as const },
  { key: 'stats', label: 'Stats', Icon: ChartIcon, feature: 'stats' as const },
  { key: 'settings', label: 'Settings', Icon: GearIcon },
];

function Shell() {
  const { ready } = useApp();
  const route = useRoute();
  const [page = '', param] = route;
  if (!ready) return null;

  if (page === 'session') {
    return (
      <div className="app fullscreen">
        <Session mode={param === 'quick' || param === 'extra' || param === 'weak' ? param : 'daily'} />
      </div>
    );
  }

  let screen;
  switch (page) {
    case 'browse':
      screen = <Browse tab={param} />;
      break;
    case 'word':
      screen = <WordPage id={param} />;
      break;
    case 'settings':
      screen = <SettingsPage />;
      break;
    case 'stats':
      screen = ENABLED_FEATURES.stats ? <Stats /> : <Home />;
      break;
    case 'read':
      screen = ENABLED_FEATURES.reading ? <Reading /> : <Home />;
      break;
    default:
      screen = <Home />;
  }
  const active = page === 'word' ? 'browse' : page;

  return (
    <>
      <main className="app">{screen}</main>
      <nav className="tabbar" aria-label="Main">
        <div className="tabbar-inner">
          {TABS.filter((t) => !t.feature || ENABLED_FEATURES[t.feature]).map(({ key, label, Icon }) => (
            <button key={key} className="tab" aria-current={active === key ? 'page' : undefined} onClick={() => go(key)}>
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
