"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BrandMark } from "@/components/BrandMark";
import { AuthShowcase } from "@/components/AuthShowcase";
import type { AuthResponse } from "@/lib/types";

const schema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Ingresa tu contrasena"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { iniciarSesion } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const auth = await api.post<AuthResponse>("/auth/login", values);
      iniciarSesion(auth);
      router.replace("/establecimientos");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo iniciar sesion");
    }
  };

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <AuthShowcase />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-center px-6 py-16"
      >
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1 lg:hidden">
            <div className="flex items-center gap-2">
              <BrandMark className="h-7 w-7" />
              <span className="font-display text-lg font-medium">AgroFactor</span>
            </div>
          </div>

          <div>
            <h1 className="font-display text-2xl font-medium text-ink-950">Iniciar sesion</h1>
            <p className="mt-1 text-sm text-ink-600">Accede con tu email y contrasena.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-800">Email</label>
              <input
                type="email"
                className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors focus:border-brand-500"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-risk-alto">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-800">Contrasena</label>
              <input
                type="password"
                className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm text-ink-950 outline-none transition-colors focus:border-brand-500"
                {...register("password")}
              />
              {errors.password && <p className="mt-1 text-xs text-risk-alto">{errors.password.message}</p>}
            </div>

            {error && <p className="text-sm text-risk-alto">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-brand-700 px-4 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              Ingresar
            </button>
          </form>

          <p className="text-center text-sm text-ink-600">
            No tenes cuenta?{" "}
            <Link href="/register" className="font-medium text-brand-700 underline underline-offset-2">
              Registrate
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
