import { StatusConsulta } from '../../generated/prisma/enums';
import { AppError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { criarPrismaMock, type PrismaMock } from '../../tests/helpers/prismaMock';
import {
  ANTECEDENCIA_CANCELAMENTO_HORAS,
  ConsultaService,
  DURACAO_CONSULTA_MINUTOS,
} from './consulta.service';

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

// Relógio fixo: todos os testes "acontecem" em 01/11/2026 às 10:00 UTC
const AGORA = new Date('2026-11-01T10:00:00.000Z');
const agoraFixo = () => new Date(AGORA);
const daquiA = (ms: number) => new Date(AGORA.getTime() + ms);

const CONSULTA_ID = '0b9d5a3c-1f0e-4a5b-9c8d-7e6f5a4b3c2d';
const PACIENTE_ID = '7d5eca69-ae6d-4a4c-85a0-ad3f36736306';
const MEDICO_ID = '53a71bf4-3458-4f4a-ae66-9c50b7c8f21d';

const paciente = { id: PACIENTE_ID, nome: 'Maria Silva' };
const medico = { id: MEDICO_ID, nome: 'Dr. João Souza', especialidade: 'Cardiologia' };

const incluirRelacoes = {
  paciente: { select: { id: true, nome: true } },
  medico: { select: { id: true, nome: true, especialidade: true } },
};

function criarConsulta(sobrescrever: Partial<{ dataHora: Date; status: StatusConsulta }> = {}) {
  return {
    id: CONSULTA_ID,
    pacienteId: PACIENTE_ID,
    medicoId: MEDICO_ID,
    dataHora: daquiA(48 * HORA_MS),
    status: StatusConsulta.AGENDADA,
    paciente,
    medico,
    ...sobrescrever,
  };
}

describe('ConsultaService', () => {
  let mock: PrismaMock;
  let service: ConsultaService;

  beforeEach(() => {
    const prisma = criarPrismaMock();
    mock = prisma.mock;
    service = new ConsultaService(prisma.db, agoraFixo);
  });

  describe('listar', () => {
    it('repassa os filtros, inclui as relações e ordena por data', async () => {
      const filtros = { medicoId: MEDICO_ID, status: StatusConsulta.AGENDADA };
      mock.consulta.findMany.mockResolvedValue([criarConsulta()]);

      await service.listar(filtros);

      expect(mock.consulta.findMany).toHaveBeenCalledWith({
        where: filtros,
        include: incluirRelacoes,
        orderBy: { dataHora: 'asc' },
      });
    });

    it('lista sem filtros quando nenhum é informado', async () => {
      mock.consulta.findMany.mockResolvedValue([]);

      await service.listar();

      expect(mock.consulta.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('buscarPorId', () => {
    it('retorna a consulta com paciente e médico', async () => {
      const consulta = criarConsulta();
      mock.consulta.findUnique.mockResolvedValue(consulta);

      await expect(service.buscarPorId(CONSULTA_ID)).resolves.toEqual(consulta);
      expect(mock.consulta.findUnique).toHaveBeenCalledWith({
        where: { id: CONSULTA_ID },
        include: incluirRelacoes,
      });
    });

    it('lança NotFoundError (404) quando não existe', async () => {
      mock.consulta.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId(CONSULTA_ID)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Consulta não encontrado(a)',
      });
    });
  });

  describe('agendar', () => {
    const dataHora = daquiA(2 * HORA_MS);
    const dados = { pacienteId: PACIENTE_ID, medicoId: MEDICO_ID, dataHora };

    function prepararCenarioValido() {
      mock.paciente.findUnique.mockResolvedValue(paciente);
      mock.medico.findUnique.mockResolvedValue(medico);
      mock.consulta.findFirst.mockResolvedValue(null);
      mock.consulta.create.mockResolvedValue(criarConsulta({ dataHora }));
    }

    it('agenda a consulta quando tudo é válido', async () => {
      prepararCenarioValido();

      const resultado = await service.agendar(dados);

      expect(resultado.status).toBe(StatusConsulta.AGENDADA);
      expect(mock.consulta.create).toHaveBeenCalledWith({
        data: { pacienteId: PACIENTE_ID, medicoId: MEDICO_ID, dataHora },
        include: incluirRelacoes,
      });
    });

    // Regra 2
    it.each([
      ['no passado', daquiA(-1 * MINUTO_MS)],
      ['exatamente agora', daquiA(0)],
    ])('rejeita agendamento %s (400) sem consultar o banco', async (_caso, dataInvalida) => {
      const promessa = service.agendar({ ...dados, dataHora: dataInvalida });

      await expect(promessa).rejects.toBeInstanceOf(AppError);
      await expect(promessa).rejects.toMatchObject({
        statusCode: 400,
        message: 'Não é possível agendar consulta no passado',
      });
      expect(mock.paciente.findUnique).not.toHaveBeenCalled();
      expect(mock.consulta.create).not.toHaveBeenCalled();
    });

    it('lança 404 quando o paciente não existe', async () => {
      prepararCenarioValido();
      mock.paciente.findUnique.mockResolvedValue(null);

      await expect(service.agendar(dados)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Paciente não encontrado(a)',
      });
      expect(mock.consulta.create).not.toHaveBeenCalled();
    });

    it('lança 404 quando o médico não existe', async () => {
      prepararCenarioValido();
      mock.medico.findUnique.mockResolvedValue(null);

      await expect(service.agendar(dados)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Médico não encontrado(a)',
      });
      expect(mock.consulta.create).not.toHaveBeenCalled();
    });

    // Regra 1
    it('busca conflitos só entre consultas AGENDADAS do médico, numa janela de ±30 min', async () => {
      prepararCenarioValido();

      await service.agendar(dados);

      const duracaoMs = DURACAO_CONSULTA_MINUTOS * MINUTO_MS;
      expect(mock.consulta.findFirst).toHaveBeenCalledWith({
        where: {
          medicoId: MEDICO_ID,
          status: StatusConsulta.AGENDADA,
          dataHora: {
            gt: new Date(dataHora.getTime() - duracaoMs),
            lt: new Date(dataHora.getTime() + duracaoMs),
          },
        },
      });
    });

    it('lança ConflictError (409) quando o médico já tem consulta no horário', async () => {
      prepararCenarioValido();
      mock.consulta.findFirst.mockResolvedValue(criarConsulta({ dataHora }));

      const promessa = service.agendar(dados);

      await expect(promessa).rejects.toBeInstanceOf(ConflictError);
      await expect(promessa).rejects.toMatchObject({
        statusCode: 409,
        message: 'Médico já possui consulta agendada nesse horário',
      });
      expect(mock.consulta.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelar', () => {
    it('cancela uma consulta agendada com mais de 24h de antecedência', async () => {
      const consulta = criarConsulta({ dataHora: daquiA(48 * HORA_MS) });
      mock.consulta.findUnique.mockResolvedValue(consulta);
      mock.consulta.update.mockResolvedValue({ ...consulta, status: StatusConsulta.CANCELADA });

      const resultado = await service.cancelar(CONSULTA_ID);

      expect(resultado.status).toBe(StatusConsulta.CANCELADA);
      expect(mock.consulta.update).toHaveBeenCalledWith({
        where: { id: CONSULTA_ID },
        data: { status: StatusConsulta.CANCELADA },
        include: incluirRelacoes,
      });
    });

    // Regra 3: o limite é inclusivo (24h exatas ainda pode cancelar)
    it('permite cancelar com exatamente 24h de antecedência', async () => {
      const consulta = criarConsulta({ dataHora: daquiA(ANTECEDENCIA_CANCELAMENTO_HORAS * HORA_MS) });
      mock.consulta.findUnique.mockResolvedValue(consulta);
      mock.consulta.update.mockResolvedValue({ ...consulta, status: StatusConsulta.CANCELADA });

      await expect(service.cancelar(CONSULTA_ID)).resolves.toBeDefined();
    });

    it('rejeita cancelamento com menos de 24h de antecedência (400)', async () => {
      const consulta = criarConsulta({
        dataHora: daquiA(ANTECEDENCIA_CANCELAMENTO_HORAS * HORA_MS - MINUTO_MS),
      });
      mock.consulta.findUnique.mockResolvedValue(consulta);

      await expect(service.cancelar(CONSULTA_ID)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Cancelamento só é permitido com 24h de antecedência',
      });
      expect(mock.consulta.update).not.toHaveBeenCalled();
    });

    // Regra 4
    it.each([StatusConsulta.CANCELADA, StatusConsulta.CONCLUIDA])(
      'rejeita cancelar consulta com status %s (400)',
      async (status) => {
        mock.consulta.findUnique.mockResolvedValue(criarConsulta({ status }));

        await expect(service.cancelar(CONSULTA_ID)).rejects.toMatchObject({
          statusCode: 400,
          message: `Consulta com status ${status} não pode ser cancelada`,
        });
        expect(mock.consulta.update).not.toHaveBeenCalled();
      },
    );

    it('lança 404 quando a consulta não existe', async () => {
      mock.consulta.findUnique.mockResolvedValue(null);

      await expect(service.cancelar(CONSULTA_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('concluir', () => {
    it('conclui uma consulta agendada cujo horário já passou', async () => {
      const consulta = criarConsulta({ dataHora: daquiA(-1 * HORA_MS) });
      mock.consulta.findUnique.mockResolvedValue(consulta);
      mock.consulta.update.mockResolvedValue({ ...consulta, status: StatusConsulta.CONCLUIDA });

      const resultado = await service.concluir(CONSULTA_ID);

      expect(resultado.status).toBe(StatusConsulta.CONCLUIDA);
      expect(mock.consulta.update).toHaveBeenCalledWith({
        where: { id: CONSULTA_ID },
        data: { status: StatusConsulta.CONCLUIDA },
        include: incluirRelacoes,
      });
    });

    it('permite concluir no exato horário da consulta', async () => {
      const consulta = criarConsulta({ dataHora: daquiA(0) });
      mock.consulta.findUnique.mockResolvedValue(consulta);
      mock.consulta.update.mockResolvedValue({ ...consulta, status: StatusConsulta.CONCLUIDA });

      await expect(service.concluir(CONSULTA_ID)).resolves.toBeDefined();
    });

    // Regra 5
    it('rejeita concluir consulta que ainda não aconteceu (400)', async () => {
      mock.consulta.findUnique.mockResolvedValue(criarConsulta({ dataHora: daquiA(MINUTO_MS) }));

      await expect(service.concluir(CONSULTA_ID)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Não é possível concluir uma consulta que ainda não aconteceu',
      });
      expect(mock.consulta.update).not.toHaveBeenCalled();
    });

    // Regra 4
    it.each([StatusConsulta.CANCELADA, StatusConsulta.CONCLUIDA])(
      'rejeita concluir consulta com status %s (400)',
      async (status) => {
        mock.consulta.findUnique.mockResolvedValue(
          criarConsulta({ status, dataHora: daquiA(-1 * HORA_MS) }),
        );

        await expect(service.concluir(CONSULTA_ID)).rejects.toMatchObject({
          statusCode: 400,
          message: `Consulta com status ${status} não pode ser concluída`,
        });
        expect(mock.consulta.update).not.toHaveBeenCalled();
      },
    );

    it('lança 404 quando a consulta não existe', async () => {
      mock.consulta.findUnique.mockResolvedValue(null);

      await expect(service.concluir(CONSULTA_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
