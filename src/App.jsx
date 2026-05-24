import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

function Card({ className = "", children }) {
  return <div className={className}>{children}</div>;
}

function CardContent({ className = "", children }) {
  return <div className={className}>{children}</div>;
}

function Button({ className = "", children, ...props }) {
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
}

const LOCAL_STORAGE_KEY = "elta-weekly-floating-planner-v1";

const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fullDayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const initialFloatingCards = [
  {
    id: crypto.randomUUID(),
    title: "Definir prioridades operativas",
    detail: "Alinear objetivos de la semana con el equipo.",
    startDay: 0,
    endDay: 1,
    type: "hito",
    priority: "alta",
    done: false,
  },
  {
    id: crypto.randomUUID(),
    title: "Seguimiento de pendientes críticos",
    detail: "Revisar bloqueos y responsables.",
    startDay: 2,
    endDay: 3,
    type: "hito",
    priority: "media",
    done: false,
  },
];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function formatDate(date) {
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

function getCurrentWeekDayIndex() {
  const today = new Date();
  return today.getDay() === 0 ? 6 : today.getDay() - 1;
}

function getStatusColor(floatingCard) {
  const currentDay = getCurrentWeekDayIndex();

  if (floatingCard.done) {
    return "from-[#b9d9a6] via-[#cfe7b9] to-[#eaf4d8] border-[#8fbf75]";
  }

  if (floatingCard.endDay < currentDay) {
    return "from-[#ff73a6] via-[#ff8fbb] to-[#ffc2d6] border-[#e35c91]";
  }

  if (floatingCard.startDay <= currentDay + 1) {
    return "from-[#ffd35a] via-[#ffe083] to-[#fff1bf] border-[#e5b931]";
  }

  return "from-[#bde46c] via-[#d4ef8d] to-[#edf8c9] border-[#9cc85d]";
}

function getPinColor(priority) {
  if (priority === "alta") return "bg-[#e4484f]";
  if (priority === "media") return "bg-[#f3c02f]";
  return "bg-[#65b85b]";
}

function prioritySize(priority) {
  if (priority === "alta") return "min-h-[280px]";
  if (priority === "media") return "min-h-[220px]";
  return "min-h-[160px]";
}

function titleSize(priority) {
  if (priority === "alta") return "text-4xl";
  if (priority === "media") return "text-2xl";
  return "text-xl";
}

function createLocalSnapshot(floatingCards, dailyTasks, weekStart) {
  return {
    floatingCards,
    dailyTasks,
    weekStart: weekStart.toISOString(),
  };
}

function loadLocalSnapshot() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function App() {
  const localSnapshot = loadLocalSnapshot();

  const [weekStart, setWeekStart] = useState(
    localSnapshot
      ? startOfWeek(new Date(localSnapshot.weekStart))
      : startOfWeek(new Date())
  );

  const [floatingCards, setFloatingCards] = useState(
    localSnapshot?.floatingCards || initialFloatingCards
  );

  const [hoveredFloatingCardId, setHoveredFloatingCardId] = useState(null);

  const [dailyTasks, setDailyTasks] = useState(
    localSnapshot?.dailyTasks || {
      0: ["Enviar reporte operativo"],
      1: ["Llamar proveedores"],
      2: ["Actualizar indicadores"],
      3: [],
      4: ["Control semanal"],
      5: [],
      6: [],
    }
  );

  const [form, setForm] = useState({
    title: "",
    detail: "",
    startDay: 0,
    endDay: 0,
    type: "hito",
    priority: "media",
  });

  const weekDays = useMemo(
    () =>
      dayNames.map((name, index) => ({
        name,
        fullName: fullDayNames[index],
        date: addDays(weekStart, index),
        index,
      })),
    [weekStart]
  );

  useEffect(() => {
    const snapshot = createLocalSnapshot(
      floatingCards,
      dailyTasks,
      weekStart
    );

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  }, [floatingCards, dailyTasks, weekStart]);

  function addFloatingCard(event) {
    event.preventDefault();

    if (!form.title.trim()) return;

    setFloatingCards((previous) => [
      {
        id: crypto.randomUUID(),
        title: form.title,
        detail: form.detail,
        startDay: Number(form.startDay),
        endDay: Number(form.endDay),
        type: form.type,
        priority: form.priority,
        done: false,
      },
      ...previous,
    ]);

    setForm({
      title: "",
      detail: "",
      startDay: 0,
      endDay: 0,
      type: "hito",
      priority: "media",
    });
  }

  function toggleFloatingCardDone(id) {
    setFloatingCards((previous) =>
      previous.map((card) =>
        card.id === id ? { ...card, done: !card.done } : card
      )
    );
  }

  return (
    <div
      className="min-h-screen bg-[#f6ecd9] p-4 text-[#614f3d] md:p-8"
      style={{
        fontFamily: "Comic Sans MS, Nunito, ui-sans-serif, system-ui",
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2.5rem] border border-[#e8d6bf] bg-gradient-to-br from-[#fff5e5] via-[#f8ead4] to-[#ecd8bc] p-6 shadow-lg"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#fff9f2]/70 px-3 py-1 text-sm text-[#8b6f54]">
                <CalendarDays className="h-4 w-4" />
                Portada semanal dinámica
              </div>

              <h1 className="text-5xl font-semibold">
                Carteles flotantes de la semana
              </h1>
            </div>
          </div>
        </motion.header>

        <section className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <Card className="rounded-[2rem] border border-[#ddc8b3] bg-[#fff9f2]/70 p-4 backdrop-blur">
            <CardContent>
              <h2 className="mb-4 text-xl font-bold">
                Cargar nuevo cartel
              </h2>

              <form onSubmit={addFloatingCard} className="space-y-4">
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="Título"
                  className="w-full rounded-2xl border border-[#ddc8b3] bg-[#f7efe5] px-4 py-3"
                />

                <textarea
                  value={form.detail}
                  onChange={(event) =>
                    setForm({ ...form, detail: event.target.value })
                  }
                  placeholder="Detalle"
                  className="h-24 w-full rounded-2xl border border-[#ddc8b3] bg-[#f7efe5] px-4 py-3"
                />

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={form.startDay}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        startDay: Number(event.target.value),
                      })
                    }
                    className="rounded-2xl border border-[#ddc8b3] bg-[#f7efe5] px-4 py-3"
                  >
                    {weekDays.map((day) => (
                      <option key={day.index} value={day.index}>
                        {day.fullName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={form.endDay}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        endDay: Number(event.target.value),
                      })
                    }
                    className="rounded-2xl border border-[#ddc8b3] bg-[#f7efe5] px-4 py-3"
                  >
                    {weekDays.map((day) => (
                      <option key={day.index} value={day.index}>
                        {day.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm({ ...form, priority: event.target.value })
                  }
                  className="w-full rounded-2xl border border-[#ddc8b3] bg-[#f7efe5] px-4 py-3"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Normal</option>
                </select>

                <Button className="w-full rounded-2xl bg-[#cfa983] py-4 font-bold text-[#5f5145]">
                  <Plus className="mr-2 inline h-5 w-5" />
                  Agregar cartel flotante
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="overflow-x-auto rounded-[2.5rem] pb-2">
            <div className="relative min-h-[680px] min-w-[980px] overflow-hidden rounded-[2.5rem] border border-[#ead8c0] bg-[#fff4e2] p-5 shadow-lg">
              <div className="absolute inset-x-6 bottom-[205px] h-px bg-[#d9c4ad]" />

              <div className="absolute inset-x-6 bottom-7 z-40 flex h-[185px] items-end justify-between gap-2">
                {weekDays.map((day) => (
                  <div
                    key={day.index}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
                  >
                    <div className="h-24 w-px bg-gradient-to-t from-[#cfa983] to-transparent" />

                    <div className="w-full rounded-3xl border border-[#ead8c0] bg-[#fff7ea]/90 px-2 py-3 shadow-md">
                      <div className="text-xl font-semibold text-[#5f5145]">
                        {day.name}
                      </div>

                      <div className="text-xs text-[#9b8c7e]">
                        {formatDate(day.date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="relative z-10 h-[430px] overflow-visible">
                <AnimatePresence>
                  {floatingCards.map((floatingCard, index) => {
                    const isHovered =
                      hoveredFloatingCardId === floatingCard.id;

                    return (
                      <motion.div
                        key={floatingCard.id}
                        layout
                        initial={{ opacity: 0, y: 24, rotate: -2 }}
                        animate={{
                          opacity: 1,
                          y: 0,
                          rotate: index % 2 === 0 ? -1.5 : 1.5,
                        }}
                        whileHover={{ y: -14, rotate: 0, scale: 1.04 }}
                        onMouseEnter={() =>
                          setHoveredFloatingCardId(floatingCard.id)
                        }
                        onMouseLeave={() => setHoveredFloatingCardId(null)}
                        onClick={() =>
                          setHoveredFloatingCardId(floatingCard.id)
                        }
                        style={{
                          position: "absolute",
                          left: `${5 + floatingCard.startDay * 12.5}%`,
                          top: `${24 + (index % 4) * 52}px`,
                          width: `${20 + (floatingCard.endDay - floatingCard.startDay + 1) * 14}%`,
                          zIndex: isHovered ? 100 : 20,
                        }}
                        className={`relative overflow-visible rounded-md border bg-gradient-to-br p-5 shadow-xl transition-all ${getStatusColor(
                          floatingCard
                        )} ${prioritySize(floatingCard.priority)}`}
                      >
                        <div className="absolute left-1/2 top-[-18px] z-20 -translate-x-1/2">
                          <div
                            className={`h-8 w-8 rounded-full border-2 border-white/70 shadow-md ${getPinColor(
                              floatingCard.priority
                            )}`}
                          />
                        </div>

                        <div className="flex items-start justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              toggleFloatingCardDone(floatingCard.id)
                            }
                          >
                            {floatingCard.done ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </button>
                        </div>

                        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/45 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#6b513e]">
                          <Flag className="h-4 w-4" />
                          {floatingCard.priority}
                        </div>

                        <h3
                          className={`mt-3 ${titleSize(
                            floatingCard.priority
                          )} font-semibold leading-tight text-[#31261d]`}
                        >
                          {floatingCard.title}
                        </h3>

                        <p className="mt-3 text-sm font-medium leading-relaxed text-[#5e4939]">
                          {floatingCard.detail}
                        </p>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
