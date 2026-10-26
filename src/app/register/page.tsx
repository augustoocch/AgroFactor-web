"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AuthShowcase } from "@/components/AuthShowcase";
import { BrandMark } from "@/components/BrandMark";
import type { AuthResponse } from "@/lib/types";

const schema = z.object({
  nombre: z.string().min(2, "Ingresa tu nombre"),
  email: z.string().email("Email invalido"),
  password: z.string().min(8, "Minimo 8 caracteres"),
  perfil: z.enum(["PRODUCTOR", "ASESOR", "ADMINISTRADOR"]),
});

type FormValues = z.infer<typeof schema>;

/**
 * El perfil solo adapta el primer paso: no da acceso a campos ajenos. Antes elegir "Asesor" o
 * "Administrador" abria cualquier establecimiento del sistema; ahora eso lo otorga su titular
 * con una invitacion.
 */
const PERFILES: { value: FormValues["perfil"]; label: string; ejemplo: string }[] = [
  { value: "PRODUCTOR", label: "Productor", ejemplo: "cargo y sigo mi propio establecimiento" },
  { value: "ASESOR", label: "Asesor técnico", ejemplo: "ingeniero agrónomo: sigo campos de mis clientes" },
  { value: "ADMINISTRADOR", label: "Administrador", ejemplo: "gestiono campos que tomo en arriendo" },
];

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { invitacion } = use(searchParams);
  const tokenInvitacion = typeof invitacion === "string" ? invitacion : null;
  const { iniciarSesion } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { perfil: tokenInvitacion ? "ASESOR" : "PRODUCTOR" } });

  const perfilElegido = watch("perfil");

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const auth = await api.post<AuthResponse>("/auth/register", values);
      iniciarSesion(auth);
      router.replace(tokenInvitacion ? `/invitaciones/${tokenInvitacion}` : "/establecimientos");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo crear la cuenta");
    }
  };

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <AuthShowcase />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-center px-6 py-12"
      >
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 lg:hidden">
            <div className="flex items-center gap-2">
              <BrandMark className="h-7 w-7" />
              <span className="font-display text-lg font-medium">AgroFactor</span>
            </div>
          </div>

          <div>
            <h1 className="font-display text-2xl font-medium text-ink-950">Crear cuenta</h1>
            {tokenInvitacion && (
              <p className="mt-1 text-sm text-ink-600">Usá el mismo email al que te llegó la invitación.</p>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-800">Nombre</label>
              <input
                className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none focus:border-brand-500"
                {...register("nombre")}
              />
              {errors.nombre && <p className="mt-1 text-xs text-risk-alto">{errors.nombre.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-800">Email</label>
              <input
                type="email"
                className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none focus:border-brand-500"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-risk-alto">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-800">Contrasena</label>
              <input
                type="password"
                className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none focus:border-brand-500"
                {...register("password")}
              />
              {errors.password && <p className="mt-1 text-xs text-risk-alto">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-800">¿Cómo vas a usar AgroFactor?</label>
              <div className="mt-1.5 space-y-2">
                {PERFILES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                      perfilElegido === r.value
                        ? "border-brand-500 bg-brand-100/50"
                        : "border-paper-300 hover:border-paper-200"
                    }`}
                  >
                    <input type="radio" value={r.value} className="mt-0.5 accent-brand-600" {...register("perfil")} />
                    <span>
                      <span className="block font-medium text-ink-950">{r.label}</span>
                      <span className="block text-xs text-ink-600">{r.ejemplo}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-600">
                Para ver el campo de otra persona necesitás que su titular te invite desde “Datos y acceso”.
              </p>
            </div>

            {error && <p className="text-sm text-risk-alto">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-brand-700 px-4 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              Crear cuenta
            </button>
          </form>

          <p className="text-center text-sm text-ink-600">
            Ya tenes cuenta?{" "}
            <Link href={tokenInvitacion ? `/login?invitacion=${tokenInvitacion}` : "/login"} className="font-medium text-brand-700 underline underline-offset-2">
              Ingresa
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
