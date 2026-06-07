"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { confirm } from "@/components/ui/confirm-dialog";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ServerRow = { id: number; name: string; amount: string };
type LocalRow = { id: number; name: string; amount: string };

type Props = {
  rows: ServerRow[];
  onSave: (newRows: { name: string; amount: number }[], updatedRows: { id: number; name: string; amount: number }[]) => void;
  onDelete: (id: number) => void;
  addLabel?: string;
  isLoading?: boolean;
  isSaving?: boolean;
};

let tempId = -1;

function SortableRow({ row, onUpdate, onRemove }: {
  row: LocalRow;
  onUpdate: (id: number, field: "name" | "amount", value: string) => void;
  onRemove: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <tr ref={setNodeRef} style={style} className={`border-b border-border/50 hover:bg-muted/30 ${row.id < 0 ? "bg-green-50/50" : ""}`}>
      <td className="py-1.5 w-8 text-center cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 inline-block" />
      </td>
      <td className="py-1.5">
        <Input value={row.name} onChange={(e) => onUpdate(row.id, "name", e.target.value)}
          placeholder={row.id < 0 ? "New item name..." : ""} autoFocus={row.id < 0}
          className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-1" />
      </td>
      <td className="py-1.5">
        <Input type="number" value={row.amount} onChange={(e) => onUpdate(row.id, "amount", e.target.value)}
          placeholder="0" className="h-8 border-0 bg-transparent px-1 text-right font-mono shadow-none focus-visible:ring-1" />
      </td>
      <td className="py-1.5 text-center">
        <button onClick={() => onRemove(row.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

export default function EditableRowTable({ rows, onSave, onDelete, addLabel = "Add", isLoading, isSaving }: Props) {
  const [local, setLocal] = useState<LocalRow[]>([]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  useEffect(() => {
    setLocal(rows.map((r) => ({ id: r.id, name: r.name, amount: String(Number(r.amount)) })));
  }, [rows]);

  const isDirty = useMemo(() => {
    if (local.some((r) => r.id < 0)) return true;
    if (local.length !== rows.length) return false;
    return local.some((r, i) => {
      const orig = rows[i];
      if (!orig || r.id !== orig.id) return true;
      return r.name !== orig.name || r.amount !== String(Number(orig.amount));
    });
  }, [local, rows]);

  useUnsavedWarning(isDirty);

  const addRow = () => setLocal((prev) => [{ id: tempId--, name: "", amount: "" }, ...prev]);

  const updateRow = (id: number, field: "name" | "amount", value: string) => {
    setLocal((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRow = async (id: number) => {
    if (id < 0) { setLocal((prev) => prev.filter((r) => r.id !== id)); return; }
    if (await confirm({ title: "Delete Row", description: "This row will be permanently removed.", confirmLabel: "Delete", destructive: true })) onDelete(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLocal((prev) => {
        const oldIndex = prev.findIndex((r) => r.id === active.id);
        const newIndex = prev.findIndex((r) => r.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    const newRows = local.filter((r) => r.id < 0 && r.name.trim()).map((r) => ({ name: r.name.trim(), amount: parseFloat(r.amount) || 0 }));
    const updatedRows = local.filter((r) => {
      if (r.id < 0) return false;
      const origIdx = rows.findIndex((o) => o.id === r.id);
      const orig = rows[origIdx];
      if (!orig) return false;
      const localIdx = local.findIndex((l) => l.id === r.id);
      return r.name !== orig.name || r.amount !== String(Number(orig.amount)) || localIdx !== origIdx;
    }).map((r) => ({ id: r.id, name: r.name.trim(), amount: parseFloat(r.amount) || 0 }));
    onSave(newRows, updatedRows);
  };

  const handleDiscard = () => setLocal(rows.map((r) => ({ id: r.id, name: r.name, amount: String(Number(r.amount)) })));

  const total = local.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="mb-3">
        <Button size="sm" variant="outline" onClick={addRow} className="h-7 text-xs">
          <Plus className="mr-1 h-3 w-3" />{addLabel}
        </Button>
      </div>

      {local.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 w-8" />
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium text-right w-40">Amount (₹)</th>
                <th className="pb-2 w-10" />
              </tr>
            </thead>
            <SortableContext items={local.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {local.map((row) => (
                  <SortableRow key={row.id} row={row} onUpdate={updateRow} onRemove={removeRow} />
                ))}
              </tbody>
            </SortableContext>
            <tfoot>
              <tr className="font-medium">
                <td />
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right font-mono">₹ {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </DndContext>
      )}

      {isDirty && (
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDiscard}>Discard</Button>
        </div>
      )}
    </div>
  );
}
