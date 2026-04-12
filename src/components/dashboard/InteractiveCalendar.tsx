import { useState, useRef, useCallback } from "react";
import { format, startOfWeek, addDays, isSameDay, isToday as isTodayFn, isBefore, subWeeks, addWeeks, startOfMonth, endOfMonth, addMonths, subMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, GripVertical, X, Trash2, Pencil, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useGoogleCalendarStatus,
  useGoogleCalendarEvents,
  useCreateGoogleEvent,
  useUpdateGoogleEvent,
  useDeleteGoogleEvent,
} from "@/hooks/useGoogleCalendar";

type UnifiedEvent = {
  id: string;
  title: string;
  date: string;
  hora: string;
  endHora?: string;
  descricao?: string;
  source: "local" | "google";
  googleEventId?: string;
};

type ViewMode = "week" | "month";

interface Props {
  localVisitas: Array<{
    id: string;
    data: string | null;
    hora: string | null;
    descricao: string | null;
    status_visita: string;
    projeto_id: string;
    google_event_id: string | null;
    projetoNome: string;
  }>;
  isLoadingLocal?: boolean;
}

export default function InteractiveCalendar({ localVisitas, isLoadingLocal }: Props) {
  const navigate = useNavigate();
  const hoje = new Date();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(hoje, { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(hoje);

  // Modals
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [createDate, setCreateDate] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("10:00");

  // Drag state
  const [dragEvent, setDragEvent] = useState<UnifiedEvent | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Google hooks
  const { data: googleStatus } = useGoogleCalendarStatus();
  const { data: googleEvents, isLoading: isLoadingGoogle } = useGoogleCalendarEvents(googleStatus?.connected ?? false);
  const createMutation = useCreateGoogleEvent();
  const updateMutation = useUpdateGoogleEvent();
  const deleteMutation = useDeleteGoogleEvent();

  const isConnected = googleStatus?.connected ?? false;

  // Build unified events
  const linkedGoogleIds = new Set(
    localVisitas.filter(v => v.google_event_id).map(v => v.google_event_id!)
  );

  const localEvents: UnifiedEvent[] = localVisitas
    .filter(v => v.data && v.status_visita !== "cancelada")
    .map(v => ({
      id: v.id,
      title: v.projetoNome || "Visita técnica",
      date: v.data!,
      hora: v.hora ?? "",
      descricao: v.descricao ?? undefined,
      source: "local" as const,
      googleEventId: v.google_event_id ?? undefined,
    }));

  const gEvents: UnifiedEvent[] = (googleEvents ?? [])
    .filter(e => !linkedGoogleIds.has(e.id))
    .map(e => {
      const startStr = e.start || "";
      let eventDate = "";
      let eventTime = "";
      let endTime = "";
      if (startStr.includes("T")) {
        const dt = new Date(startStr);
        eventDate = format(dt, "yyyy-MM-dd");
        eventTime = format(dt, "HH:mm");
      } else {
        eventDate = startStr;
      }
      if (e.end && e.end.includes("T")) {
        endTime = format(new Date(e.end), "HH:mm");
      }
      return {
        id: e.id,
        title: e.summary || "Sem título",
        date: eventDate,
        hora: eventTime,
        endHora: endTime,
        descricao: e.description || undefined,
        source: "google" as const,
        googleEventId: e.id,
      };
    });

  const allEvents = [...localEvents, ...gEvents];

  // Helpers
  const getEventsForDay = (day: Date) =>
    allEvents
      .filter(ev => ev.date && isSameDay(new Date(ev.date + "T00:00:00"), day))
      .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));

  // Handlers
  const handleEventClick = (ev: UnifiedEvent) => {
    setSelectedEvent(ev);
    setEditMode(false);
    setFormTitle(ev.title);
    setFormDesc(ev.descricao || "");
    setFormDate(ev.date);
    setFormStartTime(ev.hora || "09:00");
    setFormEndTime(ev.endHora || "10:00");
    setEventModalOpen(true);
  };

  const handleDayClick = (day: Date) => {
    if (!isConnected) {
      toast.info("Conecte o Google Agenda para criar eventos");
      return;
    }
    const dateStr = format(day, "yyyy-MM-dd");
    setCreateDate(dateStr);
    setFormTitle("");
    setFormDesc("");
    setFormDate(dateStr);
    setFormStartTime("09:00");
    setFormEndTime("10:00");
    setCreateModalOpen(true);
  };

  const handleCreateEvent = async () => {
    if (!formTitle.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    const startDateTime = `${formDate}T${formStartTime}:00`;
    const endDateTime = `${formDate}T${formEndTime}:00`;
    try {
      await createMutation.mutateAsync({
        summary: formTitle,
        description: formDesc,
        startDateTime,
        endDateTime,
      });
      toast.success("Evento criado no Google Agenda");
      setCreateModalOpen(false);
    } catch {
      toast.error("Erro ao criar evento");
    }
  };

  const handleEditEvent = () => {
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent?.googleEventId) {
      toast.error("Só é possível editar eventos do Google");
      return;
    }
    const startDateTime = `${formDate}T${formStartTime}:00`;
    const endDateTime = `${formDate}T${formEndTime}:00`;
    try {
      await updateMutation.mutateAsync({
        eventId: selectedEvent.googleEventId,
        summary: formTitle,
        description: formDesc,
        startDateTime,
        endDateTime,
      });
      toast.success("Evento atualizado");
      setEventModalOpen(false);
      setEditMode(false);
    } catch {
      toast.error("Erro ao atualizar evento");
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent?.googleEventId) {
      toast.error("Só é possível excluir eventos do Google");
      return;
    }
    try {
      await deleteMutation.mutateAsync(selectedEvent.googleEventId);
      toast.success("Evento excluído");
      setEventModalOpen(false);
    } catch {
      toast.error("Erro ao excluir evento");
    }
  };

  // Drag & Drop
  const handleDragStart = (ev: UnifiedEvent) => {
    if (ev.source !== "google" || !ev.googleEventId) return;
    setDragEvent(ev);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    if (!dragEvent?.googleEventId) return;

    const startDateTime = `${dateStr}T${dragEvent.hora || "09:00"}:00`;
    const endDateTime = `${dateStr}T${dragEvent.endHora || "10:00"}:00`;
    try {
      await updateMutation.mutateAsync({
        eventId: dragEvent.googleEventId,
        summary: dragEvent.title,
        description: dragEvent.descricao || "",
        startDateTime,
        endDateTime,
      });
      toast.success("Evento movido");
    } catch {
      toast.error("Erro ao mover evento");
    }
    setDragEvent(null);
  };

  const isLoading = (isLoadingGoogle && isConnected) || isLoadingLocal;

  // Render event card
  const renderEventCard = (ev: UnifiedEvent, compact = false) => {
    const isPast = isBefore(new Date(ev.date + "T23:59:59"), hoje) && !isTodayFn(new Date(ev.date + "T00:00:00"));
    const isGoogle = ev.source === "google";
    const canDrag = isGoogle && !!ev.googleEventId;

    return (
      <div
        key={`${ev.source}-${ev.id}`}
        draggable={canDrag}
        onDragStart={() => handleDragStart(ev)}
        onClick={(e) => { e.stopPropagation(); handleEventClick(ev); }}
        className={`group cursor-pointer p-1.5 rounded-lg border-l-[3px] transition-all hover:shadow-md ${
          canDrag ? "cursor-grab active:cursor-grabbing" : ""
        } ${
          isPast
            ? "border-l-muted-foreground/40 bg-muted/30 opacity-70"
            : isGoogle
            ? "border-l-[hsl(210,70%,50%)] bg-[hsl(210,70%,50%)]/5 hover:bg-[hsl(210,70%,50%)]/10"
            : "border-l-[hsl(152,69%,40%)] bg-[hsl(152,69%,40%)]/5 hover:bg-[hsl(152,69%,40%)]/10"
        }`}
      >
        <div className="flex items-center gap-1">
          {canDrag && <GripVertical size={8} className="text-muted-foreground/40 shrink-0" />}
          <p className={`${compact ? "text-[8px]" : "text-[10px]"} font-semibold text-primary/80`}>{ev.hora || "—"}</p>
          {isGoogle && (
            <span className="text-[7px] px-1 py-px rounded bg-[hsl(210,70%,50%)]/15 text-[hsl(210,70%,50%)] font-medium leading-none">G</span>
          )}
        </div>
        <p className={`${compact ? "text-[8px]" : "text-[10px]"} font-medium text-foreground truncate leading-tight`}>{ev.title}</p>
      </div>
    );
  };

  // Week view
  const renderWeekView = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

    return (
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, idx) => {
          const isCurrentDay = isTodayFn(day);
          const dayEvents = getEventsForDay(day);
          const dateStr = format(day, "yyyy-MM-dd");

          return (
            <div
              key={idx}
              className={`flex flex-col rounded-xl border min-h-[180px] transition-all ${
                dragOverDate === dateStr ? "ring-2 ring-primary/50 bg-primary/10" : ""
              } ${
                isCurrentDay
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-border/40 bg-secondary/10 hover:bg-secondary/20"
              }`}
              onDragOver={(e) => handleDragOver(e, dateStr)}
              onDrop={(e) => handleDrop(e, dateStr)}
              onDragLeave={() => setDragOverDate(null)}
            >
              <div
                className={`text-center py-2 rounded-t-xl cursor-pointer hover:bg-primary/5 transition-colors ${isCurrentDay ? "bg-primary/10" : ""}`}
                onClick={() => handleDayClick(day)}
              >
                <p className={`text-[10px] uppercase font-semibold tracking-wider ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p className={`text-lg font-bold leading-tight ${isCurrentDay ? "text-primary" : "text-foreground"}`}>
                  {format(day, "dd")}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase">{format(day, "MMM", { locale: ptBR })}</p>
              </div>

              <div className="flex-1 px-1.5 pb-1.5 space-y-1 overflow-y-auto max-h-[160px]">
                {dayEvents.length > 0 ? (
                  dayEvents.map(ev => renderEventCard(ev))
                ) : (
                  <div
                    className="flex items-center justify-center h-full cursor-pointer group/empty"
                    onClick={() => handleDayClick(day)}
                  >
                    <Plus size={12} className="text-muted-foreground/20 group-hover/empty:text-primary/40 transition-colors" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Month view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const weeks: Date[][] = [];
    let current = calStart;
    while (current <= monthEnd || weeks.length < 5) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current);
        current = addDays(current, 1);
      }
      weeks.push(week);
      if (weeks.length >= 6) break;
    }

    return (
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
            <p key={d} className="text-[9px] text-center font-semibold text-muted-foreground uppercase py-1">{d}</p>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              const isCurrentDay = isTodayFn(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const dayEvents = getEventsForDay(day);
              const dateStr = format(day, "yyyy-MM-dd");

              return (
                <div
                  key={di}
                  className={`rounded-lg border min-h-[80px] p-1 transition-all cursor-pointer ${
                    dragOverDate === dateStr ? "ring-2 ring-primary/50" : ""
                  } ${
                    !isCurrentMonth ? "opacity-40" : ""
                  } ${
                    isCurrentDay ? "border-primary/40 bg-primary/5" : "border-border/30 bg-secondary/5 hover:bg-secondary/15"
                  }`}
                  onClick={() => handleDayClick(day)}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDrop={(e) => handleDrop(e, dateStr)}
                  onDragLeave={() => setDragOverDate(null)}
                >
                  <p className={`text-[9px] text-center font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "dd")}
                  </p>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map(ev => renderEventCard(ev, true))}
                    {dayEvents.length > 3 && (
                      <p className="text-[7px] text-center text-muted-foreground">+{dayEvents.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="lg:col-span-3 bg-card rounded-2xl border border-border/60 p-6 shadow-[0_2px_16px_-4px_hsl(var(--foreground)/0.06)] backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <CalendarDays size={15} className="text-primary" />
          </div>
          Agenda
        </h3>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="text-[10px] text-[hsl(152,69%,40%)] bg-[hsl(152,69%,40%)]/8 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(152,69%,40%)] animate-pulse" /> Google Agenda
            </span>
          ) : (
            <button
              onClick={() => navigate("/integracoes")}
              className="text-[10px] text-primary bg-primary/8 px-3 py-1 rounded-full hover:bg-primary/15 transition-all cursor-pointer font-medium"
            >
              Conectar Google Agenda →
            </button>
          )}
          {/* View toggle */}
          <div className="flex bg-secondary/40 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("week")}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-all ${viewMode === "week" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-all ${viewMode === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mês
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-3 mb-4">
        <button
          onClick={() => viewMode === "week" ? setCurrentWeekStart(prev => subWeeks(prev, 1)) : setCurrentMonth(prev => subMonths(prev, 1))}
          className="p-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-foreground">
            {viewMode === "week"
              ? `${format(currentWeekStart, "dd MMM", { locale: ptBR })} — ${format(addDays(currentWeekStart, 6), "dd MMM yyyy", { locale: ptBR })}`
              : format(currentMonth, "MMMM yyyy", { locale: ptBR })
            }
          </span>
          <button
            onClick={() => {
              if (viewMode === "week") setCurrentWeekStart(startOfWeek(hoje, { weekStartsOn: 1 }));
              else setCurrentMonth(hoje);
            }}
            className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-all"
          >
            Hoje
          </button>
        </div>
        <button
          onClick={() => viewMode === "week" ? setCurrentWeekStart(prev => addWeeks(prev, 1)) : setCurrentMonth(prev => addMonths(prev, 1))}
          className="p-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-xl" />
          ))}
        </div>
      ) : viewMode === "week" ? renderWeekView() : renderMonthView()}

      {/* Create event button */}
      {isConnected && (
        <button
          onClick={() => {
            setFormDate(format(hoje, "yyyy-MM-dd"));
            setFormTitle("");
            setFormDesc("");
            setFormStartTime("09:00");
            setFormEndTime("10:00");
            setCreateModalOpen(true);
          }}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/8 hover:bg-primary/15 text-primary text-xs font-medium transition-all border border-primary/10 hover:border-primary/20"
        >
          <Plus size={13} />
          Novo Evento
        </button>
      )}

      {/* Event detail modal */}
      <Dialog open={eventModalOpen} onOpenChange={(open) => { setEventModalOpen(open); if (!open) setEditMode(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              {editMode ? "Editar Evento" : "Detalhes do Evento"}
            </DialogTitle>
          </DialogHeader>

          {selectedEvent && !editMode && (
            <div className="space-y-4">
              <div>
                <p className="text-base font-semibold text-foreground">{selectedEvent.title}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Clock size={14} />
                  <span>{format(new Date(selectedEvent.date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>
                  {selectedEvent.hora && <span>às {selectedEvent.hora}</span>}
                  {selectedEvent.endHora && <span>- {selectedEvent.endHora}</span>}
                </div>
                {selectedEvent.source === "google" && (
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[hsl(210,70%,50%)]/10 text-[hsl(210,70%,50%)] font-medium">
                    Google Agenda
                  </span>
                )}
                {selectedEvent.source === "local" && (
                  <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-[hsl(152,69%,40%)]/10 text-[hsl(152,69%,40%)] font-medium">
                    Visita Técnica
                  </span>
                )}
              </div>
              {selectedEvent.descricao && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedEvent.descricao}</p>
                </div>
              )}
            </div>
          )}

          {selectedEvent && editMode && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {selectedEvent && !editMode && (
              <>
                {selectedEvent.source === "local" && (
                  <Button variant="outline" size="sm" onClick={() => navigate("/projetos")}>
                    Ver Projeto
                  </Button>
                )}
                {selectedEvent.googleEventId && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleEditEvent} className="gap-1">
                      <Pencil size={12} /> Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteEvent} disabled={deleteMutation.isPending} className="gap-1">
                      <Trash2 size={12} /> Excluir
                    </Button>
                  </>
                )}
              </>
            )}
            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create event modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              Novo Evento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Nome do evento" />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateEvent} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
