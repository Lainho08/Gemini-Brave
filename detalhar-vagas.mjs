import { chromium } from 'playwright-core';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Caminho do executável do Brave no Windows 11
export const BRAVE_PATH = String.raw`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe`;

/**
 * Normaliza textos para comparações auxiliares
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Divide o texto da vaga em linhas limpas e válidas
 * @param {string} texto
 * @returns {string[]}
 */
export function limparLinhas(texto = '') {
  return texto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !/^(\*|-|•|–)\s*$/.test(l))
    .map(l => l.replace(/^(\*|-|•|–)\s*/, '').trim());
}

/**
 * Dicionário de tecnologias, ferramentas e conhecimentos conhecidos para detecção exata no texto da página
 */
const CATALOGO_TECNICO = {
  tecnologias: [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'PHP', 'Ruby', 'Go',
    'HTML', 'HTML5', 'CSS', 'CSS3', 'SQL', 'Node.js', 'React', 'Angular', 'Vue.js',
    'APIs', 'REST', 'RESTful', 'SOAP', 'GraphQL', 'Docker', 'Kubernetes',
    'Cloud', 'AWS', 'Azure', 'Google Cloud', 'GCP', 'PostgreSQL', 'MySQL',
    'SQL Server', 'Oracle', 'SQLite', 'MongoDB', 'Redis', 'Inteligência Artificial', 'IA'
  ],
  ferramentas: [
    'Active Directory', 'AD', 'GLPI', 'Jira', 'ServiceNow', 'AnyDesk', 'TeamViewer',
    'Git', 'GitHub', 'GitLab', 'Jasper Reports', 'Protheus', 'SAP', 'Totvs', 'WMS',
    'Office', 'Pacote Office', 'Word', 'Excel', 'PowerPoint', 'Power Point', 'Outlook',
    'Power BI', 'Windows', 'Windows Server', 'Linux', 'Ubuntu', 'Debian', 'CentOS',
    'Red Hat', 'Zabbix', 'Grafana', 'ITSM', 'ITIL', 'Maker', 'Vercel', 'Render', 'Postman'
  ],
  conhecimentos: [
    'Hardware', 'Redes de computadores', 'Cabeamento estruturado', 'TCP/IP', 'DNS', 'DHCP',
    'Roteadores', 'Switches', 'Wi-Fi corporativo', 'VPN', 'Firewall', 'Segurança da informação',
    'Suporte N1', 'Suporte N2', 'Help Desk', 'Service Desk', 'Manutenção de computadores',
    'Manutenção de impressoras', 'Rotinas de backup', 'Modelagem de dados', 'Arquitetura de software',
    'Metodologias ágeis', 'Scrum', 'Kanban', 'Procedimentos Operacionais Padrão', 'POPs'
  ]
};

/**
 * Identifica tecnologias, ferramentas e conhecimentos mencionados explicitamente no texto da página
 * @param {string} texto
 * @returns {{ tecnologias: string[], ferramentas: string[], conhecimentos: string[] }}
 */
export function extrairTermosTecnicosDaPagina(texto = '') {
  const achados = {
    tecnologias: [],
    ferramentas: [],
    conhecimentos: []
  };

  const textoNorm = ` ${normalizar(texto)} `;

  const checar = (termo) => {
    const termoNorm = normalizar(termo);
    const escaped = termoNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[\\s,;.:/()"\`])${escaped}(?:$|[\\s,;.:/()"\`])`, 'i');
    return regex.test(textoNorm);
  };

  for (const t of CATALOGO_TECNICO.tecnologias) {
    if (checar(t) && !achados.tecnologias.includes(t)) {
      achados.tecnologias.push(t);
    }
  }

  for (const f of CATALOGO_TECNICO.ferramentas) {
    if (checar(f) && !achados.ferramentas.includes(f)) {
      achados.ferramentas.push(f);
    }
  }

  for (const c of CATALOGO_TECNICO.conhecimentos) {
    if (checar(c) && !achados.conhecimentos.includes(c)) {
      achados.conhecimentos.push(c);
    }
  }

  return achados;
}

/**
 * Analisa o texto estruturado da página e separa nas seções correspondentes
 * @param {string} textoBruto
 * @returns {object}
 */
export function dissecarTextoVaga(textoBruto = '') {
  const resultado = {
    descricao: '',
    responsabilidades: [],
    requisitosObrigatorios: [],
    requisitosDesejaveis: [],
    formacao: [],
    experienciaExigida: [],
    idiomas: [],
    beneficios: []
  };

  if (!textoBruto || textoBruto.trim().length === 0) {
    return resultado;
  }

  // Limpa rodapés e blocos promocionais comuns
  let textoLimpo = textoBruto
    .replace(/Compartilhar esta vaga:[\s\S]*$/i, '')
    .replace(/Publicidade[\s\S]*$/i, '')
    .trim();

  resultado.descricao = textoLimpo;

  const linhas = limparLinhas(textoLimpo);

  // Mapeamento por seções
  let secaoAtual = 'cabecalho'; // 'beneficios' | 'responsabilidades' | 'requisitos' | 'desejaveis' | 'idiomas' | 'empresa'

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    // Normaliza substituindo hífens e pontuações por espaços para casamento seguro de títulos
    const linhaNorm = normalizar(linha).replace(/[-_./|\\,]/g, ' ').replace(/\s+/g, ' ');

    // Detectores de troca de seção
    if (/^beneficios$/i.test(linhaNorm)) {
      secaoAtual = 'beneficios';
      continue;
    }
    if (/^(descricao|principais responsabilidades|responsabilidades|atividades|principais atividades|o profissional sera responsavel por|atribuicoes)(.*)$/i.test(linhaNorm)) {
      secaoAtual = 'responsabilidades';
      const match = linha.match(/^(?:descricao|principais responsabilidades|responsabilidades|atividades|principais atividades|o profissional sera responsavel por|atribuicoes):\s*(.+)$/i);
      if (match && match[1]?.trim()) {
        resultado.responsabilidades.push(match[1].trim());
      }
      continue;
    }
    if (/^(pre requisitos|requisitos|outros requisitos|requisitos obrigatorios|qualificacoes|conhecimentos obrigatorios|o que voce precisa ter|o que buscamos|perfil desejado|habilidades necessarias)(.*)$/i.test(linhaNorm)) {
      secaoAtual = 'requisitos';
      const match = linha.match(/^(?:pre[\s-]*requisitos|requisitos|outros requisitos|requisitos obrigatorios|qualificacoes|conhecimentos obrigatorios|o que voce precisa ter|o que buscamos|perfil desejado|habilidades necessarias):\s*(.+)$/i);
      if (match && match[1]?.trim()) {
        const item = match[1].trim();
        resultado.requisitosObrigatorios.push(item);
        if (/ensino (superior|medio|fundamental)|graduacao|superior (completo|cursando)|tecnico/i.test(item)) {
          resultado.formacao.push(item);
        }
        if (/experiencia (com|em|previa)|vivencia (com|em)|tempo de experiencia/i.test(item)) {
          resultado.experienciaExigida.push(item);
        }
      }
      continue;
    }
    if (/^(desejavel|requisitos desejaveis|diferenciais|sera um diferencial|desejavel conhecimento em)(.*)$/i.test(linhaNorm)) {
      secaoAtual = 'desejaveis';
      const match = linha.match(/^(?:desejavel|requisitos desejaveis|diferenciais|sera um diferencial|desejavel conhecimento em):\s*(.+)$/i);
      if (match && match[1]?.trim()) {
        resultado.requisitosDesejaveis.push(match[1].trim());
      }
      continue;
    }
    if (/^idiomas?(.*)$/i.test(linhaNorm)) {
      secaoAtual = 'idiomas';
      const match = linha.match(/^idiomas?:\s*(.+)$/i);
      if (match && match[1]?.trim()) {
        resultado.idiomas.push(match[1].trim());
      }
      continue;
    }
    if (/^(empresa|sobre a empresa|conheca a|conheca o grupo)(.*)$/i.test(linhaNorm)) {
      secaoAtual = 'empresa';
      continue;
    }
    if (/^ver todos$/i.test(linhaNorm) || /^faixa salarial/i.test(linhaNorm) || /^regime clt/i.test(linhaNorm)) {
      continue;
    }

    // Detecção precoce de benefícios em qualquer seção inicial
    const isBeneficioTipico = /assistencia (medica|odontologica)|vale (alimentacao|refeicao|transporte)|seguro de vida|previdencia privada|auxilio (creche|farmacia)|participacao nos lucros|plano de saude|plano odontologico|cesta basica|cafe da manha|bicicletario|restaurante interno|sala de jogos|gympass/i.test(linhaNorm);

    if (isBeneficioTipico) {
      resultado.beneficios.push(linha);
      continue;
    }

    // Classificação por seção ativa
    if (secaoAtual === 'beneficios') {
      if (linha.length < 60 && !linhaNorm.includes('descricao')) {
        resultado.beneficios.push(linha);
      }
    } else if (secaoAtual === 'responsabilidades') {
      resultado.responsabilidades.push(linha);
    } else if (secaoAtual === 'requisitos') {
      // Se menciona formação diretamente na linha
      if (/ensino (superior|medio|fundamental)|graduacao|superior (completo|cursando)|tecnico/i.test(linha)) {
        resultado.formacao.push(linha);
      }
      // Se menciona experiência explicitamente
      if (/experiencia (com|em|previa)|vivencia (com|em)|tempo de experiencia/i.test(linha)) {
        resultado.experienciaExigida.push(linha);
      }
      resultado.requisitosObrigatorios.push(linha);
    } else if (secaoAtual === 'desejaveis') {
      resultado.requisitosDesejaveis.push(linha);
    } else if (secaoAtual === 'idiomas') {
      resultado.idiomas.push(linha);
    }

    // Varredura avulsa para linhas que contêm formação mesmo fora da seção de requisitos
    if (secaoAtual !== 'requisitos' && /ensino (superior|medio)|graduacao em|superior completo|tecnico em/i.test(linhaNorm) && linha.length < 150) {
      if (!resultado.formacao.includes(linha)) {
        resultado.formacao.push(linha);
      }
    }
  }

  // Deduplicação
  resultado.beneficios = [...new Set(resultado.beneficios)];
  resultado.responsabilidades = [...new Set(resultado.responsabilidades)];
  resultado.requisitosObrigatorios = [...new Set(resultado.requisitosObrigatorios)];
  resultado.requisitosDesejaveis = [...new Set(resultado.requisitosDesejaveis)];
  resultado.formacao = [...new Set(resultado.formacao)];
  resultado.experienciaExigida = [...new Set(resultado.experienciaExigida)];
  resultado.idiomas = [...new Set(resultado.idiomas)];

  return resultado;
}

/**
 * Extrai os detalhes de uma página individual de vaga via Playwright
 * @param {import('playwright-core').Page} page
 * @param {object} vagaOriginal Dados prévios da vaga
 * @returns {Promise<object>}
 */
export async function detalharVagaIndividual(page, vagaOriginal) {
  const url = vagaOriginal.link;

  const resultado = {
    titulo: vagaOriginal.titulo || '',
    empresa: vagaOriginal.empresa || '',
    local: vagaOriginal.local || '',
    modalidade: 'Presencial / Não especificada',
    nivel: vagaOriginal.nivel || 'Não especificado',
    link: url,
    descricao: '',
    responsabilidades: [],
    requisitosObrigatorios: [],
    requisitosDesejaveis: [],
    formacao: [],
    experienciaExigida: [],
    tecnologias: [],
    ferramentas: [],
    conhecimentos: [],
    idiomas: [],
    beneficios: [],
    informacoesInsuficientes: false,
    motivoInformacoesInsuficientes: ''
  };

  // Se o link for inválido
  if (!url || !url.startsWith('http')) {
    resultado.informacoesInsuficientes = true;
    resultado.motivoInformacoesInsuficientes = 'Link da vaga inválido ou não fornecido.';
    return resultado;
  }

  try {
    console.log(`[Navegação] Acessando vaga: "${vagaOriginal.titulo}" (${url}) ...`);
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    if (!response || response.status() >= 400) {
      resultado.informacoesInsuficientes = true;
      resultado.motivoInformacoesInsuficientes = `A página retornou status HTTP ${response ? response.status() : 'desconhecido'}.`;
      return resultado;
    }

    // Aguarda carregamento do container de texto da vaga
    await page.waitForSelector('.texto, .job-description, article, h1', { timeout: 10000 });

    // Extrai dados diretamente do DOM da página
    const dadosPagina = await page.evaluate(() => {
      const h1Elem = document.querySelector('h1.job-shortdescription__title, .vaga-titulo, h1');
      const empresaElem = document.querySelector('.job-shortdescription__company, .vaga-empresa, .job-company');
      const textoContainer = document.querySelector('.texto, .job-description, article.job-details, #descricao-da-vaga');

      // Coleta benefícios se existirem em listas específicas
      const beneficiosElements = Array.from(document.querySelectorAll('.beneficios li, .benefit-item, ul.beneficios li'));
      const beneficiosLista = beneficiosElements.map(b => b.innerText.trim()).filter(Boolean);

      return {
        tituloPagina: h1Elem ? h1Elem.innerText.trim() : '',
        empresaPagina: empresaElem ? empresaElem.innerText.trim() : '',
        textoCompleto: textoContainer ? textoContainer.innerText.trim() : document.body.innerText.slice(0, 5000),
        beneficiosLista
      };
    });

    if (dadosPagina.tituloPagina) {
      resultado.titulo = dadosPagina.tituloPagina;
    }
    if (dadosPagina.empresaPagina && dadosPagina.empresaPagina !== 'Confidencial') {
      resultado.empresa = dadosPagina.empresaPagina;
    }

    const textoCompleto = dadosPagina.textoCompleto || '';

    // Verifica se a descrição é insuficiente
    if (textoCompleto.length < 60) {
      resultado.informacoesInsuficientes = true;
      resultado.motivoInformacoesInsuficientes = 'A página carregou, porém a descrição textual da vaga está vazia ou inacessível no card.';
      return resultado;
    }

    // Modalidade baseada no texto da página e nos dados locais
    const textoNorm = normalizar(textoCompleto);
    if (/100%\s*remoto|totalmente remoto|trabalho remoto|home office/i.test(textoNorm) || vagaOriginal.remoto) {
      resultado.modalidade = 'Remoto';
    } else if (/hibrido|modelo hibrido|regime hibrido/i.test(textoNorm) || vagaOriginal.hibrido) {
      resultado.modalidade = 'Híbrido';
    } else if (/100%\s*presencial|presencial/i.test(textoNorm) || (vagaOriginal.local && !normalizar(vagaOriginal.local).includes('nao informado'))) {
      resultado.modalidade = 'Presencial';
    }

    // Disseca as seções textuais
    const secoes = dissecarTextoVaga(textoCompleto);
    resultado.descricao = secoes.descricao;
    resultado.responsabilidades = secoes.responsabilidades;
    resultado.requisitosObrigatorios = secoes.requisitosObrigatorios;
    resultado.requisitosDesejaveis = secoes.requisitosDesejaveis;
    resultado.formacao = secoes.formacao;
    resultado.experienciaExigida = secoes.experienciaExigida;
    resultado.idiomas = secoes.idiomas;
    resultado.beneficios = [
      ...new Set([...secoes.beneficios, ...dadosPagina.beneficiosLista])
    ];

    // Extrai tecnologias, ferramentas e conhecimentos técnicos citados no texto
    const termosTecnicos = extrairTermosTecnicosDaPagina(textoCompleto);
    resultado.tecnologias = termosTecnicos.tecnologias;
    resultado.ferramentas = termosTecnicos.ferramentas;
    resultado.conhecimentos = termosTecnicos.conhecimentos;

    // Se possui responsabilidades ou requisitos encontrados, temos informações suficientes
    const temDadosDetalhados = resultado.responsabilidades.length > 0 ||
      resultado.requisitosObrigatorios.length > 0 ||
      resultado.tecnologias.length > 0 ||
      resultado.ferramentas.length > 0;

    resultado.informacoesInsuficientes = !temDadosDetalhados;
    if (!temDadosDetalhados) {
      resultado.motivoInformacoesInsuficientes = 'A página da vaga não especificou seções claras de responsabilidades ou requisitos técnicos.';
    }

    console.log(`[Sucesso] Vaga detalhada: "${resultado.titulo}" | Requisitos: ${resultado.requisitosObrigatorios.length} | Tecnologias: ${resultado.tecnologias.length}`);
  } catch (error) {
    console.error(`[Falha] Erro ao acessar a vaga "${vagaOriginal.titulo}": ${error.message}`);
    resultado.informacoesInsuficientes = true;
    resultado.motivoInformacoesInsuficientes = `Falha durante a extração da página: ${error.message}`;
  }

  return resultado;
}

/**
 * Processa a lista completa de vagas filtradas e salva em vagas-detalhadas.json
 */
async function main() {
  const args = process.argv.slice(2);
  let caminhoOrigem = 'vagas-filtradas.json';
  let caminhoDestino = 'vagas-detalhadas.json';
  let limite = null; // null = todas as vagas

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--origem' && args[i + 1]) {
      caminhoOrigem = args[++i];
    } else if (arg === '--destino' && args[i + 1]) {
      caminhoDestino = args[++i];
    } else if (arg === '--limite' && args[i + 1]) {
      limite = parseInt(args[++i], 10);
    }
  }

  console.log('=======================================================');
  console.log('            DETALHADOR DE VAGAS DE EMPREGO             ');
  console.log('=======================================================');
  console.log(`Origem das Vagas:  "${caminhoOrigem}"`);
  console.log(`Destino do JSON:   "${caminhoDestino}"`);
  console.log('Iniciando o Brave em modo anônimo isolado...\n');

  let dadosFiltrados;
  try {
    const conteudo = await readFile(caminhoOrigem, 'utf-8');
    dadosFiltrados = JSON.parse(conteudo);
  } catch (err) {
    console.error(`[Erro] Falha ao ler arquivo de vagas: ${err.message}`);
    return;
  }

  // Coleta a lista de vagas
  const listaVagas = [];
  if (dadosFiltrados.grupos) {
    for (const grupo of Object.values(dadosFiltrados.grupos)) {
      if (Array.isArray(grupo)) {
        listaVagas.push(...grupo);
      }
    }
  } else if (Array.isArray(dadosFiltrados.vagas)) {
    listaVagas.push(...dadosFiltrados.vagas);
  }

  const totalParaProcessar = limite ? listaVagas.slice(0, limite) : listaVagas;
  console.log(`Total de vagas na fila para extração detalhada: ${totalParaProcessar.length}\n`);

  // Inicializa o Brave via Playwright
  const browser = await chromium.launch({
    executablePath: BRAVE_PATH,
    headless: false
  });

  const vagasDetalhadas = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    for (let i = 0; i < totalParaProcessar.length; i++) {
      const vaga = totalParaProcessar[i];
      console.log(`[Progresso ${i + 1}/${totalParaProcessar.length}]`);
      const detalhada = await detalharVagaIndividual(page, vaga);
      vagasDetalhadas.push(detalhada);

      // Pequena pausa entre requisições para navegação estável
      if (i < totalParaProcessar.length - 1) {
        await page.waitForTimeout(1200);
      }
    }

    await context.close();
  } catch (err) {
    console.error('[Erro geral no processador]', err.message);
  } finally {
    await browser.close();
    console.log('\n[Navegador] Sessão isolada encerrada com sucesso.');
  }

  // Consolidação dos resultados estatísticos
  const comDescricaoCompleta = vagasDetalhadas.filter(v =>
    !v.informacoesInsuficientes &&
    v.responsabilidades.length > 0 &&
    (v.requisitosObrigatorios.length > 0 || v.tecnologias.length > 0)
  ).length;

  const comInfoParcial = vagasDetalhadas.filter(v =>
    !v.informacoesInsuficientes &&
    (v.responsabilidades.length === 0 || (v.requisitosObrigatorios.length === 0 && v.tecnologias.length === 0))
  ).length;

  const naoAcessadasOuSemDados = vagasDetalhadas.filter(v => v.informacoesInsuficientes).length;

  const resultadoFinal = {
    dataColeta: new Date().toISOString(),
    totalAnalisadas: vagasDetalhadas.length,
    estatisticas: {
      totalAnalisadas: vagasDetalhadas.length,
      comDescricaoCompleta,
      comInformacoesParciais: comInfoParcial,
      naoAcessadasOuSemDados
    },
    vagas: vagasDetalhadas
  };

  // Salva no arquivo de destino
  await writeFile(caminhoDestino, JSON.stringify(resultadoFinal, null, 2), 'utf-8');
  console.log(`\n[Exportação] Vagas detalhadas salvas com sucesso em: "${caminhoDestino}"`);

  // Relatório amigável no terminal
  console.log('\n=======================================================');
  console.log('             RELATÓRIO DE EXTRAÇÃO DETALHADA           ');
  console.log('=======================================================');
  console.log(`Total de Vagas Processadas:        ${resultadoFinal.totalAnalisadas}`);
  console.log(`✔ Com Descrição Completa:          ${comDescricaoCompleta}`);
  console.log(`▲ Com Informações Parciais:        ${comInfoParcial}`);
  console.log(`✗ Não Acessadas / Sem Requisitos:  ${naoAcessadasOuSemDados}`);
  console.log('=======================================================\n');
}

// Execução direta
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('detalhar-vagas.mjs')
);

if (isMain) {
  main().catch(err => {
    console.error('[Erro fatal]', err);
  });
}
