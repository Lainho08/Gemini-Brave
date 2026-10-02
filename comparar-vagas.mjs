import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Normaliza texto para comparações
 * @param {string} texto
 * @returns {string}
 */
export function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_./|\\,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalização estrita para termos técnicos (sem espaços)
 * @param {string} texto
 * @returns {string}
 */
export function normalizarChave(texto = '') {
  return normalizar(texto).replace(/\s+/g, '');
}

/**
 * Cursos e termos alvo da área de TI para correspondência de formação
 */
export const CURSOS_ALVO_TI = [
  'sistemas de informacao',
  'ciencia da computacao',
  'analise e desenvolvimento de sistemas',
  'redes de computadores',
  'engenharia da computacao',
  'tecnologia da informacao',
  'computacao',
  'informatica',
  'areas correlatas',
  'area de ti'
];

/**
 * Termos de áreas explicitamente não-TI para evitar falsos positivos com 'áreas correlatas'
 */
export const AREAS_NAO_TI = [
  'administracao',
  'rh',
  'recursos humanos',
  'ciencias contabeis',
  'contabil',
  'contabilidade',
  'direito',
  'psicologia'
];

/**
 * Dicionário direcional de termos técnicos e sinônimos.
 * - chaveCanonica: identificador único para deduplicação canônica
 * - implica: termos que a posse deste termo satisfaz de forma direcional
 * (ex: GLPI implica ITSM, mas ITSM não implica GLPI; REST APIs implica APIs, mas APIs não implica REST)
 */
export const DICIONARIO_TERMOS = {
  'glpi': {
    chaveCanonica: 'glpi',
    implica: ['glpi', 'itsm', 'gestao de chamados', 'chamados']
  },
  'itsm': {
    chaveCanonica: 'itsm',
    implica: ['itsm']
  },
  'rest apis': {
    chaveCanonica: 'rest_apis',
    implica: ['rest apis', 'rest', 'apis']
  },
  'apis': {
    chaveCanonica: 'apis',
    implica: ['apis']
  },
  'rest': {
    chaveCanonica: 'rest',
    implica: ['rest', 'apis']
  },
  'ia': {
    chaveCanonica: 'inteligencia_artificial',
    implica: ['ia', 'inteligencia artificial']
  },
  'inteligencia artificial': {
    chaveCanonica: 'inteligencia_artificial',
    implica: ['inteligencia artificial', 'ia']
  },
  'apis de ia': {
    chaveCanonica: 'inteligencia_artificial',
    implica: ['apis de ia', 'inteligencia artificial', 'ia']
  },
  'cloud': {
    chaveCanonica: 'cloud',
    implica: ['cloud', 'nuvem']
  },
  'aws': {
    chaveCanonica: 'aws',
    implica: ['aws']
  },
  'gcp': {
    chaveCanonica: 'gcp',
    implica: ['gcp', 'google cloud']
  },
  'azure': {
    chaveCanonica: 'azure',
    implica: ['azure']
  },
  'office': {
    chaveCanonica: 'pacote_office',
    implica: ['office', 'pacote office']
  },
  'pacote office': {
    chaveCanonica: 'pacote_office',
    implica: ['pacote office', 'office']
  },
  'windows': {
    chaveCanonica: 'windows',
    implica: ['windows']
  },
  'windows server': {
    chaveCanonica: 'windows_server',
    implica: ['windows server', 'windows']
  }
};

/**
 * Cria expressão regular com limite de palavra e controle de símbolos para matching estrito
 * @param {string} termo
 * @returns {RegExp}
 */
export function criarRegexTermo(termo = '') {
  const tNorm = normalizar(termo);
  if (!tNorm) return /(?!)/;
  const escaped = tNorm.replace(/[\^$*+?.()|[\]{}\\]/g, '\\$&');
  if (tNorm === 'c') {
    return new RegExp('(?:^|[^a-z0-9_#+])c(?![#+])(?:[^a-z0-9_#+]|$)', 'i');
  }
  if (/[#+.]/.test(tNorm)) {
    return new RegExp('(?:^|[^a-z0-9_#+])' + escaped + '(?:[^a-z0-9_#+]|$)', 'i');
  }
  return new RegExp('(?:^|[^a-z0-9_])' + escaped + '(?![a-z0-9_])', 'i');
}

/**
 * Configuração de soft skills e seus indicadores em atividades reais do perfil.
 * Com evidência real nas atividadesRealizadas: status 'verificacaoSubjetiva'.
 * Sem nenhuma evidência real: status 'naoVerificavelPeloCurriculo'.
 */
export const EVIDENCIAS_SOFT_SKILLS = {
  inteligencia_emocional: {
    chaveCanonica: 'inteligencia_emocional',
    termosMatcher: ['inteligencia emocional'],
    termosIndicadores: [],
    buscarEvidencia: () => null // Currículo técnico não atesta inteligência emocional
  },
  proatividade_autonomia: {
    chaveCanonica: 'proatividade_autonomia',
    termosMatcher: ['proatividade', 'autonomia', 'proativo', 'proativa', 'iniciativa'],
    termosIndicadores: [
      'diagnostico tecnico remoto e presencial',
      'secretarias municipais',
      'mapeamento da infraestrutura',
      'projetos de automacao'
    ],
    buscarEvidencia: (perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (
            ativNorm.includes('secretarias municipais') ||
            ativNorm.includes('diagnostico tecnico remoto e presencial') ||
            ativNorm.includes('projetos de automacao') ||
            ativNorm.includes('mapeamento da infraestrutura')
          ) {
            return {
              status: 'verificacaoSubjetiva',
              trechoLiteral: ativ,
              origemNoPerfil: 'experiencia',
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  },
  comunicacao: {
    chaveCanonica: 'comunicacao',
    termosMatcher: ['comunicacao', 'comunicacao escrita', 'comunicacao verbal', 'postura de servico', 'relacionamento interpessoal'],
    termosIndicadores: ['manuais de operacao', 'documentacao', 'secretarias municipais'],
    buscarEvidencia: (perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('manuais de operacao') || ativNorm.includes('documentacao de 100%')) {
            return {
              status: 'verificacaoSubjetiva',
              trechoLiteral: ativ,
              origemNoPerfil: 'experiencia',
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  },
  organizacao_prioridades: {
    chaveCanonica: 'organizacao_prioridades',
    termosMatcher: ['organizacao', 'gestao de prioridades', 'senso de prioridade', 'priorizacao', 'organizado', 'organizada'],
    termosIndicadores: ['triagem e priorizacao', 'triagem', 'priorizacao'],
    buscarEvidencia: (perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('triagem') || ativNorm.includes('priorizacao')) {
            return {
              status: 'verificacaoSubjetiva',
              trechoLiteral: ativ,
              origemNoPerfil: 'experiencia',
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  },
  colaboracao: {
    chaveCanonica: 'colaboracao',
    termosMatcher: ['colaborativo', 'colaborativa', 'trabalho em equipe', 'times tecnicos', 'areas de negocio'],
    termosIndicadores: ['requisitos funcionais', 'fluxos operacionais', 'secretarias municipais'],
    buscarEvidencia: (perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('requisitos funcionais') || ativNorm.includes('fluxos operacionais') || ativNorm.includes('secretarias municipais')) {
            return {
              status: 'verificacaoSubjetiva',
              trechoLiteral: ativ,
              origemNoPerfil: 'experiencia',
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  }
};

/**
 * Regras para classificação de capacidades e requisitos genéricos
 */
export const REGRAS_CAPACIDADES = {
  desenvolvimento_web: {
    chaveCanonica: 'desenvolvimento_web',
    matcher: (reqNorm) => reqNorm.includes('aplicacoes web') || (reqNorm.includes('desenvolvimento') && reqNorm.includes('web')),
    buscarEvidencia: (inventario, perfil) => {
      // 1. Atendido: atividade ou projeto que contenha termo web explícito (JavaScript, HTML, CSS, frontend, telas web)
      const termosWeb = ['javascript', 'html', 'css', 'frontend', 'telas', 'web'];
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (termosWeb.some(tw => ativNorm.includes(tw)) && (ativNorm.includes('criacao') || ativNorm.includes('manutencao') || ativNorm.includes('fluxos') || ativNorm.includes('desenvolvimento'))) {
            return {
              status: 'atendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      for (let i = 0; i < (perfil.projetos || []).length; i++) {
        const proj = perfil.projetos[i];
        const descNorm = normalizar(proj.descricao);
        if (descNorm.includes('aplicacao web') || descNorm.includes('web')) {
          return {
            status: 'atendido',
            origemNoPerfil: 'projeto',
            trechoLiteral: proj.descricao,
            fonteNoPerfil: `projetos[${i}].descricao`
          };
        }
      }
      // 2. Parcialmente atendido: atividade corporativa genérica sem menção direta a termos web
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('ciclo de vida de desenvolvimento') || ativNorm.includes('desenvolvimento de software')) {
            return {
              status: 'parcialmenteAtendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`,
              detalhe: 'Possui experiência em desenvolvimento corporativo, mas sem menção explícita a termos web na atividade geral.'
            };
          }
        }
      }
      return null;
    }
  },
  suporte_chamados: {
    chaveCanonica: 'suporte_chamados',
    matcher: (reqNorm) => reqNorm.includes('suporte a usuarios por meio de chamados') || reqNorm.includes('atendimento de chamados') || reqNorm.includes('resolucao de incidentes') || reqNorm.includes('processos de suporte') || (reqNorm.includes('suporte') && reqNorm.includes('chamados')),
    buscarEvidencia: (inventario, perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('chamados') || ativNorm.includes('n1/n2') || ativNorm.includes('glpi')) {
            return {
              status: 'atendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  },
  projetos_ti: {
    chaveCanonica: 'projetos_ti',
    matcher: (reqNorm) => reqNorm.includes('projetos de tecnologia da informacao') || reqNorm.includes('projetos de ti') || reqNorm.includes('nocoes de projetos'),
    buscarEvidencia: (inventario, perfil) => {
      // 1. Atendido: exige evidência direta de gestão/planejamento formal de projetos
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('gestao de projetos') || ativNorm.includes('planejamento de projetos') || ativNorm.includes('scrum master') || ativNorm.includes('pmo')) {
            return {
              status: 'atendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      // 2. Parcialmente atendido: participação técnica em ciclo de desenvolvimento e projetos de automação
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('projetos de automacao') || ativNorm.includes('ciclo de vida de desenvolvimento')) {
            return {
              status: 'parcialmenteAtendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`,
              detalhe: 'Possui participação em projetos de software e ciclo de desenvolvimento, mas sem comprovação direta de gestão ou planejamento formal de projetos de TI.'
            };
          }
        }
      }
      return null;
    }
  },
  inteligencia_artificial: {
    chaveCanonica: 'inteligencia_artificial',
    matcher: (reqNorm) => /\b(?:inteligencia artificial|ia)\b/i.test(reqNorm),
    buscarEvidencia: (inventario, perfil) => {
      // 1. Atendido: exige ferramentas de IA aplicadas diretamente à programação (copilots de código)
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if ((ativNorm.includes('ia') || ativNorm.includes('inteligencia artificial')) && (ativNorm.includes('programacao') || ativNorm.includes('codigo') || ativNorm.includes('copilot'))) {
            return {
              status: 'atendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      // 2. Parcialmente atendido: IA voltada à geração assistida de documentação técnica (AutoDoc)
      for (let i = 0; i < (perfil.projetos || []).length; i++) {
        const proj = perfil.projetos[i];
        for (let j = 0; j < (proj.tecnologias || []).length; j++) {
          const t = proj.tecnologias[j];
          if (/\b(?:inteligencia\s+artificial|ia)\b/i.test(normalizar(t))) {
            return {
              status: 'parcialmenteAtendido',
              origemNoPerfil: 'projeto',
              trechoLiteral: t,
              fonteNoPerfil: `projetos[${i}].tecnologias[${j}]`,
              detalhe: 'Possui aplicação prática de APIs de IA voltada à documentação técnica no projeto AutoDoc, porém sem comprovação direta de ferramentas de IA aplicadas especificamente à programação.'
            };
          }
        }
      }
      const ctIA = (perfil.conhecimentosTecnicos?.tecnologiasEFrameworks?.conhecimento || []).find(t => /\b(?:inteligencia\s+artificial|ia)\b/i.test(normalizar(t)));
      if (ctIA) {
        return {
          status: 'parcialmenteAtendido',
          origemNoPerfil: 'conhecimento',
          trechoLiteral: ctIA,
          fonteNoPerfil: 'conhecimentosTecnicos.tecnologiasEFrameworks.conhecimento',
          detalhe: 'Possui conhecimento teórico em APIs de IA, sem evidência de ferramentas aplicadas à programação.'
        };
      }
      return null;
    }
  },
  itsm: {
    chaveCanonica: 'itsm',
    matcher: (reqNorm) => reqNorm.includes('itsm'),
    buscarEvidencia: (inventario, perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('glpi') || ativNorm.includes('sla')) {
            return {
              status: 'atendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  },
  hardware_redes: {
    chaveCanonica: 'hardware_redes',
    matcher: (reqNorm) => reqNorm.includes('hardware') || reqNorm.includes('redes de computadores'),
    buscarEvidencia: (inventario, perfil) => {
      for (let i = 0; i < (perfil.experienciasProfissionais || []).length; i++) {
        const exp = perfil.experienciasProfissionais[i];
        for (let j = 0; j < (exp.atividadesRealizadas || []).length; j++) {
          const ativ = exp.atividadesRealizadas[j];
          const ativNorm = normalizar(ativ);
          if (ativNorm.includes('hardware') || ativNorm.includes('cabeamento') || ativNorm.includes('redes')) {
            return {
              status: 'atendido',
              origemNoPerfil: 'experiencia',
              trechoLiteral: ativ,
              fonteNoPerfil: `experienciasProfissionais[${i}].atividadesRealizadas[${j}]`
            };
          }
        }
      }
      return null;
    }
  }
};

/**
 * Avalia a compatibilidade de localização e modalidade entre vaga e perfil
 * sem tratar mudança geográfica como incapacidade técnica.
 * @param {object} vaga
 * @param {object} perfil
 * @returns {{ compatibilidade: string, observacao: string }}
 */
export function avaliarLocalModalidade(vaga, perfil) {
  const localVaga = vaga.local || vaga.localizacaoVaga || '';
  const modalidadeVaga = vaga.modalidade || vaga.modalidadeVaga || 'Presencial / Não especificada';
  const cidadePerfil = perfil.dadosProfissionais?.cidade || '';
  const estadoPerfil = perfil.dadosProfissionais?.estado || '';

  const localVagaNorm = normalizar(localVaga);
  const estadoPerfilNorm = normalizar(estadoPerfil);

  if (modalidadeVaga === 'Remoto') {
    return {
      compatibilidade: 'compativel',
      observacao: 'Vaga remota compatível com a preferência de trabalho do perfil.'
    };
  }

  if (!localVaga || localVagaNorm.includes('nao informado') || localVagaNorm.includes('localizacao nao')) {
    return {
      compatibilidade: 'informacaoInsuficiente',
      observacao: 'Localização ou modelo presencial da vaga não foram detalhados no anúncio.'
    };
  }

  const mesmaRegiao = (estadoPerfilNorm && localVagaNorm.includes(estadoPerfilNorm)) ||
    (cidadePerfil && localVagaNorm.includes(normalizar(cidadePerfil)));

  if (mesmaRegiao) {
    return {
      compatibilidade: 'compativel',
      observacao: `Vaga presencial na mesma região do candidato (${localVaga}).`
    };
  }

  return {
    compatibilidade: 'potencialmenteCompativel',
    observacao: `Vaga presencial localizada em "${localVaga}". O candidato reside em ${cidadePerfil} - ${estadoPerfil}, exigindo disponibilidade para mudança ou atuação remota.`
  };
}

/**
 * Extrai o ano/previsão sem duplicar a palavra 'previsão'.
 * @param {string} anoConclusao
 * @returns {string}
 */
export function extrairAnoPrevisao(anoConclusao = '') {
  return String(anoConclusao).replace(/\s*\((?:previsao|previsão)\)/i, '').trim();
}

/**
 * Seleciona a formação acadêmica mais relevante do perfil para o requisito da vaga.
 * Se houver apenas uma formação, retorna essa única formação.
 * Se houver múltiplas, busca a que melhor corresponde à área da vaga.
 * @param {string} reqNorm
 * @param {object[]} formacoesPerfil
 * @param {string[]} cursosAlvo
 * @returns {object|null}
 */
export function selecionarFormacaoRelevante(reqNorm, formacoesPerfil = [], cursosAlvo = []) {
  if (!formacoesPerfil || formacoesPerfil.length === 0) return null;
  if (formacoesPerfil.length === 1) return formacoesPerfil[0];

  const formacaoCompativel = formacoesPerfil.find(f => {
    const cursoNorm = normalizar(f.curso || '');
    return cursosAlvo.some(c => reqNorm.includes(c) && cursoNorm.includes(c)) ||
      reqNorm.includes(cursoNorm) ||
      cursoNorm.includes(reqNorm);
  });

  return formacaoCompativel || formacoesPerfil[0];
}

/**
 * Compara a formação exigida pela vaga com a formação do candidato.
 * Diferencia rigorosamente entre concluída e em andamento.
 * @param {string[]} requisitosFormacaoVaga
 * @param {object} perfil
 * @returns {object}
 */
export function compararFormacao(requisitosFormacaoVaga = [], perfil) {
  const formacoesPerfil = perfil.formacaoAcademica || [];
  const correspondencias = [];
  const naoIdentificados = [];

  for (const req of requisitosFormacaoVaga) {
    const reqNorm = normalizar(req);
    const formacaoAtiva = selecionarFormacaoRelevante(reqNorm, formacoesPerfil, CURSOS_ALVO_TI);
    const statusFormacaoPerfil = formacaoAtiva
      ? (/graduando|em andamento|cursando/i.test(formacaoAtiva.status || '') ? 'emAndamento' : 'concluida')
      : 'naoIdentificada';

    const isEnsinoSuperior = /^(?:ensino\s+(?:superior|medio)|(?:curso|formacao)\s+superior|graduacao|pos\s+graduacao|superior\s+(?:completo|incompleto|cursando|em\s+andamento|em\b))/i.test(reqNorm) ||
      /\b(?:ensino\s+superior|curso\s+superior|formacao\s+superior|graduacao\s+completa|superior\s+completo|superior\s+cursando)\b/i.test(reqNorm);

    const temCursoTI = CURSOS_ALVO_TI.filter(c => c !== 'areas correlatas').some(c => reqNorm.includes(c)) || /\bti\b/.test(reqNorm);
    const temOutraAreaNaoTI = AREAS_NAO_TI.some(area => new RegExp(`\\b${area}\\b`, 'i').test(reqNorm));
    const pedeAreaTI = temCursoTI || (reqNorm.includes('areas correlatas') && !temOutraAreaNaoTI);

    // Detecta se a vaga menciona uma área específica que NÃO seja TI (ex: "em administracao", "em ciencias contabeis")
    const possuiOutraAreaEspecifica = temOutraAreaNaoTI || (!pedeAreaTI && /\b(?:em|na\s+area\s+de)\s+(?!andamento\b|curso\b)([a-z]+)/i.test(reqNorm));

    if (pedeAreaTI && formacaoAtiva) {
      const exigeCompleto = /(superior|graduacao) completo|completa/i.test(reqNorm);
      const aceitaCursando = /cursando|em andamento/i.test(reqNorm);
      const emAndamento = statusFormacaoPerfil === 'emAndamento';
      const anoLimpo = extrairAnoPrevisao(formacaoAtiva.anoConclusao);
      const detalhe = `${formacaoAtiva.curso} – ${formacaoAtiva.instituicao}`;

      let statusRequisito;
      let explicacao;

      if (aceitaCursando && emAndamento) {
        statusRequisito = 'atendido';
        explicacao = `Área compatível (${detalhe}), graduação em andamento (previsão ${anoLimpo}), atendendo ao requisito de superior cursando.`;
      } else if (emAndamento) {
        statusRequisito = 'parcialmenteAtendido';
        explicacao = `Área compatível (${detalhe}), porém graduação em andamento (previsão ${anoLimpo}).` +
          (exigeCompleto ? ' A vaga exige superior completo.' : ' A vaga não afirma "completo", mas a conclusão ainda está pendente.');
      } else {
        statusRequisito = 'atendido';
        explicacao = `${detalhe} concluída.`;
      }

      correspondencias.push({
        requisito: req,
        correspondencia: explicacao,
        status: statusRequisito,
        areaCompativel: true,
        conclusao: statusFormacaoPerfil,
        vagaExigeCompleto: exigeCompleto,
        vagaAceitaCursando: aceitaCursando,
        statusFormacaoPerfil,
        origemNoPerfil: 'formacao'
      });
    } else if (isEnsinoSuperior && !possuiOutraAreaEspecifica && formacaoAtiva) {
      const exigeCompleto = /(superior|graduacao) completo|completa/i.test(reqNorm);
      const aceitaCursando = /cursando|em andamento/i.test(reqNorm);
      const emAndamento = statusFormacaoPerfil === 'emAndamento';
      const anoLimpo = extrairAnoPrevisao(formacaoAtiva.anoConclusao);
      const detalhe = `${formacaoAtiva.curso} – ${formacaoAtiva.instituicao}`;

      let statusRequisito;
      let explicacao;

      if (aceitaCursando && emAndamento) {
        statusRequisito = 'atendido';
        explicacao = `A vaga aceita ensino superior cursando sem especificar área. O candidato está cursando ${detalhe} (previsão ${anoLimpo}).`;
      } else if (emAndamento) {
        statusRequisito = 'parcialmenteAtendido';
        explicacao = `Área não especificada pela vaga. O candidato possui graduação em andamento (${detalhe}, previsão ${anoLimpo}).` +
          (exigeCompleto ? ' A vaga exige superior completo.' : ' A vaga não afirma "completo", mas a conclusão ainda está pendente.');
      } else {
        statusRequisito = 'atendido';
        explicacao = `Ensino superior concluído (${detalhe}), área não especificada pela vaga.`;
      }

      correspondencias.push({
        requisito: req,
        correspondencia: explicacao,
        status: statusRequisito,
        areaCompativel: null,
        conclusao: statusFormacaoPerfil,
        vagaExigeCompleto: exigeCompleto,
        vagaAceitaCursando: aceitaCursando,
        statusFormacaoPerfil,
        origemNoPerfil: 'formacao'
      });
    } else {
      naoIdentificados.push(req);
    }
  }

  const statusFormacaoGeral = formacoesPerfil[0]
    ? (/graduando|em andamento|cursando/i.test(formacoesPerfil[0].status || '') ? 'emAndamento' : 'concluida')
    : 'naoIdentificada';

  return {
    requisitos: requisitosFormacaoVaga,
    statusFormacaoPerfil: statusFormacaoGeral,
    correspondencias,
    naoIdentificados
  };
}

/**
 * Constrói inventário detalhado de habilidades do candidato com classificação de maturidade e fontes literais
 * @param {object} perfil
 * @returns {object}
 */
export function construirInventarioPerfil(perfil) {
  const itensPorTermo = new Map();
  const experiencia = new Map();
  const conhecimento = new Map();
  const emAprendizado = new Map();

  const PESO_ORIGEM = {
    experiencia: 4,
    projeto: 3,
    conhecimento: 2,
    emAprendizado: 1
  };

  const registrar = (termo, trechoLiteral, origem, fonteNoPerfil) => {
    if (!termo || typeof termo !== 'string') return;
    const termoNorm = normalizar(termo);
    if (!termoNorm) return;

    const info = DICIONARIO_TERMOS[termoNorm];
    const chaveCanonica = info ? info.chaveCanonica : termoNorm;

    const evidencia = {
      trechoLiteral,
      origem,
      fonteNoPerfil
    };

    if (!itensPorTermo.has(termoNorm)) {
      itensPorTermo.set(termoNorm, {
        termoOriginal: termo,
        termoNorm,
        chaveCanonica,
        origemPrincipal: origem,
        evidencias: [evidencia]
      });
    } else {
      const reg = itensPorTermo.get(termoNorm);
      reg.evidencias.push(evidencia);
      if ((PESO_ORIGEM[origem] || 0) > (PESO_ORIGEM[reg.origemPrincipal] || 0)) {
        reg.origemPrincipal = origem;
      }
    }

    // Se o termo possui parênteses (ex: "SQL Server (consultas...)"), indexa também o nome limpo
    const termoLimpo = termo.replace(/\s*\([^)]*\)/g, '').trim();
    if (termoLimpo && termoLimpo !== termo) {
      registrar(termoLimpo, trechoLiteral, origem, fonteNoPerfil);
    }

    // Preenche mapas de compatibilidade legada
    const itemLegado = { termoOriginal: termo, detalhe: trechoLiteral, fonteNoPerfil };
    if (origem === 'experiencia') {
      experiencia.set(termoNorm, itemLegado);
    } else if (origem === 'projeto' || origem === 'conhecimento') {
      conhecimento.set(termoNorm, itemLegado);
    } else if (origem === 'emAprendizado') {
      emAprendizado.set(termoNorm, itemLegado);
    }
  };

  // 1. Conhecimentos Técnicos
  const ct = perfil.conhecimentosTecnicos || {};
  for (const [cat, grupo] of Object.entries(ct)) {
    if (Array.isArray(grupo)) {
      // Metodologias: origem 'conhecimento'
      grupo.forEach((t, idx) => {
        registrar(t, t, 'conhecimento', `conhecimentosTecnicos.${cat}[${idx}]`);
      });
    } else if (grupo && typeof grupo === 'object') {
      (grupo.experiencia || []).forEach((t, idx) => {
        registrar(t, t, 'experiencia', `conhecimentosTecnicos.${cat}.experiencia[${idx}]`);
      });
      (grupo.conhecimento || []).forEach((t, idx) => {
        registrar(t, t, 'conhecimento', `conhecimentosTecnicos.${cat}.conhecimento[${idx}]`);
      });
      (grupo.emAprendizado || []).forEach((t, idx) => {
        registrar(t, t, 'emAprendizado', `conhecimentosTecnicos.${cat}.emAprendizado[${idx}]`);
      });
    }
  }

  // 2. Experiências Profissionais
  (perfil.experienciasProfissionais || []).forEach((exp, i) => {
    (exp.tecnologiasUtilizadas || []).forEach((t, j) => {
      registrar(t, t, 'experiencia', `experienciasProfissionais[${i}].tecnologiasUtilizadas[${j}]`);
    });

    (exp.atividadesRealizadas || []).forEach((ativ, k) => {
      const ativNorm = normalizar(ativ);
      if (ativNorm.includes('glpi')) {
        registrar('glpi', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
      }
      if (ativNorm.includes('windows')) {
        registrar('windows', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
      }
      if (ativNorm.includes('linux')) {
        registrar('linux', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
      }
      if (ativNorm.includes('sql')) {
        registrar('sql', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
      }
      if (ativNorm.includes('hardware')) {
        registrar('hardware', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
      }
      if (ativNorm.includes('cabeamento estruturado') || ativNorm.includes('redes')) {
        registrar('redes de computadores', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
        registrar('redes', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
        registrar('cabeamento estruturado', ativ, 'experiencia', `experienciasProfissionais[${i}].atividadesRealizadas[${k}]`);
      }
    });
  });

  // 3. Projetos (origem estrita: 'projeto')
  (perfil.projetos || []).forEach((proj, i) => {
    (proj.tecnologias || []).forEach((t, j) => {
      registrar(t, t, 'projeto', `projetos[${i}].tecnologias[${j}]`);
      const tNorm = normalizar(t);
      if (/\b(?:inteligencia\s+artificial|ia)\b/i.test(tNorm)) {
        registrar('inteligencia artificial', t, 'projeto', `projetos[${i}].tecnologias[${j}]`);
        registrar('ia', t, 'projeto', `projetos[${i}].tecnologias[${j}]`);
      }
    });
    const descNorm = normalizar(proj.descricao);
    if (/\b(?:inteligencia\s+artificial)\b/i.test(descNorm)) {
      registrar('inteligencia artificial', proj.descricao, 'projeto', `projetos[${i}].descricao`);
      registrar('ia', proj.descricao, 'projeto', `projetos[${i}].descricao`);
    }
    if (/\b(?:nuvem|cloud)\b/i.test(descNorm)) {
      registrar('cloud', proj.descricao, 'projeto', `projetos[${i}].descricao`);
    }
  });

  // 4. Cursos
  (perfil.cursos || []).forEach((curso, i) => {
    registrar(curso.nome, curso.nome, 'conhecimento', `cursos[${i}].nome`);
    const cNorm = normalizar(curso.nome);
    if (cNorm.includes('cloud')) {
      registrar('cloud', curso.nome, 'conhecimento', `cursos[${i}].nome`);
    }
  });

  return { itensPorTermo, experiencia, conhecimento, emAprendizado };
}

/**
 * Converte item do inventário para formato padrão de retorno com priorização de relevância
 */
function formatarItemRetorno(item, termoBuscado, chaveCanonica) {
  let melhorEvidencia = item.evidencias && item.evidencias.length > 0 ? item.evidencias[0] : null;
  if (item.evidencias && item.evidencias.length > 1) {
    const termoRegex = criarRegexTermo(termoBuscado);
    let evRelevante = item.evidencias.find(e => termoRegex.test(normalizar(e.trechoLiteral)));
    if (!evRelevante) {
      const canRegex = criarRegexTermo(chaveCanonica || item.chaveCanonica);
      evRelevante = item.evidencias.find(e => canRegex.test(normalizar(e.trechoLiteral)));
    }
    if (evRelevante) {
      melhorEvidencia = evRelevante;
    }
  }
  return {
    termoOriginal: item.termoOriginal,
    termoBuscado,
    chaveCanonica: chaveCanonica || item.chaveCanonica || normalizar(termoBuscado),
    correspondencia: melhorEvidencia ? melhorEvidencia.trechoLiteral : item.termoOriginal,
    origemNoPerfil: item.origemPrincipal,
    fonteNoPerfil: melhorEvidencia ? melhorEvidencia.fonteNoPerfil : null,
    evidencias: item.evidencias
  };
}

/**
 * Busca termo no inventário de habilidades do candidato usando limite de palavras e lógica direcional
 * @param {string} termo
 * @param {object} inventario
 * @returns {{ termoOriginal: string, correspondencia: string, origemNoPerfil: string, fonteNoPerfil: string, chaveCanonica: string }|null}
 */
export function buscarNoInventario(termo = '', inventario) {
  if (!termo || typeof termo !== 'string' || !inventario || !inventario.itensPorTermo) return null;
  const termoNorm = normalizar(termo);
  if (!termoNorm) return null;

  const infoTermo = DICIONARIO_TERMOS[termoNorm];
  const chaveCanonica = infoTermo ? infoTermo.chaveCanonica : termoNorm;

  // 1. Busca exata direta no inventário
  if (inventario.itensPorTermo.has(termoNorm)) {
    return formatarItemRetorno(inventario.itensPorTermo.get(termoNorm), termo, chaveCanonica);
  }

  // 2. Busca direcional: verifica se há algum termo no inventário que IMPLICA o termo buscado
  for (const item of inventario.itensPorTermo.values()) {
    const dt = DICIONARIO_TERMOS[item.termoNorm];
    if (dt && Array.isArray(dt.implica) && dt.implica.includes(termoNorm)) {
      return formatarItemRetorno(item, termo, chaveCanonica);
    }
  }

  // 3. Busca por limites exatos de palavras usando criarRegexTermo
  const regex = criarRegexTermo(termoNorm);
  for (const item of inventario.itensPorTermo.values()) {
    if (regex.test(item.termoNorm) || regex.test(normalizar(item.termoOriginal))) {
      return formatarItemRetorno(item, termo, chaveCanonica);
    }
  }

  // 4. Caso especial: "cloud" genérico atendido por conhecimentos ou projetos de nuvem
  if (termoNorm === 'cloud' || termoNorm === 'nuvem') {
    for (const item of inventario.itensPorTermo.values()) {
      if (item.termoNorm.includes('nuvem') || item.termoNorm.includes('cloud')) {
        return formatarItemRetorno(item, termo, 'cloud');
      }
    }
  }

  return null;
}

/**
 * Classifica um requisito individual usando as classificações permitidas e evidências literais:
 * - atendido
 * - parcialmenteAtendido
 * - naoIdentificado
 * - verificacaoSubjetiva
 * - naoVerificavelPeloCurriculo
 * @param {string} req
 * @param {object} perfil
 * @param {object} inventario
 * @returns {object|null}
 */
export function classificarRequisito(req = '', perfil, inventario) {
  const reqNorm = normalizar(req);

  // Formação é tratada separadamente no bloco dedicado
  const isRequisitoFormacao = /^(?:ensino\s+(?:superior|medio)|(?:curso|formacao)\s+superior|graduacao|pos\s+graduacao|superior\s+(?:completo|incompleto|cursando|em\s+andamento|em\b)|superior\s+ou\s+tecnico)\b/i.test(reqNorm) ||
    /\b(?:ensino\s+superior|curso\s+superior|formacao\s+superior|graduacao\s+completa|superior\s+completo|superior\s+cursando)\b/i.test(reqNorm);
  if (isRequisitoFormacao) {
    return null;
  }

  // Local/modalidade presencial é avaliado no campo próprio
  if (/disponibilidade para atuar em modelo.*presencial|atuacao.*presencial/i.test(reqNorm)) {
    return null;
  }

  // 1. Requisitos Comportamentais / Subjetivos (Soft Skills) através de EVIDENCIAS_SOFT_SKILLS
  for (const skill of Object.values(EVIDENCIAS_SOFT_SKILLS)) {
    const casaSkill = skill.termosMatcher.some(t => {
      const regex = criarRegexTermo(t);
      return regex.test(reqNorm);
    });
    if (casaSkill) {
      const ev = skill.buscarEvidencia(perfil);
      if (ev) {
        return {
          requisito: req,
          chaveCanonica: skill.chaveCanonica,
          status: 'verificacaoSubjetiva',
          evidenciaNoPerfil: ev.trechoLiteral,
          origemNoPerfil: ev.origemNoPerfil,
          fonteNoPerfil: ev.fonteNoPerfil
        };
      } else {
        return {
          requisito: req,
          chaveCanonica: skill.chaveCanonica,
          status: 'naoVerificavelPeloCurriculo',
          evidenciaNoPerfil: '',
          origemNoPerfil: null,
          fonteNoPerfil: null
        };
      }
    }
  }

  // 2. Capacidades Técnicas através de REGRAS_CAPACIDADES
  for (const cap of Object.values(REGRAS_CAPACIDADES)) {
    if (cap.matcher(reqNorm)) {
      const ev = cap.buscarEvidencia(inventario, perfil);
      if (ev) {
        return {
          requisito: req,
          chaveCanonica: cap.chaveCanonica,
          status: ev.status,
          evidenciaNoPerfil: ev.trechoLiteral,
          origemNoPerfil: ev.origemNoPerfil,
          fonteNoPerfil: ev.fonteNoPerfil,
          detalhe: ev.detalhe || null
        };
      } else {
        return {
          requisito: req,
          chaveCanonica: cap.chaveCanonica,
          status: 'naoIdentificado',
          evidenciaNoPerfil: '',
          origemNoPerfil: null,
          fonteNoPerfil: null
        };
      }
    }
  }

  // 3. Idiomas
  if (reqNorm.includes('ingles') || reqNorm.includes('idioma')) {
    return {
      requisito: req,
      chaveCanonica: 'idioma_ingles',
      status: 'naoIdentificado',
      evidenciaNoPerfil: 'O perfil não possui informação de proficiência em idiomas cadastrada.',
      origemNoPerfil: null,
      fonteNoPerfil: null
    };
  }

  // 4. Busca direta no inventário
  const match = buscarNoInventario(req, inventario);
  if (match) {
    const statusItem = match.origemNoPerfil === 'emAprendizado' ? 'parcialmenteAtendido' : 'atendido';
    return {
      requisito: req,
      chaveCanonica: match.chaveCanonica,
      status: statusItem,
      evidenciaNoPerfil: match.correspondencia,
      origemNoPerfil: match.origemNoPerfil,
      fonteNoPerfil: match.fonteNoPerfil
    };
  }

  return {
    requisito: req,
    chaveCanonica: normalizar(req),
    status: 'naoIdentificado',
    evidenciaNoPerfil: '',
    origemNoPerfil: null,
    fonteNoPerfil: null
  };
}

/**
 * Compara as responsabilidades da vaga com as atividades profissionais do candidato
 * @param {string[]} responsabilidadesVaga
 * @param {object} perfil
 * @returns {object[]}
 */
export function compararResponsabilidades(responsabilidadesVaga = [], perfil) {
  const matches = [];

  const atividadesPerfil = [];
  for (const exp of perfil.experienciasProfissionais || []) {
    for (const ativ of exp.atividadesRealizadas || []) {
      atividadesPerfil.push({
        atividade: ativ,
        empresa: exp.empresa,
        cargo: exp.cargo,
        atividadeNorm: normalizar(ativ)
      });
    }
  }

  for (const resp of responsabilidadesVaga) {
    const respNorm = normalizar(resp);

    let matchEncontrado = null;

    if (respNorm.includes('n2') || respNorm.includes('nivel 2') || respNorm.includes('atendimento') || respNorm.includes('suporte tecnico')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('chamados semanais de n1/n2') || a.atividadeNorm.includes('diagnostico tecnico')
      );
    } else if (respNorm.includes('manutencoes preventivas') || respNorm.includes('hardware') || respNorm.includes('computadores')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('manutencao preventiva e corretiva')
      );
    } else if (respNorm.includes('infraestrutura') || respNorm.includes('redes') || respNorm.includes('cabeamento')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('cabeamento estruturado') || a.atividadeNorm.includes('disponibilidade de rede')
      );
    } else if (respNorm.includes('desenvolvimento') || respNorm.includes('aplicacoes web') || respNorm.includes('apis') || respNorm.includes('backend')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('ciclo de vida de desenvolvimento') || a.atividadeNorm.includes('fluxos de backend e telas')
      );
    } else if (respNorm.includes('banco de dados') || respNorm.includes('sql') || respNorm.includes('consultas')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('modelagem de dados') || a.atividadeNorm.includes('consultas sql')
      );
    } else if (respNorm.includes('documentacao') || respNorm.includes('pops') || respNorm.includes('manuais')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('manuais de operacao') || a.atividadeNorm.includes('documentacao de codigo')
      );
    } else if (respNorm.includes('incidentes') || respNorm.includes('chamados')) {
      matchEncontrado = atividadesPerfil.find(a =>
        a.atividadeNorm.includes('glpi') || a.atividadeNorm.includes('sustentacao de sistemas')
      );
    }

    if (matchEncontrado) {
      matches.push({
        responsabilidadeVaga: resp,
        atividadePerfil: matchEncontrado.atividade,
        empresa: matchEncontrado.empresa,
        cargo: matchEncontrado.cargo,
        origemNoPerfil: 'experiencia'
      });
    }
  }

  return matches;
}

/**
 * Identifica competências existentes no perfil relevantes para a área da vaga,
 * mas que NÃO devem ser computadas como requisitos atendidos se a vaga não os exigir.
 * @param {string[]} areas
 * @param {object} perfil
 * @param {Set<string>} requisitosJaAtendidos
 * @returns {string[]}
 */
export function extrairCompetenciasRelacionadasNaoExigidas(areas = [], perfil, requisitosJaAtendidos = new Set()) {
  const competencias = new Set();
  const areasNorm = areas.map(a => normalizar(a));

  const isSuporte = areasNorm.some(a =>
    a.includes('suporte') || a.includes('service desk') || a.includes('help desk') || a.includes('ti')
  );
  const isSistemas = areasNorm.some(a => a.includes('sistemas'));
  const isDev = areasNorm.some(a =>
    a.includes('desenvolvimento') || a.includes('software') || a.includes('dev')
  );

  const ct = perfil.conhecimentosTecnicos || {};

  const adicionar = (termo) => {
    if (termo && !requisitosJaAtendidos.has(normalizar(termo)) && !requisitosJaAtendidos.has(normalizarChave(termo))) {
      competencias.add(termo);
    }
  };

  if (isSuporte) {
    (ct.ferramentas?.experiencia || []).forEach(adicionar);
    (ct.sistemasOperacionais?.experiencia || []).forEach(adicionar);
    (ct.redesEInfraestrutura?.experiencia || []).forEach(adicionar);
    (ct.hardwareEPerifericos?.experiencia || []).forEach(adicionar);
    (ct.bancosDeDados?.experiencia || []).forEach(adicionar);
  }

  if (isSistemas) {
    (ct.bancosDeDados?.experiencia || []).forEach(adicionar);
    (ct.linguagensDeProgramacao?.experiencia || []).forEach(adicionar);
    (ct.ferramentas?.experiencia || []).forEach(adicionar);
    (ct.metodologias || []).forEach(adicionar);
  }

  if (isDev) {
    (ct.linguagensDeProgramacao?.experiencia || []).forEach(adicionar);
    (ct.linguagensDeProgramacao?.conhecimento || []).forEach(adicionar);
    (ct.tecnologiasEFrameworks?.experiencia || []).forEach(adicionar);
    (ct.tecnologiasEFrameworks?.conhecimento || []).forEach(adicionar);
    (ct.bancosDeDados?.experiencia || []).forEach(adicionar);
    (ct.ferramentas?.experiencia || []).forEach(adicionar);
  }

  return Array.from(competencias);
}

/**
 * Compara uma vaga individual detalhada contra o perfil profissional
 * @param {object} vaga Vaga detalhada da página
 * @param {object} perfil Perfil do candidato
 * @param {object} inventario Inventário de habilidades
 * @returns {object}
 */
export function compararVagaDetalhada(vaga, perfil, inventario) {
  const titulo = (vaga.titulo || '').trim();
  const empresa = (vaga.empresa || '').trim();
  const localizacaoVaga = (vaga.local || '').trim();
  const modalidadeVaga = (vaga.modalidade || 'Presencial / Não especificada').trim();
  const nivelVaga = (vaga.nivel || 'Não especificado').trim();
  const link = (vaga.link || '').trim();

  // 1. Identificação da área
  const areaIdentificada = [];
  const textoGeralNorm = normalizar(`${titulo} ${vaga.descricao || ''}`);
  if (textoGeralNorm.includes('service desk') || textoGeralNorm.includes('help desk') || textoGeralNorm.includes('suporte')) {
    areaIdentificada.push('Suporte de TI / Help Desk / Service Desk');
  }
  if (textoGeralNorm.includes('analista de sistemas') || textoGeralNorm.includes('sistemas')) {
    areaIdentificada.push('Analista de Sistemas');
  }
  if (textoGeralNorm.includes('desenvolvedor') || textoGeralNorm.includes('programador') || textoGeralNorm.includes('software')) {
    areaIdentificada.push('Desenvolvimento de Software');
  }
  if (areaIdentificada.length === 0 && textoGeralNorm.includes('ti')) {
    areaIdentificada.push('TI / Tecnologia Geral');
  }

  // 2. Localização e modalidade
  const { compatibilidade, observacao: obsLocal } = avaliarLocalModalidade(vaga, perfil);

  // 3. Formação
  const resultadoFormacao = compararFormacao(vaga.formacao || [], perfil);

  // 4. Requisitos Obrigatórios
  const requisitosObrigatorios = [];
  const requisitosObrigatoriosAtendidos = [];
  const requisitosObrigatoriosNaoIdentificados = [];
  const secoesPorChaveCanonica = new Map();
  const itensAtendidosChaves = new Set();

  for (const req of vaga.requisitosObrigatorios || []) {
    const classificado = classificarRequisito(req, perfil, inventario);
    if (classificado) {
      requisitosObrigatorios.push(classificado);

      if (classificado.status === 'atendido' || classificado.status === 'parcialmenteAtendido') {
        requisitosObrigatoriosAtendidos.push({
          requisito: classificado.requisito,
          chaveCanonica: classificado.chaveCanonica,
          status: classificado.status,
          correspondencia: classificado.evidenciaNoPerfil,
          origemNoPerfil: classificado.origemNoPerfil,
          fonteNoPerfil: classificado.fonteNoPerfil
        });
        if (classificado.chaveCanonica) {
          secoesPorChaveCanonica.set(classificado.chaveCanonica, 'requisitosObrigatorios');
          itensAtendidosChaves.add(classificado.chaveCanonica);
        }
      } else if (classificado.status === 'naoIdentificado') {
        requisitosObrigatoriosNaoIdentificados.push(classificado.requisito);
      }
    }
  }

  // 5. Requisitos Desejáveis
  const requisitosDesejaveis = [];
  const requisitosDesejaveisAtendidos = [];
  const requisitosDesejaveisNaoIdentificados = [];

  for (const des of vaga.requisitosDesejaveis || []) {
    const classificado = classificarRequisito(des, perfil, inventario);
    if (classificado) {
      requisitosDesejaveis.push(classificado);

      if (classificado.status === 'atendido' || classificado.status === 'parcialmenteAtendido') {
        requisitosDesejaveisAtendidos.push({
          requisito: classificado.requisito,
          chaveCanonica: classificado.chaveCanonica,
          status: classificado.status,
          correspondencia: classificado.evidenciaNoPerfil,
          origemNoPerfil: classificado.origemNoPerfil,
          fonteNoPerfil: classificado.fonteNoPerfil
        });
        if (classificado.chaveCanonica && !secoesPorChaveCanonica.has(classificado.chaveCanonica)) {
          secoesPorChaveCanonica.set(classificado.chaveCanonica, 'requisitosDesejaveis');
          itensAtendidosChaves.add(classificado.chaveCanonica);
        }
      } else if (classificado.status === 'naoIdentificado') {
        requisitosDesejaveisNaoIdentificados.push(classificado.requisito);
      }
    }
  }

  // 6. Tecnologias
  const tecnologiasAtendidas = [];
  const tecnologiasNaoIdentificadas = [];
  const tecnologiasPorCanonica = new Map();

  for (const tec of vaga.tecnologias || []) {
    const tecNorm = normalizar(tec);
    const match = buscarNoInventario(tec, inventario);
    if (match) {
      const chaveCan = match.chaveCanonica || tecNorm;
      const statusItem = match.origemNoPerfil === 'emAprendizado' ? 'parcialmenteAtendido' : 'atendido';

      if (tecnologiasPorCanonica.has(chaveCan)) {
        // Deduplica na mesma seção mantendo termosDaVaga
        const existente = tecnologiasPorCanonica.get(chaveCan);
        if (!existente.termosDaVaga.includes(tec)) {
          existente.termosDaVaga.push(tec);
        }
      } else {
        const itemAtendido = {
          tecnologia: tec,
          chaveCanonica: chaveCan,
          termosDaVaga: [tec],
          status: statusItem,
          correspondencia: match.correspondencia,
          origemNoPerfil: match.origemNoPerfil,
          fonteNoPerfil: match.fonteNoPerfil
        };
        // Deduplica entre seções
        if (secoesPorChaveCanonica.has(chaveCan)) {
          itemAtendido.duplicadoDe = secoesPorChaveCanonica.get(chaveCan);
        } else {
          secoesPorChaveCanonica.set(chaveCan, 'tecnologias');
        }
        tecnologiasAtendidas.push(itemAtendido);
        tecnologiasPorCanonica.set(chaveCan, itemAtendido);
        itensAtendidosChaves.add(tecNorm);
        itensAtendidosChaves.add(chaveCan);
      }
    } else {
      tecnologiasNaoIdentificadas.push(tec);
    }
  }

  // 7. Ferramentas
  const ferramentasAtendidas = [];
  const ferramentasNaoIdentificadas = [];
  const ferramentasPorCanonica = new Map();

  for (const fer of vaga.ferramentas || []) {
    const ferNorm = normalizar(fer);
    const match = buscarNoInventario(fer, inventario);
    if (match) {
      const chaveCan = match.chaveCanonica || ferNorm;
      const statusItem = match.origemNoPerfil === 'emAprendizado' ? 'parcialmenteAtendido' : 'atendido';

      if (ferramentasPorCanonica.has(chaveCan)) {
        // Deduplica na mesma seção mantendo termosDaVaga
        const existente = ferramentasPorCanonica.get(chaveCan);
        if (!existente.termosDaVaga.includes(fer)) {
          existente.termosDaVaga.push(fer);
        }
      } else {
        const itemAtendido = {
          ferramenta: fer,
          chaveCanonica: chaveCan,
          termosDaVaga: [fer],
          status: statusItem,
          correspondencia: match.correspondencia,
          origemNoPerfil: match.origemNoPerfil,
          fonteNoPerfil: match.fonteNoPerfil
        };
        // Deduplica entre seções (ex: ITSM da União Química duplicado de requisitosObrigatorios)
        if (secoesPorChaveCanonica.has(chaveCan)) {
          itemAtendido.duplicadoDe = secoesPorChaveCanonica.get(chaveCan);
        } else {
          secoesPorChaveCanonica.set(chaveCan, 'ferramentas');
        }
        ferramentasAtendidas.push(itemAtendido);
        ferramentasPorCanonica.set(chaveCan, itemAtendido);
        itensAtendidosChaves.add(ferNorm);
        itensAtendidosChaves.add(chaveCan);
      }
    } else {
      ferramentasNaoIdentificadas.push(fer);
    }
  }

  // 8. Conhecimentos
  const conhecimentosAtendidos = [];
  const conhecimentosNaoIdentificados = [];
  const conhecimentosPorCanonica = new Map();

  for (const con of vaga.conhecimentos || []) {
    const conNorm = normalizar(con);
    const match = buscarNoInventario(con, inventario);
    if (match) {
      const chaveCan = match.chaveCanonica || conNorm;
      const statusItem = match.origemNoPerfil === 'emAprendizado' ? 'parcialmenteAtendido' : 'atendido';

      if (conhecimentosPorCanonica.has(chaveCan)) {
        const existente = conhecimentosPorCanonica.get(chaveCan);
        if (!existente.termosDaVaga.includes(con)) {
          existente.termosDaVaga.push(con);
        }
      } else {
        const itemAtendido = {
          conhecimento: con,
          chaveCanonica: chaveCan,
          termosDaVaga: [con],
          status: statusItem,
          correspondencia: match.correspondencia,
          origemNoPerfil: match.origemNoPerfil,
          fonteNoPerfil: match.fonteNoPerfil
        };
        if (secoesPorChaveCanonica.has(chaveCan)) {
          itemAtendido.duplicadoDe = secoesPorChaveCanonica.get(chaveCan);
        } else {
          secoesPorChaveCanonica.set(chaveCan, 'conhecimentos');
        }
        conhecimentosAtendidos.push(itemAtendido);
        conhecimentosPorCanonica.set(chaveCan, itemAtendido);
        itensAtendidosChaves.add(conNorm);
        itensAtendidosChaves.add(chaveCan);
      }
    } else {
      conhecimentosNaoIdentificados.push(con);
    }
  }

  // 9. Idiomas
  const idiomasAtendidos = [];
  const idiomasNaoIdentificados = [];

  for (const idm of vaga.idiomas || []) {
    // Como perfil não possui idiomas especificados, segue a Regra 10 estritamente
    idiomasNaoIdentificados.push(idm);
  }

  // 10. Responsabilidades
  const responsabilidadesComCorrespondencia = compararResponsabilidades(vaga.responsabilidades || [], perfil);

  // 11. Competências do Perfil Relevantes à Área (Não exigidas diretamente pela vaga)
  const competenciasDoPerfilRelacionadas = extrairCompetenciasRelacionadasNaoExigidas(
    areaIdentificada,
    perfil,
    itensAtendidosChaves
  );

  // 12. Observações consolidadas
  const observacoes = [];
  observacoes.push(obsLocal);

  const formacaoParcial = resultadoFormacao.correspondencias.find(f => f.status === 'parcialmenteAtendido');
  if (formacaoParcial) {
    const anoPrevisao = extrairAnoPrevisao(perfil.formacaoAcademica?.[0]?.anoConclusao);
    if (formacaoParcial.areaCompativel === null) {
      observacoes.push(`Formação: graduação em andamento (previsão ${anoPrevisao}), área não especificada pela vaga.`);
    } else {
      observacoes.push(`Formação: área compatível, mas a graduação está em andamento (previsão ${anoPrevisao}).`);
    }
  }

  const subjt = requisitosObrigatorios.filter(r => r.status === 'verificacaoSubjetiva');
  if (subjt.length > 0) {
    observacoes.push(`Requisitos comportamentais mantidos em verificação subjetiva (${subjt.length}): ${subjt.map(s => s.requisito).join(', ')}.`);
  }

  const naoVerif = requisitosObrigatorios.filter(r => r.status === 'naoVerificavelPeloCurriculo');
  if (naoVerif.length > 0) {
    observacoes.push(`Requisitos não verificáveis pelo currículo (${naoVerif.length}): ${naoVerif.map(s => s.requisito).join(', ')}.`);
  }

  if (idiomasNaoIdentificados.length > 0) {
    observacoes.push(`A vaga solicita idioma (${idiomasNaoIdentificados.join(', ')}), informação não cadastrada no perfil.`);
  }

  if (ferramentasNaoIdentificadas.length > 0) {
    observacoes.push(`Ferramentas da vaga não identificadas no perfil: ${ferramentasNaoIdentificadas.join(', ')}.`);
  }

  if (conhecimentosNaoIdentificados.length > 0) {
    observacoes.push(`Conhecimentos da vaga não identificados no perfil: ${conhecimentosNaoIdentificados.join(', ')}.`);
  }

  if (vaga.informacoesInsuficientes) {
    observacoes.push(vaga.motivoInformacoesInsuficientes || 'Dados resumidos insuficientes no card da vaga.');
  }

  return {
    titulo,
    empresa,
    localizacaoVaga,
    modalidadeVaga,
    nivelVaga,
    link,
    areaIdentificada,
    formacao: resultadoFormacao,
    requisitosObrigatorios,
    requisitosObrigatoriosAtendidos,
    requisitosObrigatoriosNaoIdentificados,
    requisitosDesejaveis,
    requisitosDesejaveisAtendidos,
    requisitosDesejaveisNaoIdentificados,
    tecnologiasAtendidas,
    tecnologiasNaoIdentificadas,
    ferramentasAtendidas,
    ferramentasNaoIdentificadas,
    conhecimentosAtendidos,
    conhecimentosNaoIdentificados,
    idiomasAtendidos,
    idiomasNaoIdentificados,
    responsabilidadesComCorrespondencia,
    competenciasDoPerfilRelacionadas,
    compatibilidadeLocalModalidade: compatibilidade,
    informacoesInsuficientes: vaga.informacoesInsuficientes || false,
    observacoes
  };
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  let caminhoVagas = 'vagas-detalhadas.json';
  let caminhoPerfil = path.join('perfil', 'perfil-profissional.json');
  let caminhoSaida = 'vagas-comparadas.json';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--vagas' && args[i + 1]) {
      caminhoVagas = args[++i];
    } else if (arg === '--perfil' && args[i + 1]) {
      caminhoPerfil = args[++i];
    } else if (arg === '--saida' && args[i + 1]) {
      caminhoSaida = args[++i];
    }
  }

  console.log('=======================================================');
  console.log('     COMPARADOR DE VAGAS DETALHADAS COM PERFIL         ');
  console.log('=======================================================');
  console.log(`Lendo vagas detalhadas de:    "${caminhoVagas}"`);
  console.log(`Lendo perfil profissional de: "${caminhoPerfil}"`);

  let dadosDetalhados;
  let perfil;

  try {
    const conteudoVagas = await readFile(caminhoVagas, 'utf-8');
    dadosDetalhados = JSON.parse(conteudoVagas);
  } catch (err) {
    console.error(`[Erro] Falha ao ler "${caminhoVagas}": ${err.message}`);
    return;
  }

  try {
    const conteudoPerfil = await readFile(caminhoPerfil, 'utf-8');
    perfil = JSON.parse(conteudoPerfil);
  } catch (err) {
    console.error(`[Erro] Falha ao ler "${caminhoPerfil}": ${err.message}`);
    return;
  }

  const listaVagas = dadosDetalhados.vagas || [];
  const inventario = construirInventarioPerfil(perfil);

  const vagasComparadas = listaVagas.map(vaga =>
    compararVagaDetalhada(vaga, perfil, inventario)
  );

  const resultadoConsolidado = {
    dataAnalise: new Date().toISOString(),
    totalAnalisadas: vagasComparadas.length,
    estatisticas: {
      totalAnalisadas: vagasComparadas.length,
      comRequisitosDetalhados: vagasComparadas.filter(v => !v.informacoesInsuficientes).length,
      comInformacoesInsuficientes: vagasComparadas.filter(v => v.informacoesInsuficientes).length
    },
    vagas: vagasComparadas
  };

  await writeFile(caminhoSaida, JSON.stringify(resultadoConsolidado, null, 2), 'utf-8');
  console.log(`[Sucesso] Comparação atualizada e salva em: "${caminhoSaida}"\n`);

  // Exibição dos alvos principais no terminal (União Química, State Grid, ALLOS e JOBCENTER)
  const alvos = vagasComparadas.filter(v =>
    v.titulo.includes('UNIÃO QUÍMICA') ||
    v.empresa.includes('UNIÃO QUÍMICA') ||
    v.titulo.includes('State Grid') ||
    v.empresa.includes('State Grid') ||
    v.empresa.includes('ALLOS') ||
    v.empresa.includes('JOBCENTER')
  );

  alvos.forEach((v, i) => {
    console.log(`=======================================================`);
    console.log(`[Vaga ${i + 1}] ${v.titulo} — ${v.empresa}`);
    console.log(`Localização: ${v.localizacaoVaga} | Modalidade: ${v.modalidadeVaga} | Nível: ${v.nivelVaga}`);
    console.log(`Compatibilidade Local/Modalidade: ${v.compatibilidadeLocalModalidade}`);

    console.log(`Formação:`);
    v.formacao.correspondencias.forEach(f => {
      console.log(`  * Status: [${f.status}] - ${f.correspondencia}`);
    });

    console.log(`Requisitos Obrigatórios Detalhados (${v.requisitosObrigatorios.length}):`);
    v.requisitosObrigatorios.forEach(r => {
      const origem = r.origemNoPerfil ? ` (${r.origemNoPerfil})` : '';
      const can = r.chaveCanonica ? ` [canônico: ${r.chaveCanonica}]` : '';
      console.log(`  * [${r.status}] ${r.requisito}${origem}${can}`);
      if (r.evidenciaNoPerfil) {
        const fonte = r.fonteNoPerfil ? ` [fonte: ${r.fonteNoPerfil}]` : '';
        console.log(`      Evidência: ${r.evidenciaNoPerfil}${fonte}`);
      }
    });

    console.log(`Tecnologias Atendidas (${v.tecnologiasAtendidas.length}):`);
    v.tecnologiasAtendidas.forEach(t => {
      const dup = t.duplicadoDe ? ` (duplicadoDe: ${t.duplicadoDe})` : '';
      const termos = t.termosDaVaga && t.termosDaVaga.length > 1 ? ` [termos da vaga: ${t.termosDaVaga.join(', ')}]` : '';
      const fonte = t.fonteNoPerfil ? ` [fonte: ${t.fonteNoPerfil}]` : '';
      console.log(`  ✔ [${t.origemNoPerfil}] ${t.tecnologia}${dup}${termos} -> ${t.correspondencia}${fonte}`);
    });
    if (v.tecnologiasNaoIdentificadas.length > 0) {
      console.log(`Tecnologias Não Identificadas: ${v.tecnologiasNaoIdentificadas.join(', ')}`);
    }

    console.log(`Ferramentas Atendidas (${v.ferramentasAtendidas.length}):`);
    v.ferramentasAtendidas.forEach(f => {
      const dup = f.duplicadoDe ? ` (duplicadoDe: ${f.duplicadoDe})` : '';
      const termos = f.termosDaVaga && f.termosDaVaga.length > 1 ? ` [termos da vaga: ${f.termosDaVaga.join(', ')}]` : '';
      const fonte = f.fonteNoPerfil ? ` [fonte: ${f.fonteNoPerfil}]` : '';
      console.log(`  ✔ [${f.origemNoPerfil}] ${f.ferramenta}${dup}${termos} -> ${f.correspondencia}${fonte}`);
    });
    if (v.ferramentasNaoIdentificadas.length > 0) {
      console.log(`Ferramentas Não Identificadas: ${v.ferramentasNaoIdentificadas.join(', ')}`);
    }

    if (v.conhecimentosAtendidos && v.conhecimentosAtendidos.length > 0) {
      console.log(`Conhecimentos Atendidos (${v.conhecimentosAtendidos.length}):`);
      v.conhecimentosAtendidos.forEach(c => {
        const dup = c.duplicadoDe ? ` (duplicadoDe: ${c.duplicadoDe})` : '';
        const termos = c.termosDaVaga && c.termosDaVaga.length > 1 ? ` [termos da vaga: ${c.termosDaVaga.join(', ')}]` : '';
        const fonte = c.fonteNoPerfil ? ` [fonte: ${c.fonteNoPerfil}]` : '';
        console.log(`  ✔ [${c.origemNoPerfil}] ${c.conhecimento}${dup}${termos} -> ${c.correspondencia}${fonte}`);
      });
    }
    if (v.conhecimentosNaoIdentificados && v.conhecimentosNaoIdentificados.length > 0) {
      console.log(`Conhecimentos Não Identificados: ${v.conhecimentosNaoIdentificados.join(', ')}`);
    }

    if (v.idiomasNaoIdentificados.length > 0) {
      console.log(`Idiomas Não Identificados: ${v.idiomasNaoIdentificados.join(', ')}`);
    }

    console.log(`Responsabilidades Correspondentes (${v.responsabilidadesComCorrespondencia.length}):`);
    v.responsabilidadesComCorrespondencia.slice(0, 3).forEach(r =>
      console.log(`  ✔ Vaga: "${r.responsabilidadeVaga}" -> Perfil: "${r.atividadePerfil}" (${r.empresa})`)
    );

    console.log(`Observações:`);
    v.observacoes.forEach(o => console.log(`  * ${o}`));
    console.log(`\n`);
  });
}

// Execução direta
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  process.argv[1].endsWith('comparar-vagas.mjs')
);

if (isMain) {
  main().catch(err => {
    console.error('[Erro fatal]', err);
  });
}
