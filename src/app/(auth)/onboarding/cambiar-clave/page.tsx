import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/modules/users/components/change-password-form";

export const metadata: Metadata = {
  title: "Cambia tu contraseña",
  description: "Primer acceso: define tu contraseña definitiva.",
};

export default function ChangePasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Cambia tu contraseña</CardTitle>
        <CardDescription>
          Tu cuenta se creó con una contraseña temporal que alguien más conoce.
          Elige una nueva para continuar; se cerrarán tus otras sesiones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm />
      </CardContent>
    </Card>
  );
}
