import type { PrismaClient } from '../../generated/prisma/client';
import { StatusConsulta } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';
import { AppError, ConflictError, NotFoundError } from '../../shared/errors/AppError';
import type { AgendarConsultaDTO, ListarConsultasFiltros } from './consulta.schema';

export const DURACAO_CONSULTA_MINUTOS = 30;
export const ANTECEDENCIA_CANCELAMENTO_HORAS = 24;

const MINUTO_MS = 60 * 1000;
const HORA_MS = 60 * MINUTO_MS;

const incluirRelacoes = {
  paciente: { select: { id: true, nome: true } },
  medico: { select: { id: true, nome: true, especialidade: true } },
} as const;

// `agora` é injetável para que os testes controlem a data atual (regras de passado e 24h)
export class ConsultaService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  listar(filtros: ListarConsultasFiltros = {}) {
    return this.db.consulta.findMany({
      where: filtros,
      include: incluirRelacoes,
      orderBy: { dataHora: 'asc' },
    });
  }

  async buscarPorId(id: string) {
    const consulta = await this.db.consulta.findUnique({ where: { id }, include: incluirRelacoes });
    if (!consulta) throw new NotFoundError('Consulta');
    return consulta;
  }

  async agendar({ pacienteId, medicoId, dataHora }: AgendarConsultaDTO) {
    // Regra 2: não agendar no passado
    if (dataHora.getTime() <= this.agora().getTime()) {
      throw new AppError('Não é possível agendar consulta no passado');
    }

    const [paciente, medico] = await Promise.all([
      this.db.paciente.findUnique({ where: { id: pacienteId } }),
      this.db.medico.findUnique({ where: { id: medicoId } }),
    ]);
    if (!paciente) throw new NotFoundError('Paciente');
    if (!medico) throw new NotFoundError('Médico');

    // Regra 1: médico não pode ter duas consultas no mesmo horário.
    // Duas consultas conflitam se começam a menos de DURACAO_CONSULTA_MINUTOS uma da outra.
    const duracaoMs = DURACAO_CONSULTA_MINUTOS * MINUTO_MS;
    const conflito = await this.db.consulta.findFirst({
      where: {
        medicoId,
        status: StatusConsulta.AGENDADA,
        dataHora: {
          gt: new Date(dataHora.getTime() - duracaoMs),
          lt: new Date(dataHora.getTime() + duracaoMs),
        },
      },
    });
    if (conflito) {
      throw new ConflictError('Médico já possui consulta agendada nesse horário');
    }

    return this.db.consulta.create({
      data: { pacienteId, medicoId, dataHora },
      include: incluirRelacoes,
    });
  }

  async cancelar(id: string) {
    const consulta = await this.buscarPorId(id);

    if (consulta.status !== StatusConsulta.AGENDADA) {
      throw new AppError(`Consulta com status ${consulta.status} não pode ser cancelada`);
    }

    // Regra 3: cancelamento só com até 24h de antecedência
    const antecedenciaMs = consulta.dataHora.getTime() - this.agora().getTime();
    if (antecedenciaMs < ANTECEDENCIA_CANCELAMENTO_HORAS * HORA_MS) {
      throw new AppError(
        `Cancelamento só é permitido com ${ANTECEDENCIA_CANCELAMENTO_HORAS}h de antecedência`,
      );
    }

    return this.db.consulta.update({
      where: { id },
      data: { status: StatusConsulta.CANCELADA },
      include: incluirRelacoes,
    });
  }

  async concluir(id: string) {
    const consulta = await this.buscarPorId(id);

    if (consulta.status !== StatusConsulta.AGENDADA) {
      throw new AppError(`Consulta com status ${consulta.status} não pode ser concluída`);
    }
    if (consulta.dataHora.getTime() > this.agora().getTime()) {
      throw new AppError('Não é possível concluir uma consulta que ainda não aconteceu');
    }

    return this.db.consulta.update({
      where: { id },
      data: { status: StatusConsulta.CONCLUIDA },
      include: incluirRelacoes,
    });
  }
}
