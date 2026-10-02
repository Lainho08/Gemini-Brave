import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

// Critérios e palavras-chave de busca e validação
export const CRITERIOS_PADRAO = {
  areas: {
    suporte: {
      nome: 'Suporte de TI / Help Desk / Service Desk',
      termos: [
        'suporte de ti',
        'suporte ti',
        'suporte tecnico',
        'suporte técnico',
        'help desk',
        'helpdesk',
        'service desk',
        'servicedesk',
        'atendimento tecnico',
        'atendimento técnico',
        'field service',
        'analista de suporte',
        'tecnico de suporte',
        'técnico de suporte',
        'tecnico de ti',
        'técnico de ti',
        'tecnico de informatica',
        'técnico de informática',
        'suporte'
      ]
    },
    sistemasJunior: {
      nome: 'Analista de Sistemas Júnior',
      termos: [
        'analista de sistemas',
        'sistemas jr',
        'sistemas junior',
        'sistemas júnior'
      ]
    },
    desenvolvimentoJunior: {
      nome: 'Desenvolvimento Júnior',
      termos: [
        'desenvolvedor',
        'desenvolvedora',
        'programador',
        'programadora',
        'desenvolvimento',
        'dev',
        'frontend',
        'front-end',
        'backend',
        'back-end',
        'fullstack',
        'full stack',
        'engenheiro de software',
        'engenheira de software',
        'software'
      ]
    }
  },
  senioridadeJunior: [
    'junior',
    'júnior',
    'jr',
    'jr.',
    'trainee',
    'estagio',
    'estágio',
    'estagiario',
    'estagiário'
  ],
  senioridadeIncompativel: [
    'senior',
    'sênior',
    'sr',
    'sr.',
    'pleno',
    'pl',
    'pl.',
    'especialista',
    'coordenador',
    'coordenadora',
    'gerente',
    'lider',
    'líder',
    'lead',
    'head',
    'diretor',
    'diretora'
  ],
  termosRemoto: [
    'remoto',
    'home office',
    'home-office',
    'teletrabalho',
    '100% remoto',
    'totalmente remoto'
  ],
  termosHibrido: [
    'hibrido',
    'híbrido'
  ]
};

/**
 * Remove acentos e normaliza para minúsculas
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
 * Verifica se um texto contém algum dos termos informados
 * @param {string} textoNormalizado
 * @param {string[]} termos
 * @returns {string[]} Lista de termos encontrados
 */
export function extrairTermosEncontrados(textoNormalizado, termos) {
  const encontrados = [];
  for (const termo of termos) {
    const termoNorm = normalizar(termo);
    // Usa regex com fronteira de palavras ou limites adequados
    const escaped = termoNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
    if (regex.test(textoNormalizado)) {
      encontrados.push(termo);
    }
  }
  return encontrados;
}

/**
 * Avalia e classifica uma vaga individualmente com base estritamente nos dados extraídos
 * @param {object} vaga Dados brutos da vaga
 * @param {object} config Configurações de filtro
 * @returns {object} Vaga com metadados de análise e sua categoria
 */
export function classificarVaga(vaga, config = {}) {
  const {
    filtroLocal = 'todas',
    priorizarRemoto = true,
    criterios = CRITERIOS_PADRAO
  } = config;

  const tituloOriginal = (vaga.titulo || '').trim();
  const nivelOriginal = (vaga.nivel || '').trim();
  const localOriginal = (vaga.local || '').trim();
  const empresaOriginal = (vaga.empresa || '').trim();

  const tituloNorm = normalizar(tituloOriginal);
  const nivelNorm = normalizar(nivelOriginal);
  const localNorm = normalizar(localOriginal);
  const textoGeralNorm = `${tituloNorm} ${nivelNorm} ${localNorm}`;

  // 1. Identificação de Remoto e Híbrido
  const termosRemotoAchados = extrairTermosEncontrados(textoGeralNorm, criterios.termosRemoto);
  const termosHibridoAchados = extrairTermosEncontrados(textoGeralNorm, criterios.termosHibrido);
  const isRemoto = termosRemotoAchados.length > 0;
  const isHibrido = termosHibridoAchados.length > 0;

  // 2. Identificação de Localização
  const filtroLocalNorm = normalizar(filtroLocal);
  const atendeFiltroLocal = filtroLocalNorm === 'todas' ||
    localNorm.includes(filtroLocalNorm) ||
    (isRemoto && priorizarRemoto);

  // 3. Mapeamento de Palavras-Chave de Áreas de Atuação
  const termosSuporteAchados = extrairTermosEncontrados(tituloNorm, criterios.areas.suporte.termos);
  const termosSistemasAchados = extrairTermosEncontrados(tituloNorm, criterios.areas.sistemasJunior.termos);
  const termosDevAchados = extrairTermosEncontrados(tituloNorm, criterios.areas.desenvolvimentoJunior.termos);
  const termosTiCorrelatos = ['analista de ti', 'assistente de ti', 'ti', 't.i.', 'informatica', 'informática', 'tecnologia da informacao', 'tecnologia da informação'];
  const termosTiAchados = extrairTermosEncontrados(tituloNorm, termosTiCorrelatos);

  const areasDetectadas = [];
  if (termosSuporteAchados.length > 0) areasDetectadas.push(criterios.areas.suporte.nome);
  if (termosSistemasAchados.length > 0) areasDetectadas.push(criterios.areas.sistemasJunior.nome);
  if (termosDevAchados.length > 0) areasDetectadas.push(criterios.areas.desenvolvimentoJunior.nome);

  // 4. Mapeamento de Senioridade
  const termosJuniorNoTitulo = extrairTermosEncontrados(tituloNorm, criterios.senioridadeJunior);
  const termosJuniorNoNivel = extrairTermosEncontrados(nivelNorm, criterios.senioridadeJunior);
  const isJuniorExplicitado = termosJuniorNoTitulo.length > 0 || termosJuniorNoNivel.length > 0;

  const termosIncompativeisTitulo = extrairTermosEncontrados(tituloNorm, criterios.senioridadeIncompativel);
  const termosIncompativeisNivel = extrairTermosEncontrados(nivelNorm, criterios.senioridadeIncompativel);
  const isIncompativelSenior = termosIncompativeisTitulo.length > 0 || termosIncompativeisNivel.length > 0;

  const nivelNaoEspecificado = !nivelOriginal ||
    nivelNorm === 'nao especificado' ||
    nivelNorm === 'indiferente' ||
    nivelNorm === '';

  const localNaoInformado = !localOriginal ||
    localNorm === 'nao informado' ||
    localNorm === '';

  // Consolidação de palavras-chave detectadas
  const palavrasChaveDetectadas = [
    ...new Set([
      ...termosSuporteAchados,
      ...termosSistemasAchados,
      ...termosDevAchados,
      ...termosTiAchados,
      ...termosJuniorNoTitulo,
      ...termosJuniorNoNivel,
      ...termosRemotoAchados,
      ...termosHibridoAchados
    ])
  ];

  const vagaAnalisada = {
    titulo: tituloOriginal,
    empresa: empresaOriginal,
    local: localOriginal,
    nivel: nivelOriginal,
    link: vaga.link || '',
    remoto: isRemoto,
    hibrido: isHibrido,
    areasDetectadas: areasDetectadas.length > 0 ? areasDetectadas : (termosTiAchados.length > 0 ? ['TI / Tecnologia Geral'] : []),
    palavrasChaveDetectadas,
    motivoClassificacao: ''
  };

  // ==========================================
  // REGRAS DE CLASSIFICAÇÃO EXCLUSIVAMENTE
  // COM BASE NOS DADOS EXTRAÍDOS
  // ==========================================

  // Caso 1: Título genérico, ausente ou dados essenciais inexistentes
  const titulosGenericos = ['sem titulo', 'banco de talentos', 'oportunidade', 'oportunidades', 'vaga confidencial', 'talentos'];
  const isTituloGenerico = !tituloOriginal || titulosGenericos.includes(tituloNorm) || tituloNorm.length < 4;

  if (isTituloGenerico || (areasDetectadas.length === 0 && termosTiAchados.length === 0 && nivelNaoEspecificado && localNaoInformado)) {
    vagaAnalisada.motivoClassificacao = 'Título genérico ou dados essenciais (cargo, nível e localização) não disponíveis para confirmar o perfil.';
    return { categoria: 'semInformacoesSuficientes', vaga: vagaAnalisada };
  }

  // Caso 2: Não possui nenhuma das palavras-chave das áreas-alvo nem de TI
  if (areasDetectadas.length === 0 && termosTiAchados.length === 0) {
    vagaAnalisada.motivoClassificacao = 'Não foram identificadas palavras-chave das áreas de Suporte, Sistemas ou Desenvolvimento nos dados extraídos.';
    return { categoria: 'semInformacoesSuficientes', vaga: vagaAnalisada };
  }

  // Caso 2.1: Vaga generalista de TI (ex: "Analista de TI - Júnior") sem especificar se é Suporte, Sistemas ou Dev
  if (areasDetectadas.length === 0 && termosTiAchados.length > 0) {
    vagaAnalisada.motivoClassificacao = 'Vaga na área de TI/Tecnologia, porém o título é generalista e não especifica se a função é em Suporte, Sistemas ou Desenvolvimento.';
    return { categoria: 'parcialmenteCompativeis', vaga: vagaAnalisada };
  }

  // Caso 3: Senioridade superior explícita (Pleno / Sênior / Coordenação / Gerência)
  if (isIncompativelSenior) {
    vagaAnalisada.motivoClassificacao = 'Área compatível, porém os dados extraídos indicam nível superior ao pretendido (Pleno/Sênior/Especialista).';
    return { categoria: 'parcialmenteCompativeis', vaga: vagaAnalisada };
  }

  // Caso 4: Área compatível, MAS o nível NÃO é explicitamente Júnior (ex: não especificado, técnico, auxiliar)
  // Regra ajustada: "Não considerar uma vaga automaticamente 'compatível' apenas porque o nível não foi especificado."
  if (!isJuniorExplicitado) {
    const detalheNivel = nivelOriginal ? ` (nível informado: "${nivelOriginal}")` : ' (nível não especificado)';
    vagaAnalisada.motivoClassificacao = `Área de atuação compatível, porém o nível Júnior não foi explicitamente comprovado nos dados extraídos${detalheNivel}.`;
    return { categoria: 'parcialmenteCompativeis', vaga: vagaAnalisada };
  }

  // Caso 5: Área compatível e Júnior explicitado, mas localização não confere com o filtro
  if (isJuniorExplicitado && !atendeFiltroLocal) {
    vagaAnalisada.motivoClassificacao = `Cargo e nível júnior compatíveis, porém a localização informada ("${localOriginal}") diverge da preferência configurada ("${filtroLocal}").`;
    return { categoria: 'parcialmenteCompativeis', vaga: vagaAnalisada };
  }

  // Caso 6: Área compatível E Nível Júnior explicitamente comprovado E Localização atendida
  if (isJuniorExplicitado && atendeFiltroLocal) {
    const detalheRemoto = isRemoto ? ' [Remota]' : '';
    vagaAnalisada.motivoClassificacao = `Cargo alvo e nível júnior explicitamente identificados nos dados extraídos${detalheRemoto}.`;
    return { categoria: 'compativeis', vaga: vagaAnalisada };
  }

  // Fallback seguro caso haja ambiguidade não tratada
  vagaAnalisada.motivoClassificacao = 'Dados extraídos insuficientes para enquadramento completo na categoria compatível.';
  return { categoria: 'parcialmenteCompativeis', vaga: vagaAnalisada };
}

/**
 * Processa a lista de vagas e separa nos 3 grupos
 * @param {Array} listaVagas
 * @param {object} config
 * @returns {object} Relatório consolidado
 */
export function filtrarVagas(listaVagas = [], config = {}) {
  const {
    filtroLocal = 'todas',
    priorizarRemoto = true
  } = config;

  const grupos = {
    compativeis: [],
    parcialmenteCompativeis: [],
    semInformacoesSuficientes: []
  };

  for (const vaga of listaVagas) {
    const { categoria, vaga: vagaProcessada } = classificarVaga(vaga, { filtroLocal, priorizarRemoto });
    if (grupos[categoria]) {
      grupos[categoria].push(vagaProcessada);
    } else {
      grupos.semInformacoesSuficientes.push(vagaProcessada);
    }
  }

  // Ordenação: priorizar vagas remotas no topo das listas
  if (priorizarRemoto) {
    const ordenarPorRemoto = (a, b) => (b.remoto ? 1 : 0) - (a.remoto ? 1 : 0);
    grupos.compativeis.sort(ordenarPorRemoto);
    grupos.parcialmenteCompativeis.sort(ordenarPorRemoto);
  }

  return {
    dataExecucao: new Date().toISOString(),
    criterios: {
      areasAlvo: [
        'Suporte de TI / Help Desk / Service Desk',
        'Analista de Sistemas Júnior',
        'Desenvolvimento Júnior'
      ],
      senioridadeAlvo: ['Júnior', 'Trainee', 'Estágio'],
      filtroLocalizacao: filtroLocal,
      priorizarRemoto
    },
    resumo: {
      totalAnalisadas: listaVagas.length,
      compativeis: grupos.compativeis.length,
      parcialmenteCompativeis: grupos.parcialmenteCompativeis.length,
      semInformacoesSuficientes: grupos.semInformacoesSuficientes.length
    },
    grupos
  };
}

/**
 * Exibe o relatório amigável no terminal
 * @param {object} resultado
 */
export function exibirRelatorioTerminal(resultado) {
  console.log('\n=======================================================');
  console.log('         RELATÓRIO DE COMPATIBILIDADE DE VAGAS         ');
  console.log('=======================================================');
  console.log(`Data da Análise: ${resultado.dataExecucao}`);
  console.log(`Filtro Local:    ${resultado.criterios.filtroLocalizacao}`);
  console.log(`Priorizar Remoto:${resultado.criterios.priorizarRemoto ? ' Sim' : ' Não'}`);
  console.log('-------------------------------------------------------');
  console.log(`Total Analisadas:           ${resultado.resumo.totalAnalisadas}`);
  console.log(`✔ Compatíveis:              ${resultado.resumo.compativeis}`);
  console.log(`▲ Parcialmente Compatíveis: ${resultado.resumo.parcialmenteCompativeis}`);
  console.log(`? Sem Info Suficientes:     ${resultado.resumo.semInformacoesSuficientes}`);
  console.log('=======================================================\n');

  if (resultado.grupos.compativeis.length > 0) {
    console.log('--- [1] VAGAS COMPATÍVEIS (Critérios e Júnior Confirmados) ---');
    resultado.grupos.compativeis.forEach((v, i) => {
      const tagRemoto = v.remoto ? ' [REMOTA]' : '';
      console.log(`${i + 1}. ${v.titulo} (${v.empresa})${tagRemoto}`);
      console.log(`   Local: ${v.local} | Nível: ${v.nivel}`);
      console.log(`   Palavras-chave: ${v.palavrasChaveDetectadas.join(', ') || 'N/A'}`);
      console.log(`   Motivo: ${v.motivoClassificacao}`);
      console.log(`   Link: ${v.link}\n`);
    });
  }

  if (resultado.grupos.parcialmenteCompativeis.length > 0) {
    console.log('--- [2] VAGAS PARCIALMENTE COMPATÍVEIS (Requerem Validação) ---');
    resultado.grupos.parcialmenteCompativeis.forEach((v, i) => {
      const tagRemoto = v.remoto ? ' [REMOTA]' : '';
      console.log(`${i + 1}. ${v.titulo} (${v.empresa})${tagRemoto}`);
      console.log(`   Local: ${v.local} | Nível: ${v.nivel}`);
      console.log(`   Motivo: ${v.motivoClassificacao}`);
      console.log(`   Link: ${v.link}\n`);
    });
  }

  if (resultado.grupos.semInformacoesSuficientes.length > 0) {
    console.log('--- [3] VAGAS COM INFORMAÇÕES INSUFICIENTES ---');
    resultado.grupos.semInformacoesSuficientes.forEach((v, i) => {
      console.log(`${i + 1}. ${v.titulo} (${v.empresa})`);
      console.log(`   Motivo: ${v.motivoClassificacao}`);
      console.log(`   Link: ${v.link}\n`);
    });
  }
}

/**
 * Função principal para execução via CLI
 */
async function main() {
  const args = process.argv.slice(2);
  let arquivoOrigem = 'vagas-encontradas.json';
  let arquivoDestino = 'vagas-filtradas.json';
  let filtroLocal = 'todas';
  let priorizarRemoto = true;

  // Processamento simples de parâmetros sem pacotes externos
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--arquivo' && args[i + 1]) {
      arquivoOrigem = args[++i];
    } else if (arg === '--saida' && args[i + 1]) {
      arquivoDestino = args[++i];
    } else if (arg === '--local' && args[i + 1]) {
      filtroLocal = args[++i];
    } else if (arg === '--sem-prioridade-remoto') {
      priorizarRemoto = false;
    } else if (!arg.startsWith('--') && i === 0) {
      arquivoOrigem = arg;
    }
  }

  console.log(`[Filtrador de Vagas] Lendo arquivo de vagas: "${arquivoOrigem}" ...`);

  let vagasBrutas = [];
  try {
    const conteudo = await readFile(arquivoOrigem, 'utf-8');
    vagasBrutas = JSON.parse(conteudo);
    if (!Array.isArray(vagasBrutas)) {
      throw new Error('O arquivo JSON não contém uma lista de vagas.');
    }
  } catch (error) {
    console.error(`\n[Aviso] Não foi possível ler "${arquivoOrigem}": ${error.message}`);
    console.log('\nSugestão:');
    console.log('  1. Execute a busca primeiro com: node buscar-vagas.mjs "Analista de Suporte Júnior"');
    console.log('  2. Ou passe o arquivo desejado: node filtrar-vagas.mjs --arquivo meu-arquivo.json\n');
    return;
  }

  const resultado = filtrarVagas(vagasBrutas, { filtroLocal, priorizarRemoto });

  exibirRelatorioTerminal(resultado);

  await writeFile(arquivoDestino, JSON.stringify(resultado, null, 2), 'utf-8');
  console.log(`[Sucesso] Resultados categorizados salvos em: "${arquivoDestino}"\n`);
}

// Execução direta via CLI
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('filtrar-vagas.mjs')
);

if (isMain) {
  main().catch((err) => {
    console.error('[Erro fatal]', err);
  });
}
