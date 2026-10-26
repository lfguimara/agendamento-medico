import { z } from 'zod';
import { StatusConsulta } from '../../generated/prisma/enums';

// Data/hora em ISO 8601, ex.: 2026-11-10T14:30:00-03:00
const dataHora = z.iso
  .datetime({ offset: true, message: 'Data/hora deve estar no formato ISO 8601' })
  .transform((valor) => new Date(valor));

export const agendarConsultaSchema = z.object({
  pacienteId: z.uuid('pacienteId inválido'),
  medicoId: z.uuid('medicoId inválido'),
  dataHora,
});

export const listarConsultasQuerySchema = z.object({
  pacienteId: z.uuid().optional(),
  medicoId: z.uuid().optional(),
  status: z.enum(StatusConsulta).optional(),
});

export type AgendarConsultaDTO = z.infer<typeof agendarConsultaSchema>;
export type ListarConsultasFiltros = z.infer<typeof listarConsultasQuerySchema>;
