import { z } from 'zod';

// Aceita CPF com ou sem máscara e guarda só os dígitos
const cpf = z
  .string()
  .transform((valor) => valor.replace(/\D/g, ''))
  .pipe(z.string().length(11, 'CPF deve ter 11 dígitos'));

export const criarPacienteSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter ao menos 3 caracteres'),
  cpf,
  email: z.email('E-mail inválido'),
  telefone: z.string().trim().min(10, 'Telefone deve ter ao menos 10 dígitos'),
});

export const atualizarPacienteSchema = criarPacienteSchema.partial();

export type CriarPacienteDTO = z.infer<typeof criarPacienteSchema>;
export type AtualizarPacienteDTO = z.infer<typeof atualizarPacienteSchema>;
