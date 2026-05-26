import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Download,
  Flag,
  Plus,
  Trash2,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

const LOCAL_STORAGE_KEY = "elta-weekly-floating-planner-v2";
const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fullDayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const defaultDailyTasks = {
  0: ["Enviar reporte operativo"],
  1: ["Llamar proveedores"],
  2: ["Actualizar indicadores"],
  3: [],
  4: ["Control semanal"],
  5: [],
  6: [],
};

const initialFloatingCards = [
  {
    id: crypto.randomUUID(),
    title: "Prioridades operativas",
    detail: "Alinear objetivos críticos de la semana.",
    startDay: 0,
    endDay: 1,
    type: "hito",
    priority: "alta",
    done: false,
  },
  {
    id: crypto.randomUUID(),
    title: "Seguimiento de pendientes",
    detail: "Revisar bloqueos, responsables y avances.",
    startDay: 2,
    endDay: 4,
    type: "hito",
    priority: "media",
    done: false,
  },
  {
    id: crypto.randomUUID(),
    title: "Cierre semanal",
    detail: "Registrar avances, desvíos y próximos pasos.",
    startDay: 4,
    endDay: 4,
    type: "hito",
    priority: "alta",
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
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function normalizeRange(startDay, endDay) {
  const start = Math.max(0, Math.min(6, Number(startDay)));
  const end = Math.max(0, Math.min(6, Number(endDay)));
  return start <= end ? { startDay: start, endDay: end } : { startDay: end, endDay: start };
}

function getCurrentWeekDayIndex() {
  const today = new Date();
  return today.getDay() === 0 ? 6 : today.getDay() - 1;
}

function getStatusColor(card) {
  const currentDay = getCurrentWeekDayIndex();
  if (card.done) return "from-[#b9d9a6] via-[#cfe7b9] to-[#eaf4d8] border-[#8fbf75]";
  if (card.endDay < currentDay) return "from-[#ff73a6] via-[#ff8fbb] to-[#ffc2d6] border-[#e35c91]";
  if (card.startDay <= currentDay + 1) return "from-[#ffd35a] via-[#ffe083] to-[#fff1bf] border-[#e5b931]";
  return "from-[#bde46c] via-[#d4ef8d] to-[#edf8c9] border-[#9cc85d]";
}

function getPinColor(priority) {
  if (priority === "alta") return "bg-[#e4484f]";
  if (priority === "media") return "bg-[#f3c02f]";
  return "bg-[#65b85b]";
}

function getPrioritySize(priority) {
  if (priority === "alta") return "min-h-[112px] p-3";
  if (priority === "media") return "min-h-[86px] p-2.5";
  return "min-h-[62px] p-2";
}

function getTitleSize(priority) {
  if (priority === "alta") return "text-sm";
  if (priority === "media") return "text-[11px]";
  return "text-[10px]";
}

function getPriorityLaneTop(priority, index) {
  if (priority === "alta") return 12 + (index % 2) * 26;
  if (priority === "media") return 104 + (index % 3) * 34;
  return 210 + (index % 3) * 28;
}

function getFloatingCardWidth(card) {
  const span = Math.max(1, card.endDay - card.startDay + 1);
  if (card.priority === "alta") return Math.min(58, 18 + span * 7);
  if (card.priority === "media") return Math.min(46, 14 + span * 6);
  return Math.min(32, 11 + span * 4);
}

function getFloatingCardLeft(card) {
  const rawLeft = 4 + card.startDay * 12.5;
  const width = getFloatingCardWidth(card);
  return Math.min(rawLeft, 96 - width);
}

function getFloatingCardZIndex(card, isHovered) {
  if (isHovered) return 100;
  if (card.priority === "alta") return 40;
  if (card.priority === "media") return 25;
  return 12;
}

function getDurationDots(card) {
  return Array.from({ length: 7 }, (_, index) => index >= card.startDay && index <= card.endDay);
}

function createLocalSnapshot(floatingCards, dailyTasks, weekStart) {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    floatingCards,
    dailyTasks,
    weekStart: weekStart.toISOString(),
  };
}

function loadLocalSnapshot() {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.floatingCards) || !parsed.dailyTasks || !parsed.weekStart) return null;
    return parsed;
  } catch {
    return null;
  }
}

function runSelfTests() {
  console.assert(getFloatingCardWidth({ startDay: 0, endDay: 4, priority: "alta" }) > getFloatingCardWidth({ startDay: 0, endDay: 0, priority: "alta" }), "width should grow with duration");
  console.assert(getPriorityLaneTop("alta", 0) < getPriorityLaneTop("media", 0), "high priority should float higher");
  console.assert(getFloatingCardZIndex({ priority: "alta" }, false) > getFloatingCardZIndex({ priority: "baja" }, false), "high priority should stack higher");
  console.assert(getDurationDots({ startDay: 1, endDay: 3 }).filter(Boolean).length === 3, "duration dots should match range");
}

runSelfTests();

export default function App() {
  const localSnapshot = loadLocalSnapshot();

  const [weekStart, setWeekStart] = useState(
    localSnapshot ? startOfWeek(new Date(localSnapshot.weekStart)) : startOfWeek(new Date())
  );
  const [floatingCards, setFloatingCards] = useState(localSnapshot?.floatingCards || initialFloatingCards);
  const [dailyTasks, setDailyTasks] = useState(localSnapshot?.dailyTasks || defaultDailyTasks);
  const [hoveredFloatingCardId, setHoveredFloatingCardId] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [selectedTaskDay, setSelectedTaskDay] = useState(0);
  const [form, setForm] = useState({
    title: "",
    detail: "",
    startDay: 0,
    endDay: 0,
    type: "hito",
    priority: "media",
  });
  const boardRef = useRef(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const weekDays = useMemo(
    () => dayNames.map((name, index) => ({ name, fullName: fullDayNames[index], date: addDays(weekStart, index), index })),
    [weekStart]
  );

  const progress = floatingCards.length
    ? Math.round((floatingCards.filter((card) => card.done).length / floatingCards.length) * 100)
    : 0;

  useEffect(() => {
    const snapshot = createLocalSnapshot(floatingCards, dailyTasks, weekStart);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  }, [floatingCards, dailyTasks, weekStart]);

  function addFloatingCard(event) {
    event.preventDefault();
    if (!form.title.trim()) return;

    const range = normalizeRange(form.startDay, form.endDay);

    setFloatingCards((previous) => [
      {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        detail: form.detail.trim(),
        startDay: range.startDay,
        endDay: range.endDay,
        type: form.type,
        priority: form.priority,
        done: false,
      },
      ...previous,
    ]);

    setForm({ title: "", detail: "", startDay: 0, endDay: 0, type: "hito", priority: "media" });
  }

  function toggleFloatingCardDone(id) {
    setFloatingCards((previous) => previous.map((card) => (card.id === id ? { ...card, done: !card.done } : card)));
  }

  function deleteFloatingCard(id) {
    setFloatingCards((previous) => previous.filter((card) => card.id !== id));
  }

  function addDailyTask() {
    if (!taskInput.trim()) return;
    setDailyTasks((previous) => ({
      ...previous,
      [selectedTaskDay]: [...(previous[selectedTaskDay] || []), taskInput.trim()],
    }));
    setTaskInput("");
  }

  function removeDailyTask(dayIndex, taskIndex) {
    setDailyTasks((previous) => ({
      ...previous,
      [dayIndex]: (previous[dayIndex] || []).filter((_, index) => index !== taskIndex),
    }));
  }

  function resetDeviceData() {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    setFloatingCards(initialFloatingCards);
    setDailyTasks(defaultDailyTasks);
    setWeekStart(startOfWeek(new Date()));
  }

  async function exportCalendarToPdf() {
    if (!boardRef.current || isExportingPdf) return;

    setIsExportingPdf(true);

    try {
      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: "#fff4e2",
        scale: 2,
        useCORS: true,
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;
      const imageRatio = canvas.width / canvas.height;
      let imageWidth = availableWidth;
      let imageHeight = imageWidth / imageRatio;

      if (imageHeight > availableHeight) {
        imageHeight = availableHeight;
        imageWidth = imageHeight * imageRatio;
      }

      const x = (pageWidth - imageWidth) / 2;
      const y = (pageHeight - imageHeight) / 2;

      pdf.setFontSize(10);
      pdf.text("ELTA Weekly Planner", margin, 6);
      pdf.addImage(imageData, "PNG", x, y, imageWidth, imageHeight);
      pdf.save("elta-weekly-planner.pdf");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f6ecd9] p-3 text-[#614f3d] md:p-4" style={{ fontFamily: "Comic Sans MS, Nunito, ui-sans-serif, system-ui" }}>
      <div className="mx-auto flex h-full max-w-7xl flex-col">

        <section className="grid min-h-0 flex-1 gap-3 md:grid-cols-[25%_1fr]">
          <Card className="max-h-full overflow-y-auto rounded-[1.5rem] border border-[#ddc8b3] bg-[#fff9f2]/70 p-3 backdrop-blur md:sticky md:top-3 md:self-start">
            <CardContent>
              <div className="mb-4 rounded-3xl border border-[#ddc8b3] bg-[#fff7ea]/90 p-4">
                <div className="text-sm font-semibold text-[#7b6d61]">Guardado local</div>
                <div className="mt-1 text-xs text-[#9b8c7e]">Se guarda automáticamente en este dispositivo.</div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Button type="button" onClick={exportCalendarToPdf} disabled={isExportingPdf} className="w-full rounded-xl bg-[#cfa983] px-4 py-3 font-bold text-[#5f5145] hover:bg-[#bf9470] disabled:opacity-60">
                    <Download className="mr-2 inline h-5 w-5" /> {isExportingPdf ? "Exportando..." : "Exportar PDF"}
                  </Button>
                  <Button type="button" onClick={resetDeviceData} className="w-full rounded-xl bg-[#fff9f2]/90 px-4 py-3 text-[#5f5145] hover:bg-[#f4e4d2]">
                    Reiniciar datos
                  </Button>
                </div>
              </div>

              <h2 className="mb-3 text-base font-bold">Cargar nuevo cartel</h2>
              <form onSubmit={addFloatingCard} className="space-y-4">
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Título"
                  className="w-full rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none"
                />
                <textarea
                  value={form.detail}
                  onChange={(event) => setForm({ ...form, detail: event.target.value })}
                  placeholder="Detalle"
                  className="h-16 w-full rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.startDay} onChange={(event) => setForm({ ...form, startDay: Number(event.target.value) })} className="rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none">
                    {weekDays.map((day) => (
                      <option key={day.index} value={day.index}>{day.fullName}</option>
                    ))}
                  </select>
                  <select value={form.endDay} onChange={(event) => setForm({ ...form, endDay: Number(event.target.value) })} className="rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none">
                    {weekDays.map((day) => (
                      <option key={day.index} value={day.index}>{day.fullName}</option>
                    ))}
                  </select>
                </div>
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="w-full rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none">
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Normal</option>
                </select>
                <Button className="w-full rounded-xl bg-[#cfa983] py-2 text-sm font-bold text-[#5f5145] hover:bg-[#bf9470]">
                  <Plus className="mr-2 inline h-5 w-5" /> Agregar cartel flotante
                </Button>
              </form>

              <div className="mt-4 border-t border-[#ddc8b3] pt-3">
                <h3 className="mb-2 text-sm font-semibold">Tareas diarias rápidas</h3>
                <select value={selectedTaskDay} onChange={(event) => setSelectedTaskDay(Number(event.target.value))} className="mb-3 w-full rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none">
                  {weekDays.map((day) => (
                    <option key={day.index} value={day.index}>{day.fullName}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    value={taskInput}
                    onChange={(event) => setTaskInput(event.target.value)}
                    placeholder="Agregar tarea común"
                    className="w-full rounded-xl border border-[#ddc8b3] bg-[#f7efe5] px-3 py-2 text-sm outline-none"
                  />
                  <Button type="button" onClick={addDailyTask} className="rounded-xl bg-[#cfa983] px-4 py-3 font-bold text-[#5f5145]">
                    <Plus className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="min-h-0 min-w-0 overflow-x-auto rounded-[2rem] pb-1">
            <div ref={boardRef} className="relative h-full min-h-[calc(100vh-32px)] min-w-[980px] overflow-hidden rounded-[2rem] border border-[#ead8c0] bg-[#fff4e2] p-4 shadow-lg md:min-w-full">
              <div className="absolute inset-x-6 bottom-[150px] h-px bg-[#d9c4ad]" />

              <div className="absolute inset-x-6 bottom-7 z-40 flex h-[135px] items-end justify-between gap-2">
                {weekDays.map((day) => {
                  const dayCards = floatingCards.filter((card) => card.startDay <= day.index && card.endDay >= day.index);
                  const completed = dayCards.filter((card) => card.done).length;
                  return (
                    <div key={day.index} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                      <div className="h-14 w-px bg-gradient-to-t from-[#cfa983] to-transparent" />
                      <div className="w-full rounded-2xl border border-[#ead8c0] bg-[#fff7ea]/90 px-2 py-2 shadow-md">
                        <div className="text-base font-semibold text-[#5f5145]">{day.name}</div>
                        <div className="text-xs text-[#9b8c7e]">{formatDate(day.date)}</div>
                        <div className="mt-2 rounded-full bg-[#fff9f2]/80 px-2 py-1 text-[10px] font-bold text-[#8b6f54]">
                          {completed}/{dayCards.length} hitos
                        </div>
                        <div className="mt-3 space-y-1 text-left">
                          {(dailyTasks[day.index] || []).map((task, taskIndex) => (
                            <div key={day.index + "-" + taskIndex} className="group flex items-center justify-between rounded-xl bg-[#efe0cd]/70 px-2 py-1 text-[10px] text-[#7b6d61]">
                              <span className="truncate">• {task}</span>
                              <button type="button" onClick={() => removeDailyTask(day.index, taskIndex)} className="opacity-0 transition group-hover:opacity-100">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative z-10 h-[calc(100vh-160px)] overflow-visible">
                <AnimatePresence>
                  {floatingCards.map((card, index) => {
                    const isHovered = hoveredFloatingCardId === card.id;
                    const cardClassName = [
                      "relative overflow-hidden rounded-md border bg-gradient-to-br shadow-xl transition-all duration-300 hover:shadow-2xl",
                      getStatusColor(card),
                      getPrioritySize(card.priority),
                    ].join(" ");
                    const titleClassName =
                      "mt-1 max-w-full overflow-hidden break-words font-semibold leading-[1.05] text-[#31261d] " +
                      getTitleSize(card.priority);

                    return (
                      <motion.div
                        key={card.id}
                        layout
                        initial={{ opacity: 0, y: 24, rotate: -2 }}
                        animate={{ opacity: 1, y: 0, rotate: index % 2 === 0 ? -1.5 : 1.5 }}
                        whileHover={{ y: -12, rotate: 0, scale: 1.06 }}
                        onMouseEnter={() => setHoveredFloatingCardId(card.id)}
                        onMouseLeave={() => setHoveredFloatingCardId(null)}
                        onClick={() => setHoveredFloatingCardId(card.id)}
                        style={{
                          position: "absolute",
                          left: getFloatingCardLeft(card) + "%",
                          top: getPriorityLaneTop(card.priority, index) + "px",
                          width: getFloatingCardWidth(card) + "%",
                          zIndex: getFloatingCardZIndex(card, isHovered),
                          transformOrigin: "center top",
                          touchAction: "manipulation",
                        }}
                        className={cardClassName}
                      >
                        <div className="absolute left-1/2 top-[-18px] z-20 -translate-x-1/2">
                          <div className={"h-8 w-8 rounded-full border-2 border-white/70 shadow-md " + getPinColor(card.priority)}>
                            <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-white/55" />
                          </div>
                        </div>

                        <div className="flex items-start justify-between text-[#5b4636]">
                          <button type="button" onClick={() => toggleFloatingCardDone(card.id)} className="rounded-full bg-[#fff8ef]/75 p-1.5">
                            {card.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          </button>
                          <button type="button" onClick={() => deleteFloatingCard(card.id)} className="rounded-full bg-[#fff8ef]/75 p-1.5">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/45 px-1.5 py-0 text-[7px] font-semibold uppercase tracking-wide text-[#6b513e]">
                          <Flag className="h-3 w-3" /> {card.priority === "baja" ? "normal" : card.priority}
                        </div>

                        <h3 className={titleClassName}>
                          <span className="block line-clamp-2 overflow-hidden break-words">
                            {card.title}
                          </span>
                        </h3>
                        {card.detail ? (
                          <p className="mt-0.5 line-clamp-2 overflow-hidden break-words text-[8px] leading-[1.1] text-[#5e4939]">
                            {card.detail}
                          </p>
                        ) : null}

                        <div className="mt-1.5 border-t border-[#7b5c3a]/20 pt-1">
                          <div className="mb-1 flex items-center justify-between text-[7px] font-semibold uppercase tracking-wide text-[#7b5c3a]/70">
                            <span>Duración visual</span>
                            <span>{dayNames[card.startDay]} → {dayNames[card.endDay]}</span>
                          </div>
                          <div className="flex gap-1">
                            {getDurationDots(card).map((isActive, dotIndex) => {
                              const dotClassName = "h-1.5 flex-1 rounded-full " + (isActive ? "bg-[#7b5c3a]/65" : "bg-white/45");
                              return <div key={dotIndex} className={dotClassName} />;
                            })}
                          </div>
                        </div>
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