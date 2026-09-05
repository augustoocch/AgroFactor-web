"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { revealVariants } from "@/lib/motion";
import { PartidoCombobox } from "@/components/PartidoCombobox";
import type { Establecimiento } from "@/lib/types";

const schema = z.object({
  nombre: z.string().min(2),
  partido: z.string().min(2),
  provincia: z.string().min(2),
  tipoTenencia: z.enum(["PROPIO", "ARRENDADO", "MIXTO"]),
  perfilProductivo: z.enum(["AGRICOLA", "GANADERO", "TAMBO", "MIXTO"]),
});

type FormValues = z.infer<typeof schema>;

const PERFILES: { value: FormValues["perfilProductivo"]; label: string }[] = [
  { value: "AGRICOLA", label: "Agricola" },
  { value: "GANADERO", label: "Ganadero" },
  { value: "TAMBO", label: "Tambo" },
  { value: "MIXTO", label: "Mixto" },
];

export default function NuevoEstablecimientoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipoTenencia: "PROPIO", perfilProductivo: "MIXTO", partido: "", provincia: "" },
  });

  const perfilElegido = watch("perfilProductivo");
  const partidoElegido = watch("partido");

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const establecimiento = await api.post<Establecimiento>("/establecimientos", values);
      router.push(`/establecimientos/${establecimiento.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo crear el establecimiento");
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={revealVariants} className="mx-auto max-w-lg space-y-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-brand-600">Alta</p>
        <h1 className="font-display text-2xl font-medium text-ink-950">Nuevo establecimiento</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-2xl border border-paper-300 bg-paper-50 p-6">
        <div>
          <label className="block text-sm font-medium text-ink-800">Nombre</label>
          <input
            className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
            {...register("nombre")}
          />
          {errors.nombre && <p className="mt-1 text-xs text-risk-alto">{errors.nombre.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-800">Partido</label>
            <div className="mt-1.5">
              <PartidoCombobox
                valorPartido={partidoElegido}
                onCambiarPartido={(v) => setValue("partido", v, { shouldValidate: true })}
                onSeleccionarProvincia={(v) => setValue("provincia", v, { shouldValidate: true })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-800">Provincia</label>
            <input
              className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
              {...register("provincia")}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-800">Tenencia</label>
          <select
            className="mt-1.5 w-full rounded-lg border border-paper-300 bg-paper-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500"
            {...register("tipoTenencia")}
          >
            <option value="PROPIO">Propio</option>
            <option value="ARRENDADO">Arrendado</option>
            <option value="MIXTO">Mixto</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-800">Perfil productivo</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {PERFILES.map((p) => (
              <label
                key={p.value}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
                  perfilElegido === p.value
                    ? "border-brand-500 bg-brand-100/50 font-medium text-brand-700"
                    : "border-paper-300 text-ink-700 hover:border-paper-200"
                }`}
              >
                <input type="radio" value={p.value} className="sr-only" {...register("perfilProductivo")} />
                {p.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-600">
            Determina los pesos por defecto del plan de accion: los asesores relevados indicaron que la
            prioridad de activos cambia segun este perfil.
          </p>
        </div>

        {error && <p className="text-sm text-risk-alto">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-brand-700 px-4 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          Crear
        </button>
      </form>
    </motion.div>
  );
}
