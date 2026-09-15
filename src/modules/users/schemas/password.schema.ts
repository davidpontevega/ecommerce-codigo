import { z } from "zod";

/**
 * Solo del formulario: la contraseña la recibe Clerk desde el navegador
 * (`user.updatePassword`) y nunca viaja a nuestra API.
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(1, "Repite la contraseña nueva"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
