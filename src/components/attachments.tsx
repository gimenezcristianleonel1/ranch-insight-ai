import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Trash2, Upload, FileText, Image as ImageIcon } from "lucide-react";
import { uploadFile, listFiles, getSignedUrl, deleteFile, type EntityType } from "@/lib/storage";
import { useActiveEstablecimiento } from "@/hooks/use-establecimiento";
import { fmtDate } from "@/lib/format";

export function Attachments({
  entityType,
  entityId,
  categoria,
}: {
  entityType: EntityType;
  entityId: string;
  categoria?: string;
}) {
  const { activeId: establecimientoId } = useActiveEstablecimiento();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!entityId) return;
    try {
      setItems(await listFiles(entityType, entityId));
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length || !establecimientoId) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        await uploadFile({ file: f, establecimientoId, entityType, entityId, categoria });
      }
      toast.success("Archivos subidos");
      await refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function onDownload(path: string, nombre: string) {
    try {
      const url = await getSignedUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      a.target = "_blank";
      a.click();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function onDelete(id: string, path: string) {
    if (!confirm("¿Eliminar archivo?")) return;
    try {
      await deleteFile(id, path);
      toast.success("Archivo eliminado");
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Archivos ({items.length})</h3>
        <label>
          <input type="file" multiple className="hidden" onChange={onUpload} disabled={busy} />
          <Button size="sm" asChild disabled={busy}>
            <span className="cursor-pointer"><Upload className="h-4 w-4 mr-1" />{busy ? "Subiendo…" : "Subir"}</span>
          </Button>
        </label>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin archivos.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((it) => {
            const isImg = (it.tipo_mime ?? "").startsWith("image/");
            return (
              <li key={it.id} className="py-2 flex items-center gap-3">
                {isImg ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{it.nombre}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(it.created_at)} · {Math.round((it.tamano_bytes ?? 0)/1024)} KB</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => onDownload(it.path, it.nombre)}><Download className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(it.id, it.path)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}