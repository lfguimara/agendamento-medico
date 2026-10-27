import { randomUUID } from 'node:crypto';
import { StatusConsulta } from '../../generated/prisma/enums';
import { prisma } from '../../lib/prisma';

// Consultas primeiro: elas têm chave estrangeira para pacientes e médicos
export async function limparBanco() {
  await prisma.consulta.deleteMany();
  await prisma.paciente.deleteMany();
  await prisma.medico.deleteMany();
}

// Gera sequências únicas para CPF, e-mail e CRM não colidirem entre registros
let contador = 0;
const proximo = () => String(++contador).padStart(4, '0');

export function dadosPaciente(sobrescrever: Partial<Record<'nome' | 'cpf' | 'email' | 'telefone', string>> = {}) {
  const n = proximo();
  return {
    nome: `Paciente ${n}`,
    cpf: `1234567${n}`,
    email: `paciente${n}@email.com`,
    telefone: '11999990000',
    ...sobrescrever,
  };
}

export function dadosMedico(sobrescrever: Partial<Record<'nome' | 'crm' | 'especialidade', string>> = {}) {
  const n = proximo();
  return {
    nome: `Dr. Médico ${n}`,
    crm: `CRM-SP ${n}`,
    especialidade: 'Cardiologia',
    ...sobrescrever,
  };
}

export const criarPaciente = (dados = dadosPaciente()) => prisma.paciente.create({ data: dados });
export const criarMedico = (dados = dadosMedico()) => prisma.medico.create({ data: dados });

// Insere direto no banco, sem passar pelas regras da API.
// Útil para montar cenários que a API não permite criar (ex.: consulta no passado).
export function criarConsultaNoBanco(dados: {
  pacienteId: string;
  medicoId: string;
  dataHora: Date;
  status?: StatusConsulta;
}) {
  return prisma.consulta.create({ data: { status: StatusConsulta.AGENDADA, ...dados } });
}

const HORA_MS = 60 * 60 * 1000;
export const MINUTO_MS = 60 * 1000;

// Datas relativas ao momento real (a API usa o relógio do sistema).
// Arredonda para o minuto cheio para facilitar as contas dos testes.
export function daquiAHoras(horas: number) {
  const data = new Date(Date.now() + horas * HORA_MS);
  data.setSeconds(0, 0);
  return data;
}

export const idInexistente = () => randomUUID();
