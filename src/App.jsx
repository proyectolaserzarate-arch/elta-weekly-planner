import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  Flag,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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

const LOCAL_STORAGE_KEY = "elta-weekly-floating-planner-v7";
const APP_VERSION = "1.0.0-conexiones";
const SNAP_STRENGTH = 0.72;
const MIN_BOARD_ZOOM = 0.65;
const MAX_BOARD_ZOOM = 1.45;
const BOARD_ZOOM_STEP = 0.1;
const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const fullDayNames = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function createTask(text, done = false) {
  return {
    id: crypto.randomUUID(),
    text,
    done,
  };
}

const defaultDailyTasks = {
  0: [createTask("Enviar reporte operativo")],
  1: [createTask("Llamar proveedores")],
  2: [createTask("Actualizar indicadores")],
  3: [],
  4: [createTask("Control semanal")],
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

function normalizeDailyTasks(tasks) {
  const normalized = { ...defaultDailyTasks };

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const rawTasks = tasks?.[dayIndex] || [];

    normalized[dayIndex] = rawTasks.map((task) => {
      if (typeof task === "string") {
        return createTask(task);
      }

      return {
        id: task.id || crypto.randomUUID(),
        text: task.text || task.title || "Tarea sin nombre",
        done: Boolean(task.done),
      };
    });
  }

  return normalized;
}

function getCurrentWeekDayIndex() {
  const today = new Date();
  return today.getDay() === 0 ? 6 : today.getDay() - 1;
}

function getStatusColor(card) {
  if (card.priority === "alta") {
    return "bg-[#f48b8b] border-[#d94f4f]";
  }

  if (card.priority === "media") {
    return "bg-[#ffe08a] border-[#e5b931]";
  }

  return "bg-[#e9d7bd] border-[#c6a982]";
}

function getPinColor(priority) {
  if (priority === "alta") return "bg-[#c93333] shadow-[0_5px_10px_rgba(180,40,50,0.35)]";
  if (priority === "media") return "bg-[#f3c02f] shadow-[0_5px_10px_rgba(180,130,20,0.3)]";
  return "bg-[#b18a61] shadow-[0_5px_10px_rgba(120,80,40,0.28)]";
}

function getPrioritySize(priority) {
  if (priority === "alta") return "min-h-[170px] max-h-[210px]";
  if (priority === "media") return "min-h-[125px] max-h-[160px]";
  return "min-h-[88px] max-h-[115px]";
}

function getTitleSize(priority) {
  if (priority === "alta") return "text-sm md:text-base";
  if (priority === "media") return "text-xs md:text-sm";
  return "text-[10px] md:text-xs";
}

function getPriorityLaneTop(priority, index) {
  if (priority === "alta") return 18 + (index % 2) * 38;
  if (priority === "media") return 132 + (index % 2) * 36;
  return 235 + (index % 2) * 30;
}

function getFloatingCardWidth(card) {
  const span = Math.max(1, card.endDay - card.startDay + 1);
  if (card.priority === "alta") return Math.min(44, 18 + span * 6);
  if (card.priority === "media") return Math.min(36, 15 + span * 5);
  return Math.min(28, 12 + span * 4);
}

function getFloatingCardLeft(card) {
  const rawLeft = 5 + card.startDay * 13;
  const width = getFloatingCardWidth(card);
  return Math.min(rawLeft, 96 - width);
}

function getFloatingCardCenter(card, index) {
  const left = getFloatingCardLeft(card);
  const width = getFloatingCardWidth(card);
  const top = getPriorityLaneTop(card.priority, index);
  const offset = getFloatingCardOffset(card);

  return {
    x: ((left + width / 2) / 100) * 980 + offset.x,
    y: top + offset.y + 70,
  };
}

function shouldConnectCards(sourceCard, targetCard) {
  if (sourceCard.id === targetCard.id) return false;

  const sourceEndsBeforeTarget = sourceCard.endDay <= targetCard.startDay;
  const closeInTime = targetCard.startDay - sourceCard.endDay <= 1;

  return sourceEndsBeforeTarget && closeInTime;
}

function getCardConnections(cards) {
  const connections = [];

  cards.forEach((sourceCard, sourceIndex) => {
    cards.forEach((targetCard, targetIndex) => {
      if (!shouldConnectCards(sourceCard, targetCard)) return;

      connections.push({
        id: `${sourceCard.id}-${targetCard.id}`,
        sourceCard,
        targetCard,
        sourceIndex,
        targetIndex,
      });
    });
  });

  return connections.slice(0, 8);
}

function getFloatingCardZIndex(card, isHovered) {
  if (isHovered) return 300;
  if (card.priority === "alta") return 42;
  if (card.priority === "media") return 24;
  return 10;
}

function getDurationDots(card) {
  return Array.from({ length: 7 }, (_, index) => index >= card.startDay && index <= card.endDay);
}

function getFloatingCardOffset(card) {
  return {
    x: Number(card.offsetX || 0),
    y: Number(card.offsetY || 0),
  };
}

function clampFloatingCardOffset(offsetX, offsetY) {
  return {
    x: Math.max(-120, Math.min(120, offsetX)),
    y: Math.max(-80, Math.min(120, offsetY)),
  };
}

function getSnapGridSize(priority) {
  if (priority === "alta") return { x: 36, y: 28 };
  if (priority === "media") return { x: 30, y: 24 };
  return { x: 24, y: 20 };
}

function getPrioritySnapBias(priority) {
  if (priority === "alta") return -10;
  if (priority === "media") return 0;
  return 10;
}

function snapFloatingCardOffset(card, rawOffsetX, rawOffsetY) {
  const grid = getSnapGridSize(card.priority);
  const priorityBias = getPrioritySnapBias(card.priority);
  const snappedX = Math.round(rawOffsetX / grid.x) * grid.x;
  const snappedY = Math.round((rawOffsetY + priorityBias) / grid.y) * grid.y - priorityBias;

  return clampFloatingCardOffset(
    rawOffsetX + (snappedX - rawOffsetX) * SNAP_STRENGTH,
    rawOffsetY + (snappedY - rawOffsetY) * SNAP_STRENGTH
  );
}

function clampBoardZoom(value) {
  return Math.max(MIN_BOARD_ZOOM, Math.min(MAX_BOARD_ZOOM, Number(value) || 1));
}

function createLocalSnapshot(floatingCards, dailyTasks, weekStart, boardZoom) {
  return {
    version: 7,
    updatedAt: new Date().toISOString(),
    floatingCards,
    dailyTasks,
    weekStart: weekStart.toISOString(),
    boardZoom,
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
  console.assert(
    getFloatingCardWidth({ startDay: 0, endDay: 4, priority: "alta" }) > getFloatingCardWidth({ startDay: 0, endDay: 0, priority: "alta" }),
    "width should grow with duration"
  );
  console.assert(getPriorityLaneTop("alta", 0) < getPriorityLaneTop("media", 0), "high priority should float higher");
  console.assert(getFloatingCardZIndex({ priority: "alta" }, false) > getFloatingCardZIndex({ priority: "baja" }, false), "high priority should stack higher");
  console.assert(getFloatingCardZIndex({ priority: "baja" }, true) > 250, "hovered cards should jump above the week line");
  console.assert(getDurationDots({ startDay: 1, endDay: 3 }).filter(Boolean).length === 3, "duration dots should match range");
  console.assert(normalizeDailyTasks({ 0: ["Legacy"] })[0][0].text === "Legacy", "legacy string tasks should migrate to objects");
  console.assert(clampFloatingCardOffset(999, -999).x === 120, "drag offset x should be clamped");
  console.assert(clampFloatingCardOffset(999, -999).y === -80, "drag offset y should be clamped");
  console.assert(clampBoardZoom(99) === MAX_BOARD_ZOOM, "board zoom should be clamped at max");
  console.assert(clampBoardZoom(-99) === MIN_BOARD_ZOOM, "board zoom should be clamped at min");
  console.assert(snapFloatingCardOffset({ priority: "alta" }, 37, 29).x !== 37, "snap should adjust x offset");
  console.assert(snapFloatingCardOffset({ priority: "media" }, 31, 25).y !== 25, "snap should adjust y offset");
}

runSelfTests();

export default function App() {
  const localSnapshot = loadLocalSnapshot();

  const [weekStart, setWeekStart] = useState(
    localSnapshot ? startOfWeek(new Date(localSnapshot.weekStart)) : startOfWeek(new Date())
  );
  const [floatingCards, setFloatingCards] = useState(localSnapshot?.floatingCards || initialFloatingCards);
  const [dailyTasks, setDailyTasks] = useState(normalizeDailyTasks(localSnapshot?.dailyTasks || defaultDailyTasks));
  const [hoveredFloatingCardId, setHoveredFloatingCardId] = useState(null);
  const [expandedFloatingCardId, setExpandedFloatingCardId] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [selectedTaskDay, setSelectedTaskDay] = useState(0);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [selectedExpandedDay, setSelectedExpandedDay] = useState(null);
  const [boardZoom, setBoardZoom] = useState(clampBoardZoom(localSnapshot?.boardZoom || 1));
  const [form, setForm] = useState({
    title: "",
    detail: "",
    startDay: 0,
    endDay: 0,
    type: "hito",
    priority: "media",
  });
  const boardRef = useRef(null);
  const pinchStartDistanceRef = useRef(null);
  const pinchStartZoomRef = useRef(1);
  const lastTapRef = useRef({ id: null, time: 0 });
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const weekDays = useMemo(
    () => dayNames.map((name, index) => ({ name, fullName: fullDayNames[index], date: addDays(weekStart, index), index })),
    [weekStart]
  );

  useEffect(() => {
    const snapshot = createLocalSnapshot(floatingCards, dailyTasks, weekStart, boardZoom);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot));
  }, [floatingCards, dailyTasks, weekStart, boardZoom]);

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
    setIsMobilePanelOpen(false);
  }

  function toggleFloatingCardDone(id) {
    setFloatingCards((previous) => previous.map((card) => (card.id === id ? { ...card, done: !card.done } : card)));
  }

  function deleteFloatingCard(id) {
    setFloatingCards((previous) => previous.filter((card) => card.id !== id));
  }

  function moveFloatingCard(id, deltaX, deltaY) {
    setFloatingCards((previous) =>
      previous.map((card) => {
        if (card.id !== id) return card;

        const currentOffset = getFloatingCardOffset(card);
        const rawOffset = clampFloatingCardOffset(
          currentOffset.x + deltaX / boardZoom,
          currentOffset.y + deltaY / boardZoom
        );
        const nextOffset = snapFloatingCardOffset(card, rawOffset.x, rawOffset.y);

        return {
          ...card,
          offsetX: nextOffset.x,
          offsetY: nextOffset.y,
        };
      })
    );
  }

  function handleFloatingCardTap(cardId) {
  const now = Date.now();
  const lastTap = lastTapRef.current;

  if (lastTap.id === cardId && now - lastTap.time < 320) {
    setExpandedFloatingCardId(cardId);
  }

  lastTapRef.current = { id: cardId, time: now };
}

  function changeBoardZoom(delta) {
    setBoardZoom((currentZoom) => clampBoardZoom(Number((currentZoom + delta).toFixed(2))));
  }

  function resetBoardZoom() {
    setBoardZoom(1);
  }

  function getTouchDistance(touches) {
    if (!touches || touches.length < 2) return null;
    const [firstTouch, secondTouch] = touches;
    return Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY
    );
  }

  function handleBoardWheel(event) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeBoardZoom(event.deltaY < 0 ? BOARD_ZOOM_STEP : -BOARD_ZOOM_STEP);
  }

  function handleBoardTouchStart(event) {
    const distance = getTouchDistance(event.touches);
    if (!distance) return;
    pinchStartDistanceRef.current = distance;
    pinchStartZoomRef.current = boardZoom;
  }

  function handleBoardTouchMove(event) {
    const distance = getTouchDistance(event.touches);
    if (!distance || !pinchStartDistanceRef.current) return;
    event.preventDefault();
    const nextZoom = pinchStartZoomRef.current * (distance / pinchStartDistanceRef.current);
    setBoardZoom(clampBoardZoom(Number(nextZoom.toFixed(2))));
  }

  function handleBoardTouchEnd() {
    pinchStartDistanceRef.current = null;
  }

  function resetFloatingCardPosition(id) {
    setFloatingCards((previous) =>
      previous.map((card) =>
        card.id === id
          ? {
              ...card,
              offsetX: 0,
              offsetY: 0,
            }
          : card
      )
    );
  }

  function addDailyTask() {
    if (!taskInput.trim()) return;
    setDailyTasks((previous) => ({
      ...previous,
      [selectedTaskDay]: [...(previous[selectedTaskDay] || []), createTask(taskInput.trim())],
    }));
    setTaskInput("");
  }

  function toggleDailyTaskDone(dayIndex, taskId) {
    setDailyTasks((previous) => ({
      ...previous,
      [dayIndex]: (previous[dayIndex] || []).map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }));
  }

  function removeDailyTask(dayIndex, taskId) {
    setDailyTasks((previous) => ({
      ...previous,
      [dayIndex]: (previous[dayIndex] || []).filter((task) => task.id !== taskId),
    }));
  }

  function resetDeviceData() {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    setFloatingCards(initialFloatingCards);
    setDailyTasks(normalizeDailyTasks(defaultDailyTasks));
    setWeekStart(startOfWeek(new Date()));
    setBoardZoom(1);
  }

  async function exportCalendarToPdf() {
    if (isExportingPdf) return;

    setIsExportingPdf(true);

    try {
      const fileName = `elta-weekly-planner-${new Date().toISOString().slice(0, 10)}.pdf`;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      pdf.setFillColor(255, 244, 226);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");
      pdf.setTextColor(95, 81, 69);
      pdf.setFontSize(18);
      pdf.text("ELTA Weekly Planner", margin, 15);
      pdf.setFontSize(10);
      pdf.text("Mapa mental semanal - resumen exportado", margin, 22);

      let y = 34;
      pdf.setFontSize(13);
      pdf.text("FloatingCards", margin, y);
      y += 8;

      floatingCards.forEach((card, index) => {
        if (y > 180) {
          pdf.addPage();
          y = 18;
        }

        const status = card.done
          ? "Completado"
          : card.endDay < getCurrentWeekDayIndex()
            ? "Atrasado"
            : card.startDay <= getCurrentWeekDayIndex() + 1
              ? "Proximo"
              : "En tiempo";

        if (card.priority === "alta") pdf.setFillColor(255, 224, 138);
        else if (card.priority === "media") pdf.setFillColor(255, 238, 158);
        else pdf.setFillColor(216, 239, 158);

        pdf.roundedRect(margin, y, 82, 28, 3, 3, "F");
        pdf.setTextColor(49, 38, 29);
        pdf.setFontSize(10);
        pdf.text(`${index + 1}. ${card.title}`, margin + 4, y + 7, { maxWidth: 74 });
        pdf.setFontSize(8);
        pdf.text(card.detail || "", margin + 4, y + 13, { maxWidth: 74 });
        pdf.setFontSize(7);
        pdf.text(`${card.priority.toUpperCase()} | ${dayNames[card.startDay]} → ${dayNames[card.endDay]} | ${status}`, margin + 4, y + 24);
        y += 34;
      });

      y += 4;

      if (y > 160) {
        pdf.addPage();
        y = 18;
      }

      pdf.setTextColor(95, 81, 69);
      pdf.setFontSize(13);
      pdf.text("Tareas diarias", margin, y);
      y += 8;

      weekDays.forEach((day) => {
        if (y > 185) {
          pdf.addPage();
          y = 18;
        }

        pdf.setFontSize(10);
        pdf.setTextColor(49, 38, 29);
        pdf.text(`${day.fullName} - ${formatDate(day.date)}`, margin, y);
        y += 5;

        const tasks = dailyTasks[day.index] || [];

        if (tasks.length === 0) {
          pdf.setFontSize(8);
          pdf.setTextColor(120, 105, 90);
          pdf.text("- Sin tareas", margin + 4, y);
          y += 5;
        } else {
          tasks.forEach((task) => {
            pdf.setFontSize(8);
            pdf.setTextColor(task.done ? 130 : 80, task.done ? 130 : 90, task.done ? 130 : 80);
            pdf.text(`${task.done ? "[x]" : "[ ]"} ${task.text}`, margin + 4, y, { maxWidth: 250 });
            y += 5;
          });
        }

        y += 3;
      });

      if (Capacitor.isNativePlatform()) {
        const pdfBase64 = pdf.output("datauristring").split(",")[1];
        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: pdfBase64,
          directory: Directory.Cache,
          recursive: true,
        });

        await Share.share({
          title: "ELTA Weekly Planner",
          text: "Calendario semanal exportado en PDF",
          files: [savedFile.uri],
          dialogTitle: "Compartir PDF",
        });
      } else {
        pdf.save(fileName);
      }
    } catch (error) {
      console.error("No se pudo exportar el PDF", error);
      alert(`No se pudo exportar el PDF: ${error?.message || "error desconocido"}`);
    } finally {
      setIsExportingPdf(false);
    }
  }

  function renderPlannerControls(isMobile = false) {
    return (
      <CardContent>
        {isMobile ? (
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-[#5f5145]">Nuevo cartel</div>
              <div className="text-[10px] text-[#9b8c7e]">Carga rápida mobile</div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobilePanelOpen(false)}
              className="rounded-full bg-[#fff8ef] p-2 text-[#5f5145] shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <h2 className="mb-2 text-sm font-bold">Cargar nuevo cartel</h2>
        <form onSubmit={addFloatingCard} className="space-y-2">
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Título"
            className="w-full rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
          />
          <textarea
            value={form.detail}
            onChange={(event) => setForm({ ...form, detail: event.target.value })}
            placeholder="Detalle"
            className="h-14 w-full rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.startDay}
              onChange={(event) => setForm({ ...form, startDay: Number(event.target.value) })}
              className="rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
            >
              {weekDays.map((day) => (
                <option key={day.index} value={day.index}>{day.fullName}</option>
              ))}
            </select>
            <select
              value={form.endDay}
              onChange={(event) => setForm({ ...form, endDay: Number(event.target.value) })}
              className="rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
            >
              {weekDays.map((day) => (
                <option key={day.index} value={day.index}>{day.fullName}</option>
              ))}
            </select>
          </div>
          <select
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
            className="w-full rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
          >
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Normal</option>
          </select>
          <Button className="w-full rounded-lg bg-[#cfa983] px-2 py-2 text-xs font-bold text-[#5f5145] hover:bg-[#bf9470]">
            <Plus className="mr-1 inline h-4 w-4" /> Agregar cartel
          </Button>
        </form>

        <div className="my-3 border-t border-[#ddc8b3]" />

        <h3 className="mb-2 text-xs font-semibold">Tareas diarias rápidas</h3>
        <select
          value={selectedTaskDay}
          onChange={(event) => setSelectedTaskDay(Number(event.target.value))}
          className="mb-2 w-full rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
        >
          {weekDays.map((day) => (
            <option key={day.index} value={day.index}>{day.fullName}</option>
          ))}
        </select>
        <div className="flex gap-1.5">
          <input
            value={taskInput}
            onChange={(event) => setTaskInput(event.target.value)}
            placeholder="Agregar tarea..."
            className="w-full rounded-lg border border-[#ddc8b3] bg-[#f7efe5] px-2 py-1.5 text-xs outline-none"
          />
          <Button type="button" onClick={addDailyTask} className="rounded-lg bg-[#cfa983] px-2.5 py-1.5 font-bold text-[#5f5145]">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="my-3 border-t border-[#ddc8b3]" />

        <Button
          type="button"
          onClick={exportCalendarToPdf}
          disabled={isExportingPdf}
          className="w-full rounded-lg bg-[#fff9f2]/90 px-2 py-2 text-xs font-bold text-[#5f5145] hover:bg-[#f4e4d2] disabled:opacity-60"
        >
          <Download className="mr-1 inline h-4 w-4" /> {isExportingPdf ? "Exportando..." : "Exportar PDF"}
        </Button>
        <Button
          type="button"
          onClick={resetDeviceData}
          className="mt-2 w-full rounded-lg bg-[#fff9f2]/90 px-2 py-2 text-xs text-[#5f5145] hover:bg-[#f4e4d2]"
        >
          Reiniciar datos
        </Button>
      </CardContent>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f6ecd9] p-2 text-[#614f3d] md:p-3" style={{ fontFamily: "Comic Sans MS, Nunito, ui-sans-serif, system-ui" }}>
      <div className="mx-auto flex h-full max-w-[1600px] flex-col">
        <div className="pointer-events-none fixed left-2 top-2 z-[700] rounded-full bg-[#fff9f2]/90 px-2 py-1 text-[10px] font-bold text-[#8b6f54] shadow-sm">
          ELTA Planner v{APP_VERSION}
        </div>
        <section className="grid min-h-0 flex-1 gap-2 md:grid-cols-[220px_1fr]">
          <Card className="hidden max-h-full overflow-y-auto rounded-[1.25rem] border border-[#ddc8b3] bg-[#fff9f2]/70 p-2 md:sticky md:top-2 md:block md:self-start">
            {renderPlannerControls()}
          </Card>

          <div className="grid min-h-0 min-w-0 grid-rows-[190px_170px] gap-2 rounded-[1.5rem]">
            <div
              className="relative min-h-0 overflow-x-auto overflow-y-hidden rounded-[1.5rem] border border-[#ead8c0] bg-[#fff4e2] p-3 shadow-lg"
              onWheel={handleBoardWheel}
              onTouchStart={handleBoardTouchStart}
              onTouchMove={handleBoardTouchMove}
              onTouchEnd={handleBoardTouchEnd}
            >
              <div className="absolute right-3 top-3 z-[450] flex items-center gap-1 rounded-full border border-[#ead8c0] bg-[#fff9f2]/95 px-2 py-1 text-[#5f5145] shadow-sm">
                <button type="button" onClick={() => changeBoardZoom(-BOARD_ZOOM_STEP)} className="h-7 w-7 rounded-full bg-[#f4e4d2] text-sm font-bold">-</button>
                <button type="button" onClick={resetBoardZoom} className="min-w-[48px] rounded-full px-2 text-[10px] font-bold">
                  {Math.round(boardZoom * 100)}%
                </button>
                <button type="button" onClick={() => changeBoardZoom(BOARD_ZOOM_STEP)} className="h-7 w-7 rounded-full bg-[#f4e4d2] text-sm font-bold">+</button>
                <button
  type="button"
  onClick={resetBoardZoom}
  className="rounded-full bg-[#fff4e2] px-2 py-1 text-[10px] font-bold"
>
  Reset
</button>
              </div>

              <div
                className="relative h-full min-h-[190px] min-w-[720px] overflow-visible transition-transform duration-200"
                style={{
                  transform: `scale(${boardZoom})`,
                  transformOrigin: "top left",
                  width: `${100 / boardZoom}%`,
                  height: `${100 / boardZoom}%`,
                }}            
              ><svg
  className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible"
  viewBox="0 0 980 360"
  preserveAspectRatio="none"
>
  {getCardConnections(floatingCards).map((connection) => {
    const source = getFloatingCardCenter(connection.sourceCard, connection.sourceIndex);
    const target = getFloatingCardCenter(connection.targetCard, connection.targetIndex);
    const middleX = (source.x + target.x) / 2;

    return (
      <path
        key={connection.id}
        d={`M ${source.x} ${source.y} C ${middleX} ${source.y}, ${middleX} ${target.y}, ${target.x} ${target.y}`}
        fill="none"
        stroke="#9b7a55"
        strokeWidth="2"
        strokeDasharray="6 7"
        strokeLinecap="round"
        opacity="0.38"
      />
    );
  })}
</svg>
                <AnimatePresence>
                  {floatingCards.map((card, index) => {
                    const isHovered = hoveredFloatingCardId === card.id;
                    const cardOffset = getFloatingCardOffset(card);
                    const cardShellClassName = "absolute cursor-grab touch-none overflow-visible active:cursor-grabbing";
                    const paperClassName = [
  "relative h-full overflow-hidden rounded-md border shadow-xl transition-all duration-300 hover:shadow-2xl",
  "mx-1 my-1",
  getStatusColor(card),
  getPrioritySize(card.priority),
].join(" ");
                    const titleClassName = "mt-2 max-w-full overflow-hidden break-words font-semibold leading-[1.05] text-[#31261d] " + getTitleSize(card.priority);

                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, y: 18, rotate: -2 }}
                        animate={{ opacity: 1, x: cardOffset.x, y: cardOffset.y, rotate: index % 2 === 0 ? -1.4 : 1.4 }}
                        transition={{
  type: "spring",
  stiffness: 180,
  damping: 34,
  mass: 0.9,
}}
                        whileHover={{ rotate: 0, scale: 1.055 }}
                        drag
                        dragMomentum={false}
                        dragElastic={0.16}
                        onDragEnd={(_, info) => moveFloatingCard(card.id, info.offset.x, info.offset.y)}
                        onDoubleClick={() => setExpandedFloatingCardId(card.id)}
                        onMouseEnter={() => setHoveredFloatingCardId(card.id)}
                        onMouseLeave={() => setHoveredFloatingCardId(null)}
                        onClick={() => {
  setHoveredFloatingCardId(card.id);
  handleFloatingCardTap(card.id);
}}
                        style={{
  left: getFloatingCardLeft(card) + "%",
  top: getPriorityLaneTop(card.priority, index) + "px",
  width: getFloatingCardWidth(card) + "%",
  margin: "6px",
  zIndex: getFloatingCardZIndex(card, isHovered),
  transformOrigin: "center top",
  touchAction: "none",
}}
                        className={cardShellClassName}
                      >
                        <div className="absolute left-1/2 top-[-18px] z-30 -translate-x-1/2">
                          <div className={"h-8 w-8 rounded-full border-2 border-white/80 " + getPinColor(card.priority)}>
                            <div className="mx-auto mt-1 h-2 w-2 rounded-full bg-white/65" />
                          </div>
                        </div>

                        <div className={paperClassName + " p-3"}>
                          <div className="flex items-start justify-between text-[#5b4636]" onPointerDown={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => toggleFloatingCardDone(card.id)} className="rounded-full bg-[#fff8ef]/75 p-1.5">
                              {card.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => deleteFloatingCard(card.id)} className="rounded-full bg-[#fff8ef]/75 p-1.5">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/45 px-1.5 py-0 text-[7px] font-semibold uppercase tracking-wide text-[#6b513e]">
                            <Flag className="h-3 w-3" /> {card.priority === "baja" ? "normal" : card.priority}
                          </div>

                          <h3 className={titleClassName}>
                            <span className="block line-clamp-2 overflow-hidden break-words">{card.title}</span>
                          </h3>

                          {card.detail ? (
                            <p className="mt-1 line-clamp-2 overflow-hidden break-words text-[8px] leading-[1.1] text-[#5e4939]">
                              {card.detail}
                            </p>
                          ) : null}

                          <div className="mt-2 border-t border-[#7b5c3a]/20 pt-1.5">
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
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            <div data-export-board="true" ref={boardRef} className="overflow-x-auto rounded-[1.5rem] border border-[#ead8c0] bg-[#fff4e2] p-2 shadow-lg">
              <div className="flex h-full min-w-[720px] items-stretch gap-2">
                {weekDays.map((day) => {
                  const dayCards = floatingCards.filter((card) => card.startDay <= day.index && card.endDay >= day.index);
                  const completed = dayCards.filter((card) => card.done).length;
                  const tasks = dailyTasks[day.index] || [];

                  const isExpandedDay = selectedExpandedDay === day.index;
                  const isToday = getCurrentWeekDayIndex() === day.index;

                  return (
                    <div
                      key={day.index}
                      onClick={() => setSelectedExpandedDay((currentDay) => (currentDay === day.index ? null : day.index))}
                      className={
  "flex flex-col rounded-2xl border px-2 py-2 shadow-md transition-all duration-300 " +
  (isExpandedDay
    ? "min-w-[180px] flex-[2] border-[#cfa983] bg-[#ffe8b8] shadow-xl "
    : "min-w-[95px] flex-1 border-[#ead8c0] bg-[#fff7ea]/95 ") +
  (isToday
    ? "ring-4 ring-[#d18b46] ring-offset-2 ring-offset-[#fff4e2]"
    : "")
}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-base font-semibold text-[#5f5145]">{isToday ? "HOY · " : ""}
{day.name}</div>
                          <div className="text-xs text-[#9b8c7e]">{formatDate(day.date)}</div>
                        </div>
                        <div className="rounded-full bg-[#fff9f2]/80 px-2 py-1 text-[10px] font-bold text-[#8b6f54]">
                          {completed}/{dayCards.length}
                        </div>
                      </div>

                      <div
                        className={
                          "mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-left " +
                          (isExpandedDay ? "max-h-[135px]" : "max-h-[88px]")
                        }
                      >
                        {tasks.length === 0 ? (
                          <div className="rounded-xl bg-[#efe0cd]/45 px-2 py-1 text-[9px] text-[#9b8c7e]">Sin tareas</div>
                        ) : null}

                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className={
                              "flex items-center justify-between gap-1 rounded-xl px-2 py-1 text-[9px] text-[#7b6d61] " +
                              (task.done ? "bg-[#d6edc7]/80 opacity-70" : "bg-[#efe0cd]/70")
                            }
                          >
                            <button
                              type="button"
                              onClick={() => toggleDailyTaskDone(day.index, task.id)}
                              className="flex min-w-0 flex-1 items-center gap-1 text-left"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70">
                                {task.done ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                              </span>
                              <span className={(isExpandedDay ? "whitespace-normal break-words " : "truncate ") + (task.done ? "line-through" : "")}>{task.text}</span>
                            </button>
                            <button type="button" onClick={() => removeDailyTask(day.index, task.id)} className="shrink-0 rounded-full bg-white/60 p-1">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
<AnimatePresence>
  {expandedFloatingCardId ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[800] bg-[#3d2b1f]/35 p-4"
      onClick={() => setExpandedFloatingCardId(null)}
    >
      {floatingCards
        .filter((card) => card.id === expandedFloatingCardId)
        .map((card) => (
          <motion.div
            key={card.id}
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            className={"mx-auto flex h-full max-w-xl flex-col rounded-[2rem] border p-6 shadow-2xl " + getStatusColor(card)}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#6b513e]">
                  {card.priority === "baja" ? "normal" : card.priority}
                </div>
                <h2 className="mt-2 text-3xl font-bold text-[#31261d]">{card.title}</h2>
              </div>

              <button
                type="button"
                onClick={() => setExpandedFloatingCardId(null)}
                className="rounded-full bg-white/70 p-3"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="flex-1 overflow-y-auto text-base leading-relaxed text-[#5e4939]">
              {card.detail || "Sin detalle cargado."}
            </p>

            <div className="mt-4 rounded-2xl bg-white/45 p-4 text-sm font-semibold text-[#6b513e]">
              Duración: {dayNames[card.startDay]} → {dayNames[card.endDay]}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                type="button"
                onClick={() => toggleFloatingCardDone(card.id)}
                className="rounded-xl bg-white/70 px-4 py-3 font-bold"
              >
                {card.done ? "Desmarcar" : "Completar"}
              </Button>

              <Button
  type="button"
  onClick={() => {
    resetFloatingCardPosition(card.id);

    setTimeout(() => {
      setExpandedFloatingCardId(null);
    }, 150);
  }}
  className="rounded-xl bg-white/70 px-4 py-3 font-bold"
>
  Reset posición
</Button>
            </div>
          </motion.div>
        ))}
    </motion.div>
  ) : null}
</AnimatePresence>
        <button
          type="button"
          onClick={() => setIsMobilePanelOpen(true)}
          className="fixed bottom-5 right-5 z-[500] flex h-14 w-14 items-center justify-center rounded-full bg-[#cfa983] text-[#5f5145] shadow-[0_12px_30px_rgba(90,60,35,0.28)] md:hidden"
        >
          <Plus className="h-7 w-7" />
        </button>

        <AnimatePresence>
          {isMobilePanelOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[600] bg-[#3d2b1f]/25 md:hidden"
              onClick={() => setIsMobilePanelOpen(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="absolute inset-x-2 bottom-2 max-h-[82vh] overflow-y-auto rounded-[1.75rem] border border-[#ddc8b3] bg-[#fff9f2] p-3 shadow-[0_-12px_40px_rgba(70,45,25,0.2)]"
                onClick={(event) => event.stopPropagation()}
              >
                {renderPlannerControls(true)}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
