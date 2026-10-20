// 哈希路由
export function createRouter({ routes, fallback = 'home', onChange }) {
  const normalize = () => {
    const raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0].trim();
    return routes[raw] ? raw : fallback;
  };

  let current = null;

  const handle = () => {
    const name = normalize();
    current = name;
    onChange(name);
  };

  return {
    start() {
      window.addEventListener('hashchange', handle);
      handle();
    },
    go(name) {
      if (current === name) {
        handle();
        return;
      }
      location.hash = `#/${name}`;
    },
    get current() {
      return current;
    }
  };
}
