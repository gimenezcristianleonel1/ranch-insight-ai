import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Upload, FileSpreadsheet, FileText } from "lucide-react";
import { exportToCsv, exportToXlsx, pickFile, parseFile, type Column } from "@/lib/io";
import { toast } from "sonner";

export function ExportMenu<T>({
  items,
  cols,
  filename,
  size = "default",
}: {
  items: T[];
  cols: Column<T>[];
  filename: string;
  size?: "sm" | "default";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{items.length} registros</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => exportToXlsx(items, cols, filename)}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportToCsv(items, cols, filename)}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ImportButton({
  onRows,
  size = "default",
  label = "Importar",
}: {
  onRows: (rows: Record<string, unknown>[]) => Promise<void> | void;
  size?: "sm" | "default";
  label?: string;
}) {
  async function handle() {
    const file = await pickFile();
    if (!file) return;
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast.error("El archivo no contiene filas");
        return;
      }
      await onRows(rows);
    } catch (e: any) {
      toast.error(`Error leyendo archivo: ${e.message ?? e}`);
    }
  }
  return (
    <Button variant="outline" size={size} onClick={handle}>
      <Upload className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}