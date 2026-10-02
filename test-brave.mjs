import { chromium } from 'playwright-core';

// Caminho do executável do Brave no Windows usando String.raw para tratar as barras invertidas
const BRAVE_PATH = String.raw`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`;

(async () => {
  console.log('Iniciando o Brave Browser...');

  // 1. Inicializa o Brave via Playwright
  const browser = await chromium.launch({
    executablePath: BRAVE_PATH,
    headless: false // Abre a interface gráfica para visualização
  });

  try {
    // 2. Cria um contexto isolado em memória (sessão limpa/anônima)
    // Isso garante que cookies, histórico e dados do perfil pessoal NÃO sejam acessados nem modificados
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // 3. Navega para uma página de teste pública
    console.log('Navegando até https://example.com ...');
    await page.goto('https://example.com');

    // 4. Valida a execução obtendo o título da página
    const title = await page.title();
    console.log(`[Sucesso] Título da página obtido: "${title}"`);

    // Pausa de 3 segundos para que você possa observar o navegador aberto
    console.log('Aguardando 3 segundos antes de encerrar...');
    await page.waitForTimeout(3000);

    // Fecha o contexto isolado
    await context.close();
  } catch (error) {
    console.error('[Erro na automação]', error);
  } finally {
    // 5. Encerra o processo do navegador com segurança
    await browser.close();
    console.log('Sessão isolada do Brave finalizada com sucesso.');
  }
})();
