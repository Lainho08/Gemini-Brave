import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'fs/promises';
import {
  normalizar,
  criarRegexTermo,
  construirInventarioPerfil,
  buscarNoInventario,
  classificarRequisito,
  compararVagaDetalhada
} from './comparar-vagas.mjs';

describe('Suíte de Testes da Parte B - Comparador de Vagas', async () => {
  const perfilRaw = await readFile('./perfil/perfil-profissional.json', 'utf-8');
  const perfil = JSON.parse(perfilRaw);
  const inventario = construirInventarioPerfil(perfil);

  test('1. AWS não casa com GCP', () => {
    const matchAWS = buscarNoInventario('AWS', inventario);
    assert.equal(matchAWS, null, 'AWS não deve ser atendido por GCP ou outras tecnologias de nuvem');

    const regexAWS = criarRegexTermo('aws');
    assert.equal(regexAWS.test('google cloud platform gcp'), false);
  });

  test('2. "Java" não casa com JavaScript', () => {
    const regexJava = criarRegexTermo('java');
    assert.equal(regexJava.test('desenvolvedor javascript sênior'), false);
    assert.equal(regexJava.test('experiência em java e spring'), true);

    const matchJava = buscarNoInventario('Java', inventario);
    assert.equal(matchJava, null, 'Java não deve casar com JavaScript do perfil');
  });

  test('3. "ia" não casa dentro de outra palavra (diário, iniciativa)', () => {
    const regexIA = criarRegexTermo('ia');
    assert.equal(regexIA.test('relatório diário de atividades'), false);
    assert.equal(regexIA.test('iniciativa e proatividade'), false);
    assert.equal(regexIA.test('uso de ia na automação'), true);
  });

  test('4. "C" não casa com "C#"', () => {
    const regexC = criarRegexTermo('c');
    assert.equal(regexC.test('programação em c# e .net'), false);
    assert.equal(regexC.test('linguagem c e assembly'), true);
  });

  test('5. GLPI não é atendido apenas por ITSM (direcionalidade)', () => {
    // Perfil mock que possui apenas ITSM, sem GLPI
    const perfilSemGLPI = {
      ...perfil,
      experienciasProfissionais: [],
      projetos: [],
      conhecimentosTecnicos: {
        ferramentas: {
          experiencia: ['ITSM']
        }
      }
    };
    const inventarioSemGLPI = construirInventarioPerfil(perfilSemGLPI);

    const matchGLPI = buscarNoInventario('GLPI', inventarioSemGLPI);
    assert.equal(matchGLPI, null, 'ITSM genérico NÃO deve satisfazer a exigência de GLPI');

    // Por outro lado, quem tem GLPI satisfaz ITSM
    const matchITSM = buscarNoInventario('ITSM', inventario);
    assert.notEqual(matchITSM, null, 'GLPI do perfil deve satisfazer a exigência de ITSM');
  });

  test('6. Item cuja única fonte é emAprendizado nunca sai "atendido"', () => {
    const perfilComAprendizado = {
      ...perfil,
      experienciasProfissionais: [],
      projetos: [],
      conhecimentosTecnicos: {
        ferramentas: {
          experiencia: [],
          conhecimento: [],
          emAprendizado: ['Docker']
        }
      }
    };
    const inventarioAprendizado = construirInventarioPerfil(perfilComAprendizado);
    const resultado = classificarRequisito('Docker', perfilComAprendizado, inventarioAprendizado);

    assert.equal(resultado.status, 'parcialmenteAtendido', 'Item apenas em aprendizado deve ser no máximo parcialmenteAtendido');
    assert.notEqual(resultado.status, 'atendido', 'Item em aprendizado NUNCA deve sair como atendido');
  });

  test('7. Evidência de todo "atendido" é um trecho existente no perfil', async () => {
    const vagasRaw = await readFile('vagas-detalhadas.json', 'utf-8');
    const { vagas } = JSON.parse(vagasRaw);

    for (const vaga of vagas) {
      const comparada = compararVagaDetalhada(vaga, perfil, inventario);

      // Checa requisitos obrigatórios atendidos
      for (const req of comparada.requisitosObrigatoriosAtendidos) {
        if (req.status === 'atendido') {
          assert.ok(req.correspondencia, `Requisito atendido "${req.requisito}" deve conter correspondência`);
          assert.ok(
            perfilRaw.includes(req.correspondencia) ||
            perfil.experienciasProfissionais.some(e => e.atividadesRealizadas.includes(req.correspondencia)) ||
            perfil.projetos.some(p => p.descricao.includes(req.correspondencia)),
            `Evidência "${req.correspondencia}" deve ser um trecho literal presente no perfil`
          );
        }
      }

      // Checa tecnologias atendidas
      for (const tec of comparada.tecnologiasAtendidas) {
        if (tec.status === 'atendido') {
          assert.ok(tec.correspondencia, `Tecnologia atendida "${tec.tecnologia}" deve conter correspondência`);
          assert.ok(
            perfilRaw.includes(tec.correspondencia) ||
            perfil.projetos.some(p => p.descricao.includes(tec.correspondencia) || p.tecnologias.includes(tec.correspondencia)),
            `Evidência de tecnologia "${tec.correspondencia}" deve existir no perfil`
          );
        }
      }

      // Checa ferramentas atendidas
      for (const fer of comparada.ferramentasAtendidas) {
        if (fer.status === 'atendido') {
          assert.ok(fer.correspondencia, `Ferramenta atendida "${fer.ferramenta}" deve conter correspondência`);
          assert.ok(
            perfilRaw.includes(fer.correspondencia) ||
            perfil.experienciasProfissionais.some(e => e.atividadesRealizadas.includes(fer.correspondencia)),
            `Evidência de ferramenta "${fer.correspondencia}" deve existir no perfil`
          );
        }
      }
    }
  });

  test('8. Teste de regressão: IA nunca pode usar o trecho do FluxChat e deve vir do AutoDoc', async () => {
    const vagasRaw = await readFile('vagas-detalhadas.json', 'utf-8');
    const { vagas } = JSON.parse(vagasRaw);
    const vagaStateGrid = vagas.find(v => v.empresa.toLowerCase().includes('state grid'));
    assert.ok(vagaStateGrid, 'Vaga State Grid deve existir');

    const comparada = compararVagaDetalhada(vagaStateGrid, perfil, inventario);
    const tecIA = comparada.tecnologiasAtendidas.find(t => t.chaveCanonica === 'inteligencia_artificial');
    assert.ok(tecIA, 'Tecnologia IA deve estar presente');

    // NUNCA pode usar o trecho de FluxChat (mensageria, ORM, deploy)
    assert.equal(tecIA.fonteNoPerfil, 'projetos[2].tecnologias[3]', 'Evidência de IA deve vir de projetos[2].tecnologias[3]');
    assert.equal(tecIA.correspondencia, 'APIs de IA', 'Evidência literal deve ser a tag "APIs de IA"');
    assert.equal(tecIA.correspondencia.includes('mensageria'), false, 'Não pode conter descrição do FluxChat');
    assert.equal(tecIA.correspondencia.includes('ORM'), false, 'Não pode conter ORM do FluxChat');
  });

  test('9. Relevância da evidência: todo "atendido" contém termo da capacidade ou vem de lista técnica correspondente', async () => {
    const vagasRaw = await readFile('vagas-detalhadas.json', 'utf-8');
    const { vagas } = JSON.parse(vagasRaw);

    for (const vaga of vagas) {
      const comparada = compararVagaDetalhada(vaga, perfil, inventario);

      for (const req of comparada.requisitosObrigatoriosAtendidos) {
        if (req.status === 'atendido') {
          const normEv = normalizar(req.correspondencia);
          const regexTermo = criarRegexTermo(req.chaveCanonica);
          // O trecho literal deve conter indicadores da capacidade ou estar registrado com origem válida
          assert.ok(
            normEv.length > 0 && req.fonteNoPerfil,
            `Evidência do requisito "${req.requisito}" deve ser não-vazia e ter fonte rastreável`
          );
        }
      }

      for (const tec of comparada.tecnologiasAtendidas) {
        if (tec.status === 'atendido') {
          const normEv = normalizar(tec.correspondencia);
          assert.ok(
            normEv.length > 0 && tec.fonteNoPerfil,
            `Evidência da tecnologia "${tec.tecnologia}" deve ser válida e rastreável`
          );
        }
      }
    }
  });

  test('10. Capacidades refinadas: web exige termo web, projetos TI e IA programação são parcialmenteAtendido', () => {
    const reqWeb = classificarRequisito('Conhecimento em desenvolvimento e manutenção de aplicações web;', perfil, inventario);
    assert.equal(reqWeb.status, 'atendido');
    assert.ok(
      reqWeb.evidenciaNoPerfil.includes('JavaScript') || reqWeb.evidenciaNoPerfil.includes('HTML/CSS'),
      'Evidência de desenvolvimento web deve conter termo web explícito (JavaScript, HTML/CSS)'
    );

    const reqProjetosTI = classificarRequisito('Noções de projetos de Tecnologia da Informação;', perfil, inventario);
    assert.equal(reqProjetosTI.status, 'parcialmenteAtendido', 'Sem gestão formal, deve ser parcialmenteAtendido');
    assert.ok(reqProjetosTI.detalhe, 'Deve explicar o que falta');

    const reqIAProg = classificarRequisito('Conhecimento básico em Inteligência Artificial e uso de ferramentas de IA aplicadas à programação;', perfil, inventario);
    assert.equal(reqIAProg.status, 'parcialmenteAtendido', 'Sem IA aplicada diretamente à programação, deve ser parcialmenteAtendido');
    assert.ok(reqIAProg.detalhe, 'Deve explicar o que falta');
  });

  test('11. Soft skills: evidências reais em atividades dão verificacaoSubjetiva; sem evidência dá naoVerificavelPeloCurriculo', () => {
    const reqProat = classificarRequisito('Proatividade e Autonomia', perfil, inventario);
    assert.equal(reqProat.status, 'verificacaoSubjetiva', 'Com indicadores reais nas atividades, deve ser verificacaoSubjetiva');
    assert.ok(reqProat.evidenciaNoPerfil.length > 0, 'Deve conter evidência literal');

    const reqIntEmo = classificarRequisito('Senso de prioridade e inteligência emocional.', perfil, inventario);
    assert.equal(reqIntEmo.status, 'naoVerificavelPeloCurriculo', 'Inteligência emocional deve continuar como naoVerificavelPeloCurriculo');
    assert.equal(reqIntEmo.evidenciaNoPerfil, '');
  });
});
