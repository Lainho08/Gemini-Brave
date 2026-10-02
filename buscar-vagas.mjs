import { chromium } from 'playwright-core';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Caminho do executável do Brave no Windows 11
export const BRAVE_PATH = String.raw`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`;

// Palavra-chave padrão de busca
export const TERMO_BUSCA_PADRAO = 'Analista de Suporte Júnior';

/**
 * Executa a busca pública de vagas no portal Vagas.com.br
 * @param {string} termoBusca Palavra-chave para pesquisar
 * @param {object} options Opções de execução
 * @returns {Promise<Array>} Lista de vagas encontradas
 */
export async function buscarVagas(termoBusca = TERMO_BUSCA_PADRAO, options = {}) {
  const {
    salvarJson = true,
    caminhoJson = 'vagas-encontradas.json',
    tempoEsperaFechamento = 4000
  } = options;

  console.log('=======================================================');
  console.log(`[Agente de Vagas] Iniciando busca por: "${termoBusca}"`);
  console.log('=======================================================\n');

  // 1. Inicializa o Brave em modo visível
  const browser = await chromium.launch({
    executablePath: BRAVE_PATH,
    headless: false
  });

  const vagas = [];

  try {
    // 2. Cria contexto isolado em memória (não acessa perfil pessoal, histórico ou cookies)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    // A rota oficial de pesquisa do portal Vagas.com.br é /vagas/pesquisas?q=...
    const urlBusca = `https://www.vagas.com.br/vagas/pesquisas?q=${encodeURIComponent(termoBusca)}`;

    console.log(`[Navegação] Acessando listagem pública: ${urlBusca} ...`);
    await page.goto(urlBusca, { waitUntil: 'domcontentloaded' });

    // 3. Aguarda o container e os cards de vagas carregarem
    console.log('[Extração] Aguardando carregamento dos resultados...');
    await page.waitForSelector('li.vaga, #conteudo-pesquisa-de-vagas, .sem-vagas', { timeout: 15000 });

    // 4. Extrai os dados públicos das vagas encontradas
    const resultados = await page.$$eval('li.vaga', (cards) => {
      return cards.slice(0, 10).map((card) => {
        const linkElem = card.querySelector('a.link-detalhes-vaga');
        const empresaElem = card.querySelector('.emprVaga');
        const localElem = card.querySelector('.vaga-local');
        const nivelElem = card.querySelector('.nivelVaga');

        return {
          titulo: linkElem ? (linkElem.getAttribute('title') || linkElem.innerText).trim() : 'Sem título',
          empresa: empresaElem ? empresaElem.innerText.trim() : 'Confidencial / Não informada',
          local: localElem ? localElem.innerText.replace(/\s+/g, ' ').trim() : 'Não informado',
          nivel: nivelElem ? nivelElem.innerText.trim() : 'Não especificado',
          link: linkElem ? linkElem.href : 'Sem link'
        };
      });
    });

    vagas.push(...resultados);

    // 5. Exibe os resultados organizados no terminal
    if (vagas.length === 0) {
      console.log('\n[Resultado] Nenhuma vaga encontrada para os termos informados.');
    } else {
      console.log(`\n[Resultado] Encontradas ${vagas.length} vagas recentes:\n`);
      console.table(vagas.map(v => ({
        Titulo: v.titulo,
        Empresa: v.empresa,
        Nivel: v.nivel,
        Local: v.local
      })));

      console.log('\n--- Links Diretos para Consulta ---');
      vagas.forEach((v, index) => {
        console.log(`${index + 1}. ${v.titulo} (${v.empresa})`);
        console.log(`   Local: ${v.local}`);
        console.log(`   Link: ${v.link}\n`);
      });

      if (salvarJson && vagas.length > 0) {
        await writeFile(caminhoJson, JSON.stringify(vagas, null, 2), 'utf-8');
        console.log(`[Persistência] Vagas brutas salvas com sucesso em: "${caminhoJson}"`);
      }
    }

    // Pausa breve para visualização na janela do Brave antes de fechar
    if (tempoEsperaFechamento > 0) {
      console.log(`Aguardando ${tempoEsperaFechamento / 1000} segundos antes de encerrar o navegador...`);
      await page.waitForTimeout(tempoEsperaFechamento);
    }

    await context.close();
  } catch (error) {
    console.error('\n[Erro na busca]', error.message);
  } finally {
    // 6. Encerra o navegador com segurança
    await browser.close();
    console.log('[Agente de Vagas] Sessão isolada encerrada com sucesso.');
  }

  return vagas;
}

// Execução direta quando chamado pela linha de comando (preserva o uso atual)
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('buscar-vagas.mjs')
);

if (isMain) {
  const termoCli = process.argv[2] || TERMO_BUSCA_PADRAO;
  await buscarVagas(termoCli);
}

