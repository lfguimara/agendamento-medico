import { z } from 'zod';

export const criarMedicoSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres'),
  crm: z.string().trim().toUpperCase().min(4, 'CRM inválido'),
  especialidade: z.string().trim().min(3, 'Especialidade deve ter ao menos 3 caracteres'),
});

export const atualizarMedicoSchema = criarMedicoSchema.partial();

export const listarMedicosQuerySchema = z.object({
  especialidade: z.string().trim().optional(),
});

export type CriarMedicoDTO = z.infer<typeof criarMedicoSchema>;
export type AtualizarMedicoDTO = z.infer<typeof atualizarMedicoSchema>;
export type ListarMedicosFiltros = z.infer<typeof listarMedicosQuerySchema>;
