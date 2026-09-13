(function () {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  function friendlyMessage(message, status = 0) {
    const raw = String(message || '').trim();
    if (/3036|10[,.]?000\s*neurons|daily free allocation|workers paid/i.test(raw)) {
      return 'O limite diário do provedor foi atingido. Tente novamente após o reset da cota.';
    }
    if (status === 429 || /rate limit|too many requests/i.test(raw)) {
      return 'O serviço está temporariamente no limite de requisições. Aguarde um pouco e tente novamente.';
    }
    if (status === 413) return 'Os arquivos enviados são grandes demais para esta operação.';
    if (status === 401 || status === 403) return 'O provedor recusou a autenticação desta operação.';
    if (status >= 500 && !raw) return 'O serviço não concluiu esta operação.';
    return raw || `Operação não concluída (${status || 'erro'}).`;
  }

  async function responseMessage(response) {
    let message = '';
    try {
      const payload = await response.clone().json();
      message = payload?.error || payload?.warning || payload?.message || '';
    } catch {
      try { message = (await response.clone().text()).slice(0, 600); }
      catch { message = ''; }
    }
    return friendlyMessage(message, response.status);
  }

  globalThis.fetch = async function monitoredFetch(input, init) {
    const response = await nativeFetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || '';

    if (url.includes('/api/') && !response.ok) {
      const message = await responseMessage(response);
      document.dispatchEvent(new CustomEvent('mockup:api-error', {
        detail: { url, status: response.status, message },
      }));

      if (url.includes('/api/generate-scene')) {
        setTimeout(() => {
          const status = document.getElementById('generateStatus');
          if (status) {
            status.textContent = message;
            status.className = 'status warn';
          }
        }, 0);
      }
    }

    return response;
  };

  import('./studio-guided-workflow.js').catch((error) => {
    console.warn('[guided-workflow] falha ao carregar o fluxo guiado.', error);
  });
  import('./studio-product-polish.js').catch((error) => {
    console.warn('[product-polish] falha ao carregar o acabamento da interface.', error);
  });
})();
