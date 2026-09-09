(function () {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async function monitoredFetch(input, init) {
    const response = await nativeFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';

    if (url.includes('/api/generate-scene') && !response.ok) {
      let message = `Falha na geração (${response.status}).`;
      try {
        const payload = await response.clone().json();
        if (payload?.error) message = String(payload.error);
      } catch {
        try {
          const text = await response.clone().text();
          if (text) message = text.slice(0, 500);
        } catch {}
      }

      setTimeout(() => {
        const status = document.getElementById('generateStatus');
        if (status) {
          status.textContent = `Falha na geração: ${message}`;
          status.className = 'status warn';
        }
      }, 0);
    }

    return response;
  };
})();
