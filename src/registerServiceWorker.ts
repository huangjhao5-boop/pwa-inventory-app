export function registerServiceWorker() {
  const isProd = (import.meta as any).env?.PROD ?? false;
  if ('serviceWorker' in navigator && isProd) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('ServiceWorker registration successful with scope: ', reg.scope);
        })
        .catch((err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }
}
